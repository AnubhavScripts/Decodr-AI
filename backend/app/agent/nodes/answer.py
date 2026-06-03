"""Answer generator node — produces the final streaming response."""

import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import AIMessage

from app.agent.state import AgentState
from app.agent.prompts import ANSWER_PROMPT
from app.agent.nodes.comparison import _format_transcript_context
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _build_additional_context(state: AgentState) -> str:
    """Assemble additional context from prior analysis nodes."""
    parts = []

    # Retrieved transcript chunks
    chunks = state.get("retrieved_chunks", [])
    if chunks:
        parts.append("### Relevant Transcript Excerpts")
        parts.append(_format_transcript_context(chunks))

    # Hook analysis
    hook_analysis = state.get("hook_analysis", "")
    if hook_analysis:
        parts.append("### Hook Analysis")
        parts.append(hook_analysis)

    # Comparison result
    comparison = state.get("comparison_result", "")
    if comparison:
        parts.append("### Comparative Analysis")
        parts.append(comparison)

    # Recommendations
    recommendations = state.get("recommendations", "")
    if recommendations:
        parts.append("### Recommendations")
        parts.append(recommendations)

    return "\n\n".join(parts) if parts else "No additional analysis context available."


def _build_video_extra(meta: dict) -> str:
    """Build extra details string for a video."""
    extras = []
    if meta.get("follower_count"):
        extras.append(f"- Followers: {meta['follower_count']:,}")
    if meta.get("hashtags"):
        tags = meta["hashtags"][:10]
        extras.append(f"- Hashtags: {', '.join(f'#{t}' for t in tags)}")
    if meta.get("upload_date"):
        extras.append(f"- Uploaded: {meta['upload_date']}")
    if meta.get("engagement_per_follower") is not None:
        extras.append(f"- Engagement/Follower: {meta['engagement_per_follower']}%")
    return "\n".join(extras) if extras else ""


async def answer_node(state: AgentState) -> dict:
    """Generate the final answer using all gathered context."""
    video_a = state.get("video_a_metadata", {})
    video_b = state.get("video_b_metadata", {})
    additional_context = _build_additional_context(state)

    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.4,
        streaming=True,
    )

    chain = ANSWER_PROMPT | llm

    from app.agent.utils import extract_text

    result = await chain.ainvoke({
        "video_a_title": video_a.get("title", "Video A"),
        "video_a_creator": video_a.get("creator", "Unknown"),
        "video_a_platform": video_a.get("platform", "unknown"),
        "video_a_views": video_a.get("views", 0),
        "video_a_likes": video_a.get("likes", 0),
        "video_a_comments": video_a.get("comments_count", 0),
        "video_a_engagement": video_a.get("engagement_rate", 0),
        "video_a_duration": video_a.get("duration", 0),
        "video_a_extra": _build_video_extra(video_a),
        "video_b_title": video_b.get("title", "Video B"),
        "video_b_creator": video_b.get("creator", "Unknown"),
        "video_b_platform": video_b.get("platform", "unknown"),
        "video_b_views": video_b.get("views", 0),
        "video_b_likes": video_b.get("likes", 0),
        "video_b_comments": video_b.get("comments_count", 0),
        "video_b_engagement": video_b.get("engagement_rate", 0),
        "video_b_duration": video_b.get("duration", 0),
        "video_b_extra": _build_video_extra(video_b),
        "additional_context": additional_context,
        "messages": state["messages"],
    })

    answer_text = extract_text(result.content)
    return {
        "final_answer": answer_text,
        "messages": [AIMessage(content=answer_text)],
    }

"""Comparison engine node — produces structured multi-dimensional comparison."""

import logging
from langchain_google_genai import ChatGoogleGenerativeAI

from app.agent.state import AgentState
from app.agent.prompts import COMPARISON_PROMPT
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _format_transcript_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a readable context block."""
    if not chunks:
        return "No transcript excerpts available."

    lines = []
    for chunk in chunks:
        label = f"Video {chunk.get('video_label', '?')}"
        num = chunk.get("chunk_number", "?")
        text = chunk.get("chunk_text", "")
        start = chunk.get("start_time")
        end = chunk.get("end_time")
        time_str = f" ({start:.1f}s - {end:.1f}s)" if start is not None and end is not None else ""
        lines.append(f"[{label}, Chunk {num}{time_str}]: {text}")
    return "\n\n".join(lines)


async def comparison_node(state: AgentState) -> dict:
    """Generate a comprehensive comparison of the two videos."""
    video_a = state.get("video_a_metadata", {})
    video_b = state.get("video_b_metadata", {})
    chunks = state.get("retrieved_chunks", [])

    transcript_context = _format_transcript_context(chunks)

    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.3,
    )

    chain = COMPARISON_PROMPT | llm
    result = await chain.ainvoke({
        "video_a_title": video_a.get("title", "Video A"),
        "video_a_creator": video_a.get("creator", "Unknown"),
        "video_a_platform": video_a.get("platform", "unknown"),
        "video_a_views": video_a.get("views", 0),
        "video_a_likes": video_a.get("likes", 0),
        "video_a_comments": video_a.get("comments_count", 0),
        "video_a_engagement": video_a.get("engagement_rate", 0),
        "video_a_duration": video_a.get("duration", 0),
        "video_b_title": video_b.get("title", "Video B"),
        "video_b_creator": video_b.get("creator", "Unknown"),
        "video_b_platform": video_b.get("platform", "unknown"),
        "video_b_views": video_b.get("views", 0),
        "video_b_likes": video_b.get("likes", 0),
        "video_b_comments": video_b.get("comments_count", 0),
        "video_b_engagement": video_b.get("engagement_rate", 0),
        "video_b_duration": video_b.get("duration", 0),
        "transcript_context": transcript_context,
    })

    logger.info("Comparison analysis completed")
    return {"comparison_result": result.content}

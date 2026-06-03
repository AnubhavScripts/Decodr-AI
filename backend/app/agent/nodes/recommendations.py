"""Recommendation engine node — generates actionable improvement suggestions."""

import logging
from langchain_google_genai import ChatGoogleGenerativeAI

from app.agent.state import AgentState
from app.agent.prompts import RECOMMENDATIONS_PROMPT
from app.agent.nodes.comparison import _format_transcript_context
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def recommendations_node(state: AgentState) -> dict:
    """Generate actionable recommendations for both creators."""
    video_a = state.get("video_a_metadata", {})
    video_b = state.get("video_b_metadata", {})
    chunks = state.get("retrieved_chunks", [])

    transcript_context = _format_transcript_context(chunks)

    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.4,
    )

    chain = RECOMMENDATIONS_PROMPT | llm
    result = await chain.ainvoke({
        "video_a_title": video_a.get("title", "Video A"),
        "video_a_creator": video_a.get("creator", "Unknown"),
        "video_a_platform": video_a.get("platform", "unknown"),
        "video_a_views": video_a.get("views", 0),
        "video_a_engagement": video_a.get("engagement_rate", 0),
        "video_b_title": video_b.get("title", "Video B"),
        "video_b_creator": video_b.get("creator", "Unknown"),
        "video_b_platform": video_b.get("platform", "unknown"),
        "video_b_views": video_b.get("views", 0),
        "video_b_engagement": video_b.get("engagement_rate", 0),
        "transcript_context": transcript_context,
    })

    logger.info("Recommendations generated")
    return {"recommendations": result.content}

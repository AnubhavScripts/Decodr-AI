"""Hook analysis node — analyzes opening statements and attention-grabbing techniques."""

import logging
from langchain_google_genai import ChatGoogleGenerativeAI

from app.agent.state import AgentState
from app.agent.prompts import HOOK_ANALYSIS_PROMPT
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def hooks_node(state: AgentState) -> dict:
    """Analyze the hooks (opening statements) of both videos."""
    video_a = state.get("video_a_metadata", {})
    video_b = state.get("video_b_metadata", {})
    chunks = state.get("retrieved_chunks", [])

    # Use stored hook_text directly if available
    hook_a = video_a.get("hook_text") or ""
    hook_b = video_b.get("hook_text") or ""

    # Fallback to chunk 1 if not populated
    if not hook_a:
        for chunk in chunks:
            if chunk.get("video_label") == "A" and chunk.get("chunk_number") == 1:
                hook_a = chunk["chunk_text"]
                break
    if not hook_b:
        for chunk in chunks:
            if chunk.get("video_label") == "B" and chunk.get("chunk_number") == 1:
                hook_b = chunk["chunk_text"]
                break

    # Fallback to transcript start if still empty
    if not hook_a and video_a.get("transcript_text"):
        hook_a = video_a["transcript_text"][:500]
    if not hook_b and video_b.get("transcript_text"):
        hook_b = video_b["transcript_text"][:500]

    if not hook_a and not hook_b:
        return {"hook_analysis": "No transcript data available for hook analysis."}

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.3,
    )

    chain = HOOK_ANALYSIS_PROMPT | llm
    result = await chain.ainvoke({
        "video_a_title": video_a.get("title", "Video A"),
        "video_a_creator": video_a.get("creator", "Unknown"),
        "video_a_hook": hook_a or "No transcript available",
        "video_b_title": video_b.get("title", "Video B"),
        "video_b_creator": video_b.get("creator", "Unknown"),
        "video_b_hook": hook_b or "No transcript available",
    })

    logger.info("Hook analysis completed")
    return {"hook_analysis": result.content}

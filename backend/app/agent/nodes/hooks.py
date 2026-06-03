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

    # Find chunk 1 details for Video A and B to format hook inputs with citation metadata
    chunk_1_a = next((c for c in chunks if c.get("video_label") == "A" and c.get("chunk_number") == 1), None)
    chunk_1_b = next((c for c in chunks if c.get("video_label") == "B" and c.get("chunk_number") == 1), None)

    if chunk_1_a:
        start_val = f"{chunk_1_a.get('start_time'):.1f}s" if chunk_1_a.get("start_time") is not None else "0.0s"
        end_val = f"{chunk_1_a.get('end_time'):.1f}s" if chunk_1_a.get("end_time") is not None else ""
        time_str = f", {start_val}-{end_val}" if end_val else f", {start_val}"
        hook_a = f"[Video A, Chunk 1{time_str}]: {chunk_1_a.get('chunk_text', '')}"
    else:
        # Fallback to plain hook_text or transcript
        t_text_a = video_a.get("transcript_text")
        fallback_a = str(t_text_a)[:500] if t_text_a else ""
        hook_text = str(video_a.get("hook_text") or fallback_a)
        hook_a = f"[Video A, Chunk 1]: {hook_text}" if hook_text else ""

    if chunk_1_b:
        start_val = f"{chunk_1_b.get('start_time'):.1f}s" if chunk_1_b.get("start_time") is not None else "0.0s"
        end_val = f"{chunk_1_b.get('end_time'):.1f}s" if chunk_1_b.get("end_time") is not None else ""
        time_str = f", {start_val}-{end_val}" if end_val else f", {start_val}"
        hook_b = f"[Video B, Chunk 1{time_str}]: {chunk_1_b.get('chunk_text', '')}"
    else:
        # Fallback to plain hook_text or transcript
        t_text_b = video_b.get("transcript_text")
        fallback_b = str(t_text_b)[:500] if t_text_b else ""
        hook_text = str(video_b.get("hook_text") or fallback_b)
        hook_b = f"[Video B, Chunk 1]: {hook_text}" if hook_text else ""

    if not hook_a and not hook_b:
        return {"hook_analysis": "No transcript data available for hook analysis."}

    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
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

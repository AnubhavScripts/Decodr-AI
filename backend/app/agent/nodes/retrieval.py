"""Vector retrieval node — semantic search over transcript chunks."""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.state import AgentState
from app.services.embedding import EmbeddingService
from app.models.transcript import TranscriptChunk

logger = logging.getLogger(__name__)


async def retrieval_node(state: AgentState) -> dict:
    """Embed the user query and retrieve the most relevant transcript chunks."""
    db: AsyncSession = state["db_session"]
    analysis_id = state["analysis_id"]
    messages = state["messages"]
    last_msg = messages[-1] if messages else None
    query = ""
    if last_msg and isinstance(last_msg.content, str):
        query = last_msg.content

    chunks = await EmbeddingService.similarity_search(
        query=query,
        analysis_id=analysis_id,
        db=db,
        top_k=6,
    )

    # If the intent is hooks or the query specifically mentions hooks,
    # retrieve and prepend Chunk 1 for both videos to ensure they are present.
    intent = state.get("intent", "")
    if intent == "hooks" or "hook" in query.lower():
        stmt = (
            select(
                TranscriptChunk.id,
                TranscriptChunk.video_id,
                TranscriptChunk.chunk_number,
                TranscriptChunk.chunk_text,
                TranscriptChunk.start_time,
                TranscriptChunk.end_time,
            )
            .where(
                TranscriptChunk.analysis_id == analysis_id,
                TranscriptChunk.chunk_number == 1
            )
        )
        res = await db.execute(stmt)
        rows = res.all()
        
        # Merge them into the chunks list (ensure no duplicates)
        existing_ids = {c["id"] for c in chunks}
        hook_chunks = []
        for row in rows:
            if row.id not in existing_ids:
                hook_chunks.append({
                    "id": row.id,
                    "video_id": row.video_id,
                    "chunk_number": row.chunk_number,
                    "chunk_text": row.chunk_text,
                    "start_time": row.start_time,
                    "end_time": row.end_time,
                    "distance": 0.0,  # Highest relevance
                })
        
        # Prepend hook chunks so they appear first
        chunks = hook_chunks + chunks

    # Enrich chunks with video label
    video_a_meta = state.get("video_a_metadata", {})
    video_b_meta = state.get("video_b_metadata", {})

    for chunk in chunks:
        if chunk["video_id"] == video_a_meta.get("id"):
            chunk["video_label"] = "A"
        elif chunk["video_id"] == video_b_meta.get("id"):
            chunk["video_label"] = "B"
        else:
            chunk["video_label"] = "?"

    logger.info(f"Retrieved {len(chunks)} chunks for query: '{query[:60]}...'")
    return {"retrieved_chunks": chunks}


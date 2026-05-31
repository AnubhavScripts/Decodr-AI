"""Vector retrieval node — semantic search over transcript chunks."""

import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.state import AgentState
from app.services.embedding import EmbeddingService

logger = logging.getLogger(__name__)


async def retrieval_node(state: AgentState) -> dict:
    """Embed the user query and retrieve the most relevant transcript chunks."""
    db: AsyncSession = state["db_session"]
    analysis_id = state["analysis_id"]
    messages = state["messages"]
    query = messages[-1].content if messages else ""

    chunks = await EmbeddingService.similarity_search(
        query=query,
        analysis_id=analysis_id,
        db=db,
        top_k=6,
    )

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

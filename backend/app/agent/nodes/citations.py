"""Citation generator node — extracts source references from retrieved chunks."""

import logging
from app.agent.state import AgentState

logger = logging.getLogger(__name__)


async def citations_node(state: AgentState) -> dict:
    """Build citation references from retrieved chunks."""
    chunks = state.get("retrieved_chunks", [])

    citations = []
    seen = set()

    for chunk in chunks:
        video_label = chunk.get("video_label", "?")
        chunk_number = chunk.get("chunk_number", 0)
        key = f"{video_label}-{chunk_number}"

        if key not in seen:
            seen.add(key)
            citations.append({
                "video_label": video_label,
                "chunk_number": chunk_number,
                "chunk_text_preview": chunk.get("chunk_text", "")[:150],
                "video_id": chunk.get("video_id", ""),
                "relevance_distance": chunk.get("distance", 1.0),
            })

    logger.info(f"Generated {len(citations)} citations")
    return {"citations": citations}

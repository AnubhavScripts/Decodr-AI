"""Embedding generation and vector storage/retrieval using Google GenAI + pgvector."""

import asyncio
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.transcript import TranscriptChunk

logger = logging.getLogger(__name__)
settings = get_settings()

_embeddings_client = None
_client_lock = asyncio.Lock()


async def _get_embeddings_client():
    """Lazily initialize the SentenceTransformer client."""
    global _embeddings_client
    if _embeddings_client is not None:
        return _embeddings_client

    async with _client_lock:
        if _embeddings_client is not None:
            return _embeddings_client

        from sentence_transformers import SentenceTransformer

        logger.info(f"Loading SentenceTransformer model '{settings.EMBEDDING_MODEL}'...")
        def _load():
            return SentenceTransformer(settings.EMBEDDING_MODEL, device="cpu")

        _embeddings_client = await asyncio.to_thread(_load)
        logger.info("SentenceTransformer model loaded.")
        return _embeddings_client


class EmbeddingService:
    """Generate embeddings, store chunks with vectors, and do similarity search."""

    @staticmethod
    async def generate(texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts using BAAI/bge-small-en-v1.5."""
        if not texts:
            return []

        client = await _get_embeddings_client()
        
        def _encode():
            return client.encode(texts, convert_to_numpy=True).tolist()

        return await asyncio.to_thread(_encode)

    @staticmethod
    async def store_chunks(
        analysis_id: str,
        video_id: str,
        chunks: list[dict],
        embeddings: list[list[float]],
        db: AsyncSession,
    ) -> list[TranscriptChunk]:
        """Store transcript chunks with their embeddings in the database."""
        records = []
        for i, (chunk_info, embedding) in enumerate(zip(chunks, embeddings)):
            chunk = TranscriptChunk(
                analysis_id=analysis_id,
                video_id=video_id,
                chunk_number=i + 1,
                chunk_text=chunk_info["text"],
                embedding=embedding,
                start_time=chunk_info.get("start_time"),
                end_time=chunk_info.get("end_time"),
            )
            db.add(chunk)
            records.append(chunk)

        await db.flush()
        logger.info(
            f"Stored {len(records)} chunks for video {video_id}"
        )
        return records

    @staticmethod
    async def similarity_search(
        query: str,
        analysis_id: str,
        db: AsyncSession,
        top_k: int = 5,
        video_id: str | None = None,
    ) -> list[dict]:
        """
        Find the most relevant transcript chunks for a query using cosine distance.
        Returns dicts with chunk_text, chunk_number, video_id, and distance.
        """
        # Generate query embedding
        embeddings = await EmbeddingService.generate([query])
        if not embeddings:
            return []

        query_embedding = embeddings[0]

        # Build the query with pgvector cosine distance operator
        stmt = (
            select(
                TranscriptChunk.id,
                TranscriptChunk.video_id,
                TranscriptChunk.chunk_number,
                TranscriptChunk.chunk_text,
                TranscriptChunk.start_time,
                TranscriptChunk.end_time,
                TranscriptChunk.embedding.cosine_distance(query_embedding).label(
                    "distance"
                ),
            )
            .where(TranscriptChunk.analysis_id == analysis_id)
            .order_by("distance")
            .limit(top_k)
        )

        if video_id:
            stmt = stmt.where(TranscriptChunk.video_id == video_id)

        result = await db.execute(stmt)
        rows = result.all()

        return [
            {
                "id": row.id,
                "video_id": row.video_id,
                "chunk_number": row.chunk_number,
                "chunk_text": row.chunk_text,
                "start_time": row.start_time,
                "end_time": row.end_time,
                "distance": float(row.distance),
            }
            for row in rows
        ]

    @staticmethod
    async def preload_model():
        """Pre-load/Initialize the embeddings client (called at startup)."""
        await _get_embeddings_client()
        logger.info("Embeddings client initialized and ready.")

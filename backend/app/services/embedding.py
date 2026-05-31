"""Embedding generation and vector storage/retrieval using BGE + pgvector."""

import asyncio
import logging
from typing import Sequence

import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.transcript import TranscriptChunk

logger = logging.getLogger(__name__)
settings = get_settings()

# Singleton model instance
_model = None
_model_lock = asyncio.Lock()


async def _get_model():
    """Lazily load the sentence-transformers model."""
    global _model
    if _model is not None:
        return _model

    async with _model_lock:
        if _model is not None:
            return _model

        from sentence_transformers import SentenceTransformer

        def _load():
            return SentenceTransformer(settings.EMBEDDING_MODEL)

        logger.info(f"Loading embedding model '{settings.EMBEDDING_MODEL}'...")
        _model = await asyncio.to_thread(_load)
        logger.info("Embedding model loaded.")
        return _model


class EmbeddingService:
    """Generate embeddings, store chunks with vectors, and do similarity search."""

    @staticmethod
    async def generate(texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts using BGE."""
        if not texts:
            return []

        model = await _get_model()

        def _encode():
            embeddings = model.encode(
                texts,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            return embeddings.tolist()

        return await asyncio.to_thread(_encode)

    @staticmethod
    async def store_chunks(
        analysis_id: str,
        video_id: str,
        chunks: list[str],
        embeddings: list[list[float]],
        db: AsyncSession,
    ) -> list[TranscriptChunk]:
        """Store transcript chunks with their embeddings in the database."""
        records = []
        for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunk = TranscriptChunk(
                analysis_id=analysis_id,
                video_id=video_id,
                chunk_number=i + 1,
                chunk_text=chunk_text,
                embedding=embedding,
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
                "distance": float(row.distance),
            }
            for row in rows
        ]

    @staticmethod
    async def preload_model():
        """Pre-load the embedding model (called at startup)."""
        await _get_model()
        logger.info("Embedding model preloaded and ready.")

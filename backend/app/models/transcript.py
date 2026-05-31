"""TranscriptChunk model — stores chunked transcript text with pgvector embeddings."""

import uuid
from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from app.models.base import Base
from app.config import get_settings

settings = get_settings()


class TranscriptChunk(Base):
    __tablename__ = "transcript_chunks"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    analysis_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("analysis_sessions.id", ondelete="CASCADE"),
        index=True,
    )
    video_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("videos.id", ondelete="CASCADE"),
        index=True,
    )
    chunk_number: Mapped[int] = mapped_column(Integer)
    chunk_text: Mapped[str] = mapped_column(Text)
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION))

    # Relationships
    video: Mapped["Video"] = relationship(  # noqa: F821
        back_populates="transcript_chunks",
    )

    def __repr__(self) -> str:
        return f"<TranscriptChunk video={self.video_id} chunk={self.chunk_number}>"

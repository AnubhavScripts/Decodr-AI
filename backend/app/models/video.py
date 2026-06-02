"""Video model — stores metadata and engagement metrics for each video."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, Text, BigInteger, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.analysis import AnalysisSession
    from app.models.transcript import TranscriptChunk


class Video(Base):
    __tablename__ = "videos"

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
    video_label: Mapped[str] = mapped_column(String(1))  # A or B

    # Platform info
    platform: Mapped[str] = mapped_column(String(20))  # youtube | instagram
    original_url: Mapped[str] = mapped_column(Text)

    # Metadata
    title: Mapped[str] = mapped_column(Text, default="Untitled")
    creator: Mapped[str] = mapped_column(String(255), default="Unknown")
    follower_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    views: Mapped[int] = mapped_column(BigInteger, default=0)
    likes: Mapped[int] = mapped_column(BigInteger, default=0)
    comments_count: Mapped[int] = mapped_column(BigInteger, default=0)
    hashtags: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    upload_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration: Mapped[float] = mapped_column(Float, default=0.0)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_url: Mapped[str] = mapped_column(Text)

    # Transcript
    transcript_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_source: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Engagement metrics (computed)
    engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)
    comment_rate: Mapped[float] = mapped_column(Float, default=0.0)
    like_rate: Mapped[float] = mapped_column(Float, default=0.0)
    engagement_per_follower: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    analysis_session: Mapped["AnalysisSession"] = relationship(  # noqa: F821
        back_populates="videos",
    )
    transcript_chunks: Mapped[list["TranscriptChunk"]] = relationship(  # noqa: F821
        back_populates="video",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Video id={self.id} label={self.video_label} platform={self.platform}>"

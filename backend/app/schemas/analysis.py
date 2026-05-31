"""Pydantic schemas for the analysis endpoints."""

from pydantic import BaseModel, HttpUrl, field_validator
from datetime import datetime


class AnalyzeRequest(BaseModel):
    """POST /analyze request body."""
    video_url_a: str
    video_url_b: str

    @field_validator("video_url_a", "video_url_b")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class AnalyzeResponse(BaseModel):
    """POST /analyze response body."""
    analysis_id: str
    status: str
    message: str


class VideoSummary(BaseModel):
    """Lightweight video summary nested in analysis detail."""
    id: str
    video_label: str
    platform: str
    title: str
    creator: str
    follower_count: int | None = None
    views: int
    likes: int
    comments_count: int
    hashtags: list[str] | None = None
    upload_date: str | None = None
    duration: float
    thumbnail_url: str | None = None
    video_url: str
    transcript_available: bool
    engagement_rate: float
    comment_rate: float
    like_rate: float
    engagement_per_follower: float | None = None


class AnalysisDetailResponse(BaseModel):
    """GET /analysis/{id} response body."""
    id: str
    status: str
    error_message: str | None = None
    created_at: str
    updated_at: str
    videos: list[VideoSummary]

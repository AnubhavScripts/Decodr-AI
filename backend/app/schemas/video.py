"""Pydantic schemas for video data."""

from pydantic import BaseModel


class VideoResponse(BaseModel):
    """Full video response with all metadata and metrics."""
    id: str
    video_label: str
    platform: str
    original_url: str
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
    transcript_text: str | None = None
    engagement_rate: float
    comment_rate: float
    like_rate: float
    engagement_per_follower: float | None = None

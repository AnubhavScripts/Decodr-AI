"""Metadata retrieval node — loads video metadata from the database."""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.state import AgentState
from app.models.video import Video

logger = logging.getLogger(__name__)


def _video_to_dict(video: Video) -> dict:
    """Convert a Video model to a serializable dict."""
    return {
        "id": video.id,
        "label": video.video_label,
        "platform": video.platform,
        "title": video.title,
        "creator": video.creator,
        "follower_count": video.follower_count,
        "views": video.views,
        "likes": video.likes,
        "comments_count": video.comments_count,
        "hashtags": video.hashtags or [],
        "upload_date": str(video.upload_date) if video.upload_date else None,
        "duration": video.duration,
        "thumbnail_url": video.thumbnail_url,
        "video_url": video.video_url,
        "engagement_rate": video.engagement_rate,
        "comment_rate": video.comment_rate,
        "like_rate": video.like_rate,
        "engagement_per_follower": video.engagement_per_follower,
        "transcript_text": video.transcript_text,
    }


async def metadata_node(state: AgentState) -> dict:
    """Load video metadata from the database for the current analysis."""
    db: AsyncSession = state["db_session"]
    analysis_id = state["analysis_id"]

    stmt = (
        select(Video)
        .where(Video.analysis_id == analysis_id)
        .order_by(Video.video_label)
    )
    result = await db.execute(stmt)
    videos = result.scalars().all()

    video_a_meta = {}
    video_b_meta = {}

    for video in videos:
        if video.video_label == "A":
            video_a_meta = _video_to_dict(video)
        elif video.video_label == "B":
            video_b_meta = _video_to_dict(video)

    logger.info(
        f"Loaded metadata: A='{video_a_meta.get('title', '?')}', "
        f"B='{video_b_meta.get('title', '?')}'"
    )

    return {
        "video_a_metadata": video_a_meta,
        "video_b_metadata": video_b_meta,
    }

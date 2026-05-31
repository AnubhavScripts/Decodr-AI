"""Engagement analytics computation from raw video metadata."""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class EngagementMetrics:
    """Computed engagement metrics for a single video."""
    engagement_rate: float
    comment_rate: float
    like_rate: float
    engagement_per_follower: float | None


class AnalyticsService:
    """Compute engagement metrics from raw video stats."""

    @staticmethod
    def compute(
        views: int,
        likes: int,
        comments: int,
        follower_count: int | None = None,
    ) -> EngagementMetrics:
        """
        Compute all engagement metrics.

        engagement_rate     = (likes + comments) / views * 100
        comment_rate        = comments / views * 100
        like_rate           = likes / views * 100
        engagement_per_follower = (likes + comments) / followers * 100
        """
        # Guard against division by zero
        if views == 0:
            return EngagementMetrics(
                engagement_rate=0.0,
                comment_rate=0.0,
                like_rate=0.0,
                engagement_per_follower=None,
            )

        engagement_rate = (likes + comments) / views * 100
        comment_rate = comments / views * 100
        like_rate = likes / views * 100

        engagement_per_follower = None
        if follower_count and follower_count > 0:
            engagement_per_follower = (likes + comments) / follower_count * 100

        return EngagementMetrics(
            engagement_rate=round(engagement_rate, 4),
            comment_rate=round(comment_rate, 4),
            like_rate=round(like_rate, 4),
            engagement_per_follower=(
                round(engagement_per_follower, 4)
                if engagement_per_follower is not None
                else None
            ),
        )

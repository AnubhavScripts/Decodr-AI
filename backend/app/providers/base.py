"""Abstract base class for video platform providers.

To add support for a new platform (e.g., TikTok):
1. Create a new file (e.g., tiktok.py) implementing BaseVideoProvider
2. Add the class to ProviderRegistry._providers in registry.py
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class VideoMetadata:
    """Standardized metadata structure returned by all providers."""

    platform: str
    original_url: str
    title: str = "Untitled"
    creator: str = "Unknown"
    follower_count: int | None = None
    views: int = 0
    likes: int = 0
    comments_count: int = 0
    hashtags: list[str] = field(default_factory=list)
    upload_date: datetime | None = None
    duration: float = 0.0
    thumbnail_url: str | None = None
    video_url: str = ""


class BaseVideoProvider(ABC):
    """Abstract interface that all platform adapters must implement."""

    @classmethod
    @abstractmethod
    def can_handle(cls, url: str) -> bool:
        """Return True if this provider can process the given URL."""
        ...

    @abstractmethod
    async def extract_metadata(self, url: str) -> VideoMetadata:
        """Extract video metadata without downloading the video."""
        ...

    @abstractmethod
    async def extract_transcript(self, url: str) -> str | None:
        """
        Extract transcript text if available natively.
        Returns None if no native transcript exists (fallback to whisper).
        """
        ...

    @abstractmethod
    async def download_audio(self, url: str, output_dir: str) -> str:
        """
        Download audio track to output_dir.
        Returns the path to the downloaded audio file.
        """
        ...

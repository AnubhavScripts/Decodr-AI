"""Instagram video provider — metadata and audio via yt-dlp, no native transcript API."""

import re
import asyncio
import logging
import uuid
from datetime import datetime
from app.providers.base import BaseVideoProvider, VideoMetadata

logger = logging.getLogger(__name__)

_IG_PATTERNS = [
    re.compile(r"(?:https?://)?(?:www\.)?instagram\.com/reel/[\w-]+"),
    re.compile(r"(?:https?://)?(?:www\.)?instagram\.com/p/[\w-]+"),
    re.compile(r"(?:https?://)?(?:www\.)?instagram\.com/tv/[\w-]+"),
]


class InstagramProvider(BaseVideoProvider):

    @classmethod
    def can_handle(cls, url: str) -> bool:
        return any(p.search(url) for p in _IG_PATTERNS)

    async def extract_metadata(self, url: str) -> VideoMetadata:
        """Use yt-dlp to extract Instagram video metadata."""
        import yt_dlp

        ydl_opts = {
            "skip_download": True,
            "quiet": True,
            "no_warnings": True,
        }

        def _extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)

        info = await asyncio.to_thread(_extract)

        # Parse upload date
        upload_date = None
        raw_date = info.get("upload_date") or info.get("timestamp")
        if isinstance(raw_date, str):
            try:
                upload_date = datetime.strptime(raw_date, "%Y%m%d")
            except ValueError:
                pass
        elif isinstance(raw_date, (int, float)):
            upload_date = datetime.fromtimestamp(raw_date)

        # Extract hashtags from description
        description = info.get("description", "") or ""
        hashtags = re.findall(r"#(\w+)", description)
        hashtags = list(set(hashtags))[:20]

        return VideoMetadata(
            platform="instagram",
            original_url=url,
            title=info.get("title", info.get("description", "Untitled")[:100]),
            creator=info.get("uploader", info.get("channel", "Unknown")),
            follower_count=info.get("channel_follower_count"),
            views=info.get("view_count", 0) or 0,
            likes=info.get("like_count", 0) or 0,
            comments_count=info.get("comment_count", 0) or 0,
            hashtags=hashtags,
            upload_date=upload_date,
            duration=float(info.get("duration", 0) or 0),
            thumbnail_url=info.get("thumbnail"),
            video_url=info.get("webpage_url", url),
        )

    async def extract_transcript(self, url: str) -> str | None:
        """Instagram has no native transcript API — always returns None."""
        return None

    async def download_audio(self, url: str, output_dir: str) -> str:
        """Download audio from Instagram video using yt-dlp."""
        import yt_dlp

        file_id = str(uuid.uuid4())[:8]
        output_template = f"{output_dir}/ig_{file_id}.%(ext)s"

        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "quiet": True,
            "no_warnings": True,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                    "preferredquality": "192",
                }
            ],
        }

        def _download():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

        await asyncio.to_thread(_download)
        return f"{output_dir}/ig_{file_id}.wav"

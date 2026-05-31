"""YouTube video provider — metadata via yt-dlp, transcripts via youtube-transcript-api."""

import re
import asyncio
import logging
from datetime import datetime
from app.providers.base import BaseVideoProvider, VideoMetadata

logger = logging.getLogger(__name__)

# Patterns that identify YouTube URLs
_YT_PATTERNS = [
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=[\w-]+"),
    re.compile(r"(?:https?://)?youtu\.be/[\w-]+"),
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/shorts/[\w-]+"),
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/embed/[\w-]+"),
]


def _extract_video_id(url: str) -> str | None:
    """Pull the video ID out of a YouTube URL."""
    patterns = [
        re.compile(r"(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})"),
    ]
    for p in patterns:
        m = p.search(url)
        if m:
            return m.group(1)
    return None


class YouTubeProvider(BaseVideoProvider):

    @classmethod
    def can_handle(cls, url: str) -> bool:
        return any(p.search(url) for p in _YT_PATTERNS)

    async def extract_metadata(self, url: str) -> VideoMetadata:
        """Use yt-dlp to extract metadata without downloading."""
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
        raw_date = info.get("upload_date")
        if raw_date:
            try:
                upload_date = datetime.strptime(raw_date, "%Y%m%d")
            except ValueError:
                pass

        # Extract hashtags from description and tags
        hashtags = list(info.get("tags", []) or [])
        description = info.get("description", "") or ""
        hashtags.extend(re.findall(r"#(\w+)", description))
        hashtags = list(set(hashtags))[:20]  # dedupe, cap at 20

        return VideoMetadata(
            platform="youtube",
            original_url=url,
            title=info.get("title", "Untitled"),
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
        """
        Try youtube-transcript-api first (fast, no download).
        Returns None if unavailable — caller should fall back to whisper.
        """
        video_id = _extract_video_id(url)
        if not video_id:
            logger.warning(f"Could not extract video ID from {url}")
            return None

        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            def _fetch():
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
                # Prefer manually created, fall back to auto-generated
                try:
                    transcript = transcript_list.find_manually_created_transcript(
                        ["en"]
                    )
                except Exception:
                    transcript = transcript_list.find_generated_transcript(["en"])
                return transcript.fetch()

            segments = await asyncio.to_thread(_fetch)
            full_text = " ".join(seg.get("text", "") for seg in segments)
            return full_text.strip() if full_text.strip() else None

        except Exception as e:
            logger.info(f"YouTube transcript API failed for {video_id}: {e}")
            return None

    async def download_audio(self, url: str, output_dir: str) -> str:
        """Download audio-only using yt-dlp."""
        import yt_dlp

        video_id = _extract_video_id(url) or "audio"
        output_template = f"{output_dir}/{video_id}.%(ext)s"

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
        return f"{output_dir}/{video_id}.wav"

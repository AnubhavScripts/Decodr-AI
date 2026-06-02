"""YouTube video provider — metadata via yt-dlp, transcripts via youtube-transcript-api."""

import re
import os
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


def _parse_iso8601_duration(duration_str: str) -> float:
    """Parse ISO 8601 duration string (e.g., PT1H2M30S) into seconds."""
    if not duration_str:
        return 0.0
    match = re.match(
        r"^P(?:(?P<days>\d+)D)?T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)(?:\.(?P<fraction>\d+))?S)?$",
        duration_str
    )
    if not match:
        return 0.0
    gd = match.groupdict()
    days = int(gd.get("days") or 0)
    hours = int(gd.get("hours") or 0)
    minutes = int(gd.get("minutes") or 0)
    seconds = int(gd.get("seconds") or 0)
    fraction = gd.get("fraction")
    fraction_secs = float(f"0.{fraction}") if fraction else 0.0
    return (days * 86400) + (hours * 3600) + (minutes * 60) + seconds + fraction_secs


class YouTubeProvider(BaseVideoProvider):

    @classmethod
    def can_handle(cls, url: str) -> bool:
        return any(p.search(url) for p in _YT_PATTERNS)

    async def extract_metadata(self, url: str) -> VideoMetadata:
        """Extract metadata using YouTube Data API v3 (primary) or yt-dlp (fallback)."""
        from app.config import get_settings
        settings = get_settings()
        api_key = settings.youtube_key

        video_id = _extract_video_id(url)

        async def _fallback_ytdlp():
            import yt_dlp
            import os
            from typing import Any, cast
            ydl_opts: dict[str, Any] = {
                "skip_download": True,
                "quiet": True,
                "no_warnings": True,
            }
            for path in ["cookies.txt", "backend/cookies.txt", "../cookies.txt"]:
                if os.path.exists(path):
                    ydl_opts["cookiefile"] = path
                    break

            def _extract():
                with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
                    return ydl.extract_info(url, download=False)

            info = await asyncio.to_thread(_extract)
            
            upload_date = None
            raw_date = info.get("upload_date")
            if raw_date:
                try:
                    upload_date = datetime.strptime(raw_date, "%Y%m%d")
                except ValueError:
                    pass

            hashtags = list(info.get("tags", []) or [])
            description = info.get("description", "") or ""
            hashtags.extend(re.findall(r"#(\w+)", description))
            hashtags = list(set(hashtags))[:20]

            return VideoMetadata(
                platform="youtube",
                original_url=url,
                title=info.get("title") or "Untitled",
                creator=info.get("uploader") or info.get("channel") or "Unknown",
                follower_count=info.get("channel_follower_count"),
                views=info.get("view_count", 0) or 0,
                likes=info.get("like_count", 0) or 0,
                comments_count=info.get("comment_count", 0) or 0,
                hashtags=hashtags,
                upload_date=upload_date,
                duration=float(info.get("duration", 0) or 0),
                thumbnail_url=info.get("thumbnail"),
                video_url=info.get("webpage_url") or url,
            )

        if api_key and video_id:
            try:
                import httpx
                
                # Fetch video details
                api_url = "https://www.googleapis.com/youtube/v3/videos"
                params = {
                    "part": "snippet,statistics,contentDetails",
                    "id": video_id,
                    "key": api_key,
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.get(api_url, params=params, timeout=10.0)
                    resp.raise_for_status()
                    data = resp.json()
                
                items = data.get("items", [])
                if items:
                    item = items[0]
                    snippet = item.get("snippet", {})
                    statistics = item.get("statistics", {})
                    content_details = item.get("contentDetails", {})
                    
                    # Parse upload date
                    upload_date = None
                    published_at = snippet.get("publishedAt")
                    if published_at:
                        try:
                            dt_str = published_at.replace("Z", "+00:00")
                            upload_date = datetime.fromisoformat(dt_str)
                        except Exception:
                            pass
                            
                    # Parse tags and description hashtags
                    tags = snippet.get("tags", []) or []
                    description = snippet.get("description", "") or ""
                    hashtags = list(tags)
                    hashtags.extend(re.findall(r"#(\w+)", description))
                    hashtags = list(set(hashtags))[:20]
                    
                    # Parse duration
                    duration_str = content_details.get("duration", "")
                    duration = _parse_iso8601_duration(duration_str)
                    
                    # Select best thumbnail
                    thumbnails = snippet.get("thumbnails", {})
                    thumbnail_url = None
                    for size in ["maxres", "standard", "high", "medium", "default"]:
                        if size in thumbnails and thumbnails[size].get("url"):
                            thumbnail_url = thumbnails[size]["url"]
                            break
                    
                    # Fetch follower count (subscriber count) from channels endpoint
                    channel_id = snippet.get("channelId")
                    follower_count = None
                    if channel_id:
                        try:
                            channel_url = "https://www.googleapis.com/youtube/v3/channels"
                            chan_params = {
                                "part": "statistics",
                                "id": channel_id,
                                "key": api_key
                            }
                            async with httpx.AsyncClient() as client:
                                chan_resp = await client.get(channel_url, params=chan_params, timeout=5.0)
                                chan_resp.raise_for_status()
                                chan_data = chan_resp.json()
                            chan_items = chan_data.get("items", [])
                            if chan_items:
                                chan_stats = chan_items[0].get("statistics", {})
                                sub_count = chan_stats.get("subscriberCount")
                                if sub_count is not None:
                                    follower_count = int(sub_count)
                        except Exception as ce:
                            logger.warning(f"Failed to fetch subscriber count for channel {channel_id}: {ce}")
                    
                    return VideoMetadata(
                        platform="youtube",
                        original_url=url,
                        title=snippet.get("title") or "Untitled",
                        creator=snippet.get("channelTitle") or "Unknown",
                        follower_count=follower_count,
                        views=int(statistics.get("viewCount") or 0),
                        likes=int(statistics.get("likeCount") or 0),
                        comments_count=int(statistics.get("commentCount") or 0),
                        hashtags=hashtags,
                        upload_date=upload_date,
                        duration=duration,
                        thumbnail_url=thumbnail_url,
                        video_url=f"https://www.youtube.com/watch?v={video_id}",
                    )
                else:
                    logger.warning(f"YouTube Data API returned no items for video {video_id}. Falling back to yt-dlp.")
            except Exception as e:
                logger.error(f"YouTube Data API metadata extraction failed: {e}. Falling back to yt-dlp.")
        else:
            logger.info("YouTube Data API Key or Video ID not available. Falling back to yt-dlp.")
            
        return await _fallback_ytdlp()

    async def extract_transcript(self, url: str) -> list[dict] | None:
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
                # v1.x API: instance-based, .list() replaces .list_transcripts()
                api = YouTubeTranscriptApi()
                transcript_list = api.list(video_id)
                # Prefer manually created English, fall back to auto-generated
                transcript = None
                for t in transcript_list:
                    if t.language_code.startswith("en") and not t.is_generated:
                        transcript = t
                        break
                if transcript is None:
                    for t in transcript_list:
                        if t.language_code.startswith("en"):
                            transcript = t
                            break
                if transcript is None:
                    # Take the first available
                    transcript = next(iter(transcript_list), None)
                if transcript is None:
                    return None
                # v1.x: .fetch() returns FetchedTranscript with FetchedTranscriptSnippet items
                fetched = transcript.fetch()
                return [
                    {
                        "text": s.text,
                        "start": s.start,
                        "end": s.start + (s.duration or 0.0)
                    }
                    for s in fetched
                ]

            return await asyncio.to_thread(_fetch)

        except Exception as e:
            logger.info(f"YouTube transcript API failed for {video_id}: {e}")
            return None

    async def download_audio(self, url: str, output_dir: str) -> str:
        """Download audio-only using yt-dlp (no ffmpeg required)."""
        import yt_dlp
        import os
        from typing import Any, cast

        video_id = _extract_video_id(url) or "audio"
        output_template = f"{output_dir}/{video_id}.%(ext)s"

        ydl_opts: dict[str, Any] = {
            # Download best audio-only stream without post-processing
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "quiet": True,
            "no_warnings": True,
            # No FFmpegExtractAudio postprocessor — avoids ffmpeg dependency
        }

        for path in ["cookies.txt", "backend/cookies.txt", "../cookies.txt"]:
            if os.path.exists(path):
                ydl_opts["cookiefile"] = path
                break

        downloaded_path = [None]

        def _progress_hook(d):
            if d.get("status") == "finished":
                downloaded_path[0] = d.get("filename")

        ydl_opts["progress_hooks"] = [_progress_hook]

        def _download():
            with yt_dlp.YoutubeDL(cast(Any, ydl_opts)) as ydl:
                ydl.download([url])

        await asyncio.to_thread(_download)

        # Return the actual downloaded file path
        if downloaded_path[0] and os.path.exists(downloaded_path[0]):
            return downloaded_path[0]
        # Fallback: search for the file
        import glob
        files = glob.glob(f"{output_dir}/{video_id}.*")
        if files:
            return files[0]
        return f"{output_dir}/{video_id}"

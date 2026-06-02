"""Instagram video provider.

Strategy:
- Metadata  → yt-dlp (reads public info from Instagram's embed API)
- Audio DL  → instaloader (fetches the signed video URL and downloads directly),
              with yt-dlp as fallback
- Transcript→ None (no native API; Whisper handles it upstream)
"""

import re
import os
import asyncio
import logging
import uuid
import urllib.request
from pathlib import Path
from datetime import datetime

from app.providers.base import BaseVideoProvider, VideoMetadata

logger = logging.getLogger(__name__)

_IG_PATTERNS = [
    re.compile(r"(?:https?://)?(?:www\.)?instagram\.com/reel/[\w-]+"),
    re.compile(r"(?:https?://)?(?:www\.)?instagram\.com/p/[\w-]+"),
    re.compile(r"(?:https?://)?(?:www\.)?instagram\.com/tv/[\w-]+"),
]

_SHORTCODE_RE = re.compile(r"/(?:reel|p|tv)/([\w-]+)")


def _shortcode(url: str) -> str | None:
    m = _SHORTCODE_RE.search(url)
    return m.group(1) if m else None


def _cookies_path() -> str | None:
    for p in ["cookies.txt", "backend/cookies.txt", "../cookies.txt"]:
        if os.path.exists(p):
            return p
    return None


class InstagramProvider(BaseVideoProvider):

    @classmethod
    def can_handle(cls, url: str) -> bool:
        return any(p.search(url) for p in _IG_PATTERNS)

    # ------------------------------------------------------------------ #
    #  Metadata                                                            #
    # ------------------------------------------------------------------ #

    async def extract_metadata(self, url: str) -> VideoMetadata:
        """Extract Instagram video metadata; try instaloader first, fallback to yt-dlp."""
        sc = _shortcode(url)
        if sc:
            try:
                logger.info(f"Extracting Instagram metadata using instaloader for {url}")
                meta = await asyncio.to_thread(self._instaloader_metadata, sc, url)
                if meta:
                    logger.info("Successfully extracted Instagram metadata using instaloader")
                    return meta
            except Exception as e:
                logger.warning(f"Instaloader metadata extraction failed ({e}); falling back to yt-dlp")

        # Fallback
        logger.info(f"Extracting Instagram metadata using yt-dlp for {url}")
        return await self._ytdlp_metadata(url)

    def _instaloader_metadata(self, shortcode: str, url: str) -> VideoMetadata:
        import instaloader
        from datetime import timezone

        L = instaloader.Instaloader(
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            quiet=True,
        )

        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        caption = post.caption or ""
        title = caption[:150].strip() if caption else "Untitled"
        if not title:
            title = f"Instagram Video by {post.owner_username}"
            
        hashtags = list(set(re.findall(r"#(\w+)", caption)))[:20]

        # Fetch profile info for creator & followers
        follower_count = None
        try:
            profile = post.owner_profile
            creator = profile.full_name or profile.username or post.owner_username or "Unknown"
            follower_count = profile.followers
        except Exception:
            creator = post.owner_username or "Unknown"

        # Make datetime timezone-aware
        upload_date = post.date_utc
        if upload_date:
            upload_date = upload_date.replace(tzinfo=timezone.utc)

        return VideoMetadata(
            platform="instagram",
            original_url=url,
            title=title,
            creator=creator,
            follower_count=follower_count,
            views=post.video_view_count or 0,
            likes=post.likes or 0,
            comments_count=post.comments or 0,
            hashtags=hashtags,
            upload_date=upload_date,
            duration=float(post.video_duration or 0.0),
            thumbnail_url=post.url,
            video_url=post.video_url or url,
        )

    async def _ytdlp_metadata(self, url: str) -> VideoMetadata:
        import yt_dlp

        ydl_opts: dict = {
            "skip_download": True,
            "quiet": True,
            "no_warnings": True,
        }
        cp = _cookies_path()
        if cp:
            ydl_opts["cookiefile"] = cp

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

        description = info.get("description", "") or ""
        hashtags = list(set(re.findall(r"#(\w+)", description)))[:20]

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

    # ------------------------------------------------------------------ #
    #  Transcript                                                          #
    # ------------------------------------------------------------------ #

    async def extract_transcript(self, url: str) -> list[dict] | None:
        """Instagram has no native transcript API — Whisper handles it upstream."""
        return None

    # ------------------------------------------------------------------ #
    #  Audio download                                                      #
    # ------------------------------------------------------------------ #

    async def download_audio(self, url: str, output_dir: str) -> str:
        """Download Instagram video; try instaloader first, then yt-dlp."""
        # Primary: instaloader — fetches the signed CDN URL and downloads directly
        try:
            path = await asyncio.to_thread(self._instaloader_download, url, output_dir)
            if path and os.path.exists(path):
                logger.info(f"Downloaded Instagram video to {path}")
                return path
        except Exception as exc:
            logger.warning(f"Instaloader download failed ({exc}); falling back to yt-dlp")

        # Fallback: yt-dlp
        return await self._ytdlp_download(url, output_dir)

    # --- instaloader helper -------------------------------------------

    def _instaloader_download(self, url: str, output_dir: str) -> str | None:
        import instaloader

        sc = _shortcode(url)
        if not sc:
            return None

        L = instaloader.Instaloader(
            download_pictures=False,
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            quiet=True,
        )

        post = instaloader.Post.from_shortcode(L.context, sc)
        if not post.is_video or not post.video_url:
            return None

        os.makedirs(output_dir, exist_ok=True)
        file_id = str(uuid.uuid4())[:8]
        ext = post.video_url.split("?")[0].rsplit(".", 1)[-1] or "mp4"
        dest = os.path.join(output_dir, f"ig_{file_id}.{ext}")

        # Download directly from the signed CDN URL (no Instagram login needed
        # for public reels — the signed URL is returned by the public API).
        urllib.request.urlretrieve(post.video_url, dest)
        return dest

    # --- yt-dlp fallback helper --------------------------------------

    async def _ytdlp_download(self, url: str, output_dir: str) -> str:
        import yt_dlp

        file_id = str(uuid.uuid4())[:8]
        output_template = f"{output_dir}/ig_{file_id}.%(ext)s"

        ydl_opts: dict = {
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "quiet": True,
            "no_warnings": True,
        }
        cp = _cookies_path()
        if cp:
            ydl_opts["cookiefile"] = cp

        downloaded_path: list[str | None] = [None]

        def _progress_hook(d: dict) -> None:
            if d.get("status") == "finished":
                downloaded_path[0] = d.get("filename")

        ydl_opts["progress_hooks"] = [_progress_hook]

        def _download() -> None:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

        await asyncio.to_thread(_download)
        return downloaded_path[0] or f"{output_dir}/ig_{file_id}.mp4"

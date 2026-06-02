"""Transcript extraction, Whisper & AssemblyAI fallbacks, and chunking pipeline."""

import os
import asyncio
import logging
import shutil
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import get_settings
from app.providers.base import BaseVideoProvider

logger = logging.getLogger(__name__)
settings = get_settings()

# Lazy-loaded whisper model (heavy — only load once and only when needed)
_whisper_model = None
_whisper_lock = asyncio.Lock()


async def _get_whisper_model():
    """Load faster-whisper model lazily and cache it."""
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model

    async with _whisper_lock:
        # Double-check after acquiring lock
        if _whisper_model is not None:
            return _whisper_model

        from faster_whisper import WhisperModel

        def _load():
            logger.info(f"Loading Whisper model '{settings.WHISPER_MODEL}'...")
            return WhisperModel(
                settings.WHISPER_MODEL,
                device="cpu",  # Force CPU to minimize CUDA issues / memory
                compute_type=settings.WHISPER_COMPUTE_TYPE,
            )

        _whisper_model = await asyncio.to_thread(_load)
        logger.info("Whisper model loaded.")
        return _whisper_model


class TranscriptService:
    """Handles transcript extraction with native -> Whisper -> AssemblyAI fallbacks."""

    @staticmethod
    async def extract(provider: BaseVideoProvider, url: str) -> tuple[str, str]:
        """
        Extract transcript text and the source.
        1. Try the provider's native transcript API.
        2. Fall back to downloading audio + running local Whisper.
        3. Fall back to cloud AssemblyAI if Whisper fails (e.g. OOM on Render).
        4. Drop back to empty transcript ("metadata_only").
        """
        # Try native transcript first
        try:
            transcript = await provider.extract_transcript(url)
            if transcript and transcript.strip():
                logger.info(f"Got native transcript for {url} ({len(transcript)} chars)")
                is_youtube = "youtube" in url.lower() or "youtu.be" in url.lower()
                source = "youtube_transcript_api" if is_youtube else "assemblyai"
                return transcript.strip(), source
        except Exception as e:
            logger.warning(f"Native transcript API failed for {url}: {e}")

        # Ensure temp directory exists
        tmp_dir = Path(settings.AUDIO_TMP_DIR)
        tmp_dir.mkdir(parents=True, exist_ok=True)
        audio_path = None

        # Helper to find file with possible extensions
        def _find_audio_file(base_path: str) -> str | None:
            if os.path.exists(base_path):
                return base_path
            base = os.path.splitext(base_path)[0]
            for ext in [".wav", ".m4a", ".mp3", ".webm", ".opus", ".ogg", ".mp4"]:
                candidate = base + ext
                if os.path.exists(candidate):
                    return candidate
            return None

        # Download audio first (used for both Whisper and AssemblyAI)
        try:
            logger.info(f"Downloading audio for {url}...")
            raw_path = await provider.download_audio(url, str(tmp_dir))
            audio_path = _find_audio_file(raw_path)
            if not audio_path:
                logger.error(f"Downloaded audio file not found for {url}")
                return "", "metadata_only"
            logger.info(f"Audio ready at {audio_path}")
        except Exception as e:
            logger.error(f"Failed to download audio for {url}: {e}")
            return "", "metadata_only"

        # Step 2: Try local Whisper
        try:
            logger.info(f"Attempting local Whisper transcription (model: {settings.WHISPER_MODEL}) for {url}")
            
            # Preflight: faster-whisper needs ffmpeg
            if not shutil.which("ffmpeg"):
                raise RuntimeError("ffmpeg is not installed — faster-whisper cannot decode audio.")

            model = await _get_whisper_model()

            def _whisper_run():
                segments, _info = model.transcribe(
                    audio_path,
                    beam_size=5,
                    language="en",
                )
                return " ".join(seg.text.strip() for seg in segments)

            transcript_text = await asyncio.to_thread(_whisper_run)
            if transcript_text and transcript_text.strip():
                logger.info(f"Local Whisper transcript succeeded: {len(transcript_text)} chars")
                # Clean up audio file
                try:
                    os.remove(audio_path)
                except OSError:
                    pass
                return transcript_text.strip(), "whisper"
            else:
                logger.warning("Local Whisper returned empty transcript. Trying AssemblyAI...")
        except Exception as e:
            logger.warning(f"Local Whisper transcription failed: {e}. Falling back to AssemblyAI...")

        # Step 3: Try AssemblyAI
        try:
            logger.info(f"Attempting AssemblyAI fallback for {url}")
            if not settings.ASSEMBLYAI_API_KEY:
                logger.warning("ASSEMBLYAI_API_KEY is not configured. Falling back to metadata_only.")
                return "", "metadata_only"

            import assemblyai as aai

            def _assembly_run():
                aai.settings.api_key = settings.ASSEMBLYAI_API_KEY
                transcriber = aai.Transcriber()
                transcript = transcriber.transcribe(audio_path)
                if transcript.status == aai.TranscriptStatus.error:
                    logger.error(f"AssemblyAI transcription error: {transcript.error}")
                    return ""
                return transcript.text or ""

            async def _run_with_timeout():
                return await asyncio.to_thread(_assembly_run)

            transcript_text = await asyncio.wait_for(_run_with_timeout(), timeout=90.0)
            if transcript_text and transcript_text.strip():
                logger.info(f"AssemblyAI transcript succeeded: {len(transcript_text)} chars")
                # Clean up audio file
                try:
                    os.remove(audio_path)
                except OSError:
                    pass
                return transcript_text.strip(), "assemblyai"
            else:
                logger.warning("AssemblyAI returned empty transcript.")
        except asyncio.TimeoutError:
            logger.warning(f"AssemblyAI transcription timed out (90s limit) for {url}")
        except Exception as e:
            logger.error(f"AssemblyAI transcription failed: {e}")

        # Cleanup final audio file
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
                logger.info(f"Cleaned up temporary audio file: {audio_path}")
            except OSError as e:
                logger.warning(f"Failed to delete temp file {audio_path}: {e}")

        return "", "metadata_only"

    @classmethod
    async def get_transcript(cls, url: str) -> str:
        """Get transcript text for a URL by automatically detecting the provider."""
        from app.providers.registry import ProviderRegistry
        try:
            provider = ProviderRegistry.detect(url)
            text, _source = await cls.extract(provider, url)
            return text
        except Exception as e:
            logger.error(f"get_transcript failed for {url}: {e}")
            return ""

    @staticmethod
    def chunk(text: str) -> list[str]:
        """Split transcript text into overlapping chunks."""
        if not text or not text.strip():
            return []

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", ". ", ", ", " ", ""],
        )
        return splitter.split_text(text)

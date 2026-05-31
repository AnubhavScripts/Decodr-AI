"""Transcript extraction, whisper fallback, and chunking pipeline."""

import os
import asyncio
import logging
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
            return WhisperModel(
                settings.WHISPER_MODEL,
                device="auto",
                compute_type=settings.WHISPER_COMPUTE_TYPE,
            )

        logger.info(f"Loading Whisper model '{settings.WHISPER_MODEL}'...")
        _whisper_model = await asyncio.to_thread(_load)
        logger.info("Whisper model loaded.")
        return _whisper_model


class TranscriptService:
    """Handles transcript extraction with provider-native → whisper fallback, plus chunking."""

    @staticmethod
    async def extract(provider: BaseVideoProvider, url: str) -> str:
        """
        Extract transcript text.
        1. Try the provider's native transcript API.
        2. Fall back to downloading audio + running faster-whisper.
        """
        # Try native transcript first
        transcript = await provider.extract_transcript(url)
        if transcript:
            logger.info(f"Got native transcript for {url} ({len(transcript)} chars)")
            return transcript

        # Fallback: download audio → whisper
        logger.info(f"No native transcript — falling back to Whisper for {url}")
        return await TranscriptService._whisper_transcribe(provider, url)

    @staticmethod
    async def _whisper_transcribe(provider: BaseVideoProvider, url: str) -> str:
        """Download audio and transcribe with faster-whisper."""
        # Ensure temp directory exists
        tmp_dir = Path(settings.AUDIO_TMP_DIR)
        tmp_dir.mkdir(parents=True, exist_ok=True)

        audio_path = None
        try:
            # Download audio
            audio_path = await provider.download_audio(url, str(tmp_dir))
            logger.info(f"Audio downloaded to {audio_path}")

            # Check file exists
            if not os.path.exists(audio_path):
                # yt-dlp might have used a different extension
                base = os.path.splitext(audio_path)[0]
                for ext in [".wav", ".m4a", ".mp3", ".webm", ".opus", ".ogg"]:
                    candidate = base + ext
                    if os.path.exists(candidate):
                        audio_path = candidate
                        break

            if not os.path.exists(audio_path):
                logger.error(f"Audio file not found at {audio_path}")
                return ""

            # Transcribe
            model = await _get_whisper_model()

            def _transcribe():
                segments, _info = model.transcribe(
                    audio_path,
                    beam_size=5,
                    language="en",
                )
                return " ".join(seg.text.strip() for seg in segments)

            transcript = await asyncio.to_thread(_transcribe)
            logger.info(f"Whisper transcript: {len(transcript)} chars")
            return transcript

        except Exception as e:
            logger.error(f"Whisper transcription failed for {url}: {e}")
            return ""

        finally:
            # Clean up audio file
            if audio_path and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except OSError:
                    pass

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

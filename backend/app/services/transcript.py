"""Transcript extraction, AssemblyAI fallback, and chunking pipeline."""

import os
import asyncio
import logging
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import get_settings
from app.providers.base import BaseVideoProvider

logger = logging.getLogger(__name__)
settings = get_settings()


class TranscriptService:
    """Handles transcript extraction with provider-native → AssemblyAI fallback, plus chunking."""

    @staticmethod
    async def extract(provider: BaseVideoProvider, url: str) -> tuple[str, str]:
        """
        Extract transcript text and the source.
        1. Try the provider's native transcript API.
        2. Fall back to downloading audio + running AssemblyAI.
        3. Drop back to empty transcript ("metadata_only").
        """
        # Try native transcript first
        try:
            transcript = await provider.extract_transcript(url)
            if transcript and transcript.strip():
                logger.info(f"Got native transcript for {url} ({len(transcript)} chars)")
                # YouTube is the only one with native transcript API in our app
                is_youtube = "youtube" in url.lower() or "youtu.be" in url.lower()
                source = "youtube_transcript_api" if is_youtube else "assemblyai"
                return transcript.strip(), source
        except Exception as e:
            logger.warning(f"Native transcript API failed for {url}: {e}")

        # Fallback: download audio → AssemblyAI
        logger.info(f"No native transcript — falling back to AssemblyAI for {url}")
        text, source = await TranscriptService._assemblyai_transcribe(provider, url)
        return text, source

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
    async def _assemblyai_transcribe(provider: BaseVideoProvider, url: str) -> tuple[str, str]:
        """Download audio and transcribe with AssemblyAI."""
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
                for ext in [".wav", ".m4a", ".mp3", ".webm", ".opus", ".ogg", ".mp4"]:
                    candidate = base + ext
                    if os.path.exists(candidate):
                        audio_path = candidate
                        break

            if not os.path.exists(audio_path):
                logger.error(f"Audio file not found at {audio_path}")
                return "", "metadata_only"

            # Check for API key
            if not settings.ASSEMBLYAI_API_KEY:
                logger.warning("ASSEMBLYAI_API_KEY is not configured. Falling back to metadata_only.")
                return "", "metadata_only"

            import assemblyai as aai
            
            def _transcribe():
                aai.settings.api_key = settings.ASSEMBLYAI_API_KEY
                transcriber = aai.Transcriber()
                transcript = transcriber.transcribe(audio_path)
                
                # Check status
                if transcript.status == aai.TranscriptStatus.error:
                    logger.error(f"AssemblyAI transcription error: {transcript.error}")
                    return ""
                
                return transcript.text or ""

            # Wrap in timeout of 90 seconds
            async def _run_assembly():
                return await asyncio.to_thread(_transcribe)

            try:
                transcript_text = await asyncio.wait_for(_run_assembly(), timeout=90.0)
            except asyncio.TimeoutError:
                logger.warning(f"AssemblyAI transcription timed out (90s limit) for {url}")
                return "", "metadata_only"

            if transcript_text and transcript_text.strip():
                logger.info(f"AssemblyAI transcript: {len(transcript_text)} chars")
                return transcript_text.strip(), "assemblyai"
            else:
                logger.warning(f"AssemblyAI returned empty transcript for {url}")
                return "", "metadata_only"

        except Exception as e:
            logger.error(f"AssemblyAI transcription failed for {url}: {e}")
            return "", "metadata_only"

        finally:
            # Clean up audio file
            if audio_path and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                    logger.info(f"Cleaned up temporary audio file: {audio_path}")
                except OSError as e:
                    logger.warning(f"Failed to delete temp file {audio_path}: {e}")

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

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
    async def extract(provider: BaseVideoProvider, url: str) -> tuple[str, str, list[tuple[int, int, float, float]]]:
        """
        Extract transcript text, the source, and segment offsets.
        1. Try the provider's native transcript API.
        2. Fall back to downloading audio + running local Whisper.
        3. Fall back to cloud AssemblyAI if Whisper fails (e.g. OOM on Render).
        4. Drop back to empty transcript ("metadata_only").
        Returns:
            tuple[transcript_text, source, segment_offsets]
            where segment_offsets is a list of (start_char, end_char, start_time, end_time)
        """
        # Try native transcript first
        try:
            segments = await provider.extract_transcript(url)
            if segments:
                logger.info(f"Got native transcript for {url} ({len(segments)} segments)")
                full_text = ""
                segment_offsets = []
                for seg in segments:
                    text = str(seg["text"]).strip()
                    if not text:
                        continue
                    if full_text:
                        full_text += " "
                    start_char = len(full_text)
                    full_text += text
                    end_char = len(full_text)
                    segment_offsets.append((start_char, end_char, seg["start"], seg["end"]))
                
                is_youtube = "youtube" in url.lower() or "youtu.be" in url.lower()
                source = "youtube_transcript_api" if is_youtube else "assemblyai"
                return full_text.strip(), source, segment_offsets
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
                return "", "metadata_only", []
            logger.info(f"Audio ready at {audio_path}")
        except Exception as e:
            logger.error(f"Failed to download audio for {url}: {e}")
            return "", "metadata_only", []

        # Step 2: Try AssemblyAI first
        try:
            logger.info(f"Attempting AssemblyAI transcription for {url}")
            if not settings.ASSEMBLYAI_API_KEY:
                logger.warning("ASSEMBLYAI_API_KEY is not configured. Falling back to Whisper...")
            else:
                import assemblyai as aai

                def _assembly_run():
                    aai.settings.api_key = settings.ASSEMBLYAI_API_KEY
                    transcriber = aai.Transcriber()
                    transcript = transcriber.transcribe(audio_path)
                    if transcript.status == aai.TranscriptStatus.error:
                        logger.error(f"AssemblyAI transcription error: {transcript.error}")
                        return None
                    
                    try:
                        sentences = transcript.get_sentences()
                        res_segments = []
                        for sent in sentences:
                            res_segments.append({
                                "text": sent.text,
                                "start": sent.start / 1000.0,
                                "end": sent.end / 1000.0
                            })
                        return res_segments
                    except Exception as e:
                        logger.warning(f"Failed to get AssemblyAI sentences: {e}")
                        text = transcript.text or ""
                        if text:
                            return [{"text": text, "start": 0.0, "end": 0.0}]
                        return None

                async def _run_assembly_with_timeout():
                    return await asyncio.to_thread(_assembly_run)

                assembly_segments = await asyncio.wait_for(_run_assembly_with_timeout(), timeout=90.0)
                if assembly_segments:
                    full_text = ""
                    segment_offsets = []
                    for seg in assembly_segments:
                        text = str(seg["text"]).strip()
                        if not text:
                            continue
                        if full_text:
                            full_text += " "
                        start_char = len(full_text)
                        full_text += text
                        end_char = len(full_text)
                        segment_offsets.append((start_char, end_char, seg["start"], seg["end"]))
                    
                    logger.info(f"AssemblyAI transcript succeeded: {len(full_text)} chars")
                    # Clean up audio file
                    try:
                        os.remove(audio_path)
                    except OSError:
                        pass
                    return full_text.strip(), "assemblyai", segment_offsets
                else:
                    logger.warning("AssemblyAI returned empty transcript. Trying local Whisper...")
        except asyncio.TimeoutError:
            logger.warning(f"AssemblyAI transcription timed out (90s limit) for {url}. Trying local Whisper...")
        except Exception as e:
            logger.error(f"AssemblyAI transcription failed: {e}. Trying local Whisper...")

        # Step 3: Try local Whisper (fallback)
        try:
            logger.info(f"Attempting local Whisper transcription (model: {settings.WHISPER_MODEL}) for {url}")
            
            # Preflight: faster-whisper needs ffmpeg
            if not shutil.which("ffmpeg"):
                raise RuntimeError("ffmpeg is not installed — faster-whisper cannot decode audio.")

            logger.info("Loading Whisper model...")
            model = await _get_whisper_model()
            logger.info("Whisper model loaded.")

            def _whisper_run():
                logger.info("Starting Whisper transcription...")
                segments, _info = model.transcribe(
                    audio_path,
                    beam_size=5,
                    language="en",
                )
                res_segments = []
                for seg in segments:
                    res_segments.append({
                        "text": seg.text,
                        "start": seg.start,
                        "end": seg.end
                    })
                logger.info("Whisper transcription completed.")
                return res_segments

            async def _run_whisper_with_timeout():
                return await asyncio.to_thread(_whisper_run)

            whisper_segments = await asyncio.wait_for(_run_whisper_with_timeout(), timeout=45.0)
            if whisper_segments:
                full_text = ""
                segment_offsets = []
                for seg in whisper_segments:
                    text = str(seg["text"]).strip()
                    if not text:
                        continue
                    if full_text:
                        full_text += " "
                    start_char = len(full_text)
                    full_text += text
                    end_char = len(full_text)
                    segment_offsets.append((start_char, end_char, seg["start"], seg["end"]))
                
                logger.info(f"Local Whisper transcript succeeded: {len(full_text)} chars")
                # Clean up audio file
                try:
                    os.remove(audio_path)
                except OSError:
                    pass
                return full_text.strip(), "whisper", segment_offsets
            else:
                logger.warning("Local Whisper returned empty transcript.")
        except asyncio.TimeoutError:
            logger.warning(f"Whisper transcription timed out (45s limit) for {url}")
        except Exception as e:
            logger.warning(f"Local Whisper transcription failed: {e}")


        # Cleanup final audio file
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
                logger.info(f"Cleaned up temporary audio file: {audio_path}")
            except OSError as e:
                logger.warning(f"Failed to delete temp file {audio_path}: {e}")

        return "", "metadata_only", []

    @classmethod
    async def get_transcript(cls, url: str) -> str:
        """Get transcript text for a URL by automatically detecting the provider."""
        from app.providers.registry import ProviderRegistry
        try:
            provider = ProviderRegistry.detect(url)
            text, _source, _offsets = await cls.extract(provider, url)
            return text
        except Exception as e:
            logger.error(f"get_transcript failed for {url}: {e}")
            return ""

    @staticmethod
    def chunk(text: str, segment_offsets: list[tuple[int, int, float, float]]) -> list[dict]:
        """Split transcript text into overlapping chunks and map them to start/end timestamps."""
        if not text or not text.strip():
            return []

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", ". ", ", ", " ", ""],
        )
        raw_chunks = splitter.split_text(text)
        
        # Map raw chunks to timestamps using segment offsets
        mapped_chunks = []
        current_search_idx = 0
        
        for chunk in raw_chunks:
            idx = text.find(chunk, current_search_idx)
            if idx == -1:
                idx = text.find(chunk)
                
            if idx != -1:
                chunk_start_char = idx
                chunk_end_char = idx + len(chunk)
                current_search_idx = chunk_start_char
                
                # Find overlapping segments
                overlapping_starts = []
                overlapping_ends = []
                
                for start_char, end_char, start_time, end_time in segment_offsets:
                    if chunk_start_char < end_char and chunk_end_char > start_char:
                        overlapping_starts.append(start_time)
                        overlapping_ends.append(end_time)
                        
                if overlapping_starts and overlapping_ends:
                    start_time = min(overlapping_starts)
                    end_time = max(overlapping_ends)
                else:
                    start_time = None
                    end_time = None
            else:
                start_time = None
                end_time = None
                
            mapped_chunks.append({
                "text": chunk,
                "start_time": start_time,
                "end_time": end_time,
            })
            
        return mapped_chunks

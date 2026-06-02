"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Central configuration for the Decodr.ai backend."""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://decodr:decodr@localhost:5435/decodr"

    # LLM
    GOOGLE_API_KEY: str = ""

    # YouTube Data API
    YOUTUBE_API_KEY: str = ""

    @property
    def youtube_key(self) -> str:
        return self.YOUTUBE_API_KEY or self.GOOGLE_API_KEY

    # AssemblyAI API
    ASSEMBLYAI_API_KEY: str = ""

    # Embeddings
    EMBEDDING_MODEL: str = "models/gemini-embedding-2"
    EMBEDDING_DIMENSION: int = 384

    @property
    def resolved_embedding_model(self) -> str:
        # Fallback to Google model if legacy local model is configured
        if "bge-" in self.EMBEDDING_MODEL or "/" in self.EMBEDDING_MODEL or "sentence-transformers" in self.EMBEDDING_MODEL:
            return "models/gemini-embedding-2"
        return self.EMBEDDING_MODEL

    # Whisper
    WHISPER_MODEL: str = "small"
    WHISPER_COMPUTE_TYPE: str = "int8"

    # Chunking
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 100

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # Audio temp directory (relative to backend root)
    AUDIO_TMP_DIR: str = "audio_tmp"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

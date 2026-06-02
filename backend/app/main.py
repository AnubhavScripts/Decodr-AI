"""Decodr.ai Backend — FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.api.routes import router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    # ── Startup ──
    logger.info("Starting Decodr.ai backend...")

    # Validate instaloader dependency is installed
    try:
        import instaloader  # noqa: F401
        logger.info("Instaloader package verified successfully.")
    except ImportError:
        logger.error("CRITICAL: 'instaloader' dependency is missing!")
        raise RuntimeError("CRITICAL: 'instaloader' dependency is missing!")

    # Initialize database (create tables, extensions)
    await init_db()
    logger.info("Database initialized.")

    # Pre-load embedding model in background (non-blocking)
    # It will load lazily on first use if this fails
    try:
        from app.services.embedding import EmbeddingService
        await EmbeddingService.preload_model()
    except Exception as e:
        logger.warning(f"Embedding model preload failed (will lazy-load): {e}")

    logger.info("Decodr.ai backend ready!")
    yield

    # ── Shutdown ──
    logger.info("Shutting down Decodr.ai backend...")


# Create FastAPI app
app = FastAPI(
    title="Decodr.ai",
    description="AI-Powered Creator Intelligence Platform — Compare social media videos with an AI analyst.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(router, prefix="/api")


# Root redirect
@app.get("/")
async def root():
    return {
        "name": "Decodr.ai API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }

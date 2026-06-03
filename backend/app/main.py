"""Decodr.ai Backend — FastAPI application entry point."""

import asyncio
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
    try:
        await asyncio.wait_for(init_db(), timeout=15)
        logger.info("Database initialized successfully.")
    except asyncio.TimeoutError:
        logger.warning("Database initialization timed out after 15s. Continuing without database.")
    except Exception as e:
        logger.warning(f"Database initialization failed: {e}. The app will continue, but database features may be unavailable.")

    # Start preloading embedding model in the background so it is ready for the first request
    from app.services.embedding import EmbeddingService
    asyncio.create_task(EmbeddingService.preload_model())
    logger.info("Embedding service preloading initiated in the background.")

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

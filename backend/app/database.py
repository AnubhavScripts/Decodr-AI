"""Async SQLAlchemy database engine and session management."""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy import text
from app.config import get_settings

settings = get_settings()

import urllib.parse

# Fix connection parameters for asyncpg compatibility (e.g. from Neon DB copy-pastes)
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

parsed = urllib.parse.urlparse(db_url)
params = urllib.parse.parse_qsl(parsed.query)
cleaned_params = []
for k, v in params:
    if k == "channel_binding":
        continue
    if k == "sslmode":
        k = "ssl"
        if v in ("require", "prefer", "allow"):
            v = "require"
    cleaned_params.append((k, v))
new_query = urllib.parse.urlencode(cleaned_params)
db_url = parsed._replace(query=new_query).geturl()

engine = create_async_engine(
    db_url,
    echo=False,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args={
        "timeout": 10,
        "server_settings": {"application_name": "decodr-ai"},
    },
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create pgvector extension and all tables on startup."""
    from app.models.base import Base  # noqa: F811

    async with engine.begin() as conn:
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS vector'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        await conn.run_sync(Base.metadata.create_all)
        # Ensure transcript_source column exists on the videos table
        await conn.execute(text('ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_source VARCHAR(50)'))
        # Ensure transcript_status and hook_text columns exist on the videos table
        await conn.execute(text('ALTER TABLE videos ADD COLUMN IF NOT EXISTS transcript_status VARCHAR(20)'))
        await conn.execute(text('ALTER TABLE videos ADD COLUMN IF NOT EXISTS hook_text TEXT'))
        # Ensure start_time and end_time columns exist on the transcript_chunks table
        await conn.execute(text('ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS start_time DOUBLE PRECISION'))
        await conn.execute(text('ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS end_time DOUBLE PRECISION'))


async def check_db_connection() -> bool:
    """Verify database connectivity."""
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False

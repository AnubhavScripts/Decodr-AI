"""Common schemas used across endpoints."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """GET /health response."""
    status: str
    database: str
    embedding_model: str
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: str | None = None

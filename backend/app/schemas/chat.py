"""Pydantic schemas for the chat endpoint."""

from pydantic import BaseModel


class ChatRequest(BaseModel):
    """POST /chat request body."""
    analysis_id: str
    session_id: str | None = None
    message: str


class ChatStreamEvent(BaseModel):
    """Single event in the SSE chat stream."""
    type: str  # token | citation | status | done | error
    content: str = ""
    citations: list[dict] | None = None

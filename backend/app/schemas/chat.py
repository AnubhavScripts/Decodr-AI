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


class ChatMessageResponse(BaseModel):
    """Single chat message in the history."""
    id: str
    role: str
    content: str
    citations: list[dict] | None = None
    created_at: str | None = None


class ChatHistoryResponse(BaseModel):
    """Response containing chat session ID and messages."""
    session_id: str | None = None
    messages: list[ChatMessageResponse]


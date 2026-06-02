"""API routes — POST /analyze, GET /analysis/{id}, POST /chat, GET /health."""

import json
import logging
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from langchain_core.messages import HumanMessage, AIMessage

from app.database import get_db, async_session_factory, check_db_connection
from app.models.analysis import AnalysisSession
from app.models.video import Video
from app.models.chat import ChatSession, ChatMessage
from app.schemas.analysis import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisDetailResponse,
    VideoSummary,
)
from app.schemas.chat import ChatRequest
from app.schemas.common import HealthResponse, ErrorResponse
from app.services.ingestion import IngestionService
from app.providers.registry import ProviderRegistry, UnsupportedPlatformError
from app.agent.graph import agent_graph

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────────────────────────
# POST /analyze
# ──────────────────────────────────────────────
async def _run_ingestion(analysis_id: str, url_a: str, url_b: str):
    """Background task that runs the full ingestion pipeline."""
    async with async_session_factory() as db:
        try:
            await IngestionService.run(analysis_id, url_a, url_b, db)
        except Exception as e:
            logger.error(f"Background ingestion failed: {e}", exc_info=True)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_videos(
    request: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Submit two video URLs for comparison analysis."""
    # Validate URLs are from supported platforms
    try:
        ProviderRegistry.detect(request.video_url_a)
        ProviderRegistry.detect(request.video_url_b)
    except UnsupportedPlatformError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create analysis session
    session = AnalysisSession(status="pending")
    db.add(session)
    await db.commit()

    analysis_id = session.id

    # Kick off ingestion in background
    background_tasks.add_task(
        _run_ingestion,
        analysis_id,
        request.video_url_a,
        request.video_url_b,
    )

    logger.info(f"Analysis {analysis_id} queued for processing")
    return AnalyzeResponse(
        analysis_id=analysis_id,
        status="processing",
        message="Analysis started. Poll GET /analysis/{id} for results.",
    )


# ──────────────────────────────────────────────
# GET /analysis/{id}
# ──────────────────────────────────────────────
@router.get("/analysis/{analysis_id}", response_model=AnalysisDetailResponse)
async def get_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve analysis results with video metadata and metrics."""
    stmt = (
        select(AnalysisSession)
        .where(AnalysisSession.id == analysis_id)
        .options(selectinload(AnalysisSession.videos))
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Analysis not found")

    videos = [
        VideoSummary(
            id=v.id,
            video_label=v.video_label,
            platform=v.platform,
            title=v.title,
            creator=v.creator,
            follower_count=v.follower_count,
            views=v.views,
            likes=v.likes,
            comments_count=v.comments_count,
            hashtags=list(v.hashtags) if isinstance(v.hashtags, list) else None,
            upload_date=str(v.upload_date) if v.upload_date else None,
            duration=v.duration,
            thumbnail_url=v.thumbnail_url,
            video_url=v.video_url,
            transcript_available=bool(v.transcript_text),
            engagement_rate=v.engagement_rate,
            comment_rate=v.comment_rate,
            like_rate=v.like_rate,
            engagement_per_follower=v.engagement_per_follower,
        )
        for v in sorted(session.videos, key=lambda x: x.video_label)
    ]

    return AnalysisDetailResponse(
        id=session.id,
        status=session.status,
        error_message=session.error_message,
        created_at=str(session.created_at),
        updated_at=str(session.updated_at),
        videos=videos,
    )


# ──────────────────────────────────────────────
# POST /chat
# ──────────────────────────────────────────────
@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Chat with the AI analyst about the analysis.
    Returns a Server-Sent Events stream.
    """
    async def event_stream():
        async with async_session_factory() as db:
            # Verify analysis exists and is completed
            session = await db.get(AnalysisSession, request.analysis_id)
            if not session:
                yield _sse_event("error", "Analysis not found")
                return
            if session.status not in ("completed", "partial_success"):
                yield _sse_event(
                    "error",
                    f"Analysis is still {session.status}. Please wait."
                )
                return

            # Get or create chat session
            chat_session_id = request.session_id
            if chat_session_id:
                chat_session = await db.get(ChatSession, chat_session_id)
                if not chat_session:
                    chat_session = ChatSession(analysis_id=request.analysis_id)
                    db.add(chat_session)
                    await db.flush()
                    chat_session_id = chat_session.id
            else:
                chat_session = ChatSession(analysis_id=request.analysis_id)
                db.add(chat_session)
                await db.flush()
                chat_session_id = chat_session.id

            # Send session ID so frontend can maintain it
            yield _sse_event("session", chat_session_id)

            # Load chat history
            stmt = (
                select(ChatMessage)
                .where(ChatMessage.session_id == chat_session_id)
                .order_by(ChatMessage.created_at)
            )
            result = await db.execute(stmt)
            history = result.scalars().all()

            # Build message list for LangGraph
            messages = []
            for msg in history:
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                else:
                    messages.append(AIMessage(content=msg.content))

            # Add current message
            messages.append(HumanMessage(content=request.message))

            # Save user message
            user_msg = ChatMessage(
                session_id=chat_session_id,
                role="user",
                content=request.message,
            )
            db.add(user_msg)
            await db.flush()

            # Send status
            yield _sse_event("status", "Analyzing your question...")

            try:
                # Run the LangGraph agent
                initial_state = {
                    "messages": messages,
                    "analysis_id": request.analysis_id,
                    "db_session": db,
                    "intent": "",
                    "video_a_metadata": {},
                    "video_b_metadata": {},
                    "retrieved_chunks": [],
                    "hook_analysis": "",
                    "comparison_result": "",
                    "recommendations": "",
                    "citations": [],
                    "final_answer": "",
                }

                # Stream the graph execution
                final_state = None
                async for event in agent_graph.astream_events(
                    initial_state, version="v2"
                ):
                    kind = event.get("event", "")
                    name = event.get("name", "")

                    # Stream node entry events as status updates
                    if kind == "on_chain_start" and name in {
                        "intent", "metadata", "retrieval",
                        "hooks", "comparison", "recommendations",
                        "citations", "answer",
                    }:
                        status_map = {
                            "intent": "Understanding your question...",
                            "metadata": "Loading video data...",
                            "retrieval": "Searching transcripts...",
                            "hooks": "Analyzing hooks...",
                            "comparison": "Comparing videos...",
                            "recommendations": "Generating recommendations...",
                            "citations": "Preparing citations...",
                            "answer": "Generating answer...",
                        }
                        yield _sse_event("status", status_map.get(name, "Processing..."))

                    # Stream LLM tokens from the answer node only
                    if (
                        kind == "on_chat_model_stream"
                        and event.get("metadata", {}).get("langgraph_node") == "answer"
                    ):
                        chunk = event.get("data", {}).get("chunk")
                        if chunk and hasattr(chunk, "content") and chunk.content:
                            yield _sse_event("token", chunk.content)

                    # Capture final state
                    if kind == "on_chain_end" and name == "LangGraph":
                        final_state = event.get("data", {}).get("output", {})

                # Extract final answer and citations
                answer_text = ""
                citations = []
                if final_state:
                    answer_text = final_state.get("final_answer", "")
                    citations = final_state.get("citations", [])

                # If we didn't stream tokens, send the full answer
                if answer_text and not any(True for _ in []):
                    # Citations
                    if citations:
                        yield _sse_event("citations", json.dumps(citations))

                # Save assistant message
                assistant_msg = ChatMessage(
                    session_id=chat_session_id,
                    role="assistant",
                    content=answer_text,
                    citations=citations if citations else None,
                )
                db.add(assistant_msg)
                await db.commit()

                # Send citations as a separate event
                if citations:
                    yield _sse_event("citations", json.dumps(citations))

                yield _sse_event("done", "")

            except Exception as e:
                logger.error(f"Chat error: {e}", exc_info=True)
                yield _sse_event("error", f"An error occurred: {str(e)}")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _sse_event(event_type: str, data: str) -> str:
    """Format a single SSE event."""
    payload = json.dumps({"type": event_type, "content": data})
    return f"data: {payload}\n\n"


# ──────────────────────────────────────────────
# GET /health
# ──────────────────────────────────────────────
@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    db_ok = await check_db_connection()
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        database="connected" if db_ok else "disconnected",
        embedding_model="BAAI/bge-small-en-v1.5",
    )

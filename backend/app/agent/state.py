"""LangGraph state definition for the Decodr.ai RAG agent."""

from typing import Annotated, Any
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    """State that flows through the LangGraph agent.

    Each node reads from and writes to this shared state dict.
    The `messages` field uses LangGraph's add_messages reducer for
    automatic conversation history accumulation.
    """

    # Conversation history (auto-accumulated via add_messages)
    messages: Annotated[list[BaseMessage], add_messages]

    # Session context
    analysis_id: str
    db_session: Any  # AsyncSession — passed through for DB access

    # Intent routing
    intent: str  # metadata_only | transcript_search | comparison | hooks | recommendations

    # Video metadata (loaded from DB)
    video_a_metadata: dict
    video_b_metadata: dict

    # Retrieved transcript chunks (from vector search)
    retrieved_chunks: list[dict]

    # Node outputs
    hook_analysis: str
    comparison_result: str
    recommendations: str
    citations: list[dict]
    final_answer: str

"""LangGraph graph builder — wires all nodes with intent-based conditional routing.

Graph flow:
  START → intent → (conditional routing) → ... → answer → END

Intent routing:
  metadata_only     → metadata → answer
  transcript_search → metadata → retrieval → citations → answer
  comparison        → metadata → retrieval → comparison → citations → answer
  hooks             → metadata → retrieval → hooks → citations → answer
  recommendations   → metadata → retrieval → recommendations → citations → answer
"""

import logging
from typing import Literal

from langgraph.graph import StateGraph, START, END

from app.agent.state import AgentState
from app.agent.nodes.intent import intent_node
from app.agent.nodes.metadata import metadata_node
from app.agent.nodes.retrieval import retrieval_node
from app.agent.nodes.hooks import hooks_node
from app.agent.nodes.comparison import comparison_node
from app.agent.nodes.recommendations import recommendations_node
from app.agent.nodes.citations import citations_node
from app.agent.nodes.answer import answer_node

logger = logging.getLogger(__name__)


def _route_by_intent(
    state: AgentState,
) -> Literal[
    "metadata_only",
    "transcript_search",
    "comparison",
    "hooks",
    "recommendations",
]:
    """Route to different sub-paths based on the classified intent."""
    return state["intent"]


def build_graph() -> StateGraph:
    """Construct and compile the LangGraph agent."""

    graph = StateGraph(AgentState)

    # Register all nodes
    graph.add_node("intent", intent_node)
    graph.add_node("metadata", metadata_node)
    graph.add_node("retrieval", retrieval_node)
    graph.add_node("hooks", hooks_node)
    graph.add_node("comparison", comparison_node)
    graph.add_node("recommendations", recommendations_node)
    graph.add_node("citations", citations_node)
    graph.add_node("answer", answer_node)

    # Entry: always classify intent first
    graph.add_edge(START, "intent")

    # After intent: always load metadata, then branch
    graph.add_edge("intent", "metadata")

    # After metadata: route based on intent
    graph.add_conditional_edges(
        "metadata",
        _route_by_intent,
        {
            "metadata_only": "answer",         # metadata → answer (no retrieval needed)
            "transcript_search": "retrieval",   # needs transcript search
            "comparison": "retrieval",          # needs both metadata + transcripts
            "hooks": "retrieval",               # needs transcript chunks for hooks
            "recommendations": "retrieval",     # needs transcript context
        },
    )

    # After retrieval: route to specialized analysis node
    graph.add_conditional_edges(
        "retrieval",
        _route_by_intent,
        {
            "transcript_search": "citations",      # simple search → cite → answer
            "comparison": "comparison",             # comparison analysis → cite → answer
            "hooks": "hooks",                       # hook analysis → cite → answer
            "recommendations": "recommendations",   # recs → cite → answer
        },
    )

    # Specialized nodes → citations → answer
    graph.add_edge("hooks", "citations")
    graph.add_edge("comparison", "citations")
    graph.add_edge("recommendations", "citations")
    graph.add_edge("citations", "answer")

    # Terminal
    graph.add_edge("answer", END)

    return graph.compile()


# Compiled graph instance (reusable)
agent_graph = build_graph()

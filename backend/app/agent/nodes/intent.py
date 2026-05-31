"""Intent detection node — classifies user query to route the graph."""

import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from app.agent.state import AgentState
from app.agent.prompts import INTENT_PROMPT
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def intent_node(state: AgentState) -> dict:
    """Classify the user's latest message into an intent category."""
    messages = state["messages"]
    last_message = messages[-1].content if messages else ""

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0,
    )

    chain = INTENT_PROMPT | llm
    result = await chain.ainvoke({"question": last_message})
    intent = result.content.strip().lower()

    # Validate intent
    valid_intents = {
        "metadata_only",
        "transcript_search",
        "comparison",
        "hooks",
        "recommendations",
    }
    if intent not in valid_intents:
        # Default to comparison for ambiguous queries
        logger.warning(f"Unknown intent '{intent}', defaulting to 'comparison'")
        intent = "comparison"

    logger.info(f"Intent classified: '{intent}' for query: '{last_message[:80]}...'")
    return {"intent": intent}

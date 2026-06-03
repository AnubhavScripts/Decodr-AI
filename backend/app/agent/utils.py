"""Utility functions for the LangGraph agent."""

from typing import Any

def extract_text(content: Any) -> str:
    """Safely extract string content from LangChain's message content.
    
    LangChain's AIMessage.content can be a string or a list of strings/dicts.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = []
        for part in content:
            if isinstance(part, str):
                text_parts.append(part)
            elif isinstance(part, dict):
                # LangChain block format: {"type": "text", "text": "..."}
                if part.get("type") == "text" and "text" in part:
                    text_parts.append(part["text"])
                elif "text" in part:
                    text_parts.append(part["text"])
                else:
                    text_parts.append(str(part))
            else:
                text_parts.append(str(part))
        return "".join(text_parts)
    return str(content) if content is not None else ""

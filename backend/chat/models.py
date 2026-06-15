# backend/chat/models.py
from pydantic import BaseModel, Field
from typing import Optional, Any, List
from enum import Enum


class SSEEventType(str, Enum):
    CONTENT = "content"
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    EVENT = "event"
    REDACT = "redact"


class SSEEvent(BaseModel):
    """Typed representation of a parsed SSE delta.
    Replaces the raw dicts returned by ChatHandler._parse_sse_delta().
    """
    type: SSEEventType
    content: Any  # str for content/thinking, str(JSON) for tool_calls, dict for tool_result


class ParsedToolCall(BaseModel):
    """A single parsed tool call extracted from an LLM response."""
    id: str
    name: str
    arguments: dict = Field(default_factory=dict)
    raw_arguments: str = ""

    @classmethod
    def from_openai_delta(cls, tc: dict) -> "ParsedToolCall":
        """Parse from OpenAI-format tool call dict."""
        func = tc.get("function", {})
        import json
        args_str = func.get("arguments", "{}")
        try:
            args = json.loads(args_str) if isinstance(args_str, str) else args_str
        except Exception:
            args = {}
        return cls(
            id=tc.get("id", ""),
            name=func.get("name", ""),
            arguments=args if isinstance(args, dict) else {},
            raw_arguments=args_str if isinstance(args_str, str) else "",
        )


class ToolResult(BaseModel):
    """Result from a tool execution."""
    tool_call_id: str
    name: str
    content: str
    success: bool = True


class AgentResult(BaseModel):
    """Structured result from a sub-agent execution."""
    agent_name: str
    status: str = "completed"  # completed | failed | terminated
    content: str = ""
    metadata: dict = Field(default_factory=dict)

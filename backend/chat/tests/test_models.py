# backend/chat/tests/test_models.py
import pytest
from backend.chat.models import SSEEvent, SSEEventType, ParsedToolCall, ToolResult, AgentResult

def test_sse_event_creation():
    event = SSEEvent(type=SSEEventType.CONTENT, content="Hello")
    assert event.type == SSEEventType.CONTENT
    assert event.content == "Hello"

    event_thinking = SSEEvent(type=SSEEventType.THINKING, content="Analyzing")
    assert event_thinking.type == SSEEventType.THINKING

def test_parsed_tool_call_from_openai_delta():
    # Valid delta
    tc = {
        "id": "call_1",
        "function": {
            "name": "get_time",
            "arguments": '{"timezone": "UTC"}'
        }
    }
    parsed = ParsedToolCall.from_openai_delta(tc)
    assert parsed.id == "call_1"
    assert parsed.name == "get_time"
    assert parsed.arguments == {"timezone": "UTC"}
    assert parsed.raw_arguments == '{"timezone": "UTC"}'

def test_parsed_tool_call_malformed_arguments():
    # Malformed JSON in arguments
    tc = {
        "id": "call_2",
        "function": {
            "name": "get_time",
            "arguments": '{"timezone": "UTC"' # missing closing brace
        }
    }
    parsed = ParsedToolCall.from_openai_delta(tc)
    assert parsed.id == "call_2"
    assert parsed.name == "get_time"
    assert parsed.arguments == {}
    assert parsed.raw_arguments == '{"timezone": "UTC"'

def test_parsed_tool_call_empty_arguments():
    tc = {
        "id": "call_3",
        "function": {
            "name": "get_time"
        }
    }
    parsed = ParsedToolCall.from_openai_delta(tc)
    assert parsed.arguments == {}

def test_parsed_tool_call_missing_fields():
    parsed = ParsedToolCall.from_openai_delta({})
    assert parsed.id == ""
    assert parsed.name == ""
    assert parsed.arguments == {}

def test_tool_result_and_agent_result():
    res = ToolResult(tool_call_id="call_1", name="get_time", content="12:00")
    assert res.success is True

    agent_res = AgentResult(agent_name="file_system_agent", status="completed", content="Done")
    assert agent_res.status == "completed"

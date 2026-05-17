import pytest
import httpx
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from backend.tools.agents.research_agent.research_utils import (
    _extract_json_from_text,
    _format_plan_as_markdown,
    _normalize_citations,
    _strip_report_images,
    _is_transient_error,
    _strip_invalid_citations
)

def test_extract_json_from_text():
    text = "Here is the result: ```json\n{\"key\": \"value\"}\n```"
    assert _extract_json_from_text(text) == {"key": "value"}
    
    text_no_blocks = "{\"key\": \"value\"}"
    assert _extract_json_from_text(text_no_blocks) == {"key": "value"}
    
    invalid_text = "Not a json"
    assert _extract_json_from_text(invalid_text) is None

def test_format_plan_as_markdown():
    plan = {
        "title": "Test Plan",
        "sections": [
            {"heading": "Section 1", "description": "Desc 1", "queries": [{"query": "q1"}]}
        ]
    }
    md = _format_plan_as_markdown(plan)
    assert "# Test Plan" in md
    assert "### 1. Section 1" in md
    assert "Desc 1" in md
    assert "q1" in md

def test_normalize_citations():
    text = "Fact one [1]. Fact two [2]."
    registry = {
        1: {"url": "http://source1.com"},
        2: {"url": "http://source2.com"}
    }
    processed, refs = _normalize_citations(text, registry)
    assert "[1]" in processed
    assert "[2]" in processed
    assert "1. [http://source1.com]" in refs[0]

    # Test that current implementation sorts valid_ids (no re-ordering by appearance)
    text_rev = "Fact two [2]. Fact one [1]."
    processed_rev, refs_rev = _normalize_citations(text_rev, registry)
    assert "Fact two [2]" in processed_rev
    assert "Fact one [1]" in processed_rev
    assert "1. [http://source1.com]" in refs_rev[0]

    # Test range expansion
    text_range = "Facts [1-2]"
    processed_range, _ = _normalize_citations(text_range, registry)
    assert "[1] [2]" in processed_range

def test_strip_report_images():
    text = "Text ![image](http://url.com/img.png) more text"
    assert _strip_report_images(text) == "Text  more text"

def test_is_transient_error():
    assert _is_transient_error(httpx.ConnectTimeout("timeout")) is True
    assert _is_transient_error(ValueError("fatal error")) is False
    assert _is_transient_error(Exception("unknown")) is True

def test_strip_invalid_citations():
    text = "Valid [1] and invalid [99]."
    valid_ids = {1}
    assert _strip_invalid_citations(text, valid_ids) == "Valid [1] and invalid."

@pytest.mark.asyncio
async def test_execute_mcp_tool_retries():
    from backend.tools.agents.research_agent.research_utils import _execute_mcp_tool
    mock_client = MagicMock()
    mock_client.execute_tool = AsyncMock()
    
    # Fail twice with transient error, then succeed
    mock_client.execute_tool.side_effect = [
        httpx.ConnectTimeout("timeout"),
        asyncio.TimeoutError("timeout"),
        MagicMock(content=[MagicMock(text="success")])
    ]
    
    with patch('asyncio.sleep', AsyncMock()): # skip waiting
        res = await _execute_mcp_tool(mock_client, "tool", {}, max_retries=2)
        assert res.content[0].text == "success"
        assert mock_client.execute_tool.call_count == 3

@pytest.mark.asyncio
async def test_execute_mcp_tool_fatal_failure():
    from backend.tools.agents.research_agent.research_utils import _execute_mcp_tool
    mock_client = MagicMock()
    mock_client.execute_tool = AsyncMock()
    
    # ValueError is NOT transient
    mock_client.execute_tool.side_effect = ValueError("fatal")
    
    with pytest.raises(ValueError, match="fatal"):
        await _execute_mcp_tool(mock_client, "tool", {}, max_retries=2)
    assert mock_client.execute_tool.call_count == 1

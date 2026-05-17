import pytest
import json
import time
from unittest.mock import MagicMock, patch, AsyncMock
from tavily_mcp.server import (
    sanitize_output,
    get_secret,
    execute_tavily_search,
    audit_tavily_search,
    async_tavily_search,
    async_tavily_map,
    _tavily_search_cache,
    AuthMiddleware
)

@pytest.mark.parametrize("input_text,expected", [
    ("Hello world", "Hello world"),
    ("<p>Hello</p>", "Hello"),
    ("javascript:alert(1)", "alert(1)"),
    ("eval('evil')", "'evil')"),
])
def test_sanitize_output(input_text, expected):
    assert sanitize_output(input_text) == expected

def test_get_secret():
    with patch("builtins.open", side_effect=IOError):
        with patch.dict("os.environ", {"TEST_TAVILY": "key"}):
            assert get_secret("TEST_TAVILY") == "key"

@pytest.mark.asyncio
async def test_audit_tavily_search():
    _tavily_search_cache.clear()
    res = await audit_tavily_search("test-chat")
    assert "Error: No recent search" in res
    _tavily_search_cache["test-chat"] = {
        "raw_content": "Raw Data",
        "timestamp": time.time()
    }
    res = await audit_tavily_search("test-chat")
    assert res == "Raw Data"
    _tavily_search_cache["test-chat"]["timestamp"] = time.time() - 4000
    res = await audit_tavily_search("test-chat")
    assert "Error: The previous search data has expired" in res

@pytest.mark.asyncio
async def test_execute_tavily_search_success():
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "answer": "The answer is 42",
            "results": [{"title": "T1", "url": "U1", "content": "C1", "score": 0.9}],
            "images": ["I1"]
        }
        mock_post.return_value = mock_response
        with patch("tavily_mcp.server.TAVILY_API_KEY", "dummy"):
            res_str = await execute_tavily_search("q", chat_id="c1")
            res = json.loads(res_str)
            assert "42" in res["standard_output"]
            assert "c1" in _tavily_search_cache

@pytest.mark.asyncio
async def test_async_tavily_search_scenarios():
    with patch("httpx.AsyncClient.post") as mock_post:
        # Success
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"results": [], "images": []}
        mock_post.return_value = mock_response
        with patch("tavily_mcp.server.TAVILY_API_KEY", "dummy"):
            res = json.loads(await async_tavily_search("q"))
            assert "results" in res
        
        # Failure
        mock_post.side_effect = Exception("API Error")
        res = json.loads(await async_tavily_search("q"))
        assert "error" in res
        assert "API Error" in res["error"]

@pytest.mark.asyncio
async def test_async_tavily_map_scenarios():
    with patch("httpx.AsyncClient.post") as mock_post:
        # Success
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"results": []}
        mock_post.return_value = mock_response
        with patch("tavily_mcp.server.TAVILY_API_KEY", "dummy"):
            res = json.loads(await async_tavily_map("url", "inst"))
            assert "results" in res
        
        # Failure
        mock_post.side_effect = Exception("Map Error")
        res = json.loads(await async_tavily_map("url", "inst"))
        assert "error" in res
        assert "Map Error" in res["error"]

@pytest.mark.asyncio
async def test_auth_middleware():
    mock_app = AsyncMock()
    middleware = AuthMiddleware(mock_app)
    await middleware({"type": "websocket"}, None, None)
    mock_app.assert_called_once()
    mock_app.reset_mock()
    await middleware({"type": "http", "path": "/health"}, None, None)
    mock_app.assert_called_once()
    mock_app.reset_mock()
    with patch("tavily_mcp.server.MCP_API_KEY", "secret"):
        send_mock = AsyncMock()
        await middleware({"type": "http", "path": "/sse", "headers": [(b"x-mcp-api-key", b"wrong")]}, None, send_mock)
        mock_app.assert_not_called()
        send_mock.assert_called()

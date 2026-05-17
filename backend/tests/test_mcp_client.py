import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from backend.mcp_client import MCPClient

@pytest.fixture
def mock_sse():
    with patch('backend.mcp_client.sse_client') as mock:
        # mock is an async context manager
        mock.return_value.__aenter__.return_value = (AsyncMock(), AsyncMock())
        yield mock

@pytest.fixture
def mock_session():
    with patch('backend.mcp_client.ClientSession') as mock:
        mock_inst = mock.return_value
        mock_inst.__aenter__.return_value = mock_inst
        mock_inst.initialize = AsyncMock()
        mock_inst.list_tools = AsyncMock()
        mock_inst.call_tool = AsyncMock()
        yield mock_inst

@pytest.mark.anyio
async def test_mcp_client_connect(mock_sse, mock_session):
    client = MCPClient(server_url="http://mock-server")
    with patch('backend.mcp_client.get_secret', return_value="test-key"):
        await client.connect()
        assert client.session is not None
        mock_session.initialize.assert_called_once()

@pytest.mark.anyio
async def test_mcp_client_execute_tool_success(mock_sse, mock_session):
    client = MCPClient(server_url="http://mock-server")
    mock_session.call_tool.return_value = "tool-result"
    
    with patch('backend.mcp_client.get_secret', return_value="test-key"):
        res = await client.execute_tool("my_tool", {"arg": 1})
        assert res == "tool-result"
        mock_session.call_tool.assert_called_with("my_tool", {"arg": 1})

@pytest.mark.anyio
async def test_mcp_client_execute_tool_retry(mock_sse, mock_session):
    client = MCPClient(server_url="http://mock-server")
    # Fail first, then succeed
    mock_session.call_tool.side_effect = [Exception("fail"), "success"]
    
    with patch('backend.mcp_client.get_secret', return_value="test-key"):
        res = await client.execute_tool("my_tool", {})
        assert res == "success"
        assert mock_session.call_tool.call_count == 2

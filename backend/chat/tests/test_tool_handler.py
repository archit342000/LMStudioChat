import pytest
import json
from unittest.mock import MagicMock, patch, AsyncMock
from backend.chat.tool_handler import ToolHandler

@pytest.fixture
def mock_db():
    with patch('backend.database.db') as mock:
        yield mock
        
@pytest.fixture
def mock_global_db():
    with patch('backend.database.db') as mock:
        yield mock

@pytest.fixture
def mock_registry():
    with patch('backend.chat.tool_handler.ToolRegistry') as mock:
        yield mock

@pytest.fixture
def tool_handler():
    chat_handler = MagicMock()
    return ToolHandler("chat_123", chat_handler, parent_message_id=100)

def test_init(tool_handler):
    assert tool_handler.chat_id == "chat_123"
    assert tool_handler.parent_message_id == 100
    assert tool_handler.parent_type == "main"
    assert tool_handler.agent_handler is not None
    assert tool_handler.agent_handler.parent_message_id == 100

@pytest.mark.anyio
@patch('backend.database.db')
async def test_handle_tool_calls_idempotency(mock_db_instance, tool_handler):
    mock_db_instance.get_messages.return_value = [
        {"role": "tool", "tool_call_id": "call_1", "content": "already done"}
    ]
    
    tool_calls = [{"id": "call_1", "function": {"name": "test_tool", "arguments": "{}"}}]
    
    chunks = []
    async for chunk in tool_handler.handle_tool_calls(tool_calls):
        chunks.append(chunk)
        
    assert len(chunks) == 0
    mock_db_instance.get_messages.assert_called_with("chat_123", parent_type="main")

@pytest.mark.anyio
async def test_handle_tool_calls_missing_name(mock_db, tool_handler):
    tool_calls = [{"id": "call_1", "function": {"arguments": "{}"}}]
    chunks = []
    async for chunk in tool_handler.handle_tool_calls(tool_calls):
        chunks.append(chunk)
    assert len(chunks) == 0

@pytest.mark.anyio
@patch('backend.database.db')
async def test_handle_tool_calls_bad_args(mock_db_instance, mock_registry, tool_handler):
    mock_db_instance.get_messages.return_value = []
    mock_registry.get_tool.return_value = {"type": "function"}
    mock_registry.resolve_implementation.return_value = AsyncMock(return_value="success")
    
    # Should use empty dict for args
    tool_calls = [{"id": "call_1", "function": {"name": "test_tool", "arguments": "invalid json"}}]
    
    chunks = []
    async for chunk in tool_handler.handle_tool_calls(tool_calls):
        chunks.append(chunk)
        
    assert len(chunks) == 1
    mock_impl = mock_registry.resolve_implementation.return_value
    # args should be empty dict because of bad json

@pytest.mark.anyio
@patch('backend.database.db')
async def test_handle_tool_calls_unregistered_tool(mock_db_instance, mock_registry, tool_handler):
    mock_db_instance.get_messages.return_value = []
    mock_registry.get_tool.return_value = None
    mock_registry._registry = {"available_tool": {}}
    
    tool_calls = [{"id": "call_1", "function": {"name": "test_tool", "arguments": "{}"}}]
    
    chunks = []
    async for chunk in tool_handler.handle_tool_calls(tool_calls):
        chunks.append(chunk)
        
    assert len(chunks) == 1
    assert "not found in registry" in chunks[0]
    mock_db_instance.add_tool_result.assert_called_once()
    assert "not found in registry" in mock_db_instance.add_tool_result.call_args.kwargs['content']

@pytest.mark.anyio
@patch('backend.database.db')
async def test_handle_tool_calls_agent_tool_no_result(mock_db_instance, mock_registry, tool_handler):
    mock_db_instance.get_messages.return_value = []
    mock_registry.get_tool.return_value = {"type": "agent"}
    
    async def mock_agent_flow(agent, agent_name, **kwargs):
        yield "agent_stream"
        
    mock_registry.resolve_implementation.return_value = mock_agent_flow
    tool_handler.agent_handler = MagicMock()
    
    async def execute_agent_mock(*args, **kwargs):
        yield "chunk1"
        
    tool_handler.agent_handler.execute_agent.side_effect = execute_agent_mock
    tool_handler.agent_handler.result = None
    
    tool_calls = [{"id": "call_1", "function": {"name": "test_agent", "arguments": "{}"}}]
    
    chunks = []
    async for chunk in tool_handler.handle_tool_calls(tool_calls):
        chunks.append(chunk)
        
    assert len(chunks) == 2
    assert chunks[0] == "chunk1"
    assert "completed execution successfully" in chunks[1]
    mock_db_instance.add_tool_result.assert_called_once()
    assert "completed execution successfully" in mock_db_instance.add_tool_result.call_args.kwargs['content']

@pytest.mark.anyio
@patch('backend.database.db')
async def test_handle_tool_calls_agent_tool_with_result(mock_db_instance, mock_registry, tool_handler):
    mock_db_instance.get_messages.return_value = []
    mock_registry.get_tool.return_value = {"type": "agent"}
    
    async def mock_agent_flow(agent, agent_name, **kwargs):
        yield "agent_stream"
        
    mock_registry.resolve_implementation.return_value = mock_agent_flow
    tool_handler.agent_handler = MagicMock()
    
    async def execute_agent_mock(*args, **kwargs):
        yield "chunk1"
        
    tool_handler.agent_handler.execute_agent.side_effect = execute_agent_mock
    tool_handler.agent_handler.result = {"key": "value"}
    
    tool_calls = [{"id": "call_1", "function": {"name": "test_agent", "arguments": "{}"}}]
    
    chunks = []
    async for chunk in tool_handler.handle_tool_calls(tool_calls):
        chunks.append(chunk)
        
    assert len(chunks) == 2
    assert chunks[0] == "chunk1"
    assert '\\"key\\": \\"value\\"' in chunks[1]
    mock_db_instance.add_tool_result.assert_called_once()
    assert '{"key": "value"}' in mock_db_instance.add_tool_result.call_args.kwargs['content']

@pytest.mark.anyio
@patch('backend.database.db')
async def test_handle_tool_calls_agent_tool_unresolved(mock_db_instance, mock_registry, tool_handler):
    mock_db_instance.get_messages.return_value = []
    mock_registry.get_tool.return_value = {"type": "agent"}
    mock_registry.resolve_implementation.return_value = None
    
    tool_calls = [{"id": "call_1", "function": {"name": "test_agent", "arguments": "{}"}}]
    
    chunks = []
    async for chunk in tool_handler.handle_tool_calls(tool_calls):
        chunks.append(chunk)
        
    assert len(chunks) == 1
    assert "could not be resolved" in chunks[0]
    mock_db_instance.add_tool_result.assert_called_once()
    assert "could not be resolved" in mock_db_instance.add_tool_result.call_args.kwargs['content']

@pytest.mark.anyio
@patch('backend.database.db')
async def test_handle_tool_calls_pure_function(mock_db_instance, mock_registry, tool_handler):
    mock_db_instance.get_messages.return_value = []
    mock_registry.get_tool.return_value = {"type": "function"}
    
    mock_impl = AsyncMock(return_value={"result": "pure_success"})
    mock_registry.resolve_implementation.return_value = mock_impl
    
    tool_calls = [{"id": "call_2", "function": {"name": "pure_tool", "arguments": '{"arg1": "val1"}'}}]
    
    chunks = []
    async for chunk in tool_handler.handle_tool_calls(tool_calls):
        chunks.append(chunk)
        
    assert len(chunks) == 1
    assert '\\"result\\": \\"pure_success\\"' in chunks[0]
    mock_db_instance.add_tool_result.assert_called_once()
    assert '{"result": "pure_success"}' in mock_db_instance.add_tool_result.call_args.kwargs['content']

@pytest.mark.anyio
async def test_execute_pure_tool_unresolved(mock_registry, tool_handler):
    mock_registry.resolve_implementation.return_value = None
    result = await tool_handler._execute_pure_tool("bad_tool", {})
    assert "could not be resolved" in result

@pytest.mark.anyio
async def test_execute_pure_tool_var_keyword(mock_registry, tool_handler):
    async def mock_impl(**kwargs):
        return kwargs
        
    mock_registry.resolve_implementation.return_value = mock_impl
    result = await tool_handler._execute_pure_tool("tool1", {"arg": 1}, tc_id="t1")
    assert result["arg"] == 1
    assert result["chat_id"] == "chat_123"
    assert result["tool_call_id"] == "t1"

@pytest.mark.anyio
async def test_execute_pure_tool_strict_params(mock_registry, tool_handler):
    async def mock_impl(arg, chat_id):
        return f"{arg}_{chat_id}"
        
    mock_registry.resolve_implementation.return_value = mock_impl
    result = await tool_handler._execute_pure_tool("tool1", {"arg": 1}, tc_id="t1")
    assert result == "1_chat_123"

@pytest.mark.anyio
async def test_execute_pure_tool_sync_exception(mock_registry, tool_handler):
    def mock_impl():
        raise ValueError("sync error")
        
    mock_registry.resolve_implementation.return_value = mock_impl
    result = await tool_handler._execute_pure_tool("tool1", {})
    assert "Error: sync error" in result

    assert "Error: sync error" in result

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from backend.tools.clarify import request_clarification

@pytest.fixture
def mock_registry():
    with patch('backend.tools.clarify.callback_registry') as mock:
        yield mock

@pytest.fixture
def mock_db():
    with patch('backend.database.db') as mock:
        yield mock

@pytest.mark.anyio
async def test_request_clarification_success(mock_registry, mock_db):
    # Mock successful registration and wait
    mock_event = AsyncMock()
    mock_registry.register.return_value = mock_event
    mock_registry.get.return_value = {"response": {"content": "User Answer"}}
    mock_db.get_resolved_callback.return_value = None
    
    # Mock wait_for to return immediately
    with patch('asyncio.wait_for', AsyncMock()):
        res = await request_clarification(
            question="What is X?",
            chat_id="chat1",
            tool_call_id="call1"
        )
        
        assert res == "User Answer"
        mock_registry.register.assert_called_once()
        mock_registry.cleanup.assert_called_once_with("call1")

@pytest.mark.anyio
async def test_request_clarification_recovery(mock_registry, mock_db):
    # Mock crash recovery
    mock_db.get_resolved_callback.return_value = {"response": "Recovered Answer"}
    
    res = await request_clarification(
        question="What is X?",
        chat_id="chat1",
        tool_call_id="call1"
    )
    
    assert res == "Recovered Answer"
    assert mock_registry.register.called is False
    mock_db.cleanup_callback.assert_called_once_with("call1")

@pytest.mark.anyio
async def test_request_clarification_timeout(mock_registry, mock_db):
    mock_event = AsyncMock()
    mock_registry.register.return_value = mock_event
    mock_db.get_resolved_callback.return_value = None
    
    with patch('asyncio.wait_for', AsyncMock(side_effect=asyncio.TimeoutError())):
        res = await request_clarification(
            question="What is X?",
            chat_id="chat1",
            tool_call_id="call1"
        )
        
        assert "ERROR: User did not provide clarification" in res
        mock_registry.cleanup.assert_called_once_with("call1")

@pytest.mark.anyio
async def test_request_clarification_missing_context():
    res = await request_clarification(question="X")
    assert "ERROR: Missing required context" in res

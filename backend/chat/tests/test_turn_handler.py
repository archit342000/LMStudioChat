import pytest
import time
from unittest.mock import MagicMock, patch, AsyncMock
from backend.chat.turn_handler import TurnHandler

@pytest.fixture
def mock_db():
    with patch('backend.chat.turn_handler.db') as mock:
        yield mock

@pytest.fixture
def mock_log_event():
    with patch('backend.chat.turn_handler.log_event') as mock:
        yield mock

@pytest.mark.anyio
async def test_turn_handler_handle_turn(mock_db, mock_log_event):
    chat_id = "test_chat"
    parent_id = 1
    
    async def mock_run_fn():
        yield "chunk1"
        yield "chunk2"
        
    chunks = []
    async for chunk in TurnHandler.handle_turn(chat_id, parent_id, mock_run_fn):
        chunks.append(chunk)
        
    assert chunks == ["chunk1", "chunk2"]
    mock_db.update_chat.assert_called_once()
    mock_log_event.assert_any_call("turn_handler_start", {"chat_id": chat_id, "parent_id": parent_id, "model": None})
    mock_log_event.assert_any_call("turn_persistence_finalized", {"chat_id": chat_id, "parent_id": parent_id})
    # Ensure turn_handler_end is called
    assert any(call.args[0] == "turn_handler_end" for call in mock_log_event.call_args_list)

@pytest.mark.anyio
async def test_turn_handler_error(mock_db, mock_log_event):
    chat_id = "test_chat"
    parent_id = 1
    
    async def mock_run_fn_error():
        yield "chunk1"
        raise ValueError("Simulated error")
        
    with pytest.raises(ValueError, match="Simulated error"):
        async for _ in TurnHandler.handle_turn(chat_id, parent_id, mock_run_fn_error):
            pass
            
    mock_log_event.assert_any_call("turn_handler_error", {"chat_id": chat_id, "error": "Simulated error"})
    # Ensure end event is also fired
    assert any(call.args[0] == "turn_handler_end" for call in mock_log_event.call_args_list)

def test_persist_final_state_success(mock_db, mock_log_event):
    TurnHandler._persist_final_state("chat_123", 456, "some_model")
    mock_db.update_chat.assert_called_once()
    assert mock_db.update_chat.call_args[0][0] == "chat_123"
    mock_log_event.assert_called_with("turn_persistence_finalized", {
        "chat_id": "chat_123",
        "parent_id": 456
    })

def test_persist_final_state_error(mock_db, mock_log_event, caplog):
    mock_db.update_chat.side_effect = Exception("DB error")
    TurnHandler._persist_final_state("chat_123", 456, "some_model")
    
    mock_log_event.assert_called_with("turn_persistence_error", {
        "chat_id": "chat_123", 
        "error": "DB error"
    })

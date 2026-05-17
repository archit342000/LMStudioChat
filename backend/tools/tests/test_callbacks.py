import pytest
import asyncio
import time
from unittest.mock import MagicMock, patch
from backend.tools.callbacks import CallbackRegistry

@pytest.fixture(autouse=True)
def reset_registry():
    CallbackRegistry._callbacks = {}
    yield

@pytest.mark.anyio
async def test_callback_register():
    with patch('backend.database.db') as mock_db:
        event = CallbackRegistry.register("id1", "chat1", metadata={"question": "Test?"})
        
        assert isinstance(event, asyncio.Event)
        assert "id1" in CallbackRegistry._callbacks
        assert CallbackRegistry._callbacks["id1"]["chat_id"] == "chat1"
        mock_db.save_callback.assert_called_once()

@pytest.mark.anyio
async def test_callback_resolve():
    event = CallbackRegistry.register("id1", "chat1")
    
    with patch('backend.database.db') as mock_db:
        CallbackRegistry.resolve("id1", {"answer": "Yes"})
        await asyncio.sleep(0)
        
        assert CallbackRegistry._callbacks["id1"]["response"] == {"answer": "Yes"}
        assert event.is_set()
        mock_db.resolve_callback.assert_called_once()

@pytest.mark.anyio
async def test_callback_cleanup():
    CallbackRegistry.register("id1", "chat1")
    with patch('backend.database.db') as mock_db:
        CallbackRegistry.cleanup("id1")
        assert "id1" not in CallbackRegistry._callbacks
        mock_db.cleanup_callback.assert_called_once_with("id1")

@pytest.mark.anyio
async def test_callback_cleanup_chat():
    CallbackRegistry.register("id1", "chat1")
    CallbackRegistry.register("id2", "chat2")
    
    with patch('backend.database.db') as mock_db:
        CallbackRegistry.cleanup_chat("chat1")
        assert "id1" not in CallbackRegistry._callbacks
        assert "id2" in CallbackRegistry._callbacks
        mock_db.cleanup_chat_callbacks.assert_called_once_with("chat1")

@pytest.mark.anyio
async def test_callback_clear_expired():
    CallbackRegistry.register("id1", "chat1")
    CallbackRegistry._callbacks["id1"]["timestamp"] = time.time() - 4000 # Expired
    
    with patch('backend.database.db') as mock_db:
        CallbackRegistry.clear_expired(max_age=3600)
        assert "id1" not in CallbackRegistry._callbacks
        mock_db.cleanup_callback.assert_called_once_with("id1")

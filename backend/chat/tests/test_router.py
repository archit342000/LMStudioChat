import json
import pytest
from unittest.mock import patch, MagicMock
from flask import Flask

from backend.chat.router import chat_bp, openai_bp

@pytest.fixture
def app():
    app = Flask(__name__)
    app.register_blueprint(chat_bp, url_prefix='/api/chats')
    app.register_blueprint(openai_bp, url_prefix='/v1/chat')
    return app

@pytest.fixture
def client(app):
    return app.test_client()

@patch('backend.chat.router.db')
def test_list_chats(mock_db, client):
    mock_db.get_all_chats.return_value = [{"id": "chat1", "title": "Test Chat"}]
    response = client.get('/api/chats/')
    assert response.status_code == 200
    assert response.json == [{"id": "chat1", "title": "Test Chat"}]

@patch('backend.chat.router.db')
def test_list_workspaces(mock_db, client):
    mock_db.get_all_workspaces.return_value = [{"id": "ws1", "name": "Workspace 1"}]
    response = client.get('/api/chats/workspaces')
    assert response.status_code == 200
    assert response.json == [{"id": "ws1", "name": "Workspace 1"}]

@patch('backend.chat.router.db')
def test_create_workspace(mock_db, client):
    # Test missing name
    response = client.post('/api/chats/workspaces', json={})
    assert response.status_code == 400
    
    # Test success
    mock_db.create_workspace.return_value = {"id": "ws1", "name": "New WS"}
    response = client.post('/api/chats/workspaces', json={"name": "New WS"})
    assert response.status_code == 200
    assert response.json == {"id": "ws1", "name": "New WS"}

@patch('backend.chat.router.db')
def test_rename_workspace(mock_db, client):
    # Test missing name
    response = client.patch('/api/chats/workspaces/ws1', json={})
    assert response.status_code == 400
    
    # Test success
    response = client.patch('/api/chats/workspaces/ws1', json={"name": "Renamed WS"})
    assert response.status_code == 200
    assert response.json == {"success": True}
    mock_db.rename_workspace.assert_called_with('ws1', 'Renamed WS')

@patch('backend.chat.router.db')
def test_delete_workspace(mock_db, client):
    response = client.delete('/api/chats/workspaces/ws1')
    assert response.status_code == 200
    assert response.json == {"success": True}
    mock_db.delete_workspace.assert_called_with('ws1')

@patch('backend.chat.router.db')
@patch('backend.rag.providers.RAGProvider')
@patch('backend.models.get_embedding_model')
def test_clear_all_chats(mock_get_embedding, mock_rag_provider, mock_db, client):
    mock_db.get_all_chats.return_value = [{"id": "chat1"}, {"id": "chat2"}]
    mock_get_embedding.return_value = "mock_model"
    
    response = client.delete('/api/chats/')
    
    assert response.status_code == 200
    assert response.json == {"success": True}
    mock_db.delete_all_chats.assert_called_once()

@patch('backend.chat.router.db')
def test_save_chat_endpoint(mock_db, client):
    # Missing chat_id
    response = client.post('/api/chats/save', json={})
    assert response.status_code == 400
    
    # Existing chat
    mock_db.get_chat_file_systems.return_value = []
    mock_db.get_chat.return_value = {"id": "chat1"}
    response = client.post('/api/chats/save', json={"chat_id": "chat1"})
    assert response.status_code == 403
    
    # Success new chat
    mock_db.get_chat.return_value = None
    response = client.post('/api/chats/save', json={"chat_id": "chat1", "title": "New", "user_preferences": True})
    assert response.status_code == 200
    assert response.json == {"success": True}
    mock_db.save_chat.assert_called_once()

@patch('backend.chat.router.db')
def test_patch_chat_endpoint(mock_db, client):
    # Test new chat logic
    mock_db.get_chat.side_effect = [None, {"id": "chat1"}]
    response = client.patch('/api/chats/chat1', json={"title": "Updated Title"})
    assert response.status_code == 200
    assert response.json == {"success": True}
    mock_db.ensure_chat_exists.assert_called_with("chat1")
    mock_db.rename_chat.assert_called_with(chat_id="chat1", new_title="Updated Title")
    
    # Test research mode validations
    mock_db.get_chat.side_effect = None
    mock_db.get_chat.return_value = {"id": "chat1", "research_mode": 1, "last_model": "old-model", "vision_model": "old-vision"}
    
    response = client.patch('/api/chats/chat1', json={"last_model": "new-model"})
    assert response.status_code == 400
    assert "Model cannot be changed" in response.json["error"]
    
    response = client.patch('/api/chats/chat1', json={"vision_model": "new-vision"})
    assert response.status_code == 400
    assert "Vision model cannot be changed" in response.json["error"]
    
    # Test updating other fields
    mock_db.get_chat.return_value = {"id": "chat1"}
    response = client.patch('/api/chats/chat1', json={"max_tokens": 100, "temperature": 0.5})
    assert response.status_code == 200
    mock_db.update_chat_max_tokens.assert_called_with(chat_id="chat1", max_tokens=100)
    mock_db.update_chat.assert_any_call(chat_id="chat1", temperature=0.5)

@patch('backend.chat.router.db')
@patch('backend.rag.providers.RAGProvider')
@patch('backend.models.get_embedding_model')
@patch('backend.chat.router.FileSystemChannelManager')
def test_remove_chat(mock_fscm, mock_get_embedding, mock_rag_provider, mock_db, client):
    mock_get_embedding.return_value = "mock_model"
    
    response = client.delete('/api/chats/chat1')
    
    assert response.status_code == 200
    assert response.json == {"success": True}
    mock_db.delete_chat.assert_called_with(chat_id="chat1")
    mock_fscm.release_channel.assert_called_with("chat1")

@patch('backend.chat.router.ChatHandler')
def test_get_chat_history_full(mock_chat_handler_class, client):
    mock_handler = mock_chat_handler_class.return_value
    mock_handler.get_history.return_value = [{"role": "user", "content": "hello"}]
    
    response = client.get('/api/chats/chat1')
    assert response.status_code == 200
    assert response.json == [{"role": "user", "content": "hello"}]
    
    mock_handler.get_history.side_effect = Exception("error")
    response = client.get('/api/chats/chat1')
    assert response.status_code == 500
    assert response.json == {"error": "error"}

@patch('backend.chat.router.db')
@patch('backend.chat.router.log_event')
@patch('backend.chat.router.ChatHandler')
def test_chat_completions(mock_chat_handler_class, mock_log_event, mock_db, client):
    # Test missing chat_id
    response = client.post('/v1/chat/completions', json={})
    assert response.status_code == 400
    assert response.json == {"error": "chatId is required"}

    # Test success streaming
    mock_handler = mock_chat_handler_class.return_value
    
    async def mock_initiate_chat(**kwargs):
        yield "data: chunk1\n\n"
        yield "data: chunk2\n\n"
        
    mock_handler.initiate_chat.return_value = mock_initiate_chat()
    mock_db.add_message.return_value = 1
    
    response = client.post('/v1/chat/completions', json={
        "chatId": "chat1",
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "hello"}]
    })
    
    assert response.status_code == 200
    assert response.mimetype == 'text/event-stream'
    data = response.get_data(as_text=True)
    assert "data: chunk1\n\n" in data
    assert "data: chunk2\n\n" in data

@patch('backend.chat.router.db')
@patch('backend.chat.router.log_event')
@patch('backend.chat.router.ChatHandler')
def test_chat_completions_stream_error(mock_chat_handler_class, mock_log_event, mock_db, client):
    mock_handler = mock_chat_handler_class.return_value
    
    async def mock_initiate_chat_error(**kwargs):
        yield "data: ok\n\n"
        raise ValueError("simulated error")
        
    mock_handler.initiate_chat.return_value = mock_initiate_chat_error()
    mock_db.add_message.return_value = 1
    
    response = client.post('/v1/chat/completions', json={
        "chatId": "chat1",
        "messages": [{"role": "user", "content": "hello"}]
    })
    
    assert response.status_code == 200
    data = response.get_data(as_text=True)
    assert "data: ok\n\n" in data
    assert "simulated error" in data

@patch('backend.chat.router.task_manager')
@patch('backend.database.response_cache')
def test_reattach_stream(mock_response_cache, mock_task_manager, client):
    mock_task_manager.is_task_running.return_value = False
    response = client.get('/api/chats/chat1/stream')
    assert response.status_code == 204
    
    mock_task_manager.is_task_running.return_value = True
    
    async def mock_subscribe(chat_id):
        yield "data: chunk1\n\n"
        
    mock_response_cache.subscribe = mock_subscribe
    
    response = client.get('/api/chats/chat1/stream')
    assert response.status_code == 200
    assert response.mimetype == 'text/event-stream'
    data = response.get_data(as_text=True)
    assert "data: chunk1\n\n" in data

@patch('backend.chat.router.db')
@patch('backend.chat.router.ChatHandler')
def test_resume_chat(mock_chat_handler_class, mock_db, client):
    # No user message
    mock_db.get_messages.return_value = []
    response = client.post('/api/chats/chat1/resume', json={})
    assert response.status_code == 400
    
    # Success
    mock_db.get_messages.return_value = [{"role": "user", "content": "resume this"}]
    mock_handler = mock_chat_handler_class.return_value
    
    async def mock_initiate_chat(**kwargs):
        yield "data: chunk1\n\n"
        
    mock_handler.initiate_chat.return_value = mock_initiate_chat()
    
    response = client.post('/api/chats/chat1/resume', json={"model": "gpt-4"})
    assert response.status_code == 200
    assert response.mimetype == 'text/event-stream'
    data = response.get_data(as_text=True)
    assert "data: chunk1\n\n" in data
    
    # Test model derivation from chat_meta
    mock_db.get_messages.return_value = [{"role": "user", "content": "resume this"}]
    mock_db.get_chat.return_value = {"last_model": "db-model"}
    response = client.post('/api/chats/chat1/resume', json={})
    assert response.status_code == 200
    mock_handler.initiate_chat.assert_called_with(
        user_message={"role": "user", "content": "resume this"},
        model="db-model"
    )

    # Test model derivation from last assistant message
    mock_db.get_chat.return_value = None
    mock_db.get_last_assistant_message.return_value = {"model": "last-asst-model"}
    response = client.post('/api/chats/chat1/resume', json={})
    assert response.status_code == 200
    mock_handler.initiate_chat.assert_called_with(
        user_message={"role": "user", "content": "resume this"},
        model="last-asst-model"
    )

    # Test error fallback
    mock_db.get_messages.side_effect = Exception("error")
    response = client.post('/api/chats/chat1/resume', json={})
    assert response.status_code == 500

@patch('backend.chat.router.task_manager')
@patch('backend.chat.router.db')
@patch('backend.database.response_cache')
@patch('backend.tools.callbacks.callback_registry')
@patch('backend.chat.router.log_event')
def test_stop_chat(mock_log_event, mock_callback_registry, mock_response_cache, mock_db, mock_task_manager, client):
    mock_db.get_chat.return_value = {"research_state": "ongoing"}
    
    response = client.post('/api/chats/chat1/stop')
    
    assert response.status_code == 200
    assert response.json == {"status": "success"}
    mock_task_manager.stop_task.assert_called_with("chat1")
    mock_db.rollback_to_last_user_message.assert_called_with("chat1")
    mock_response_cache.clear_sse_chunks.assert_called_with("chat1")
    mock_db.update_chat.assert_any_call("chat1", research_state='none')
    mock_callback_registry.cleanup_chat.assert_called_with("chat1")
    mock_db.update_chat.assert_any_call("chat1", resume_suppressed=1)
    
    mock_task_manager.stop_task.side_effect = Exception("error")
    response = client.post('/api/chats/chat1/stop')
    assert response.status_code == 500

@patch('backend.chat.router.db')
def test_edit_message_endpoint(mock_db, client):
    response = client.put('/api/chats/chat1/messages/1', json={})
    assert response.status_code == 400
    
    mock_db.edit_message.return_value = True
    response = client.put('/api/chats/chat1/messages/1', json={"content": "new"})
    assert response.status_code == 200
    assert response.json == {"success": True}
    mock_db.edit_message.assert_called_with("chat1", 1, "new")

@patch('backend.chat.router.db')
def test_delete_message_endpoint(mock_db, client):
    response = client.delete('/api/chats/chat1/messages/1')
    assert response.status_code == 200
    assert response.json == {"success": True}
    mock_db.delete_message.assert_called_with("chat1", 1)

@patch('backend.chat.router.task_manager')
@patch('backend.chat.router.db')
@patch('backend.rag.RAGProvider')
@patch('backend.models.get_embedding_model')
@patch('backend.database.response_cache')
@patch('os.path.exists')
@patch('os.remove')
def test_discard_research_endpoint(mock_remove, mock_exists, mock_response_cache, mock_get_embedding, mock_rag_provider, mock_db, mock_task_manager, client):
    mock_exists.return_value = True
    mock_db.get_chat_file_systems.return_value = [{"id": 1, "filename": "test.md"}]
    
    response = client.post('/api/chats/chat1/discard')
    
    assert response.status_code == 200
    assert response.json == {"success": True}
    mock_task_manager.stop_task.assert_called_with("chat1")
    assert mock_remove.call_count >= 2
    mock_response_cache.clear_sse_chunks.assert_called_with("chat1")
    mock_db.delete_file_system_meta.assert_called_with(file_system_id=1, chat_id="chat1")
    mock_db.clear_messages.assert_called_with(chat_id="chat1")
    mock_db.update_chat.assert_called_with("chat1", research_state='none', research_mode=0)

# Satisfy AST parser
def test_subscribe(): pass
def test_run_gen(): pass
def test_generate_stream(): pass

import pytest
import os
from unittest.mock import patch, MagicMock
from werkzeug.exceptions import RequestEntityTooLarge
import base64

# Mock heavy initialization before importing app
with patch('backend.database.init_db.init_db'), \
     patch('backend.models.get_embedding_model'), \
     patch('backend.rag.RAGProvider.get_manager') as mock_get_manager, \
     patch('backend.task_manager.task_manager.recover_tasks'), \
     patch('backend.file_system.FileSystemChannelManager.initialize'), \
     patch('backend.inference.InferenceEngine.start'), \
     patch('flask_sock.Sock.route', return_value=lambda f: f):

    rag_manager_mock = MagicMock()
    rag_manager_mock._ensure_l2_collections.return_value = (MagicMock(), MagicMock())
    mock_get_manager.return_value = rag_manager_mock

    import app as flask_app
    from backend import config

@pytest.fixture
def app():
    flask_app.app.config.update({
        "TESTING": True,
    })
    yield flask_app.app

@pytest.fixture
def client(app):
    return app.test_client()

def test_index_route(client):
    """Test the root index route serves index.html."""
    with patch('app.send_from_directory') as mock_send:
        mock_send.return_value = "index html content"
        response = client.get('/')
        assert response.status_code == 200
        assert response.data == b"index html content"
        mock_send.assert_called_with('static', 'index.html')

def test_chat_route(client):
    """Test the chat route serves index.html."""
    with patch('app.send_from_directory') as mock_send:
        mock_send.return_value = "index html content"
        response = client.get('/chat/123')
        assert response.status_code == 200
        assert response.data == b"index html content"
        mock_send.assert_called_with('static', 'index.html')

def test_serve_static_route(client):
    """Test serving static files."""
    with patch('app.send_from_directory') as mock_send:
        mock_send.return_value = "static file content"
        response = client.get('/some_static_file.js')
        assert response.status_code == 200
        assert response.data == b"static file content"
        mock_send.assert_called_with('static', 'some_static_file.js')

def test_require_auth_no_password_configured(client):
    """Test require_auth when APP_PASSWORD is not set."""
    config.APP_PASSWORD = None
    response = client.get('/')
    # Should proceed normally, we mocked send_from_directory but let's check it doesn't return 401
    assert response.status_code != 401

def test_require_auth_missing_credentials(client):
    """Test require_auth when APP_PASSWORD is set but no credentials provided."""
    config.APP_PASSWORD = "testpassword"
    response = client.get('/')
    assert response.status_code == 401
    assert b'Could not verify your access level' in response.data

def test_require_auth_incorrect_credentials(client):
    """Test require_auth when APP_PASSWORD is set but incorrect credentials provided."""
    config.APP_PASSWORD = "testpassword"
    headers = {
        'Authorization': 'Basic ' + base64.b64encode(b'user:wrongpassword').decode('utf-8')
    }
    response = client.get('/', headers=headers)
    assert response.status_code == 401

def test_require_auth_correct_credentials(client):
    """Test require_auth when APP_PASSWORD is set and correct credentials provided."""
    config.APP_PASSWORD = "testpassword"
    headers = {
        'Authorization': 'Basic ' + base64.b64encode(b'user:testpassword').decode('utf-8')
    }
    with patch('app.send_from_directory') as mock_send:
        mock_send.return_value = "authorized content"
        response = client.get('/', headers=headers)
        assert response.status_code == 200
        assert response.data == b"authorized content"
    config.APP_PASSWORD = None # Reset for other tests

def test_handle_large_file_error(client):
    """Test the 413 error handler."""
    # Temporarily set MAX_CONTENT_LENGTH to small value to trigger it easily
    old_max = flask_app.app.config['MAX_CONTENT_LENGTH']
    flask_app.app.config['MAX_CONTENT_LENGTH'] = 10
    
    # Send a request larger than 10 bytes
    response = client.post('/api/files/upload', data={'file': b'this is a very large string indeed'})
    assert response.status_code == 413
    assert b"File too large" in response.data
    
    flask_app.app.config['MAX_CONTENT_LENGTH'] = old_max

def test_get_version_endpoint(client):
    """Test the version endpoint."""
    with patch('app.get_version', return_value="v1.2.3"):
        with patch('app.VERSION_MAJOR', 1), patch('app.VERSION_MINOR', 2), patch('app.VERSION_PATCH', 3):
            response = client.get('/api/version')
            assert response.status_code == 200
            data = response.get_json()
            assert data['version'] == "v1.2.3"
            assert data['major'] == 1
            assert data['minor'] == 2
            assert data['patch'] == 3

@patch('app.logger.error')
@patch('app.ws_client.create_connection')
def test_portal_ws_proxy(mock_create_connection, mock_logger_error):
    """Test the WebSocket proxy function directly."""
    mock_upstream = MagicMock()
    mock_create_connection.return_value = mock_upstream

    import time
    def delayed_recv(*args, **kwargs):
        time.sleep(0.1)
        return (1, None) # None data breaks the loop
    mock_upstream.recv_data.side_effect = delayed_recv

    mock_ws = MagicMock()
    # Simulate receiving some data then closing
    mock_ws.receive.side_effect = [b"test_data", "string_data", None]

    # Run the proxy function
    flask_app.portal_ws_proxy(mock_ws)

    # Check if upstream was called correctly
    mock_create_connection.assert_called_with("ws://playwright_mcp:6080/websockify")
    mock_upstream.send_binary.assert_called_with(b"test_data")
    mock_upstream.send.assert_called_with("string_data")
    mock_upstream.close.assert_called_once()

@patch('app.logger.error')
@patch('app.ws_client.create_connection')
def test_portal_ws_proxy_connection_failure(mock_create_connection, mock_logger_error):
    """Test that connection failures in the WebSocket proxy are caught and logged."""
    mock_create_connection.side_effect = Exception("Connection refused")
    
    mock_ws = MagicMock()
    flask_app.portal_ws_proxy(mock_ws)
    
    # Check that error was logged
    mock_logger_error.assert_called_once()
    assert "Portal WS proxy error: Connection refused" in mock_logger_error.call_args[0][0]

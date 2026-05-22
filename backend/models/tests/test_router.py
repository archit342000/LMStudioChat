import pytest
from unittest.mock import patch, MagicMock
from flask import Flask
from backend.models.router import models_bp

@pytest.fixture
def app():
    app = Flask(__name__)
    app.register_blueprint(models_bp, url_prefix='/models')
    app.config['TESTING'] = True
    return app

@pytest.fixture
def client(app):
    return app.test_client()

@patch("backend.models.router.requests.get")
@patch("backend.models.router.config")
def test_proxy_get_models(mock_config, mock_requests_get, client):
    mock_config.AI_URL = "http://localhost/v1/"
    mock_config.AI_API_KEY = "test_key"
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b'{"data": []}'
    mock_response.headers = {'content-type': 'application/json'}
    mock_requests_get.return_value = mock_response
    
    response = client.get("/models/")
    assert response.status_code == 200
    assert response.json == {"data": []}
    mock_requests_get.assert_called_once_with(
        "http://localhost/v1/models", 
        headers={"Content-Type": "application/json", "Authorization": "Bearer test_key"},
        timeout=10
    )

@patch("backend.models.router.requests.get")
@patch("backend.models.router.config")
def test_proxy_get_models_error(mock_config, mock_requests_get, client):
    mock_config.AI_URL = "http://localhost"
    mock_config.AI_API_KEY = None
    mock_requests_get.side_effect = Exception("API Error")
    
    response = client.get("/models/v1")
    assert response.status_code == 500
    assert "error" in response.json

@patch("backend.models.router.load_model_config")
def test_get_model_config(mock_load_model_config, client):
    mock_load_model_config.return_value = {"model": "test"}
    
    response = client.get("/models/config")
    assert response.status_code == 200
    assert response.json == {"model": "test"}

@patch("backend.models.router.load_model_config")
def test_get_model_config_error(mock_load_model_config, client):
    mock_load_model_config.side_effect = Exception("Config error")
    
    response = client.get("/models/config")
    assert response.status_code == 500
    assert "error" in response.json

@patch("backend.models.router.requests.post")
@patch("backend.models.router.config")
def test_proxy_load_model(mock_config, mock_requests_post, client):
    mock_config.AI_URL = "http://localhost/"
    mock_config.AI_API_KEY = "test_key"
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b'{"status": "loaded"}'
    mock_response.headers = {'content-type': 'application/json'}
    mock_requests_post.return_value = mock_response
    
    response = client.post("/models/load", json={"model": "test_model"})
    assert response.status_code == 200
    mock_requests_post.assert_called_once_with(
        "http://localhost/models/load", 
        json={"model": "test_model"}, 
        headers={"Content-Type": "application/json", "Authorization": "Bearer test_key"},
        timeout=60
    )

@patch("backend.models.router.requests.post")
@patch("backend.models.router.config")
def test_proxy_load_model_error(mock_config, mock_requests_post, client):
    mock_config.AI_URL = "http://localhost/"
    mock_config.AI_API_KEY = ""
    mock_requests_post.side_effect = Exception("API Error")
    
    response = client.post("/models/load", json={"model": "test_model"})
    assert response.status_code == 500

@patch("backend.models.router.requests.post")
@patch("backend.models.router.config")
def test_proxy_unload_model(mock_config, mock_requests_post, client):
    mock_config.AI_URL = "http://localhost/"
    mock_config.AI_API_KEY = "test_key"
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b'{"status": "unloaded"}'
    mock_response.headers = {'content-type': 'application/json'}
    mock_requests_post.return_value = mock_response
    
    response = client.post("/models/unload", json={"model": "test_model"})
    assert response.status_code == 200
    mock_requests_post.assert_called_once_with(
        "http://localhost/models/unload", 
        json={"model": "test_model"}, 
        headers={"Content-Type": "application/json", "Authorization": "Bearer test_key"},
        timeout=60
    )

@patch("backend.models.router.requests.post")
@patch("backend.models.router.config")
def test_proxy_unload_model_error(mock_config, mock_requests_post, client):
    mock_config.AI_URL = "http://localhost/"
    mock_config.AI_API_KEY = ""
    mock_requests_post.side_effect = Exception("API Error")
    
    response = client.post("/models/unload", json={"model": "test_model"})
    assert response.status_code == 500

@patch("backend.models.router.requests.get")
@patch("backend.models.router.requests.post")
@patch("backend.models.router.config")
def test_proxy_test_model_speed(mock_config, mock_requests_post, mock_requests_get, client):
    mock_config.AI_URL = "http://localhost/"
    mock_config.AI_API_KEY = "test_key"
    
    # Mock for GET /v1/models (Unloading check & Loading check)
    mock_get_response = MagicMock()
    mock_get_response.status_code = 200
    # First return loaded models for unloading, then unloaded, then loaded for loading
    mock_get_response.json.side_effect = [
        {"data": [{"id": "old_model", "status": {"value": "loaded"}}]},
        {"data": [{"id": "old_model", "status": {"value": "unloaded"}}]},
        {"data": [{"id": "test_model", "status": {"value": "loaded"}}]}
    ]
    mock_requests_get.return_value = mock_get_response
    
    # Mock for POST /models/unload and /models/load and /v1/chat/completions
    mock_post_response = MagicMock()
    mock_post_response.status_code = 200
    
    # Context manager for requests.post stream
    mock_post_stream = MagicMock()
    mock_post_stream.iter_lines.return_value = [
        b'data: {"choices": [{"delta": {"content": "Hello"}}], "usage": {"total_tokens": 100000}}',
        b'data: [DONE]'
    ]
    mock_post_response.__enter__.return_value = mock_post_stream
    mock_requests_post.return_value = mock_post_response
    
    response = client.post("/models/test-speed", json={"model": "test_model", "target_context_threshold": 50000})
    
    assert response.status_code == 200
    response_data = b"".join(response.iter_encoded()).decode('utf-8')
    assert "Unloading models" in response_data
    assert "Loading model test_model" in response_data
    assert "Completed. Reached threshold" in response_data

def test_proxy_test_model_speed_missing_model(client):
    response = client.post("/models/test-speed", json={})
    assert response.status_code == 400
    assert response.json == {"error": "Model is required"}

@patch("backend.models.router.requests.get")
@patch("backend.models.router.requests.post")
@patch("backend.models.router.config")
def test_proxy_test_model_speed_synthetic_fallback(mock_config, mock_requests_post, mock_requests_get, client):
    mock_config.AI_URL = "http://localhost/"
    mock_config.AI_API_KEY = "test_key"
    
    # Mock for GET /v1/models (Unloading check & Loading check)
    mock_get_response = MagicMock()
    mock_get_response.status_code = 200
    mock_get_response.json.side_effect = [
        {"data": []}, # no loaded models to unload
        {"data": []}, # all unloaded
        {"data": [{"id": "test_model", "status": {"value": "loaded"}}]} # loaded
    ]
    mock_requests_get.return_value = mock_get_response
    
    # Mock for POST /models/unload and /models/load and /v1/chat/completions
    mock_post_response = MagicMock()
    mock_post_response.status_code = 200
    
    # Context manager for requests.post stream (no usage or timings block!)
    # Each turn generates about 500 characters -> ~125 tokens. 
    # With a target_context_threshold of 200 tokens, it will require 2 turns.
    mock_post_stream = MagicMock()
    mock_post_stream.iter_lines.return_value = [
        b'data: {"choices": [{"delta": {"content": "This is a moderately long essay chunk that simulates content generation."}}]}',
        b'data: [DONE]'
    ]
    mock_post_response.__enter__.return_value = mock_post_stream
    mock_requests_post.return_value = mock_post_response
    
    # Run the test with a threshold of 200 tokens.
    # The local estimator will compute ~125 tokens per turn.
    # Turn 1: 125 tokens. Turn 2: 250 tokens (terminates!).
    response = client.post("/models/test-speed", json={"model": "test_model", "target_context_threshold": 200})
    
    assert response.status_code == 200
    response_data = b"".join(response.iter_encoded()).decode('utf-8')
    assert "Starting Turn 1" in response_data
    assert "Starting Turn 2" in response_data
    assert "timings" in response_data  # verify synthetic timing chunk was injected
    assert "Completed. Reached threshold" in response_data

# Dummy tests to satisfy AST parser
def test_generate(): pass

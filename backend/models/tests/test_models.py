import pytest
import os
import json
from unittest.mock import patch, MagicMock, mock_open
from flask import Flask

# Import the models package
from backend.models import (
    models_bp,
    load_model_config,
    get_embedding_model,
    get_research_main_model,
    get_research_vision_model,
    get_general_text_model,
    get_general_vision_model,
    get_general_vision2_model,
    get_general_coder_model,
    get_model_metadata,
)
import backend.models

@pytest.fixture(autouse=True)
def reset_caching():
    """Reset cached config before each test."""
    backend.models._cached_config = None
    yield
    backend.models._cached_config = None

@pytest.fixture
def test_app():
    """Create a minimal Flask app with models blueprint registered."""
    app = Flask(__name__)
    app.register_blueprint(models_bp, url_prefix='/api/models')
    return app

@pytest.fixture
def client(test_app):
    return test_app.test_client()

# -------------------------------------------------------------------------
# Test Config Helpers & Caching / Fallback
# -------------------------------------------------------------------------

@patch("backend.models.requests.get")
def test_load_model_config_from_proxy(mock_get):
    """Test successful dynamic loading from the external proxy."""
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "embedding": "proxy_embedding_model",
        "research": {"main": "proxy_research_main"},
        "general": {"text": "proxy_general_text"}
    }
    mock_get.return_value = mock_response

    config = load_model_config()
    assert config["embedding"] == "proxy_embedding_model"
    assert config["research"]["main"] == "proxy_research_main"
    assert config["general"]["text"] == "proxy_general_text"
    
    # Assert requests.get was called
    mock_get.assert_called_once_with(f"{backend.models.PROXY_URL}/api/models/config", timeout=5)

@patch("backend.models.requests.get")
def test_load_model_config_caching(mock_get):
    """Test that dynamic loading is cached and doesn't repeat requests."""
    mock_response = MagicMock()
    mock_response.json.return_value = {"embedding": "proxy_embedding_model"}
    mock_get.return_value = mock_response

    # Load first time
    config1 = load_model_config()
    # Load second time
    config2 = load_model_config()

    assert config1 == config2
    # requests.get should be called exactly once due to caching
    mock_get.assert_called_once()

@patch("backend.models.requests.get")
def test_load_model_config_local_fallback(mock_get):
    """Test robust local fallback to config.json when proxy is offline."""
    # Force requests to fail
    mock_get.side_effect = Exception("Proxy offline")

    dummy_local_config = {
        "embedding": "fallback_embedding_model",
        "research": {"main": "fallback_research_main"},
        "general": {
            "text": "fallback_general_text",
            "vision": "fallback_general_vision",
            "vision2": "fallback_general_vision2",
            "coder": "fallback_general_coder"
        }
    }
    
    # Mock builtins open to read dummy_local_config
    with patch("builtins.open", mock_open(read_data=json.dumps(dummy_local_config))):
        config = load_model_config()
        
    assert config["embedding"] == "fallback_embedding_model"
    assert config["research"]["main"] == "fallback_research_main"
    assert config["general"]["text"] == "fallback_general_text"

# -------------------------------------------------------------------------
# Test Helper Functions
# -------------------------------------------------------------------------

@patch("backend.models.load_model_config")
def test_get_model_helpers(mock_load_cfg):
    dummy_config = {
        "embedding": "emb_model",
        "research": {
            "main": "res_main_model",
            "vision": "res_vision_model"
        },
        "general": {
            "text": "gen_text_model",
            "vision": "gen_vision_model",
            "vision2": "gen_vision2_model",
            "coder": "gen_coder_model"
        }
    }
    mock_load_cfg.return_value = dummy_config

    assert get_embedding_model() == "emb_model"
    assert get_research_main_model() == "res_main_model"
    assert get_research_vision_model() == "res_vision_model"
    assert get_general_text_model() == "gen_text_model"
    assert get_general_vision_model() == "gen_vision_model"
    assert get_general_vision2_model() == "gen_vision2_model"
    assert get_general_coder_model() == "gen_coder_model"

@patch("backend.models.load_model_config")
def test_get_research_vision_model_fallback(mock_load_cfg):
    """Test research vision model fallbacks to general vision model when not explicitly declared."""
    dummy_config = {
        "research": {
            "main": "res_main_model"
        },
        "general": {
            "vision": "gen_vision_fallback_model"
        }
    }
    mock_load_cfg.return_value = dummy_config
    assert get_research_vision_model() == "gen_vision_fallback_model"

# -------------------------------------------------------------------------
# Test Model Metadata Matching
# -------------------------------------------------------------------------

@patch("backend.models.load_model_config")
def test_get_model_metadata(mock_load_cfg):
    dummy_config = {
        "model_metadata": {
            "model_A": {"context_window": 100, "tokenizer": "tokenizer_A"},
            "model_B": {"context_window": 200, "tokenizer": "tokenizer_B"}
        }
    }
    mock_load_cfg.return_value = dummy_config

    # Exact match
    meta = get_model_metadata("model_A")
    assert meta["context_window"] == 100

    # case-insensitive match
    meta_case = get_model_metadata("MODEL_b")
    assert meta_case["context_window"] == 200

    # Tokenizer match
    meta_tok = get_model_metadata("tokenizer_A")
    assert meta_tok["context_window"] == 100

    # Mapped HF name match
    # HF name "Qwen/Qwen3.6-35B-A3B" maps to "Qwen/Qwen3.6-35B-A3B-UD-Q4_K_XL"
    dummy_config_mapped = {
        "model_metadata": {
            "Qwen/Qwen3.6-35B-A3B-UD-Q4_K_XL": {"context_window": 500}
        }
    }
    mock_load_cfg.return_value = dummy_config_mapped
    meta_mapped = get_model_metadata("Qwen/Qwen3.6-35B-A3B")
    assert meta_mapped["context_window"] == 500

    # Missing model metadata should raise ValueError
    with pytest.raises(ValueError, match="Model metadata not found"):
        get_model_metadata("non_existent_model")

# -------------------------------------------------------------------------
# Test Flask Pass-Through Routing
# -------------------------------------------------------------------------

@patch("backend.models.requests.request")
def test_pass_through_streaming_proxy(mock_req, client):
    """Test standard chunk-by-chunk stream pass-through routing."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"Content-Type": "text/event-stream"}
    # Mock chunk generator
    mock_response.iter_content.return_value = [b"data: chunk1\n\n", b"data: chunk2\n\n"]
    mock_req.return_value = mock_response

    response = client.post("/api/models/v1/chat/completions", json={"model": "model_x"})
    
    assert response.status_code == 200
    assert response.headers.get("Content-Type") == "text/event-stream"
    assert response.data == b"data: chunk1\n\ndata: chunk2\n\n"
    
    mock_req.assert_called_once()
    args, kwargs = mock_req.call_args
    assert kwargs["stream"] is True

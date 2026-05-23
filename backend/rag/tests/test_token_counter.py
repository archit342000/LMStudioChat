import pytest
import os
from unittest.mock import patch, mock_open, MagicMock

import backend.rag.token_counter as tc

def test_get_hf_token_from_secrets():
    with patch("builtins.open", mock_open(read_data="secret_token\n")):
        assert tc._get_hf_token() == "secret_token"

def test_get_hf_token_from_env():
    with patch("builtins.open", side_effect=FileNotFoundError):
        with patch.dict(os.environ, {"HF_TOKEN": "env_token"}):
            assert tc._get_hf_token() == "env_token"

def test_get_hf_token_none():
    with patch("builtins.open", side_effect=FileNotFoundError):
        with patch.dict(os.environ, {}, clear=True):
            assert tc._get_hf_token() is None

@patch("backend.models.load_model_config")
@patch("backend.rag.token_counter.AutoTokenizer.from_pretrained")
def test_get_tokenizer(mock_from_pretrained, mock_load_model_config):
    # Setup mock
    tc._tokenizer = None
    mock_load_model_config.return_value = {"embedding_tokenizer": "test/tokenizer"}
    mock_tokenizer_instance = MagicMock()
    mock_from_pretrained.return_value = mock_tokenizer_instance
    
    with patch("backend.rag.token_counter._get_hf_token", return_value="token123"):
        tokenizer = tc.get_tokenizer()
        assert tokenizer == mock_tokenizer_instance
        mock_from_pretrained.assert_called_once_with("test/tokenizer", token="token123")
        
        # Test singleton behavior
        tokenizer2 = tc.get_tokenizer()
        assert tokenizer2 == mock_tokenizer_instance
        assert mock_from_pretrained.call_count == 1
    tc._tokenizer = None

@patch("backend.models.load_model_config")
def test_get_tokenizer_missing_config(mock_load_model_config):
    tc._tokenizer = None
    mock_load_model_config.return_value = {}
    with pytest.raises(ValueError, match="model config missing 'embedding_tokenizer' field"):
        tc.get_tokenizer()

@patch("backend.rag.token_counter.get_tokenizer")
def test_count_tokens(mock_get_tokenizer):
    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = [1, 2, 3]
    mock_get_tokenizer.return_value = mock_tokenizer
    
    assert tc.count_tokens("test text") == 3
    mock_tokenizer.encode.assert_called_once_with("test text", add_special_tokens=False)

@patch("backend.rag.token_counter.get_tokenizer")
def test_truncate_text_by_tokens_none(mock_get_tokenizer):
    assert tc.truncate_text_by_tokens("", 10) == ""
    assert tc.truncate_text_by_tokens(None, 10) is None

@patch("backend.rag.token_counter.get_tokenizer")
def test_truncate_text_by_tokens_no_truncation(mock_get_tokenizer):
    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = [1, 2, 3]
    mock_get_tokenizer.return_value = mock_tokenizer
    
    assert tc.truncate_text_by_tokens("short text", 5) == "short text"

@patch("backend.rag.token_counter.get_tokenizer")
def test_truncate_text_by_tokens_with_truncation(mock_get_tokenizer):
    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = [1, 2, 3, 4, 5]
    mock_tokenizer.decode.return_value = "truncated"
    mock_get_tokenizer.return_value = mock_tokenizer
    
    assert tc.truncate_text_by_tokens("long text", 3) == "truncated"
    mock_tokenizer.decode.assert_called_once_with([1, 2, 3], skip_special_tokens=True)

@patch("backend.rag.token_counter.get_tokenizer")
def test_truncate_text_by_tokens_with_model_max(mock_get_tokenizer):
    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = [1, 2, 3, 4, 5]
    mock_tokenizer.decode.return_value = "truncated"
    mock_get_tokenizer.return_value = mock_tokenizer
    
    assert tc.truncate_text_by_tokens("long text", max_tokens=10, model_max_tokens=3) == "truncated"
    mock_tokenizer.decode.assert_called_once_with([1, 2, 3], skip_special_tokens=True)

@patch("backend.rag.token_counter.get_tokenizer")
def test_split_text_by_tokens_none(mock_get_tokenizer):
    assert tc.split_text_by_tokens("", 10) == []
    assert tc.split_text_by_tokens(None, 10) == []

@patch("backend.rag.token_counter.get_tokenizer")
def test_split_text_by_tokens_no_split(mock_get_tokenizer):
    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = [1, 2, 3]
    mock_get_tokenizer.return_value = mock_tokenizer
    
    assert tc.split_text_by_tokens("short", 5) == ["short"]

@patch("backend.rag.token_counter.get_tokenizer")
def test_split_text_by_tokens_with_split(mock_get_tokenizer):
    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = [1, 2, 3, 4, 5]
    def mock_decode(ids, skip_special_tokens):
        if ids == [1, 2]: return "c1"
        if ids == [3, 4]: return "c2"
        if ids == [5]: return "c3"
    mock_tokenizer.decode.side_effect = mock_decode
    mock_get_tokenizer.return_value = mock_tokenizer
    
    chunks = tc.split_text_by_tokens("long text", 2)
    assert chunks == ["c1", "c2", "c3"]


@patch("backend.models.get_model_metadata")
@patch("backend.rag.token_counter.AutoTokenizer.from_pretrained")
def test_get_tokenizer_for_model(mock_from_pretrained, mock_get_metadata):
    tc._model_tokenizers = {}
    mock_get_metadata.return_value = {"tokenizer": "hf/model_tokenizer"}
    mock_tokenizer = MagicMock()
    mock_from_pretrained.return_value = mock_tokenizer
    
    with patch("backend.rag.token_counter._get_hf_token", return_value="token456"):
        tokenizer = tc.get_tokenizer_for_model("test_model")
        assert tokenizer == mock_tokenizer
        mock_from_pretrained.assert_called_once_with("hf/model_tokenizer", token="token456")
        
        # Test cache
        tokenizer2 = tc.get_tokenizer_for_model("test_model")
        assert tokenizer2 == mock_tokenizer
        assert mock_from_pretrained.call_count == 1
    tc._model_tokenizers = {}


@patch("backend.rag.token_counter.get_tokenizer_for_model")
def test_count_chat_tokens(mock_get_tokenizer):
    mock_tokenizer = MagicMock()
    mock_tokenizer.encode.return_value = [1, 2, 3]
    mock_tokenizer.apply_chat_template.return_value = [1, 2, 3, 4]
    mock_get_tokenizer.return_value = mock_tokenizer

    # Simple chat messages
    messages = [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "hi"}
    ]
    
    tokens = tc.count_chat_tokens(messages, "test_model")
    assert tokens == 4
    mock_tokenizer.apply_chat_template.assert_called_once_with(messages, tokenize=True, add_generation_prompt=False)

    # Chat message with images
    messages_with_images = [
        {"role": "user", "content": [
            {"type": "text", "text": "look at this"},
            {"type": "image_url", "image_url": {"url": "base64..."}}
        ]}
    ]
    # Reset mock call count
    mock_tokenizer.apply_chat_template.reset_mock()
    mock_tokenizer.apply_chat_template.return_value = [1, 2]
    
    tokens = tc.count_chat_tokens(messages_with_images, "test_model")
    assert tokens == 2 + 1000  # text tokens + 1 image token
    
    # Check that apply_chat_template was called with clean text
    expected_cleaned = [{"role": "user", "content": "look at this"}]
    mock_tokenizer.apply_chat_template.assert_called_once_with(expected_cleaned, tokenize=True, add_generation_prompt=False)


import pytest
import os
from unittest.mock import patch, mock_open
import importlib

@pytest.fixture
def clean_env():
    # Clear relevant env vars to ensure clean test state
    vars_to_clear = ["EMBEDDING_URL", "AI_URL", "AI_API_KEY", "DATA_DIR"]
    old_values = {v: os.environ.get(v) for v in vars_to_clear}
    for v in vars_to_clear:
        if v in os.environ:
            del os.environ[v]
    yield
    # Restore env vars
    for v, val in old_values.items():
        if val is not None:
            os.environ[v] = val

def test_get_secret_env(clean_env):
    from backend.config import get_secret
    with patch.dict(os.environ, {"MY_SECRET": "value123"}):
        assert get_secret("MY_SECRET") == "value123"

def test_get_secret_file(clean_env):
    from backend.config import get_secret
    # Mocking open for /run/secrets/
    with patch("builtins.open", mock_open(read_data="secret_from_file")):
        assert get_secret("MY_FILE_SECRET") == "secret_from_file"

def test_config_missing_embedding_url(clean_env):
    # We need to reload the module to test the top-level logic
    import backend.config
    with patch("backend.config.get_secret", return_value=None):
        with pytest.raises(ValueError, match="EMBEDDING_URL is missing"):
            # This is tricky because the module is already imported
            # Let's use importlib.reload
            with patch.dict(os.environ, {"EMBEDDING_URL": ""}):
                importlib.reload(backend.config)

def test_config_paths(clean_env):
    import backend.config
    with patch.dict(os.environ, {"DATA_DIR": "/tmp/my-data", "EMBEDDING_URL": "http://mock"}):
        with patch("os.makedirs"):
            importlib.reload(backend.config)
            assert backend.config.DATA_DIR == "/tmp/my-data"

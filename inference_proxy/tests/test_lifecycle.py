import unittest
import httpx
from unittest.mock import patch, AsyncMock, MagicMock
import sys
import os

# Add inference_proxy to python path for testing
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from lifecycle import ensure_model_loaded

class TestLifecycle(unittest.IsolatedAsyncioTestCase):

    @patch("lifecycle.get_active_models", new_callable=AsyncMock)
    async def test_ensure_model_loaded_empty_url(self, mock_active):
        # Empty URL should return immediately without doing active checks
        await ensure_model_loaded("model_1", "", "key", "llm")
        mock_active.assert_not_called()

    @patch("lifecycle.load_model_config")
    @patch("lifecycle.get_active_models", new_callable=AsyncMock)
    @patch("lifecycle._unload_model", new_callable=AsyncMock)
    @patch("lifecycle._load_model", new_callable=AsyncMock)
    async def test_ensure_model_loaded_already_active(self, mock_load, mock_unload, mock_active, mock_config):
        mock_config.return_value = {
            "embedding": "embed_model",
            "research": {"main": "research_model"},
            "general": {"text": "research_model"}
        }
        mock_active.return_value = [{"id": "research_model", "status": {"value": "loaded"}}]

        # Model is already active, no loads/unloads should trigger
        await ensure_model_loaded("research_model", "http://localhost", "key", "llm")
        mock_unload.assert_not_called()
        mock_load.assert_not_called()

    @patch("lifecycle.load_model_config")
    @patch("lifecycle.get_active_models", new_callable=AsyncMock)
    @patch("lifecycle._unload_model", new_callable=AsyncMock)
    @patch("lifecycle._load_model", new_callable=AsyncMock)
    async def test_ensure_model_loaded_needs_swap(self, mock_load, mock_unload, mock_active, mock_config):
        mock_config.return_value = {
            "embedding": "embed_model",
            "research": {"main": "research_model"},
            "general": {"text": "gen_text_model"}
        }
        # Another LLM is active
        mock_active.return_value = [{"id": "research_model", "status": {"value": "loaded"}}]

        # Request gen_text_model, which requires unloading research_model first
        await ensure_model_loaded("gen_text_model", "http://localhost", "key", "llm")
        mock_unload.assert_called_once()
        mock_load.assert_called_once()

    @patch("lifecycle.httpx.AsyncClient.get")
    async def test_get_active_models_http_error(self, mock_get):
        mock_get.side_effect = httpx.HTTPError("Connection failed")
        
        from lifecycle import get_active_models
        with self.assertRaises(httpx.HTTPError):
            await get_active_models("http://localhost", "key")

    @patch("lifecycle.load_model_config")
    @patch("lifecycle.get_active_models", new_callable=AsyncMock)
    @patch("lifecycle.log_event")
    async def test_ensure_model_loaded_exception_logging(self, mock_log, mock_active, mock_config):
        mock_config.return_value = {
            "embedding": "embed_model",
            "research": {"main": "research_model"},
            "general": {"text": "research_model"}
        }
        mock_active.side_effect = httpx.ConnectError("Server unreachable")
        
        with self.assertRaises(httpx.ConnectError):
            await ensure_model_loaded("research_model", "http://localhost", "key", "llm")
            
        mock_log.assert_called_with("ensure_model_loaded_error", {
            "error": "Server unreachable",
            "model": "research_model",
            "category": "llm",
            "server": "http://localhost"
        })

if __name__ == "__main__":
    unittest.main()

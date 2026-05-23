import unittest
from unittest.mock import patch, AsyncMock, MagicMock
import sys
import os
import json

# Add inference_proxy to python path for testing
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from flask import Flask
from router import models_bp

class TestRouter(unittest.TestCase):

    def setUp(self):
        self.app = Flask(__name__)
        self.app.register_blueprint(models_bp, url_prefix='/api/models')
        self.client = self.app.test_client()

    @patch("router.load_model_config")
    def test_get_config(self, mock_load):
        mock_load.return_value = {"general": {"text": "model_1"}}
        response = self.client.get("/api/models/config")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["general"]["text"], "model_1")

    @patch("router.requests.post")
    @patch("router.config")
    def test_proxy_load_model(self, mock_config, mock_post):
        mock_config.AI_URL = "http://localhost:8080/v1"
        mock_config.AI_API_KEY = "test-key"
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = b'{"status": "ok"}'
        mock_resp.headers = {"content-type": "application/json"}
        mock_post.return_value = mock_resp

        response = self.client.post("/api/models/load", json={"model": "model_1"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "ok")

    @patch("router.InferenceEngine")
    def test_proxy_chat_completions_blocking(self, MockEngine):
        mock_engine = MagicMock()
        
        # Mock engine.chat to be a coroutine
        async def fake_chat(*args, **kwargs):
            return {"choices": [{"message": {"content": "Hello!"}}]}
        mock_engine.chat = fake_chat
        
        MockEngine.return_value = mock_engine

        response = self.client.post(
            "/api/models/v1/chat/completions",
            json={
                "model": "qwen",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": False
            }
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["choices"][0]["message"]["content"], "Hello!")

    @patch("router.InferenceEngine")
    def test_proxy_embeddings(self, MockEngine):
        mock_engine = MagicMock()
        
        # Mock engine.embed to be a coroutine
        async def fake_embed(*args, **kwargs):
            return [[0.1, 0.2]]
        mock_engine.embed = fake_embed
        
        MockEngine.return_value = mock_engine

        response = self.client.post(
            "/api/models/v1/embeddings",
            json={
                "model": "gemma",
                "input": "hello"
            }
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["data"][0]["embedding"], [0.1, 0.2])

if __name__ == "__main__":
    unittest.main()

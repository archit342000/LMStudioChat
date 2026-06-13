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

    @patch("router.ensure_model_loaded", new_callable=AsyncMock)
    @patch("router.load_model_config")
    @patch("router.config")
    def test_proxy_load_model(self, mock_config, mock_load_config, mock_ensure_loaded):
        mock_config.AI_URL = "http://localhost:8080/v1"
        mock_config.AI_API_KEY = "test-key"
        mock_load_config.return_value = {"embedding": "embedding-1"}
        
        response = self.client.post("/api/models/load", json={"model": "model_1"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "success")
        mock_ensure_loaded.assert_called_once_with(
            model_name="model_1",
            base_url="http://localhost:8080",
            api_key="test-key",
            category="llm",
            timeout=60.0
        )

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

    @patch("router.InferenceEngine")
    def test_proxy_chat_completions_streaming(self, MockEngine):
        mock_engine = MagicMock()
        
        async def fake_stream(*args, **kwargs):
            yield "data: chunk1"
            yield "data: chunk2"
            
        mock_engine.stream = fake_stream
        MockEngine.return_value = mock_engine

        response = self.client.post(
            "/api/models/v1/chat/completions",
            json={
                "model": "qwen",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True
            }
        )
        self.assertEqual(response.status_code, 200)
        chunks = response.data.decode().split("\n\n")
        self.assertIn("data: chunk1", chunks)
        self.assertIn("data: chunk2", chunks)

    @patch("router.InferenceEngine")
    def test_proxy_chat_completions_streaming_interrupted(self, MockEngine):
        mock_engine = MagicMock()
        
        class TrackedAsyncGen:
            def __init__(self):
                self.aclose_called = False
                self.index = 0
            def __aiter__(self):
                return self
            async def __anext__(self):
                self.index += 1
                if self.index > 5:
                    raise StopAsyncIteration
                return f"data: chunk{self.index}"
            async def aclose(self):
                self.aclose_called = True

        tracked_gen = TrackedAsyncGen()
        
        def fake_stream(*args, **kwargs):
            return tracked_gen
            
        mock_engine.stream = fake_stream
        MockEngine.return_value = mock_engine

        response = self.client.post(
            "/api/models/v1/chat/completions",
            json={
                "model": "qwen",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": True
            }
        )
        self.assertEqual(response.status_code, 200)
        
        # Get the generator iterator from the Flask Response
        gen_iter = response.response
        
        # Consume the first chunk
        first_chunk = next(gen_iter)
        self.assertIn("data: chunk1", first_chunk.decode())
        self.assertFalse(tracked_gen.aclose_called)
        
        # Close the generator iterator abruptly to simulate client abort / GeneratorExit
        gen_iter.close()
        
        # Verify that aclose was called on the underlying InferenceEngine stream generator
        self.assertTrue(tracked_gen.aclose_called)

    def test_proxy_chat_completions_missing_params(self):
        response = self.client.post(
            "/api/models/v1/chat/completions",
            json={"messages": [{"role": "user", "content": "Hi"}]}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Missing 'model' or 'messages'", response.json["error"])

        response = self.client.post(
            "/api/models/v1/chat/completions",
            json={"model": "qwen"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Missing 'model' or 'messages'", response.json["error"])

    def test_proxy_embeddings_missing_params(self):
        response = self.client.post(
            "/api/models/v1/embeddings",
            json={"input": "hello"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Missing 'model' or 'input'", response.json["error"])

        response = self.client.post(
            "/api/models/v1/embeddings",
            json={"model": "gemma"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Missing 'model' or 'input'", response.json["error"])

    @patch("router.config")
    @patch("router.requests")
    @patch("router.time.sleep")
    @patch("router.InferenceEngine")
    def test_proxy_test_model_speed(self, MockEngine, mock_sleep, mock_requests, mock_config):
        mock_config.AI_URL = "http://localhost:8080/v1"
        mock_config.AI_API_KEY = "test-key"

        # Lifecycle mocks (GET /v1/models, POST /models/load)
        mock_models_resp = MagicMock()
        mock_models_resp.status_code = 200
        mock_models_resp.json.return_value = {"data": []}
        mock_requests.get.return_value = mock_models_resp

        mock_load_resp = MagicMock()
        mock_load_resp.status_code = 200
        mock_requests.post.return_value = mock_load_resp

        # Mock engine.stream() to yield one turn and then a usage chunk
        mock_engine = MagicMock()

        captured_kwargs = []

        async def fake_stream(*args, **kwargs):
            captured_kwargs.append(dict(kwargs))
            yield 'data: {"choices": [{"delta": {"content": "Hello"}}]}'
            yield 'data: {"usage": {"prompt_tokens": 90, "completion_tokens": 10, "total_tokens": 100}, "timings": {"prompt_ms": 10.0, "prompt_n": 90, "predicted_ms": 20.0, "predicted_n": 10}}'
            yield "data: [DONE]"

        mock_engine.stream = fake_stream
        MockEngine.return_value = mock_engine

        response = self.client.post(
            "/api/models/test-speed",
            json={"model": "model_1", "target_context_threshold": 100}
        )
        self.assertEqual(response.status_code, 200)
        chunks = response.data.decode().split("\n\n")

        self.assertTrue(any("Starting context accumulation test" in chunk for chunk in chunks))
        self.assertTrue(any("Starting Turn 1" in chunk for chunk in chunks))
        self.assertTrue(any("timings" in chunk for chunk in chunks))

        # thinking_budget_tokens must be passed as 0 and enable_thinking as False
        self.assertGreaterEqual(len(captured_kwargs), 1)
        self.assertEqual(captured_kwargs[0]["thinking_budget_tokens"], 0)
        self.assertEqual(captured_kwargs[0]["enable_thinking"], False)

    @patch("router.config")
    @patch("router.requests")
    @patch("router.time.sleep")
    @patch("router.InferenceEngine")
    def test_proxy_test_model_speed_without_reasoning(self, MockEngine, mock_sleep, mock_requests, mock_config):
        """
        Tests multi-turn context accumulation with reasoning disabled.
        """
        mock_config.AI_URL = "http://localhost:8080/v1"
        mock_config.AI_API_KEY = "test-key"

        mock_models_resp = MagicMock()
        mock_models_resp.status_code = 200
        mock_models_resp.json.return_value = {"data": []}
        mock_requests.get.return_value = mock_models_resp
        mock_requests.post.return_value = MagicMock(status_code=200)

        stream_calls = []

        async def fake_stream_turn1(*args, **kwargs):
            yield 'data: {"choices": [{"delta": {"content": "Response text."}}]}'
            yield 'data: {"usage": {"prompt_tokens": 40, "completion_tokens": 1000, "total_tokens": 1040}}'
            yield "data: [DONE]"

        async def fake_stream_turn2(*args, **kwargs):
            yield 'data: {"choices": [{"delta": {"content": "World"}}]}'
            yield 'data: {"usage": {"prompt_tokens": 1140, "completion_tokens": 10, "total_tokens": 1150}}'
            yield "data: [DONE]"

        mock_engine = MagicMock()
        call_count = [0]

        def fake_stream(*args, **kwargs):
            import copy
            call_count[0] += 1
            # Deep-copy messages now; the list is mutated in-place across turns.
            stream_calls.append(copy.deepcopy(kwargs))
            if call_count[0] == 1:
                return fake_stream_turn1(*args, **kwargs)
            return fake_stream_turn2(*args, **kwargs)

        mock_engine.stream = fake_stream
        MockEngine.return_value = mock_engine

        response = self.client.post(
            "/api/models/test-speed",
            json={"model": "model_1", "target_context_threshold": 1100}
        )
        self.assertEqual(response.status_code, 200)
        response.data.decode()  # consume generator

        # Two turns must have been executed.
        self.assertEqual(call_count[0], 2)

        # Turn 2's messages kwarg must include the Turn 1 assistant message.
        turn2_messages = stream_calls[1]["messages"]
        self.assertEqual(len(turn2_messages), 3)  # user, assistant, user

        assistant_msg = turn2_messages[1]
        self.assertEqual(assistant_msg["role"], "assistant")
        # The visible response text must be preserved.
        self.assertEqual(assistant_msg["content"], "Response text.")
        # reasoning_content is empty when reasoning is disabled.
        self.assertEqual(assistant_msg["reasoning_content"], "")

        self.assertEqual(turn2_messages[2]["role"], "user")

        # thinking_budget_tokens must be passed as 0 and enable_thinking as False on every turn
        for call_kwargs in stream_calls:
            self.assertEqual(call_kwargs["thinking_budget_tokens"], 0)
            self.assertEqual(call_kwargs["enable_thinking"], False)

if __name__ == "__main__":
    unittest.main()

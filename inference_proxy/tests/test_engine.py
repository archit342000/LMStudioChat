import unittest
import json
from unittest.mock import patch, AsyncMock, MagicMock
import sys
import os

# Add inference_proxy to python path for testing
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from engine import InferenceEngine, AsyncMPSemaphore

class TestEngine(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        # Reset singleton state before each test
        InferenceEngine._instance = None
        InferenceEngine._mp_sem = None

    def test_singleton(self):
        eng1 = InferenceEngine()
        eng2 = InferenceEngine()
        self.assertIs(eng1, eng2)

    def test_is_generation_valid(self):
        engine = InferenceEngine()
        
        # Valid content
        self.assertTrue(engine._is_generation_valid("Hello world", None))
        
        # Invalid empty content
        self.assertFalse(engine._is_generation_valid("", None))
        self.assertFalse(engine._is_generation_valid("   ", None))

        # Valid tool calls
        valid_tc = [{"function": {"arguments": "{\"test\": 123}"}}]
        self.assertTrue(engine._is_generation_valid("", valid_tc))

        # Invalid tool calls (JSON decode error)
        invalid_tc = [{"function": {"arguments": "{invalid json}"}}]
        self.assertFalse(engine._is_generation_valid("", invalid_tc))

    def test_normalize_messages(self):
        engine = InferenceEngine()
        
        messages = [
            {"role": "system", "content": "System message", "extra_arg": "ignored"},
            {"role": "user", "content": [{"type": "text", "text": "User text"}]},
            {"role": "internal-event", "content": "ignored role"}
        ]
        
        normalized = engine._normalize_messages(messages)
        self.assertEqual(len(normalized), 2)
        self.assertEqual(normalized[0]["role"], "system")
        self.assertEqual(normalized[1]["role"], "user")
        self.assertNotIn("extra_arg", normalized[0])

    @patch("engine.InferenceEngine.ensure_model_loaded", new_callable=AsyncMock)
    @patch("engine.InferenceEngine._request", new_callable=AsyncMock)
    async def test_embed_generation(self, mock_request, mock_load):
        engine = InferenceEngine()
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [{"embedding": [0.1, 0.2, 0.3]}]
        }
        mock_request.return_value = mock_response

        vectors = await engine.embed("test-text", "embedding-model")
        self.assertEqual(len(vectors), 1)
        self.assertEqual(vectors[0], [0.1, 0.2, 0.3])
        mock_load.assert_called_once()
        mock_request.assert_called_once()

    @patch("engine.InferenceEngine.ensure_model_loaded", new_callable=AsyncMock)
    @patch("engine.InferenceEngine._request", new_callable=AsyncMock)
    async def test_chat_completions_parsing(self, mock_request, mock_load):
        engine = InferenceEngine()
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "<think>\nThinking...\n</think>\nHello World"
                }
            }],
            "timings": {"prompt_n": 10}
        }
        mock_request.return_value = mock_response

        res = await engine.chat([{"role": "user", "content": "Hi"}], "test-model")
        
        msg = res["choices"][0]["message"]
        self.assertEqual(msg["content"], "Hello World")
        self.assertEqual(msg["reasoning_content"], "Thinking...\n")
        mock_load.assert_called_once()
        mock_request.assert_called_once()

    @patch("engine.InferenceEngine.ensure_model_loaded", new_callable=AsyncMock)
    @patch("httpx.AsyncClient.stream")
    async def test_stream_completions_parsing(self, mock_stream, mock_load):
        engine = InferenceEngine()
        
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        
        async def mock_aiter_lines():
            lines = [
                'data: {"choices": [{"delta": {"content": "<think>\\n"}}]}',
                'data: {"choices": [{"delta": {"content": "Thinking..."}}]}',
                'data: {"choices": [{"delta": {"content": "</think>\\n"}}]}',
                'data: {"choices": [{"delta": {"content": "Hello World"}}]}',
                'data: [DONE]'
            ]
            for line in lines:
                yield line
                
        mock_resp.aiter_lines = mock_aiter_lines
        
        mock_context = MagicMock()
        mock_context.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_context.__aexit__ = AsyncMock()
        mock_stream.return_value = mock_context

        messages = [{"role": "user", "content": "Hi"}]
        chunks = []
        async for chunk in engine.stream(messages, "test-model"):
            chunks.append(chunk)

        parsed_chunks = [json.loads(c[6:]) for c in chunks if c.startswith("data: ") and not c.endswith("[DONE]")]
        
        reasoning_emitted = ""
        content_emitted = ""
        for pc in parsed_chunks:
            delta = pc["choices"][0]["delta"]
            if "reasoning_content" in delta:
                reasoning_emitted += delta["reasoning_content"]
            if "content" in delta:
                content_emitted += delta["content"]
                
        self.assertEqual(reasoning_emitted, "Thinking...")
        self.assertEqual(content_emitted, "Hello World")

    async def test_async_mp_semaphore_acquire_release(self):
        import multiprocessing
        sem = multiprocessing.Semaphore(1)
        async_sem = AsyncMPSemaphore(sem)
        
        # Test acquisition
        async with async_sem:
            # Under the hood, semaphore counter should be 0 (acquired)
            # A non-blocking acquire should return False
            self.assertFalse(sem.acquire(block=False))
            
        # Test release (exited block)
        # Non-blocking acquire should now return True (since it was released)
        self.assertTrue(sem.acquire(block=False))
        # Release again to clean up
        sem.release()

    async def test_async_mp_semaphore_concurrency(self):
        import multiprocessing
        import asyncio
        sem = multiprocessing.Semaphore(1)
        async_sem = AsyncMPSemaphore(sem)
        
        order = []
        
        async def worker(name, delay):
            async with async_sem:
                order.append(f"{name}_start")
                await asyncio.sleep(delay)
                order.append(f"{name}_end")
                
        # Run two concurrent tasks
        # Task 1 starts first, Task 2 should wait until Task 1 finishes because semaphore count is 1
        await asyncio.gather(
            worker("task1", 0.05),
            worker("task2", 0.01)
        )
        
        self.assertEqual(order, ["task1_start", "task1_end", "task2_start", "task2_end"])

if __name__ == "__main__":
    unittest.main()

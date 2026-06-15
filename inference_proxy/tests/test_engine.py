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

        # Tool call with thought token in name
        self.assertFalse(engine._is_generation_valid("", [{"function": {"name": "test_<think>_tool", "arguments": '{"test": 123}'}}]))
        
        # Tool call with thought token in arguments
        self.assertFalse(engine._is_generation_valid("", [{"function": {"name": "test_tool", "arguments": '{"test": "<think>some thought</think>"}'}}]))
        
        # Tool call with tool call token in arguments
        self.assertFalse(engine._is_generation_valid("", [{"function": {"name": "test_tool", "arguments": '{"test": "<|tool_call>call:other_tool{}<tool_call|>"}'}}]))

    def test_normalize_messages(self):
        engine = InferenceEngine()
        
        messages = [
            {"role": "system", "content": "System message", "extra_arg": "ignored", "name": None},
            {"role": "user", "content": [{"type": "text", "text": "User text"}], "tool_call_id": None},
            {"role": "assistant", "content": "Assistant content", "reasoning_content": "Assistant reasoning", "tool_calls": None},
            {"role": "internal-event", "content": "ignored role"}
        ]
        
        # Test default/Standard model (e.g. Qwen/Nemotron)
        normalized = engine._normalize_messages(messages, "qwen2.5-instruct")
        self.assertEqual(len(normalized), 3)
        self.assertEqual(normalized[0]["role"], "system")
        self.assertEqual(normalized[1]["role"], "user")
        self.assertEqual(normalized[2]["role"], "assistant")
        self.assertNotIn("extra_arg", normalized[0])
        self.assertNotIn("name", normalized[0])
        self.assertNotIn("tool_call_id", normalized[1])
        self.assertNotIn("tool_calls", normalized[2])
        self.assertNotIn("reasoning_content", normalized[2])
        self.assertEqual(normalized[2]["content"], "<think>\nAssistant reasoning</think>\nAssistant content")

        # Test Gemma model
        normalized_gemma = engine._normalize_messages(messages, "google/gemma4-26b-it")
        self.assertEqual(len(normalized_gemma), 3)
        self.assertNotIn("reasoning_content", normalized_gemma[2])
        self.assertNotIn("name", normalized_gemma[0])
        self.assertNotIn("tool_call_id", normalized_gemma[1])
        self.assertNotIn("tool_calls", normalized_gemma[2])
        self.assertEqual(normalized_gemma[2]["content"], "<|channel>thought\nAssistant reasoning<channel|>\nAssistant content")

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

    @patch("engine.InferenceEngine.ensure_model_loaded", new_callable=AsyncMock)
    @patch("httpx.AsyncClient.stream")
    async def test_stream_gemma4_tool_calls(self, mock_stream, mock_load):
        engine = InferenceEngine()
        
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        
        async def mock_aiter_lines():
            lines = [
                # Scenario A: Tool call inside thought block (emitted as delta.tool_calls by llama.cpp)
                # It should be ignored because in_reasoning_block is True.
                'data: {"choices": [{"delta": {"content": "<|channel>thought\\nThinking...\\n"}}]}',
                'data: {"choices": [{"delta": {"tool_calls": [{"index": 0, "id": "call_1", "type": "function", "function": {"name": "toolA", "arguments": "{\\"x\\": 1}"}}]}}]}',
                'data: {"choices": [{"delta": {"content": "<channel|>\\n"}}]}',
                # Scenario B: Tool call outside thought block (emitted as content by model, parsed by interceptor)
                # It should be correctly parsed and NOT have its arguments doubled.
                'data: {"choices": [{"delta": {"content": "<|tool_call>call:toolB{y:<|\\\"|>val<|\\\"|>}<tool_call|>"}}]}',
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
        async for chunk in engine.stream(messages, "google/gemma4-26b-it"):
            chunks.append(chunk)

        parsed_chunks = [json.loads(c[6:]) for c in chunks if c.startswith("data: ") and not c.endswith("[DONE]")]
        
        # Collect final accumulated tool calls
        final_tool_calls = None
        for pc in parsed_chunks:
            delta = pc["choices"][0]["delta"]
            if "tool_calls" in delta:
                final_tool_calls = delta["tool_calls"]
                
        # The tool call from inside thought block (toolA) must be ignored.
        # The tool call from outside thought block (toolB) must be present and arguments must not be doubled.
        self.assertIsNotNone(final_tool_calls)
        self.assertEqual(len(final_tool_calls), 1)
        self.assertEqual(final_tool_calls[0]["function"]["name"], "toolB")
        
        # Verify arguments are valid JSON and not doubled
        args = json.loads(final_tool_calls[0]["function"]["arguments"])
        self.assertEqual(args, {"y": "val"})

    @patch("engine.InferenceEngine.ensure_model_loaded", new_callable=AsyncMock)
    @patch("engine.InferenceEngine._request", new_callable=AsyncMock)
    async def test_chat_gemma4_tool_call_parser(self, mock_request, mock_load):
        engine = InferenceEngine()
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "Hello"
                }
            }]
        }
        mock_request.return_value = mock_response

        await engine.chat([{"role": "user", "content": "Hi"}], "Google/Gemma4-26B-A4B-it")
        mock_load.assert_called_once()
        mock_request.assert_called_once()
        _, _, _, payload, _ = mock_request.call_args[0]
        self.assertEqual(payload.get("tool_call_parser"), "gemma4")

    @patch("engine.InferenceEngine.ensure_model_loaded", new_callable=AsyncMock)
    @patch("httpx.AsyncClient.stream")
    async def test_stream_gemma4_tool_call_parser(self, mock_stream, mock_load):
        engine = InferenceEngine()
        
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        
        async def mock_aiter_lines():
            yield 'data: {"choices": [{"delta": {"content": "Hello"}}]}'
            yield 'data: [DONE]'
            
        mock_resp.aiter_lines = mock_aiter_lines
        
        mock_context = MagicMock()
        mock_context.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_context.__aexit__ = AsyncMock()
        mock_stream.return_value = mock_context

        messages = [{"role": "user", "content": "Hi"}]
        async for _ in engine.stream(messages, "Google/Gemma4-26B-A4B-it"):
            pass
        mock_load.assert_called_once()
        mock_stream.assert_called_once()
        kwargs = mock_stream.call_args[1]
        self.assertEqual(kwargs.get("json", {}).get("tool_call_parser"), "gemma4")

    def test_is_gemma4_model(self):
        engine = InferenceEngine()
        # Matches specific name in config
        self.assertTrue(engine._is_gemma4_model("Google/Gemma4-26B-A4B-it"))
        self.assertTrue(engine._is_gemma4_model("google/gemma4-26b-a4b-it"))
        
        # Non-matching (fallbacks and tokenizer names are now rejected)
        self.assertFalse(engine._is_gemma4_model("google/gemma-4-26B-A4B-it"))
        self.assertFalse(engine._is_gemma4_model("gemma-4"))
        self.assertFalse(engine._is_gemma4_model("gemma4"))
        self.assertFalse(engine._is_gemma4_model("qwen2.5-instruct"))
        self.assertFalse(engine._is_gemma4_model(""))
        self.assertFalse(engine._is_gemma4_model(None))

if __name__ == "__main__":
    unittest.main()

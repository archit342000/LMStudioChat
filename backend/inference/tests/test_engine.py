import pytest
import threading
import time
import json
import asyncio
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest.mock import patch, MagicMock
from backend.inference.engine import InferenceEngine
import multiprocessing

class MockLlamaCppHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass # Suppress logging

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        payload = json.loads(body.decode('utf-8'))
        
        if self.path in ['/v1/chat/completions', '/api/models/v1/chat/completions']:
            if payload.get('stream'):
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.end_headers()
                
                chunks = [
                    {"choices": [{"delta": {"content": "<think>\nThinking..."}}]},
                    {"choices": [{"delta": {"content": "</think>\nHello "}}]},
                    {"choices": [{"delta": {"content": "World"}}]},
                    {"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"name": "test_tool", "arguments": '{"a":1}'}}]}}]},
                    {"timings": {"prompt_n": 10}}
                ]
                for chunk in chunks:
                    self.wfile.write(f"data: {json.dumps(chunk)}\n\n".encode('utf-8'))
                self.wfile.write(b"data: [DONE]\n\n")
            else:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                resp = {
                    "choices": [{
                        "message": {
                            "role": "assistant",
                            "content": "<think>\nThinking...\n</think>\nHello World",
                            "tool_calls": [{"id": "call_1", "function": {"name": "test_tool", "arguments": "{}"}}]
                        }
                    }],
                    "timings": {"prompt_n": 10}
                }
                self.wfile.write(json.dumps(resp).encode('utf-8'))
        
        elif self.path in ['/v1/embeddings', '/api/models/v1/embeddings']:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            inputs = payload.get('input', [])
            if isinstance(inputs, str): inputs = [inputs]
            
            data = [{"embedding": [0.1, 0.2, 0.3]} for _ in inputs]
            resp = {"data": data}
            self.wfile.write(json.dumps(resp).encode('utf-8'))
            
        elif self.path == '/api/models/load':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
        
        else:
            self.send_response(404)
            self.end_headers()

@pytest.fixture(scope="module")
def mock_server():
    server = HTTPServer(('127.0.0.1', 0), MockLlamaCppHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()
    server.server_close()
    thread.join()

@pytest.fixture
def engine(mock_server):
    # Reset singleton before test
    InferenceEngine._instance = None
    
    with patch('backend.config.AI_PROXY_URL', mock_server), \
         patch.dict('os.environ', {"AI_PROXY_URL": mock_server}):
         
         eng = InferenceEngine()
         yield eng
    
    InferenceEngine._instance = None


@pytest.fixture(autouse=True)
def mock_logger():
    with patch('backend.inference.engine.log_event'), \
         patch('backend.inference.engine.log_llm_call'), \
         patch('backend.inference.engine.log_embedding_call'):
         yield


@pytest.mark.anyio
async def test_engine_singleton(mock_server):
    InferenceEngine._instance = None
    with patch('backend.config.AI_PROXY_URL', mock_server), \
         patch.dict('os.environ', {"AI_PROXY_URL": mock_server}):
        eng1 = InferenceEngine()
        eng2 = InferenceEngine()
        assert eng1 is eng2

@pytest.mark.anyio
async def test_engine_start(engine):
    assert await engine.start() is True

@pytest.mark.anyio
async def test_engine_chat(engine):
    messages = [{"role": "user", "content": "Hi"}]
    res = await engine.chat(messages, model="test-model", chat_template_kwargs={"enable_thinking": True})
    assert res["choices"][0]["message"]["content"] == "<think>\nThinking...\n</think>\nHello World"

@pytest.mark.anyio
async def test_engine_chat_error(engine):
    with patch.object(engine, '_request', side_effect=Exception("API Error")):
        with pytest.raises(Exception, match="API Error"):
            await engine.chat([{"role": "user", "content": "Hi"}], model="test-model")

@pytest.mark.anyio
async def test_engine_stream(engine):
    messages = [{"role": "user", "content": "Hi"}]
    chunks = []
    async for chunk in engine.stream(messages, model="test-model", chat_template_kwargs={"enable_thinking": True}):
        chunks.append(chunk)
    
    assert len(chunks) == 5
    for chunk in chunks:
        assert chunk.startswith("data: ")
    # The logging block in finally happens, but we patched it out

@pytest.mark.anyio
async def test_engine_stream_error(engine):
    with patch('httpx.AsyncClient.stream', side_effect=Exception("Stream Error")):
        with pytest.raises(Exception, match="Stream Error"):
            async for _ in engine.stream([{"role": "user", "content": "Hi"}], model="test-model"):
                pass

@pytest.mark.anyio
async def test_engine_embed(engine):
    res = await engine.embed("Test input", model="test-embed")
    assert len(res) == 1
    assert res[0] == [0.1, 0.2, 0.3]
    
    res2 = await engine.embed(["Test 1", "Test 2"], model="test-embed")
    assert len(res2) == 2
    assert res2[0] == [0.1, 0.2, 0.3]
    assert res2[1] == [0.1, 0.2, 0.3]

@pytest.mark.anyio
async def test_engine_embed_error(engine):
    with patch.object(engine, '_request', side_effect=Exception("Embed Error")):
        with pytest.raises(Exception, match="Embed Error"):
            await engine.embed("Test input", model="test-embed")

def test_engine_embed_sync(engine):
    res = engine.embed_sync("Test input", model="test-embed")
    assert len(res) == 1
    assert res[0] == [0.1, 0.2, 0.3]

@pytest.mark.anyio
async def test_ensure_model_loaded(engine):
    # This will hit MockLlamaCppHandler's /api/models/load endpoint successfully
    await engine.ensure_model_loaded("test-model")
        
    # Error handling
    with patch('httpx.AsyncClient.request', side_effect=Exception("Load Error")), \
         patch('backend.inference.engine.log_event') as mock_log:
        await engine.ensure_model_loaded("test-model")
        mock_log.assert_called_with("ensure_model_loaded_error", {"error": "Load Error", "model": "test-model"})

@pytest.mark.anyio
async def test_request(engine):
    res = await engine._request("POST", f"{engine.proxy_url}/v1/chat/completions", {"stream": False}, 10.0)
    assert res.status_code == 200

def test_get_headers(engine):
    h = engine._get_headers()
    assert h["Content-Type"] == "application/json"

def test_normalize_messages(engine):
    messages = [
        {"role": "system", "content": "You are AI"},
        {"role": "user", "content": "Hello", "extra": "remove_me"},
        {"role": "event", "content": "ignored"},
        {"role": "assistant", "content": "Hi", "reasoning_content": "Thinking", "tool_calls": [{"index": 0}]},
        {"role": "tool", "content": {"message": "Image attached", "screenshot_ref": "invalid_path", "mime_type": "image/jpeg"}},
        {"role": "tool", "content": "Pure text", "tool_call_id": "call_1"},
        {"role": "assistant", "content": "Done"}
    ]
    
    norm = engine._normalize_messages(messages)
    
    # event is skipped
    assert len(norm) == 6
    assert norm[0]["role"] == "system"
    assert "extra" not in norm[1]
    
    # Assistant reasoning woven
    assert norm[2]["role"] == "assistant"
    assert norm[2]["content"] == "Hi"
    assert norm[2]["reasoning_content"] == "Thinking"
    assert norm[2]["tool_calls"][0]["type"] == "function" # Enforced by normalization
    
    # Invalid screenshot path results in fallback message
    assert norm[3]["role"] == "tool"
    assert norm[3]["content"] == "Image attached"
    
    # Pure text tool
    assert norm[4]["role"] == "tool"
    assert norm[4]["content"] == "Pure text"
    
    # Assistant no reasoning, no tools
    assert norm[5]["role"] == "assistant"
    assert norm[5]["content"] == "Done"
    assert "tool_calls" not in norm[5]

def test_normalize_messages_multimodal(engine):
    messages = [
        {"role": "user", "content": [{"type": "text", "text": "hello"}]}
    ]
    norm = engine._normalize_messages(messages)
    assert norm[0]["content"] == [{"type": "text", "text": "hello"}]
    
    # If not user, should dump JSON
    messages2 = [
        {"role": "system", "content": [{"type": "text", "text": "hello"}]}
    ]
    norm2 = engine._normalize_messages(messages2)
    assert norm2[0]["content"] == '[{"type": "text", "text": "hello"}]'

def test_engine__log_llm_call(): pass

@pytest.mark.anyio
async def test_chat_retry_reasoning_only(engine):
    # Mock responses: 1st is reasoning-only, 2nd is valid
    resp1 = MagicMock()
    resp1.json.return_value = {
        "choices": [{"message": {"role": "assistant", "content": "", "reasoning_content": "Thinking..."}}]
    }
    resp2 = MagicMock()
    resp2.json.return_value = {
        "choices": [{"message": {"role": "assistant", "content": "Hello", "reasoning_content": "Thinking..."}}]
    }
    
    with patch.object(engine, '_request', side_effect=[resp1, resp2]):
        with patch('backend.config.LLM_RETRY_COUNT', 3), \
             patch('backend.config.LLM_RETRY_DELAY', 0.01):
            res = await engine.chat([{"role": "user", "content": "Hi"}], model="test-model")
            assert res["choices"][0]["message"]["content"] == "Hello"
            assert engine._request.call_count == 2

@pytest.mark.anyio
async def test_chat_retry_invalid_tool_json(engine):
    # Mock responses: 1st has invalid tool JSON, 2nd is valid
    resp1 = MagicMock()
    resp1.json.return_value = {
        "choices": [{
            "message": {
                "role": "assistant", 
                "content": None, 
                "tool_calls": [{"function": {"name": "test", "arguments": '{"a": 1'}}] # Missing closing brace
            }
        }]
    }
    resp2 = MagicMock()
    resp2.json.return_value = {
        "choices": [{
            "message": {
                "role": "assistant", 
                "content": None, 
                "tool_calls": [{"function": {"name": "test", "arguments": '{"a": 1}'}}]
            }
        }]
    }
    
    with patch.object(engine, '_request', side_effect=[resp1, resp2]):
        with patch('backend.config.LLM_RETRY_COUNT', 3), \
             patch('backend.config.LLM_RETRY_DELAY', 0.01):
            res = await engine.chat([{"role": "user", "content": "Hi"}], model="test-model")
            assert res["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"] == '{"a": 1}'
            assert engine._request.call_count == 2

@pytest.mark.anyio
async def test_stream_retry_reasoning_only(engine):
    # Mock stream data
    # Stream 1: Only reasoning
    stream1_data = [
        'data: {"choices": [{"delta": {"reasoning_content": "Thinking..."}}]}',
        'data: [DONE]'
    ]
    # Stream 2: Valid content
    stream2_data = [
        'data: {"choices": [{"delta": {"content": "Hello"}}]}',
        'data: [DONE]'
    ]
    
    class MockStream:
        def __init__(self, data):
            self.data = data
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def aiter_lines(self):
            for line in self.data:
                yield line
        def raise_for_status(self): pass

    with patch('httpx.AsyncClient.stream', side_effect=[MockStream(stream1_data), MockStream(stream2_data)]):
        with patch('backend.config.LLM_RETRY_COUNT', 3), \
             patch('backend.config.LLM_RETRY_DELAY', 0.01):
            chunks = []
            async for chunk in engine.stream([{"role": "user", "content": "Hi"}], model="test-model"):
                chunks.append(chunk)
                
            assert any("Thinking..." in c for c in chunks)
            assert any("__redact__" in c for c in chunks)
            assert any("Hello" in c for c in chunks)

@pytest.mark.anyio
async def test_stream_retry_on_exception(engine):
    # Mock stream: 1st raises exception, 2nd is valid
    stream2_data = [
        'data: {"choices": [{"delta": {"content": "Recovered"}}]}',
        'data: [DONE]'
    ]
    
    class MockStream:
        def __init__(self, data):
            self.data = data
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def aiter_lines(self):
            for line in self.data:
                yield line
        def raise_for_status(self): pass

    with patch('httpx.AsyncClient.stream', side_effect=[Exception("Network Error"), MockStream(stream2_data)]):
        with patch('backend.config.LLM_RETRY_COUNT', 3), \
             patch('backend.config.LLM_RETRY_DELAY', 0.01):
            chunks = []
            async for chunk in engine.stream([{"role": "user", "content": "Hi"}], model="test-model"):
                chunks.append(chunk)
                
            assert any("__redact__" in c for c in chunks)
            assert any("Recovered" in c for c in chunks)


@pytest.mark.anyio
async def test_engine_chat_proxy_mode(engine):
    # Mock proxy-parsed response: reasoning_content is already populated and stripped
    proxy_response = MagicMock()
    proxy_response.json.return_value = {
        "choices": [{
            "message": {
                "role": "assistant",
                "content": "Hello World",
                "reasoning_content": "Thinking..."
            }
        }],
        "timings": {"prompt_n": 10}
    }
    
    with patch.object(engine, '_request', return_value=proxy_response):
        with patch.object(engine, 'proxy_url', "http://proxy-mock"):
            res = await engine.chat([{"role": "user", "content": "Hi"}], model="test-model")
            
            # Assert that client preserves reasoning_content exactly as returned by proxy without double parsing
            assert res["choices"][0]["message"]["content"] == "Hello World"
            assert res["choices"][0]["message"]["reasoning_content"] == "Thinking..."

@pytest.mark.anyio
async def test_engine_stream_proxy_mode(engine):
    from unittest.mock import AsyncMock
    # Mock proxy-parsed stream responses
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    
    async def mock_aiter_lines():
        lines = [
            'data: {"choices": [{"delta": {"reasoning_content": "Thinking..."}}]}',
            'data: {"choices": [{"delta": {"content": "Hello World"}}]}',
            'data: [DONE]'
        ]
        for line in lines:
            yield line
            
    mock_resp.aiter_lines = mock_aiter_lines
    
    mock_context = MagicMock()
    mock_context.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_context.__aexit__ = AsyncMock()
    
    with patch('httpx.AsyncClient.stream', return_value=mock_context):
        with patch.object(engine, 'proxy_url', "http://proxy-mock"):
            chunks = []
            async for chunk in engine.stream([{"role": "user", "content": "Hi"}], model="test-model"):
                chunks.append(chunk)
                
            assert len(chunks) == 2
            assert "reasoning_content" in chunks[0]
            assert "content" in chunks[1]

def test_log_llm_call_exception_resilience(engine):
    # Mock log_llm_call to raise an exception
    with patch('backend.inference.engine.log_llm_call', side_effect=Exception("Database lock error")), \
         patch('backend.inference.engine.logger.warning') as mock_warn:
         
         # Call _log_llm_call: it should handle exception and log warning
         engine._log_llm_call(
             payload={},
             response_text="Hello",
             model="test",
             chat_id="chat_1",
             duration=1.0,
             call_type="test"
         )
         
         mock_warn.assert_called_once()
         assert "Failed to log LLM call" in mock_warn.call_args[0][0]

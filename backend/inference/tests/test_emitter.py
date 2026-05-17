import pytest
import json
from backend.inference.emitter import ManualChunkEmitter

@pytest.mark.anyio
async def test_stream_message_content():
    chunks = []
    async for chunk in ManualChunkEmitter.stream_message(content="Hello"):
        chunks.append(chunk)
    
    assert len(chunks) == 2
    assert chunks[0].startswith("data: ")
    data = json.loads(chunks[0][6:])
    assert data["choices"][0]["delta"]["content"] == "Hello"
    assert chunks[1] == "data: [DONE]\n\n"

@pytest.mark.anyio
async def test_stream_message_thinking():
    chunks = []
    async for chunk in ManualChunkEmitter.stream_message(thinking="Thinking...", done=False):
        chunks.append(chunk)
    
    assert len(chunks) == 1
    data = json.loads(chunks[0][6:])
    assert data["choices"][0]["delta"]["reasoning_content"] == "Thinking..."

@pytest.mark.anyio
async def test_stream_message_event():
    chunks = []
    async for chunk in ManualChunkEmitter.stream_message(event="An event occurred", done=False):
        chunks.append(chunk)
        
    assert len(chunks) == 1
    data = json.loads(chunks[0][6:])
    assert data["choices"][0]["delta"]["role"] == "event"
    assert data["choices"][0]["delta"]["content"] == "An event occurred"

@pytest.mark.anyio
async def test_stream_message_tool_calls():
    tool_calls = [{"function": {"name": "test_tool", "arguments": "{}"}}]
    chunks = []
    async for chunk in ManualChunkEmitter.stream_message(tool_calls=tool_calls, done=False):
        chunks.append(chunk)
        
    assert len(chunks) == 1
    data = json.loads(chunks[0][6:])
    tc = data["choices"][0]["delta"]["tool_calls"][0]
    assert tc["index"] == 0
    assert tc["function"]["name"] == "test_tool"

@pytest.mark.anyio
async def test_stream_message_tool_results():
    tool_results = ["result1", "result2"]
    chunks = []
    async for chunk in ManualChunkEmitter.stream_message(tool_results=tool_results, done=False):
        chunks.append(chunk)
        
    assert len(chunks) == 2
    data1 = json.loads(chunks[0][6:])
    assert data1["choices"][0]["delta"]["tool_result"] == "result1"
    data2 = json.loads(chunks[1][6:])
    assert data2["choices"][0]["delta"]["tool_result"] == "result2"

@pytest.mark.anyio
async def test_stream_message_parent_type():
    chunks = []
    async for chunk in ManualChunkEmitter.stream_message(content="Test", parent_type="agent", done=False):
        chunks.append(chunk)
        
    assert len(chunks) == 1
    data = json.loads(chunks[0][6:])
    assert data["parent_type"] == "agent"

def test_stream_message__add_metadata(): pass

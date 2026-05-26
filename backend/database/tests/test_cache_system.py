import pytest
import os
import json
import time
import asyncio
from backend.database.cache_system import ResponseCache, CACHE_DIR
import queue

@pytest.fixture
def cache():
    return ResponseCache()

def test_get_wal_path(cache):
    assert cache._get_wal_path("chat_123") == os.path.join(CACHE_DIR, "chat_123.wal")

def test_initialize_chat(cache):
    cache.initialize_chat("chat_1", ttl_seconds=10)
    assert "chat_1" in cache._cache
    assert cache._cache["chat_1"]["ttl"] == 10
    
    # Test overwrite
    cache._cache["chat_1"]["chunks"] = [{"data": "test"}]
    cache.initialize_chat("chat_1", overwrite=True)
    assert len(cache._cache["chat_1"]["chunks"]) == 0
    
    # Test initialization from existing wal
    wal_path = cache._get_wal_path("chat_2")
    with open(wal_path, "w") as f:
        f.write(json.dumps({"timestamp": time.time(), "data": "test"}) + "\n")
        
    cache.initialize_chat("chat_2", overwrite=False)
    assert len(cache._cache["chat_2"]["chunks"]) == 1

def test_append_chunk(cache):
    cache.initialize_chat("chat_1")
    cache.append_chunk("chat_1", "chunk1")
    
    assert len(cache._cache["chat_1"]["chunks"]) == 1
    assert cache._cache["chat_1"]["chunks"][0]["data"] == "chunk1"
    
    # Verify WAL write
    wal_path = cache._get_wal_path("chat_1")
    assert os.path.exists(wal_path)
    with open(wal_path, "r") as f:
        lines = f.readlines()
        assert len(lines) == 1
        data = json.loads(lines[0])
        assert data["data"] == "chunk1"
        
    # Test queue full behavior
    q = queue.Queue(maxsize=1)
    q.put("block")
    cache._cache["chat_1"]["subscribers"].append(q)
    cache.append_chunk("chat_1", "chunk2") # should not block/error
    assert len(cache._cache["chat_1"]["chunks"]) == 2

    # Append to non-existent chat
    cache.cleanup_chat("chat_new")
    cache.append_chunk("chat_new", "chunk1")
    assert "chat_new" in cache._cache
    assert len(cache._cache["chat_new"]["chunks"]) == 1

def test_add_get_clear_delete_sse_chunks(cache):
    cache.initialize_chat("chat_1")
    cache.add_sse_chunk("chat_1", "msg_1", "main", 0, "text", "hello")
    cache.add_sse_chunk("chat_1", "msg_1", "main", 1, "text", " world")
    cache.add_sse_chunk("chat_1", "msg_2", "sub", 0, "text", "sub hello")
    
    chunks = cache.get_sse_chunks("chat_1")
    assert len(chunks) == 3
    
    chunks = cache.get_sse_chunks("chat_1", parent_message_id="msg_1")
    assert len(chunks) == 2
    
    chunks = cache.get_sse_chunks("chat_1", parent_type="sub")
    assert len(chunks) == 1
    
    deleted = cache.delete_sse_chunks("chat_1", parent_type="sub")
    assert deleted == 1
    assert len(cache.get_sse_chunks("chat_1")) == 2
    
    cache.clear_sse_chunks("chat_1")
    assert len(cache.get_sse_chunks("chat_1")) == 0

    deleted_all = cache.delete_sse_chunks("chat_1")
    assert deleted_all == 0
    cache.add_sse_chunk("chat_1", "msg_1", "main", 0, "text", "hello")
    deleted_all = cache.delete_sse_chunks("chat_1")
    assert deleted_all == 1
    
    # Test delete_sse_chunks for non-existent chat
    assert cache.delete_sse_chunks("chat_none") == 0
    # Test get_sse_chunks for non-existent chat
    assert len(cache.get_sse_chunks("chat_none")) == 0
    # Test add_sse_chunks for non-existent chat
    cache.add_sse_chunk("chat_none2", "msg_1", "main", 0, "text", "hello")
    assert "chat_none2" in cache._cache

def test_is_expired(cache):
    cache.initialize_chat("chat_1", ttl_seconds=1)
    assert not cache._is_expired("chat_1")
    assert cache._is_expired("chat_not_exist")
    
    # Mock time
    cache._cache["chat_1"]["last_updated"] = time.time() - 2
    assert cache._is_expired("chat_1")

def test_cleanup_expired(cache):
    cache.initialize_chat("chat_1", ttl_seconds=0.1)
    cache.initialize_chat("chat_2", ttl_seconds=10)
    
    time.sleep(0.2)
    cache.cleanup_expired(active_chat_ids={"chat_1"}) # should not clean chat_1 because it is active
    assert "chat_1" in cache._cache
    assert "chat_2" in cache._cache
    
    cache.cleanup_expired()
    assert "chat_1" not in cache._cache
    assert "chat_2" in cache._cache

def test_recover_from_wal(cache):
    wal_path = cache._get_wal_path("chat_recover")
    with open(wal_path, "w") as f:
        f.write(json.dumps({"timestamp": time.time(), "data": "chunk1"}) + "\n")
        f.write("invalid json\n")
        f.write(json.dumps({"timestamp": time.time(), "data": "chunk2"}) + "\n")
        
    cache.recover_from_wal("chat_recover")
    assert "chat_recover" in cache._cache
    assert len(cache._cache["chat_recover"]["chunks"]) == 2
    assert cache._cache["chat_recover"]["chunks"][0]["data"] == "chunk1"
    assert cache._cache["chat_recover"]["chunks"][1]["data"] == "chunk2"
    
    # Recover non-existent wal
    cache.recover_from_wal("chat_recover_none")
    assert "chat_recover_none" not in cache._cache

def test_mark_completed(cache):
    cache.initialize_chat("chat_1")
    cache.append_chunk("chat_1", "data: {\"choices\": [{\"delta\": {\"content\": \"hello\"}}]}")
    cache.append_chunk("chat_1", "data: {\"choices\": [{\"delta\": {\"reasoning_content\": \"thinking\"}}]}")
    cache.append_chunk("chat_1", "data: {\"internal\": true, \"choices\": [{\"delta\": {\"content\": \"hidden\"}}]}")
    cache.append_chunk("chat_1", "data: {\"parent_type\": \"sub\", \"choices\": [{\"delta\": {\"content\": \"hidden_sub\"}}]}")
    cache.append_chunk("chat_1", "data: {\"choices\": [{\"delta\": {\"reasoning\": \"🔍 search noise\"}}]}")
    cache.append_chunk("chat_1", "data: [DONE]")
    cache.append_chunk("chat_1", "invalid json")
    
    res = cache.mark_completed("chat_1", cleanup=True)
    assert "hello" in res["content"]
    assert "thinking" in res["reasoning_content"]
    assert "hidden" not in res["content"]
    assert "hidden_sub" not in res["content"]
    assert "search noise" not in res["content"]
    assert "chat_1" not in cache._cache
    
    assert cache.mark_completed("non_existent") is None

def test_cleanup_chat(cache):
    cache.initialize_chat("chat_1")
    wal_path = cache._get_wal_path("chat_1")
    assert os.path.exists(wal_path)
    
    cache.cleanup_chat("chat_1")
    assert "chat_1" not in cache._cache
    assert not os.path.exists(wal_path)
    
    # Safe to call multiple times
    cache.cleanup_chat("chat_1")

def test_is_active(cache):
    cache.initialize_chat("chat_1")
    assert cache.is_active("chat_1")
    assert not cache.is_active("chat_2")

@pytest.mark.asyncio
async def test_subscribe_generator(cache):
    # Mock task_manager for subscriber orphan termination test
    import sys
    from unittest.mock import MagicMock
    if "backend.task_manager" not in sys.modules:
        backend_mock = MagicMock()
        task_manager_mock = MagicMock()
        task_manager_mock.is_task_running.return_value = False
        backend_mock.task_manager = task_manager_mock
        sys.modules["backend.task_manager"] = backend_mock
    else:
        # Patch the existing module
        task_manager_mock = MagicMock()
        task_manager_mock.is_task_running.return_value = False
        sys.modules["backend.task_manager"].task_manager = task_manager_mock
    
    cache.initialize_chat("chat_1")
    cache.append_chunk("chat_1", "chunk1")
    cache.append_chunk("chat_1", "chunk2")
    
    async def append_later():
        await asyncio.sleep(0.1)
        cache.append_chunk("chat_1", "chunk3")
        await asyncio.sleep(0.1)
        cache.append_chunk("chat_1", "[[DONE]]")
    
    asyncio.create_task(append_later())
    
    chunks = []
    async for chunk in cache.subscribe("chat_1"):
        chunks.append(chunk)
        
    assert chunks == ["chunk1", "chunk2", "chunk3", "data: [DONE]\n\n"]
    
    # Test subscribe on not active chat
    chunks_empty = []
    async for chunk in cache.subscribe("chat_2"):
        chunks_empty.append(chunk)
    assert len(chunks_empty) == 0
    
    # Test subscribe from WAL
    wal_path = cache._get_wal_path("chat_wal")
    with open(wal_path, "w") as f:
        f.write(json.dumps({"timestamp": time.time(), "data": "chunk_wal"}) + "\n")
    
    # Don't initialize chat_wal, let it recover
    asyncio.create_task(append_later_wal(cache, "chat_wal"))
    chunks_wal = []
    async for chunk in cache.subscribe("chat_wal"):
        chunks_wal.append(chunk)
    assert chunks_wal == ["chunk_wal", "data: [DONE]\n\n"]

    # Test error
    cache.initialize_chat("chat_err")
    cache.append_chunk("chat_err", "[[ERROR]]")
    chunks_err = []
    async for chunk in cache.subscribe("chat_err"):
        chunks_err.append(chunk)
    assert len(chunks_err) == 0

    # Test subscribe expired
    cache.initialize_chat("chat_exp", ttl_seconds=-1)
    chunks_exp = []
    async for chunk in cache.subscribe("chat_exp"):
        chunks_exp.append(chunk)
    assert len(chunks_exp) == 0
    assert "chat_exp" not in cache._cache

async def append_later_wal(cache, chat_id):
    await asyncio.sleep(0.1)
    cache.append_chunk(chat_id, "[[DONE]]")

@pytest.mark.asyncio
async def test_subscribe_generator_multi_subscriber(cache):
    # Ensure task_manager is mocked to allow subscribers to poll
    import sys
    from unittest.mock import MagicMock
    task_manager_mock = MagicMock()
    task_manager_mock.is_task_running.return_value = True
    if "backend.task_manager" not in sys.modules:
        backend_mock = MagicMock()
        backend_mock.task_manager = task_manager_mock
        sys.modules["backend.task_manager"] = backend_mock
    else:
        sys.modules["backend.task_manager"].task_manager = task_manager_mock

    chat_id = "chat_multi"
    cache.initialize_chat(chat_id)
    cache.append_chunk(chat_id, "chunk1")
    cache.append_chunk(chat_id, "chunk2")

    async def run_subscriber(sub_id):
        received = []
        async for chunk in cache.subscribe(chat_id):
            received.append(chunk)
        return received

    async def append_later_multi():
        await asyncio.sleep(0.1)
        cache.append_chunk(chat_id, "chunk3")
        await asyncio.sleep(0.1)
        cache.append_chunk(chat_id, "[[DONE]]")

    # Start 3 subscribers concurrently
    sub_tasks = [
        asyncio.create_task(run_subscriber(1)),
        asyncio.create_task(run_subscriber(2)),
        asyncio.create_task(run_subscriber(3))
    ]

    # Let them connect and start catch-up replay, then stream more chunks
    await asyncio.sleep(0.05)
    asyncio.create_task(append_later_multi())

    # Wait for all subscribers to finish
    results = await asyncio.gather(*sub_tasks)

    expected = ["chunk1", "chunk2", "chunk3", "data: [DONE]\n\n"]
    for i, res in enumerate(results):
        assert res == expected, f"Subscriber {i+1} received {res} instead of {expected}"



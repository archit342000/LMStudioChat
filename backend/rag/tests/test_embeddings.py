import pytest
import asyncio
from unittest.mock import patch, MagicMock
from backend.rag.embeddings import _cosine_similarity, AIEmbeddingFunction
import backend.config as config

def test__cosine_similarity():
    v1 = [1, 0, 0]
    v2 = [1, 0, 0]
    assert _cosine_similarity(v1, v2) == 1.0
    
    v1 = [1, 0, 0]
    v2 = [0, 1, 0]
    assert _cosine_similarity(v1, v2) == 0.0
    
    v1 = [0, 0, 0]
    v2 = [1, 1, 1]
    assert _cosine_similarity(v1, v2) == 0.0

def test_ai_embedding_function_init():
    with pytest.raises(ValueError, match="embedding_model must be explicitly provided"):
        AIEmbeddingFunction()

    fn = AIEmbeddingFunction(model_name="test-model", default_task="query")
    assert fn.model_name == "test-model"
    assert fn.default_task == "query"

@pytest.mark.anyio
async def test_embed_async():
    fn = AIEmbeddingFunction(model_name="test-model")
    with patch.object(fn, "_embed_with_task_async", new_callable=MagicMock) as mock_async:
        async def mock_ret(*args, **kwargs):
            return [[0.1, 0.2]]
        mock_async.side_effect = mock_ret
        res = await fn.embed_async(["test"])
        assert res == [[0.1, 0.2]]
        mock_async.assert_called_once_with(["test"], task="document", chat_id=None)

def test_call():
    fn = AIEmbeddingFunction(model_name="test-model")
    with patch.object(fn, "_embed_with_task") as mock_sync:
        mock_sync.return_value = [[0.1, 0.2]]
        res = fn(["test"])
        # Use explicit comparison to avoid numpy ambiguity
        assert len(res) == 1
        assert list(res[0]) == [0.1, 0.2]
        mock_sync.assert_called_once_with(["test"], task="document")

def test_embed_with_task_sync():
    fn = AIEmbeddingFunction(model_name="test-model")
    with patch.object(fn, "_embed_with_task_async") as mock_async:
        async def mock_coro(*args, **kwargs):
            return [[0.1, 0.2]]
        mock_async.side_effect = mock_coro
        
        # When no loop is running
        res = fn._embed_with_task(["test"], task="query")
        assert len(res) == 1
        assert list(res[0]) == [0.1, 0.2]

def test_embed_with_task_sync_exception():
    fn = AIEmbeddingFunction(model_name="test-model")
    with patch.object(fn, "_embed_with_task_async") as mock_async:
        async def mock_coro(*args, **kwargs):
            raise ValueError("Test Error")
        mock_async.side_effect = mock_coro
        
        with pytest.raises(ValueError, match="Test Error"):
            fn._embed_with_task(["test"], task="query")

@pytest.mark.anyio
async def test__run():
    # This triggers the nested _run function because a loop is already running
    fn = AIEmbeddingFunction(model_name="test-model")
    with patch.object(fn, "_embed_with_task_async") as mock_async:
        async def mock_ret(*args, **kwargs):
            return [[0.1, 0.2]]
        mock_async.side_effect = mock_ret
        res = fn._embed_with_task(["test"])
        assert res == [[0.1, 0.2]]

@pytest.mark.anyio
@patch("backend.rag.embeddings.count_tokens")
@patch("backend.rag.embeddings.truncate_text_by_tokens")
@patch("backend.inference.InferenceEngine")
async def test_embed_with_task_async(MockInferenceEngine, mock_truncate, mock_count):
    # Setup mocks
    mock_count.return_value = 10
    mock_truncate.return_value = "truncated"
    
    mock_engine = MagicMock()
    async def mock_embed(*args, **kwargs):
        return [[0.1, 0.2], [0.3, 0.4]]
    mock_engine.embed.side_effect = mock_embed
    MockInferenceEngine.return_value = mock_engine
    
    config.EMBEDDING_MAX_TOKENS_RESEARCH = 5
    config.EMBEDDING_MAX_TOKENS_PREFERENCES = 20
    config.EMBEDDING_BATCH_SIZE = 2
    
    fn = AIEmbeddingFunction(model_name="test-model")
    
    # Test query task, truncation applies (10 > 5)
    res = await fn._embed_with_task_async(["t1", "t2"], task="query")
    assert len(res) == 2
    mock_truncate.assert_called()
    mock_engine.embed.assert_called_once()
    
    # Test doc task, truncation doesnt apply (10 <= 20)
    mock_truncate.reset_mock()
    mock_engine.embed.reset_mock()
    res = await fn._embed_with_task_async(["t1"], task="doc")
    mock_truncate.assert_not_called()
    assert len(res) == 2 # mock always returns 2

@pytest.mark.anyio
@patch("backend.inference.InferenceEngine")
async def test_embed_with_task_async_string_input(MockInferenceEngine):
    mock_engine = MagicMock()
    async def mock_embed(*args, **kwargs):
        return [[0.1, 0.2]]
    mock_engine.embed.side_effect = mock_embed
    MockInferenceEngine.return_value = mock_engine
    
    fn = AIEmbeddingFunction(model_name="test-model")
    res = await fn._embed_with_task_async("test string", task="query")
    assert res == [[0.1, 0.2]]

@pytest.mark.anyio
@patch("backend.inference.InferenceEngine")
async def test_embed_with_task_async_exception(MockInferenceEngine):
    mock_engine = MagicMock()
    async def mock_embed(*args, **kwargs):
        raise RuntimeError("Embedding failed")
    mock_engine.embed.side_effect = mock_embed
    MockInferenceEngine.return_value = mock_engine
    
    fn = AIEmbeddingFunction(model_name="test-model")
    with pytest.raises(RuntimeError, match="Embedding failed"):
        await fn._embed_with_task_async(["test string"], task="query")

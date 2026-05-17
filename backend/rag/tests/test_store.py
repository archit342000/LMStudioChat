import pytest
import time
from unittest.mock import patch, MagicMock
from backend.rag.store import RAGStore

@pytest.fixture
def mock_rag_manager():
    manager = MagicMock()
    v_col = MagicMock()
    bm25_col = MagicMock()
    manager._ensure_l2_collections.return_value = (v_col, bm25_col)
    
    async def mock_embed(texts, task, chat_id):
        return [[0.1, 0.2]] * len(texts)
    manager.embed_texts.side_effect = mock_embed
    
    return manager

def test_store_init(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    assert store.rag_manager == mock_rag_manager
    assert store.collection_name == "test_collection"
    assert store.vector_collection == mock_rag_manager._ensure_l2_collections.return_value[0]
    assert store.bm25_collection == mock_rag_manager._ensure_l2_collections.return_value[1]

@pytest.mark.anyio
async def test_store_documents(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    
    # Empty documents
    res = await store.store([], [])
    assert res == []
    
    # valid documents
    docs = ["doc1", "doc2"]
    metas = [{"m": 1}, {"m": 2}]
    ids = ["id1", "id2"]
    
    res = await store.store(docs, metas, ids)
    assert res == ids
    store.vector_collection.upsert.assert_called_once()
    store.bm25_collection.upsert.assert_called_once()

@pytest.mark.anyio
async def test_store_documents_no_ids(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    docs = ["doc1"]
    metas = [{"m": 1}]
    
    res = await store.store(docs, metas)
    assert len(res) == 1
    assert isinstance(res[0], str)

@pytest.mark.anyio
@patch("backend.config.RAG_FETCH_MULTIPLIER", 2)
@patch("backend.config.HYBRID_SEARCH_ENABLED", True)
@patch("backend.config.RAG_MIN_SEMANTIC_SCORE", 0.1)
async def test_retrieve_by_query_hybrid(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    
    store.vector_collection.query.return_value = {
        'ids': [['id1', 'id2']],
        'documents': [['doc1', 'doc2']],
        'metadatas': [[{'m':1}, {'m':2}]],
        'distances': [[0.1, 0.8]] # 1 - 0.1/2 = 0.95, 1 - 0.8/2 = 0.6
    }
    
    store.bm25_collection.get.return_value = {
        'ids': ['id1', 'id2'],
        'documents': ['doc1 search', 'doc2 not'],
        'metadatas': [{'m':1}, {'m':2}]
    }
    
    res = await store.retrieve_by_query("search", n_results=1, hybrid=True)
    assert len(res) == 1
    assert res[0]['id'] in ['id1', 'id2']

@pytest.mark.anyio
@patch("backend.config.HYBRID_SEARCH_ENABLED", False)
@patch("backend.config.RAG_MIN_SEMANTIC_SCORE", 0.0)
async def test_retrieve_by_query_no_hybrid(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    
    store.vector_collection.query.return_value = {
        'ids': [['id1', 'id2']],
        'documents': [['doc1', 'doc2']],
        'metadatas': [[{'m':1}, {'m':2}]],
        'distances': [[0.1, 0.8]]
    }
    
    res = await store.retrieve_by_query("search", n_results=2, hybrid=False)
    assert len(res) == 2
    assert res[0]['id'] == 'id1' # 0.95 score

@pytest.mark.anyio
async def test_retrieve_by_query_empty_embs(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    async def mock_embed_empty(texts, task, chat_id):
        return []
    mock_rag_manager.embed_texts.side_effect = mock_embed_empty
    res = await store.retrieve_by_query("search")
    assert res == []

def test_results_to_docs(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    assert store._results_to_docs(None) == []
    
    res = {
        'ids': [['id1']],
        'documents': [['doc1']],
        'metadatas': [[{'m':1}]],
        'distances': [[0.1]]
    }
    docs = store._results_to_docs(res)
    assert len(docs) == 1
    assert docs[0]['id'] == 'id1'
    assert docs[0]['score'] == 0.95

def test_results_to_docs_empty(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    assert store._results_to_docs({}) == []
    assert store._results_to_docs({'ids': []}) == []

def test_fuse_results(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    v_docs = [{'id': 'id1', 'score': 0.9, 'text': 'a'}, {'id': 'id2', 'score': 0.8, 'text': 'b'}]
    bm25_docs = [{'id': 'id2', 'lexical_score': 1.0, 'text': 'b'}, {'id': 'id1', 'lexical_score': 0.5, 'text': 'a'}]
    
    fused = store._fuse_results(v_docs, bm25_docs, n_results=2)
    assert len(fused) == 2

def test_score_only_results(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    docs = [{'id': 'id1', 'score': 0.8}, {'id': 'id2', 'score': 0.9}]
    res = store._score_only_results(docs, 1)
    assert len(res) == 1
    assert res[0]['id'] == 'id2'

def test_list_all(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    store.vector_collection.get.return_value = ["res"]
    assert store.list_all(where={"id": "1"}) == ["res"]
    store.vector_collection.get.assert_called_once_with(where={"id": "1"})

def test_cleanup(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    assert store.cleanup(where={"id": "1"}) is True
    store.vector_collection.delete.assert_called_once_with(where={"id": "1"})
    store.bm25_collection.delete.assert_called_once_with(where={"id": "1"})

def test_cleanup_exception(mock_rag_manager):
    store = RAGStore(mock_rag_manager, "test_collection")
    store.vector_collection.delete.side_effect = Exception("error")
    assert store.cleanup(where={"id": "1"}) is False

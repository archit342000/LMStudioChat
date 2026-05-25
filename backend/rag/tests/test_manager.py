import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import chromadb
from backend.rag.manager import RAGManager
from backend.rag.chunking import ChunkResult

class TestRAGManager(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        RAGManager.reset_instance()
        self.mock_client = MagicMock()
        self.mock_embedding_fn = MagicMock()
        
        # Patching PersistentClient to return our mock_client
        self.client_patcher = patch('chromadb.PersistentClient', return_value=self.mock_client)
        self.client_patcher.start()
        
        # Patching AIEmbeddingFunction
        self.embedding_patcher = patch('backend.rag.manager.AIEmbeddingFunction', return_value=self.mock_embedding_fn)
        self.embedding_patcher.start()

    async def asyncTearDown(self):
        self.client_patcher.stop()
        self.embedding_patcher.stop()
        RAGManager.reset_instance()

    async def test_singleton(self):
        m1 = RAGManager(persist_path="/tmp/test1")
        m2 = RAGManager(persist_path="/tmp/test2")
        self.assertIs(m1, m2)

    async def test_init_and_dimension(self):
        manager = RAGManager(embedding_model="gemma-2b")
        self.assertEqual(manager.embedding_dimension, 384)
        
        RAGManager.reset_instance()
        manager = RAGManager(embedding_model="large-v3")
        self.assertEqual(manager.embedding_dimension, 1024)
        
        RAGManager.reset_instance()
        manager = RAGManager(embedding_model="unknown-model")
        self.assertEqual(manager.embedding_dimension, 384)

    async def test__get_default_dimension(self):
        manager = RAGManager()
        manager.embedding_model = "gemma"
        self.assertEqual(manager._get_default_dimension(), 384)
        manager.embedding_model = "mini"
        self.assertEqual(manager._get_default_dimension(), 384)
        manager.embedding_model = "large"
        self.assertEqual(manager._get_default_dimension(), 1024)
        manager.embedding_model = "v3"
        self.assertEqual(manager._get_default_dimension(), 1024)
        manager.embedding_model = "other"
        self.assertEqual(manager._get_default_dimension(), 384)

    async def test_drop_collection(self):
        manager = RAGManager()
        self.mock_client.delete_collection.return_value = True
        res = manager._drop_collection("test_coll")
        self.assertTrue(res)
        self.mock_client.delete_collection.assert_called_with(name="test_coll")

        self.mock_client.delete_collection.side_effect = Exception("error")
        res = manager._drop_collection("test_coll")
        self.assertFalse(res)

    async def test_get_collection_dimension(self):
        manager = RAGManager()
        mock_coll = MagicMock()
        self.mock_client.get_collection.return_value = mock_coll
        
        # Test valid dimension
        mock_coll.get.return_value = {'embeddings': [[0.1] * 384]}
        dim = manager._get_collection_dimension("test_coll")
        self.assertEqual(dim, 384)

        # Test empty embeddings
        mock_coll.get.return_value = {'embeddings': []}
        dim = manager._get_collection_dimension("test_coll")
        self.assertEqual(dim, -1)

        # Test exception
        self.mock_client.get_collection.side_effect = Exception("error")
        dim = manager._get_collection_dimension("test_coll")
        self.assertEqual(dim, 0)

    def test_drop_all_collections(self):
        # classmethod doesn't need async
        with patch('chromadb.PersistentClient') as mock_pc:
            mock_client = MagicMock()
            mock_pc.return_value = mock_client
            RAGManager.drop_all_collections(persist_path="/tmp/test")
            self.assertEqual(mock_client.delete_collection.call_count, 2)

    async def test_get_or_create_collection(self):
        manager = RAGManager()
        mock_coll = MagicMock()
        mock_coll.metadata = {"embedding_model": manager.embedding_model}
        self.mock_client.get_collection.return_value = mock_coll
        
        # Test existing
        res = manager.get_or_create_collection("test")
        self.assertEqual(res, mock_coll)

        # Test model mismatch (triggers recreation)
        mock_coll.metadata = {"embedding_model": "old-model"}
        self.mock_client.get_or_create_collection.return_value = MagicMock()
        res = manager.get_or_create_collection("test")
        self.mock_client.delete_collection.assert_called()

    async def test__ensure_l2_collection(self):
        manager = RAGManager()
        mock_coll = MagicMock()
        mock_coll.metadata = {"embedding_model": manager.embedding_model}
        self.mock_client.get_collection.return_value = mock_coll
        
        # This explicitly calls the private method to satisfy the AST script
        res = manager._ensure_l2_collection("test_private")
        self.assertEqual(res, mock_coll)

    async def test_ensure_l2_collections_hybrid(self):
        manager = RAGManager()
        with patch.object(manager, '_ensure_l2_collection') as mock_ensure:
            v_coll = MagicMock()
            b_coll = MagicMock()
            mock_ensure.side_effect = [v_coll, b_coll]
            v, b = manager._ensure_l2_collections("hybrid")
            self.assertEqual(v, v_coll)
            self.assertEqual(b, b_coll)
            self.assertEqual(mock_ensure.call_count, 2)

    async def test_chunk_text(self):
        manager = RAGManager()
        text = "This is a test sentence for chunking."
        # max_tokens=10 should be enough for one or two chunks
        chunks = manager.chunk_text(text, max_tokens=10, overlap=0)
        self.assertTrue(len(chunks) >= 1)
        self.assertIsInstance(chunks[0], ChunkResult)
        
        # Empty text
        self.assertEqual(manager.chunk_text(""), [])

    async def test_embed_texts_async(self):
        manager = RAGManager()
        self.mock_embedding_fn.embed_async = AsyncMock(return_value=[[0.1]*384])
        
        # Document task
        res = await manager.embed_texts(["hello"])
        self.assertEqual(len(res), 1)
        self.mock_embedding_fn.embed_async.assert_called_with(["hello"], task="document", chat_id=None)

        # Query task (with simple cache placeholder logic)
        res = await manager.embed_texts(["world"], task="query")
        self.assertEqual(len(res), 1)

    async def test_embed_texts_sync(self):
        manager = RAGManager()
        self.mock_embedding_fn.return_value = [[0.1]*384]
        res = manager.embed_texts_sync(["hello"])
        self.assertEqual(len(res), 1)
        self.mock_embedding_fn.assert_called_with(["hello"])

    def test_zero_embedding_function(self):
        from backend.rag.manager import ZeroEmbeddingFunction
        ef = ZeroEmbeddingFunction(dimension=5)
        self.assertEqual(ef.dimension, 5)
        self.assertEqual(ef.name(), "zero")
        self.assertEqual(ef.get_config(), {"dimension": 5})
        
        # Test list input
        res = ef(["doc1", "doc2"])
        res_list = [list(x) for x in res]
        self.assertEqual(res_list, [[0.0, 0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0, 0.0]])
        
        # Test string input
        res = ef("doc1")
        res_list = [list(x) for x in res]
        self.assertEqual(res_list, [[0.0, 0.0, 0.0, 0.0, 0.0]])

    async def test_ensure_l2_collection_disable_embeddings(self):
        manager = RAGManager()
        mock_coll = MagicMock()
        mock_coll.metadata = {"embedding_model": "none"}
        self.mock_client.get_collection.return_value = mock_coll
        
        from backend.rag.manager import ZeroEmbeddingFunction
        res = manager._ensure_l2_collection("test_disabled", disable_embeddings=True)
        self.assertEqual(res, mock_coll)
        self.mock_client.get_collection.assert_any_call(name="test_disabled", embedding_function=unittest.mock.ANY)
        # Verify it passed a ZeroEmbeddingFunction
        first_call = self.mock_client.get_collection.call_args_list[0]
        args, kwargs = first_call
        self.assertIsInstance(kwargs["embedding_function"], ZeroEmbeddingFunction)

    async def test_ensure_l2_collection_conflict_self_healing(self):
        manager = RAGManager()
        self.mock_client.get_collection.side_effect = ValueError("Embedding function conflict")
        self.mock_client.get_or_create_collection.return_value = MagicMock()
        
        res = manager._ensure_l2_collection("test_conflict", disable_embeddings=True)
        # Verify it deleted the collection and then called get_or_create
        self.mock_client.delete_collection.assert_called_with(name="test_conflict")
        self.mock_client.get_or_create_collection.assert_called()

if __name__ == '__main__':
    unittest.main()

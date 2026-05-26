import pytest
from unittest.mock import patch, MagicMock
from backend.rag.providers import RAGProvider
from backend.rag.manager import RAGManager

def test_rag_provider_get_manager():
    RAGProvider.reset()
    assert RAGProvider._initialized == False
    assert RAGProvider._rag_manager is None
    
    # Mock __init__ to avoid ChromaDB interactions
    with patch.object(RAGManager, "__init__", return_value=None) as mock_init:
        manager1 = RAGProvider.get_manager("path", "model")
        
        assert RAGProvider._initialized == True
        assert RAGProvider._rag_manager is not None
        assert isinstance(manager1, RAGManager)
        
        mock_init.assert_called_once_with(
            persist_path="path",
            embedding_model="model"
        )
        
        config = RAGProvider.get_config()
        assert config['persist_path'] == "path"
        
        # Second call returns same instance
        manager2 = RAGProvider.get_manager("path2", "model2")
        assert manager1 is manager2
        mock_init.assert_called_once() # Should not be called again

def test_rag_provider_reset():
    RAGProvider.reset()
    with patch.object(RAGManager, "__init__", return_value=None):
        RAGProvider.get_manager("path", "model")
    
    assert RAGProvider._initialized == True
    
    RAGProvider.reset()
    assert RAGProvider._initialized == False
    assert RAGProvider._rag_manager is None
    assert RAGProvider.get_config() == {}
    assert RAGManager._instance is None
    assert RAGManager._initialized is False

def test_rag_provider_get_manager_exception():
    RAGProvider.reset()
    with patch.object(RAGManager, "__init__", side_effect=Exception("Test Error")):
        with pytest.raises(RuntimeError, match="Failed to initialize RAGManager via RAGProvider: Test Error"):
            RAGProvider.get_manager("path", "model")

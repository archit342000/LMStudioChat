import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.tools.agents.document_agent.tools import (
    _get_managers,
    document_agent_rag_tool,
    grep_uploaded_file_tool,
    read_uploaded_file_tool
)

def test_get_managers():
    with patch('backend.tools.agents.document_agent.tools.get_embedding_model') as mock_get_emb, \
         patch('backend.tools.agents.document_agent.tools.RAGProvider') as mock_rag_provider, \
         patch('backend.tools.agents.document_agent.tools.FileManager') as mock_fm, \
         patch('backend.tools.agents.document_agent.tools.FileRAG') as mock_file_rag:
        
        mock_emb = MagicMock()
        mock_get_emb.return_value = mock_emb
        
        mock_manager = MagicMock()
        mock_rag_provider.get_manager.return_value = mock_manager
        
        fm, fr = _get_managers()
        
        assert fm == mock_fm.return_value
        assert fr == mock_file_rag.return_value
        mock_fm.assert_called_once_with(rag_manager=mock_manager)
        mock_file_rag.assert_called_once_with(rag_manager=mock_manager)

@pytest.mark.anyio
async def test_document_agent_rag_tool_no_results():
    mock_fm = MagicMock()
    mock_fr = MagicMock()
    mock_fr.retrieve_for_file = AsyncMock(return_value=[])
    
    with patch('backend.tools.agents.document_agent.tools._get_managers', return_value=(mock_fm, mock_fr)):
        res = await document_agent_rag_tool("chat_id", "file_id", "query", depth="standard")
        assert res["success"] is True
        assert res["results"] == []
        assert "No semantic matches" in res["message"]
        mock_fr.retrieve_for_file.assert_awaited_once_with("file_id", "query", n_results=5, chat_id="chat_id")

@pytest.mark.anyio
async def test_document_agent_rag_tool_with_results():
    mock_fm = MagicMock()
    mock_fr = MagicMock()
    mock_fr.retrieve_for_file = AsyncMock(return_value=["res1"])
    
    with patch('backend.tools.agents.document_agent.tools._get_managers', return_value=(mock_fm, mock_fr)):
        res = await document_agent_rag_tool("chat_id", "file_id", "query", depth="deep")
        assert res["success"] is True
        assert res["results"] == ["res1"]

@pytest.mark.anyio
async def test_grep_uploaded_file_tool():
    mock_fm = MagicMock()
    mock_fm.grep_file = MagicMock(return_value={"success": True})
    mock_fr = MagicMock()
    
    with patch('backend.tools.agents.document_agent.tools._get_managers', return_value=(mock_fm, mock_fr)):
        res = await grep_uploaded_file_tool("chat_id", "file_id", "query", True, 200)
        assert res == {"success": True}
        mock_fm.grep_file.assert_called_once_with("file_id", "query", True, 200)

@pytest.mark.anyio
async def test_read_uploaded_file_tool():
    mock_fm = MagicMock()
    mock_fm.read_file_range = MagicMock(return_value={"content": "hello"})
    mock_fr = MagicMock()
    
    with patch('backend.tools.agents.document_agent.tools._get_managers', return_value=(mock_fm, mock_fr)):
        res = await read_uploaded_file_tool("chat_id", "file_id", 1, 10, None)
        assert res == {"content": "hello"}
        mock_fm.read_file_range.assert_called_once_with("file_id", 1, 10, None)

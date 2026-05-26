import pytest
from unittest.mock import MagicMock, patch
from backend.tools.files import read_file

@pytest.fixture
def mock_db():
    with patch('backend.tools.files.db') as mock:
        yield mock

@pytest.fixture
def mock_rag():
    with patch('backend.tools.files.FileRAG') as mock:
        yield mock

def test_read_file_not_found(mock_db):
    mock_db.get_file.return_value = None
    res = read_file("file1")
    assert "Error: File with ID file1 not found." in res

def test_read_file_full_content(mock_db):
    mock_db.get_file.return_value = {
        "original_filename": "test.txt",
        "content_text": "Hello World"
    }
    res = read_file("file1")
    assert "Content of 'test.txt':" in res
    assert "Hello World" in res

def test_read_file_truncation(mock_db):
    mock_db.get_file.return_value = {
        "original_filename": "long.txt",
        "content_text": "A" * 30000
    }
    res = read_file("file1")
    assert "(Truncated to first 20000 characters)" in res
    assert len(res) > 20000

def test_read_file_rag(mock_db, mock_rag):
    mock_db.get_file.return_value = {"original_filename": "doc.pdf"}
    mock_file_rag = mock_rag.return_value
    mock_file_rag.retrieve_for_file.return_value = [
        {"text": "Relevant part", "score": 0.9}
    ]
    
    with patch('backend.tools.files.RAGProvider.get_manager'), \
         patch('backend.tools.files.get_embedding_model'):
        res = read_file("file1", query="specific info")
        
        assert "Found 1 relevant sections" in res
        assert "Relevant part" in res

def test_read_file_db_error(mock_db):
    mock_db.get_file.side_effect = Exception("DB Lock Error")
    res = read_file("file1")
    assert "Error: Failed to access database: DB Lock Error" in res

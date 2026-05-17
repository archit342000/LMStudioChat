import os
import json
import pytest
import uuid
import base64
import re
from unittest.mock import MagicMock, patch, mock_open, AsyncMock, ANY
from backend.files.manager import FileManager, FileMetadata, SUPPORTED_MIME_TYPES
from backend.config import FILE_UPLOAD_MAX_SIZE, FILE_STORAGE_PATH

@pytest.fixture
def mock_db():
    with patch('backend.files.manager.db') as mock:
        yield mock

@pytest.fixture
def mock_rag_manager():
    mock = MagicMock()
    mock._ensure_l2_collections.return_value = (MagicMock(), MagicMock())
    return mock

@pytest.fixture
def file_manager(mock_rag_manager):
    with patch('os.makedirs'):
        return FileManager(storage_path="/mock/storage", rag_manager=mock_rag_manager)

def test_file_metadata_init():
    metadata = FileMetadata(
        file_id="file_1",
        chat_id="chat_1",
        original_filename="test.txt",
        stored_filename="stored_test.txt",
        mime_type="text/plain",
        file_size=100
    )
    assert metadata.file_id == "file_1"
    assert metadata.created_at is not None

def test_file_manager_init(mock_rag_manager):
    with patch('os.makedirs') as mock_makedirs:
        fm = FileManager(storage_path="/mock/storage", rag_manager=mock_rag_manager)
        assert fm.storage_path == "/mock/storage"
        mock_makedirs.assert_called_with("/mock/storage", exist_ok=True)
        assert fm.rag_manager == mock_rag_manager

    with pytest.raises(RuntimeError):
        FileManager(rag_manager=None)

def test_generate_file_id(file_manager):
    file_id = file_manager._generate_file_id()
    assert file_id.startswith("file_")
    assert len(file_id) == 21  # "file_" (5) + 16 hex chars

def test_get_safe_filename(file_manager):
    with patch('uuid.uuid4') as mock_uuid:
        mock_uuid.return_value.hex = "1234567890abcdef1234567890abcdef"
        safe_name = file_manager._get_safe_filename("my test file.TXT")
        assert safe_name == "1234567890abcdef.txt"

def test_validate_file_type(file_manager):
    assert file_manager._validate_file_type("text/plain") is True
    assert file_manager._validate_file_type("application/pdf") is True
    assert file_manager._validate_file_type("invalid/type") is False

def test_get_extension_for_mime(file_manager):
    assert file_manager._get_extension_for_mime("text/plain") == ".txt"
    assert file_manager._get_extension_for_mime("application/pdf") == ".pdf"
    assert file_manager._get_extension_for_mime("unknown") == ""

def test_save_file_metadata(file_manager, mock_db):
    metadata = file_manager.save_file_metadata(
        file_id="f1", chat_id="c1", original_filename="o.txt",
        stored_filename="s.txt", mime_type="text/plain", file_size=10,
        content_text="hello"
    )
    mock_db.save_file.assert_called_once()
    assert metadata.file_id == "f1"
    assert metadata.content_text == "hello"

def test_is_readable_text_static():
    # Valid text
    with patch('builtins.open', mock_open(read_data=b"hello world")):
        assert FileManager.is_readable_text("dummy.txt") is True

    # Empty file
    with patch('builtins.open', mock_open(read_data=b"")):
        assert FileManager.is_readable_text("dummy.txt") is True

    # Binary file (contains null byte)
    with patch('builtins.open', mock_open(read_data=b"hello\x00world")):
        assert FileManager.is_readable_text("dummy.txt") is False

    # Latin-1 text
    with patch('builtins.open', mock_open(read_data="h\u00e9llo".encode('latin-1'))):
        assert FileManager.is_readable_text("dummy.txt") is True

    # Exception
    with patch('builtins.open', side_effect=Exception("error")):
        assert FileManager.is_readable_text("dummy.txt") is False

def test_extract_file_content_text(file_manager):
    # UTF-8
    with patch('builtins.open', mock_open(read_data="hello utf-8")):
        content = file_manager.extract_file_content("test.txt", "text/plain")
        assert json.loads(content)["text"] == "hello utf-8"

    # Latin-1 fallback
    with patch('builtins.open') as mock_file:
        # First call (utf-8) fails, second call (latin-1) succeeds
        handle1 = MagicMock()
        handle1.read.side_effect = UnicodeDecodeError('utf-8', b'', 0, 1, '')
        handle1.__enter__.return_value = handle1
        
        handle2 = MagicMock()
        handle2.read.return_value = "hello latin-1"
        handle2.__enter__.return_value = handle2
        
        mock_file.side_effect = [handle1, handle2]
        
        content = file_manager.extract_file_content("test.txt", "text/plain")
        assert json.loads(content)["text"] == "hello latin-1"

def test_extract_file_content_pdf(file_manager):
    with patch.object(file_manager, '_extract_pdf_content', return_value='pdf content'):
        content = file_manager.extract_file_content("test.pdf", "application/pdf")
        assert json.loads(content)["text"] == "pdf content"

def test_extract_file_content_docx(file_manager):
    with patch.object(file_manager, '_extract_docx_content', return_value='docx content'):
        content = file_manager.extract_file_content("test.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        assert json.loads(content)["text"] == "docx content"

def test_extract_file_content_placeholders(file_manager):
    assert "Image file" in json.loads(file_manager.extract_file_content("test.png", "image/png"))["text"]
    assert "Video file" in json.loads(file_manager.extract_file_content("test.mp4", "video/mp4"))["text"]
    assert "Audio file" in json.loads(file_manager.extract_file_content("test.mp3", "audio/mpeg"))["text"]

def test_extract_pdf_content(file_manager):
    with patch('backend.files.manager.PDF_EXTRACTOR_ENABLED', True):
        with patch('backend.files.manager.PDF_EXTRACTION_MIN_CONTENT', 5):
            with patch.object(file_manager.pdf_extractor, 'extract', return_value=("Extracted PDF Text", "strategy")):
                assert file_manager._extract_pdf_content("test.pdf") == "Extracted PDF Text"

            with patch.object(file_manager.pdf_extractor, 'extract', return_value=("Too short", "strategy")):
                with patch('backend.files.manager.PDF_EXTRACTION_MIN_CONTENT', 100):
                    assert "text extraction failed" in file_manager._extract_pdf_content("test.pdf")

    with patch('backend.files.manager.PDF_EXTRACTOR_ENABLED', False):
        assert "extraction disabled" in file_manager._extract_pdf_content("test.pdf")

def test_extract_docx_content(file_manager):
    with patch('docx.Document') as mock_doc:
        mock_para = MagicMock()
        mock_para.text = "Hello DOCX"
        mock_doc.return_value.paragraphs = [mock_para]
        assert file_manager._extract_docx_content("test.docx") == "Hello DOCX"

    with patch('builtins.__import__', side_effect=ImportError):
        with patch.dict('sys.modules', {'docx': None}):
            assert "install python-docx" in file_manager._extract_docx_content("test.docx")

    with patch('docx.Document', side_effect=Exception("error")):
        assert "Error extracting DOCX" in file_manager._extract_docx_content("test.docx")

def test_encode_file_for_vision(file_manager):
    with patch('mimetypes.guess_type', return_value=("image/png", None)):
        with patch('builtins.open', mock_open(read_data=b"image data")):
            encoded, mime = file_manager.encode_file_for_vision("test.png")
            assert encoded == base64.b64encode(b"image data").decode('utf-8')
            assert mime == "image/png"

        with patch('builtins.open', side_effect=Exception("error")):
            encoded, mime = file_manager.encode_file_for_vision("test.png")
            assert encoded == ""

def test_upload_file_success(file_manager, mock_db):
    with patch('os.path.exists', return_value=True), \
         patch('os.path.getsize', return_value=100), \
         patch('shutil.copy2'), \
         patch('backend.files.manager.FILE_RAG_ENABLED', True), \
         patch.object(file_manager, 'extract_file_content', return_value=json.dumps({"format": "text", "text": "content that is long enough to be indexed in RAG system"})), \
         patch.object(file_manager, 'file_rag') as mock_file_rag:
        
        mock_file_rag.store_file = AsyncMock(return_value=["id1"])
        file_manager.file_rag = mock_file_rag
        
        metadata = file_manager.upload_file("local.txt", "chat1", "original.txt")
        
        assert metadata is not None
        assert metadata.original_filename == "original.txt"
        mock_db.save_file.assert_called_once()
        mock_file_rag.store_file.assert_called_once()

def test_upload_file_failures(file_manager):
    # Not found
    with patch('os.path.exists', return_value=False):
        assert file_manager.upload_file("missing.txt", "c1", "o.txt") is None

    # Too large
    with patch('os.path.exists', return_value=True), \
         patch('os.path.getsize', return_value=FILE_UPLOAD_MAX_SIZE + 1):
        assert file_manager.upload_file("large.txt", "c1", "o.txt") is None

    # Unsupported type
    with patch('os.path.exists', return_value=True), \
         patch('os.path.getsize', return_value=100), \
         patch('mimetypes.guess_type', return_value=("application/unsupported", None)):
        with patch('backend.config.FILE_UPLOAD_ALLOWED_TYPES', ['text/plain']):
            assert file_manager.upload_file("test.xyz", "c1", "test.xyz") is None

@pytest.mark.anyio
async def test_upload_file_async_success(file_manager, mock_db):
    with patch('os.path.exists', return_value=True), \
         patch('os.path.getsize', return_value=100), \
         patch('shutil.copy2'), \
         patch('backend.files.manager.FILE_RAG_ENABLED', True), \
         patch.object(file_manager, 'extract_file_content', return_value="content that is long enough to be indexed in RAG system"), \
         patch.object(file_manager, 'file_rag') as mock_file_rag:
        
        mock_file_rag.store_file = AsyncMock(return_value=["id1"])
        file_manager.file_rag = mock_file_rag
        
        metadata = await file_manager.upload_file_async("local.txt", "chat1", "original.txt")
        
        assert metadata is not None
        mock_db.save_file.assert_called_once()
        mock_db.update_file_content.assert_called_once()
        mock_db.update_file_processing_status.assert_called_with(metadata.file_id, 'completed')

@pytest.mark.anyio
async def test_upload_file_async_failure_during_processing(file_manager, mock_db):
    with patch('os.path.exists', return_value=True), \
         patch('os.path.getsize', return_value=100), \
         patch('shutil.copy2'), \
         patch.object(file_manager, 'extract_file_content', side_effect=Exception("processing error")):
        
        metadata = await file_manager.upload_file_async("local.txt", "chat1", "original.txt")
        assert metadata is None
        
        mock_db.update_file_processing_status.assert_any_call(ANY, 'failed')

@pytest.mark.anyio
async def test_process_file_background(file_manager, mock_db):
    # Case: Already processed
    mock_db.get_file.return_value = {"content_text": "already there"}
    await file_manager._process_file_background("f1", "c1", "path", "text/plain")
    mock_db.update_file_processing_status.assert_called_with("f1", "completed")

    # Case: New processing
    mock_db.get_file.return_value = {"content_text": ""}
    with patch.object(file_manager, 'extract_file_content', return_value="new content that is long enough to be indexed in RAG system"), \
         patch.object(file_manager, 'file_rag') as mock_file_rag:
        mock_file_rag.store_file = AsyncMock()
        file_manager.file_rag = mock_file_rag
        
        await file_manager._process_file_background("f2", "c2", "path", "text/plain", "orig.txt")
        
        mock_db.update_file_processing_status.assert_any_call("f2", "processing")
        mock_db.update_file_content.assert_called_with("f2", "new content that is long enough to be indexed in RAG system")
        mock_file_rag.store_file.assert_called_once()
        mock_db.update_file_processing_status.assert_any_call("f2", "completed")

def test_update_file_content(file_manager, mock_db):
    assert file_manager.update_file_content("f1", "content") is True
    mock_db.update_file_content.assert_called_with("f1", "content")
    
    mock_db.update_file_content.side_effect = Exception("error")
    assert file_manager.update_file_content("f1", "content") is False

def test_update_file_processing_status(file_manager, mock_db):
    assert file_manager.update_file_processing_status("f1", "completed") is True
    mock_db.update_file_processing_status.assert_called_with("f1", "completed")
    
    mock_db.update_file_processing_status.side_effect = Exception("error")
    assert file_manager.update_file_processing_status("f1", "completed") is False

def test_get_file(file_manager, mock_db):
    mock_db.get_file.return_value = {
        'id': 'f1', 'chat_id': 'c1', 'original_filename': 'o.txt',
        'stored_filename': 's.txt', 'mime_type': 'text/plain',
        'file_size': 10, 'content_text': 'hello', 'created_at': 123
    }
    metadata = file_manager.get_file("f1")
    assert metadata.file_id == "f1"
    
    mock_db.get_file.return_value = None
    assert file_manager.get_file("nonexistent") is None

def test_grep_file_text(file_manager, mock_db):
    content = json.dumps({"format": "text", "text": "line 1\nline 2 with target\nline 3"})
    mock_db.get_file.return_value = {
        'id': 'f1', 'chat_id': 'c1', 'original_filename': 'o.txt',
        'stored_filename': 's.txt', 'mime_type': 'text/plain',
        'file_size': 10, 'content_text': content, 'created_at': 123
    }
    
    # Literal search
    result = file_manager.grep_file("f1", "target")
    assert result["success"] is True
    assert len(result["matches"]) == 1
    assert result["matches"][0]["line_number"] == 2
    
    # Regex search
    result = file_manager.grep_file("f1", "line [0-9]", is_regex=True)
    assert result["total_matches_found"] == 3

    # Truncation
    many_lines = "\n".join([f"target {i}" for i in range(100)])
    mock_db.get_file.return_value['content_text'] = json.dumps({"format": "text", "text": many_lines})
    result = file_manager.grep_file("f1", "target")
    assert result["total_matches_found"] == 50
    assert result["truncated"] is True

    # Invalid regex
    result = file_manager.grep_file("f1", "[", is_regex=True)
    assert result["success"] is False
    assert "Invalid regex" in result["error"]

def test_grep_file_pages(file_manager, mock_db):
    content = json.dumps({"format": "pages", "pages": ["page 1 text", "page 2 with   target"]})
    mock_db.get_file.return_value = {
        'id': 'f1', 'chat_id': 'c1', 'original_filename': 'o.pdf',
        'stored_filename': 's.pdf', 'mime_type': 'application/pdf',
        'file_size': 10, 'content_text': content, 'created_at': 123
    }
    
    # Flexible whitespace
    result = file_manager.grep_file("f1", "with target")
    assert result["success"] is True
    assert result["matches"][0]["page_number"] == 2

    # Regex search in pages
    result = file_manager.grep_file("f1", "p[a-z]ge", is_regex=True)
    assert result["total_matches_found"] == 2

def test_read_file_range_lines(file_manager, mock_db):
    content = json.dumps({"format": "text", "text": "\n".join([f"line {i}" for i in range(1, 100)])})
    mock_db.get_file.return_value = {
        'id': 'f1', 'chat_id': 'c1', 'original_filename': 'o.txt',
        'stored_filename': 's.txt', 'mime_type': 'text/plain',
        'file_size': 10, 'content_text': content, 'created_at': 123
    }
    
    result = file_manager.read_file_range("f1", start_line=2, end_line=4)
    assert result["success"] is True
    assert "2: line 2" in result["content"]
    assert "4: line 4" in result["content"]
    
    # Too many lines
    with patch('backend.config.FILE_AGENT_MAX_LINES_PER_REQUEST', 5):
        result = file_manager.read_file_range("f1", start_line=1, end_line=10)
        assert result["success"] is False
        assert "too many lines" in result["error"]

    # Truncation
    with patch('backend.config.FILE_AGENT_MAX_CHARS_PER_READ', 10):
        result = file_manager.read_file_range("f1", start_line=1, end_line=2)
        assert result["truncated"] is True
        assert "[WARNING: Content truncated" in result["content"]

def test_read_file_range_pages(file_manager, mock_db):
    content = json.dumps({"format": "pages", "pages": ["page 1", "page 2", "page 3"]})
    mock_db.get_file.return_value = {
        'id': 'f1', 'chat_id': 'c1', 'original_filename': 'o.pdf',
        'stored_filename': 's.pdf', 'mime_type': 'application/pdf',
        'file_size': 10, 'content_text': content, 'created_at': 123
    }
    
    result = file_manager.read_file_range("f1", page=2)
    assert result["success"] is True
    assert result["content"] == "page 2"
    
    # Page out of bounds
    result = file_manager.read_file_range("f1", page=5)
    assert result["success"] is False
    assert "not found" in result["error"]

    # Truncation
    with patch('backend.config.FILE_AGENT_MAX_CHARS_PER_READ', 2):
        result = file_manager.read_file_range("f1", page=1)
        assert result["truncated"] is True

def test_delete_file(file_manager, mock_db):
    mock_db.get_file.return_value = {
        'id': 'f1', 'chat_id': 'c1', 'original_filename': 'o.txt',
        'stored_filename': 's.txt', 'mime_type': 'text/plain',
        'file_size': 10, 'content_text': 'hello', 'created_at': 123
    }
    with patch('os.path.exists', return_value=True), \
         patch('os.remove') as mock_remove, \
         patch.object(file_manager, 'file_rag') as mock_file_rag:
        
        assert file_manager.delete_file("f1") is True
        mock_db.delete_file.assert_called_with("f1")
        mock_remove.assert_called_once()
        mock_file_rag.delete_file.assert_called_with("f1")

def test_get_chat_files(file_manager, mock_db):
    mock_db.get_chat_files.return_value = [
        {'id': 'f1', 'chat_id': 'c1', 'original_filename': 'o1.txt', 'stored_filename': 's1.txt', 'mime_type': 'text/plain', 'file_size': 10},
        {'id': 'f2', 'chat_id': 'c1', 'original_filename': 'o2.txt', 'stored_filename': 's2.txt', 'mime_type': 'text/plain', 'file_size': 20}
    ]
    files = file_manager.get_chat_files("c1")
    assert len(files) == 2
    assert files[0].file_id == "f1"
    assert files[1].file_id == "f2"

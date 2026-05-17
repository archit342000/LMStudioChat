import os
import pytest
import tempfile
import shutil
from unittest.mock import patch
from backend.database.init_db import init_db
from backend.database.db_wrapper import DatabaseWrapper

@pytest.fixture(scope="module")
def temp_db():
    tmp_dir = tempfile.mkdtemp()
    db_path = os.path.join(tmp_dir, "test_chats.db")
    with patch("backend.database.db_layer.DB_PATH", db_path), \
         patch("backend.database.init_db.DB_PATH", db_path), \
         patch("backend.database.db_wrapper.DB_PATH", db_path):
        init_db()
        wrapper = DatabaseWrapper()
        yield wrapper
    shutil.rmtree(tmp_dir)

def test_artifact_ops(temp_db):
    db = temp_db
    chat_id = "test_artifacts"
    db.ensure_chat_exists(chat_id)
    
    file_id = "file_123"
    db.save_file(
        file_id=file_id,
        chat_id=chat_id,
        original_filename="test.txt",
        stored_filename="test_stored.txt",
        mime_type="text/plain",
        file_size=100,
        content_text="file content"
    )
    
    file_meta = db.get_file(file_id)
    assert file_meta is not None
    assert file_meta['original_filename'] == "test.txt"
    
    files = db.get_chat_files(chat_id)
    assert len(files) == 1
    assert files[0]['id'] == file_id
    
    db.delete_file(file_id)
    assert db.get_file(file_id) is None

    # Test update_file_content
    file_id_2 = "file_124"
    db.save_file(
        file_id=file_id_2,
        chat_id=chat_id,
        original_filename="test2.txt",
        stored_filename="test_stored2.txt",
        mime_type="text/plain",
        file_size=100,
        content_text="old content"
    )
    res = db.update_file_content(file_id_2, "new content")
    assert res is True
    file_meta_2 = db.get_file(file_id_2)
    assert file_meta_2['content_text'] == "new content"

    # Test update_file_processing_status
    res = db.update_file_processing_status(file_id_2, "completed")
    assert res is True
    file_meta_2 = db.get_file(file_id_2)
    assert file_meta_2['processing_status'] == "completed"

    # Test flush_sse_chunks
    # Typically this works by executing a specific query, let's just make sure it runs without error
    # It attempts to update message with the role 'assistant' and partial content, but we don't have such a message yet, so it should just return True
    res = db.flush_sse_chunks(chat_id, model="test-model")
    assert res is True
    # Test collections
    parent_msg_id = 1 # Assuming integer ID, won't enforce foreign key for parent_message_id in add_collection since it's loose typing
    db.add_collection(chat_id, parent_message_id=parent_msg_id, parent_type="main", collection_type="task_list", items=[])
    cols = db.get_collections(chat_id, parent_message_id=parent_msg_id, parent_type="main")
    assert len(cols) == 1
    assert cols[0]['collection_type'] == "task_list"
    assert cols[0]['items'] == "[]"
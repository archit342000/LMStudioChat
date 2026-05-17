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

def test_history_weaving(temp_db):
    db = temp_db
    chat_id = "test_history_weaving"
    db.ensure_chat_exists(chat_id)
    
    main_msg_id = db.add_message(
        chat_id=chat_id,
        role="user",
        content="main message",
        parent_id=None
    )
    
    sub_agent_msg_id = db.add_message(
        chat_id=chat_id,
        role="assistant",
        content="sub agent content",
        parent_id=main_msg_id,
        parent_type="search_web"
    )
    
    history = db.get_woven_history(chat_id)
    assert len(history) >= 1
    assert history[0]['id'] == main_msg_id

def test_message_order_map(temp_db):
    db = temp_db
    chat_id = "test_order_map"
    db.ensure_chat_exists(chat_id)

    order_map = db.get_message_order_map(chat_id)
    assert order_map == []

    new_map = [1, 2, 3]
    assert db.update_message_order_map(chat_id, new_map) is True
    
    order_map_after = db.get_message_order_map(chat_id)
    assert order_map_after == new_map
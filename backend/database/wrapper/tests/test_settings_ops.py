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

def test_settings_ops(temp_db):
    db = temp_db
    
    # 1. Get non-existent setting returns default
    assert db.get_setting("non_existent", "default_val") == "default_val"
    assert db.get_setting("non_existent") is None
    
    # 2. Set and Get setting
    db.set_setting("test_key", {"a": 1, "b": "hello"})
    assert db.get_setting("test_key") == {"a": 1, "b": "hello"}
    
    # 3. Update existing setting (ON CONFLICT)
    db.set_setting("test_key", [1, 2, 3])
    assert db.get_setting("test_key") == [1, 2, 3]
    
    # 4. Get all settings
    all_settings = db.get_all_settings()
    assert "test_key" in all_settings
    assert all_settings["test_key"] == [1, 2, 3]
    
    # 5. Delete setting
    assert db.delete_setting("test_key") is True
    assert db.get_setting("test_key") is None
    assert db.delete_setting("test_key") is False

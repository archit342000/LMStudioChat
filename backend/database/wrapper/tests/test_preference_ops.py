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

def test_preference_ops(temp_db):
    db = temp_db
    pref_id = db.add_preference(
        content="AI tone should be professional",
        tag="style"
    )
    assert pref_id is not None
    
    prefs = db.get_all_preferences()
    assert len(prefs) > 0
    assert any(p['id'] == pref_id and p['tag'] == "style" for p in prefs)
    
    db.delete_preference(pref_id)
    assert not any(p['id'] == pref_id for p in db.get_all_preferences())

    # Test update_preference
    pref_id_2 = db.add_preference("Test content", "test_tag")
    res = db.update_preference(pref_id_2, "Updated content", "updated_tag")
    assert res is True
    prefs = db.get_all_preferences()
    updated_pref = next((p for p in prefs if p['id'] == pref_id_2), None)
    assert updated_pref is not None
    assert updated_pref['content'] == "Updated content"
    assert updated_pref['tag'] == "updated_tag"

    # Test clear_preferences
    db.add_preference("Another", "another_tag")
    assert len(db.get_all_preferences()) >= 2
    res = db.clear_preferences()
    assert res > 0
    assert len(db.get_all_preferences()) == 0
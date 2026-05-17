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

def test_file_system_ops(temp_db):
    db = temp_db
    chat_id = "test_chat_fs"
    fs_id = "fs_123"
    filename = "test_file.txt"
    
    # Ensure chat exists to satisfy foreign key constraint
    db.ensure_chat_exists(chat_id)
    
    # 1. Save FS Meta & _get_file_system_meta_fetch_internal
    db.save_file_system_meta(
        file_system_id=fs_id,
        chat_id=chat_id,
        title="Test File",
        filename=filename,
        file_system_type="text/plain",
        folder="/",
        current_version=1
    )
    
    # 2. Get FS Meta
    meta = db.get_file_system_meta(fs_id, chat_id=chat_id)
    assert meta is not None
    assert meta['filename'] == filename
    
    # Test _get_file_system_meta_fetch_internal
    internal_meta = db._get_file_system_meta_fetch_internal(fs_id, chat_id=chat_id)
    assert internal_meta['filename'] == filename
    
    # 3. Get FS Meta by path
    meta_by_path = db.get_file_system_meta_by_path(filename, chat_id=chat_id)
    assert meta_by_path is not None
    assert meta_by_path['id'] == fs_id
    
    # 4. Save FS Version & Content
    db.save_file_system_version(
        file_system_id=fs_id,
        chat_id=chat_id,
        version_number=1,
        content="hello world",
        comment="Initial version"
    )
    db.save_file_system_version(
        file_system_id=fs_id,
        chat_id=chat_id,
        version_number=2,
        content="hello updated",
        comment="Second version"
    )
    
    # 5. create_file_system_with_version
    fs_id_2 = "fs_124"
    db.create_file_system_with_version(
        file_system_id=fs_id_2,
        chat_id=chat_id,
        title="File 2",
        filename="test2.txt",
        file_system_type="text/plain",
        folder="/",
        content="content 2",
        comment="Init"
    )    
    # 6. get_all_file_systems
    all_fs = db.get_all_file_systems()
    assert len(all_fs) >= 2
    
    # 7. get_owner_file_systems
    owner_fs = db.get_owner_file_systems(chat_id=chat_id)
    assert len(owner_fs) >= 2
    
    # 8. get_chat_file_systems
    chat_fs = db.get_chat_file_systems(chat_id)
    assert len(chat_fs) >= 2
    
    # 9. get_file_system_versions
    versions = db.get_file_system_versions(fs_id, chat_id=chat_id)
    assert len(versions) == 2
    
    # 10. get_file_system_content_by_id
    content_list = db.get_file_system_content_by_id(fs_id, chat_id=chat_id)
    assert content_list == "hello updated"
    
    # 11. sync_file_system_search_index
    db.sync_file_system_search_index(fs_id, chat_id=chat_id)
    meta_updated = db.get_file_system_meta(fs_id, chat_id=chat_id)
    assert meta_updated is not None

    # 12. get_file_system_current_version
    cur_version = db.get_file_system_current_version(fs_id, chat_id=chat_id)
    assert cur_version is not None
    assert cur_version['version_number'] == 2

    # 13. get_next_file_system_counter
    cnt = db.get_next_file_system_counter(chat_id=chat_id)
    assert isinstance(cnt, int)

    # 14. get_file_system_version_content
    v1_content = db.get_file_system_version_content(fs_id, chat_id=chat_id, version_number=1)
    assert v1_content == "hello world"
    
    # 15. delete_file_system_versions_after
    db.delete_file_system_versions_after(fs_id, chat_id=chat_id, up_to_version=1)
    versions_after = db.get_file_system_versions(fs_id, chat_id=chat_id)
    assert len(versions_after) == 1
    
    # 16. share & unshare
    db.share_fs_file(fs_id, chat_id=chat_id, user_id="user1", permission="write")
    shared_users = db.get_shared_users(fs_id, chat_id=chat_id)
    assert any(u['user_id'] == "user1" for u in shared_users)

    db.unshare_fs_file(fs_id, chat_id=chat_id, user_id="user1")
    shared_users_after = db.get_shared_users(fs_id, chat_id=chat_id)
    assert "user1" not in shared_users_after

    # 17. migrate_file_system_owner
    chat_id_new = "chat_migrated"
    db.ensure_chat_exists(chat_id_new)
    db.migrate_file_system_owner(
        old_id=fs_id, new_id="fs_123_migrated", 
        old_chat_id=chat_id, old_workspace_id=None, 
        new_chat_id=chat_id_new, new_workspace_id=None, 
        new_filename="test_migrated.txt", new_title="Migrated"
    )
    assert db.get_file_system_meta(fs_id, chat_id=chat_id) is None
    migrated_meta = db.get_file_system_meta("fs_123_migrated", chat_id=chat_id_new)
    assert migrated_meta is not None
    assert migrated_meta['filename'] == "test_migrated.txt"

    # 18. delete_chat_file_system_files
    db.delete_chat_file_system_files(chat_id)
    owner_fs_after = db.get_owner_file_systems(chat_id=chat_id)
    assert len(owner_fs_after) == 0

    # 19. delete_file_system
    db.delete_file_system("fs_123_migrated", chat_id=chat_id_new)
    assert db.get_file_system_meta("fs_123_migrated", chat_id=chat_id_new) is None

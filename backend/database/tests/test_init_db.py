import os
import sqlite3
import pytest
from unittest.mock import patch, MagicMock
from backend.database.init_db import init_db
from backend.database.db_layer import make_connection

@pytest.fixture
def temp_db_path(tmp_path):
    return str(tmp_path / "test_init.db")

@pytest.fixture(autouse=True)
def patch_db_path(temp_db_path):
    with patch("backend.database.init_db.DB_PATH", temp_db_path), \
         patch("backend.database.db_layer.DB_PATH", temp_db_path):
        yield temp_db_path

def test_init_db(temp_db_path):
    # Should create DB and apply schema/migrations without errors
    init_db()
    
    # Run a second time to ensure idempotency and migration skipping logic
    init_db()
    
    conn = make_connection()
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in c.fetchall()]
    assert "chats" in tables
    assert "messages" in tables
    assert "file_systems" in tables
    conn.close()

def test_init_db_with_legacy_data(temp_db_path):
    # Setup legacy tables to trigger migrations
    conn = make_connection()
    c = conn.cursor()
    # Mock legacy canvases table (to be renamed to file_systems)
    c.execute("CREATE TABLE canvases (id TEXT, chat_id TEXT, title TEXT, filename TEXT, folder TEXT, timestamp REAL)")
    c.execute("CREATE TABLE canvas_versions (id INTEGER PRIMARY KEY, canvas_id TEXT, chat_id TEXT, version_number INTEGER, content TEXT, author TEXT, timestamp REAL, comment TEXT)")
    c.execute("CREATE TABLE canvas_permissions (id INTEGER PRIMARY KEY, canvas_id TEXT, chat_id TEXT, user_id TEXT, permission TEXT, timestamp REAL)")
    c.execute("CREATE TABLE canvas_counters (chat_id TEXT PRIMARY KEY, counter INTEGER DEFAULT 0)")
    
    # Mock legacy chats table
    c.execute("CREATE TABLE chats (id TEXT PRIMARY KEY, memory_mode INTEGER, canvas_mode INTEGER, folder TEXT, message_order_map TEXT)")
    # Insert a dummy chat with a folder to trigger workspace migration
    c.execute("INSERT INTO chats (id, memory_mode, canvas_mode, folder, message_order_map) VALUES ('c1', 1, 1, 'Test Folder', '[1, 2]')")
    # Insert another with invalid json map
    c.execute("INSERT INTO chats (id, memory_mode, canvas_mode, folder, message_order_map) VALUES ('c2', 1, 1, NULL, 'invalid')")
    
    # Mock legacy messages
    c.execute("CREATE TABLE messages (id INTEGER PRIMARY KEY, chat_id TEXT, role TEXT, content TEXT, parent_type TEXT)")
    c.execute("INSERT INTO messages (id, chat_id, role, content) VALUES (1, 'c1', 'user', 'hello')")
    c.execute("INSERT INTO messages (id, chat_id, role, content) VALUES (2, 'c1', 'assistant', '<think>hmm</think>hi')")
    
    # Mock sub_agent_messages
    c.execute("CREATE TABLE sub_agent_messages (id INTEGER PRIMARY KEY, chat_id TEXT, parent_message_id TEXT, agent_name TEXT, role TEXT, content TEXT, sequence_order INTEGER, parent_type TEXT)")
    c.execute("INSERT INTO sub_agent_messages (chat_id, parent_message_id, agent_name, role, content, sequence_order, parent_type) VALUES ('c1', '1', 'canvas_agent', 'assistant', 'test', 1, 'canvas_agent')")
    c.execute("INSERT INTO sub_agent_messages (chat_id, parent_message_id, agent_name, role, content, sequence_order, parent_type) VALUES ('c1', '1', 'file_agent', 'assistant', 'test file', 2, 'file_agent')")
    
    # Mock collections
    c.execute("CREATE TABLE collections (id INTEGER PRIMARY KEY, chat_id TEXT, parent_message_id TEXT, parent_type TEXT, collection_type TEXT, items TEXT)")
    c.execute("INSERT INTO collections (chat_id, parent_message_id, parent_type, collection_type, items) VALUES ('c1', '1', 'file_agent', 'code', '[]')")

    # Mock pending_callbacks
    c.execute("CREATE TABLE pending_callbacks (callback_id TEXT PRIMARY KEY, chat_id TEXT, parent_type TEXT, tool_name TEXT, status TEXT DEFAULT 'pending')")
    c.execute("INSERT INTO pending_callbacks (callback_id, chat_id, parent_type, tool_name) VALUES ('cb1', 'c1', 'file_agent', 'grep_uploaded_file')")

    conn.commit()
    conn.close()
    
    # Run init_db to trigger migrations on legacy data
    init_db()
    
    # Verify migrations
    conn = make_connection()
    c = conn.cursor()
    c.execute("SELECT user_preferences, file_system_mode, workspace_id FROM chats WHERE id='c1'")
    row = c.fetchone()
    assert row[0] == 1 # memory_mode migrated
    assert row[1] == 1 # canvas_mode migrated
    assert row[2] is not None # workspace_id assigned
    
    c.execute("SELECT parent_type FROM sub_agent_messages WHERE agent_name='file_system_agent'")
    sub_agent_rows = c.fetchall()
    assert len(sub_agent_rows) > 0

    # Verify rebranding of file_agent to document_agent
    c.execute("SELECT agent_name, parent_type FROM sub_agent_messages WHERE agent_name='document_agent'")
    doc_sub_agent_rows = c.fetchall()
    assert len(doc_sub_agent_rows) == 1
    assert doc_sub_agent_rows[0] == ('document_agent', 'document_agent')

    c.execute("SELECT parent_type FROM collections WHERE parent_type='document_agent'")
    coll_rows = c.fetchall()
    assert len(coll_rows) == 1

    c.execute("SELECT parent_type FROM pending_callbacks WHERE parent_type='document_agent'")
    cb_rows = c.fetchall()
    assert len(cb_rows) == 1
    
    c.execute("SELECT reasoning_content FROM messages WHERE id=2")
    reasoning = c.fetchone()[0]
    assert reasoning == "hmm"
    conn.close()

def test_init_db_error():
    with patch("backend.database.init_db.make_connection") as mock_make:
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.execute.side_effect = Exception("Mock DB Init Error")
        mock_make.return_value = mock_conn
        
        with pytest.raises(Exception, match="Mock DB Init Error"):
            init_db()

def test_db_schema_cascade_integrity(temp_db_path):
    init_db()
    conn = make_connection()
    c = conn.cursor()

    # 1. Insert Workspace
    c.execute("INSERT INTO workspaces (id, name, timestamp) VALUES ('w1', 'Test Workspace', 123.45)")

    # 2. Insert Chat referencing w1
    c.execute("""
        INSERT INTO chats (id, title, timestamp, workspace_id)
        VALUES ('c1', 'Test Chat', 123.45, 'w1')
    """)

    # 3. Insert Message referencing c1
    c.execute("""
        INSERT INTO messages (chat_id, role, content, timestamp)
        VALUES ('c1', 'user', 'hello', 123.45)
    """)

    # 4. Insert File System referencing c1 (workspace_id must be NULL)
    c.execute("""
        INSERT INTO file_systems (id, chat_id, workspace_id, title, filename, timestamp, current_version)
        VALUES ('fs1', 'c1', NULL, 'Test FS', 'test.md', 123.45, 1)
    """)

    # 5. Insert File System Version referencing fs1
    c.execute("""
        INSERT INTO file_system_versions (file_system_id, chat_id, workspace_id, version_number, content, timestamp)
        VALUES ('fs1', 'c1', NULL, 1, 'File content', 123.45)
    """)

    conn.commit()

    # Verify everything exists initially
    c.execute("SELECT workspace_id FROM chats WHERE id = 'c1'")
    assert c.fetchone()[0] == 'w1'

    c.execute("SELECT count(*) FROM messages WHERE chat_id = 'c1'")
    assert c.fetchone()[0] == 1

    c.execute("SELECT count(*) FROM file_systems WHERE id = 'fs1' AND chat_id = 'c1'")
    assert c.fetchone()[0] == 1

    c.execute("SELECT count(*) FROM file_system_versions WHERE file_system_id = 'fs1' AND chat_id = 'c1'")
    assert c.fetchone()[0] == 1

    # 6. Delete Workspace w1 -> chats.workspace_id should become NULL (ON DELETE SET NULL)
    c.execute("DELETE FROM workspaces WHERE id = 'w1'")
    conn.commit()

    c.execute("SELECT workspace_id FROM chats WHERE id = 'c1'")
    assert c.fetchone()[0] is None

    # 7. Delete Chat c1 -> should cascade delete messages and file_systems.
    # Note: file_system_versions uses a composite FK (file_system_id, chat_id, workspace_id)
    # where workspace_id is NULL. Under SQLite's MATCH SIMPLE rule, composite foreign keys containing NULLs
    # do not trigger cascading deletes on the child table. This is why delete_chat handles the cleanup
    # of file_system_versions and file_system_permissions explicitly in a transaction.
    # Here, we verify the native cascading deletions for messages and file_systems.
    c.execute("DELETE FROM chats WHERE id = 'c1'")
    conn.commit()

    c.execute("SELECT count(*) FROM messages WHERE chat_id = 'c1'")
    assert c.fetchone()[0] == 0

    c.execute("SELECT count(*) FROM file_systems WHERE id = 'fs1' AND chat_id = 'c1'")
    assert c.fetchone()[0] == 0

    conn.close()


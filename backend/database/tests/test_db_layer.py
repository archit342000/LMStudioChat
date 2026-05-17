import os
import sqlite3
import pytest
import logging
from unittest.mock import patch, MagicMock
from backend.database import db_layer

@pytest.fixture
def temp_db_path(tmp_path):
    return str(tmp_path / "test_layer.db")

@pytest.fixture(autouse=True)
def patch_db_path(temp_db_path):
    with patch("backend.database.db_layer.DB_PATH", temp_db_path):
        yield temp_db_path

def test_log_db_op(caplog):
    caplog.set_level(logging.DEBUG)
    db_layer._log_db_op("TEST_OP", "test_table", "123", "SELECT * FROM test_table")
    assert "[DB TEST_OP] table=test_table row_id=123 sql=SELECT" in caplog.text

    db_layer._log_db_op("TEST_OP", sql="A" * 150)
    assert "A" * 100 in caplog.text

def test_log_db_connection(caplog):
    caplog.set_level(logging.DEBUG)
    db_layer._log_db_connection("opened")
    assert "[DB CONNECTION] opened" in caplog.text

def test_log_db_lock(caplog):
    caplog.set_level(logging.DEBUG)
    db_layer._log_db_lock("ACQUIRED", "test_table", "123", "row_write")
    assert "[DB LOCK] ACQUIRED type=row_write table=test_table row_id=123" in caplog.text
    db_layer._log_db_lock("FAILED", "test_table")
    assert "[DB LOCK] FAILED table=test_table" in caplog.text

def test_make_connection(temp_db_path):
    conn = db_layer.make_connection()
    assert isinstance(conn, sqlite3.Connection)
    # Check pragmas
    c = conn.cursor()
    c.execute("PRAGMA journal_mode")
    assert c.fetchone()[0].lower() in ["wal", "memory", "delete"]
    conn.close()

def test_make_connection_error():
    with patch("sqlite3.connect", side_effect=sqlite3.OperationalError("Mock Error")):
        with pytest.raises(sqlite3.OperationalError):
            db_layer.make_connection()

def test_execute_with_fk(temp_db_path):
    conn = db_layer.make_connection()
    conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)")
    c = db_layer.execute_with_fk(conn, "SELECT * FROM test")
    assert c is not None
    conn.close()

def test_row_read_lock(temp_db_path):
    # Ensure tables exists for real locks if necessary, though BEGIN works without
    with db_layer.row_read_lock("test_table", "1"):
        pass

def test_row_read_lock_error():
    with patch("backend.database.db_layer.make_connection") as mock_make:
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.execute.side_effect = sqlite3.OperationalError("Mock")
        mock_make.return_value = mock_conn
        with pytest.raises(sqlite3.OperationalError):
            with db_layer.row_read_lock("test_table", "1"):
                pass

def test_table_read_lock(temp_db_path):
    with db_layer.table_read_lock("test_table"):
        pass

def test_table_read_lock_error():
    with patch("backend.database.db_layer.make_connection") as mock_make:
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.execute.side_effect = sqlite3.OperationalError("Mock")
        mock_make.return_value = mock_conn
        with pytest.raises(sqlite3.OperationalError):
            with db_layer.table_read_lock("test_table"):
                pass

def test_row_write_lock(temp_db_path):
    with db_layer.row_write_lock("test_table", "1"):
        pass

def test_row_write_lock_error():
    with patch("backend.database.db_layer.make_connection") as mock_make:
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.execute.side_effect = sqlite3.OperationalError("Mock")
        mock_make.return_value = mock_conn
        with pytest.raises(sqlite3.OperationalError):
            with db_layer.row_write_lock("test_table", "1"):
                pass

def test_table_write_lock(temp_db_path):
    with db_layer.table_write_lock("test_table"):
        pass

def test_table_write_lock_error():
    with patch("backend.database.db_layer.make_connection") as mock_make:
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.execute.side_effect = sqlite3.OperationalError("Mock")
        mock_make.return_value = mock_conn
        with pytest.raises(sqlite3.OperationalError):
            with db_layer.table_write_lock("test_table"):
                pass

def test_flush_wal(temp_db_path):
    # Ensure there is a DB
    db_layer.make_connection().close()
    db_layer.flush_wal("test_table")

def test_flush_wal_error():
    with patch("backend.database.db_layer.make_connection") as mock_make:
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.execute.side_effect = sqlite3.OperationalError("Mock")
        mock_make.return_value = mock_conn
        with pytest.raises(sqlite3.OperationalError):
            db_layer.flush_wal("test_table")

import pytest
import time
import threading
from backend.database.cache_layer import (
    _log_cache_op, _log_cache_read, _log_cache_write, _log_cache_invalidate, 
    _log_lock_wait, _log_wal_flush, RowState, TableState, CachedDatabase, cache_layer
)

def test_log_functions():
    _log_cache_op("TEST", "table1", "row1", "detail")
    _log_cache_read("HIT", "table1", "row1", 10.0, 100)
    _log_cache_write("table1", "row1", optimistic=True)
    _log_cache_invalidate("table1", "row1", "reason")
    _log_lock_wait("WRITE", "table1", "row1", 50.0, 10.0)
    _log_wal_flush("table1", "row1", 10.0)

def test_row_state_init():
    row = RowState()
    assert row.pending_write == 0
    assert row.wal_pending == 0
    assert row.invalidated is False
    assert isinstance(row.lock, type(threading.Lock()))
    assert isinstance(row.write_condition, type(threading.Condition()))

def test_table_state_init():
    table = TableState("test_table")
    assert table.table == "test_table"
    assert table.pending_writes == 0
    assert table.wal_pending == 0
    assert isinstance(table.lock, type(threading.Lock()))
    assert isinstance(table.write_condition, type(threading.Condition()))

def test_cached_database_init():
    db = CachedDatabase()
    assert db._tables == {}
    assert db._db_flush_callbacks == {}

def test_get_table():
    db = CachedDatabase()
    table1 = db._get_table("t1")
    table2 = db._get_table("t1")
    assert table1 is table2
    assert isinstance(table1, TableState)

def test_get_row():
    db = CachedDatabase()
    row1 = db._get_row("t1", "r1")
    row2 = db._get_row("t1", "r1")
    assert row1 is row2
    assert isinstance(row1, RowState)

def test_is_row_write_pending():
    db = CachedDatabase()
    row = db._get_row("t1", "r1")
    assert not db._is_row_write_pending("t1", "r1")
    row.pending_write = 1
    assert db._is_row_write_pending("t1", "r1")

def test_is_row_wal_pending():
    db = CachedDatabase()
    row = db._get_row("t1", "r1")
    assert not db._is_row_wal_pending("t1", "r1")
    row.wal_pending = 1
    assert db._is_row_wal_pending("t1", "r1")

def test_is_table_write_pending():
    db = CachedDatabase()
    table = db._get_table("t1")
    assert not db._is_table_write_pending("t1")
    table.pending_writes = 1
    assert db._is_table_write_pending("t1")

def test_is_table_wal_pending():
    db = CachedDatabase()
    table = db._get_table("t1")
    assert not db._is_table_wal_pending("t1")
    table.wal_pending = 1
    assert db._is_table_wal_pending("t1")

def test_register_flush_callback():
    db = CachedDatabase()
    cb_called = False
    def cb():
        nonlocal cb_called
        cb_called = True
    db.register_flush_callback("t1", cb)
    assert "t1" in db._db_flush_callbacks
    db._db_flush_callbacks["t1"]()
    assert cb_called

def test_get():
    db = CachedDatabase()
    
    # Cache miss
    data1 = db.get("t1", "r1", lambda: "val1", ttl=60)
    assert data1 == "val1"
    
    # Cache hit
    data2 = db.get("t1", "r1", lambda: "val2")
    assert data2 == "val1"
    
    # Cache miss (expired TTL)
    db._get_table("t1").cache["r1"]['ttl'] = time.time() - 10
    data3 = db.get("t1", "r1", lambda: "val3")
    assert data3 == "val3"
    
    # fetch_fn returns None
    db._get_table("t1").cache["r2"] = {'invalidated': True} # clear out if any
    data4 = db.get("t1", "r2", lambda: None)
    assert data4 is None
    
    # Test invalidated
    db.invalidate_with_ttl("t1", "r1", ttl=60)
    data5 = db.get("t1", "r1", lambda: "val5")
    assert data5 == "val5"

def test_get_table_method():
    db = CachedDatabase()
    results = db.get_table("t1", lambda: [{"id": "r1", "val": 1}, {"id": "r2", "val": 2}], key_extractor=lambda x: x["id"])
    assert len(results) == 2
    assert "r1" in db._get_table("t1").cache
    assert db._get_table("t1").cache["r1"]['data'] == {"id": "r1", "val": 1}

def test_invalidate():
    db = CachedDatabase()
    db.get("t1", "r1", lambda: "val1")
    db.get("t1", "r2", lambda: "val2")
    
    db.invalidate("t1", "r1")
    assert "r1" not in db._get_table("t1").cache
    assert "r2" in db._get_table("t1").cache
    
    db.invalidate("t1")
    assert len(db._get_table("t1").cache) == 0
    
    db.invalidate("t1", "not_exist")

def test_invalidate_with_ttl():
    db = CachedDatabase()
    db.get("t1", "r1", lambda: "val1")
    db.invalidate_with_ttl("t1", "r1", ttl=10)
    assert db._get_table("t1").cache["r1"]["invalidated"] is True
    assert db._get_table("t1").cache["r1"]["data"] is None
    
    db.invalidate_with_ttl("t1", "not_exist")

def test_flush_row_wal():
    db = CachedDatabase()
    row = db._get_row("t1", "r1")
    
    cb_called = False
    def cb():
        nonlocal cb_called
        cb_called = True
        
    db.register_flush_callback("t1", cb)
    db._flush_row_wal("t1", row, "r1")
    assert cb_called
    
    # Error in callback
    def cb_err():
        raise Exception("error")
    db.register_flush_callback("t2", cb_err)
    row2 = db._get_row("t2", "r1")
    db._flush_row_wal("t2", row2, "r1") # Should handle exception

def test_flush_table_wal():
    db = CachedDatabase()
    table = db._get_table("t1")
    
    cb_called = False
    def cb():
        nonlocal cb_called
        cb_called = True
        
    db.register_flush_callback("t1", cb)
    db._flush_table_wal("t1", table)
    assert cb_called
    
    # Error in callback
    def cb_err():
        raise Exception("error")
    db.register_flush_callback("t2", cb_err)
    table2 = db._get_table("t2")
    db._flush_table_wal("t2", table2) # Should handle exception

def test_clear_cache():
    db = CachedDatabase()
    db.get("t1", "r1", lambda: "val1")
    db.clear_cache()
    assert db._tables == {}

def test_get_stats():
    db = CachedDatabase()
    db.get("t1", "r1", lambda: "val1")
    db._get_row("t1", "r2").pending_write = 1
    db._get_table("t2").pending_writes = 1
    
    stats = db.get_stats()
    assert stats["tables"] == 2
    assert stats["total_rows"] == 1
    assert stats["rows_with_pending_writes"] == 1
    assert stats["tables_with_pending_writes"] == ["t2"]

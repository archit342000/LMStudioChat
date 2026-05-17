import time
import uuid
import sqlite3
import logging
from ..db_layer import make_connection
from .base import BaseMixin

class PreferenceOpsMixin(BaseMixin):
    """
    Mixin for User Preference operations (Global / per-chat facts).
    """

    def get_all_preferences(self) -> list:
        """Get all preferences from the database."""
        self._log_db_wrapper_op("GET_ALL_PREFERENCES_START")
        fetch_start = time.time()
        def _fetch():
            conn = make_connection()
            try:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                c.execute("SELECT * FROM memories ORDER BY timestamp DESC")
                return [dict(row) for row in c.fetchall()]
            finally:
                conn.close()
        result = _fetch()
        self._log_db_wrapper_op("GET_ALL_PREFERENCES_END", None, f"count={len(result)} duration_ms={(time.time() - fetch_start)*1000:.2f}")
        return result

    def add_preference(self, content: str, tag: str) -> str:
        """Add a new preference to the database."""
        self._log_db_wrapper_op("ADD_PREFERENCE_START", None, f"tag={tag}")
        write_start = time.time()
        preference_id = str(uuid.uuid4())
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("BEGIN IMMEDIATE")
                try:
                    c.execute('INSERT INTO memories (id, content, tag, timestamp) VALUES (?, ?, ?, ?)', 
                              (preference_id, content, tag, time.time()))
                    conn.commit()
                except:
                    conn.rollback()
                    raise
            finally:
                conn.close()
        _write()
        self._log_db_wrapper_op("ADD_PREFERENCE_END", None, f"preference_id={preference_id} duration_ms={(time.time() - write_start)*1000:.2f}")
        return preference_id

    def update_preference(self, preference_id: str, new_content: str, new_tag: str) -> bool:
        """Update an existing preference."""
        self._log_db_wrapper_op("UPDATE_PREFERENCE_START", None, f"preference_id={preference_id}")
        write_start = time.time()
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("BEGIN IMMEDIATE")
                try:
                    c.execute('UPDATE memories SET content = ?, tag = ?, timestamp = ? WHERE id = ?', 
                              (new_content, new_tag, time.time(), preference_id))
                    count = c.rowcount
                    conn.commit()
                    return count > 0
                except:
                    conn.rollback()
                    raise
            finally:
                conn.close()
        result = _write()
        self._log_db_wrapper_op("UPDATE_PREFERENCE_END", None, f"preference_id={preference_id} updated={result} duration_ms={(time.time() - write_start)*1000:.2f}")
        return result

    def delete_preference(self, preference_id: str) -> bool:
        """Delete a preference by ID."""
        self._log_db_wrapper_op("DELETE_PREFERENCE_START", None, f"preference_id={preference_id}")
        write_start = time.time()
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("BEGIN IMMEDIATE")
                try:
                    c.execute("DELETE FROM memories WHERE id = ?", (preference_id,))
                    count = c.rowcount
                    conn.commit()
                    return count > 0
                except:
                    conn.rollback()
                    raise
            finally:
                conn.close()
        result = _write()
        self._log_db_wrapper_op("DELETE_PREFERENCE_END", None, f"preference_id={preference_id} deleted={result} duration_ms={(time.time() - write_start)*1000:.2f}")
        return result

    def clear_preferences(self) -> int:
        """Delete all preferences from the database."""
        self._log_db_wrapper_op("CLEAR_PREFERENCES_START")
        write_start = time.time()
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("BEGIN IMMEDIATE")
                try:
                    c.execute("SELECT COUNT(*) FROM memories")
                    count = c.fetchone()[0]
                    c.execute("DELETE FROM memories")
                    conn.commit()
                    return count
                except:
                    conn.rollback()
                    raise
            finally:
                conn.close()
        deleted_count = _write()
        self._log_db_wrapper_op("CLEAR_PREFERENCES_END", None, f"deleted={deleted_count} duration_ms={(time.time() - write_start)*1000:.2f}")
        return deleted_count

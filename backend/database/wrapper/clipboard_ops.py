import time
import sqlite3
from typing import Optional
from ..db_layer import make_connection
from .base import BaseMixin

class ClipboardOpsMixin(BaseMixin):
    """
    Mixin for Chat Clipboard operations.
    """

    def clipboard_set(self, chat_id: str, key: str, content: str) -> None:
        """Set a value in the clipboard, replacing if it already exists."""
        self._log_db_wrapper_op("CLIPBOARD_SET_START", chat_id, f"key={key}")
        write_start = time.time()
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("BEGIN IMMEDIATE")
                try:
                    c.execute(
                        'INSERT OR REPLACE INTO clipboard (chat_id, key, content, created_at) VALUES (?, ?, ?, ?)',
                        (chat_id, key, content, time.time())
                    )
                    conn.commit()
                except:
                    conn.rollback()
                    raise
            finally:
                conn.close()
        _write()
        self._log_db_wrapper_op("CLIPBOARD_SET_END", chat_id, f"key={key} duration_ms={(time.time() - write_start)*1000:.2f}")

    def clipboard_get(self, chat_id: str, key: str) -> Optional[str]:
        """Get a value from the clipboard by chat_id and key."""
        self._log_db_wrapper_op("CLIPBOARD_GET_START", chat_id, f"key={key}")
        fetch_start = time.time()
        def _fetch():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("SELECT content FROM clipboard WHERE chat_id = ? AND key = ?", (chat_id, key))
                row = c.fetchone()
                return row[0] if row else None
            finally:
                conn.close()
        result = _fetch()
        found = result is not None
        self._log_db_wrapper_op("CLIPBOARD_GET_END", chat_id, f"key={key} found={found} duration_ms={(time.time() - fetch_start)*1000:.2f}")
        return result

    def clipboard_delete(self, chat_id: str, key: str) -> bool:
        """Delete a key from the clipboard."""
        self._log_db_wrapper_op("CLIPBOARD_DELETE_START", chat_id, f"key={key}")
        write_start = time.time()
        def _write():
            conn = make_connection()
            try:
                c = conn.cursor()
                c.execute("BEGIN IMMEDIATE")
                try:
                    c.execute("DELETE FROM clipboard WHERE chat_id = ? AND key = ?", (chat_id, key))
                    count = c.rowcount
                    conn.commit()
                    return count > 0
                except:
                    conn.rollback()
                    raise
            finally:
                conn.close()
        result = _write()
        self._log_db_wrapper_op("CLIPBOARD_DELETE_END", chat_id, f"key={key} deleted={result} duration_ms={(time.time() - write_start)*1000:.2f}")
        return result

import sqlite3
import json
import logging
import time
from ..cache_layer import cache_layer
from ..db_layer import make_connection
from ..cache_system import cache_system

logger = logging.getLogger(__name__)

def _log_db_wrapper_op(op_type: str, chat_id: str = None, details: str = None):
    """
    Internal logging helper for db_wrapper operations.
    """
    msg = f"[DB_WRAPPER {op_type}]"
    if chat_id:
        msg += f" chat_id={chat_id}"
    if details:
        msg += f" | {details}"
    logger.debug(msg)

class BaseMixin:
    """
    Base mixin with shared utilities and internal methods for the DatabaseWrapper.
    """
    
    def _log_db_wrapper_op(self, op_type: str, chat_id: str = None, details: str = None):
        _log_db_wrapper_op(op_type, chat_id, details)

    def _get_order_map_unsafe(self, chat_id: str) -> list:
        """
        Internal helper to get order_map without caching (for write operations).
        """
        conn = make_connection()
        try:
            c = conn.cursor()
            c.execute("SELECT message_order_map FROM chats WHERE id = ?", (chat_id,))
            row = c.fetchone()
            if row and row[0]:
                try:
                    return json.loads(row[0])
                except (json.JSONDecodeError, TypeError):
                    return []
            return []
        finally:
            conn.close()

    def _get_chat_fetch_internal(self, chat_id: str):
        """
        Internal raw fetch of a chat record.
        """
        conn = make_connection()
        try:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT * FROM chats WHERE id = ?", (chat_id,))
            row = c.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

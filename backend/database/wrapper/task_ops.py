import sqlite3
import time
import json
import logging
from ..db_layer import make_connection
from ..cache_layer import cache_layer
from typing import Any
from .base import BaseMixin

logger = logging.getLogger(__name__)

class TaskOpsMixin(BaseMixin):
    """
    Mixin for managing task lists associated with a chat or sub-agent turn.
    Leverages the 'collections' table to persist JSON checklists.
    """

    def get_task_list(self, chat_id: str, parent_id: Any = None, parent_type: str = "main") -> list:
        """
        Retrieves the current task list for a given chat and parent context.
        """
        self._log_db_wrapper_op("GET_TASK_LIST", chat_id, f"parent_id={parent_id} parent_type={parent_type}")
        
        # We need a parent_id to anchor the collection. If None, we use a generic 0 or the chat root.
        # Collections usually require parent_message_id.
        anchor_id = parent_id if parent_id is not None else 0

        def _fetch():
            conn = make_connection()
            try:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                c.execute('''
                    SELECT items FROM collections 
                    WHERE chat_id = ? AND parent_message_id = ? AND parent_type = ? AND collection_type = 'task_list'
                    ORDER BY id DESC LIMIT 1
                ''', (chat_id, anchor_id, parent_type))
                row = c.fetchone()
                if row and row['items']:
                    try:
                        return json.loads(row['items'])
                    except json.JSONDecodeError:
                        return []
                return []
            finally:
                conn.close()

        cache_key = f"chat:{chat_id}:tasks:{parent_type}:{anchor_id}"
        return cache_layer.get("collections", cache_key, _fetch)

    def get_latest_task_list(self, chat_id: str, parent_type: str = "main") -> list:
        """
        Retrieves the most recent task list for a chat, ignoring the parent_message_id anchor.
        Useful for carrying task lists forward across turns.
        """
        self._log_db_wrapper_op("GET_LATEST_TASK_LIST", chat_id, f"parent_type={parent_type}")
        
        def _fetch():
            conn = make_connection()
            try:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                c.execute('''
                    SELECT items FROM collections 
                    WHERE chat_id = ? AND parent_type = ? AND collection_type = 'task_list'
                    ORDER BY id DESC LIMIT 1
                ''', (chat_id, parent_type))
                row = c.fetchone()
                if row and row['items']:
                    try:
                        return json.loads(row['items'])
                    except json.JSONDecodeError:
                        return []
                return []
            finally:
                conn.close()

        cache_key = f"chat:{chat_id}:tasks:{parent_type}:latest"
        return cache_layer.get("collections", cache_key, _fetch)

    def set_task_list(self, chat_id: str, data: list, parent_id: Any = None, parent_type: str = "main"):
        """
        Persists a task list state for a given chat and parent context.
        Overwrites any existing task list for this context.
        """
        self._log_db_wrapper_op("SET_TASK_LIST", chat_id, f"parent_id={parent_id} parent_type={parent_type}")
        anchor_id = parent_id if parent_id is not None else 0
        items_json = json.dumps(data)
        
        conn = make_connection()
        try:
            c = conn.cursor()
            c.execute("BEGIN IMMEDIATE")
            try:
                # Remove existing task list for this anchor
                c.execute('''
                    DELETE FROM collections 
                    WHERE chat_id = ? AND parent_message_id = ? AND parent_type = ? AND collection_type = 'task_list'
                ''', (chat_id, anchor_id, parent_type))
                
                # Insert new task list
                c.execute('''
                    INSERT INTO collections (chat_id, parent_message_id, parent_type, collection_type, items, timestamp)
                    VALUES (?, ?, ?, 'task_list', ?, ?)
                ''', (chat_id, anchor_id, parent_type, items_json, time.time()))
                
                c.execute("COMMIT")
            except Exception as e:
                c.execute("ROLLBACK")
                raise e
        finally:
            conn.close()

        # Invalidate cache
        cache_key = f"chat:{chat_id}:tasks:{parent_type}:{anchor_id}"
        latest_cache_key = f"chat:{chat_id}:tasks:{parent_type}:latest"
        cache_layer.invalidate("collections", cache_key)
        cache_layer.invalidate("collections", latest_cache_key)
        return True


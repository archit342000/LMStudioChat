import json
import logging
import sqlite3
from typing import List, Dict, Optional
from backend.database.db_layer import make_connection

logger = logging.getLogger(__name__)

class CodeExecutionOpsMixin:
    """
    Mixin providing operations for the code_execution_history table.
    """

    def add_code_execution_record(
        self,
        record_id: str,
        chat_id: str,
        language: str,
        code: str,
        stdout: str,
        stderr: str,
        exit_code: int,
        execution_time_ms: int,
        timed_out: int = 0,
        stdin: Optional[str] = None,
        files_json: Optional[str] = None,
        message_id: Optional[str] = None,
        tool_call_id: Optional[str] = None
    ) -> None:
        """Insert a code execution history record."""
        try:
            with make_connection() as conn:
                c = conn.cursor()
                c.execute(
                    '''
                    INSERT INTO code_execution_history (
                        id, chat_id, message_id, tool_call_id, language, code, stdin,
                        files_json, stdout, stderr, exit_code, execution_time_ms, timed_out, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    ''',
                    (
                        record_id, chat_id, message_id, tool_call_id, language, code, stdin,
                        files_json, stdout, stderr, exit_code, execution_time_ms, timed_out
                    )
                )
                conn.commit()
        except Exception as e:
            logger.error(f"CodeExecutionOpsMixin.add_code_execution_record error: {e}")
            raise

    def get_code_execution_history(self, chat_id: str, limit: int = 50, offset: int = 0) -> List[Dict]:
        """Get execution history for a chat, ordered by created_at DESC."""
        try:
            with make_connection() as conn:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                c.execute(
                    '''
                    SELECT * FROM code_execution_history
                    WHERE chat_id = ?
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                    ''',
                    (chat_id, limit, offset)
                )
                return [dict(row) for row in c.fetchall()]
        except Exception as e:
            logger.error(f"CodeExecutionOpsMixin.get_code_execution_history error: {e}")
            return []

    def get_code_execution_record(self, record_id: str) -> Optional[Dict]:
        """Get a single execution record by ID."""
        try:
            with make_connection() as conn:
                conn.row_factory = sqlite3.Row
                c = conn.cursor()
                c.execute('SELECT * FROM code_execution_history WHERE id = ?', (record_id,))
                row = c.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"CodeExecutionOpsMixin.get_code_execution_record error: {e}")
            return None

    def delete_code_execution_history(self, chat_id: str) -> bool:
        """Delete all execution history for a chat."""
        try:
            with make_connection() as conn:
                c = conn.cursor()
                c.execute('DELETE FROM code_execution_history WHERE chat_id = ?', (chat_id,))
                changed = conn.total_changes > 0
                conn.commit()
                return changed
        except Exception as e:
            logger.error(f"CodeExecutionOpsMixin.delete_code_execution_history error: {e}")
            return False

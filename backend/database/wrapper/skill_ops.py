import sqlite3
import time
import logging
from ..db_layer import make_connection
from .base import BaseMixin

logger = logging.getLogger(__name__)

class SkillOpsMixin(BaseMixin):
    """
    Mixin for skill-level database operations (CRUD).
    """

    def add_skill(self, skill_id: str, name: str, description: str, instructions: str) -> bool:
        """
        Inserts or replaces a skill in the store.
        """
        self._log_db_wrapper_op("ADD_SKILL_START", skill_id, f"name={name}")
        write_start = time.time()
        
        conn = make_connection()
        try:
            c = conn.cursor()
            c.execute("BEGIN IMMEDIATE")
            
            try:
                c.execute('''
                    INSERT INTO skills (id, name, description, instructions, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        description = excluded.description,
                        instructions = excluded.instructions,
                        timestamp = excluded.timestamp
                ''', (skill_id, name, description, instructions, time.time()))
                
                c.execute("COMMIT")
            except Exception as e:
                c.execute("ROLLBACK")
                raise e
        finally:
            conn.close()

        db_write_duration = (time.time() - write_start) * 1000
        self._log_db_wrapper_op("ADD_SKILL_END", skill_id, f"duration_ms={db_write_duration:.2f}")
        return True

    def get_skill(self, skill_id: str) -> dict:
        """
        Retrieves a skill by its ID.
        """
        conn = make_connection()
        try:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT * FROM skills WHERE id = ?", (skill_id,))
            row = c.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_skill_by_name(self, name: str) -> dict:
        """
        Retrieves a skill by its name.
        """
        conn = make_connection()
        try:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT * FROM skills WHERE name = ?", (name,))
            row = c.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_all_skills(self) -> list:
        """
        Retrieves all skills ordered by timestamp descending.
        """
        conn = make_connection()
        try:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT * FROM skills ORDER BY timestamp DESC")
            return [dict(row) for row in c.fetchall()]
        finally:
            conn.close()

    def delete_skill(self, skill_id: str) -> bool:
        """
        Deletes a skill by its ID.
        """
        self._log_db_wrapper_op("DELETE_SKILL_START", skill_id)
        write_start = time.time()

        conn = make_connection()
        try:
            c = conn.cursor()
            c.execute("BEGIN IMMEDIATE")
            
            try:
                c.execute("DELETE FROM skills WHERE id = ?", (skill_id,))
                c.execute("COMMIT")
            except Exception as e:
                c.execute("ROLLBACK")
                raise e
        finally:
            conn.close()

        db_write_duration = (time.time() - write_start) * 1000
        self._log_db_wrapper_op("DELETE_SKILL_END", skill_id, f"duration_ms={db_write_duration:.2f}")
        return True

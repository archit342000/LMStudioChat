from datetime import datetime, timezone
from typing import List, Dict, Optional
from backend.database.db_layer import make_connection
import uuid

class PersonaOperations:
    def _row_to_dict(self, row) -> Dict:
        if not row: return None
        return {
            "id": row[0],
            "name": row[1],
            "content": row[2],
            "is_default": row[3],
            "timestamp": row[4],
            "research_mode": row[5] if len(row) > 5 else 0,
            "file_system_mode": row[6] if len(row) > 6 else 0,
            "browsing_mode": row[7] if len(row) > 7 else 0,
            "git_mode": row[8] if len(row) > 8 else 0
        }

    def get_all_personas(self) -> List[Dict]:
        """Get all saved personas."""
        with make_connection() as conn:
            c = conn.cursor()
            c.execute('SELECT id, name, content, is_default, timestamp, research_mode, file_system_mode, browsing_mode, git_mode FROM personas ORDER BY timestamp DESC')
            return [self._row_to_dict(row) for row in c.fetchall()]

    def get_persona(self, persona_id: str) -> Optional[Dict]:
        """Get a specific persona by ID."""
        with make_connection() as conn:
            c = conn.cursor()
            c.execute('SELECT id, name, content, is_default, timestamp, research_mode, file_system_mode, browsing_mode, git_mode FROM personas WHERE id = ?', (persona_id,))
            return self._row_to_dict(c.fetchone())

    def get_default_persona(self) -> Optional[Dict]:
        """Get the default persona if one exists."""
        with make_connection() as conn:
            c = conn.cursor()
            c.execute('SELECT id, name, content, is_default, timestamp, research_mode, file_system_mode, browsing_mode, git_mode FROM personas WHERE is_default = 1 LIMIT 1')
            return self._row_to_dict(c.fetchone())

    def create_persona(self, name: str, content: str, is_default: int = 0, research_mode: int = 0, file_system_mode: int = 0, browsing_mode: int = 0, git_mode: int = 0) -> Dict:
        """Create a new persona."""
        persona_id = "persona_" + uuid.uuid4().hex[:16]
        timestamp = datetime.now(timezone.utc).timestamp()
        
        if research_mode == 1:
            file_system_mode = 0
            browsing_mode = 0

        with make_connection() as conn:
            c = conn.cursor()
            
            # If making this default, clear other defaults
            if is_default == 1:
                c.execute('UPDATE personas SET is_default = 0')
                
            c.execute(
                'INSERT INTO personas (id, name, content, is_default, timestamp, research_mode, file_system_mode, browsing_mode, git_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (persona_id, name, content, is_default, timestamp, research_mode, file_system_mode, browsing_mode, git_mode)
            )
            conn.commit()
            
        return {
            "id": persona_id,
            "name": name,
            "content": content,
            "is_default": is_default,
            "timestamp": timestamp,
            "research_mode": research_mode,
            "file_system_mode": file_system_mode,
            "browsing_mode": browsing_mode,
            "git_mode": git_mode
        }

    def update_persona(self, persona_id: str, name: str, content: str, is_default: int = 0, research_mode: int = 0, file_system_mode: int = 0, browsing_mode: int = 0, git_mode: int = 0) -> bool:
        """Update an existing persona."""
        if research_mode == 1:
            file_system_mode = 0
            browsing_mode = 0

        with make_connection() as conn:
            c = conn.cursor()
            
            if is_default == 1:
                c.execute('UPDATE personas SET is_default = 0')
                
            c.execute(
                'UPDATE personas SET name = ?, content = ?, is_default = ?, research_mode = ?, file_system_mode = ?, browsing_mode = ?, git_mode = ? WHERE id = ?',
                (name, content, is_default, research_mode, file_system_mode, browsing_mode, git_mode, persona_id)
            )
            changes = conn.total_changes
            conn.commit()
            return changes > 0

    def delete_persona(self, persona_id: str) -> bool:
        """Delete a persona."""
        with make_connection() as conn:
            c = conn.cursor()
            c.execute('DELETE FROM personas WHERE id = ?', (persona_id,))
            changes = conn.total_changes
            conn.commit()
            return changes > 0

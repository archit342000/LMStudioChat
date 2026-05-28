import json
import logging
from typing import Any, Optional
from backend.database.db_layer import make_connection

logger = logging.getLogger(__name__)


class SettingsOpsMixin:
    """
    Mixin providing CRUD operations for the system_settings table.
    Stores persistent key-value application configuration.
    Values are stored as JSON strings to support arbitrary types.
    """

    def get_setting(self, key: str, default: Any = None) -> Any:
        """Get a system setting by key. Returns parsed JSON value or default."""
        try:
            with make_connection() as conn:
                c = conn.cursor()
                c.execute('SELECT value FROM system_settings WHERE key = ?', (key,))
                row = c.fetchone()
                if row is None:
                    return default
                return json.loads(row[0])
        except Exception as e:
            logger.error(f"SettingsOpsMixin.get_setting error for key '{key}': {e}")
            return default

    def set_setting(self, key: str, value: Any) -> None:
        """Set a system setting. Value is serialized as JSON."""
        try:
            serialized = json.dumps(value)
            with make_connection() as conn:
                c = conn.cursor()
                c.execute(
                    '''
                    INSERT INTO system_settings (key, value, updated_at)
                    VALUES (?, ?, datetime('now'))
                    ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        updated_at = datetime('now')
                    ''',
                    (key, serialized)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"SettingsOpsMixin.set_setting error for key '{key}': {e}")
            raise

    def get_all_settings(self) -> dict:
        """Return all system settings as a dict of parsed values."""
        try:
            with make_connection() as conn:
                c = conn.cursor()
                c.execute('SELECT key, value FROM system_settings')
                return {row[0]: json.loads(row[1]) for row in c.fetchall()}
        except Exception as e:
            logger.error(f"SettingsOpsMixin.get_all_settings error: {e}")
            return {}

    def delete_setting(self, key: str) -> bool:
        """Delete a system setting by key. Returns True if a row was deleted."""
        try:
            with make_connection() as conn:
                c = conn.cursor()
                c.execute('DELETE FROM system_settings WHERE key = ?', (key,))
                changed = conn.total_changes > 0
                conn.commit()
                return changed
        except Exception as e:
            logger.error(f"SettingsOpsMixin.delete_setting error for key '{key}': {e}")
            return False

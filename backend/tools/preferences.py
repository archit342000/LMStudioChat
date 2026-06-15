"""
Tool implementations for user preference CRUD operations.
Orchestrates adding, editing, and deleting preferences via the database layer.
"""
import logging
from backend.database import db

logger = logging.getLogger(__name__)


def add_user_preference(content, tag, **kwargs):
    """
    Adds a new preference or profile fact about the user.
    """
    try:
        pref_id = db.add_preference(content, tag)
        all_prefs = db.get_all_preferences()
        pref_dump = "\n".join([f"[{m['id']}] ({m['tag']}) {m['content']}" for m in all_prefs])
        return f"Added preference [{pref_id[:8]}]: {content[:50]}\n\nCurrent User Preferences ({len(all_prefs)} entries):\n{pref_dump}"
    except Exception as e:
        logger.error(f"Failed to add user preference: {e}", exc_info=True)
        return f"Error: Failed to add user preference: {str(e)}"


def edit_user_preference(id, content, tag, **kwargs):
    """
    Updates an existing user preference or profile entry.
    """
    try:
        success = db.update_preference(id, content, tag)
        all_prefs = db.get_all_preferences()
        pref_dump = "\n".join([f"[{m['id']}] ({m['tag']}) {m['content']}" for m in all_prefs])
        status = "OK" if success else "NOT FOUND"
        return f"Updated preference [{id[:8]}]: {status}\n\nCurrent User Preferences ({len(all_prefs)} entries):\n{pref_dump}"
    except Exception as e:
        logger.error(f"Failed to edit user preference: {e}", exc_info=True)
        return f"Error: Failed to edit user preference: {str(e)}"


def delete_user_preference(id, **kwargs):
    """
    Deletes an outdated or contradictory user preference.
    """
    try:
        success = db.delete_preference(id)
        all_prefs = db.get_all_preferences()
        pref_dump = "\n".join([f"[{m['id']}] ({m['tag']}) {m['content']}" for m in all_prefs])
        status = "OK" if success else "NOT FOUND"
        return f"Deleted preference [{id[:8]}]: {status}\n\nCurrent User Preferences ({len(all_prefs)} entries):\n{pref_dump}"
    except Exception as e:
        logger.error(f"Failed to delete user preference: {e}", exc_info=True)
        return f"Error: Failed to delete user preference: {str(e)}"

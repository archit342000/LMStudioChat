"""
Tool implementation for the manage_user_preferences LLM tool.
Orchestrates preference CRUD operations via the database layer.
"""
import logging
from backend.database import db

logger = logging.getLogger(__name__)


def manage_user_preferences(additions=None, edits=None, deletions=None, **kwargs):
    """
    Unified tool interface for the manage_user_preferences LLM tool.
    Processes additions, edits, and deletions in a single call.
    Returns a summary string for the LLM.
    """
    results = []

    if additions:
        for item in additions:
            pref_id = db.add_preference(item['content'], item['tag'])
            results.append(f"Added preference [{pref_id[:8]}]: {item['content'][:50]}")

    if edits:
        for item in edits:
            success = db.update_preference(item['id'], item['content'], item['tag'])
            results.append(f"Updated preference [{item['id'][:8]}]: {'OK' if success else 'NOT FOUND'}")

    if deletions:
        for pref_id in deletions:
            success = db.delete_preference(pref_id)
            results.append(f"Deleted preference [{pref_id[:8]}]: {'OK' if success else 'NOT FOUND'}")

    # Return current state for the LLM's context
    all_prefs = db.get_all_preferences()
    summary = "\n".join(results) if results else "No changes made."
    pref_dump = "\n".join([f"[{m['id']}] ({m['tag']}) {m['content']}" for m in all_prefs])

    return f"Operations:\n{summary}\n\nCurrent User Preferences ({len(all_prefs)} entries):\n{pref_dump}"

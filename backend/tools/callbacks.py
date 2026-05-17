import asyncio
import time
import json
from typing import Dict, Any, Optional

class CallbackRegistry:
    """
    Global, model-agnostic registry for tool and agent callbacks.
    Allows async tasks to suspend and be resumed by external API calls.
    
    Enhanced with DB persistence for crash recovery:
    - On register: saves metadata to pending_callbacks table
    - On resolve: updates DB status to 'resolved'
    - On cleanup: removes from both memory and DB
    """
    _callbacks: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def register(cls, callback_id: str, chat_id: str, metadata: dict = None) -> asyncio.Event:
        """Registers a new callback and returns the event to wait on.
        
        Args:
            callback_id: Unique ID for this callback (usually tool_call_id)
            chat_id: Chat this callback belongs to
            metadata: Optional dict with keys: parent_message_id, parent_type,
                      tool_name, question, options — persisted to DB for crash recovery
        """
        event = asyncio.Event()
        cls._callbacks[callback_id] = {
            "event": event,
            "chat_id": chat_id,
            "response": None,
            "loop": asyncio.get_event_loop(),
            "timestamp": time.time()
        }

        # Persist to DB for crash recovery
        if metadata:
            try:
                from backend.database import db
                db.save_callback(
                    callback_id=callback_id,
                    chat_id=chat_id,
                    parent_message_id=metadata.get('parent_message_id'),
                    parent_type=metadata.get('parent_type', 'main'),
                    tool_name=metadata.get('tool_name', 'request_clarification'),
                    question=metadata.get('question', ''),
                    options=metadata.get('options')
                )
            except Exception:
                pass  # Non-critical — in-memory callback still works

        return event

    @classmethod
    def resolve(cls, callback_id: str, response: Any):
        """Signals a callback with the provided response data."""
        if callback_id in cls._callbacks:
            entry = cls._callbacks[callback_id]
            entry['response'] = response
            try:
                entry['loop'].call_soon_threadsafe(entry['event'].set)
            except RuntimeError:
                # Event loop is closed — the TaskWorker already terminated.
                # Clean up the zombie entry; DB persistence still handles recovery.
                import logging
                logging.getLogger(__name__).warning(
                    f"CallbackRegistry: Loop closed for callback {callback_id}, "
                    f"cleaning up zombie entry."
                )
                cls._callbacks.pop(callback_id, None)

        # Also persist resolution to DB
        try:
            from backend.database import db
            db.resolve_callback(callback_id, json.dumps(response) if isinstance(response, (dict, list)) else str(response))
        except Exception:
            pass

    @classmethod
    def get(cls, callback_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a callback entry."""
        return cls._callbacks.get(callback_id)

    @classmethod
    def cleanup(cls, callback_id: str):
        """Removes a callback entry from memory and DB."""
        cls._callbacks.pop(callback_id, None)
        try:
            from backend.database import db
            db.cleanup_callback(callback_id)
        except Exception:
            pass

    @classmethod
    def cleanup_chat(cls, chat_id: str):
        """Removes all callbacks for a chat from memory and DB."""
        to_remove = [cb_id for cb_id, entry in cls._callbacks.items()
                     if entry.get('chat_id') == chat_id]
        for cb_id in to_remove:
            cls._callbacks.pop(cb_id, None)
        try:
            from backend.database import db
            db.cleanup_chat_callbacks(chat_id)
        except Exception:
            pass

    @classmethod
    def clear_expired(cls, max_age: int = 3600):
        """Cleans up callbacks older than max_age seconds."""
        now = time.time()
        to_delete = [
            cb_id for cb_id, entry in cls._callbacks.items()
            if now - entry.get('timestamp', 0) > max_age
        ]
        for cb_id in to_delete:
            cls.cleanup(cb_id)

# Singleton instance for easy access across the backend
callback_registry = CallbackRegistry()

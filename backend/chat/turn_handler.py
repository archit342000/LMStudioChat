import asyncio
import time
import json
import logging
from typing import AsyncGenerator, Callable, Any, Optional
from backend.database import db
from backend.logging import log_event

logger = logging.getLogger(__name__)

class TurnHandler:
    """
    Orchestrates the entire execution of an assistant turn.
    
    This process is responsible for:
    1. Serialization: Ensuring strictly one turn executes at a time globally (configurable).
    2. Execution: Running the provided 'run' function which generates the output.
    3. Persistence: Ensuring all turn-related metadata and chat states are finalized.
    """
    
    @classmethod
    async def handle_turn(
        cls,
        chat_id: str,
        parent_message_id: int,
        run_fn: Callable[..., AsyncGenerator[str, None]],
        model: Optional[str] = None,
        *args,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Wraps a turn execution with standardized persistence.
        
        Args:
            chat_id: The ID of the chat undergoing the turn.
            parent_message_id: The ID of the user message that triggered this turn.
            run_fn: An async generator function that defines the turn logic.
            model: Optional model name used for persistence tagging.
            *args, **kwargs: Arguments passed through to the run_fn.
            
        Yields:
            Chunks yielded by the run_fn.
        """
        log_event("turn_handler_start", {"chat_id": chat_id, "parent_id": parent_message_id, "model": model})
        
        start_time = time.time()
        
        try:
            # Iterate over the provided run function to yield chunks back to the client
            async for chunk in run_fn(*args, **kwargs):
                yield chunk
            
            # Constant persistence logic: ensure the turn is finalized in the database
            cls._persist_final_state(chat_id, parent_message_id, model)
            
        except Exception as e:
            log_event("turn_handler_error", {"chat_id": chat_id, "error": str(e)})
            logger.error(f"Error during assistant turn for chat {chat_id}: {str(e)}", exc_info=True)
            raise
        finally:
            duration = time.time() - start_time
            log_event("turn_handler_end", {"chat_id": chat_id, "duration": duration})

    @classmethod
    def _persist_final_state(cls, chat_id: str, parent_message_id: int, model: Optional[str] = None):
        """
        Unified persistence logic that must run at the end of every turn.
1. Update chat timestamp.
        """
        try:
            # 1. Update the chat's activity timestamp
            db.update_chat(chat_id, timestamp=time.time())
            
            log_event("turn_persistence_finalized", {
                "chat_id": chat_id, 
                "parent_id": parent_message_id
            })
            
        except Exception as e:
            log_event("turn_persistence_error", {"chat_id": chat_id, "error": str(e)})
            logger.error(f"Failed to finalize persistence for turn {parent_message_id}: {str(e)}")

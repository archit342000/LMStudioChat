import asyncio
from backend.logging import log_event
from backend.tools.callbacks import callback_registry

async def request_clarification(question: str, options=None, **kwargs) -> str:
    """
    Universal clarification tool. 
    Suspends execution and waits for a user response via the tools router.
    Uses the tool_call_id as the callback identifier.
    
    Enhanced for crash recovery:
    - Before registering a new callback, checks DB for an already-resolved response
    - Passes metadata to register() for DB persistence
    """
    chat_id = kwargs.get('chat_id')
    cb_id = kwargs.get('tool_call_id')
    parent_message_id = kwargs.get('parent_message_id')
    
    if not chat_id or not cb_id:
        return "ERROR: Missing required context (chat_id or tool_call_id)."

    # CRASH RECOVERY: Check if this callback was already resolved in a previous
    # server session (the user responded, but the server crashed before the
    # coroutine could process the response).
    try:
        from backend.database import db
        resolved = db.get_resolved_callback(cb_id)
        if resolved and resolved.get('response'):
            log_event("clarification_recovered", {"chat_id": chat_id, "callback_id": cb_id})
            db.cleanup_callback(cb_id)
            return resolved['response']
    except Exception:
        pass  # DB check failed — proceed with normal flow

    # 1. Register for suspension using tool_call_id, with metadata for DB persistence
    event = callback_registry.register(cb_id, chat_id, metadata={
        'parent_message_id': parent_message_id,
        'parent_type': kwargs.get('parent_type', 'main'),
        'tool_name': 'request_clarification',
        'question': question,
        'options': options or []
    })
    
    log_event("clarification_requested", {"chat_id": chat_id, "callback_id": cb_id, "question": question})

    # 1b. Stream a synthetic tool call event through response_cache to notify the frontend
    try:
        import json
        from backend.database import response_cache
        payload = {
            "parent_type": kwargs.get('parent_type', 'main'),
            "choices": [{
                "delta": {
                    "tool_calls": [{
                        "id": cb_id,
                        "type": "function",
                        "function": {
                            "name": "request_clarification",
                            "arguments": json.dumps({"question": question, "options": options or []})
                        }
                    }]
                }
            }]
        }
        response_cache.append_chunk(chat_id, f"data: {json.dumps(payload)}\n\n")
    except Exception as e:
        log_event("clarification_stream_error", {"chat_id": chat_id, "error": str(e)})

    try:
        # 2. Wait for user response (1 hour timeout)
        await asyncio.wait_for(event.wait(), timeout=3600)
        
        # 3. Extract Answer
        entry = callback_registry.get(cb_id)
        response_data = entry.get('response', {}) if entry else {}
        answer = response_data.get('content', 'No response provided.')
        
        return answer

    except asyncio.TimeoutError:
        return "ERROR: User did not provide clarification within the timeout period."
    finally:
        # 4. Cleanup from both memory and DB
        callback_registry.cleanup(cb_id)

import json
import asyncio
import logging
from typing import AsyncGenerator, Optional, List, Dict, Any

logger = logging.getLogger(__name__)

class ManualChunkEmitter:
    """
    Simulates SSE streaming for manual or system-generated messages.
    
    This allows internal agent logic (e.g. status updates, confirmed steps) 
    to be piped through the same ChatHandler and CacheSystem as real AI responses,
    ensuring consistent persistence and UI rendering.
    """

    @staticmethod
    async def stream_message(
        content: Optional[str] = None,
        thinking: Optional[str] = None,
        event: Optional[str] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None,
        tool_results: Optional[List[str]] = None,
        done: bool = True,
        parent_type: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Yields SSE-formatted strings mimicking the InferenceEngine output.
        
        Args:
            content: The main message content to stream.
            thinking: Optional reasoning/thinking content.
            event: Optional event status text.
            tool_calls: Optional list of tool calls to emit.
            tool_results: Optional list of tool results (used for persistence).
            done: Whether to emit the [DONE] signal at the end.
            parent_type: Optional identifier for the parent agent/module (e.g. 'research').
        """
        
        def _add_metadata(chunk):
            if parent_type:
                chunk["parent_type"] = parent_type
            return chunk

        # 1. Emit Reasoning/Thinking if present
        if thinking:
            chunk = _add_metadata({
                "choices": [{
                    "index": 0,
                    "delta": {"reasoning_content": thinking}
                }]
            })
            yield f"data: {json.dumps(chunk)}\n\n"

        # 1.1 Emit Event if present (Unified Activity Rendering)
        if event:
            chunk = _add_metadata({
                "choices": [{
                    "index": 0,
                    "delta": {"role": "event", "content": event}
                }]
            })
            yield f"data: {json.dumps(chunk)}\n\n"

        # 2. Emit Main Content if present
        if content:
            chunk = _add_metadata({
                "choices": [{
                    "index": 0,
                    "delta": {"content": content}
                }]
            })
            yield f"data: {json.dumps(chunk)}\n\n"

        # 3. Emit Tool Calls if present
        if tool_calls:
            for i, tc in enumerate(tool_calls):
                if "index" not in tc:
                    tc["index"] = i
                    
            chunk = _add_metadata({
                "choices": [{
                    "index": 0,
                    "delta": {"tool_calls": tool_calls}
                }]
            })
            yield f"data: {json.dumps(chunk)}\n\n"

        # 4. Handle Tool Results (Special case for persistence layer)
        if tool_results:
            for res in tool_results:
                chunk = _add_metadata({
                    "choices": [{
                        "index": 0,
                        "delta": {"tool_result": res}
                    }]
                })
                yield f"data: {json.dumps(chunk)}\n\n"

        # 5. Finalize message
        if done:
            yield "data: [DONE]\n\n"

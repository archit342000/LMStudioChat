import logging
import json
import sys
from typing import Dict, Any, Optional, List

# Setup standard logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("inference_proxy")

def log_event(event_type: str, data: Optional[Dict[str, Any]] = None):
    """Logs simple runtime events."""
    data_str = json.dumps(data) if data else "{}"
    logger.info(f"Event: {event_type} - Data: {data_str}")

def log_llm_call(
    payload: Dict[str, Any],
    response_text: str,
    model: str,
    chat_id: Optional[str],
    duration_s: float,
    call_type: str,
    timings: Optional[Dict[str, Any]] = None,
    tool_calls: Optional[List[Dict[str, Any]]] = None
):
    """Logs metrics and metadata for chat completions."""
    timings_str = json.dumps(timings) if timings else "{}"
    tool_calls_count = len(tool_calls) if tool_calls else 0
    logger.info(
        f"LLM Call: type={call_type} model={model} chat={chat_id} duration={duration_s:.3f}s "
        f"tool_calls={tool_calls_count} timings={timings_str}"
    )
    logger.debug(f"Response: {response_text}")

def log_embedding_call(
    payload: Dict[str, Any],
    response_data: Dict[str, Any],
    model: str,
    chat_id: Optional[str],
    duration_s: float
):
    """Logs embedding metrics."""
    logger.info(
        f"Embedding Call: model={model} chat={chat_id} duration={duration_s:.3f}s "
        f"vectors={response_data.get('count', 0)} dim={response_data.get('dimensions', 0)}"
    )

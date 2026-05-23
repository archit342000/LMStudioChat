import httpx
import logging
import json
from typing import List, Dict, Any, Optional
from logging_utils import log_event
from loader import load_model_config

logger = logging.getLogger(__name__)

async def ensure_model_loaded(model_name: str, base_url: str, api_key: str, category: str, timeout: float = 120.0):
    """
    Confirms if a model is loaded on a specific server, unloads others in the same category if needed,
    and loads the target model.
    """
    if not base_url:
        return

    try:
        # Load config to categorize models
        model_config = load_model_config()
        
        embedding_models = {model_config.get("embedding")}
        llm_models = set()
        llm_models.update(model_config.get("research", {}).values())
        llm_models.update(model_config.get("general", {}).values())
        
        models = await get_active_models(base_url, api_key)
        
        is_loaded = False
        to_unload = []
        
        for m in models:
            mid = m.get("id")
            status = m.get("status", {}).get("value", "unloaded")
            
            if status == "loaded":
                if mid == model_name:
                    is_loaded = True
                else:
                    if category == "llm" and mid in llm_models:
                        to_unload.append(mid)
                    elif category == "embedding" and mid in embedding_models:
                        to_unload.append(mid)
        
        if is_loaded:
            return

        log_event("model_swap_initiated", {
            "target": model_name, 
            "category": category,
            "server": base_url, 
            "unloading": to_unload
        })
        
        headers = _get_headers(api_key)
        async with httpx.AsyncClient(timeout=timeout) as client:
            for mid in to_unload:
                await _unload_model(client, mid, base_url, headers)
            
            await _load_model(client, model_name, base_url, headers, timeout)
            
    except Exception as e:
        log_event("ensure_model_loaded_error", {
            "error": str(e), 
            "model": model_name,
            "category": category,
            "server": base_url
        })
        raise

async def get_active_models(base_url: str, api_key: str) -> List[Dict[str, Any]]:
    """Fetch the list of models from the server."""
    endpoint = f"{base_url}/v1/models"
    headers = _get_headers(api_key)
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(endpoint, headers=headers)
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])

async def _unload_model(client: httpx.AsyncClient, model_name: str, base_url: str, headers: Dict[str, str]):
    """Send unload command to the server."""
    endpoint = f"{base_url}/models/unload"
    payload = {"model": model_name}
    response = await client.post(endpoint, json=payload, headers=headers)
    response.raise_for_status()

async def _load_model(client: httpx.AsyncClient, model_name: str, base_url: str, headers: Dict[str, str], timeout: float):
    """Send load command to the server."""
    endpoint = f"{base_url}/models/load"
    payload = {"model": model_name}
    response = await client.post(endpoint, json=payload, headers=headers)
    response.raise_for_status()

def _get_headers(api_key: str) -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers

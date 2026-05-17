from flask import Blueprint, request, jsonify, Response, stream_with_context
import requests
import json
from backend import config
from .loader import load_model_config

models_bp = Blueprint('models', __name__)

@models_bp.route('', methods=['GET'])
@models_bp.route('/', methods=['GET'])
@models_bp.route('/v1', methods=['GET', 'OPTIONS']) # Aliases /api/models/v1
def proxy_get_models():
    """Proxy GET models endpoints to the local AI backend, injecting the API key."""
    api_url = config.AI_URL.rstrip("/")
    
    # Standardize base URL
    base_url = api_url[:-3] if api_url.endswith('/v1') else api_url
    endpoint = f"{base_url}/v1/models"
    headers = {"Content-Type": "application/json"}
    if config.AI_API_KEY:
        headers["Authorization"] = f"Bearer {config.AI_API_KEY}"
        
    try:
        response = requests.get(endpoint, headers=headers, timeout=10)
        return Response(
            response.content, 
            status=response.status_code, 
            content_type=response.headers.get('content-type', 'application/json')
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@models_bp.route('/config', methods=['GET'])
def get_model_config():
    """Return the structured model configuration from config.json."""
    try:
        data = load_model_config()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@models_bp.route('/load', methods=['POST'])
def proxy_load_model():
    """Proxy POST to llama.cpp /models/load."""
    data = request.json or {}
    api_url = config.AI_URL.rstrip("/")
    
    base_url = api_url[:-3] if api_url.endswith('/v1') else api_url
    endpoint = f"{base_url}/models/load"
        
    headers = {"Content-Type": "application/json"}
    if config.AI_API_KEY:
        headers["Authorization"] = f"Bearer {config.AI_API_KEY}"
        
    try:
        response = requests.post(endpoint, json=data, headers=headers, timeout=60)
        return Response(
            response.content, 
            status=response.status_code, 
            content_type=response.headers.get('content-type', 'application/json')
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@models_bp.route('/unload', methods=['POST'])
def proxy_unload_model():
    """Proxy POST to llama.cpp /models/unload."""
    data = request.json or {}
    api_url = config.AI_URL.rstrip("/")
    
    base_url = api_url[:-3] if api_url.endswith('/v1') else api_url
    endpoint = f"{base_url}/models/unload"
        
    headers = {"Content-Type": "application/json"}
    if config.AI_API_KEY:
        headers["Authorization"] = f"Bearer {config.AI_API_KEY}"
        
    try:
        response = requests.post(endpoint, json=data, headers=headers, timeout=60)
        return Response(
            response.content, 
            status=response.status_code, 
            content_type=response.headers.get('content-type', 'application/json')
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@models_bp.route('/test-speed', methods=['POST'])
def proxy_test_model_speed():
    """Endpoint to test model speed by unloading all models, loading the selected one, and streaming a long generation."""
    import time
    data = request.json or {}
    model = data.get("model")
    target_context_threshold = int(data.get("target_context_threshold", 128000))

    if not model:
        return jsonify({"error": "Model is required"}), 400

    api_url = config.AI_URL.rstrip("/")
    base_url = api_url[:-3] if api_url.endswith('/v1') else api_url
    headers = {"Content-Type": "application/json"}
    if config.AI_API_KEY:
        headers["Authorization"] = f"Bearer {config.AI_API_KEY}"

    def generate():
        try:
            # 1. Unload all models
            yield f"data: {json.dumps({'test_status': 'Unloading models...'})}\n\n"
            models_resp = requests.get(f"{base_url}/v1/models", headers=headers, timeout=10)
            if models_resp.status_code == 200:
                loaded_models = models_resp.json().get("data", [])
                for m in loaded_models:
                    mid = m.get("id")
                    if mid and m.get("status", {}).get("value", "unloaded") == "loaded":
                        requests.post(f"{base_url}/models/unload", json={"model": mid}, headers=headers, timeout=60)
            
            # Poll until unloaded
            yield f"data: {json.dumps({'test_status': 'Confirming models unloaded...'})}\n\n"
            unloaded = False
            for _ in range(30):
                resp = requests.get(f"{base_url}/v1/models", headers=headers, timeout=10)
                if resp.status_code == 200:
                    data_models = resp.json().get("data", [])
                    if not any(m.get("status", {}).get("value", "unloaded") == "loaded" for m in data_models):
                        unloaded = True
                        break
                time.sleep(1)
            
            if not unloaded:
                yield f"data: {json.dumps({'error': 'Failed to fully unload existing models. Proceeding anyway...'})}\n\n"

            # 2. Load the target model
            yield f"data: {json.dumps({'test_status': f'Loading model {model}...'})}\n\n"
            # Some local backends might timeout on /models/load. Wait for 120s or ignore the timeout.
            try:
                requests.post(f"{base_url}/models/load", json={"model": model}, headers=headers, timeout=120)
            except requests.exceptions.Timeout:
                pass # Wait and poll anyway
            
            # Poll until loaded
            yield f"data: {json.dumps({'test_status': 'Waiting for model to load into memory...'})}\n\n"
            loaded = False
            for _ in range(120): # Up to 120 * 2 = 240 seconds for huge models
                try:
                    resp = requests.get(f"{base_url}/v1/models", headers=headers, timeout=10)
                    if resp.status_code == 200:
                        data_models = resp.json().get("data", [])
                        for m in data_models:
                            if m.get("id") == model and m.get("status", {}).get("value", "unloaded") == "loaded":
                                loaded = True
                                break
                except Exception:
                    pass
                if loaded:
                    break
                time.sleep(2)
            
            if not loaded:
                yield f"data: {json.dumps({'error': 'Failed to confirm model load. Inference may fail or be very slow.'})}\n\n"

            yield f"data: {json.dumps({'test_status': 'Starting context accumulation test...'})}\n\n"

            # 3. Dynamic Accumulation Loop
            messages = []
            total_tokens_tracked = 0
            turn_count = 1
            
            # Dynamically calculate tokens per turn
            # Generate more tokens per turn for larger contexts to reduce the number of turns
            max_tokens_per_turn = min(8192, max(500, target_context_threshold // 10))
            # Use a much larger safety cap for turns to avoid premature ending if model is short-winded
            max_turns_safety = 1000

            while total_tokens_tracked < target_context_threshold and turn_count <= max_turns_safety:
                # Build simple prompt requiring a long response
                messages.append({"role": "user", "content": f"Turn {turn_count}: Please write a very detailed and comprehensive essay on a complex topic. Write as much as you possibly can, aiming for length and depth."})
                
                yield f"data: {json.dumps({'test_status': f'Starting Turn {turn_count} (Current Context: {total_tokens_tracked}/{target_context_threshold} tokens)...'})}\n\n"

                payload = {
                    "model": model,
                    "messages": messages,
                    "stream": True,
                    "max_tokens": max_tokens_per_turn,
                    "stream_options": {"include_usage": True}
                }

                current_turn_response = ""
                # Need a long timeout for potentially large prefill times on huge contexts
                with requests.post(f"{base_url}/v1/chat/completions", json=payload, headers=headers, stream=True, timeout=None) as r:
                    for chunk in r.iter_lines():
                        if chunk:
                            chunk_str = chunk.decode('utf-8')
                            yield chunk_str + "\n\n"
                            
                            # Parse chunk locally to accumulate tokens and response
                            if chunk_str.startswith('data: ') and chunk_str != 'data: [DONE]':
                                try:
                                    data_obj = json.loads(chunk_str[6:])
                                    if data_obj.get("choices") and len(data_obj["choices"]) > 0:
                                        delta = data_obj["choices"][0].get("delta", {})
                                        if delta.get("reasoning_content"):
                                            current_turn_response += delta["reasoning_content"]
                                        if delta.get("content"):
                                            current_turn_response += delta["content"]
                                        
                                    if data_obj.get("usage") and data_obj["usage"].get("total_tokens"):
                                        total_tokens_tracked = data_obj["usage"]["total_tokens"]
                                    elif data_obj.get("timings"):
                                        prompt_n = data_obj["timings"].get("prompt_n", 0)
                                        predicted_n = data_obj["timings"].get("predicted_n", 0)
                                        if prompt_n + predicted_n > 0:
                                            total_tokens_tracked = prompt_n + predicted_n
                                except Exception:
                                    pass
                
                messages.append({"role": "assistant", "content": current_turn_response})
                turn_count += 1
            
            yield f"data: {json.dumps({'test_status': f'Completed. Reached threshold of {target_context_threshold} tokens.'})}\n\n"
        except Exception as stream_e:
            yield f"data: {json.dumps({'error': str(stream_e)})}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

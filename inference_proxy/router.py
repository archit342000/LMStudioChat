from flask import Blueprint, request, jsonify, Response, stream_with_context
import requests
import json
import time
import asyncio
import httpx
import config
from loader import load_model_config
from engine import InferenceEngine
from lifecycle import ensure_model_loaded
from logging_utils import log_event

models_bp = Blueprint('models', __name__)

@models_bp.route('', methods=['GET'])
@models_bp.route('/', methods=['GET'])
@models_bp.route('/v1', methods=['GET', 'OPTIONS'])
def proxy_get_models():
    """Proxy GET models endpoints to the local AI backend."""
    api_url = config.AI_URL.rstrip("/")
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
    """Proxy POST to llama.cpp /models/load, ensuring previous models are unloaded first."""
    data = request.json or {}
    model_name = data.get("model")
    if not model_name:
        return jsonify({"error": "Missing 'model' parameter"}), 400

    api_url = config.AI_URL.rstrip("/")
    base_url = api_url[:-3] if api_url.endswith('/v1') else api_url

    try:
        model_config = load_model_config()
        embedding_models = {model_config.get("embedding")}
        category = "embedding" if model_name in embedding_models else "llm"

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(
                ensure_model_loaded(
                    model_name=model_name,
                    base_url=base_url,
                    api_key=config.AI_API_KEY,
                    category=category,
                    timeout=60.0
                )
            )
            return jsonify({"status": "success", "message": f"Model {model_name} loaded successfully"})
        finally:
            loop.close()
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

# -------------------------------------------------------------------------
# Core Proxy Inference Endpoints
# -------------------------------------------------------------------------

@models_bp.route('/v1/chat/completions', methods=['POST'])
def proxy_chat_completions():
    """
    Exposes chat completions via InferenceEngine.
    Enforces serialization and streams/extracts thoughts on the fly.
    """
    data = request.json or {}
    messages = data.get("messages", [])
    model = data.get("model")
    chat_id = data.get("chat_id")
    stream = data.get("stream", False)
    
    if not model or not messages:
        return jsonify({"error": "Missing 'model' or 'messages'"}), 400

    # Extract dynamic parameters
    params = {k: v for k, v in data.items() if k not in ["model", "messages", "stream", "chat_id"]}
    
    engine = InferenceEngine()

    if stream:
        def stream_response():
            # Run the async generator inside an event loop for Flask streaming compatibility
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            gen = engine.stream(messages=messages, model=model, chat_id=chat_id, **params)
            try:
                while True:
                    try:
                        chunk = loop.run_until_complete(gen.__anext__())
                        yield chunk + "\n\n"
                    except StopAsyncIteration:
                        break
            except GeneratorExit:
                try:
                    loop.run_until_complete(gen.aclose())
                except Exception:
                    pass
                raise
            except Exception as stream_err:
                yield f"data: {json.dumps({'error': str(stream_err)})}\n\n"
            finally:
                try:
                    loop.run_until_complete(gen.aclose())
                except Exception:
                    pass
                loop.close()
        return Response(stream_with_context(stream_response()), mimetype='text/event-stream')
    else:
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                engine.chat(messages=messages, model=model, chat_id=chat_id, **params)
            )
            loop.close()
            return jsonify(result)
        except Exception as err:
            return jsonify({"error": str(err)}), 500

@models_bp.route('/v1/embeddings', methods=['POST'])
def proxy_embeddings():
    """
    Exposes embeddings generation via InferenceEngine.
    """
    data = request.json or {}
    inputs = data.get("input")
    model = data.get("model")
    chat_id = data.get("chat_id")
    
    if not model or inputs is None:
        return jsonify({"error": "Missing 'model' or 'input'"}), 400

    params = {k: v for k, v in data.items() if k not in ["model", "input", "chat_id"]}
    
    engine = InferenceEngine()
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        vectors = loop.run_until_complete(
            engine.embed(input=inputs, model=model, chat_id=chat_id, **params)
        )
        loop.close()
        
        # Standardize return format matching OpenAI spec
        response_data = {
            "object": "list",
            "data": [{"object": "embedding", "index": idx, "embedding": vec} for idx, vec in enumerate(vectors)],
            "model": model
        }
        return jsonify(response_data)
    except Exception as err:
        return jsonify({"error": str(err)}), 500

# -------------------------------------------------------------------------
# Telemetry / Speed Test Endpoint
# -------------------------------------------------------------------------

@models_bp.route('/test-speed', methods=['POST'])
def proxy_test_model_speed():
    """Endpoint to test model speed by unloading all models, loading the selected one, and streaming."""
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
            yield f"data: {json.dumps({'test_status': 'Unloading models...'})}\n\n"
            models_resp = requests.get(f"{base_url}/v1/models", headers=headers, timeout=10)
            if models_resp.status_code == 200:
                loaded_models = models_resp.json().get("data", [])
                for m in loaded_models:
                    mid = m.get("id")
                    if mid and m.get("status", {}).get("value", "unloaded") == "loaded":
                        requests.post(f"{base_url}/models/unload", json={"model": mid}, headers=headers, timeout=60)
            
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

            yield f"data: {json.dumps({'test_status': f'Loading model {model}...'})}\n\n"
            try:
                requests.post(f"{base_url}/models/load", json={"model": model}, headers=headers, timeout=120)
            except requests.exceptions.Timeout:
                pass
            
            yield f"data: {json.dumps({'test_status': 'Waiting for model to load into memory...'})}\n\n"
            loaded = False
            for _ in range(120):
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

            # Accept dynamic topics from the client request payload
            topics = data.get("topics")
            if not topics or not isinstance(topics, list):
                topics = [
                    "artificial intelligence and neural networks",
                    "quantum mechanics and computing",
                    "philosophical theories of consciousness",
                    "the history of classical music",
                    "principles of modern architecture",
                    "astrophysics and the life cycle of stars",
                    "macroeconomics and global monetary policy",
                    "the evolution of programming paradigms",
                    "organic chemistry and molecular biology",
                    "ancient civilizations and archaeology"
                ]

            engine = InferenceEngine()
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            messages = []
            total_tokens_tracked = 0
            last_tokens_tracked = -1
            turn_count = 1
            max_tokens_per_turn = min(8192, max(500, target_context_threshold // 10))
            max_turns_safety = 1000

            while total_tokens_tracked < target_context_threshold and turn_count <= max_turns_safety:
                topic = topics[(turn_count - 1) % len(topics)]
                prompt_content = (
                    f"Turn {turn_count}: Please write a very detailed and comprehensive essay on the following topic: {topic}. "
                    "Write as much as you possibly can, aiming for maximum length, depth, and structured detail."
                )
                messages.append({"role": "user", "content": prompt_content})
                yield f"data: {json.dumps({'test_status': f'Starting Turn {turn_count} (Current Context: {total_tokens_tracked}/{target_context_threshold} tokens)...'})}\n\n"

                current_turn_content = ""
                current_turn_reasoning = ""

                # Route through InferenceEngine — the same path as normal chat completions.
                # This ensures StreamInterceptor correctly splits <think> tags into
                # reasoning_content vs content, _normalize_messages() sanitises the history,
                # and the semaphore serialises the request exactly as the real app does.
                # Disable thinking/reasoning entirely for the speed test to
                # avoid issues arising from the template stripping reasoning tokens in history.
                thinking_budget = 0

                log_event("test_speed_request", {
                    "turn": turn_count,
                    "model": model,
                    "max_tokens": max_tokens_per_turn,
                    "thinking_budget_tokens": thinking_budget,
                    "enable_thinking": False,
                    "message_count": len(messages),
                    "messages": messages,
                })

                gen = engine.stream(
                    messages=messages,
                    model=model,
                    max_tokens=max_tokens_per_turn,
                    thinking_budget_tokens=thinking_budget,
                    enable_thinking=False,
                    stream_options={"include_usage": True}
                )
                try:
                    while True:
                        try:
                            line = loop.run_until_complete(gen.__anext__())
                            yield line + "\n\n"

                            if line.startswith("data: ") and line != "data: [DONE]":
                                try:
                                    data_obj = json.loads(line[6:])
                                    delta = (data_obj.get("choices") or [{}])[0].get("delta", {})
                                    if delta.get("reasoning_content"):
                                        current_turn_reasoning += delta["reasoning_content"]
                                    if delta.get("content"):
                                        current_turn_content += delta["content"]
                                    if data_obj.get("usage"):
                                        usage_total = data_obj["usage"].get("total_tokens")
                                        if usage_total:
                                            total_tokens_tracked = usage_total
                                except Exception:
                                    pass
                        except StopAsyncIteration:
                            break
                except GeneratorExit:
                    loop.run_until_complete(gen.aclose())
                    loop.close()
                    return
                finally:
                    try:
                        loop.run_until_complete(gen.aclose())
                    except Exception:
                        pass

                # Preserve both content and reasoning_content in the history message,
                # exactly as the real app stores assistant turns. reasoning_content is
                # essential for the model to maintain coherent context across turns —
                # the chat template re-injects it as <think> for the next request.
                messages.append({
                    "role": "assistant",
                    "content": current_turn_content,
                    "reasoning_content": current_turn_reasoning
                })

                if total_tokens_tracked <= last_tokens_tracked:
                    yield f"data: {json.dumps({'test_status': f'Context accumulation stopped at {total_tokens_tracked} tokens (context limit reached or shifting active). Stopping test.'})}\n\n"
                    break
                last_tokens_tracked = total_tokens_tracked

                turn_count += 1

            loop.close()
            yield f"data: {json.dumps({'test_status': f'Completed. Reached threshold of {target_context_threshold} tokens.'})}\n\n"
        except Exception as stream_e:
            yield f"data: {json.dumps({'error': str(stream_e)})}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

import httpx
import json
import time
import asyncio
import multiprocessing
import os
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator, Union
from backend import config
from backend.logging import log_llm_call, log_event, log_embedding_call
from backend.inference.parsers import get_parser_for_model, StreamInterceptor

logger = logging.getLogger(__name__)

class AsyncMPSemaphore:
    """
    A wrapper to make multiprocessing.Semaphore async-friendly.
    Enables sharing a lock across multiple OS processes (e.g. gunicorn workers)
    without blocking the asyncio event loop.
    """
    def __init__(self, sem: multiprocessing.Semaphore):
        self.sem = sem

    async def __aenter__(self):
        # Run the blocking acquire in a thread to keep the loop free
        await asyncio.to_thread(self.sem.acquire)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Run the blocking release in a thread
        await asyncio.to_thread(self.sem.release)

class InferenceEngine:
    """
    Unified caller for LLM inference (chat completions) and embeddings.
    Abstracts away configuration and credentials, exposing a clean interface 
    for inference requests.
    
    This class is implemented as a Singleton and enforces request serialization
    using a multiprocessing Semaphore to limit concurrent hits to the inference 
    server across all application processes.
    """
    
    _instance = None
    _mp_sem = None # The underlying multiprocessing semaphore
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(InferenceEngine, cls).__new__(cls)
            
            # Initialize the multiprocessing semaphore once
            # This will be shared among all processes that import this module
            # if they share the same parent process (standard for gunicorn/app.run)
            if cls._mp_sem is None:
                cls._mp_sem = multiprocessing.Semaphore(config.INFERENCE_PARALLELISM)
            
            # Async-friendly wrapper
            cls._instance._lock = AsyncMPSemaphore(cls._mp_sem)
            
            # Initialize instance attributes
            cls._instance.ai_url = config.AI_URL.rstrip("/") if config.AI_URL else ""
            cls._instance.ai_api_key = config.AI_API_KEY
            cls._instance.embedding_url = config.EMBEDDING_URL.rstrip("/") if config.EMBEDDING_URL else ""
            cls._instance.embedding_api_key = config.EMBEDDING_API_KEY
            
            cls._instance.timeout_llm = config.TIMEOUT_LLM_ASYNC or 120.0
            cls._instance.timeout_embedding = config.TIMEOUT_EMBEDDING
            
            log_event("inference_engine_initialized", {"parallelism": config.INFERENCE_PARALLELISM})
        return cls._instance

    def __init__(self):
        # Attributes are initialized in __new__ for the singleton
        pass

    async def start(self):
        """
        Initialization hook called on app startup.
        """
        log_event("inference_engine_started", {"status": "ready"})
        return True

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    async def chat(
        self, 
        messages: List[Dict[str, Any]], 
        model: str, 
        chat_id: Optional[str] = None,
        chat_template_kwargs: Optional[Dict[str, Any]] = None,
        **params
    ) -> Dict[str, Any]:
        """
        Executes a standard, blocking chat completion request with retry logic.
        """
        if chat_id and not params.get("skip_compression"):
            from backend.inference.compression import check_and_trigger_compression
            params_copy = params.copy()
            params_copy.pop("skip_compression", None)
            params_copy.pop("max_tokens", None)
            messages = await check_and_trigger_compression(
                chat_id=chat_id,
                messages=messages,
                model=model,
                max_tokens=params.get("max_tokens"),
                **params_copy
            )
        else:
            params = params.copy()
            params.pop("skip_compression", None)

        attempts = 0
        max_attempts = config.LLM_RETRY_COUNT

        while attempts < max_attempts:
            attempts += 1
            # Acquire lock to ensure serialized execution across all processes
            async with self._lock:
                # Ensure model is loaded before inference
                await self.ensure_model_loaded(model, self.ai_url, self.ai_api_key, "llm")
                
                start_time = time.time()
                endpoint = f"{self.ai_url}/v1/chat/completions"
                
                payload = {
                    "model": model,
                    "messages": self._normalize_messages(messages),
                    "stream": False,
                    **params
                }
                
                if chat_template_kwargs:
                    payload["chat_template_kwargs"] = chat_template_kwargs

                try:
                    response = await self._request("POST", endpoint, self.ai_api_key, payload, self.timeout_llm)
                    data = response.json()
                    
                    # Log the transaction
                    msg = data.get("choices", [{}])[0].get("message", {})
                    
                    raw_content = msg.get("content", "") or ""
                    if raw_content:
                        parser_config = get_parser_for_model(model)
                        interceptor = StreamInterceptor(parser_config)
                        c_emit, r_emit = interceptor.process_chunk(raw_content)
                        c_flush, r_flush = interceptor.flush()
                        
                        msg["content"] = c_emit + c_flush
                        msg["reasoning_content"] = r_emit + r_flush
                        
                    content = msg.get("content") or ""
                    reasoning = msg.get("reasoning_content") or ""
                    tool_calls = msg.get("tool_calls")
                    
                    # Validate the generation
                    if not self._is_generation_valid(content, tool_calls):
                        if attempts < max_attempts:
                            log_event("inference_retry", {
                                "reason": "invalid_generation", 
                                "attempt": attempts, 
                                "chat_id": chat_id,
                                "has_reasoning": bool(reasoning)
                            })
                            await asyncio.sleep(config.LLM_RETRY_DELAY)
                            continue

                    final_log_text = ""
                    if reasoning:
                        final_log_text += f"[Reasoning]\n{reasoning}\n[Content]\n"
                    final_log_text += content
                    
                    self._log_llm_call(
                        payload=payload, 
                        response_text=final_log_text, 
                        model=model, 
                        chat_id=chat_id, 
                        duration=time.time() - start_time, 
                        call_type="engine_blocking",
                        timings=data.get("timings"),
                        tool_calls=tool_calls
                    )
                    
                    return data
                except Exception as e:
                    if attempts < max_attempts:
                        log_event("inference_chat_retry_error", {"error": str(e), "attempt": attempts, "chat_id": chat_id})
                        await asyncio.sleep(config.LLM_RETRY_DELAY)
                        continue
                    log_event("inference_chat_error", {"error": str(e), "chat_id": chat_id})
                    raise

    async def stream(
        self, 
        messages: List[Dict[str, Any]], 
        model: str, 
        chat_id: Optional[str] = None,
        chat_template_kwargs: Optional[Dict[str, Any]] = None,
        **params
    ) -> AsyncGenerator[str, None]:
        """
        Executes a streaming chat completion request with retry logic.
        """
        if chat_id and not params.get("skip_compression"):
            from backend.inference.compression import check_and_trigger_compression
            params_copy = params.copy()
            params_copy.pop("skip_compression", None)
            params_copy.pop("max_tokens", None)
            messages = await check_and_trigger_compression(
                chat_id=chat_id,
                messages=messages,
                model=model,
                max_tokens=params.get("max_tokens"),
                **params_copy
            )
        else:
            params = params.copy()
            params.pop("skip_compression", None)

        attempts = 0
        max_attempts = config.LLM_RETRY_COUNT
        
        # Initialize these outside the loop to ensure they are always bound for the finally block
        full_content = ""
        full_reasoning = ""
        tool_calls = {}
        sorted_tool_calls = None
        timings = None
        start_time = time.time()
        payload = {}

        while attempts < max_attempts:
            attempts += 1
            # Reset trackers for this attempt
            full_content = ""
            full_reasoning = ""
            tool_calls = {}
            sorted_tool_calls = None
            timings = None
            start_time = time.time()
            
            # Acquire lock and hold it throughout the duration of the stream
            async with self._lock:
                # Ensure model is loaded before inference
                await self.ensure_model_loaded(model, self.ai_url, self.ai_api_key, "llm")
                
                parser_config = get_parser_for_model(model)
                interceptor = StreamInterceptor(parser_config)
                
                endpoint = f"{self.ai_url}/v1/chat/completions"
                payload = {
                    "model": model,
                    "messages": self._normalize_messages(messages),
                    "stream": True,
                    **params
                }
                
                if chat_template_kwargs:
                    payload["chat_template_kwargs"] = chat_template_kwargs
                
                try:
                    headers = self._get_headers(self.ai_api_key)
                    timeout = httpx.Timeout(self.timeout_llm, read=config.TIMEOUT_LLM_STREAM_READ)
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        async with client.stream("POST", endpoint, json=payload, headers=headers) as response:
                            response.raise_for_status()
                            async for line in response.aiter_lines():
                                if not line or not line.startswith("data: "):
                                    continue
                                
                                if line == "data: [DONE]":
                                    c_flush, r_flush = interceptor.flush()
                                    if c_flush or r_flush:
                                        flush_chunk = {"choices": [{"delta": {}}]}
                                        if c_flush:
                                            flush_chunk["choices"][0]["delta"]["content"] = c_flush
                                            full_content += c_flush
                                        if r_flush:
                                            flush_chunk["choices"][0]["delta"]["reasoning_content"] = r_flush
                                            full_reasoning += r_flush
                                        yield f"data: {json.dumps(flush_chunk)}"
                                    break
                                
                                # Background tracking for logging and validation
                                try:
                                    chunk = json.loads(line[6:])
                                    if "timings" in chunk:
                                        timings = chunk["timings"]
                                        
                                    choices = chunk.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {})
                                        
                                        raw_content = delta.get("content", "")
                                        if raw_content:
                                            c_emit, r_emit = interceptor.process_chunk(raw_content)
                                            if "content" in delta:
                                                del delta["content"]
                                                
                                            if c_emit:
                                                delta["content"] = c_emit
                                                full_content += c_emit
                                            if r_emit:
                                                delta["reasoning_content"] = r_emit
                                                full_reasoning += r_emit
                                                
                                        if "tool_calls" in delta:
                                            for tc_delta in delta["tool_calls"]:
                                                idx = tc_delta.get("index", 0)
                                                if idx not in tool_calls:
                                                    tool_calls[idx] = tc_delta
                                                else:
                                                    # Merge arguments
                                                    if "function" in tc_delta and "arguments" in tc_delta["function"]:
                                                        if "function" not in tool_calls[idx]: tool_calls[idx]["function"] = {"arguments": ""}
                                                        tool_calls[idx]["function"]["arguments"] += tc_delta["function"]["arguments"] or ""
                                        
                                        line = f"data: {json.dumps(chunk)}"
                                except Exception:
                                    pass
                                    
                                yield line
                    
                    # Validate the generation after the stream ends
                    sorted_tool_calls = [tool_calls[i] for i in sorted(tool_calls.keys())] if tool_calls else None
                    if not self._is_generation_valid(full_content, sorted_tool_calls):
                        if attempts < max_attempts:
                            log_event("inference_stream_retry", {
                                "reason": "invalid_generation", 
                                "attempt": attempts, 
                                "chat_id": chat_id
                            })
                            # Yield redact signal to the UI to clear the failed stream
                            yield f"data: {json.dumps({'__redact__': True, 'message': 'Inference failed validation. Retrying...'})}\n\n"
                            await asyncio.sleep(config.LLM_RETRY_DELAY)
                            continue
                    
                    # If we reach here, the generation is valid or we are out of retries
                    break

                except Exception as e:
                    if attempts < max_attempts:
                        log_event("inference_stream_retry_error", {"error": str(e), "attempt": attempts, "chat_id": chat_id})
                        # Yield redact signal to the UI
                        yield f"data: {json.dumps({'__redact__': True, 'message': f'Error: {str(e)}. Retrying...'})}\n\n"
                        await asyncio.sleep(config.LLM_RETRY_DELAY)
                        continue
                    log_event("inference_stream_error", {"error": str(e), "chat_id": chat_id})
                    raise
                finally:
                    # Final logging only on the LAST attempt (successful or final failure)
                    if attempts >= max_attempts or self._is_generation_valid(full_content, sorted_tool_calls):
                        final_log_text = ""
                        if full_reasoning:
                            final_log_text += f"[Reasoning]\n{full_reasoning}\n[Content]\n"
                        final_log_text += full_content
                        
                        self._log_llm_call(
                            payload=payload, 
                            response_text=final_log_text, 
                            model=model, 
                            chat_id=chat_id, 
                            duration=time.time() - start_time, 
                            call_type="engine_stream",
                            timings=timings,
                            tool_calls=sorted_tool_calls
                        )

    def _is_generation_valid(self, content: str, tool_calls: Optional[List[Dict[str, Any]]]) -> bool:
        """
        Validates if the generated response is actionable.
        Returns False if:
        1. Both content and tool_calls are empty (only reasoning or nothing).
        2. Tool calls are present but have invalid JSON in arguments.
        """
        # 1. Check for empty actionable content
        has_content = content and content.strip()
        has_tool_calls = tool_calls and len(tool_calls) > 0
        
        if not has_content and not has_tool_calls:
            return False
            
        # 2. Check for invalid tool call syntax
        if has_tool_calls:
            for tc in tool_calls:
                func = tc.get("function", {})
                args_str = func.get("arguments", "")
                if args_str:
                    try:
                        json.loads(args_str)
                    except json.JSONDecodeError:
                        return False
        
        return True

    async def embed(
        self, 
        input: Union[str, List[str]], 
        model: str,
        chat_id: str = None,
        **params
    ) -> List[List[float]]:
        """
        Executes an embedding request.
        """
        # Acquire lock for embedding request
        async with self._lock:
            # Ensure embedding model is loaded
            await self.ensure_model_loaded(model, self.embedding_url, self.embedding_api_key, "embedding")
            
            endpoint = f"{self.embedding_url}/v1/embeddings"
            payload = {
                "model": model,
                "input": [input] if isinstance(input, str) else input,
                **params
            }

            start_time = time.time()
            try:
                response = await self._request("POST", endpoint, self.embedding_api_key, payload, self.timeout_embedding)
                data = response.json()
                embeddings = [item["embedding"] for item in data.get("data", [])]
                
                # Log the successful embedding call to the network index
                try:
                    # Summarize response to avoid bloating logs with huge vector arrays
                    summary_data = {
                        "count": len(embeddings),
                        "dimensions": len(embeddings[0]) if embeddings else 0,
                        "model": model
                    }
                    log_embedding_call(
                        payload=payload,
                        response_data=summary_data,
                        model=model,
                        chat_id=chat_id,
                        duration_s=time.time() - start_time
                    )
                except Exception as e:
                    logger.warning(f"Failed to log embedding call: {e}")
                    
                return embeddings
            except Exception as e:
                print("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@")
                print(input)
                print("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@")
                log_event("inference_embed_error", {"error": str(e), "chat_id": chat_id})
                raise

    def embed_sync(self, *args, **kwargs) -> List[List[float]]:
        """
        Synchronous wrapper for embed().
        """
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        return loop.run_until_complete(self.embed(*args, **kwargs))

    async def ensure_model_loaded(self, model_name: str, base_url: str, api_key: str, category: str):
        """
        Confirms if a model is loaded on a specific server.
        """
        if not base_url:
            return

        try:
            from backend.models import ensure_model_loaded as lifecycle_ensure_loaded
            await lifecycle_ensure_loaded(model_name, base_url, api_key, category, timeout=self.timeout_llm)
        except Exception as e:
            log_event("ensure_model_loaded_error", {
                "error": str(e), 
                "model": model_name,
                "category": category,
                "server": base_url
            })


    async def _request(self, method: str, url: str, api_key: str, payload: dict, timeout: float) -> httpx.Response:
        headers = self._get_headers(api_key)
        async with httpx.AsyncClient(timeout=timeout) as client:
            kwargs = {"json": payload} if payload is not None else {}
            response = await client.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            return response

    def _get_headers(self, api_key: str) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

    def _normalize_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized = []
        allowed_roles = ["system", "user", "assistant", "tool"]
        
        for msg in messages:
            m = dict(msg)
            role = m.get("role")
            
            # 1. Strict Role Filtering: Silently skip internal roles like "event"
            if role not in allowed_roles:
                continue
            
            # Ensure content is a string unless it's a valid multimodal list for a user
            content = m.get("content")
            
            # Special handling for screenshot references in tool results
            if role == "tool" and isinstance(content, dict) and "screenshot_ref" in content:
                ref_path = content.get("screenshot_ref")
                mime_type = content.get("mime_type", "image/jpeg")
                
                # 1. Standardize Tool Message (MUST be a string)
                m["content"] = content.get("message", "Screenshot captured.")
                
                # 2. Process fields and append the tool message
                for field in ["id", "chat_id", "timestamp", "is_hidden", "model", "file_system_id", "parent_message_id", "parent_type", "reasoning_content"]:
                    m.pop(field, None)
                m.pop("tool_calls", None)
                if not m.get("tool_call_id"): m["tool_call_id"] = "unknown"
                if not m.get("name"): m["name"] = "unknown"
                
                normalized.append({k: v for k, v in m.items() if k in ["role", "content", "name", "tool_calls", "tool_call_id"]})
                
                # 3. Inject Synthetic User Message with the image
                if ref_path and os.path.exists(ref_path):
                    try:
                        import base64
                        with open(ref_path, "rb") as f:
                            b64_data = base64.b64encode(f.read()).decode("utf-8")
                        
                        normalized.append({
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "Visual context from the browser screenshot taken in the previous step:"},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:{mime_type};base64,{b64_data}"}
                                }
                            ]
                        })
                    except Exception as e:
                        logger.error(f"Failed to load screenshot for synthetic user msg: {e}")
                
                continue # Skip default append

            elif isinstance(content, (list, dict)):
                # Valid multimodal: a list of dicts where each dict has a 'type' field
                is_multimodal = (
                    isinstance(content, list) and 
                    len(content) > 0 and 
                    all(isinstance(item, dict) and "type" in item for item in content)
                )
                if not is_multimodal or role != "user":
                    m["content"] = json.dumps(content)

            # 2. Reasoning Content Pass-Through
            # We preserve reasoning_content as a separate key so the inference template (llama.cpp)
            # can format it according to the specific model's syntax (e.g. <think> vs <|channel>thought).
                
            for field in ["id", "chat_id", "timestamp", "is_hidden", "model", "file_system_id", "parent_message_id", "parent_type"]:
                m.pop(field, None)
            if role in ["system", "user"]:
                m.pop("tool_calls", None)
                m.pop("tool_call_id", None)
                m.pop("name", None)
                m.pop("reasoning_content", None)
            elif role == "assistant":
                tcs = m.get("tool_calls")
                pass
                if isinstance(tcs, list) and len(tcs) > 0:
                    for tc in tcs:
                        if isinstance(tc, dict): tc["type"] = "function"
                    m["tool_calls"] = tcs
                else:
                    m.pop("tool_calls", None)
                m.pop("tool_call_id", None)
                if m.get("name") is None: m.pop("name", None)
            elif role == "tool":
                m.pop("tool_calls", None)
                m.pop("reasoning_content", None)
                if not m.get("tool_call_id"): m["tool_call_id"] = "unknown"
                if not m.get("name"): m["name"] = "unknown"

            if m.get("content") is None: m["content"] = ""
            m = {k: v for k, v in m.items() if k in ["role", "content", "name", "tool_calls", "tool_call_id", "reasoning_content"]}
            normalized.append(m)
        return normalized

    def _log_llm_call(self, payload: dict, response_text: str, model: str, chat_id: str, duration: float, call_type: str, timings: Optional[dict] = None, tool_calls: Optional[list] = None):
        log_llm_call(payload=payload, response_text=response_text, model=model, chat_id=chat_id, duration_s=duration, call_type=call_type, timings=timings, tool_calls=tool_calls)

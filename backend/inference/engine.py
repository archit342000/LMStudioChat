import httpx
import json
import time
import asyncio
import os
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator, Union
from backend import config
from backend.logging import log_llm_call, log_event, log_embedding_call

logger = logging.getLogger(__name__)

class InferenceEngine:
    """
    Client-side forwarder wrapper for LLM inference and embeddings.
    Always routes requests directly to the standalone proxy.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(InferenceEngine, cls).__new__(cls)
            
            cls._instance.timeout_llm = config.TIMEOUT_LLM_ASYNC or 120.0
            cls._instance.timeout_embedding = config.TIMEOUT_EMBEDDING
            
            log_event("client_inference_engine_initialized", {
                "proxy_url": cls._instance.proxy_url,
                "mode": "proxy"
            })
        return cls._instance

    @property
    def proxy_url(self) -> str:
        if hasattr(self, "_proxy_url_override"):
            return self._proxy_url_override
        return config.AI_PROXY_URL.rstrip("/")

    @proxy_url.setter
    def proxy_url(self, value: str):
        self._proxy_url_override = value

    @proxy_url.deleter
    def proxy_url(self):
        if hasattr(self, "_proxy_url_override"):
            del self._proxy_url_override

    def __init__(self):
        pass

    async def start(self):
        log_event("client_inference_engine_started", {"status": "ready"})
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
        Runs local compression, applies client-side retries, and forwards blocking completions to the proxy.
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
            start_time = time.time()
            
            endpoint = f"{self.proxy_url}/api/models/v1/chat/completions"

            payload = {
                "model": model,
                "messages": self._normalize_messages(messages),
                "stream": False,
                **params
            }
            
            if chat_template_kwargs:
                payload["chat_template_kwargs"] = chat_template_kwargs

            try:
                response = await self._request("POST", endpoint, payload, self.timeout_llm)
                data = response.json()
                msg = data.get("choices", [{}])[0].get("message", {})
                
                content = msg.get("content") or ""
                tool_calls = msg.get("tool_calls")
                
                if not self._is_generation_valid(content, tool_calls):
                    if attempts < max_attempts:
                        log_event("inference_retry", {
                            "reason": "invalid_generation", 
                            "attempt": attempts, 
                            "chat_id": chat_id
                        })
                        await asyncio.sleep(config.LLM_RETRY_DELAY)
                        continue

                reasoning = msg.get("reasoning_content") or ""
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
        Runs local compression, applies client-side retries/redaction, and streams completions from the proxy.
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
        
        full_content = ""
        full_reasoning = ""
        tool_calls = {}
        sorted_tool_calls = None
        timings = None
        start_time = time.time()
        payload = {}

        while attempts < max_attempts:
            attempts += 1
            full_content = ""
            full_reasoning = ""
            tool_calls = {}
            sorted_tool_calls = None
            timings = None
            start_time = time.time()
            
            endpoint = f"{self.proxy_url}/api/models/v1/chat/completions"

            payload = {
                "model": model,
                "messages": self._normalize_messages(messages),
                "stream": True,
                **params
            }
            
            if chat_template_kwargs:
                payload["chat_template_kwargs"] = chat_template_kwargs

            try:
                headers = self._get_headers()
                timeout = httpx.Timeout(self.timeout_llm, read=config.TIMEOUT_LLM_STREAM_READ)
                
                async with httpx.AsyncClient(timeout=timeout) as client:
                    async with client.stream("POST", endpoint, json=payload, headers=headers) as response:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if not line or not line.startswith("data: "):
                                continue
                            if line == "data: [DONE]":
                                break
                            try:
                                chunk = json.loads(line[6:])
                                if "timings" in chunk:
                                    timings = chunk["timings"]
                                choices = chunk.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    if "content" in delta:
                                        full_content += delta["content"]
                                    if "reasoning_content" in delta:
                                        full_reasoning += delta["reasoning_content"]
                                    if "tool_calls" in delta:
                                        for tc_delta in delta["tool_calls"]:
                                            idx = tc_delta.get("index", 0)
                                            if idx not in tool_calls:
                                                tool_calls[idx] = tc_delta
                                            else:
                                                if "function" in tc_delta and "arguments" in tc_delta["function"]:
                                                    if "function" not in tool_calls[idx]: tool_calls[idx]["function"] = {"arguments": ""}
                                                    tool_calls[idx]["function"]["arguments"] += tc_delta["function"]["arguments"] or ""
                            except Exception:
                                pass
                            yield line
                
                sorted_tool_calls = [tool_calls[i] for i in sorted(tool_calls.keys())] if tool_calls else None
                if not self._is_generation_valid(full_content, sorted_tool_calls):
                    if attempts < max_attempts:
                        log_event("inference_stream_retry", {
                            "reason": "invalid_generation", 
                            "attempt": attempts, 
                            "chat_id": chat_id
                        })
                        yield f"data: {json.dumps({'__redact__': True, 'message': 'Inference failed validation. Retrying...'})}\n\n"
                        await asyncio.sleep(config.LLM_RETRY_DELAY)
                        continue
                break

            except Exception as e:
                if attempts < max_attempts:
                    log_event("inference_stream_retry_error", {"error": str(e), "attempt": attempts, "chat_id": chat_id})
                    yield f"data: {json.dumps({'__redact__': True, 'message': f'Error: {str(e)}. Retrying...'})}\n\n"
                    await asyncio.sleep(config.LLM_RETRY_DELAY)
                    continue
                log_event("inference_stream_error", {"error": str(e), "chat_id": chat_id})
                raise
            finally:
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

    async def embed(self, input: Union[str, List[str]], model: str, chat_id: Optional[str] = None, **params) -> List[List[float]]:
        """
        Forwards embedding generation requests to the proxy.
        """
        endpoint = f"{self.proxy_url}/api/models/v1/embeddings"

        payload = {
            "model": model,
            "input": [input] if isinstance(input, str) else input,
            "chat_id": chat_id,
            **params
        }

        start_time = time.time()
        try:
            response = await self._request("POST", endpoint, payload, self.timeout_embedding)
            data = response.json()
            embeddings = [item["embedding"] for item in data.get("data", [])]
            
            try:
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

    async def ensure_model_loaded(self, model_name: str):
        """
        Forwards the model load check to the proxy.
        """
        endpoint = f"{self.proxy_url}/api/models/load"
        payload = {"model": model_name}
        try:
            await self._request("POST", endpoint, payload, self.timeout_llm)
        except Exception as e:
            log_event("ensure_model_loaded_error", {
                "error": str(e), 
                "model": model_name
            })

    async def _request(self, method: str, url: str, payload: dict, timeout: float) -> httpx.Response:
        headers = self._get_headers()
        async with httpx.AsyncClient(timeout=timeout) as client:
            kwargs = {"json": payload} if payload is not None else {}
            response = await client.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            return response

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        return headers

    def _is_generation_valid(self, content: str, tool_calls: Optional[List[Dict[str, Any]]]) -> bool:
        has_content = content and content.strip()
        has_tool_calls = tool_calls and len(tool_calls) > 0
        
        if not has_content and not has_tool_calls:
            return False
            
        if has_tool_calls:
            for tc in tool_calls:
                func = tc.get("function", {})
                args_str = func.get("arguments", "")
                if args_str:
                    try:
                        json.loads(args_str)
                    except Exception:
                        return False
        return True

    def _normalize_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized = []
        allowed_roles = ["system", "user", "assistant", "tool"]
        
        for msg in messages:
            m = dict(msg)
            role = m.get("role")
            
            if role not in allowed_roles:
                continue
            
            content = m.get("content")
            
            # Special handling for screenshot references in tool results
            if role == "tool" and isinstance(content, dict) and "screenshot_ref" in content:
                ref_path = content.get("screenshot_ref")
                mime_type = content.get("mime_type", "image/jpeg")
                
                m["content"] = content.get("message", "Screenshot captured.")
                
                for field in ["id", "chat_id", "timestamp", "is_hidden", "model", "file_system_id", "parent_message_id", "parent_type", "reasoning_content"]:
                    m.pop(field, None)
                m.pop("tool_calls", None)
                if not m.get("tool_call_id"): m["tool_call_id"] = "unknown"
                if not m.get("name"): m["name"] = "unknown"
                
                normalized.append({k: v for k, v in m.items() if k in ["role", "content", "name", "tool_calls", "tool_call_id"]})
                
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
                
                continue

            elif isinstance(content, (list, dict)):
                is_multimodal = (
                    isinstance(content, list) and 
                    len(content) > 0 and 
                    all(isinstance(item, dict) and "type" in item for item in content)
                )
                if not is_multimodal or role != "user":
                    m["content"] = json.dumps(content)

            for field in ["id", "chat_id", "timestamp", "is_hidden", "model", "file_system_id", "parent_message_id", "parent_type"]:
                m.pop(field, None)
            if role in ["system", "user"]:
                m.pop("tool_calls", None)
                m.pop("tool_call_id", None)
                m.pop("name", None)
                m.pop("reasoning_content", None)
            elif role == "assistant":
                tcs = m.get("tool_calls")
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
        try:
            log_llm_call(payload=payload, response_text=response_text, model=model, chat_id=chat_id, duration_s=duration, call_type=call_type, timings=timings, tool_calls=tool_calls)
        except Exception as e:
            logger.warning(f"Failed to log LLM call: {e}")

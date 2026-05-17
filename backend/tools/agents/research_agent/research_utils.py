import json
import asyncio
import datetime
import re
import urllib.parse
import html
import time
import httpx
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator
from backend.error_handling import CircuitOpenError
from backend.logging import log_event, log_tool_call
from backend import config
from .prompts import RESEARCH_VISION_PROMPT

logger = logging.getLogger(__name__)

def _safe_json_loads(data: str, fallback: Any = None) -> Any:
    """Safe JSON parsing with fallback."""
    if not data:
        return fallback
    try:
        return json.loads(data)
    except Exception:
        return fallback

from backend.mcp_client import tavily_client, playwright_client
from backend.models import (
    get_research_main_model,
    get_research_vision_model,
    get_general_vision_model
)
from backend.inference import InferenceEngine

inference_engine = InferenceEngine()

async def _stream_research_call(
    payload: Dict[str, Any], 
    display_model: Optional[str], 
    activity_type: str, 
    enable_thinking: bool,
    thought_limit: int = 2000,
    content_threshold: int = 100,
    is_final_content: bool = False,
    chat_id: Optional[str] = None,
    parent_message_id: Optional[int] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Unified wrapper for streaming LLM calls during background research tasks (Vision, etc.)
    that aren't managed by the main AgentHandler.
    """
    model = payload.get("model")
    messages = payload.get("messages", [])
    
    # Extract sampling params and other kwargs from payload
    params = {k: v for k, v in payload.items() if k not in ["model", "messages", "response_format"]}
    response_format = payload.get("response_format")
    
    # Inject thinking budget and enable thinking
    chat_template_kwargs = {"enable_thinking": enable_thinking}
    
    full_text = ""
    async for line in inference_engine.stream(
        messages=messages,
        model=model,
        chat_id=chat_id,
        chat_template_kwargs=chat_template_kwargs,
        thinking_budget_tokens=thought_limit,
        response_format=response_format,
        **params
    ):
        if line.startswith("data: "):
            if line == "data: [DONE]":
                break
            try:
                chunk = json.loads(line[6:])
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                
                # Forward reasoning chunks
                if "reasoning_content" in delta:
                    yield {"type": "chunk", "data": delta["reasoning_content"]}
                
                # Forward content chunks
                if "content" in delta:
                    txt = delta["content"]
                    full_text += txt
                    yield {"type": "chunk", "data": txt}
            except Exception:
                continue

    yield {"type": "result", "data": full_text}

def _is_transient_error(e):
    if isinstance(e, (httpx.NetworkError, httpx.TimeoutException, asyncio.TimeoutError, CircuitOpenError)):
        return True
    if isinstance(e, (json.JSONDecodeError, UnicodeDecodeError)):
        return True
    if isinstance(e, (KeyError, AttributeError, TypeError, NameError, IndexError, ValueError)):
        return False
    return True

def _extract_json_from_text(text):
    """
    Robustly extracts the first JSON object from a string.
    Useful for background tasks (like ranking) where the model might
    prefix output with a <think> block or other commentary.
    """
    if not text:
        return None
    
    # CLAUDE.md Compliance: Extract JSON ONLY from the content portion.
    # The reasoning content is now strictly separated at the inference parsing level,
    # so we no longer need to manually strip <think> blocks here.
    clean_text = text

    # First, try to parse the whole thing (fastest path)
    try:
        return json.loads(clean_text.strip())
    except json.JSONDecodeError:
        pass
    
    # Try to find a JSON object or array in the cleaned text
    target = clean_text
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = target.find(start_char)
        if start == -1:
            continue
        depth = 0
        for i in range(start, len(target)):
            if target[i] == start_char: 
                depth += 1
            elif target[i] == end_char:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(target[start:i+1])
                    except Exception:
                        break
    return None

async def _execute_mcp_tool(client, tool_name, arguments, chat_id=None, max_retries=2, timeout=None):
    """
    Execute an MCP tool with retry and timeout.
    Retries only on transient errors (network, timeout, circuit).
    """
    last_error = None

    for attempt in range(max_retries + 1):
        start_time = time.time()
        try:
            # Apply timeout if specified (7.6)
            if timeout:
                result = await asyncio.wait_for(
                    client.execute_tool(tool_name, arguments),
                    timeout=timeout
                )
            else:
                result = await client.execute_tool(tool_name, arguments)

            duration = time.time() - start_time
            log_content = ""
            if hasattr(result, 'content') and result.content:
                log_content = result.content[0].text
            else:
                log_content = str(result)
            log_tool_call(tool_name, arguments, log_content, duration_s=duration, chat_id=chat_id)
            return result

        except Exception as e:
            last_error = e
            duration = time.time() - start_time
            error_msg = f"ERROR: MCP Tool '{tool_name}' failed (attempt {attempt+1}/{max_retries+1}): {str(e)}"
            log_tool_call(tool_name, arguments, error_msg, duration_s=duration, chat_id=chat_id)

            if not _is_transient_error(e) or attempt == max_retries:
                log_event("tool_execution_error", {"tool": tool_name, "error": str(e), "chat_id": chat_id, "attempts": attempt+1})
                raise

            # Exponential backoff: 1s, 2s
            backoff = (attempt + 1) * 1.0
            logger.warning(f"Retrying MCP tool '{tool_name}' in {backoff}s (attempt {attempt+1}/{max_retries+1})")
            await asyncio.sleep(backoff)

    raise last_error  # Should not reach here, but safety net
async def _fetch_and_encode_image(url):
    try:
        mcp_res = await _execute_mcp_tool(playwright_client, "fetch_and_encode_image_tool", {"url": url})
        res_json = _safe_json_loads(mcp_res.content[0].text, {})
        if "error" in res_json:
            return None
        return res_json.get("image")
    except Exception:
        return None
        
async def _process_images_in_content(content, url, enable_thinking, display_model=None, step_id=None, chat_id=None, vision_enabled=True):
    """Extract and describe images found in markdown content using a vision model.
    Yields activity packets and finally the modified content string."""
    # Skip vision processing if not enabled
    if not vision_enabled or not content:
        yield {"type": "result", "data": content}
        return
    
    # Improved extraction: find all potential img tags and markdown image markers
    md_matches = re.findall(r'!\[([^\]]*)\]\((https?://[^\)]+)\)', content)
    
    # Robust HTML image extraction: find raw tags first, then pick attributes (order-agnostic)
    raw_html_tags = re.findall(r'<img [^>]*src=["\'](https?://[^"\']+)["\'][^>]*>', content)
    
    all_candidates = []
    # Add markdown candidates
    for alt, img_url in md_matches:
        all_candidates.append({"url": img_url, "alt": alt})
    
    # Add HTML candidates (try to find matching alts if possible, otherwise generic)
    for img_url in raw_html_tags:
        # Check if we already have this URL from markdown
        if not any(c["url"] == img_url for c in all_candidates):
            # Attempt to find alt for this specific tag in the original content (simple heuristics)
            alt_match = re.search(f'<img [^>]*alt=["\']([^"\']+)["\'][^>]*src=["\']{re.escape(img_url)}["\']', content)
            if not alt_match:
                alt_match = re.search(f'<img [^>]*src=["\']{re.escape(img_url)}["\'][^>]*alt=["\']([^"\']+)["\']', content)
            alt = alt_match.group(1) if alt_match else ""
            all_candidates.append({"url": img_url, "alt": alt})

    descriptions = []
    success_count = 0
    quota = config.RESEARCH_MAX_IMAGES_PER_PAGE

    for candidate in all_candidates:
        if success_count >= quota:
            break
            
        img_url = html.unescape(candidate["url"]).split('#')[0].strip()
        alt = candidate["alt"]
        
        # Extension and safety check
        parsed_path = urllib.parse.urlparse(img_url).path.lower()
        if not (parsed_path.endswith(('.png', '.jpg', '.jpeg', '.webp')) and 'icon' not in img_url.lower() and 'logo' not in img_url.lower()):
            continue

        try:
            # Status-level chunks are disabled.
            
            base64_img = await _fetch_and_encode_image(img_url)
            if not base64_img:
                # Silently skip blocked/broken images - they don't count towards the quota
                continue
            
            today_date = datetime.date.today().strftime("%A, %B %d, %Y")
            payload = {
                "model": get_research_vision_model(),
                "messages": [
                    {"role": "system", "content": RESEARCH_VISION_PROMPT.format(url=url, alt=alt or "Untitled", today_date=today_date)},
                    {"role": "user", "content": [{"type": "image_url", "image_url": {"url": base64_img}}]}
                ],
                "max_tokens": config.RESEARCH_MAX_TOKENS_VISION,
                **_get_sampling_params(attempt=1),
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "vision_analysis",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "caption": {"type": "string"},
                                "detailed_description": {"type": "string"}
                            },
                            "required": ["caption", "detailed_description"],
                            "additionalProperties": False
                        }
                    }
                }
            }
            
            max_retries = config.RESEARCH_VISION_RETRIES
            img_desc = ""
            current_success = False
            
            for attempt in range(max_retries):
                try:
                    gen = _stream_research_call(
                        payload, None, "Researcher: Vision", enable_thinking,
                        thought_limit=config.RESEARCH_THINKING_BUDGET_VISION_TOKENS,
                        is_final_content=False, chat_id=chat_id,
                        parent_message_id=None
                    )
                    async for packet in gen:
                        if packet["type"] == "chunk": yield packet
                        elif packet["type"] == "result":
                            img_desc = packet["data"]
                    
                    if img_desc and len(img_desc) > config.RESEARCH_VISION_MIN_RESPONSE_LENGTH:
                        parsed = _extract_json_from_text(img_desc)
                        if parsed and isinstance(parsed, dict):
                            ai_caption = parsed.get("caption", "").strip() or (alt or 'Extracted Visual Data')
                            ai_detail = parsed.get("detailed_description", "").strip() or img_desc.strip()
                        else:
                            ai_caption = (alt or 'Extracted Visual Data')
                            ai_detail = img_desc.strip()
                        
                        triplet_block = (
                            f"\n\n### [IMAGE DETECTED]\n"
                            f"**Original Title**: {alt or 'Untitled'}\n"
                            f"**AI Generated Caption**: {ai_caption}\n"
                            f"**URL**: {img_url}\n"
                            f"**Vision Model Detailed Description**: {ai_detail}\n"
                        )
                        descriptions.append(triplet_block)
                        current_success = True
                    break
                except Exception:
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2 ** attempt)
            
            if current_success:
                success_count += 1
                
        except Exception:
            pass
    
    if descriptions:
        content += "\n\n" + "\n".join(descriptions)
    
    yield {"type": "result", "data": content}

async def _process_tavily_search_images(images, section_index, enable_thinking, display_model=None, chat_id=None, vision_enabled=True):
    """Process images from Tavily search results using vision model."""
    # Skip vision processing if not enabled
    if not vision_enabled or not images:
        yield {"type": "result", "data": []}
        return
    
    candidates = []
    for img_url in images:
        if isinstance(img_url, dict):
            img_url = img_url.get("url", "")
        if isinstance(img_url, str):
            img_url = html.unescape(img_url).split('#')[0].strip()
            parsed_path = urllib.parse.urlparse(img_url).path.lower()
            if parsed_path.endswith(('.png', '.jpg', '.jpeg', '.webp')) and 'icon' not in img_url.lower() and 'logo' not in img_url.lower():
                candidates.append(img_url)
    
    results = []
    success_count = 0
    quota = config.RESEARCH_MAX_SEARCH_IMAGES

    for img_url in candidates:
        if success_count >= quota:
            break
            
        try:
            # Status-level chunks are disabled.
            
            base64_img = await _fetch_and_encode_image(img_url)
            if not base64_img:
                continue
            
            today_date = datetime.date.today().strftime("%A, %B %d, %Y")
            payload = {
                "model": get_general_vision_model(),
                "messages": [
                    {"role": "system", "content": RESEARCH_VISION_PROMPT.format(url="Search Engine Results", alt="Contextual search image", today_date=today_date)},
                    {"role": "user", "content": [{"type": "image_url", "image_url": {"url": base64_img}}]}
                ],
                "max_tokens": config.RESEARCH_MAX_TOKENS_VISION,
                **_get_sampling_params(attempt=1),
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "vision_analysis",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "caption": {"type": "string"},
                                "detailed_description": {"type": "string"}
                            },
                            "required": ["caption", "detailed_description"],
                            "additionalProperties": False
                        }
                    }
                }
            }
            
            img_desc = ""
            current_success = False
            
            for attempt in range(config.RESEARCH_VISION_RETRIES):
                try:
                    gen = _stream_research_call(
                        payload, None, "Researcher: Evidence", enable_thinking,
                        thought_limit=config.RESEARCH_THINKING_BUDGET_VISION_TOKENS,
                        is_final_content=False, chat_id=chat_id
                    )
                    async for packet in gen:
                        if packet["type"] == "chunk": yield packet
                        if packet["type"] == "result":
                            img_desc = packet["data"]
                    
                    if img_desc and len(img_desc) > config.RESEARCH_VISION_MIN_RESPONSE_LENGTH:
                        parsed = _extract_json_from_text(img_desc)
                        if parsed and isinstance(parsed, dict):
                            ai_caption = parsed.get("caption", "").strip() or 'Contextual search image'
                            ai_detail = parsed.get("detailed_description", "").strip() or img_desc.strip()
                        else:
                            ai_caption = 'Contextual search image'
                            ai_detail = img_desc.strip()
                        
                        triplet_block = (
                            f"\n\n### [IMAGE DETECTED]\n"
                            f"**Original Title**: Search Result Embedded Image\n"
                            f"**AI Generated Caption**: {ai_caption}\n"
                            f"**URL**: {img_url}\n"
                            f"**Vision Model Detailed Description**: {ai_detail}\n"
                        )
                        results.append((triplet_block, img_url, section_index))
                        current_success = True
                    break
                except Exception:
                    if attempt < config.RESEARCH_VISION_RETRIES - 1:
                        await asyncio.sleep(2 ** attempt)
            
            if current_success:
                success_count += 1
        except Exception:
            pass
    
    yield {"type": "result", "data": results}


def _preprocess_citations(text):
    """Expands ranges [1-3] and splits list-style citations [1, 2] into individual markers."""
    # Clean up weird AI markdown formats for citations
    # Strip markdown link syntax: [1](#1) -> [1]
    text = re.sub(r'\[(\d+)\]\([^)]+\)', r'[\1]', text)
    
    # Handle list-style [1, 2] -> [1] [2] with whitespace tolerance
    def split_commas(match):
        nums = [n.strip() for n in match.group(1).split(',')]
        return ' '.join(f'[{n}]' for n in nums if n.isdigit())
    text = re.sub(r'\[\s*(\d+(?:\s*,\s*\d+)+)\s*\]', split_commas, text)
    
    # Handle range-style [1-3] -> [1] [2] [3] with whitespace tolerance
    def split_ranges(match):
        start = int(match.group(1))
        end = int(match.group(2))
        if start < end and end - start <= 20: 
            return ' '.join(f'[{i}]' for i in range(start, end + 1))
        return match.group(0)
    text = re.sub(r'\[\s*(\d+)\s*-\s*(\d+)\s*\]', split_ranges, text)
    
    # Strip nested brackets: [[1]] -> [1]
    # Fixed the double backslash bug from original implementation
    text = re.sub(r'\[\s*(\[\d+\](?:[^\[\]]*\[\d+\])*)\s*\]', r'\1', text)
    
    return text


def _normalize_citations(report_text, source_registry):
    """Re-number all [N] citations sequentially from [1] and build a references list.
    Uses a two-phase placeholder approach to avoid collision between old and new IDs."""
    
    report_text = _preprocess_citations(report_text)
    
    # Find all unique citation IDs present in text (with whitespace tolerance)
    all_matches = set(int(m) for m in re.findall(r'\[\s*(\d+)\s*\]', report_text))
    valid_ids = sorted(sid for sid in all_matches if sid in source_registry)

    if not valid_ids:
        return report_text, []

    remap = {old: idx + 1 for idx, old in enumerate(valid_ids)}

    # Phase 1: valid citations -> placeholders (handling optional spaces)
    def to_placeholder(match):
        old_id = int(match.group(1))
        if old_id in remap:
            return f'[__REF_{remap[old_id]}__]'
        return "" # Strip invalid ones during normalization as a safety net

    temp = re.sub(r'\[\s*(\d+)\s*\]', to_placeholder, report_text)

    # Phase 2: placeholders -> final sequential numbers
    def from_placeholder(match):
        return f'[{match.group(1)}]'

    normalized = re.sub(r'\[__REF_(\d+)__\]', from_placeholder, temp)

    # Build references
    references = []
    for old_id in valid_ids:
        new_id = remap[old_id]
        url = source_registry[old_id].get('url', 'Unknown Source')
        title = source_registry[old_id].get('title')
        if title:
            references.append(f"{new_id}. [{title}]({url})")
        else:
            references.append(f"{new_id}. [{url}]({url})")

    return normalized, references

def _strip_report_images(report_text):
    """Remove ALL ![alt](url) image embeds from the report."""
    return re.sub(r'!\[([^\]]*)\]\((https?://[^\)]+)\)', '', report_text).strip()

def _strip_invalid_citations(report_text, valid_source_ids):
    """Mechanically remove any [N] citation where N is not in the source registry.
    Improved to handle whitespace and prevent orphaned punctuation."""
    report_text = _preprocess_citations(report_text)

    def check_citation(match):
        # match.group(1) is the leading whitespace
        # match.group(2) is the ID
        source_id = int(match.group(2))
        if source_id in valid_source_ids:
            return match.group(0) # Keep valid citation with its original whitespace
        return '' # Strip both citation and its leading whitespace

    # Apply the callback to all citation patterns
    report_text = re.sub(r'(\s?)\[(\d+)\]', check_citation, report_text)
    # Clean up orphaned double-spaces
    report_text = re.sub(r'  +', ' ', report_text)
    return report_text.strip()
# --- Plan Formatting ---

def _format_plan_as_markdown(plan_json: dict) -> str:
    """
    Converts the structured research plan JSON into a beautiful Markdown document.
    Suitable for display in a side-panel file_system.
    """
    if not plan_json:
        return ""
    
    title = plan_json.get("title", "Research Plan")
    summary = plan_json.get("summary", "")
    sections = plan_json.get("sections", [])
    
    md = f"# {title}\n\n"
    if summary:
        md += f"> {summary}\n\n"
    
    md += "## Proposed Report Structure\n\n"
    for i, section in enumerate(sections, 1):
        sect_heading = section.get("heading", f"Section {i}")
        sect_desc = section.get("description", "")
        queries = section.get("queries", [])
        
        md += f"### {i}. {sect_heading}\n"
        if sect_desc:
            md += f"**Objective**: {sect_desc}\n\n"
        
        if queries:
            md += "**Target Research Queries**:\n"
            for q in queries:
                if isinstance(q, dict):
                    q_text = q.get("query", "")
                    attrs = []
                    for k, v in q.items():
                        if k != "query":
                            attrs.append(f"{k}:{v}")
                    if attrs:
                        md += f"- {q_text} ({', '.join(attrs)})\n"
                    else:
                        md += f"- {q_text}\n"
                else:
                    md += f"- {q}\n"
            md += "\n"
            
    md += "---\n"
    md += "*This plan was generated by the Research Agent. Please approve or suggest modifications.*"
    return md

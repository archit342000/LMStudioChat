"""Token counting module using HuggingFace transformers tokenizer.

This module provides accurate token counting for embedding models using the
actual tokenizer from HuggingFace. It loads the HuggingFace token from
secrets/HF_TOKEN (with fallback to HF_TOKEN environment variable).
"""
import os
from transformers import AutoTokenizer
import logging

# Suppress noisy sequence length warnings from transformers tokenizer
# since we handle explicit truncation/chunking in our own pipeline.
import transformers
transformers.logging.set_verbosity_error()

# HuggingFace token loading
def _get_hf_token():
    """Load HuggingFace token from secrets or environment variable.

    Returns:
        str or None: The HuggingFace token if available, None otherwise.
    """
    # Try to load from secrets first
    try:
        with open("/run/secrets/HF_TOKEN", "r") as f:
            return f.read().strip()
    except (IOError, FileNotFoundError):
        pass

    # Fallback to environment variable
    return os.environ.get("HF_TOKEN", None)


# Global tokenizer instance
_tokenizer = None


def get_tokenizer():
    """Get the embedding model tokenizer, loading it lazily.

    The tokenizer is loaded from the 'embedding_tokenizer' model ID in
    the centralized model config. HuggingFace token is used for authenticated models.

    Returns:
        AutoTokenizer: The transformers tokenizer instance.
    """
    global _tokenizer

    if _tokenizer is not None:
        return _tokenizer

    from backend.models import load_model_config
    model_config = load_model_config()

    tokenizer_name = model_config.get("embedding_tokenizer")
    if not tokenizer_name:
        raise ValueError("model config missing 'embedding_tokenizer' field")

    # Get HuggingFace token for authenticated models
    hf_token = _get_hf_token()

    # Load the tokenizer
    _tokenizer = AutoTokenizer.from_pretrained(
        tokenizer_name,
        token=hf_token if hf_token else None
    )

    return _tokenizer


def count_tokens(text: str) -> int:
    """Count tokens in text using the embedding model's tokenizer.

    Args:
        text: The text to count tokens for.

    Returns:
        int: The number of tokens in the text.
    """
    tokenizer = get_tokenizer()
    return len(tokenizer.encode(text, add_special_tokens=False))


def truncate_text_by_tokens(text: str, max_tokens: int, model_max_tokens: int = None) -> str:
    """Truncate text to fit within token limit.

    Args:
        text: The text to truncate.
        max_tokens: Maximum number of tokens allowed.
        model_max_tokens: Optional model's maximum context window. If provided,
            will use the smaller of max_tokens and model_max_tokens.

    Returns:
        The truncated text that fits within the token limit.
    """
    if not text:
        return text

    # Use the smaller of max_tokens and model_max_tokens if provided
    token_limit = max_tokens
    if model_max_tokens is not None:
        token_limit = min(max_tokens, model_max_tokens)

    # Always use accurate token counting via tokenizer

    # Get tokenizer to encode/decode
    tokenizer = get_tokenizer()
    encoded = tokenizer.encode(text, add_special_tokens=False)

    if len(encoded) <= token_limit:
        return text

    # Truncate to max_tokens and decode
    truncated = encoded[:token_limit]
    return tokenizer.decode(truncated, skip_special_tokens=True)


def split_text_by_tokens(text: str, max_tokens: int) -> list:
    """Split text into a list of chunks, ensuring each is within max_tokens.

    This is a 'Hard Split' of last resort. It does not respect structure
    (paragraphs/sentences) but guarantees 100% compliance with token limits
    without data loss (no truncation).

    Args:
        text: The text to split.
        max_tokens: Maximum tokens per chunk.

    Returns:
        List[str]: Chunks that are each <= max_tokens.
    """
    if not text:
        return []

    tokenizer = get_tokenizer()
    encoded = tokenizer.encode(text, add_special_tokens=False)

    if len(encoded) <= max_tokens:
        return [text]

    chunks = []
    for i in range(0, len(encoded), max_tokens):
        chunk_ids = encoded[i:i + max_tokens]
        chunks.append(tokenizer.decode(chunk_ids, skip_special_tokens=True))

    return chunks


_model_tokenizers = {}


def get_tokenizer_for_model(model_name: str) -> AutoTokenizer:
    """Get the tokenizer for a specific LLM, loading it lazily and caching it.

    Args:
        model_name: The exact model name string.

    Returns:
        AutoTokenizer: The transformers tokenizer instance.
    """
    global _model_tokenizers
    if model_name in _model_tokenizers:
        return _model_tokenizers[model_name]

    from backend.models.loader import get_model_metadata
    metadata = get_model_metadata(model_name)
    tokenizer_name = metadata["tokenizer"]

    hf_token = _get_hf_token()
    tokenizer = AutoTokenizer.from_pretrained(
        tokenizer_name,
        token=hf_token if hf_token else None
    )
    _model_tokenizers[model_name] = tokenizer
    return tokenizer


def count_chat_tokens(messages: list, model_name: str) -> int:
    """Count tokens in a list of chat messages using the model's tokenizer.

    Args:
        messages: A list of message dictionaries (e.g., {"role": ..., "content": ...}).
        model_name: The name of the model.

    Returns:
        int: The total number of tokens.
    """
    tokenizer = get_tokenizer_for_model(model_name)
    
    cleaned_messages = []
    num_images = 0
    
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        
        text_parts = []
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict):
                    if part.get("type") == "text":
                        text_parts.append(part.get("text", ""))
                    elif part.get("type") == "image_url":
                        num_images += 1
                elif isinstance(part, str):
                    text_parts.append(part)
            cleaned_content = "\n".join(text_parts)
        else:
            cleaned_content = str(content or "")
            
        cleaned_messages.append({"role": role, "content": cleaned_content})
        
    # Calculate text tokens
    try:
        tokens = tokenizer.apply_chat_template(cleaned_messages, tokenize=True, add_generation_prompt=False)
        text_tokens = len(tokens)
    except Exception:
        # Fallback to simple ChatML formatting approximation if template fails
        approx_text = ""
        for msg in cleaned_messages:
            approx_text += f"<|im_start|>{msg['role']}\n{msg['content']}<|im_end|>\n"
        text_tokens = len(tokenizer.encode(approx_text, add_special_tokens=False))
        
    return text_tokens + (num_images * 1000)


from .base import StreamInterceptor, BaseParser
from .models import StandardParser, GemmaParser, PassThroughParser

def get_parser_for_model(model_name: str) -> BaseParser:
    """
    Returns the appropriate parser for the given model.
    """
    model_lower = model_name.lower()
    
    # Gemma models
    if "gemma" in model_lower:
        return GemmaParser()
        
    # Coder models that don't do reasoning
    if "coder" in model_lower:
        return PassThroughParser()
        
    # Default to standard `<think>` tags for Qwen, Nemotron, DeepSeek, etc.
    return StandardParser()

__all__ = ["StreamInterceptor", "get_parser_for_model", "BaseParser"]

from .base import BaseParser

class StandardParser(BaseParser):
    """Used for Qwen and Nemotron models."""
    start_tags = ("<think>\n", "<think>")
    end_tags = ("</think>\n", "</think>")

class GemmaParser(BaseParser):
    """Used for Google Gemma 4 models."""
    start_tags = ("<|channel>thought\n", "<|channel>thought", "<think>\n", "<think>")
    end_tags = ("<channel|>\n", "<channel|>", "</think>\n", "</think>")

class PassThroughParser(BaseParser):
    """Used for models like Qwen Coder that do not emit reasoning tags."""
    start_tags = ()
    end_tags = ()

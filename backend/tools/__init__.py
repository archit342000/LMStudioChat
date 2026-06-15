import json
import os
import importlib
from typing import Dict, Any, Optional, Callable

class ToolRegistry:
    """
    Central registry for all tools and sub-agents.
    Loads from registry.json and provides lookup capabilities.
    """
    _registry: Dict[str, Any] = {}
    _loaded: bool = False

    @classmethod
    def _load(cls):
        if cls._loaded:
            return
        
        registry_path = os.path.join(os.path.dirname(__file__), "registry.json")
        try:
            with open(registry_path, 'r') as f:
                cls._registry = json.load(f)
            cls._loaded = True
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to load tool registry: {e}")

    @classmethod
    def get_tool(cls, name: str) -> Optional[Dict[str, Any]]:
        cls._load()
        return cls._registry.get(name)

    @classmethod
    def is_agent(cls, name: str) -> bool:
        tool = cls.get_tool(name)
        return bool(tool and tool.get('type') == 'agent')

    @classmethod
    def get_implementation(cls, name: str) -> Optional[str]:
        tool = cls.get_tool(name)
        return tool.get('implementation') if tool else None

    @classmethod
    def resolve_implementation(cls, name: str) -> Optional[Callable]:
        impl_path = cls.get_implementation(name)
        if not impl_path:
            return None
        
        try:
            module_path, attr_name = impl_path.rsplit('.', 1)
            module = importlib.import_module(module_path)
            return getattr(module, attr_name)
        except (ImportError, AttributeError) as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to resolve implementation for {name}: {e}")
            return None

from .definitions import *

__all__ = [
    "ToolRegistry",
    "ADD_USER_PREFERENCE_TOOL",
    "EDIT_USER_PREFERENCE_TOOL",
    "DELETE_USER_PREFERENCE_TOOL",

    "VISIT_PAGE_TOOL",
    "GET_TIME_TOOL",
    "VALIDATE_OUTPUT_FORMAT_TOOL",
    "CREATE_FS_FILE_TOOL",
    "CREATE_DIRECTORY_TOOL",
    "DELETE_DIRECTORY_TOOL",
    "LS_FILES_TOOL",
    "GREP_FILES_TOOL",
    "READ_FS_FILE_TOOL",
    "REPLACE_FS_TEXT_TOOL",
    "REPLACE_FS_LINES_TOOL",
    "MOVE_FS_FILE_TOOL",
    "DELETE_FS_FILE_TOOL",
    "REQUEST_CLARIFICATION_TOOL",
    "RESEARCH_TOOL",
    "FILE_SYSTEM_AGENT_TOOL",
    "SEARCH_WEB_TOOL",
    "FILE_SYSTEM_SEARCH_WEB_TOOL",
    "BROWSING_AGENT_TOOL",
    "BROWSING_AGENT_TOOLS_BASE",
    "BROWSING_AGENT_TOOLS_VISION",
    "FILE_SYSTEM_INTERNAL_TOOLS",
    "MAIN_ASSISTANT_TOOLS"
]

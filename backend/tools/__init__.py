import importlib
import logging
from typing import Dict, Any, Optional, Callable, List

from backend.tools.spec import ToolSpec, ToolType, ToolScope

logger = logging.getLogger(__name__)

class ToolRegistry:
    """
    Central registry for all tools and sub-agents.
    Aggregates specifications from backend.tools.catalog.
    """
    _specs_list: List[ToolSpec] = []
    _specs_dict: Dict[str, ToolSpec] = {}
    _registry: Dict[str, Any] = {}
    _loaded: bool = False

    @classmethod
    def _load(cls):
        if cls._loaded:
            return
        from backend.tools.catalog import ALL_TOOL_SPECS
        cls._specs_list = ALL_TOOL_SPECS
        cls._specs_dict = {}
        cls._registry = {}
        for spec in ALL_TOOL_SPECS:
            if spec.name not in cls._specs_dict:
                cls._specs_dict[spec.name] = spec
                cls._registry[spec.name] = spec.to_registry_entry()
        cls._loaded = True

    @classmethod
    def get_tool(cls, name: str) -> Optional[Dict[str, Any]]:
        """Backwards-compatible: returns registry-format dict."""
        cls._load()
        spec = cls._specs_dict.get(name)
        return spec.to_registry_entry() if spec else None

    @classmethod
    def get_spec(cls, name: str) -> Optional[ToolSpec]:
        cls._load()
        return cls._specs_dict.get(name)

    @classmethod
    def is_agent(cls, name: str) -> bool:
        cls._load()
        spec = cls.get_spec(name)
        return bool(spec and spec.tool_type == ToolType.AGENT)

    @classmethod
    def get_implementation(cls, name: str) -> Optional[str]:
        cls._load()
        spec = cls.get_spec(name)
        return spec.implementation if spec else None

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
            logger.error(f"Failed to resolve implementation for {name}: {e}")
            return None

    @classmethod
    def get_tools_for_scope(cls, scope: ToolScope) -> List[Dict]:
        """Get OpenAI-schema tool dicts for a specific agent scope."""
        cls._load()
        return [s.to_openai_schema() for s in cls._specs_list if scope in s.scopes]

    @classmethod
    def get_directives_for_scope(cls, scope: ToolScope) -> str:
        """Compose all tool usage directives for a scope."""
        cls._load()
        return "\n\n".join(
            s.directives.strip() for s in cls._specs_list
            if scope in s.scopes and s.directives.strip()
        )

    @classmethod
    def get_main_tools(cls, active_modes: Dict[str, bool]) -> List[Dict]:
        """
        Get the complete tool list for the main assistant.
        Handles mode-gated tools.
        """
        cls._load()
        tools = []
        for spec in cls._specs_list:
            if ToolScope.MAIN not in spec.scopes:
                continue
            if spec.requires_mode:
                if not active_modes.get(spec.requires_mode):
                    continue
            tools.append(spec.to_openai_schema())
        return tools

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

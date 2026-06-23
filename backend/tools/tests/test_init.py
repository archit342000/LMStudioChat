# backend/tools/tests/test_init.py
import pytest
from unittest.mock import patch
from backend.tools import ToolRegistry
from backend.tools.spec import ToolScope, ToolSpec, ToolType

def test_tool_registry_load():
    ToolRegistry._loaded = False
    ToolRegistry._load()
    assert ToolRegistry._loaded is True
    assert len(ToolRegistry._specs_list) > 0
    assert "get_time" in ToolRegistry._specs_dict

def test_tool_registry_get_tool():
    tool = ToolRegistry.get_tool("get_time")
    assert tool is not None
    assert tool["type"] == "pure"
    assert tool["implementation"] == "backend.tools.time_utils.get_current_time"

def test_tool_registry_get_implementation():
    impl = ToolRegistry.get_implementation("get_time")
    assert impl == "backend.tools.time_utils.get_current_time"

def test_tool_registry_resolve_implementation():
    func = ToolRegistry.resolve_implementation("get_time")
    assert callable(func)
    assert func.__name__ == "get_current_time"

def test_tool_registry_is_agent():
    assert ToolRegistry.is_agent("visit_page_tool") is True
    assert ToolRegistry.is_agent("get_time") is False

def test_tool_registry_get_tools_for_scope():
    tools = ToolRegistry.get_tools_for_scope(ToolScope.MAIN)
    names = [t["function"]["name"] for t in tools]
    assert "get_time" in names
    assert "research" in names

def test_tool_registry_get_directives_for_scope():
    # 1. No active_modes passed (all tool directives included)
    directives_all = ToolRegistry.get_directives_for_scope(ToolScope.MAIN)
    assert "Temporal Awareness" in directives_all
    assert "Skills Store Tool Rules" in directives_all
    assert "Code Execution Tool Guidelines" in directives_all

    # 2. Specific active_modes (filtering out code execution)
    directives_filtered = ToolRegistry.get_directives_for_scope(ToolScope.MAIN, {"code_execution_mode": False})
    assert "Temporal Awareness" in directives_filtered
    assert "Skills Store Tool Rules" in directives_filtered
    assert "Code Execution Tool Guidelines" not in directives_filtered

def test_tool_registry_get_main_tools():
    # Test with research_mode active
    tools = ToolRegistry.get_main_tools({"research_mode": True})
    names = [t["function"]["name"] for t in tools]
    assert "research" in names

    # Test with research_mode inactive
    tools_no_research = ToolRegistry.get_main_tools({"research_mode": False})
    names_no_research = [t["function"]["name"] for t in tools_no_research]
    assert "research" not in names_no_research

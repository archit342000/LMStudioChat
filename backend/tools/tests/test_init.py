import pytest
import os
from unittest.mock import patch, mock_open
from backend.tools import ToolRegistry

def test_tool_registry_load():
    # Mock registry.json
    mock_data = '{"test_tool": {"type": "pure", "implementation": "module.func"}}'
    with patch("builtins.open", mock_open(read_data=mock_data)):
        ToolRegistry._loaded = False # Force reload
        tool = ToolRegistry.get_tool("test_tool")
        assert tool["type"] == "pure"
        assert tool["implementation"] == "module.func"

def test_tool_registry_get_implementation():
    with patch.dict(ToolRegistry._registry, {"t1": {"implementation": "backend.tools.time_utils.get_current_time"}}):
        impl = ToolRegistry.get_implementation("t1")
        assert impl == "backend.tools.time_utils.get_current_time"

def test_tool_registry_resolve_implementation():
    with patch.dict(ToolRegistry._registry, {"t1": {"implementation": "backend.tools.time_utils.get_current_time"}}):
        func = ToolRegistry.resolve_implementation("t1")
        assert callable(func)
        assert func.__name__ == "get_current_time"

def test_tool_registry_is_agent():
    with patch.dict(ToolRegistry._registry, {
        "a1": {"type": "agent"},
        "p1": {"type": "pure"}
    }):
        assert ToolRegistry.is_agent("a1") is True
        assert ToolRegistry.is_agent("p1") is False

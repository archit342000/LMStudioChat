import pytest
from backend.tools.definitions import (
    MAIN_ASSISTANT_TOOLS, 
    RESEARCH_TOOL, 
    VISIT_PAGE_TOOL,
    FILE_SYSTEM_INTERNAL_TOOLS
)

def test_definitions_exist():
    assert isinstance(MAIN_ASSISTANT_TOOLS, list)
    assert len(MAIN_ASSISTANT_TOOLS) > 0
    
    # Check for specific tool structure
    assert "type" in RESEARCH_TOOL
    assert RESEARCH_TOOL["type"] == "function"
    assert "name" in RESEARCH_TOOL["function"]
    assert RESEARCH_TOOL["function"]["name"] == "research"

def test_tool_presence_in_main():
    tool_names = [t["function"]["name"] for t in MAIN_ASSISTANT_TOOLS]
    assert "research" in tool_names
    assert "search_web" in tool_names
    assert "visit_page_tool" in tool_names
    assert "file_system_agent" in tool_names

def test_fs_internal_tools():
    tool_names = [t["function"]["name"] for t in FILE_SYSTEM_INTERNAL_TOOLS]
    assert "create_fs_file" in tool_names
    assert "read_fs_file" in tool_names
    assert "replace_fs_text" in tool_names

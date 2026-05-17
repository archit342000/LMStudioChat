import pytest
from backend.tools.prompts import (
    USER_PREFERENCES_DIRECTIVES,
    RESEARCH_MODE_DIRECTIVES,
    SEARCH_AGENT_DIRECTIVES,
    VISIT_PAGE_DIRECTIVES,
    FILE_AGENT_TOOL_DIRECTIVES,
    MAIN_AI_TASK_DIRECTIVES
)

def test_prompts_content():
    assert "User Preferences" in USER_PREFERENCES_DIRECTIVES
    assert "Research Agent Mode" in RESEARCH_MODE_DIRECTIVES
    assert "Web Search Tool Rules" in SEARCH_AGENT_DIRECTIVES
    assert "Web Page Reading Tool Rules" in VISIT_PAGE_DIRECTIVES
    assert "File Agent Document Analysis Rules" in FILE_AGENT_TOOL_DIRECTIVES
    assert "Task List & State Tracking" in MAIN_AI_TASK_DIRECTIVES

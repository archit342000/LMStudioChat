import pytest
from backend.tools.prompts import (
    USER_PREFERENCES_DIRECTIVES,
    RESEARCH_MODE_DIRECTIVES,
    SEARCH_AGENT_DIRECTIVES,
    VISIT_PAGE_DIRECTIVES,
    DOCUMENT_AGENT_TOOL_DIRECTIVES,
    MAIN_AI_TASK_DIRECTIVES,
    FILE_SYSTEM_TOOL_DIRECTIVES,
    GET_SKILL_DETAILS_DIRECTIVES
)

def test_prompts_content():
    assert "User Preferences" in USER_PREFERENCES_DIRECTIVES
    assert "Research Agent Mode" in RESEARCH_MODE_DIRECTIVES
    assert "Web Search Tool Rules" in SEARCH_AGENT_DIRECTIVES
    assert "Web Page Reading Tool Rules" in VISIT_PAGE_DIRECTIVES
    assert "Document Agent Document Analysis Rules" in DOCUMENT_AGENT_TOOL_DIRECTIVES
    assert "Task List & State Tracking" in MAIN_AI_TASK_DIRECTIVES
    assert "Line Numbers (CRITICAL)" in FILE_SYSTEM_TOOL_DIRECTIVES
    assert "Skills Store Tool Rules" in GET_SKILL_DETAILS_DIRECTIVES


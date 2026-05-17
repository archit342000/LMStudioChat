import pytest
from backend.tools.agents.browsing_agent.prompts import (
    BROWSING_AGENT_SYSTEM_PROMPT_TEXT,
    BROWSING_AGENT_SYSTEM_PROMPT_VISION
)

def test_browsing_agent_prompts():
    """Tests that the browsing agent prompts are correctly assembled."""
    # Test Text Prompt
    assert "Browsing Agent" in BROWSING_AGENT_SYSTEM_PROMPT_TEXT
    assert "Vision Mode: DISABLED" in BROWSING_AGENT_SYSTEM_PROMPT_TEXT
    assert "Phase 1: Navigation" in BROWSING_AGENT_SYSTEM_PROMPT_TEXT
    assert "Task List" in BROWSING_AGENT_SYSTEM_PROMPT_TEXT
    
    # Test Vision Prompt
    assert "Browsing Agent" in BROWSING_AGENT_SYSTEM_PROMPT_VISION
    assert "Vision Mode: ENABLED" in BROWSING_AGENT_SYSTEM_PROMPT_VISION
    assert "browser_screenshot" in BROWSING_AGENT_SYSTEM_PROMPT_VISION
    assert "Task List" in BROWSING_AGENT_SYSTEM_PROMPT_VISION

def test_browsing_agent_prompt_differences():
    """Ensures the text and vision prompts are actually different."""
    assert BROWSING_AGENT_SYSTEM_PROMPT_TEXT != BROWSING_AGENT_SYSTEM_PROMPT_VISION
    assert "DISABLED" in BROWSING_AGENT_SYSTEM_PROMPT_TEXT
    assert "ENABLED" in BROWSING_AGENT_SYSTEM_PROMPT_VISION

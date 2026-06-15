import pytest
from backend.tools.agents.browsing_agent.prompts import (
    BROWSING_AGENT_SYSTEM_PROMPT_TEXT,
    BROWSING_AGENT_SYSTEM_PROMPT_VISION
)

def test_browsing_agent_prompts():
    """Tests that the browsing agent prompts are correctly assembled."""
    # Test Text Prompt
    text_prompt = BROWSING_AGENT_SYSTEM_PROMPT_TEXT.format()
    assert "Browsing Agent" in text_prompt
    assert "Vision Mode: DISABLED" in text_prompt
    assert "Phase 1: Navigation" in text_prompt
    assert "Task List" in text_prompt
    
    # Test Vision Prompt
    vision_prompt = BROWSING_AGENT_SYSTEM_PROMPT_VISION.format()
    assert "Browsing Agent" in vision_prompt
    assert "Vision Mode: ENABLED" in vision_prompt
    assert "browser_screenshot" in vision_prompt
    assert "Task List" in vision_prompt

def test_browsing_agent_prompt_differences():
    """Ensures the text and vision prompts are actually different."""
    assert BROWSING_AGENT_SYSTEM_PROMPT_TEXT != BROWSING_AGENT_SYSTEM_PROMPT_VISION
    assert "DISABLED" in BROWSING_AGENT_SYSTEM_PROMPT_TEXT.format()
    assert "ENABLED" in BROWSING_AGENT_SYSTEM_PROMPT_VISION.format()

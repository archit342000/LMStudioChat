import pytest
from backend.prompts import BASE_SYSTEM_PROMPT, RESEARCH_MODE_SYSTEM_PROMPT

def test_prompts_composed():
    assert "Identity and Role" in BASE_SYSTEM_PROMPT
    assert "Multi-agent Architecture" in BASE_SYSTEM_PROMPT
    assert "Chain-of-Thought" in BASE_SYSTEM_PROMPT
    
    # Research mode should have the research directives
    assert "Research Agent Mode: ACTIVE" in RESEARCH_MODE_SYSTEM_PROMPT

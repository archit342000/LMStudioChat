import pytest
from backend.tools.agents.file_agent.prompts import FILE_AGENT_SYSTEM_PROMPT

def test_file_agent_system_prompt():
    """Tests that the system prompt is correctly assembled and contains key instructions."""
    assert isinstance(FILE_AGENT_SYSTEM_PROMPT, str)
    assert len(FILE_AGENT_SYSTEM_PROMPT) > 100
    assert "File Analysis Agent" in FILE_AGENT_SYSTEM_PROMPT
    assert "autonomous" in FILE_AGENT_SYSTEM_PROMPT.lower()
    assert "investigating" in FILE_AGENT_SYSTEM_PROMPT.lower()
    # Check if key sections are included
    assert "Task List" in FILE_AGENT_SYSTEM_PROMPT
    assert "Rules" in FILE_AGENT_SYSTEM_PROMPT

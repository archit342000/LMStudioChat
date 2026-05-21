import pytest
from backend.tools.agents.document_agent.prompts import DOCUMENT_AGENT_SYSTEM_PROMPT

def test_document_agent_system_prompt():
    """Tests that the system prompt is correctly assembled and contains key instructions."""
    assert isinstance(DOCUMENT_AGENT_SYSTEM_PROMPT, str)
    assert len(DOCUMENT_AGENT_SYSTEM_PROMPT) > 100
    assert "Document Analysis Agent" in DOCUMENT_AGENT_SYSTEM_PROMPT
    assert "autonomous" in DOCUMENT_AGENT_SYSTEM_PROMPT.lower()
    assert "investigating" in DOCUMENT_AGENT_SYSTEM_PROMPT.lower()
    # Check if key sections are included
    assert "Task List" in DOCUMENT_AGENT_SYSTEM_PROMPT
    assert "Rules" in DOCUMENT_AGENT_SYSTEM_PROMPT

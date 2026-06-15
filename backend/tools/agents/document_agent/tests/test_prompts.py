from backend.prompts import PromptWrapper
from backend.tools.agents.document_agent.prompts import DOCUMENT_AGENT_SYSTEM_PROMPT

def test_document_agent_system_prompt():
    """Tests that the system prompt is correctly assembled and contains key instructions."""
    assert isinstance(DOCUMENT_AGENT_SYSTEM_PROMPT, PromptWrapper)
    prompt_str = DOCUMENT_AGENT_SYSTEM_PROMPT.format()
    assert isinstance(prompt_str, str)
    assert len(prompt_str) > 100
    assert "Document Analysis Agent" in prompt_str
    assert "autonomous" in prompt_str.lower()
    assert "investigating" in prompt_str.lower()
    # Check if key sections are included
    assert "Task List" in prompt_str
    assert "Rules" in prompt_str

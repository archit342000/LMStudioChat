from backend.tools.agents.search_web_agent.prompts import SEARCH_AGENT_SYSTEM_PROMPT


def test_search_agent_system_prompt_exists():
    """Verify the system prompt is a non-empty string."""
    assert isinstance(SEARCH_AGENT_SYSTEM_PROMPT, str)
    assert len(SEARCH_AGENT_SYSTEM_PROMPT.strip()) > 0


def test_search_agent_system_prompt_contains_key_directives():
    """Verify the prompt contains the critical behavioral rules."""
    assert "Context" in SEARCH_AGENT_SYSTEM_PROMPT
    assert "No Hallucination" in SEARCH_AGENT_SYSTEM_PROMPT
    assert "Cite Sources" in SEARCH_AGENT_SYSTEM_PROMPT
    assert "search results" in SEARCH_AGENT_SYSTEM_PROMPT.lower()


def test_search_agent_system_prompt_forbids_tools():
    """The prompt must explicitly tell the agent it cannot perform searches."""
    assert "No Tools" in SEARCH_AGENT_SYSTEM_PROMPT or "cannot perform additional searches" in SEARCH_AGENT_SYSTEM_PROMPT

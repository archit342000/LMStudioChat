from backend.tools.agents.visit_page_agent.prompts import VISIT_PAGE_SYSTEM_PROMPT


def test_visit_page_system_prompt_exists():
    """Verify the system prompt is a non-empty string."""
    assert isinstance(VISIT_PAGE_SYSTEM_PROMPT, str)
    assert len(VISIT_PAGE_SYSTEM_PROMPT.strip()) > 0


def test_visit_page_system_prompt_contains_key_directives():
    """Verify the prompt contains the critical behavioral rules."""
    assert "precision reading" in VISIT_PAGE_SYSTEM_PROMPT.lower()
    assert "Do not use prior knowledge" in VISIT_PAGE_SYSTEM_PROMPT or "SOLELY" in VISIT_PAGE_SYSTEM_PROMPT
    assert "hallucinate" in VISIT_PAGE_SYSTEM_PROMPT.lower()


def test_visit_page_system_prompt_conciseness_directive():
    """The prompt must instruct the agent to be concise and direct."""
    assert "concise" in VISIT_PAGE_SYSTEM_PROMPT.lower()

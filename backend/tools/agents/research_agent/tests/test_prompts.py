import pytest
from backend.tools.agents.research_agent.prompts import (
    PLANNER_SYSTEM_PROMPT,
    SCOUT_SYSTEM_PROMPT,
    RESEARCH_EXECUTOR_SYSTEM_PROMPT,
    RESEARCH_REFLECTION_PROMPT,
    RESEARCH_TRIAGE_PROMPT
)

def test_research_prompts_assembly():
    """Checks that key prompts are available and correctly formatted."""
    assert "plan" in PLANNER_SYSTEM_PROMPT.lower()
    assert "scout" in SCOUT_SYSTEM_PROMPT.lower()
    assert "executor" in RESEARCH_EXECUTOR_SYSTEM_PROMPT.lower()
    
    # Test formatting of dynamic prompts
    reflection = RESEARCH_REFLECTION_PROMPT.format(
        today_date="2024",
        original_topic="X",
        section_heading="H",
        section_description="D",
        section_queries="Q",
        section_number=1,
        total_sections=5,
        remaining_sections=4,
        full_plan="{}",
        accumulated_summaries="S",
        max_gaps=3
    )
    assert "2024" in reflection
    assert "{original_topic}" not in reflection
    
    # RESEARCH_TRIAGE_PROMPT keys: section_heading, accumulated_summaries
    triage = RESEARCH_TRIAGE_PROMPT.format(
        section_heading="H",
        accumulated_summaries="S"
    )
    assert "Section Heading" in triage
    assert "H" in triage

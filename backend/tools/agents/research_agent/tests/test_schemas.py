import pytest
from jsonschema import validate
from backend.tools.agents.research_agent.schemas import (
    SCOUT_JSON_SCHEMA,
    PLAN_GENERATOR_JSON_SCHEMA,
    REFLECTION_JSON_SCHEMA,
    TRIAGE_JSON_SCHEMA,
    WRITER_JSON_SCHEMA,
    SUMMARY_JSON_SCHEMA
)

def test_scout_schema_validation():
    data = {
        "topic_type": "news",
        "structural_recommendation": "narrative",
        "time_sensitive": True,
        "confidence": "high",
        "needs_search": False,
        "clarifying_question": None,
        "clarifying_options": None,
        "preliminary_search": None,
        "context_notes": "test"
    }
    validate(instance=data, schema=SCOUT_JSON_SCHEMA)

def test_plan_schema_validation():
    data = {
        "title": "Test Report",
        "sections": [
            {
                "heading": "Intro",
                "description": "Intro section",
                "queries": [{"query": "test query", "topic": "general", "time_range": "day"}]
            }
        ]
    }
    validate(instance=data, schema=PLAN_GENERATOR_JSON_SCHEMA)

def test_reflection_schema_validation():
    data = {
        "analysis": "good progress",
        "gaps": [{"description": "missing x", "query": "find x"}]
    }
    validate(instance=data, schema=REFLECTION_JSON_SCHEMA)

def test_triage_schema_validation():
    data = {
        "core_facts": [{"fact": "fact 1", "sources": [1, 2]}]
    }
    validate(instance=data, schema=TRIAGE_JSON_SCHEMA)

def test_writer_schema_validation():
    data = {"markdown_content": "# content"}
    validate(instance=data, schema=WRITER_JSON_SCHEMA)

def test_summary_schema_validation():
    data = {"summary_points": ["point 1", "point 2"]}
    validate(instance=data, schema=SUMMARY_JSON_SCHEMA)

# ---- PLANNER AGENT ----

SCOUT_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "topic_type": {"type": "string", "enum": ["news", "academic", "technical", "comparison", "financial", "general"]},
        "structural_recommendation": {"type": "string", "enum": ["narrative", "comparative_table", "timeline", "technical_spec", "faq", "pros_cons"]},
        "time_sensitive": {"type": "boolean"},
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
        "needs_search": {"type": "boolean"},
        "clarifying_question": {"type": ["string", "null"]},
        "clarifying_options": {"type": ["array", "null"], "items": {"type": "string"}},
        "preliminary_search": {
            "type": ["object", "null"],
            "properties": {
                "query": {"type": "string"},
                "topic": {"type": "string", "enum": ["general", "news", "finance"]},
                "time_range": {"type": ["string", "null"], "enum": ["day", "week", "month", "year", None]}
            },
            "required": ["query", "topic", "time_range"]
        },
        "context_notes": {"type": "string"}
    },
    "required": [
        "topic_type", "structural_recommendation", "time_sensitive", 
        "confidence", "needs_search", "clarifying_question", "clarifying_options",
        "preliminary_search", "context_notes"
    ],
    "additionalProperties": False
}

PLAN_GENERATOR_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "heading": {"type": "string"},
                    "description": {"type": "string"},
                    "queries": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "query": {"type": "string"},
                                "topic": {"type": "string", "enum": ["general", "news", "finance"]},
                                "time_range": {"type": ["string", "null"], "enum": ["day", "week", "month", "year", None]},
                                "start_date": {"type": ["string", "null"]},
                                "end_date": {"type": ["string", "null"]}
                            },
                            "required": ["query"]
                        }
                    }
                },
                "required": ["heading", "description", "queries"],
                "additionalProperties": False
            }
        }
    },
    "required": ["title", "sections"],
    "additionalProperties": False
}

# ---- REFLECTION AGENT ----

REFLECTION_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "analysis": {"type": "string"},
        "gaps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "query": {"type": "string"}
                },
                "required": ["description", "query"],
                "additionalProperties": False
            }
        }
    },
    "required": ["analysis", "gaps"],
    "additionalProperties": False
}

# --- TRIAGE AGENT ----

TRIAGE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "core_facts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "fact": {"type": "string"},
                    "sources": {"type": "array", "items": {"type": "integer"}}
                },
                "required": ["fact", "sources"],
                "additionalProperties": False
            }
        }
    },
    "required": ["core_facts"],
    "additionalProperties": False
}

# ---- WRITER AGENT ----

WRITER_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "markdown_content": {"type": "string"}
    },
    "required": ["markdown_content"],
    "additionalProperties": False
}

SUMMARY_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "summary_points": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["summary_points"],
    "additionalProperties": False
}



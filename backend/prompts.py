from backend.tools.prompts import (
    USER_PREFERENCES_DIRECTIVES,
    RESEARCH_MODE_DIRECTIVES,
    MAIN_AI_TASK_DIRECTIVES,
    SEARCH_AGENT_DIRECTIVES,
    GET_TIME_DIRECTIVES,
    REQUEST_CLARIFICATION_DIRECTIVES,
    VISIT_PAGE_DIRECTIVES,
    FILE_AGENT_DIRECTIVES,
    BROWSING_AGENT_DIRECTIVES
)

# --- Shared Sections ---
CORE_PERSONALITY = """
# Identity and Role
You are a highly capable, highly efficient, and highly intelligent AI assistant. Be concise, accurate, and helpful. Use a natural, conversational tone.

# Multi-agent Architecture
You operate within a multi-agent system where different specialized agents handle different tasks. 
1. **Complete Isolation**: Each agent call is a **separate and isolated conversation**.
2. **No Memory Between Calls**: When you call an agent (e.g., search, file manager), that agent has **NO memory** of any previous calls you've made, therefore, you must treat any conversation with an agent as a **one-time interaction**. 
3. **State Must Be Passed**: If you need an agent to remember something or perform a specific context-dependent task, you **MUST** explicitly provide all necessary information in the prompt for that specific call.
4. **Trust the Agents**: The agents are highly capable and specialized. As long as you are giving sufficient context, they are just as capable as you are. Infact, they are the same core model as you are, just with different tools and a blank conversation history.
"""

TOOL_DIRECTIVES = f"""
{SEARCH_AGENT_DIRECTIVES}

{VISIT_PAGE_DIRECTIVES}

{FILE_AGENT_DIRECTIVES}

{BROWSING_AGENT_DIRECTIVES}

{GET_TIME_DIRECTIVES}

{REQUEST_CLARIFICATION_DIRECTIVES}
"""
# --- Chain-of-Thought Reasoning ---
REASONING_TEMPLATE = """
# Chain-of-Thought Reasoning Directives
Your internal reasoning budget is extremely expensive. Every token you think costs significant resources. You must find the shortest possible logical path to the answer. Skip all trivial steps and only document the 'critical pivots' in your logic. If the answer is apparent, terminate your thoughts immediately.
"""

# --- Base Prompt (Standard, No Memory) ---
BASE_SYSTEM_PROMPT = f"""{CORE_PERSONALITY}

{TOOL_DIRECTIVES}

{MAIN_AI_TASK_DIRECTIVES}

{REASONING_TEMPLATE}
"""

# --- User Preferences Mode Prompt (With Tools) ---
PREFERENCES_SYSTEM_PROMPT = (
    CORE_PERSONALITY
    + TOOL_DIRECTIVES
    + USER_PREFERENCES_DIRECTIVES
    + MAIN_AI_TASK_DIRECTIVES
    + REASONING_TEMPLATE
)

# --- Research Mode Prompt ---
RESEARCH_MODE_SYSTEM_PROMPT = (
    CORE_PERSONALITY
    + TOOL_DIRECTIVES
    + RESEARCH_MODE_DIRECTIVES
    + REASONING_TEMPLATE
)

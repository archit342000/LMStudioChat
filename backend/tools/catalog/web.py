# backend/tools/catalog/web.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

VISIT_PAGE = ToolSpec(
    name="visit_page_tool",
    description="Visits a specific URL and optionally extracts information based on a query.",
    parameters={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The precise URL to visit."
            },
            "query": {
                "type": "string",
                "description": "Optional. A specific instruction (e.g., 'Summarize', 'Find the pricing') for the sub-agent to execute."
            },
            "detail_level": {
                "type": "string",
                "enum": ["basic", "standard", "deep"],
                "description": "Extraction depth: 'basic' (fast clean text), 'standard' (balanced, keeps tables/links), 'deep' (full render for complex dashboards)."
            }
        },
        "required": ["url"]
    },
    implementation="backend.tools.agents.visit_page_agent.agent.flow_fn",
    tool_type=ToolType.AGENT,
    scopes=(ToolScope.MAIN,),
)

SEARCH_WEB = ToolSpec(
    name="search_web",
    description="Executes a web search. Use this for general queries or news.",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query to execute."
            },
            "topic": {
                "type": "string",
                "enum": ["general", "news"],
                "description": "The category of the search."
            },
            "time_range": {
                "type": "string",
                "enum": ["day", "week", "month", "year", "d", "w", "m", "y"],
                "description": "The time range to filter results (e.g., 'day', 'week', 'month', 'year'). Use only when recent information is explicitly needed."
            },
            "depth": {
                "type": "string",
                "enum": ["normal", "deep"],
                "default": "normal",
                "description": "The search depth. 'normal' uses Tavily's native answer generation for speed. 'deep' retrieves full raw content for detailed analysis."
            },
            "context": {
                "type": "string",
                "description": "Context explaining why the search is being performed and what specific information is needed from the results."
            },
            "return_raw_results": {
                "type": "boolean",
                "description": "If true, skips synthesis and returns the raw search data. Use this only when deep, manual analysis of the sources is required."
            }
        },
        "required": ["query"]
    },
    implementation="backend.tools.agents.search_web_agent.agent.flow_fn",
    tool_type=ToolType.AGENT,
    scopes=(ToolScope.MAIN,),
)

BROWSING_AGENT = ToolSpec(
    name="browsing_agent",
    description="Delegates a complex web browsing task to an autonomous agent that can navigate pages, click elements, fill forms, scroll, and extract data across multiple steps. Use this when a task requires interactive browsing beyond a simple search or page visit.",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Self-contained description of the browsing task. The agent has no access to conversation history."
            },
            "success_criteria": {
                "type": "string",
                "description": "CRITICAL: Define the exact stopping condition or goal for the agent. This is used to evaluate when the task is complete."
            },
            "start_url": {
                "type": "string",
                "description": "Optional starting URL. If provided, the agent will be instructed to begin its task at this page."
            },
            "scope": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Optional domain whitelist (e.g., ['google.com']). If provided, the agent may only use browser_navigate to visit these domains directly. It is free to follow links (via browser_click) to external domains."
            }
        },
        "required": ["query", "success_criteria"]
    },
    implementation="backend.tools.agents.browsing_agent.agent.flow_fn",
    tool_type=ToolType.AGENT,
    scopes=(ToolScope.MAIN,),
    requires_mode="browsing_mode",
)

SPECS = [VISIT_PAGE, SEARCH_WEB, BROWSING_AGENT]

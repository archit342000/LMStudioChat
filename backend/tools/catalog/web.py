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
    directives="""\
## Web Page Reading Tool Rules
The `visit_page` tool allows you to read content from any public URL.

### Dual-Mode Execution
1. **Agent Mode (DEFAULT)**: If you need to summarize an article, translate a page, or find specific information (e.g., "Find the contact email", "Summarize this post"), you MUST provide that instruction in the `query` parameter. This delegates the reading to a sub-agent, preventing the massive page text from bloating your context window.
2. **Raw Mode (EXCEPTION)**: Leave the `query` parameter empty ONLY if the user explicitly asks to see the verbatim raw text, or if you must perform complex, multi-step code analysis on the exact raw markdown that a sub-agent could not handle.

### Best Practices
- Use `detail_level="basic"` for standard articles and blogs. Use `detail_level="deep"` ONLY for complex, dynamic, or data-heavy dashboards where "basic" misses content.
""",
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
    directives="""\
## Web Search Tool Rules
The `search_web` tool is a sub-agent designed to isolate verbose search results from your context window.

### When to use
Use `search_web` for factual lookups, current events, or documentation.

### How to use
1.  **Understand Synthesis vs. Non-Synthesis**:
    - **No Synthesis (`depth="normal"`)**: This is the default. It bypasses LLM synthesis and immediately returns Tavily's native answer or formatted snippets for speed and efficiency.
    - **Custom Synthesis (`depth="deep"`)**: Set `depth="deep"` and keep `return_raw_results=False` to trigger the Search Web Agent's custom LLM synthesis phase to answer your specific `context` query.
2.  **How to Request Verbatim Raw Results**:
    - If you need to perform deep, manual analysis of the verbatim full text from the search sources yourself, you MUST set BOTH `return_raw_results=True` AND `depth="deep"`.
    - Setting `return_raw_results=True` with `depth="normal"` will NOT return full verbatim text.
3.  **Provide Detailed Context**: When using `depth="deep"`, always provide detailed `context` explaining *why* you are searching and exactly what information you need synthesized.
4.  **Time Range**: Use the `time_range` parameter (e.g., 'day', 'week', 'month', 'year') when you need recent info. Usually call `get_time` first to know the current date/year before applying this.
""",
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
    directives="""\
## Browsing Agent
The `browsing_agent` is an autonomous agent that operates a headless browser. 
Use it for tasks that require **interactive browsing** — navigating multiple pages, 
clicking through menus, filling forms, or extracting data from dynamic/interactive websites.

### When to use browsing_agent vs search_web vs visit_page
- **search_web**: For factual lookups, news, or documentation queries. Fast, cheap.
- **visit_page**: For reading a specific known URL. One-shot extraction.
- **browsing_agent**: For tasks requiring multiple navigation steps, interaction 
  with page elements, or when you need to explore a site's structure.

### Rules
- **Self-Contained Query**: The browsing_agent has NO access to conversation history. Provide a fully self-contained task description in `query`.
- **Success Criteria (Required)**: You MUST define exactly what success looks like in the `success_criteria` field. Be specific (e.g., "Extract the 2024 pricing table", "Find the 'Contact Us' email").
- **Start URL (Optional)**: If you already know the specific website to visit, provide it in `start_url` to bypass search engine steps and save turns.
- **Scoping (Optional)**: Use `scope` (array of strings, e.g. `["google.com"]`) to restrict direct navigation. The agent will only be allowed to use `browser_navigate` for these domains, though it can still follow links (clicks) to external sites. This keeps the agent focused on your target channels.
- **Limitations**: Do NOT use browsing_agent for simple fact lookups — use search_web instead.
""",
)

SPECS = [VISIT_PAGE, SEARCH_WEB, BROWSING_AGENT]

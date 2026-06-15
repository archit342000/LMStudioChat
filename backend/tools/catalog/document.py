# backend/tools/catalog/document.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

DOCUMENT_AGENT = ToolSpec(
    name="document_agent",
    description="Delegates a document analysis task to an autonomous agent. The agent uses RAG, grep, and line/page reading to investigate uploaded files (documents, code, or images).",
    parameters={
        "type": "object",
        "properties": {
            "file_id": {
                "type": "string",
                "description": "The unique ID of the file to analyze (e.g., 'file_abc123')."
            },
            "query": {
                "type": "string",
                "description": "The specific question or instruction for analyzing the file (e.g., 'Summarize the key findings', 'What is the value of X?')."
            }
        },
        "required": ["file_id", "query"]
    },
    implementation="backend.tools.agents.document_agent.agent.flow_fn",
    tool_type=ToolType.AGENT,
    scopes=(ToolScope.MAIN,),
    directives="""\
## Document Agent Tool Rules
The `document_agent` tool delegates investigation of an uploaded file (PDF, DOCX, TXT, Code, Images) to an autonomous sub-agent. This agent is capable of using RAG, grep, and precise line/page reading to fulfill your request.

### When to use
Use `document_agent` whenever you need to extract information from, analyze, or verify the contents of an uploaded file. Use this ONLY for files you can see have been **uploaded** in the current conversation, for all other files, use the `file_system_agent`.

### Delegation Strategy
The `document_agent` is autonomous. You do NOT need to micromanage its search strategy. Give it a clear, descriptive objective. The best practice is to have the sub-agent prepare the final deliverable item instead of using it to extract data for you to process. 

### Parameters
1.  **query**: Mandatory. Give the sub-agent a comprehensive objective (e.g., "Find all instances where the variable `X` is mutated" or "Summarize the architectural guidelines for the database layer").
""",
)

DOCUMENT_AGENT_RAG = ToolSpec(
    name="document_agent_rag",
    description="Performs a semantic search (RAG) across the chunks of the uploaded document. Best for broad conceptual queries or finding information when you don't know the exact phrasing.",
    parameters={
        "type": "object",
        "properties": {
            "file_id": {
                "type": "string",
                "description": "The ID of the file to search."
            },
            "query": {
                "type": "string",
                "description": "The semantic concept or question to search for."
            },
            "depth": {
                "type": "string",
                "enum": ["basic", "standard", "deep"],
                "description": "Amount of chunks to return."
            }
        },
        "required": ["file_id", "query"]
    },
    implementation="backend.tools.agents.document_agent.tools.document_agent_rag_tool",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.DOCUMENT_BASE,),
)

GREP_UPLOADED_FILE = ToolSpec(
    name="grep_uploaded_file",
    description="Performs a literal text or regex search across the raw extracted text of the uploaded file. Best for finding exact keywords, variable names, or specific values.",
    parameters={
        "type": "object",
        "properties": {
            "file_id": {
                "type": "string",
                "description": "The ID of the file to search."
            },
            "query": {
                "type": "string",
                "description": "The exact string or regex pattern to find."
            },
            "is_regex": {
                "type": "boolean",
                "description": "Set to true if query is a regular expression."
            },
            "context_chars": {
                "type": "integer",
                "description": "Number of characters to return before and after each match for context. Default is 300. Increase for wider context, decrease to save tokens."
            }
        },
        "required": ["file_id", "query"]
    },
    implementation="backend.tools.agents.document_agent.tools.grep_uploaded_file_tool",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.DOCUMENT_BASE,),
)

READ_UPLOADED_FILE_LINES = ToolSpec(
    name="read_uploaded_file",
    description="Reads a specific range of lines from the raw text of the uploaded file. Use this to verify context after finding a hit via RAG or grep.",
    parameters={
        "type": "object",
        "properties": {
            "file_id": {
                "type": "string",
                "description": "The ID of the file to read."
            },
            "start_line": {
                "type": "integer",
                "description": "1-indexed starting line number."
            },
            "end_line": {
                "type": "integer",
                "description": "1-indexed ending line number."
            }
        },
        "required": ["file_id"]
    },
    implementation="backend.tools.agents.document_agent.tools.read_uploaded_file_tool",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.DOCUMENT_LINE,),
)

READ_UPLOADED_FILE_PAGE = ToolSpec(
    name="read_uploaded_file",
    description="Reads a specific page from the uploaded document. Use this to read page-based content after finding a hit via RAG or grep.",
    parameters={
        "type": "object",
        "properties": {
            "file_id": {
                "type": "string",
                "description": "The ID of the file to read."
            },
            "page": {
                "type": "integer",
                "description": "The 1-indexed page number to read."
            }
        },
        "required": ["file_id", "page"]
    },
    implementation="backend.tools.agents.document_agent.tools.read_uploaded_file_tool",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.DOCUMENT_PAGE,),
)

SPECS = [DOCUMENT_AGENT, DOCUMENT_AGENT_RAG, GREP_UPLOADED_FILE, READ_UPLOADED_FILE_LINES, READ_UPLOADED_FILE_PAGE]

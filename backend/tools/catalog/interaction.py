# backend/tools/catalog/interaction.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

REQUEST_CLARIFICATION = ToolSpec(
    name="request_clarification",
    description="Ask the user a focused question when their request is ambiguous or lacks information needed to proceed.",
    parameters={
        "type": "object",
        "properties": {
            "question": {
                "type": "string",
                "description": "The specific question to ask the user."
            },
            "options": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional MCQ choices rendered as buttons in the UI."
            }
        },
        "required": ["question"]
    },
    implementation="backend.tools.clarify.request_clarification",
    tool_type=ToolType.PURE,
    scopes=(
        ToolScope.MAIN,
        ToolScope.FILE_SYSTEM,
        ToolScope.BROWSING_BASE,
        ToolScope.BROWSING_VISION,
        ToolScope.DOCUMENT_BASE,
        ToolScope.GIT,
    ),
)

MANAGE_TASK_LIST = ToolSpec(
    name="manage_task_list",
    description="Creates, updates, or views a persistent task list/checklist for the current chat or sub-agent session. Used to track progress on multi-step objectives.",
    parameters={
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["initialize", "add_step", "update_status", "view"],
                "description": "The operation to perform. 'initialize' creates a new list (overwriting any existing one). 'add_step' appends a new task. 'update_status' modifies a task. 'view' returns the current list."
            },
            "items": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Used with 'initialize' to provide the initial list of task descriptions, or with 'add_step' to provide new task descriptions."
            },
            "step_id": {
                "type": "integer",
                "description": "Used with 'update_status' to identify the specific task by its ID."
            },
            "status": {
                "type": "string",
                "enum": ["TODO", "DONE", "BLOCKED", "DROPPED"],
                "description": "Used with 'update_status' to set the new state of the task."
            },
            "notes": {
                "type": "string",
                "description": "Optional notes or breadcrumbs to attach to a task when updating its status (e.g., reason for being blocked)."
            }
        },
        "required": ["action"]
    },
    implementation="backend.tools.tasks.manage_task_list",
    tool_type=ToolType.PURE,
    scopes=(
        ToolScope.MAIN,
        ToolScope.FILE_SYSTEM,
        ToolScope.BROWSING_BASE,
        ToolScope.BROWSING_VISION,
        ToolScope.DOCUMENT_BASE,
        ToolScope.GIT,
    ),
)

VALIDATE_OUTPUT_FORMAT = ToolSpec(
    name="validate_output_format",
    description="SYSTEM-ONLY TOOL — you are FORBIDDEN from calling this tool. It runs automatically after every response to check formatting. If issues are found, you will receive a tool result describing each issue and asking you to output <fix> blocks. Each <fix> block must contain <prefix> (the ~50 tokens before the fix point, copied exactly from your response), <correction> (the fix itself), and <suffix> (the ~50 tokens after the fix point, copied exactly from your response). If the fix point is near the start or end of your response, use whatever tokens are available instead of inventing tokens. Output ONLY the <fix> blocks with no commentary.",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    },
    implementation="backend.tools.catalog.interaction.validate_output_format_noop",
    tool_type=ToolType.PURE,
    scopes=()
)

def validate_output_format_noop(**kwargs):
    return {"success": True}

SPECS = [REQUEST_CLARIFICATION, MANAGE_TASK_LIST, VALIDATE_OUTPUT_FORMAT]


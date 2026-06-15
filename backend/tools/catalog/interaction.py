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
    directives="""\
## Asking for Clarification
Use `request_clarification` only when the user's request is genuinely ambiguous in a way that prevents you from proceeding. You are encouraged to make sensible assumptions, but if you are unable to do so, you MUST ask for clarification. A clarification request is better than making a wrong assumption and potentially producing an incorrect output.

When using `options`, keep the list short (2–4 choices) and mutually exclusive.
""",
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

SPECS = [REQUEST_CLARIFICATION, MANAGE_TASK_LIST]

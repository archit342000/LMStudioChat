# backend/tools/catalog/clipboard.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

CLIPBOARD_WRITE = ToolSpec(
    name="clipboard_write",
    description="Writes content to the shared clipboard. Returns an auto-generated key. Pass this key to other agents (e.g., in the file_system_agent instruction) or use it in clipboard_key parameters of file tools to reference this content without re-transmitting it.",
    parameters={
        "type": "object",
        "properties": {
            "content": { "type": "string", "description": "The text content to store." }
        },
        "required": ["content"]
    },
    implementation="backend.tools.clipboard.clipboard_write",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN, ToolScope.FILE_SYSTEM),
)

CLIPBOARD_READ = ToolSpec(
    name="clipboard_read",
    description="Reads content from the shared clipboard by its key.",
    parameters={
        "type": "object",
        "properties": {
            "key": { "type": "string", "description": "The clipboard key to read." }
        },
        "required": ["key"]
    },
    implementation="backend.tools.clipboard.clipboard_read",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN, ToolScope.FILE_SYSTEM),
)

CLIPBOARD_COPY_FILE = ToolSpec(
    name="clipboard_copy_file",
    description="Copies content from a virtual file system file directly into the clipboard without reading it into the conversation. Returns an auto-generated clipboard key.",
    parameters={
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "The virtual file path to copy from." },
            "start_line": { "type": "integer", "description": "Optional 1-indexed start line." },
            "end_line": { "type": "integer", "description": "Optional 1-indexed end line." }
        },
        "required": ["path"]
    },
    implementation="backend.tools.clipboard.clipboard_copy_file",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN, ToolScope.FILE_SYSTEM),
)

SPECS = [CLIPBOARD_WRITE, CLIPBOARD_READ, CLIPBOARD_COPY_FILE]

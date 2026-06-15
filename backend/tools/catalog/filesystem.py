# backend/tools/catalog/filesystem.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

CREATE_FS_FILE = ToolSpec(
    name="create_fs_file",
    description="Creates a new persistent file_system at the specified path. Returns the status. Fails if a file already exists at that path.",
    parameters={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "The full relative path including directories and filename (e.g. 'src/utils/math.py')."
            },
            "content": {
                "type": "string",
                "description": "Initial content for the file_system."
            },
            "file_system_type": {
                "type": "string",
                "description": "Optional type/status update (e.g. 'research_plan_approved')."
            }
        },
        "required": ["path", "content"]
    },
    implementation="backend.file_system.manager.create_fs_file",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.FILE_SYSTEM,),
)

CREATE_DIRECTORY = ToolSpec(
    name="create_directory",
    description="Creates a new empty directory in the file_system system.",
    parameters={
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "The full relative path of the directory to create (e.g. 'src/utils')." }
        },
        "required": ["path"]
    },
    implementation="backend.file_system.manager.create_directory_tool",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.FILE_SYSTEM,),
)

DELETE_DIRECTORY = ToolSpec(
    name="delete_directory",
    description="Deletes an empty directory in the file_system system. Fails if the directory contains tracked files.",
    parameters={
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "The full relative path of the directory to delete (e.g. 'src/utils')." }
        },
        "required": ["path"]
    },
    implementation="backend.file_system.manager.delete_directory_tool",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.FILE_SYSTEM,),
)

REPLACE_FS_TEXT = ToolSpec(
    name="replace_fs_text",
    description="Finds and replaces text in a file_system specified by path. Returns status and a unified diff.",
    parameters={
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "The full relative path of the file_system." },
            "expected_version": { "type": "integer", "description": "Must match current version." },
            "target_text": { "type": "string", "description": "Exact text to find." },
            "new_content": { "type": "string", "description": "Replacement text. Use empty string to delete." },
            "start_line": { "type": "integer", "description": "Optional. Disambiguates duplicate matches." },
            "end_line": { "type": "integer", "description": "Optional. Disambiguates duplicate matches." },
            "allow_multiple": { "type": "boolean", "description": "Optional. If true, replaces all occurrences." }
        },
        "required": ["path", "expected_version", "target_text", "new_content"]
    },
    implementation="backend.file_system.manager.replace_fs_text",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.FILE_SYSTEM,),
)

REPLACE_FS_LINES = ToolSpec(
    name="replace_fs_lines",
    description="Overwrites a line range in a file_system specified by path. Fallback when text matching fails.",
    parameters={
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "The full relative path of the file_system." },
            "expected_version": { "type": "integer", "description": "Must match current version." },
            "start_line": { "type": "integer", "description": "1-indexed start line." },
            "end_line": { "type": "integer", "description": "1-indexed end line." },
            "new_content": { "type": "string", "description": "Content to replace the line range with." }
        },
        "required": ["path", "expected_version", "start_line", "end_line", "new_content"]
    },
    implementation="backend.file_system.manager.replace_fs_lines",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.FILE_SYSTEM,),
)

GREP_FILES = ToolSpec(
    name="grep_files",
    description="Searches for a text pattern across file_systems in this chat session. Use this to find which file contains specific information.",
    parameters={
        "type": "object",
        "properties": {
            "pattern": { "type": "string" },
            "is_regex": { "type": "boolean" },
            "path": { "type": "string", "description": "Optional. The directory or file path to search within (e.g., 'src/'). If omitted, searches all files." },
            "context_chars": { "type": "integer", "description": "Number of characters to return before and after each match. Default is 300.", "default": 300 },
            "max_matches_per_file_system": { "type": "integer", "default": 5 },
            "names_only": { "type": "boolean", "description": "If true, only returns the paths that match, without the surrounding text." }
        },
        "required": ["pattern"]
    },
    implementation="backend.file_system.manager.grep_files",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.FILE_SYSTEM,),
)

MOVE_FS_FILE = ToolSpec(
    name="move_fs_file",
    description="Moves or renames a file_system file to a new path.",
    parameters={
        "type": "object",
        "properties": {
            "source_path": { "type": "string", "description": "The current full relative path of the file_system." },
            "destination_path": { "type": "string", "description": "The new full relative path for the file_system." }
        },
        "required": ["source_path", "destination_path"]
    },
    implementation="backend.file_system.manager.move_fs_file_tool",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.FILE_SYSTEM,),
)

DELETE_FS_FILE = ToolSpec(
    name="delete_fs_file",
    description="Permanently deletes a file_system file at the specified path.",
    parameters={
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "The full relative path of the file_system to delete." }
        },
        "required": ["path"]
    },
    implementation="backend.file_system.manager.delete_file_system_tool",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.FILE_SYSTEM,),
)

READ_FS_FILE = ToolSpec(
    name="read_fs_file",
    description="Reads the content of a specific file_system by its path.",
    parameters={
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "The full relative path of the file_system." },
            "start_line": { "type": "integer", "description": "1-indexed start line." },
            "end_line": { "type": "integer", "description": "1-indexed end line." },
            "outline": { "type": "boolean", "description": "If true, returns a structural outline." }
        },
        "required": ["path"]
    },
    implementation="backend.file_system.manager.read_fs_file",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.FILE_SYSTEM, ToolScope.GIT),
)

LS_FILES = ToolSpec(
    name="ls_files",
    description="Lists the files and directories in a specific path within the file_system system.",
    parameters={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Optional. The directory path to list (e.g., 'src/components'). If omitted or '/', lists the root directory. Returns only immediate children, not the full recursive tree."
            }
        },
        "required": []
    },
    implementation="backend.file_system.manager.ls_files_for_tool",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.FILE_SYSTEM, ToolScope.GIT),
)

PATCH_FILE_SYSTEM = ToolSpec(
    name="patch_file_system",
    description="Updates file metadata or content by ID.",
    parameters={
        "type": "object",
        "properties": {},
        "required": []
    },
    implementation="backend.file_system.manager.patch_file_system",
    tool_type=ToolType.PURE,
    scopes=(),
)

FILE_SYSTEM_AGENT = ToolSpec(
    name="file_system_agent",
    description="Delegates a file_system task to a specialized sub-agent capable of multi-step read/write operations across one or more file_systems.",
    parameters={
        "type": "object",
        "properties": {
            "instruction": {
                "type": "string",
                "description": "Self-contained task description. The agent has no access to conversation history."
            }
        },
        "required": ["instruction"]
    },
    implementation="backend.tools.agents.file_system_agent.agent.flow_fn",
    tool_type=ToolType.AGENT,
    scopes=(ToolScope.MAIN,),
    directives="""\
## Delegating to the File System Agent
The `file_system_agent` is a specialized **Document Manager** strictly for file system lifecycle operations (listing, reading, writing, restructuring, or metadata updates). All operations having anything to do with files must be done through the `file_system_agent`.

### Rules 
- **Limited Context**: The `file_system_agent` does not have the full context of the conversation so you must pass all necessary information to it. 
- **Processing Rules**: The `file_system_agent` is not dumb and can process instructions on its own given ample details, it however, has access to only its own knowledge and the files in the file system. It cannot access the internet or any external sources. 
- **Agent's capabilities**: The `file_system_agent` is the same AI you are, just with a separate conversation history and a different set of tools. It can perform whatever you ask it to do, as long as it pertains to files. You can and should delegate output processing to it to get the final output in a desirable format.

Examples:
Acceptable instructions: Given the contents of file test_textbook.md, generate a comprehensive set of questions and answers for practice purposes. Each answer must be limited to 50 words. (Works because the agent doesn't have to fetch external information and it can do whatever processing you can do.)
Unacceptable instructions: Fetch the latest documentation for vLLM and write a python script to deploy an LLM. (Doesn't work because while the agent can write the python script, it cannot fetch latest documentation from the internet.)
""",
)

SPECS = [
    CREATE_FS_FILE,
    CREATE_DIRECTORY,
    DELETE_DIRECTORY,
    REPLACE_FS_TEXT,
    REPLACE_FS_LINES,
    GREP_FILES,
    MOVE_FS_FILE,
    DELETE_FS_FILE,
    READ_FS_FILE,
    LS_FILES,
    PATCH_FILE_SYSTEM,
    FILE_SYSTEM_AGENT
]

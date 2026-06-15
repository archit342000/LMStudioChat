# backend/tools/catalog/code.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

RUN_CODE = ToolSpec(
    name="run_code",
    description="Execute code in a sandboxed environment. Use this for calculations, data processing, algorithm verification, generating charts, or any task that benefits from running actual code. Returns stdout, stderr, and exit code.",
    parameters={
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "The complete source code to execute."
            },
            "language": {
                "type": "string",
                "enum": ["python", "c", "cpp", "java", "javascript", "typescript", "go", "rust", "bash", "php", "sql"],
                "description": "The programming language of the code."
            },
            "stdin": {
                "type": "string",
                "description": "Optional standard input to feed to the program."
            },
            "sql_target": {
                "type": "string",
                "enum": ["mysql", "sqlite"],
                "description": "For SQL: which database engine to use. Defaults to 'sqlite'."
            }
        },
        "required": ["code", "language"]
    },
    implementation="backend.tools.implementations.code_executor.run_code",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN,),
    requires_mode="code_execution_mode",
    directives="""\
## Code Execution Tool Guidelines

You have access to a sandboxed code execution environment. Use it proactively to enhance your responses.

### When to Use `run_code`:
- Mathematical calculations, statistics, or numerical analysis
- String processing, data formatting, or text analysis (e.g., word count, frequency analysis)
- Algorithm verification or demonstration
- Data transformation or CSV/JSON processing
- Any claim that can be verified by running actual code
- Generating formatted output that would be tedious to construct manually

### When to Use `run_file`:
- When the user asks to execute a file that exists in the virtual file system
- When testing or debugging code the user has written in the file system
- The entire project directory is automatically included — cross-file imports, includes, and package structures work out of the box
- Example: if main.py imports from utils/helper.py, both files are sent to the sandbox

### When to Use `install_packages`:
- When code requires a third-party library not in the standard library
- Always try stdlib first before requesting package installation
- The user will be asked to confirm the installation

### When to Use `list_packages`:
- Before writing code that uses a third-party library — check if it's already installed
- Before calling install_packages — avoid redundant installation requests
- When the user asks what packages are available in the sandbox

### Language Selection:
- **Python**: Default choice for general computation, data processing, scripting
- **C/C++**: Performance-critical computations, systems-level demonstrations
- **Java**: OOP demonstrations, algorithm implementations
- **JavaScript/TypeScript**: Web-related computations, JSON processing
- **SQL (sqlite)**: Data queries on temporary in-memory data
- **SQL (mysql)**: When the user explicitly wants MySQL or needs persistent tables across runs
- **Bash**: System-level scripting (will require user confirmation)
- **Go/Rust/PHP**: When the user specifically requests these languages

### Output Handling:
- Always print results to stdout so they appear in the execution output
- For Python: use print() for output
- Keep output concise — there is a size limit on captured output
- If the code errors, analyze stderr and fix the code, then retry

### Safety:
- Simple computations run automatically
- File I/O, network, and shell operations require user confirmation
- Bash scripts always require user confirmation
- SQL mutations (INSERT/UPDATE/DELETE/DROP) require user confirmation
- Pure SELECT queries run automatically
""",
)

RUN_FILE = ToolSpec(
    name="run_file",
    description="Execute a code file from the virtual file system. Automatically includes ALL files in the project directory tree (recursively) so that cross-file imports, includes, and package structures resolve correctly.",
    parameters={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "The virtual file system path to the main entry file to execute."
            },
            "stdin": {
                "type": "string",
                "description": "Optional standard input to feed to the program."
            },
            "args": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional command-line arguments."
            },
            "sql_target": {
                "type": "string",
                "enum": ["mysql", "sqlite"],
                "description": "For SQL files: which database engine to use. Defaults to 'sqlite'."
            }
        },
        "required": ["path"]
    },
    implementation="backend.tools.implementations.code_executor.run_file",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN,),
    requires_mode="code_execution_mode",
)

INSTALL_PACKAGES = ToolSpec(
    name="install_packages",
    description="Install packages in the code execution sandbox. Requires user approval before proceeding. Installed packages persist until the code runner container is restarted.",
    parameters={
        "type": "object",
        "properties": {
            "packages": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of package names to install."
            },
            "package_manager": {
                "type": "string",
                "enum": ["pip", "npm"],
                "description": "Which package manager to use."
            }
        },
        "required": ["packages", "package_manager"]
    },
    implementation="backend.tools.implementations.code_executor.install_packages",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN,),
    requires_mode="code_execution_mode",
)

LIST_PACKAGES = ToolSpec(
    name="list_packages",
    description="List packages currently installed in the code execution sandbox. Use this to check what's available before writing code that depends on third-party libraries, or before requesting a package installation.",
    parameters={
        "type": "object",
        "properties": {
            "package_manager": {
                "type": "string",
                "enum": ["pip", "npm"],
                "description": "Which package manager to query."
            }
        },
        "required": ["package_manager"]
    },
    implementation="backend.tools.implementations.code_executor.list_packages",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.MAIN,),
    requires_mode="code_execution_mode",
)

SPECS = [RUN_CODE, RUN_FILE, INSTALL_PACKAGES, LIST_PACKAGES]

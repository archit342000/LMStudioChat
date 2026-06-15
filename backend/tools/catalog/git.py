# backend/tools/catalog/git.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

GIT_AGENT = ToolSpec(
    name="git_agent",
    description=(
        "Delegates a git/version-control task to a specialized sub-agent. "
        "The agent can clone repos, inspect history, create branches, stage and commit changes. "
        "Push is disabled by default but can be enabled in System Settings. "
        "For workflows requiring file edits, use file_system_agent to edit files and git_agent to stage/commit."
    ),
    parameters={
        "type": "object",
        "properties": {
            "instruction": {
                "type": "string",
                "description": (
                    "Self-contained git task description. The agent has no access to conversation history. "
                    "Include the target repository path or URL, the desired working directory (e.g. '/'), "
                    "and the full context needed to complete the task."
                )
            }
        },
        "required": ["instruction"]
    },
    implementation="backend.tools.agents.git_agent.agent.flow_fn",
    tool_type=ToolType.AGENT,
    scopes=(ToolScope.MAIN,),
    directives="""\
## Delegating to the Git Agent
The `git_agent` is a specialized sub-agent for all version control and git operations (cloning repositories, checking status, viewing logs/diffs, managing branches, creating commits, etc.). All git-related actions must be delegated to the `git_agent`.

### Rules
- **Limited Context**: The `git_agent` operates independently with its own tool loop and does not have the full context of the main conversation. You must pass all necessary information (repository URL, virtual working directory path, target branch or commit info, and exact instructions) to the agent.
- **Paths**: The agent works with virtual paths within the file system (e.g. `.`). When telling the agent to clone, specify the parent directory (e.g. `.`).
    - **File Edits**: The `git_agent` CANNOT modify file contents. For workflows requiring both code edits and git version control (e.g., "fix the bug and commit the change"):
  1. Call `file_system_agent` to make the edits.
  2. Call `git_agent` to inspect, stage, and commit the changes.
""",
)

EXECUTE_GIT = ToolSpec(
    name="execute_git",
    description=(
        "Execute a validated git command inside the file system. "
        "The subcommand must be in the configured allowed list. "
        "The working_directory must always be specified as a virtual path."
    ),
    parameters={
        "type": "object",
        "properties": {
            "subcommand": {
                "type": "string",
                "description": "Git subcommand (e.g., 'clone', 'status', 'commit', 'log')."
            },
            "args": {
                "type": "array",
                "items": {"type": "string"},
                "description": (
                    "Arguments to pass to the git subcommand. "
                    "For clone: first arg is the URL, optional second arg is the target directory name. "
                    "For commit: ['-m', 'commit message']. "
                    "For add: ['.'] or specific file paths. "
                    "Do NOT include shell operators (;, &, |, `)."
                )
            },
            "working_directory": {
                "type": "string",
                "description": (
                    "Virtual path where the git command runs. "
                    "For clone: the parent directory (e.g. '/'). "
                    "For all other commands: the repo root (e.g. './my-repo')."
                )
            }
        },
        "required": ["subcommand", "args", "working_directory"]
    },
    implementation="backend.tools.implementations.git_executor.execute_git",
    tool_type=ToolType.PURE,
    scopes=(ToolScope.GIT,),
)

SPECS = [GIT_AGENT, EXECUTE_GIT]

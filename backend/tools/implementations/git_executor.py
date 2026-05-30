import logging
import os
import re
import shutil
import subprocess
from typing import Optional

from backend import config
from backend.database import db
from backend.file_system.utils import resolve_owner_and_physical_path, FILE_SYSTEMS_DIR

logger = logging.getLogger(__name__)

# Shell metacharacters that must never appear in git arguments
_SHELL_METACHAR_RE = re.compile(r'[;&|`$()\\\n\r]')

# Subcommands that modify the working tree and may invalidate DB file records
_TREE_MODIFYING_SUBCOMMANDS = {
    'checkout', 'switch', 'pull', 'merge', 'rebase',
    'reset', 'clean', 'stash',
}


def _get_allowed_commands() -> list[str]:
    """
    Return the current allowlist from system_settings, falling back to config defaults.
    """
    try:
        stored = db.get_setting('git_allowed_commands')
        if isinstance(stored, list):
            return stored
    except Exception:
        pass
    return list(config.GIT_DEFAULT_ALLOWED_COMMANDS)


def _sanitize_arg(arg: str) -> str:
    """
    Raise ValueError if the argument contains shell metacharacters.
    Returns the argument unchanged if safe.
    """
    if _SHELL_METACHAR_RE.search(arg):
        raise ValueError(f"Git argument contains forbidden shell metacharacter: {arg!r}")
    return arg


def _scrub_pat_from_output(text: str) -> str:
    """
    Remove GitHub PAT tokens from any output string before returning to the agent.
    Replaces https://<token>@... patterns with https://<redacted>@...
    """
    return re.sub(r'https://[^@\s]+@', 'https://<redacted>@', text)


def _inject_pat_into_url(url: str) -> str:
    """
    If the URL is a GitHub HTTPS URL and a PAT is stored in system_settings,
    inject the PAT into the URL. The token is never exposed to the LLM.
    """
    if not url.startswith('https://github.com/') and not url.startswith('https://www.github.com/'):
        return url
    try:
        pat = db.get_setting('github_pat')
        if not pat:
            return url
        # Replace https://github.com/ with https://<token>@github.com/
        return re.sub(r'^https://', f'https://{pat}@', url, count=1)
    except Exception:
        return url


def _extract_repo_name(url: str) -> str:
    """Extract repository name from a git URL."""
    url = url.strip().rstrip('/')
    if url.endswith('.git'):
        url = url[:-4]
    parts = re.split(r'[/:]', url)
    name = parts[-1] if parts else 'repo'
    return name or 'repo'


def _invalidate_stale_db_records(physical_dir: str, chat_id: Optional[str], workspace_id: Optional[str]) -> None:
    """
    After a tree-modifying git operation, delete file_systems DB records whose
    physical files live inside physical_dir. The next read will fall back to disk.
    """
    try:
        if chat_id:
            file_systems = db.get_chat_file_systems(chat_id)
        elif workspace_id:
            file_systems = db.get_owner_file_systems(workspace_id=workspace_id)
        else:
            return

        for fs in file_systems:
            # Reconstruct the expected physical path for this DB record
            filename = fs.get('filename', '')
            if not filename:
                continue
            # Check if this file lives under the affected directory
            from backend.file_system.utils import sanitize_filename
            if chat_id:
                owner_dir = os.path.join(FILE_SYSTEMS_DIR, sanitize_filename(chat_id))
            else:
                owner_dir = os.path.join(FILE_SYSTEMS_DIR, 'workspaces', sanitize_filename(workspace_id))

            file_physical_path = os.path.join(owner_dir, filename.lstrip('/'))
            if file_physical_path.startswith(physical_dir):
                # Delete the DB record so next read falls back to disk
                try:
                    db.delete_file_system(fs['id'], chat_id=chat_id, workspace_id=workspace_id)
                except Exception as del_e:
                    logger.warning(f"git_executor: failed to invalidate stale DB record {fs['id']}: {del_e}")
    except Exception as e:
        logger.warning(f"git_executor: _invalidate_stale_db_records error: {e}")


def execute_git(
    subcommand: str,
    args: list,
    working_directory: str,
    chat_id: str = None,
    workspace_id: str = None,
) -> str:
    """
    Execute a validated git command in the specified virtual working directory.

    Args:
        subcommand: Git subcommand (e.g. 'clone', 'status', 'commit').
        args: List of string arguments to the subcommand.
        working_directory: Virtual path within the file system (e.g. 'workspace/my-repo').
        chat_id: Injected by ToolHandler from context.
        workspace_id: Injected by ToolHandler from context.

    Returns:
        Formatted string with stdout/stderr output from the git command.

    Raises:
        ValueError: If the subcommand is not allowed or arguments are unsafe.
    """
    # 1. Validate subcommand against allowlist
    subcommand = subcommand.strip().lower()
    allowed = _get_allowed_commands()
    if subcommand not in allowed:
        return (
            f"Error: git subcommand '{subcommand}' is not in the allowed list. "
            f"Allowed commands: {', '.join(sorted(allowed))}. "
            f"The user can enable additional commands in System Settings → Git Agent."
        )

    # 2. Sanitize all arguments
    try:
        sanitized_args = [_sanitize_arg(str(a)) for a in args]
    except ValueError as e:
        return f"Error: {e}"

    # 2.5. Prevent cloning/creation inside 'workspace/' path prefix
    for arg in sanitized_args:
        clean_arg = arg.replace('\\', '/').lstrip('./').strip('/')
        if clean_arg.startswith("workspace/") or clean_arg == "workspace":
            return (
                "Error: The 'workspace/' directory is a virtual mount. "
                "You cannot use 'workspace/' prefixed paths as command arguments. "
                "Instead, set the tool's working directory to 'workspace/' (or a path under it) "
                "and use relative paths without the 'workspace/' prefix."
            )

    # 3. Resolve working_directory to physical path
    try:
        target_chat_id, target_workspace_id, physical_path = resolve_owner_and_physical_path(
            chat_id=chat_id,
            virtual_path=working_directory,
            workspace_id=workspace_id,
        )
    except Exception as e:
        return f"Error resolving working directory '{working_directory}': {e}"

    # 4. Validate physical path is within FILE_SYSTEMS_DIR (prevent traversal)
    real_physical = os.path.realpath(physical_path)
    real_fs_dir = os.path.realpath(FILE_SYSTEMS_DIR)
    if not real_physical.startswith(real_fs_dir + os.sep) and real_physical != real_fs_dir:
        return f"Error: working directory resolves outside the permitted file systems directory."

    # 5. Ensure the working directory exists
    os.makedirs(physical_path, exist_ok=True)

    # 6. For clone: inject GitHub PAT into URL if available, and ensure subdirectory clone for "/" working_directory
    final_args = list(sanitized_args)
    if subcommand == 'clone' and final_args:
        repo_url = final_args[0]
        final_args[0] = _inject_pat_into_url(repo_url)
        
        is_root_working_dir = (working_directory.strip() == "/")
        if is_root_working_dir:
            repo_name = _extract_repo_name(repo_url)
            if len(final_args) >= 2:
                target_dir = final_args[1].strip()
                if target_dir in (".", "/", ""):
                    final_args[1] = repo_name
            else:
                final_args.append(repo_name)

    # 7. Locate git binary
    git_binary = shutil.which('git')
    if not git_binary:
        return "Error: git binary not found on PATH. Ensure git is installed in the container."

    # 8. Build command
    cmd = [git_binary, subcommand] + final_args

    # 9. Build sanitized environment
    sanitized_env = {
        'HOME': os.environ.get('HOME', '/root'),
        'PATH': os.environ.get('PATH', '/usr/bin:/bin'),
        'GIT_TERMINAL_PROMPT': '0',  # Prevent git from hanging on auth prompts
        'GIT_ASKPASS': 'echo',       # Non-interactive credential helper
    }
    # Forward SSH-related env vars if present
    for var in ('SSH_AUTH_SOCK', 'SSH_AGENT_PID', 'GIT_SSH_COMMAND'):
        if var in os.environ:
            sanitized_env[var] = os.environ[var]

    # 10. Execute
    logger.info(f"git_executor: running git {subcommand} in {physical_path}")
    try:
        result = subprocess.run(
            cmd,
            cwd=physical_path,
            shell=False,
            capture_output=True,
            text=True,
            timeout=config.GIT_COMMAND_TIMEOUT,
            env=sanitized_env,
        )
    except subprocess.TimeoutExpired:
        return f"Error: git {subcommand} timed out after {config.GIT_COMMAND_TIMEOUT} seconds."
    except Exception as e:
        return f"Error executing git {subcommand}: {e}"

    # 11. For tree-modifying commands, invalidate stale DB records
    if subcommand in _TREE_MODIFYING_SUBCOMMANDS:
        _invalidate_stale_db_records(
            physical_path, target_chat_id, target_workspace_id
        )

    # 12. Format and scrub output
    stdout = _scrub_pat_from_output(result.stdout or '')
    stderr = _scrub_pat_from_output(result.stderr or '')

    if result.returncode == 0:
        output = stdout.strip() if stdout.strip() else '(no output)'
        return f"git {subcommand} succeeded.\n\n{output}"
    else:
        combined = '\n'.join(filter(None, [stdout.strip(), stderr.strip()]))
        return f"Error: git {subcommand} failed (exit code {result.returncode}).\n\n{combined}"

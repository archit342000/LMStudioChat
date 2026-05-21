import os
import re
from typing import Optional, List, Tuple
from backend.config import DATA_DIR
from backend.database import db

FILE_SYSTEMS_DIR = os.path.join(DATA_DIR, "file_systems")
WORKSPACES_DIR = os.path.join(FILE_SYSTEMS_DIR, "workspaces")

def sanitize_path(path: str) -> str:
    """Sanitize a relative path, allowing / but preventing traversal."""
    # Remove leading slashes to make it strictly relative
    path = path.lstrip('/')
    # Split into parts
    parts = path.split('/')
    safe_parts = []
    for part in parts:
        if part in ('..', '.'):
            continue # ignore parent/current traversal
        # Allow dots for file extensions
        safe_part = re.sub(r'[^\w\s\-.]', '_', part).strip()
        if safe_part:
            safe_parts.append(safe_part)
    return '/'.join(safe_parts)

def get_workspace_for_chat(chat_id: str) -> Optional[str]:
    """Helper to get the workspace_id for a given chat_id."""
    chat = db.get_chat(chat_id)
    if chat:
        return chat.get('workspace_id')
    return None

def resolve_owner_and_physical_path(chat_id: str, virtual_path: str, ensure_dir: bool = False) -> Tuple[Optional[str], Optional[str], str]:
    """
    Resolves a virtual path (e.g. 'workspace/docs.md' or 'local/docs.md') into:
    (target_chat_id, target_workspace_id, physical_path)
    
    If virtual_path starts with 'workspace/', it routes to the workspace.
    Otherwise, it routes to the chat.
    
    If ensure_dir is True, it will create the parent directory on disk.
    """
    safe_path = sanitize_path(virtual_path)
    
    # Intercept 'workspace/' mount
    if safe_path.startswith("workspace/") or safe_path == "workspace":
        workspace_id = get_workspace_for_chat(chat_id)
        if not workspace_id:
            raise ValueError("The 'workspace/' directory is reserved for Workspace Folders. Please add this chat to a workspace to use workspace file_systems, or choose a different path.")
            
        # Strip 'workspace/' (or handle just 'workspace')
        rest_of_path = safe_path[len("workspace/"):].strip("/")
        
        physical_dir = os.path.join(WORKSPACES_DIR, sanitize_filename(workspace_id))
        if rest_of_path:
            physical_path = os.path.join(physical_dir, rest_of_path)
        else:
            physical_path = physical_dir
            
        target_chat_id = None
        target_workspace_id = workspace_id
        
    else:
        # Standard chat-local storage
        physical_dir = os.path.join(FILE_SYSTEMS_DIR, sanitize_filename(chat_id))
        physical_path = os.path.join(physical_dir, safe_path)
        
        target_chat_id = chat_id
        target_workspace_id = None

    if ensure_dir:
        # If the path looks like a directory (e.g. creating a dir), or a file (creating parent)
        # We usually call this when we want the parent to exist. 
        # But for create_directory_tool, the path IS the directory.
        # Let the caller handle exist_ok=True on os.makedirs, we just return the path.
        pass

    return target_chat_id, target_workspace_id, physical_path

def ensure_physical_dir_exists(physical_path: str, is_file_path: bool = True):
    """Utility to safely ensure the directory exists for a resolved physical path."""
    if is_file_path:
        dir_path = os.path.dirname(physical_path)
    else:
        dir_path = physical_path
    os.makedirs(dir_path, exist_ok=True)

async def generate_fs_file_id(chat_id: str = None, workspace_id: str = None, file_system_type: str = "custom") -> str:
    """
    Generate a unique file_system ID using the atomic SQLite counter-based system.
    """
    counter = db.get_next_file_system_counter(chat_id=chat_id, workspace_id=workspace_id)
    return str(counter)

def sanitize_filename(text: str) -> str:
    """
    Sanitize text for use in filenames.
    """
    # Remove or replace invalid characters
    safe = re.sub(r'[^\w\s\-]', '_', str(text))
    # Replace multiple underscores with single
    safe = re.sub(r'_+', '_', safe)
    # Remove leading/trailing underscores
    safe = safe.strip('_')
    return safe

def _extract_fs_file_type(file_system_id: str) -> str:
    """Extract the type of file_system from its ID."""
    if file_system_id.startswith("plan_"):
        return "plan"
    elif file_system_id.startswith("research_"):
        return "research"
    elif file_system_id.startswith("section_"):
        return "section"
    else:
        return "custom"

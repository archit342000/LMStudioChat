import uuid
import logging
from typing import Optional, Dict, Any
from backend.database import db

logger = logging.getLogger(__name__)

def clipboard_write(content: str, chat_id: str) -> Dict[str, Any]:
    """
    Writes content to the shared clipboard. Returns an auto-generated key.
    """
    key = f"cb-{uuid.uuid4().hex[:8]}"
    db.clipboard_set(chat_id, key, content)
    return {"success": True, "key": key}

def clipboard_read(key: str, chat_id: str) -> Dict[str, Any]:
    """
    Reads content from the shared clipboard by its key.
    """
    content = db.clipboard_get(chat_id, key)
    if content is None:
        return {"success": False, "error": f"Clipboard key '{key}' not found."}
    return {"success": True, "key": key, "content": content}

async def clipboard_copy_file(path: str, chat_id: str, start_line: Optional[int] = None, end_line: Optional[int] = None) -> Dict[str, Any]:
    """
    Copies content from a virtual file system file directly into the clipboard without reading it into the conversation.
    Returns an auto-generated clipboard key.
    """
    # Inline import to avoid circular dependency
    from backend.file_system.manager import resolve_path_to_fs_file, get_fs_file_content

    try:
        file_system_meta = resolve_path_to_fs_file(chat_id, path)
    except FileNotFoundError as e:
        return {"success": False, "error": str(e)}

    file_system_id = file_system_meta['id']
    actual_chat_id = file_system_meta.get('chat_id')
    actual_workspace_id = file_system_meta.get('workspace_id')

    content = await get_fs_file_content(file_system_id, chat_id=actual_chat_id, workspace_id=actual_workspace_id) or ""

    if start_line is not None or end_line is not None:
        lines = content.split('\n')
        total_lines = len(lines)
        start_idx = max(0, start_line - 1) if start_line is not None else 0
        end_idx = min(total_lines, end_line) if end_line is not None else total_lines
        sliced_lines = lines[start_idx:end_idx]
        content = '\n'.join(sliced_lines)
        line_count = len(sliced_lines)
    else:
        line_count = len(content.split('\n'))

    key = f"cb-{uuid.uuid4().hex[:8]}"
    db.clipboard_set(chat_id, key, content)
    return {"success": True, "key": key, "lines": line_count}

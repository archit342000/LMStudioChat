from .manager import (
    create_fs_file,
    get_fs_file_content,
    update_fs_file_content,
    append_to_fs_file,
    delete_fs_file,
    get_unique_folders,
    get_chat_file_systems_with_details,
    export_fs_file_markdown,
    export_fs_file_html,
    export_fs_file_pdf,
    get_file_system_versions,
    restore_fs_file_version,
    get_fs_file_version,
    get_fs_file_diff,
    share_fs_file,
    unshare_fs_file,
    get_shared_users,
    delete_chat_fs_files
)
from .channel import FileSystemChannelManager
from .models import ChannelState
from .router import file_system_bp

# Legacy aliases
get_file_system = get_fs_file_content
update_file_system = update_fs_file_content

__all__ = [
    'create_fs_file',
    'get_fs_file_content',
    'update_fs_file_content',
    'append_to_fs_file',
    'delete_fs_file',
    'get_unique_folders',
    'get_chat_file_systems_with_details',
    'export_fs_file_markdown',
    'export_fs_file_html',
    'export_fs_file_pdf',
    'get_file_system_versions',
    'restore_fs_file_version',
    'get_fs_file_version',
    'get_fs_file_diff',
    'share_fs_file',
    'unshare_fs_file',
    'get_shared_users',
    'delete_chat_fs_files',
    'FileSystemChannelManager',
    'ChannelState',
    'get_file_system',
    'update_file_system',
    'file_system_bp'
]

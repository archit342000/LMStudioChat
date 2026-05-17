import backend.file_system as fs_pkg
from backend.file_system import ChannelState, FileSystemChannelManager, file_system_bp


def test_all_exports_defined():
    """Verify all entries in __all__ are importable."""
    for name in fs_pkg.__all__:
        assert hasattr(fs_pkg, name), f"__all__ lists '{name}' but it is not importable"


def test_legacy_aliases():
    """Legacy aliases should map to the current API functions."""
    assert fs_pkg.get_file_system is fs_pkg.get_fs_file_content
    assert fs_pkg.update_file_system is fs_pkg.update_fs_file_content


def test_channel_state_reexport():
    """ChannelState should be importable directly from the package."""
    assert ChannelState is not None
    assert ChannelState.FREE.value == "free"


def test_file_system_bp_reexport():
    """The Flask blueprint should be re-exported from the package."""
    assert file_system_bp is not None
    assert file_system_bp.name == "file_system"

from backend.file_system.models import ChannelState


def test_channel_state_members():
    """Verify all expected enum members exist."""
    assert ChannelState.FREE.value == "free"
    assert ChannelState.LOCKED_AI.value == "locked_ai"
    assert ChannelState.LOCKED_USER.value == "locked_user"
    assert ChannelState.QUEUEING.value == "queueing"


def test_channel_state_count():
    """Ensure no unexpected members have been added or removed."""
    assert len(ChannelState) == 4


def test_channel_state_is_enum():
    """ChannelState members should behave as proper enums."""
    assert ChannelState.FREE is ChannelState.FREE
    assert ChannelState.FREE != ChannelState.LOCKED_AI
    assert ChannelState("free") is ChannelState.FREE


def test_channel_state_string_roundtrip():
    """Values can be used to reconstruct the enum from stored strings."""
    for member in ChannelState:
        assert ChannelState(member.value) is member

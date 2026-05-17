import asyncio
import pytest
from unittest.mock import patch, MagicMock
from backend.file_system.channel import FileSystemPersistenceChannel, FileSystemChannelManager, ChannelState

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
def cleanup_manager():
    FileSystemChannelManager.cleanup()
    yield
    FileSystemChannelManager.cleanup()

@pytest.mark.anyio
async def test_channel_init():
    channel = FileSystemPersistenceChannel("test_chat")
    assert channel.chat_id == "test_chat"
    assert channel.state == ChannelState.FREE
    stats = channel.get_stats()
    assert stats["chat_id"] == "test_chat"
    assert stats["state"] == "free"

@pytest.mark.anyio
async def test_channel_acquire_release():
    channel = FileSystemPersistenceChannel("test_chat")
    
    # Acquire AI
    res = await channel.acquire("ai")
    assert res is True
    assert channel.state == ChannelState.LOCKED_AI
    
    # Release AI
    await channel.release()
    assert channel.state == ChannelState.FREE
    assert channel.get_stats()["total_operations"] == 1
    
    # Acquire User
    res = await channel.acquire("user")
    assert res is True
    assert channel.state == ChannelState.LOCKED_USER
    
    # Release User
    await channel.release()
    assert channel.state == ChannelState.FREE
    assert channel.get_stats()["total_operations"] == 2

@pytest.mark.anyio
async def test_channel_acquire_timeout():
    channel = FileSystemPersistenceChannel("test_chat")
    
    with patch("backend.config.FILE_SYSTEM_CHANNEL_ACQUIRE_TIMEOUT", 0.01):
        # Lock it first
        await channel.acquire("ai")
        
        # Second acquire should time out, force release, then acquire
        res = await channel.acquire("user")
        assert res is True
        assert channel.state == ChannelState.LOCKED_USER

@pytest.mark.anyio
async def test_channel_wait_if_blocked():
    channel = FileSystemPersistenceChannel("test_chat")
    
    # Not blocked
    res = await channel.wait_if_blocked("ai")
    assert res is True
    
    # Blocked by same type
    await channel.acquire("ai")
    res = await channel.wait_if_blocked("ai")
    assert res is True
    
    # Blocked by different type
    async def delayed_release():
        await asyncio.sleep(0.05)
        await channel.release()
    
    asyncio.create_task(delayed_release())
    res = await channel.wait_if_blocked("user")
    assert res is True

def test_manager_initialize_cleanup():
    assert not FileSystemChannelManager._initialized
    FileSystemChannelManager.initialize()
    assert FileSystemChannelManager._initialized
    FileSystemChannelManager.initialize() # idempotent
    FileSystemChannelManager.cleanup()
    assert not FileSystemChannelManager._initialized

def test_manager_get_release_channel():
    chan = FileSystemChannelManager.get_channel("chat1")
    assert chan.chat_id == "chat1"
    
    # Get same channel
    chan2 = FileSystemChannelManager.get_channel("chat1")
    assert chan is chan2
    
    FileSystemChannelManager.release_channel("chat1")
    chan3 = FileSystemChannelManager.get_channel("chat1")
    assert chan is not chan3

def test_manager_max_channels():
    FileSystemChannelManager._max_channels = 2
    FileSystemChannelManager.get_channel("c1")
    FileSystemChannelManager.get_channel("c2")
    FileSystemChannelManager.get_channel("c3")
    
    assert "c3" in FileSystemChannelManager._channels
    assert "c2" in FileSystemChannelManager._channels
    assert "c1" not in FileSystemChannelManager._channels
    FileSystemChannelManager._max_channels = 100

@patch("backend.database.db.get_all_chats")
def test_manager_cleanup_stale_channels(mock_get_all_chats):
    mock_get_all_chats.return_value = [{"id": "active1"}]
    
    FileSystemChannelManager.get_channel("active1")
    FileSystemChannelManager.get_channel("stale1")
    
    FileSystemChannelManager.cleanup_stale_channels()
    
    assert "active1" in FileSystemChannelManager._channels
    assert "stale1" not in FileSystemChannelManager._channels

@patch("backend.database.db.get_all_chats", side_effect=Exception("DB Error"))
def test_manager_cleanup_stale_channels_error(mock_get_all_chats):
    FileSystemChannelManager.get_channel("active1")
    FileSystemChannelManager.cleanup_stale_channels()
    # Should not raise exception
    assert "active1" in FileSystemChannelManager._channels

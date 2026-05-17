import pytest
import time
from unittest.mock import MagicMock, patch
from backend.task_manager.manager import TaskManager

@pytest.fixture
def mock_worker_class():
    with patch("backend.task_manager.manager.TaskWorker") as mock_worker:
        yield mock_worker

@pytest.fixture
def manager(mock_worker_class):
    # disable cleanup thread by mocking it
    with patch("threading.Thread") as mock_thread:
        mgr = TaskManager()
        yield mgr

def test_init():
    with patch("threading.Thread") as mock_thread:
        mgr = TaskManager()
        assert mgr._active_tasks == {}
        assert isinstance(mgr.interrupted_tasks, set)
        assert mgr._cleanup_running is True
        mock_thread.assert_called_once()

def test_start_task(manager, mock_worker_class):
    def dummy_fn(): pass
    
    # Task not running
    res = manager.start_task("chat1", dummy_fn)
    assert res is True
    mock_worker_class.assert_called_once()
    mock_worker_instance = mock_worker_class.return_value
    mock_worker_instance.start.assert_called_once()
    assert "chat1" in manager._active_tasks

    # Task already running
    mock_worker_instance.is_alive.return_value = True
    res2 = manager.start_task("chat1", dummy_fn)
    assert res2 is False

    # Task not alive but in dict -> should pop
    mock_worker_instance.is_alive.return_value = False
    res3 = manager.start_task("chat1", dummy_fn)
    assert res3 is True

def test_start_task_removes_from_interrupted(manager, mock_worker_class):
    manager.interrupted_tasks.add("chat1")
    manager.start_task("chat1", lambda: None)
    assert "chat1" not in manager.interrupted_tasks

def test_stop_task(manager):
    worker_mock = MagicMock()
    manager._active_tasks["chat1"] = worker_mock
    manager.stop_task("chat1")
    assert "chat1" in manager.interrupted_tasks
    worker_mock.stop.assert_called_once()

def test_is_task_running(manager):
    worker_mock = MagicMock()
    worker_mock.is_alive.return_value = True
    manager._active_tasks["chat1"] = worker_mock
    assert manager.is_task_running("chat1") is True
    
    worker_mock.is_alive.return_value = False
    assert manager.is_task_running("chat1") is False
    
    assert manager.is_task_running("chat2") is False

def test_pop_task(manager):
    manager._active_tasks["chat1"] = "worker"
    manager.pop_task("chat1")
    assert "chat1" not in manager._active_tasks

def test_is_interrupted(manager):
    manager.interrupted_tasks.add("chat1")
    assert manager.is_interrupted("chat1") is True
    assert manager.is_interrupted("chat2") is False

def test_run_cache_cleanup(manager):
    manager._cleanup_running = False # To stop it immediately if we call it
    
    # Test one iteration manually
    manager._cleanup_running = True
    manager._active_tasks["chat1"] = MagicMock()
    
    def side_effect(*args, **kwargs):
        manager._cleanup_running = False
        
    with patch("backend.task_manager.manager.cache_system") as mock_cache_system, \
         patch("time.sleep", side_effect=side_effect), \
         patch("backend.file_system.channel.FileSystemChannelManager.cleanup_stale_channels") as mock_stale:
        manager._run_cache_cleanup()
        mock_cache_system.cleanup_expired.assert_called_once_with(active_chat_ids={"chat1"})
        mock_stale.assert_called_once()

def test_run_cache_cleanup_exception(manager):
    manager._cleanup_running = True
    def side_effect(*args, **kwargs):
        manager._cleanup_running = False
    
    with patch("backend.task_manager.manager.cache_system.cleanup_expired", side_effect=Exception("error")), \
         patch("backend.task_manager.manager.logger.error") as mock_logger, \
         patch("time.sleep", side_effect=side_effect):
        manager._run_cache_cleanup()
        mock_logger.assert_called_with("Cache cleanup error: error")

def test_run_cache_cleanup_fs_channel_exception(manager):
    manager._cleanup_running = True
    def side_effect(*args, **kwargs):
        manager._cleanup_running = False
    
    with patch("backend.task_manager.manager.cache_system.cleanup_expired"), \
         patch("backend.file_system.channel.FileSystemChannelManager.cleanup_stale_channels", side_effect=Exception("fs error")), \
         patch("backend.task_manager.manager.logger.error") as mock_logger, \
         patch("time.sleep", side_effect=side_effect):
        manager._run_cache_cleanup()
        mock_logger.assert_called_with("FileSystem channel cleanup error: fs error")

def test_recover_tasks():
    with patch("threading.Thread"), \
         patch("os.path.exists", return_value=True), \
         patch("os.listdir", return_value=["task1.json"]), \
         patch("builtins.open") as mock_open, \
         patch("json.load", return_value={"status": "running", "chat_id": "task1"}), \
         patch("json.dump") as mock_dump:
        
        mgr = TaskManager()
        mgr.recover_tasks()
        mock_dump.assert_called_once()
        args, _ = mock_dump.call_args
        assert args[0]["status"] == "needs_resume"

def test_recover_tasks_no_dir():
    with patch("threading.Thread"), \
         patch("os.path.exists", return_value=False):
        mgr = TaskManager()
        mgr.recover_tasks() # Should return early
        
def test_recover_tasks_exception():
    with patch("threading.Thread"), \
         patch("os.path.exists", return_value=True), \
         patch("os.listdir", return_value=["task1.json"]), \
         patch("builtins.open", side_effect=Exception("error")), \
         patch("os.remove") as mock_remove:
        
        mgr = TaskManager()
        mgr.recover_tasks()
        mock_remove.assert_called_once()

def test_recover_tasks_ignore_non_json():
    with patch("threading.Thread"), \
         patch("os.path.exists", return_value=True), \
         patch("os.listdir", return_value=["task1.txt"]):
        
        mgr = TaskManager()
        with patch("builtins.open") as mock_open:
            mgr.recover_tasks()
            mock_open.assert_not_called()

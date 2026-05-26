import pytest
import json
from unittest.mock import MagicMock, patch
from backend.tools.tasks import manage_task_list

@pytest.fixture
def mock_db():
    with patch('backend.tools.tasks.db') as mock:
        yield mock

def test_manage_task_list_initialize(mock_db):
    mock_db.get_task_list.return_value = []
    
    res = manage_task_list(
        action="initialize",
        items=["Task 1", "Task 2"],
        chat_id="chat1",
        parent_message_id="msg1"
    )
    
    tasks = json.loads(res)
    assert len(tasks) == 2
    assert tasks[0]["description"] == "Task 1"
    assert tasks[0]["id"] == 1
    assert tasks[0]["status"] == "TODO"
    
    mock_db.set_task_list.assert_called_once_with("chat1", tasks, parent_id="msg1", parent_type="main")

def test_manage_task_list_add_step(mock_db):
    mock_db.get_task_list.return_value = [{"id": 1, "description": "T1", "status": "DONE"}]
    
    res = manage_task_list(
        action="add_step",
        items=["T2"],
        chat_id="chat1",
        parent_message_id="msg1"
    )
    
    tasks = json.loads(res)
    assert len(tasks) == 2
    assert tasks[1]["id"] == 2
    assert tasks[1]["description"] == "T2"

def test_manage_task_list_update_status(mock_db):
    mock_db.get_task_list.return_value = [{"id": 1, "description": "T1", "status": "TODO"}]
    
    res = manage_task_list(
        action="update_status",
        step_id=1,
        status="DONE",
        notes="Finishing up",
        chat_id="chat1",
        parent_message_id="msg1"
    )
    
    tasks = json.loads(res)
    assert tasks[0]["status"] == "DONE"
    assert tasks[0]["notes"] == "Finishing up"

def test_manage_task_list_view(mock_db):
    mock_db.get_task_list.return_value = [{"id": 1, "description": "T1"}]
    
    res = manage_task_list(action="view", chat_id="chat1", parent_message_id="msg1")
    tasks = json.loads(res)
    assert tasks[0]["id"] == 1

def test_manage_task_list_invalid_action(mock_db):
    res = manage_task_list(action="invalid", chat_id="chat1")
    assert "Error: Unknown action" in res

def test_manage_task_list_anchor_fallback(mock_db):
    # Verify it uses turn_anchor_id if provided
    mock_db.get_task_list.return_value = []
    manage_task_list(action="view", chat_id="c", parent_message_id="p", turn_anchor_id="anchor")
    mock_db.get_task_list.assert_called_with("c", parent_id="anchor", parent_type="main")

def test_manage_task_list_db_error(mock_db):
    mock_db.get_task_list.side_effect = Exception("DB Connection Lost")
    res = manage_task_list(action="view", chat_id="c", parent_message_id="p")
    data = json.loads(res)
    assert "Failed to manage task list: DB Connection Lost" in data["error"]

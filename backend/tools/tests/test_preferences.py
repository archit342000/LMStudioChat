import pytest
from unittest.mock import MagicMock, patch
from backend.tools.preferences import manage_user_preferences

@pytest.fixture
def mock_db():
    with patch('backend.tools.preferences.db') as mock:
        yield mock

def test_manage_user_preferences_add(mock_db):
    mock_db.add_preference.return_value = "id12345678"
    mock_db.get_all_preferences.return_value = [{"id": "id123", "tag": "personal_info", "content": "Likes cats"}]
    
    res = manage_user_preferences(additions=[{"content": "Likes cats", "tag": "personal_info"}])
    
    assert "Added preference [id123456]" in res
    assert "Likes cats" in res
    mock_db.add_preference.assert_called_once_with("Likes cats", "personal_info")

def test_manage_user_preferences_edit_delete(mock_db):
    mock_db.update_preference.return_value = True
    mock_db.delete_preference.return_value = True
    mock_db.get_all_preferences.return_value = []
    
    res = manage_user_preferences(
        edits=[{"id": "id1", "content": "New content", "tag": "other"}],
        deletions=["id2"]
    )
    
    assert "Updated preference [id1]: OK" in res
    assert "Deleted preference [id2]: OK" in res
    mock_db.update_preference.assert_called_once_with("id1", "New content", "other")
    mock_db.delete_preference.assert_called_once_with("id2")

def test_manage_user_preferences_not_found(mock_db):
    mock_db.update_preference.return_value = False
    mock_db.get_all_preferences.return_value = []
    
    res = manage_user_preferences(edits=[{"id": "missing", "content": "X", "tag": "other"}])
    assert "Updated preference [missing]: NOT FOUND" in res

import pytest
from unittest.mock import MagicMock, patch
from backend.tools.preferences import add_user_preference, edit_user_preference, delete_user_preference

@pytest.fixture
def mock_db():
    with patch('backend.tools.preferences.db') as mock:
        yield mock

def test_add_user_preference(mock_db):
    mock_db.add_preference.return_value = "id12345678"
    mock_db.get_all_preferences.return_value = [{"id": "id12345678", "tag": "personal_info", "content": "Likes cats"}]
    
    res = add_user_preference(content="Likes cats", tag="personal_info")
    
    assert "Added preference [id123456]" in res
    assert "Likes cats" in res
    mock_db.add_preference.assert_called_once_with("Likes cats", "personal_info")

def test_edit_user_preference(mock_db):
    mock_db.update_preference.return_value = True
    mock_db.get_all_preferences.return_value = [{"id": "id1", "tag": "other", "content": "New content"}]
    
    res = edit_user_preference(id="id1", content="New content", tag="other")
    
    assert "Updated preference [id1]: OK" in res
    mock_db.update_preference.assert_called_once_with("id1", "New content", "other")

def test_delete_user_preference(mock_db):
    mock_db.delete_preference.return_value = True
    mock_db.get_all_preferences.return_value = []
    
    res = delete_user_preference(id="id2")
    
    assert "Deleted preference [id2]: OK" in res
    mock_db.delete_preference.assert_called_once_with("id2")

def test_edit_user_preference_not_found(mock_db):
    mock_db.update_preference.return_value = False
    mock_db.get_all_preferences.return_value = []
    
    res = edit_user_preference(id="missing", content="X", tag="other")
    assert "Updated preference [missing]: NOT FOUND" in res

def test_add_user_preference_db_error(mock_db):
    mock_db.add_preference.side_effect = Exception("DB Disk Image Malformed")
    res = add_user_preference(content="Likes cats", tag="personal_info")
    assert "Error: Failed to add user preference: DB Disk Image Malformed" in res


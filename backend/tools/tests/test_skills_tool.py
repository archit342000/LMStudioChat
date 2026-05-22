import pytest
from unittest.mock import patch
from backend.tools.skills_tool import get_skill_details


@pytest.fixture
def mock_db():
    with patch("backend.tools.skills_tool.db") as mock:
        yield mock


def test_get_skill_details_success(mock_db):
    mock_db.get_skill_by_name.return_value = {
        "id": "skill-123",
        "name": "git-helper",
        "description": "Helps with git commands",
        "instructions": "Run git status first.",
    }

    res = get_skill_details("git-helper")
    assert "Successfully loaded skill details for 'git-helper'" in res
    mock_db.get_skill_by_name.assert_called_once_with("git-helper")


def test_get_skill_details_not_found(mock_db):
    mock_db.get_skill_by_name.return_value = None

    res = get_skill_details("unknown-skill")
    assert "Error: Skill 'unknown-skill' not found" in res
    mock_db.get_skill_by_name.assert_called_once_with("unknown-skill")

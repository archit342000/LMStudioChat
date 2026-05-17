import os
import pytest
from unittest.mock import patch
from backend.database import db_wrapper

@pytest.fixture
def temp_db_path(tmp_path):
    return str(tmp_path / "test_wrapper.db")

@pytest.fixture(autouse=True)
def patch_db_path(temp_db_path):
    with patch("backend.database.db_wrapper.DB_PATH", temp_db_path):
        yield temp_db_path

def test_database_wrapper_instantiation():
    # Test __init__ explicitly
    wrapper = db_wrapper.DatabaseWrapper()
    assert wrapper is not None

def test_db_singleton():
    assert isinstance(db_wrapper.db, db_wrapper.DatabaseWrapper)

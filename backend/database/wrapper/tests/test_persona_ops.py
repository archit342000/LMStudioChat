import pytest
from backend.database.wrapper.persona_ops import PersonaOperations
from backend.database.init_db import init_db

class TestDatabaseWrapper(PersonaOperations):
    pass

@pytest.fixture
def temp_db(monkeypatch, tmp_path):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr("backend.database.db_layer.DB_PATH", str(db_path))
    init_db()
    db = TestDatabaseWrapper()
    return db

def test_persona_crud(temp_db):
    # Create
    p1 = temp_db.create_persona("Test 1", "Content 1")
    assert p1["name"] == "Test 1"
    
    p2 = temp_db.create_persona("Test 2", "Content 2", is_default=1)
    assert p2["is_default"] == 1
    
    # Get all
    personas = temp_db.get_all_personas()
    assert len(personas) == 2
    
    # Get default
    default = temp_db.get_default_persona()
    assert default["id"] == p2["id"]
    
    # Update
    success = temp_db.update_persona(p1["id"], "Updated Test 1", "Updated Content", is_default=1)
    assert success
    
    # Check default swapped
    default = temp_db.get_default_persona()
    assert default["id"] == p1["id"]
    
    # Delete
    success = temp_db.delete_persona(p2["id"])
    assert success
    assert len(temp_db.get_all_personas()) == 1

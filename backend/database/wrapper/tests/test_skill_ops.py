import os
import pytest
import tempfile
import shutil
import time
from unittest.mock import patch
from backend.database.init_db import init_db
from backend.database.db_wrapper import DatabaseWrapper

@pytest.fixture(scope="module")
def temp_db():
    tmp_dir = tempfile.mkdtemp()
    db_path = os.path.join(tmp_dir, "test_skills.db")
    with patch("backend.database.db_layer.DB_PATH", db_path), \
         patch("backend.database.init_db.DB_PATH", db_path), \
         patch("backend.database.db_wrapper.DB_PATH", db_path):
        init_db()
        wrapper = DatabaseWrapper()
        yield wrapper
    shutil.rmtree(tmp_dir)

def test_skill_ops(temp_db):
    db = temp_db

    # 1. Test adding a skill
    success = db.add_skill(
        skill_id="skill_1",
        name="write-poem",
        description="Writes amazing short poems",
        instructions="Write a poem of exactly 4 lines."
    )
    assert success is True

    # 2. Test fetching the skill by ID
    skill = db.get_skill("skill_1")
    assert skill is not None
    assert skill["id"] == "skill_1"
    assert skill["name"] == "write-poem"
    assert skill["description"] == "Writes amazing short poems"
    assert skill["instructions"] == "Write a poem of exactly 4 lines."
    assert isinstance(skill["timestamp"], float)

    # 3. Test fetching the skill by name
    skill_by_name = db.get_skill_by_name("write-poem")
    assert skill_by_name is not None
    assert skill_by_name["id"] == "skill_1"

    # 4. Test updating/replacing a skill
    success_update = db.add_skill(
        skill_id="skill_1",
        name="write-poem",
        description="Writes amazing short poems (updated)",
        instructions="Write a poem of exactly 5 lines."
    )
    assert success_update is True
    updated_skill = db.get_skill("skill_1")
    assert updated_skill["description"] == "Writes amazing short poems (updated)"
    assert updated_skill["instructions"] == "Write a poem of exactly 5 lines."

    # 5. Test listing multiple skills
    time.sleep(0.01)  # small pause to ensure chronological timestamp separation
    success_2 = db.add_skill(
        skill_id="skill_2",
        name="code-refactor",
        description="Refactors python scripts",
        instructions="Make python code follow pep8."
    )
    assert success_2 is True

    skills = db.get_all_skills()
    assert len(skills) == 2
    # Ordered by timestamp desc, so newest (skill_2) is first
    assert skills[0]["id"] == "skill_2"
    assert skills[1]["id"] == "skill_1"

    # 6. Test deleting a skill
    success_del = db.delete_skill("skill_1")
    assert success_del is True

    deleted_skill = db.get_skill("skill_1")
    assert deleted_skill is None

    skills_after_del = db.get_all_skills()
    assert len(skills_after_del) == 1
    assert skills_after_del[0]["id"] == "skill_2"

    # 7. Test fetching non-existent skill yields None
    assert db.get_skill("non_existent") is None
    assert db.get_skill_by_name("non_existent") is None

    # 8. Test deleting a non-existent skill is idempotent (succeeds and doesn't crash)
    assert db.delete_skill("non_existent") is True

    # 9. Test strict UNIQUE name constraint enforcement
    # Trying to insert another skill with a DIFFERENT ID but duplicate NAME must raise sqlite3.IntegrityError
    import sqlite3
    with pytest.raises(sqlite3.IntegrityError):
        db.add_skill(
            skill_id="skill_3",
            name="code-refactor",  # duplicate of skill_2's name!
            description="another desc",
            instructions="another instructions"
        )

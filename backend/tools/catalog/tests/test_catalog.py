# backend/tools/catalog/tests/test_catalog.py
import pytest
from backend.tools.catalog import ALL_TOOL_SPECS
from backend.tools.spec import ToolScope

def test_catalog_specs_exist():
    assert len(ALL_TOOL_SPECS) > 0

def test_catalog_specific_tool_counts():
    names = [spec.name for spec in ALL_TOOL_SPECS]
    # "read_uploaded_file" should appear exactly twice (page and lines variants)
    assert names.count("read_uploaded_file") == 2
    
    # All other tool names must be unique
    other_names = [n for n in names if n != "read_uploaded_file"]
    assert len(other_names) == len(set(other_names))

def test_catalog_implementation_paths():
    for spec in ALL_TOOL_SPECS:
        assert spec.implementation
        assert len(spec.implementation.strip()) > 0

def test_catalog_scopes():
    for spec in ALL_TOOL_SPECS:
        # patch_file_system is a special registry-only tool with no scopes
        if spec.name == "patch_file_system":
            continue
        assert len(spec.scopes) > 0
        for scope in spec.scopes:
            assert isinstance(scope, ToolScope)

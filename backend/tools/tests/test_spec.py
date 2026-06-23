# backend/tools/tests/test_spec.py
from backend.tools.spec import ToolSpec, ToolType, ToolScope

def test_tool_spec_openai_schema():
    spec = ToolSpec(
        name="test_tool",
        description="A test tool description.",
        parameters={"type": "object", "properties": {}, "required": []},
        implementation="module.path.func",
        tool_type=ToolType.PURE,
        scopes=(ToolScope.MAIN,),
    )
    schema = spec.to_openai_schema()
    assert schema == {
        "type": "function",
        "function": {
            "name": "test_tool",
            "description": "A test tool description.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    }

def test_tool_spec_registry_entry():
    spec = ToolSpec(
        name="test_tool",
        description="A test tool description.",
        parameters={"type": "object", "properties": {}, "required": []},
        implementation="module.path.func",
        tool_type=ToolType.AGENT,
        scopes=(ToolScope.MAIN,),
    )
    entry = spec.to_registry_entry()
    assert entry == {
        "type": "agent",
        "implementation": "module.path.func",
        "description": "A test tool description."
    }

def test_tool_spec_directives_fallback():
    spec = ToolSpec(
        name="non_existent_tool_name_abc123",
        description="A test tool description.",
        parameters={"type": "object", "properties": {}, "required": []},
        implementation="module.path.func",
    )
    assert spec.directives == ""

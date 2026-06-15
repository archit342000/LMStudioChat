from backend.utils import merge_tool_call_deltas

def test_merge_tool_call_deltas_new_function():
    existing = {}
    delta = {"id": "call_1", "function": {"name": "test_tool", "arguments": '{"a": 1'}}
    merge_tool_call_deltas(existing, delta)
    assert existing == {"id": "call_1", "function": {"name": "test_tool", "arguments": '{"a": 1'}}

def test_merge_tool_call_deltas_accumulate_arguments():
    existing = {"id": "call_1", "function": {"name": "test_tool", "arguments": '{"a": 1'}}
    delta = {"function": {"arguments": ', "b": 2}'}}
    merge_tool_call_deltas(existing, delta)
    assert existing == {"id": "call_1", "function": {"name": "test_tool", "arguments": '{"a": 1, "b": 2}'}}

def test_merge_tool_call_deltas_partial_delta():
    existing = {"id": "call_1", "function": {"name": "test_tool", "arguments": '{"a": 1}'}}
    delta = {"id": "call_1"}
    merge_tool_call_deltas(existing, delta)
    assert existing == {"id": "call_1", "function": {"name": "test_tool", "arguments": '{"a": 1}'}}

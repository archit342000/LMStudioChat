import json
import pytest
from backend.tools.safety import ToolExecutionRecord, extract_tool_records, run_safety_audit

def test_tool_execution_record_classification():
    # Healthy record
    rec_ok = ToolExecutionRecord("browser_click", {"selector": "button"}, "Page clicked successfully", "tc_1")
    assert not rec_ok.is_error

    # Error record
    rec_err = ToolExecutionRecord("browser_click", {"selector": "button"}, "Error: Selector not found", "tc_2")
    assert rec_err.is_error

    # Traceback record
    rec_tb = ToolExecutionRecord("read_file", {"path": "main.py"}, "Traceback (most recent call last):\nFileNotFoundError", "tc_3")
    assert rec_tb.is_error

    # Structured List record (e.g. vision or screenshots)
    rec_list = ToolExecutionRecord("browser_screenshot", {}, [{"type": "text", "text": "Screenshot taken"}], "tc_4")
    assert not rec_list.is_error

    # Structured Dict record
    rec_dict = ToolExecutionRecord("browser_screenshot", {}, {"status": "Error: Failed to capture screenshot"}, "tc_5")
    assert rec_dict.is_error

def test_extract_tool_records():
    history = [
        {
            "role": "assistant",
            "tool_calls": [
                {"id": "call_1", "function": {"name": "browser_navigate", "arguments": '{"url": "https://google.com"}'}}
            ]
        },
        {
            "role": "tool",
            "tool_call_id": "call_1",
            "content": "Navigated successfully"
        },
        {
            "role": "assistant",
            "tool_calls": [
                {"id": "call_2", "function": {"name": "browser_click", "arguments": '{"selector": "button"}'}}
            ]
        },
        {
            "role": "tool",
            "tool_call_id": "call_2",
            "content": "Error: element not found"
        }
    ]

    records = extract_tool_records(history)
    assert len(records) == 2
    
    assert records[0].name == "browser_navigate"
    assert records[0].arguments == {"url": "https://google.com"}
    assert records[0].result == "Navigated successfully"
    assert not records[0].is_error

    assert records[1].name == "browser_click"
    assert records[1].arguments == {"selector": "button"}
    assert records[1].result == "Error: element not found"
    assert records[1].is_error

def test_error_loop_detection():
    # Simulate assistant calling browser_click with selector 'button' twice in a row, both times failing
    history = [
        {
            "role": "assistant",
            "tool_calls": [{"id": "c1", "function": {"name": "browser_click", "arguments": '{"selector": "button"}'}}]
        },
        {
            "role": "tool",
            "tool_call_id": "c1",
            "content": "Error: Selector not found"
        },
        {
            "role": "assistant",
            "tool_calls": [{"id": "c2", "function": {"name": "browser_click", "arguments": '{"selector": "button"}'}}]
        },
        {
            "role": "tool",
            "tool_call_id": "c2",
            "content": "Error: Selector not found"
        }
    ]

    # Stagnation disabled/high, error_threshold=2
    alert = run_safety_audit(history, task_list=[], stagnation_threshold=10, error_threshold=2, tool_threshold=10)
    assert alert is not None
    assert "REPETITIVE ERROR DETECTED" in alert
    assert "browser_click" in alert
    assert "button" in alert

def test_tool_loop_detection():
    # Simulate assistant calling read_file with path 'main.py' thrice in a row, all succeeding
    history = [
        {
            "role": "assistant",
            "tool_calls": [{"id": "c1", "function": {"name": "read_file", "arguments": '{"path": "main.py"}'}}]
        },
        {
            "role": "tool",
            "tool_call_id": "c1",
            "content": "print('hello')"
        },
        {
            "role": "assistant",
            "tool_calls": [{"id": "c2", "function": {"name": "read_file", "arguments": '{"path": "main.py"}'}}]
        },
        {
            "role": "tool",
            "tool_call_id": "c2",
            "content": "print('hello')"
        },
        {
            "role": "assistant",
            "tool_calls": [{"id": "c3", "function": {"name": "read_file", "arguments": '{"path": "main.py"}'}}]
        },
        {
            "role": "tool",
            "tool_call_id": "c3",
            "content": "print('hello')"
        }
    ]

    alert = run_safety_audit(history, task_list=[], stagnation_threshold=10, error_threshold=10, tool_threshold=3)
    assert alert is not None
    assert "DUPLICATE ACTION LOOP DETECTED" in alert
    assert "read_file" in alert
    assert "main.py" in alert

def test_task_stagnation_detection():
    task_list = [{"id": 1, "description": "Download page", "status": "TODO"}]
    
    # 3 turns of assistant doing other things without calling manage_task_list
    history = [
        {
            "role": "assistant",
            "tool_calls": [{"id": "c1", "function": {"name": "browser_navigate", "arguments": '{"url": "https://g.com"}'}}]
        },
        {"role": "tool", "tool_call_id": "c1", "content": "OK"},
        {
            "role": "assistant",
            "tool_calls": [{"id": "c2", "function": {"name": "browser_screenshot", "arguments": "{}"}}]
        },
        {"role": "tool", "tool_call_id": "c2", "content": "screenshot bytes"},
        {
            "role": "assistant",
            "tool_calls": [{"id": "c3", "function": {"name": "read_file", "arguments": '{"path": "x.txt"}'}}]
        },
        {"role": "tool", "tool_call_id": "c3", "content": "text content"}
    ]

    alert = run_safety_audit(history, task_list=task_list, stagnation_threshold=3, error_threshold=10, tool_threshold=10)
    assert alert is not None
    assert "TASK LIST STAGNATION" in alert
    assert "Download page" in alert

def test_no_warning_when_healthy():
    task_list = [{"id": 1, "description": "Step 1", "status": "TODO"}]

    history = [
        {
            "role": "assistant",
            "tool_calls": [{"id": "c1", "function": {"name": "manage_task_list", "arguments": '{"action": "update_status", "step_id": 1, "status": "IN_PROGRESS"}'}}]
        },
        {"role": "tool", "tool_call_id": "c1", "content": "[]"},
        {
            "role": "assistant",
            "tool_calls": [{"id": "c2", "function": {"name": "browser_navigate", "arguments": '{"url": "https://g.com"}'}}]
        },
        {"role": "tool", "tool_call_id": "c2", "content": "OK"}
    ]

    alert = run_safety_audit(history, task_list=task_list, stagnation_threshold=3, error_threshold=2, tool_threshold=3)
    assert alert is None

def test_safety_edge_cases():
    # 1. Dictionary arguments (already parsed)
    history_dict_args = [
        {
            "role": "assistant",
            "tool_calls": [{"id": "c1", "function": {"name": "browser_click", "arguments": {"selector": "button"}}}]
        },
        {"role": "tool", "tool_call_id": "c1", "content": "Error: Selector not found"},
        {
            "role": "assistant",
            "tool_calls": [{"id": "c2", "function": {"name": "browser_click", "arguments": {"selector": "button"}}}]
        },
        {"role": "tool", "tool_call_id": "c2", "content": "Error: Selector not found"}
    ]
    alert = run_safety_audit(history_dict_args, task_list=[], stagnation_threshold=10, error_threshold=2, tool_threshold=10)
    assert alert is not None
    assert "REPETITIVE ERROR DETECTED" in alert

    # 2. Malformed JSON string arguments
    history_malformed_args = [
        {
            "role": "assistant",
            "tool_calls": [{"id": "c1", "function": {"name": "browser_click", "arguments": "{\"selector\": "}}]
        },
        {"role": "tool", "tool_call_id": "c1", "content": "Error: Invalid selector"},
        {
            "role": "assistant",
            "tool_calls": [{"id": "c2", "function": {"name": "browser_click", "arguments": "{\"selector\": "}}]
        },
        {"role": "tool", "tool_call_id": "c2", "content": "Error: Invalid selector"}
    ]
    alert = run_safety_audit(history_malformed_args, task_list=[], stagnation_threshold=10, error_threshold=2, tool_threshold=10)
    assert alert is not None
    assert "REPETITIVE ERROR DETECTED" in alert

    # 3. Empty task list stagnation bypass
    history_stagnation = [
        {
            "role": "assistant",
            "tool_calls": [{"id": "c1", "function": {"name": "browser_navigate", "arguments": '{"url": "https://g.com"}'}}]
        },
        {"role": "tool", "tool_call_id": "c1", "content": "OK"},
        {
            "role": "assistant",
            "tool_calls": [{"id": "c2", "function": {"name": "browser_screenshot", "arguments": "{}"}}]
        },
        {"role": "tool", "tool_call_id": "c2", "content": "screenshot bytes"},
        {
            "role": "assistant",
            "tool_calls": [{"id": "c3", "function": {"name": "read_file", "arguments": '{"path": "x.txt"}'}}]
        },
        {"role": "tool", "tool_call_id": "c3", "content": "text content"}
    ]
    # Stagnation threshold is 2, but task_list is empty/None
    alert_none = run_safety_audit(history_stagnation, task_list=None, stagnation_threshold=2, error_threshold=10, tool_threshold=10)
    assert alert_none is None
    alert_empty = run_safety_audit(history_stagnation, task_list=[], stagnation_threshold=2, error_threshold=10, tool_threshold=10)
    assert alert_empty is None

    # 4. Interleaved tool execution (no loop)
    history_interleaved = [
        {
            "role": "assistant",
            "tool_calls": [{"id": "c1", "function": {"name": "browser_click", "arguments": '{"selector": "button"}'}}]
        },
        {"role": "tool", "tool_call_id": "c1", "content": "OK"},
        {
            "role": "assistant",
            "tool_calls": [{"id": "c2", "function": {"name": "browser_screenshot", "arguments": "{}"}}]
        },
        {"role": "tool", "tool_call_id": "c2", "content": "OK"},
        {
            "role": "assistant",
            "tool_calls": [{"id": "c3", "function": {"name": "browser_click", "arguments": '{"selector": "button"}'}}]
        },
        {"role": "tool", "tool_call_id": "c3", "content": "OK"}
    ]
    # browser_click is called twice but interleaved with browser_screenshot, so it shouldn't trigger
    alert_interleaved = run_safety_audit(history_interleaved, task_list=[], stagnation_threshold=10, error_threshold=2, tool_threshold=2)
    assert alert_interleaved is None


import os
import json
import pytest
import datetime
from unittest.mock import patch, MagicMock
from backend.logging import logger

@pytest.fixture
def temp_logs(tmp_path):
    with patch('backend.logging.logger.LOG_BASE_DIR', str(tmp_path)), \
         patch('backend.logging.logger.LLM_LOG_DIR', str(tmp_path / "llm_calls")), \
         patch('backend.logging.logger.TOOL_LOG_DIR', str(tmp_path / "tool_calls")), \
         patch('backend.logging.logger.GENERAL_LOG_DIR', str(tmp_path / "general")), \
         patch('backend.logging.logger.APP_LOG_FILE', str(tmp_path / "app.log")):
        
        os.makedirs(str(tmp_path / "llm_calls"), exist_ok=True)
        os.makedirs(str(tmp_path / "tool_calls"), exist_ok=True)
        os.makedirs(str(tmp_path / "general"), exist_ok=True)
        yield tmp_path

def test__get_timestamp():
    ts = logger._get_timestamp()
    assert isinstance(ts, datetime.datetime)

def test__save_log(temp_logs):
    entry = {"key": "value"}
    filename = logger._save_log(str(temp_logs / "general"), entry, prefix="test_")
    assert filename.startswith("test_")
    assert filename.endswith(".json")
    
    filepath = temp_logs / "general" / filename
    assert filepath.exists()
    with open(filepath, "r") as f:
        data = json.load(f)
    assert data == entry

@patch('backend.logging.logger._get_timestamp')
def test_log_llm_call(mock_ts, temp_logs):
    mock_time = datetime.datetime(2023, 1, 1, 12, 0, 0)
    mock_ts.return_value = mock_time
    
    logger.log_llm_call(
        payload={"msg": "hello"},
        response_text="world",
        model="gpt-4",
        chat_id="chat_1",
        duration_s=1.234,
        call_type="stream",
        timings={"p": 1},
        tool_calls=[{"name": "tool1"}]
    )
    
    # Check index
    index_path = temp_logs / "network_index.jsonl"
    assert index_path.exists()
    with open(index_path, "r") as f:
        lines = f.readlines()
    assert len(lines) == 1
    index_entry = json.loads(lines[0])
    assert index_entry["model_tool"] == "gpt-4"
    assert index_entry["chat_id"] == "chat_1"
    
    # Check log file
    log_file_rel = index_entry["log_file"]
    assert log_file_rel.startswith("llm_calls")
    log_file_abs = temp_logs / log_file_rel
    assert log_file_abs.exists()
    with open(log_file_abs, "r") as f:
        log_data = json.load(f)
    assert log_data["duration_s"] == 1.234
    assert log_data["request"] == {"msg": "hello"}
    assert log_data["timings"] == {"p": 1}

@patch('backend.logging.logger._get_timestamp')
def test_log_tool_call(mock_ts, temp_logs):
    mock_time = datetime.datetime(2023, 1, 1, 12, 0, 0)
    mock_ts.return_value = mock_time
    
    logger.log_tool_call(
        tool_name="my_tool",
        payload={"arg": 1},
        response_data="result",
        duration_s=2.0,
        chat_id="chat_2"
    )
    
    index_path = temp_logs / "network_index.jsonl"
    with open(index_path, "r") as f:
        lines = f.readlines()
    assert len(lines) == 1
    index_entry = json.loads(lines[0])
    assert index_entry["model_tool"] == "my_tool"
    assert index_entry["category"] == "tool"
    
    log_file_abs = temp_logs / index_entry["log_file"]
    with open(log_file_abs, "r") as f:
        log_data = json.load(f)
    assert log_data["response"] == "result"

@patch('backend.logging.logger._get_timestamp')
def test_log_embedding_call(mock_ts, temp_logs):
    mock_time = datetime.datetime(2023, 1, 1, 12, 0, 0)
    mock_ts.return_value = mock_time
    
    logger.log_embedding_call(
        payload="text to embed",
        response_data={"count": 1},
        model="embed-model",
        chat_id="chat_3",
        duration_s=0.5
    )
    
    index_path = temp_logs / "network_index.jsonl"
    with open(index_path, "r") as f:
        lines = f.readlines()
    index_entry = json.loads(lines[0])
    assert index_entry["category"] == "embedding"
    assert index_entry["model_tool"] == "embed-model"
    
    log_file_abs = temp_logs / index_entry["log_file"]
    with open(log_file_abs, "r") as f:
        log_data = json.load(f)
    assert log_data["request"] == "text to embed"

@patch('backend.logging.logger._get_timestamp')
def test_log_event(mock_ts, temp_logs):
    mock_time = datetime.datetime(2023, 1, 1, 12, 0, 0)
    mock_ts.return_value = mock_time
    
    logger.log_event("TEST_EVENT", {"info": "data"})
    
    filename = mock_time.strftime('%Y%m%d') + "_events.jsonl"
    filepath = temp_logs / "general" / filename
    assert filepath.exists()
    
    with open(filepath, "r") as f:
        lines = f.readlines()
    assert len(lines) == 1
    event_data = json.loads(lines[0])
    assert event_data["type"] == "TEST_EVENT"
    assert event_data["data"] == {"info": "data"}

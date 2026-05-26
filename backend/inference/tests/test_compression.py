import pytest
import json
from unittest.mock import patch, MagicMock
from backend.inference.compression import check_and_trigger_compression


@pytest.mark.anyio
@patch("backend.inference.compression.get_model_metadata")
@patch("backend.inference.compression.db")
@patch("backend.inference.compression.count_chat_tokens")
async def test_compression_no_trigger_low_occupancy(mock_count_tokens, mock_db, mock_get_meta):
    mock_count_tokens.return_value = 10

    # Mock metadata: 1M tokens window
    mock_get_meta.return_value = {"context_window": 1000000}
    mock_db.get_chat.return_value = {"id": "chat_1", "history_compression": None}

    messages = [
        {"role": "system", "content": "You are AI"},
        {"role": "user", "content": "Hello", "id": 1},
        {"role": "assistant", "content": "Hi", "id": 2},
    ]

    # Under 80% occupancy (1M tokens window, message tokens are tiny)
    result = await check_and_trigger_compression(
        chat_id="chat_1", messages=messages, model="test-model", max_tokens=1000
    )
    assert len(result) == 3
    assert result == messages
    mock_db.update_chat.assert_not_called()


@pytest.mark.anyio
@patch("backend.inference.compression.get_model_metadata")
@patch("backend.inference.compression.db")
@patch("backend.inference.compression.count_chat_tokens")
async def test_compression_existing_cache_sliced(mock_count_tokens, mock_db, mock_get_meta):
    mock_count_tokens.return_value = 10

    mock_get_meta.return_value = {"context_window": 1000}
    # Existing cached compression data up to message 2
    comp_data = {
        "boundary_message_id": 2,
        "summary_text": "Previous summary.",
        "file_notes": "File notes.",
        "images": [],
    }
    mock_db.get_chat.return_value = {
        "id": "chat_1",
        "history_compression": json.dumps(comp_data),
    }

    messages = [
        {"role": "system", "content": "System prompt"},
        {"role": "user", "content": "First user msg", "id": 1},
        {"role": "assistant", "content": "First assistant msg", "id": 2},
        {"role": "user", "content": "New user msg", "id": 3},
    ]

    result = await check_and_trigger_compression(
        chat_id="chat_1", messages=messages, model="test-model", max_tokens=100
    )

    # Output should contain: System prompt + Synthetic message + New user message
    assert len(result) == 3
    assert result[0] == messages[0]
    assert result[1]["role"] == "user"
    assert "Previous summary." in result[1]["content"][0]["text"]
    assert "File notes." in result[1]["content"][1]["text"]
    assert result[2] == messages[3]


@pytest.mark.anyio
@patch("backend.inference.compression.get_model_metadata")
@patch("backend.inference.compression.db")
@patch("backend.inference.compression.count_chat_tokens")
@patch("backend.inference.engine.InferenceEngine.chat")
async def test_compression_trigger_generation(
    mock_engine_chat, mock_count_tokens, mock_db, mock_get_meta
):
    # Set context window very small to force compression trigger
    mock_get_meta.return_value = {"context_window": 100}
    mock_db.get_chat.return_value = {"id": "chat_1", "history_compression": None}
    mock_db.get_chat_files.return_value = [
        {"original_filename": "data.csv", "mime_type": "text/csv", "file_size": 200}
    ]

    # Force count_chat_tokens to return large numbers so we exceed 80% of 100
    mock_count_tokens.side_effect = lambda msgs, model: 100 if len(msgs) > 1 else 10

    # Mock summarizer response
    mock_engine_chat.return_value = {
        "choices": [{"message": {"role": "assistant", "content": "Compressed summary text"}}]
    }

    messages = [
        {"role": "system", "content": "System prompt"},
        {"role": "user", "content": "User msg 1", "id": 1},
        {"role": "assistant", "content": "Assistant msg 2", "id": 2},
        {"role": "user", "content": "User msg 3", "id": 3},
        {"role": "assistant", "content": "Assistant msg 4", "id": 4},
        {"role": "user", "content": "User msg 5", "id": 5},
    ]

    result = await check_and_trigger_compression(
        chat_id="chat_1", messages=messages, model="test-model", max_tokens=10
    )

    # Validate that db update_chat was called to cache the new summary
    mock_db.update_chat.assert_called_once()
    args, kwargs = mock_db.update_chat.call_args
    assert args[0] == "chat_1"
    cached_payload = json.loads(kwargs["history_compression"])
    assert cached_payload["summary_text"] == "Compressed summary text"
    assert "data.csv" in cached_payload["file_notes"]

    # Sliced result should have system prompt + synthetic message + post-boundary messages
    assert len(result) < len(messages)
    assert result[0] == messages[0]
    assert result[1]["role"] == "user"
    assert "Compressed summary text" in result[1]["content"][0]["text"]


@pytest.mark.anyio
@patch("backend.inference.compression.get_model_metadata")
@patch("backend.inference.compression.db")
async def test_compression_metadata_failure_graceful(mock_db, mock_get_meta):
    mock_get_meta.side_effect = Exception("Metadata read error")
    messages = [{"role": "user", "content": "hello"}]
    result = await check_and_trigger_compression(
        chat_id="chat_1", messages=messages, model="test-model"
    )
    assert result == messages

@pytest.mark.anyio
@patch("backend.inference.compression.get_model_metadata")
@patch("backend.inference.compression.db")
@patch("backend.inference.compression.count_chat_tokens")
@patch("backend.inference.engine.InferenceEngine.chat")
async def test_compression_summarizer_failure_graceful(
    mock_engine_chat, mock_count_tokens, mock_db, mock_get_meta
):
    # Set context window very small to force compression trigger
    mock_get_meta.return_value = {"context_window": 100}
    mock_db.get_chat.return_value = {"id": "chat_1", "history_compression": None}
    mock_db.get_chat_files.return_value = []

    # Force count_chat_tokens to return large numbers so we exceed 80% of 100
    mock_count_tokens.side_effect = lambda msgs, model: 100 if len(msgs) > 1 else 10

    # Mock summarizer response to throw an exception
    mock_engine_chat.side_effect = Exception("Summarizer connection timeout")

    messages = [
        {"role": "system", "content": "System prompt"},
        {"role": "user", "content": "User msg 1", "id": 1},
        {"role": "assistant", "content": "Assistant msg 2", "id": 2},
    ]

    result = await check_and_trigger_compression(
        chat_id="chat_1", messages=messages, model="test-model", max_tokens=10
    )

    assert result == messages
    mock_db.update_chat.assert_not_called()

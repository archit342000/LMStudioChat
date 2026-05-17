import pytest
from backend.tools.agents.file_system_agent.prompts import FILE_SYSTEM_AGENT_SYSTEM_PROMPT

def test_file_system_agent_prompt():
    """Tests that the file system agent prompt is correctly assembled."""
    prompt = FILE_SYSTEM_AGENT_SYSTEM_PROMPT.format(current_time="2024-01-01", chat_id="test_chat")
    assert "File System Agent" in prompt
    assert "2024-01-01" in prompt
    assert "test_chat" in prompt
    assert "ls_files" in prompt
    assert "Task List" in prompt
    assert "Rules" in prompt

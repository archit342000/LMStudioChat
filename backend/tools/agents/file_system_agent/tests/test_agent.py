import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from backend.tools.agents.file_system_agent.agent import flow_fn
from backend.tools.definitions import FILE_SYSTEM_INTERNAL_TOOLS, MANAGE_TASK_LIST_TOOL

@pytest.fixture
def mock_agent():
    agent = AsyncMock()
    agent.chat_id = "test_chat"
    agent.parent_message_id = "test_parent"
    agent.model = "test-model"
    agent.result = None
    
    async def mock_run_inference(*args, **kwargs):
        yield "chunk1"
        yield "chunk2"
    
    agent.run_inference_step = MagicMock(side_effect=mock_run_inference)
    return agent

@pytest.fixture
def mock_config():
    with patch('backend.config') as mock_conf:
        mock_conf.FILE_SYSTEM_AGENT_MAX_TURNS = 3
        mock_conf.FILE_SYSTEM_AGENT_FAILSAFE_TURNS = 2
        mock_conf.FILE_SYSTEM_AGENT_MAX_TOKENS = 1000
        mock_conf.FILE_SYSTEM_AGENT_THINKING_BUDGET = 100
        yield mock_conf

@pytest.fixture
def mock_db():
    with patch('backend.tools.agents.file_system_agent.agent.db') as db:
        yield db

@pytest.mark.anyio
async def test_flow_fn_first_run(mock_agent, mock_config, mock_db):
    # Setup
    mock_db.get_messages.side_effect = [
        [], # is_resume check
        [], # loop 1 start
        [{"role": "assistant", "content": "summary"}], # loop 1 end
        [{"role": "assistant", "content": "summary"}]  # final check
    ]
    mock_db.get_task_list.return_value = [{"id": "task1"}]

    chunks = [chunk async for chunk in flow_fn(mock_agent, "create a file")]
    assert chunks == ["chunk1", "chunk2"]
    mock_db.add_message.assert_any_call(
        chat_id="test_chat", role='event', content='FileSystem Agent Started.',
        parent_id="test_parent", parent_type='file_system_agent'
    )
    args, kwargs = mock_agent.run_inference_step.call_args
    assert kwargs["tools"] == FILE_SYSTEM_INTERNAL_TOOLS
    assert mock_agent.result == "summary"

@pytest.mark.anyio
async def test_flow_fn_resume(mock_agent, mock_config, mock_db):
    mock_db.get_messages.side_effect = [
        [{"role": "assistant"}], # is_resume
        [{"role": "assistant"}], # loop 1 start
        [{"role": "assistant", "content": "done"}], # loop 1 end
        [{"role": "assistant", "content": "done"}]  # final check
    ]
    mock_db.get_task_list.return_value = [{"id": "task1"}]

    chunks = [chunk async for chunk in flow_fn(mock_agent, "instruction")]
    assert not any("FileSystem Agent Started." in str(c) for c in mock_db.add_message.mock_calls)

@pytest.mark.anyio
async def test_flow_fn_no_task_list_planning_enforcement(mock_agent, mock_config, mock_db):
    mock_db.get_messages.side_effect = [
        [], # is_resume
        [], # loop 1 start (planning)
        [{"role": "assistant", "content": "planned", "tool_calls": [{"name": "manage_task_list"}]}], # loop 1 end
        [{"role": "assistant", "content": "planned"}], # loop 2 start
        [{"role": "assistant", "content": "summary"}], # loop 2 end
        [{"role": "assistant", "content": "summary"}]  # final check
    ]
    mock_db.get_task_list.side_effect = [[], [{"id": "t1"}], [{"id": "t1"}], [{"id": "t1"}], [{"id": "t1"}]]

    chunks = [chunk async for chunk in flow_fn(mock_agent, "instruction")]
    args, kwargs = mock_agent.run_inference_step.call_args_list[0]
    assert kwargs["tools"] == [MANAGE_TASK_LIST_TOOL]

@pytest.mark.anyio
async def test_flow_fn_fails_to_init_task_list(mock_agent, mock_config, mock_db):
    mock_db.get_messages.side_effect = [
        [], # is_resume
        [], # loop 1 start
        [{"role": "assistant", "content": "failed"}], # loop 1 end
        [], # force break by returning empty
        [], [] # padding
    ]
    mock_db.get_task_list.return_value = [] # Always empty

    chunks = [chunk async for chunk in flow_fn(mock_agent, "instruction")]
    
    mock_db.add_message.assert_any_call(
        chat_id="test_chat", role='user',
        content='System Constraint: You MUST initialize your task list using manage_task_list before taking ANY other actions or responding.',
        parent_id="test_parent", parent_type='file_system_agent'
    )

@pytest.mark.anyio
async def test_flow_fn_turn_limit(mock_agent, mock_config, mock_db):
    mock_config.FILE_SYSTEM_AGENT_MAX_TURNS = 1
    history = [{"role": "tool", "name": "replace_fs_text", "content": "ok"}]
    mock_db.get_messages.side_effect = [
        [], # is_resume
        history, # loop 1 start (limit hit, warn)
        history + [{"role": "user", "content": "[SYSTEM: TURN LIMIT REACHED]"}], # loop 2 start (already warned)
        [{"role": "assistant", "content": "final synthesis"}], # loop 2 end
        [{"role": "assistant", "content": "final synthesis"}]  # final check
    ]
    mock_db.get_task_list.return_value = [{"id": "t1"}]

    chunks = [chunk async for chunk in flow_fn(mock_agent, "instruction")]
    mock_db.add_message.assert_any_call(
        chat_id="test_chat", role='user',
        content='[SYSTEM: TURN LIMIT REACHED] You have exhausted your allowed file system operations. You must immediately summarize your findings based on the operations completed so far. Do not attempt any further file system changes.',
        parent_id="test_parent", parent_type='file_system_agent'
    )

@pytest.mark.anyio
async def test_flow_fn_failsafe(mock_agent, mock_config, mock_db):
    mock_config.FILE_SYSTEM_AGENT_MAX_TURNS = 1
    mock_config.FILE_SYSTEM_AGENT_FAILSAFE_TURNS = 1
    mock_db.get_messages.return_value = [{"role": "assistant", "content": "", "tool_calls": [{"name": "fake"}]}]
    mock_db.get_task_list.return_value = [{"id": "t1"}]

    chunks = [chunk async for chunk in flow_fn(mock_agent, "instruction")]
    assert any("FileSystem Agent Force Terminated" in str(c) for c in mock_db.add_message.mock_calls)
    assert mock_agent.result == "Operation forcibly terminated due to infinite loop."

@pytest.mark.anyio
async def test_flow_fn_empty_history_break(mock_agent, mock_config, mock_db):
    mock_db.get_messages.side_effect = [
        [], # is_resume check
        [], # loop 1 start
        []  # loop 1 post-inference check -> break
    ]
    mock_db.get_task_list.return_value = [{"id": "t1"}]
    chunks = [chunk async for chunk in flow_fn(mock_agent, "instruction")]
    assert chunks == ["chunk1", "chunk2"]

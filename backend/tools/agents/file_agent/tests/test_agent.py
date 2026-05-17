import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json
from backend.tools.agents.file_agent.agent import is_vision_model, flow_fn

# Testing is_vision_model
def test_is_vision_model_true():
    with patch('backend.tools.agents.file_agent.agent.load_model_config', return_value={
        'research': {'vision': 'model-vision-1'},
        'general': {'vision': 'model-vision-2', 'vision2': 'model-vision-3'}
    }):
        assert is_vision_model('model-vision-2') is True
        assert is_vision_model('model-vision-1') is True
        assert is_vision_model('non-vision') is False

def test_is_vision_model_exception():
    with patch('backend.tools.agents.file_agent.agent.load_model_config', side_effect=Exception("Error")):
        assert is_vision_model('model-vision-2') is False

# Testing flow_fn
@pytest.fixture
def mock_agent():
    agent = MagicMock()
    agent.chat_id = "test_chat"
    agent.parent_message_id = "test_parent"
    agent.model = "test_model"
    agent.result = None
    
    async def mock_inference(*args, **kwargs):
        yield "inference_chunk"
    
    agent.run_inference_step = mock_inference
    return agent

@pytest.mark.anyio
async def test_flow_fn_file_not_found(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'):
        mock_db.get_file.return_value = None
        gen = flow_fn(mock_agent, "file_agent", "missing_id", "query")
        res = [chunk async for chunk in gen]
        assert "Error: File with ID missing_id not found." in res[0]
        assert "not found" in mock_agent.result

@pytest.mark.anyio
async def test_flow_fn_image_no_vision(mock_agent):
    mock_agent.model = "non-vision-model"
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'), \
         patch('backend.tools.agents.file_agent.agent.is_vision_model', return_value=False), \
         patch('backend.tools.agents.file_agent.agent.get_file_agent_tools'):
        mock_db.get_file.return_value = {
            'mime_type': 'image/jpeg',
            'original_filename': 'test.jpg'
        }
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        res = [chunk async for chunk in gen]
        assert any("does not support vision" in r for r in res)

@pytest.mark.anyio
async def test_flow_fn_image_with_vision(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'), \
         patch('backend.tools.agents.file_agent.agent.is_vision_model', return_value=True), \
         patch('backend.tools.agents.file_agent.agent.get_embedding_model'), \
         patch('backend.tools.agents.file_agent.agent.RAGProvider'), \
         patch('backend.tools.agents.file_agent.agent.FileManager') as mock_fm, \
         patch('backend.tools.agents.file_agent.agent.get_file_agent_tools'):
        
        mock_db.get_file.return_value = {
            'mime_type': 'image/jpeg',
            'original_filename': 'test.jpg',
            'stored_filename': 'test_store.jpg'
        }
        mock_fm_instance = mock_fm.return_value
        mock_fm_instance.encode_file_for_vision.return_value = ("base64data", "image/jpeg")
        
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        res = [chunk async for chunk in gen]
        
        assert any("Using vision analysis" in r for r in res)
        assert any("inference_chunk" in r for r in res)

@pytest.mark.anyio
async def test_flow_fn_image_encode_fails(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'), \
         patch('backend.tools.agents.file_agent.agent.is_vision_model', return_value=True), \
         patch('backend.tools.agents.file_agent.agent.get_embedding_model'), \
         patch('backend.tools.agents.file_agent.agent.RAGProvider'), \
         patch('backend.tools.agents.file_agent.agent.FileManager') as mock_fm, \
         patch('backend.tools.agents.file_agent.agent.get_file_agent_tools'):
        
        mock_db.get_file.return_value = {
            'mime_type': 'image/jpeg',
            'original_filename': 'test.jpg',
            'stored_filename': 'test_store.jpg'
        }
        mock_fm_instance = mock_fm.return_value
        mock_fm_instance.encode_file_for_vision.return_value = (None, None)
        
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        res = [chunk async for chunk in gen]
        
        assert any("Failed to encode image" in r for r in res)

@pytest.mark.anyio
async def test_flow_fn_text_autonomous_loop(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'), \
         patch('backend.tools.agents.file_agent.agent.get_file_agent_tools', return_value=[{"function": {"name": "test_tool"}}]), \
         patch('backend.tools.agents.file_agent.agent.config') as mock_config:
         
        mock_config.FILE_AGENT_MAX_TURNS = 5
        mock_config.FILE_AGENT_FAILSAFE_TURNS = 2
        mock_db.get_file.return_value = {
            'mime_type': 'text/plain',
            'original_filename': 'test.txt'
        }
        mock_db.get_messages.return_value = [
            {"role": "assistant", "content": "done"}
        ]
        mock_db.get_task_list.return_value = ["task1"]
        
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        res = [chunk async for chunk in gen]
        
        assert any("Initiating investigation" in r for r in res)
        assert mock_agent.result == "done"

@pytest.mark.anyio
async def test_flow_fn_text_turn_limit_reached(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'), \
         patch('backend.tools.agents.file_agent.agent.get_file_agent_tools', return_value=[{"function": {"name": "test_tool"}}]), \
         patch('backend.tools.agents.file_agent.agent.config') as mock_config:
         
        mock_config.FILE_AGENT_MAX_TURNS = 1
        mock_config.FILE_AGENT_FAILSAFE_TURNS = 2
        mock_db.get_file.return_value = {
            'mime_type': 'text/plain',
            'original_filename': 'test.txt'
        }
        
        msg_history = [
            {"role": "tool", "name": "test_tool", "content": "result"}
        ]
        
        def mock_get_messages(*args, **kwargs):
            return list(msg_history)
        
        mock_db.get_messages.side_effect = mock_get_messages
        mock_db.get_task_list.return_value = ["task"]
        
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        def mock_add_message(*args, **kwargs):
            if "TURN LIMIT REACHED" in kwargs.get("content", ""):
                msg_history.append({"role": "user", "content": kwargs["content"]})
                msg_history.append({"role": "assistant", "content": "final synthesis"})
                
        mock_db.add_message.side_effect = mock_add_message
        
        res = [chunk async for chunk in gen]
        assert mock_agent.result == "final synthesis"

@pytest.mark.anyio
async def test_flow_fn_no_task_list(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'), \
         patch('backend.tools.agents.file_agent.agent.get_file_agent_tools', return_value=[{"function": {"name": "test_tool"}}]), \
         patch('backend.tools.agents.file_agent.agent.config') as mock_config:
         
        mock_config.FILE_AGENT_MAX_TURNS = 1
        mock_config.FILE_AGENT_FAILSAFE_TURNS = 1
        mock_db.get_file.return_value = {
            'mime_type': 'text/plain',
            'original_filename': 'test.txt'
        }
        
        msg_history = []
        mock_db.get_messages.side_effect = lambda *args, **kwargs: list(msg_history)
        
        mock_db.get_task_list.side_effect = [[], [], ["task1"], ["task1"]]
        
        def mock_add_message(*args, **kwargs):
            msg_history.append({"role": kwargs.get("role", "user"), "content": kwargs.get("content", "")})
            if "MUST initialize your task list" in kwargs.get("content", ""):
                msg_history.append({"role": "assistant", "content": "ok"})
            
        mock_db.add_message.side_effect = mock_add_message
        
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        res = [chunk async for chunk in gen]
        
        assert mock_agent.result == "ok" or "Error: File agent completed but returned no content." in mock_agent.result

@pytest.mark.anyio
async def test_flow_fn_absolute_limit(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'), \
         patch('backend.tools.agents.file_agent.agent.get_file_agent_tools', return_value=[{"function": {"name": "test_tool"}}]), \
         patch('backend.tools.agents.file_agent.agent.config') as mock_config:
         
        mock_config.FILE_AGENT_MAX_TURNS = 1
        mock_config.FILE_AGENT_FAILSAFE_TURNS = 1
        mock_db.get_file.return_value = {
            'mime_type': 'text/plain',
            'original_filename': 'test.txt'
        }
        
        msg_history = [{"role": "assistant", "content": None, "tool_calls": [{"id": "1"}]}]
        mock_db.get_messages.side_effect = lambda *args, **kwargs: list(msg_history)
        mock_db.get_task_list.return_value = ["task"]
        
        def mock_add_message(*args, **kwargs):
            msg_history.append({"role": kwargs.get("role", "event"), "content": kwargs.get("content", "")})
            
        mock_db.add_message.side_effect = mock_add_message
        
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        res = [chunk async for chunk in gen]
        
        assert any("File Agent Force Terminated" in str(m) for m in msg_history)
        assert mock_agent.result is not None

@pytest.mark.anyio
async def test_flow_fn_exception(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'):
        mock_db.get_file.side_effect = Exception("DB error")
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        res = [chunk async for chunk in gen]
        
        assert "File agent failed: DB error" in mock_agent.result

@pytest.mark.anyio
async def test_flow_fn_pdf_hint(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'), \
         patch('backend.tools.agents.file_agent.agent.get_file_agent_tools', return_value=[]), \
         patch('backend.tools.agents.file_agent.agent.config') as mock_config:
         
        mock_db.get_file.return_value = {
            'mime_type': 'application/pdf',
            'original_filename': 'test.pdf'
        }
        mock_db.get_messages.return_value = [{"role": "assistant", "content": "done"}]
        mock_db.get_task_list.return_value = ["task"]
        
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        res = [chunk async for chunk in gen]
        
        assert any("Initiating investigation" in r for r in res)

@pytest.mark.anyio
async def test_flow_fn_already_warned(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'), \
         patch('backend.tools.agents.file_agent.agent.get_file_agent_tools', return_value=[{"function": {"name": "test_tool"}}]), \
         patch('backend.tools.agents.file_agent.agent.config') as mock_config:
         
        mock_config.FILE_AGENT_MAX_TURNS = 1
        mock_db.get_file.return_value = {
            'mime_type': 'text/plain',
            'original_filename': 'test.txt'
        }
        
        msg_history = [
            {"role": "tool", "name": "test_tool", "content": "res"},
            {"role": "user", "content": "[SYSTEM: TURN LIMIT REACHED]"}
        ]
        mock_db.get_messages.side_effect = lambda *args, **kwargs: list(msg_history)
        mock_db.get_task_list.return_value = ["task"]
        
        captured_tools = []
        async def mock_inf(*args, **kwargs):
            captured_tools.append(kwargs.get("tools"))
            yield "done"
            msg_history.append({"role": "assistant", "content": "done"})
            
        mock_agent.run_inference_step = mock_inf
        
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        res = [chunk async for chunk in gen]
        
        assert [] in captured_tools

@pytest.mark.anyio
async def test_flow_fn_no_history_break(mock_agent):
    with patch('backend.tools.agents.file_agent.agent.db') as mock_db, \
         patch('backend.tools.agents.file_agent.agent.log_tool_call'), \
         patch('backend.tools.agents.file_agent.agent.get_file_agent_tools', return_value=[]):
         
        mock_db.get_file.return_value = {
            'mime_type': 'text/plain',
            'original_filename': 'test.txt'
        }
        mock_db.get_messages.side_effect = [[], [], [], []] 
        
        gen = flow_fn(mock_agent, "file_agent", "file_id", "query")
        res = [chunk async for chunk in gen]
        
        assert mock_agent.result == "Error: File agent completed but returned no content."

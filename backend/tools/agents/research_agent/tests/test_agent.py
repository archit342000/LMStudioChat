import sys
from unittest.mock import MagicMock, AsyncMock, patch

import pytest
import json
import httpx
import asyncio
from backend.tools.agents.research_agent.agent import ResearchAgent, flow_fn, SectionState
import backend.tools.agents.research_agent.agent as agent_mod
from backend.tools.agents.research_agent.constants import (
    EVENT_INITIAL_SEARCHES_DONE, EVENT_REFLECTION_DONE, 
    EVENT_GAP_SEARCHES_DONE, EVENT_TRIAGE_DONE, 
    EVENT_WRITER_DONE, EVENT_SUMMARY_DONE,
    EVENT_SECTION_PREFIX, EVENT_SECTION_COMPLETE_SUFFIX
)

@pytest.fixture
def mock_agent_context():
    agent = MagicMock()
    agent.chat_id = "test_chat"
    agent.parent_message_id = 123
    agent.model = "test-model"
    return agent

@pytest.fixture
def research_agent(mock_agent_context):
    with patch.object(agent_mod, 'config') as mock_config:
        mock_config.RESEARCH_MAX_GAPS_PER_SECTION = 3
        mock_config.RESEARCH_MAX_SECTION_STALLS = 2
        mock_config.RESEARCH_SEARCH_RETRIES = 1
        mock_config.RESEARCH_JSON_RETRIES = 2
        mock_config.RESEARCH_MAX_RETRIES = 2
        mock_config.RESEARCH_MAX_TOKENS_AUDIT = 1000
        mock_config.RESEARCH_THINKING_BUDGET_AUDIT_TOKENS = 100
        mock_config.RESEARCH_EXTRACT_MIN_RAW_CONTENT = 10
        mock_config.RESEARCH_SEARCH_TIMEOUT = 10
        
        return ResearchAgent(
            chat_id=mock_agent_context.chat_id,
            parent_message_id=mock_agent_context.parent_message_id,
            enable_thinking=True,
            model=mock_agent_context.model
        )

def test_research_agent_init(research_agent):
    assert research_agent.chat_id == "test_chat"
    assert research_agent.model == "test-model"

def test_parse_section_state_resumption(research_agent):
    state = SectionState(2)
    prefix = "[Section 2] "
    history = [
        {"role": "event", "content": f"{prefix}{EVENT_INITIAL_SEARCHES_DONE}"},
        {"role": "event", "content": f"{prefix}{EVENT_REFLECTION_DONE}"}
    ]
    research_agent._parse_section_state(history, state)
    assert state.has_initial_search is True
    assert state.has_reflection is True

def test_get_assistant_output_for_phase(research_agent):
    history = [
        {"role": "assistant", "content": "Actual Output"},
        {"role": "event", "content": "Phase Completed"}
    ]
    res = research_agent._get_assistant_output_for_phase(history, "Phase Completed")
    assert res["content"] == "Actual Output"

@pytest.mark.anyio
async def test_build_continuous_context_filtering(research_agent):
    plan = {"title": "Topic Title", "sections": [{"heading": "S1", "queries": []}]}
    sections = plan["sections"]
    
    with patch.object(agent_mod, 'db') as mock_db:
        mock_db.get_collections.return_value = []
        msgs = research_agent._build_continuous_context(
            current_idx=0,
            current_section=sections[0],
            plan=plan,
            sections=sections,
            accumulated_summaries_text="Prev Summary",
            section_history=[],
            target_phase="Reflection"
        )
        assert len(msgs) == 2
        assert "Research Executor Agent" in msgs[0]["content"]

@pytest.mark.anyio
async def test_run_json_inference_retry_logic(research_agent):
    """Tests that _run_json_inference retries on failure and succeeds on the second attempt.
    The method now calls _extract_json_from_text as a module-level function (not a method)."""
    agent = MagicMock()

    # Simulate two inference runs: first yields empty, second yields valid JSON
    call_count = 0
    async def mock_gen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        yield "chunk"

    agent.run_inference_step.side_effect = mock_gen

    with patch.object(agent_mod, 'config') as mock_config, \
         patch.object(agent_mod, 'db') as mock_db, \
         patch.object(agent_mod, '_extract_json_from_text') as mock_extract:
        mock_config.RESEARCH_MAX_RETRIES = 2
        
        # First attempt: extract returns None (invalid), second: returns valid JSON
        mock_extract.side_effect = [None, {"valid": "json"}]
        mock_db.get_messages.return_value = [{"role": "assistant", "content": "some output"}]
        
        # Patch _emit_event to be a no-op async generator
        async def noop_emit(*args, **kwargs):
            return
            yield  # make it an async generator
        research_agent._emit_event = noop_emit
        
        gen = research_agent._run_json_inference(
            agent=agent,
            messages=[],
            phase_name="test",
            schema={},
            max_tokens=1000,
            thinking_budget=100
        )
        results = []
        async for item in gen:
            results.append(item)
        
        assert agent.run_inference_step.call_count == 2
        # The last result should be the parsed JSON
        assert any(isinstance(r, dict) and r.get("type") == "test_result" for r in results)

@pytest.mark.anyio
async def test_run_executor_sequential_logic(research_agent):
    """Tests that _run_executor skips completed sections and runs pending ones."""
    sections = [{"heading": "S1"}, {"heading": "S2"}]
    plan = {"title": "Test Plan", "sections": sections}
    
    with patch.object(agent_mod, 'db') as mock_db:
        # Section 0 is already complete (event marker present)
        mock_db.get_messages.return_value = [
            {"role": "event", "content": f"{EVENT_SECTION_PREFIX}0{EVENT_SECTION_COMPLETE_SUFFIX}"}
        ]
        mock_db.get_collections.return_value = [{"collection_type": "report_file_system_id", "items": '"fs_123"'}]
        
        # Make _run_single_section an async generator
        async def mock_section(*args, **kwargs):
            return
            yield  # async generator
        research_agent._run_single_section = mock_section
        
        # After one iteration, mark section 1 as complete too to break the loop
        call_idx = [0]
        def get_messages_side_effect(*args, **kwargs):
            call_idx[0] += 1
            if call_idx[0] >= 2:
                return [
                    {"role": "event", "content": f"{EVENT_SECTION_PREFIX}0{EVENT_SECTION_COMPLETE_SUFFIX}"},
                    {"role": "event", "content": f"{EVENT_SECTION_PREFIX}1{EVENT_SECTION_COMPLETE_SUFFIX}"},
                ]
            return [
                {"role": "event", "content": f"{EVENT_SECTION_PREFIX}0{EVENT_SECTION_COMPLETE_SUFFIX}"}
            ]
        mock_db.get_messages.side_effect = get_messages_side_effect
        mock_db.get_collections.return_value = [
            {"collection_type": "report_file_system_id", "items": '"fs_123"'}
        ]

        # Patch _emit_event
        async def noop_emit(*args, **kwargs):
            yield "event"
        research_agent._emit_event = noop_emit
        
        gen = research_agent._run_executor(plan, MagicMock())
        async for _ in gen: pass

@pytest.mark.anyio
async def test_run_executor_stall_detection(research_agent):
    """Tests that _run_executor detects stalled sections and raises RuntimeError."""
    plan = {"title": "Test Plan", "sections": [{"heading": "S1"}]}
    with patch.object(agent_mod, 'db') as mock_db, \
         patch.object(agent_mod, 'config') as mock_config:
        mock_config.RESEARCH_MAX_SECTION_STALLS = 2
        
        # Section 0 never completes (always pending)
        mock_db.get_messages.return_value = []
        mock_db.get_collections.return_value = [
            {"collection_type": "report_file_system_id", "items": '"fs_123"'}
        ]

        # _run_single_section does nothing (doesn't complete the section)
        async def mock_section(*args, **kwargs):
            return
            yield  # async generator
        research_agent._run_single_section = mock_section
        
        # Patch _emit_event
        async def noop_emit(*args, **kwargs):
            yield "event"
        research_agent._emit_event = noop_emit
        
        with pytest.raises(RuntimeError, match="stalled repeatedly"):
            gen = research_agent._run_executor(plan, MagicMock())
            async for _ in gen: pass

@pytest.mark.anyio
async def test_execute_internal_searches_all_fail(research_agent):
    """Tests that _execute_internal_searches raises RuntimeError when ALL queries fail
    and no content was gathered."""
    with patch.object(agent_mod, '_execute_mcp_tool') as mock_tool, \
         patch.object(agent_mod, 'db') as mock_db:
        mock_db.get_collections.return_value = []
        
        # All searches fail
        mock_tool.side_effect = Exception("Fail")
        
        # Patch the tavily_client connect
        with patch('backend.mcp_client.tavily_client', new_callable=AsyncMock) as mock_tavily:
            mock_tavily.connect = AsyncMock()
            
            with pytest.raises(RuntimeError, match="All searches failed"):
                await research_agent._execute_internal_searches([{"query": "q1"}])

@pytest.mark.anyio
async def test_execute_internal_searches_partial_success(research_agent):
    """Tests that _execute_internal_searches succeeds when at least one query returns data,
    even if others fail."""
    with patch.object(agent_mod, '_execute_mcp_tool') as mock_tool, \
         patch.object(agent_mod, 'db') as mock_db, \
         patch.object(agent_mod, 'config') as mock_config:
        mock_config.RESEARCH_SELECT_TOP_URLS_COUNT = 5
        mock_config.RESEARCH_EXTRACT_MIN_RAW_CONTENT = 10
        mock_config.RESEARCH_TAVILY_MAX_RESULTS_INITIAL = 5
        mock_config.RESEARCH_CONTENT_CHUNK_LIMIT = 5000
        mock_config.TIMEOUT_TAVILY_SEARCH_ASYNC = 60
        mock_db.get_collections.return_value = []

        mock_res = MagicMock()
        mock_res.content = [MagicMock(text=json.dumps({
            "results": [{"url": "https://example.com", "raw_content": "A" * 100}]
        }))]
        
        # First query fails, second succeeds
        mock_tool.side_effect = [Exception("Fail"), mock_res]

        with patch('backend.mcp_client.tavily_client', new_callable=AsyncMock) as mock_tavily:
            mock_tavily.connect = AsyncMock()

            result = await research_agent._execute_internal_searches(
                [{"query": "q1"}, {"query": "q2"}]
            )
            assert "example.com" in result

# backend/tools/agents/git_agent/agent.py
import logging
from typing import AsyncGenerator, Any

from backend.tools.agents.base import BaseAgent, AgentConfig
from backend.tools.time_utils import get_current_time
from backend import config
from .prompts import GIT_AGENT_SYSTEM_PROMPT
from backend.tools import ToolRegistry, ToolScope

logger = logging.getLogger(__name__)


class GitAgent(BaseAgent):
    def get_system_prompt(self, **kwargs):
        return GIT_AGENT_SYSTEM_PROMPT.format(
            current_time=get_current_time(), chat_id=self.chat_id
        )

    def get_tools(self, iteration, task_list, db_history):
        return ToolRegistry.get_tools_for_scope(ToolScope.GIT)

    def format_user_message(self, **kwargs):
        return f"Instruction: {kwargs['instruction']}"


async def flow_fn(agent: Any, instruction: str, **kwargs) -> AsyncGenerator[str, None]:
    """
    Main orchestration logic for the Git Agent.
    Delegated by the ToolHandler/AgentHandler.
    """
    cfg = AgentConfig(
        name="git_agent",
        display_name="Git Agent",
        max_turns=config.GIT_AGENT_MAX_TURNS,
        failsafe_turns=config.GIT_AGENT_FAILSAFE_TURNS,
        max_tokens=config.GIT_AGENT_MAX_TOKENS,
        thinking_budget=config.GIT_AGENT_THINKING_BUDGET,
    )
    ga = GitAgent(agent, cfg)
    async for chunk in ga.run(instruction=instruction, **kwargs):
        yield chunk

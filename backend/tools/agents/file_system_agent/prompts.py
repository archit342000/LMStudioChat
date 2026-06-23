from backend.prompts import PromptWrapper

FILE_SYSTEM_AGENT_SYSTEM_PROMPT = PromptWrapper(
    "file_system_agent_prompt",
    file_system_tool_directives="directives/file_system_tools",
    sub_agent_task_directives="sub_agent_task_rules"
)
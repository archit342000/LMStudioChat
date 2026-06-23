from backend.prompts import PromptWrapper

DOCUMENT_AGENT_SYSTEM_PROMPT = PromptWrapper(
    "document_agent_prompt",
    document_agent_tool_directives="directives/document_agent_tools",
    sub_agent_task_directives="sub_agent_task_rules"
)

DOCUMENT_AGENT_VISION_SYSTEM_PROMPT = PromptWrapper(
    "document_agent_vision_prompt"
)

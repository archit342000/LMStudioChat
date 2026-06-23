from backend.prompts import PromptWrapper

BROWSING_AGENT_SYSTEM_PROMPT_TEXT = PromptWrapper(
    "browsing_agent_text_prompt",
    sub_agent_task_directives="sub_agent_task_rules"
)

BROWSING_AGENT_SYSTEM_PROMPT_VISION = PromptWrapper(
    "browsing_agent_vision_prompt",
    sub_agent_task_directives="sub_agent_task_rules"
)

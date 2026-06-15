from backend.prompts import PromptWrapper

GIT_AGENT_SYSTEM_PROMPT = PromptWrapper(
    "git_agent_prompt",
    sub_agent_task_directives="sub_agent_task_directives"
)

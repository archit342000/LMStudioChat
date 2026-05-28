import logging
from typing import AsyncGenerator, Any

from backend.tools.time_utils import get_current_time
from backend.database import db
from backend import config
from .prompts import GIT_AGENT_SYSTEM_PROMPT
from backend.tools.definitions import GIT_AGENT_INTERNAL_TOOLS, MANAGE_TASK_LIST_TOOL

logger = logging.getLogger(__name__)


async def flow_fn(agent: Any, instruction: str, **kwargs) -> AsyncGenerator[str, None]:
    """
    Main orchestration logic for the Git Agent.
    Delegated by the ToolHandler/AgentHandler.
    Follows the same pattern as file_system_agent.
    """
    chat_id = agent.chat_id
    parent_message_id = agent.parent_message_id
    current_time = get_current_time()

    logger.info(f"GitAgent starting: chat_id={chat_id} instruction='{instruction}'")

    try:
        # Check if this is a resume (existing sub-agent messages exist)
        existing_history = db.get_messages(
            chat_id, parent_message_id=parent_message_id,
            parent_type="git_agent"
        )
        is_resume = len(existing_history) > 0

        if not is_resume:
            # First run — emit start event marker for resume checkpoint tracking
            db.add_message(
                chat_id=chat_id,
                role='event',
                content='Git Agent Started.',
                parent_id=parent_message_id,
                parent_type='git_agent'
            )
        else:
            logger.info(f"GitAgent resuming: chat_id={chat_id} existing_msgs={len(existing_history)}")

        # Execution Loop
        MAX_TURNS = config.GIT_AGENT_MAX_TURNS
        FAILSAFE_TURNS = config.GIT_AGENT_FAILSAFE_TURNS
        iteration = 0

        while True:
            iteration += 1

            if iteration > MAX_TURNS + FAILSAFE_TURNS:
                logger.error(f"GitAgent: absolute iteration limit reached for chat_id={chat_id}")
                db.add_message(
                    chat_id=chat_id,
                    role='event',
                    content='Git Agent Failed: Exceeded maximum iteration limit.',
                    parent_id=parent_message_id,
                    parent_type='git_agent'
                )
                agent.result = "Operation forcibly terminated due to infinite loop."
                return

            # 1. Rebuild history from scratch for every inference step
            db_history = db.get_messages(
                chat_id, parent_message_id=parent_message_id, parent_type="git_agent"
            )

            messages = [
                {"role": "system", "content": GIT_AGENT_SYSTEM_PROMPT.format(
                    current_time=current_time, chat_id=chat_id
                )},
                {"role": "user", "content": f"Instruction: {instruction}"}
            ]

            # Append historical assistant/tool messages from DB
            for m in db_history:
                if m.get("role") in ["assistant", "tool"]:
                    msg = {"role": m["role"], "content": m.get("content")}
                    if m.get("tool_calls"):
                        msg["tool_calls"] = m["tool_calls"]
                    if m.get("tool_call_id"):
                        msg["tool_call_id"] = m["tool_call_id"]
                    if m.get("name"):
                        msg["name"] = m["name"]
                    if m.get("reasoning_content"):
                        msg["reasoning_content"] = m["reasoning_content"]
                    messages.append(msg)

            # 2. Determine available tools
            task_list = db.get_task_list(
                chat_id, parent_id=parent_message_id, parent_type="git_agent"
            )

            git_turns = sum(
                1 for m in db_history
                if m.get("role") == "tool"
                and m.get("name") in [t["function"]["name"] for t in GIT_AGENT_INTERNAL_TOOLS]
            )
            limit_hit = git_turns >= MAX_TURNS

            if limit_hit:
                already_warned = any(
                    m.get("role") == "user" and "TURN LIMIT REACHED" in m.get("content", "")
                    for m in db_history
                )
                if not already_warned:
                    logger.warning(f"GitAgent reached turn limit ({git_turns}). Injecting wrap-up.")
                    db.add_message(
                        chat_id=chat_id,
                        role='user',
                        content=(
                            '[SYSTEM: TURN LIMIT REACHED] You have exhausted your allowed git operations. '
                            'Summarize what was accomplished based on operations completed so far. '
                            'Do not attempt any further operations.'
                        ),
                        parent_id=parent_message_id,
                        parent_type='git_agent'
                    )
                    continue
                active_tools = []  # Force text response
            else:
                # STRICT ENFORCEMENT: Planning before action.
                if not task_list:
                    active_tools = [MANAGE_TASK_LIST_TOOL]
                else:
                    active_tools = GIT_AGENT_INTERNAL_TOOLS

                    # Run safety and progress audit
                    from backend.tools.safety import run_safety_audit
                    safety_alert = run_safety_audit(db_history, task_list)
                    if safety_alert:
                        messages.append({"role": "user", "content": safety_alert})

            # 3. Run Inference Step
            async for chunk in agent.run_inference_step(
                agent_name="git_agent",
                messages=messages,
                model_name=agent.model,
                tools=active_tools,
                tool_choice="auto",
                max_tokens=config.GIT_AGENT_MAX_TOKENS,
                thinking_budget_tokens=config.GIT_AGENT_THINKING_BUDGET
            ):
                yield chunk

            # 4. Check for completion or next step
            updated_history = db.get_messages(
                chat_id, parent_message_id=parent_message_id, parent_type="git_agent"
            )
            if not updated_history:
                break

            last_msg = updated_history[-1]

            # If task list was not initialized, re-enforce
            if not task_list:
                task_list_after = db.get_task_list(
                    chat_id, parent_id=parent_message_id, parent_type="git_agent"
                )
                if not task_list_after:
                    logger.warning("GitAgent failed to initialize task list.")
                    db.add_message(
                        chat_id=chat_id,
                        role='user',
                        content=(
                            'System Constraint: You MUST initialize your task list using '
                            'manage_task_list before taking ANY other actions or responding.'
                        ),
                        parent_id=parent_message_id,
                        parent_type='git_agent'
                    )
                    continue

            if last_msg.get("role") == "assistant" and not last_msg.get("tool_calls"):
                db.add_message(
                    chat_id=chat_id,
                    role='event',
                    content='Git Agent Completed.',
                    parent_id=parent_message_id,
                    parent_type='git_agent'
                )
                agent.result = last_msg.get("content", "Git operation completed.")
                break

    except Exception as e:
        logger.error(f"GitAgent critical error: chat_id={chat_id} error={e}", exc_info=True)
        db.add_message(
            chat_id=chat_id,
            role='event',
            content=f'Git Agent Failed: {str(e)}',
            parent_id=parent_message_id,
            parent_type='git_agent'
        )
        agent.result = f"Git agent failed: {str(e)}"
        raise

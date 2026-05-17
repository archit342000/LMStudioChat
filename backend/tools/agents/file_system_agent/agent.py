import json
import logging
from typing import AsyncGenerator, Dict, Any, List

from backend.tools.time_utils import get_current_time
from backend.database import db
from .prompts import FILE_SYSTEM_AGENT_SYSTEM_PROMPT
from backend.tools.definitions import FILE_SYSTEM_INTERNAL_TOOLS, MANAGE_TASK_LIST_TOOL

logger = logging.getLogger(__name__)

async def flow_fn(agent: Any, instruction: str, **kwargs) -> AsyncGenerator[str, None]:
    """
    Main orchestration logic for the FileSystem Agent.
    Delegated by the ToolHandler/AgentHandler.
    """
    chat_id = agent.chat_id
    parent_message_id = agent.parent_message_id
    current_time = get_current_time()
    
    logger.info(f"FileSystemAgent starting: chat_id={chat_id} instruction='{instruction}'")

    # Check if this is a resume (existing sub-agent messages exist)
    existing_history = db.get_messages(
        chat_id, parent_message_id=parent_message_id,
        parent_type="file_system_agent"
    )
    is_resume = len(existing_history) > 0

    if not is_resume:
        # First run — emit start event marker for resume checkpoint tracking
        db.add_message(
            chat_id=chat_id,
            role='event',
            content='FileSystem Agent Started.',
            parent_id=parent_message_id,
            parent_type='file_system_agent'
        )
    else:
        logger.info(f"FileSystemAgent resuming: chat_id={chat_id} existing_msgs={len(existing_history)}")

    # Execution Loop (Internal Tool-Calling)
    iteration = 0
    while True:
        iteration += 1

        # 1. Rebuild history from scratch for every inference step
        db_history = db.get_messages(chat_id, parent_message_id=parent_message_id, parent_type="file_system_agent")
        
        messages = [
            {"role": "system", "content": FILE_SYSTEM_AGENT_SYSTEM_PROMPT.format(current_time=current_time, chat_id=chat_id)},
            {"role": "user", "content": f"Instruction: {instruction}"}
        ]
        
        # Append historical assistant/tool messages from DB
        for m in db_history:
            if m.get("role") in ["assistant", "tool"]:
                msg = {"role": m["role"], "content": m.get("content")}
                # Ensure tool calls are passed back as lists/objects
                if m.get("tool_calls"):
                    msg["tool_calls"] = m["tool_calls"]
                if m.get("tool_call_id"):
                    msg["tool_call_id"] = m["tool_call_id"]
                if m.get("name"):
                    msg["name"] = m["name"]
                if m.get("reasoning_content"):
                    msg["reasoning_content"] = m["reasoning_content"]
                messages.append(msg)

        # 2. Run Inference Step
        task_list = db.get_task_list(chat_id, parent_id=parent_message_id, parent_type="file_system_agent")
        
        from backend import config
        
        file_system_turns = sum(
            1 for m in db_history 
            if m.get("role") == "tool" and m.get("name") in [t["function"]["name"] for t in FILE_SYSTEM_INTERNAL_TOOLS]
        )
        limit_hit = file_system_turns >= config.FILE_SYSTEM_AGENT_MAX_TURNS

        if limit_hit:
            already_warned = any(
                m.get("role") == "user" and "TURN LIMIT REACHED" in m.get("content", "")
                for m in db_history
            )
            if not already_warned:
                logger.warning(f"FileSystemAgent reached turn limit ({file_system_turns}). Injecting wrap-up message.")
                db.add_message(
                    chat_id=chat_id,
                    role='user',
                    content='[SYSTEM: TURN LIMIT REACHED] You have exhausted your allowed file system operations. You must immediately summarize your findings based on the operations completed so far. Do not attempt any further file system changes.',
                    parent_id=parent_message_id,
                    parent_type='file_system_agent'
                )
                continue
            # Remove all tools to force immediate conclusion and text generation
            active_tools = []
        else:
            # STRICT MECHANICAL ENFORCEMENT: Planning before action.
            # If no task list exists, the agent physically cannot perform any other action.
            if not task_list:
                active_tools = [MANAGE_TASK_LIST_TOOL]
            else:
                active_tools = FILE_SYSTEM_INTERNAL_TOOLS

        async for chunk in agent.run_inference_step(
            agent_name="file_system_agent",
            messages=messages,
            model_name=agent.model,
            tools=active_tools,
            tool_choice="auto",
            max_tokens=config.FILE_SYSTEM_AGENT_MAX_TOKENS,
            thinking_budget_tokens=config.FILE_SYSTEM_AGENT_THINKING_BUDGET
        ):
            yield chunk
            
        # 3. Check for completion or next step
        updated_history = db.get_messages(chat_id, parent_message_id=parent_message_id, parent_type="file_system_agent")
        if not updated_history:
            break
        
        last_msg = updated_history[-1]
        
        if not task_list:
            # Check if task list was initialized in the step we just finished
            task_list_after = db.get_task_list(chat_id, parent_id=parent_message_id, parent_type="file_system_agent")
            if not task_list_after:
                logger.warning("FileSystemAgent failed to initialize task list.")
                db.add_message(
                    chat_id=chat_id,
                    role='user',
                    content='System Constraint: You MUST initialize your task list using manage_task_list before taking ANY other actions or responding.',
                    parent_id=parent_message_id,
                    parent_type='file_system_agent'
                )
                continue
        
        if (last_msg.get("role") == "assistant" and not last_msg.get("tool_calls")):
            # The agent has provided its final response summary — emit completion event
            db.add_message(
                chat_id=chat_id,
                role='event',
                content='FileSystem Agent Completed.',
                parent_id=parent_message_id,
                parent_type='file_system_agent'
            )
            agent.result = last_msg.get("content", "File System operation completed.")
            return
        
        # If there were tool calls, the ToolHandler has already executed them.
        # We loop back, rebuild history (including the new tool results), and continue.
        
        # Absolute safety break to prevent infinite loops in case the agent gets stuck after the limit
        if iteration >= config.FILE_SYSTEM_AGENT_MAX_TURNS + config.FILE_SYSTEM_AGENT_FAILSAFE_TURNS:
            logger.warning(f"FileSystemAgent reached absolute iteration limit ({iteration}). Force ending.")
            db.add_message(
                chat_id=chat_id,
                role='event',
                content='FileSystem Agent Force Terminated. (infinite loop prevention)',
                parent_id=parent_message_id,
                parent_type='file_system_agent'
            )
            agent.result = "Operation forcibly terminated due to infinite loop."
            return
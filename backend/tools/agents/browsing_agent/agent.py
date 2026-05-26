import json
import logging
import uuid
from typing import AsyncGenerator, Dict, Any, List

from backend.database import db
from backend import config
from backend.mcp_client import playwright_client
from .prompts import BROWSING_AGENT_SYSTEM_PROMPT_TEXT, BROWSING_AGENT_SYSTEM_PROMPT_VISION
from backend.tools.definitions import BROWSING_AGENT_TOOLS_BASE, BROWSING_AGENT_TOOLS_VISION, MANAGE_TASK_LIST_TOOL

logger = logging.getLogger(__name__)

async def flow_fn(agent: Any, agent_name: str, query: str, **kwargs) -> AsyncGenerator[str, None]:
    """
    Main orchestration logic for the Browsing Agent.
    Delegated by the ToolHandler/AgentHandler.
    """
    chat_id = agent.chat_id
    parent_message_id = agent.parent_message_id
    
    logger.info(f"BrowsingAgent starting: chat_id={chat_id} query='{query}'")

    # Check if this is a resume
    existing_history = db.get_messages(
        chat_id, parent_message_id=parent_message_id,
        parent_type="browsing_agent"
    )
    is_resume = len(existing_history) > 0

    try:
        if not is_resume:
            # First run — emit start event and initialize session
            db.add_message(
                chat_id=chat_id,
                role='event',
                content='Browsing Agent Started. Initializing browser session.',
                parent_id=parent_message_id,
                parent_type='browsing_agent'
            )
            
            # Start browser session
            session_id = f"sess_{chat_id}_{uuid.uuid4().hex[:8]}"
            db.update_chat(chat_id, browsing_session_id=session_id)
            
            await playwright_client.connect()
            await playwright_client.execute_tool("browser_start_session", {
                "session_id": session_id,
                "stealth_level": config.BROWSER_STEALTH_LEVEL,
                "scope": kwargs.get("scope")
            })
        else:
            logger.info(f"BrowsingAgent resuming: chat_id={chat_id} existing_msgs={len(existing_history)}")
            chat_meta = db.get_chat(chat_id)
            session_id = chat_meta.get("browsing_session_id") if chat_meta else None
            
            if not session_id:
                session_id = f"sess_{chat_id}_{uuid.uuid4().hex[:8]}"
                db.update_chat(chat_id, browsing_session_id=session_id)
                logger.info(f"Resuming but session_id was missing. Initialized new session: {session_id}")
                
            # Ensure the session still exists on the MCP server
            await playwright_client.connect()
            await playwright_client.execute_tool("browser_start_session", {
                "session_id": session_id,
                "stealth_level": config.BROWSER_STEALTH_LEVEL
            })
    except Exception as e:
        logger.error(f"BrowsingAgent connection/initialization failed: {e}", exc_info=True)
        db.add_message(
            chat_id=chat_id,
            role='event',
            content=f'Error initializing browser session: {str(e)}',
            parent_id=parent_message_id,
            parent_type='browsing_agent'
        )
        yield f"Error: Failed to connect to browser session. Please ensure the Playwright MCP server is running."
        # Clear the database session reference to prevent future stale connections
        db.update_chat(chat_id, browsing_session_id=None)
        return

    try:
        # Determine if vision mode is enabled based on the model
        from backend.models import load_model_config
        model_config = load_model_config()
        vision_models = set()
        for category in model_config.values():
            if isinstance(category, dict):
                for key, val in category.items():
                    if key.startswith("vision"):
                        vision_models.add(val)
        
        is_vision = agent.model in vision_models
        logger.info(f"BrowsingAgent vision mode: {is_vision} (model={agent.model})")

        # Select tools and prompt
        active_tools = BROWSING_AGENT_TOOLS_VISION if is_vision else BROWSING_AGENT_TOOLS_BASE
        system_prompt_template = BROWSING_AGENT_SYSTEM_PROMPT_VISION if is_vision else BROWSING_AGENT_SYSTEM_PROMPT_TEXT

        # Success Criteria & Start URL
        success_criteria = kwargs.get("success_criteria")
        if success_criteria:
            system_prompt_template += f"\n\n## SUCCESS CRITERIA\nYou must evaluate your progress against this goal: {success_criteria}\nDO NOT consider the task complete until these criteria are met."
        
        start_url = kwargs.get("start_url")
        if start_url:
            system_prompt_template += f"\n\n## STARTING URL\nYou must begin your task by navigating to: {start_url}"

        # Scope restriction
        scope = kwargs.get("scope")
        if scope:
            scope_str = ", ".join(scope)
            scope_directive = f"\n\n## SCOPE RESTRICTION\nYou are strictly restricted to using `browser_navigate` ONLY for the following domains: **{scope_str}**. However, you are free to click links that take you to other domains if it helps accomplish your task. If you cannot complete your task within this scope, or if a mandatory navigation is blocked by this rule, you must fail the task and explain the scope limitation."
            system_prompt_template += scope_directive

        # 0. Update session with scope if provided
        chat_meta = db.get_chat(chat_id)
        session_id = chat_meta.get("browsing_session_id")
        if session_id:
            await playwright_client.connect()
            await playwright_client.execute_tool("browser_start_session", {
                "session_id": session_id,
                "stealth_level": config.BROWSER_STEALTH_LEVEL,
                "scope": scope
            })

        # Execution Loop
        iteration = 0
        while True:
            iteration += 1

            # 1. Rebuild history from scratch for every inference step
            db_history = db.get_messages(chat_id, parent_message_id=parent_message_id, parent_type="browsing_agent")
            
            messages = [
                {"role": "system", "content": system_prompt_template},
                {"role": "user", "content": f"Instruction: {query}"}
            ]
            
            # Append historical assistant/tool messages from DB
            # Screenshot handling: only keep the LATEST screenshot, and convert it
            # from raw base64 text to proper multimodal image_url format so the
            # vision encoder processes it (4096 tokens) instead of the text
            # tokenizer (180k+ tokens).
            screenshot_indices = []
            for i, m in enumerate(db_history):
                if m.get("role") == "tool" and m.get("name") == "browser_screenshot":
                    screenshot_indices.append(i)
            # All but the last screenshot index get pruned entirely
            prune_set = set(screenshot_indices[:-1]) if len(screenshot_indices) > 1 else set()
            latest_screenshot_idx = screenshot_indices[-1] if screenshot_indices else -1

            for i, m in enumerate(db_history):
                if m.get("role") in ["assistant", "tool", "user"]:
                    content = m["content"]
                    
                    if m.get("name") == "browser_screenshot":
                        if i in prune_set:
                            # Strip out old screenshots to prevent context bloat
                            content = [{"type": "text", "text": "[Previous screenshot omitted to save context]"}]
                        elif not is_vision:
                            # If non-vision model, strip the image block entirely
                            content = [{"type": "text", "text": "[Screenshot captured. Use browser_read_page and browser_get_interactive_elements to understand the page.]"}]
                            
                    msg = {"role": m["role"], "content": content}
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
            task_list = db.get_task_list(chat_id, parent_id=parent_message_id, parent_type="browsing_agent")
            
            browsing_turns = sum(
                1 for m in db_history 
                if m.get("role") == "tool" and m.get("name", "").startswith("browser_")
            )
            limit_hit = browsing_turns >= config.BROWSING_AGENT_MAX_TURNS

            if limit_hit:
                already_warned = any(
                    m.get("role") == "user" and "TURN LIMIT REACHED" in m.get("content", "")
                    for m in db_history
                )
                if not already_warned:
                    logger.warning(f"BrowsingAgent reached turn limit ({browsing_turns}). Injecting wrap-up message.")
                    db.add_message(
                        chat_id=chat_id,
                        role='user',
                        content='[SYSTEM: TURN LIMIT REACHED] You have exhausted your allowed browsing actions. You must immediately summarize your findings based on the information gathered so far. Do not attempt any further browsing.',
                        parent_id=parent_message_id,
                        parent_type='browsing_agent'
                    )
                    continue
                # Remove all tools to force immediate conclusion and text generation
                current_tools = []
            else:
                # STRICT MECHANICAL ENFORCEMENT: Planning before action.
                if not task_list:
                    current_tools = [MANAGE_TASK_LIST_TOOL]
                else:
                    current_tools = active_tools
                    
                    # Run safety and progress audit
                    from backend.tools.safety import run_safety_audit
                    safety_alert = run_safety_audit(db_history, task_list)
                    if safety_alert:
                        messages.append({
                            "role": "user",
                            "content": safety_alert
                        })

            async for chunk in agent.run_inference_step(
                agent_name="browsing_agent",
                messages=messages,
                model_name=agent.model,
                tools=current_tools,
                tool_choice="auto",
                max_tokens=config.BROWSING_AGENT_MAX_TOKENS,
                thinking_budget_tokens=config.BROWSING_AGENT_THINKING_BUDGET
            ):
                yield chunk
                
            # 3. Check for completion or next step
            updated_history = db.get_messages(chat_id, parent_message_id=parent_message_id, parent_type="browsing_agent")
            if not updated_history:
                break
            
            last_msg = updated_history[-1]
            
            if not task_list:
                task_list_after = db.get_task_list(chat_id, parent_id=parent_message_id, parent_type="browsing_agent")
                if not task_list_after:
                    logger.warning("BrowsingAgent failed to initialize task list.")
                    db.add_message(
                        chat_id=chat_id,
                        role='user',
                        content='System Constraint: You MUST initialize your task list using manage_task_list before taking ANY other actions or responding.',
                        parent_id=parent_message_id,
                        parent_type='browsing_agent'
                    )
                    continue
            
            if (last_msg.get("role") == "assistant" and not last_msg.get("tool_calls")):
                db.add_message(
                    chat_id=chat_id,
                    role='event',
                    content='Browsing Agent Completed.',
                    parent_id=parent_message_id,
                    parent_type='browsing_agent'
                )
                agent.result = last_msg.get("content", "Browsing operation completed.")
                return
            
            if iteration >= config.BROWSING_AGENT_MAX_TURNS + config.BROWSING_AGENT_FAILSAFE_TURNS:
                logger.warning(f"BrowsingAgent reached absolute iteration limit ({iteration}). Force ending.")
                db.add_message(
                    chat_id=chat_id,
                    role='event',
                    content='Browsing Agent Force Terminated. (infinite loop prevention)',
                    parent_id=parent_message_id,
                    parent_type='browsing_agent'
                )
                agent.result = "Operation forcibly terminated due to infinite loop."
                return
    except Exception as e:
        logger.error(f"BrowsingAgent error during execution: {e}", exc_info=True)
        db.add_message(
            chat_id=chat_id,
            role='event',
            content=f'Browsing Agent execution failed: {str(e)}',
            parent_id=parent_message_id,
            parent_type='browsing_agent'
        )
        yield f"Error: Browsing agent failed during execution: {str(e)}"
    finally:
        # Always clean up the session
        chat_meta = db.get_chat(chat_id)
        session_id = chat_meta.get("browsing_session_id")
        if session_id:
            try:
                await playwright_client.connect()
                await playwright_client.execute_tool("browser_end_session", {"session_id": session_id})
                logger.info(f"BrowsingAgent cleaned up session {session_id}")
            except Exception as e:
                logger.error(f"BrowsingAgent error cleaning up session: {e}")
            # Clear the stale session reference from DB
            db.update_chat(chat_id, browsing_session_id=None)


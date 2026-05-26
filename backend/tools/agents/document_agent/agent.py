import logging
import json
import os
import time
from typing import AsyncGenerator, Any
from backend.database import db
from backend import config
from backend.rag import RAGProvider, FileRAG
from backend.models import get_embedding_model, load_model_config
from backend.files.manager import FileManager
from backend.logging import log_tool_call
from backend.tools.agents.document_agent.prompts import DOCUMENT_AGENT_SYSTEM_PROMPT, DOCUMENT_AGENT_VISION_SYSTEM_PROMPT
from backend.tools.definitions import get_document_agent_tools

logger = logging.getLogger(__name__)

def is_vision_model(model_name: str) -> bool:
    """Checks if a model name corresponds to a vision-capable model in config."""
    try:
        cfg = load_model_config()
        vision_models = [cfg['research'].get('vision')]
        for k in ['vision', 'vision2', 'vision_small']:
            v = cfg['general'].get(k)
            if v: vision_models.append(v)
        return model_name in vision_models
    except Exception:
        return False

async def flow_fn(
    agent: Any, 
    agent_name: str,
    file_id: str,
    query: str,
    **kwargs
) -> AsyncGenerator[str, None]:
    """Agent flow for analyzing a file and optionally synthesizing an answer."""
    logger.info(f"DocumentAgent starting: file_id='{file_id}', query='{query}'")
    start_time = time.time()
    
    log_tool_call(
        tool_name="document_agent",
        payload={"file_id": file_id, "query": query},
        response_data="Starting Document Agent flow...",
        chat_id=agent.chat_id
    )

    chat_id = agent.chat_id
    parent_message_id = agent.parent_message_id

    try:
        existing_history = db.get_messages(
            chat_id, parent_message_id=parent_message_id,
            parent_type="document_agent"
        )
        is_resume = len(existing_history) > 0

        if not is_resume:
            db.add_message(
                chat_id=chat_id,
                role='event',
                content='Document Agent Started.',
                parent_id=parent_message_id,
                parent_type='document_agent'
            )
        else:
            logger.info(f"DocumentAgent resuming: chat_id={chat_id} existing_msgs={len(existing_history)}")

        file_meta = db.get_file(file_id)
        if not file_meta:
            error_msg = f"Error: File with ID {file_id} not found."
            agent.result = error_msg
            yield error_msg
            return

        mime_type = file_meta.get('mime_type', '')
        document_agent_tools = get_document_agent_tools(mime_type)
        original_filename = file_meta.get('original_filename', 'Unknown')
        stored_filename = file_meta.get('stored_filename', '')
        stored_path = os.path.join(config.FILE_STORAGE_PATH, stored_filename)
        content_text = file_meta.get('content_text', '')

        is_image = mime_type.startswith('image/')
        
        if is_image:
            if not is_vision_model(agent.model):
                error_msg = (f"Error: The currently loaded model '{agent.model}' does not support vision. "
                           f"I cannot analyze the image '{original_filename}'. "
                           f"Please ask the user to switch to a vision-capable model.")
                agent.result = error_msg
                yield error_msg
                return

            yield f"Event: Using vision analysis for image '{original_filename}'...\n"
            
            embedding_model = get_embedding_model()
            rag_manager = RAGProvider.get_manager(
                persist_path=config.CHROMA_PATH,
                embedding_model=embedding_model
            )
            file_manager = FileManager(rag_manager=rag_manager)
            
            encoded_image, mime = file_manager.encode_file_for_vision(stored_path)
            
            if not encoded_image:
                error_msg = f"Error: Failed to encode image '{original_filename}' for vision."
                agent.result = error_msg
                yield error_msg
                return

            user_content = [
                {"type": "text", "text": f"## Query Executed:\n{query}"},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{encoded_image}"}
                }
            ]
            
            messages = [
                {"role": "system", "content": DOCUMENT_AGENT_VISION_SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ]
            
            async for chunk in agent.run_inference_step(
                agent_name="document_agent",
                messages=messages,
                model_name=agent.model,
                tools=[],
                tool_choice="none",
                thinking_budget_tokens=config.DOCUMENT_AGENT_THINKING_BUDGET
            ):
                yield chunk
        else:
            # Autonomous Document Investigation Loop
            yield f"Event: Initiating investigation of '{original_filename}'...\n"

            from backend.tools.definitions import PAGE_BASED_MIME_TYPES
            if mime_type in PAGE_BASED_MIME_TYPES:
                read_hint = "This is a page-based document. Use `read_uploaded_file(page=N)` to read specific pages."
            else:
                read_hint = "This is a text/code file. Use `read_uploaded_file(start_line=X, end_line=Y)` to read specific line ranges."

            file_info_header = f"""
## File Under Investigation
- **Filename**: {original_filename}
- **File ID**: {file_id}
- **Type**: {mime_type}

## User Query / Objective
{query}

## Instructions
You are the File Agent. You must investigate the file above to satisfy the user query.
You have tools to perform semantic searches (RAG), literal searches (grep), and read specific lines/pages.

1.  **Formulate a Plan**: Use the tools to find the required information.
2.  **Verify**: If a search gives you a hint, use `read_uploaded_file` to verify the surrounding context.
    - {read_hint}
3.  **Synthesize**: Once you have all the facts, provide a comprehensive answer.

**Begin your investigation now.**
"""
            chat_id = agent.chat_id
            parent_message_id = agent.parent_message_id
            
            iteration = 0
            while True:
                iteration += 1

                db_history = db.get_messages(chat_id, parent_message_id=parent_message_id, parent_type="document_agent")
                
                messages = [
                    {"role": "system", "content": DOCUMENT_AGENT_SYSTEM_PROMPT},
                    {"role": "user", "content": file_info_header}
                ]

                for m in db_history:
                    if m.get("role") in ["assistant", "tool"]:
                        msg = {"role": m["role"], "content": m["content"]}
                        if m.get("tool_calls"): msg["tool_calls"] = m["tool_calls"]
                        if m.get("tool_call_id"): msg["tool_call_id"] = m["tool_call_id"]
                        if m.get("name"): msg["name"] = m["name"]
                        if m.get("reasoning_content"): msg["reasoning_content"] = m["reasoning_content"]
                        messages.append(msg)

                task_list = db.get_task_list(chat_id, parent_id=parent_message_id, parent_type="document_agent")

                document_agent_turns = sum(
                    1 for m in db_history 
                    if m.get("role") == "tool" and m.get("name") in [t["function"]["name"] for t in document_agent_tools]
                )
                limit_hit = document_agent_turns >= config.DOCUMENT_AGENT_MAX_TURNS

                if limit_hit:
                    already_warned = any(
                        m.get("role") == "user" and "TURN LIMIT REACHED" in m.get("content", "")
                        for m in db_history
                    )
                    if not already_warned:
                        logger.warning(f"DocumentAgent reached turn limit ({document_agent_turns}). Injecting wrap-up message.")
                        db.add_message(
                            chat_id=chat_id,
                            role='user',
                            content='[SYSTEM: TURN LIMIT REACHED] You have exhausted your allowed file operations. You must immediately summarize your findings based on the information gathered so far. Do not attempt any further file searches or reads.',
                            parent_id=parent_message_id,
                            parent_type='document_agent'
                        )
                        continue
                    # Remove all tools to force immediate conclusion and text generation
                    current_tools = []
                else:
                    if not task_list:
                        from backend.tools.definitions import MANAGE_TASK_LIST_TOOL
                        current_tools = [MANAGE_TASK_LIST_TOOL]
                    else:
                        current_tools = document_agent_tools
                        
                        # Run safety and progress audit
                        from backend.tools.safety import run_safety_audit
                        safety_alert = run_safety_audit(db_history, task_list)
                        if safety_alert:
                            messages.append({
                                "role": "user",
                                "content": safety_alert
                            })

                async for chunk in agent.run_inference_step(
                    agent_name="document_agent",
                    messages=messages,
                    model_name=agent.model,
                    tools=current_tools,
                    tool_choice="auto",
                    max_tokens=config.DOCUMENT_AGENT_MAX_TOKENS,
                    thinking_budget_tokens=config.DOCUMENT_AGENT_THINKING_BUDGET
                ):
                    yield chunk

                updated_history = db.get_messages(chat_id, parent_message_id=parent_message_id, parent_type="document_agent")
                if not updated_history:
                    break
                
                last_msg = updated_history[-1]
                
                if not task_list:
                    task_list_after = db.get_task_list(chat_id, parent_id=parent_message_id, parent_type="document_agent")
                    if not task_list_after:
                        logger.warning("DocumentAgent failed to initialize task list.")
                        db.add_message(
                            chat_id=chat_id,
                            role='user',
                            content='System Constraint: You MUST initialize your task list using manage_task_list before taking ANY other actions or responding.',
                            parent_id=parent_message_id,
                            parent_type='document_agent'
                        )
                        continue

                if last_msg.get("role") == "assistant" and not last_msg.get("tool_calls"):
                    break
                
                # Absolute safety break to prevent infinite loops in case the agent gets stuck after the limit
                if iteration >= config.DOCUMENT_AGENT_MAX_TURNS + config.DOCUMENT_AGENT_FAILSAFE_TURNS:
                    logger.warning(f"DocumentAgent reached absolute iteration limit ({iteration}). Force ending.")
                    db.add_message(
                        chat_id=chat_id,
                        role='event',
                        content='Document Agent Force Terminated. (infinite loop prevention)',
                        parent_id=parent_message_id,
                        parent_type='document_agent'
                    )
                    break

        # Retrieve the final synthesized text from the database
        updated_history = db.get_messages(
            agent.chat_id, 
            parent_message_id=agent.parent_message_id, 
            parent_type="document_agent"
        )
        if updated_history:
            last_msg = updated_history[-1]
            agent.result = last_msg.get("content")
            if not agent.result:
                agent.result = "Error: Document agent completed but returned no content."
            elif last_msg.get("role") == "assistant":
                db.add_message(
                    chat_id=chat_id,
                    role='event',
                    content='Document Agent Completed.',
                    parent_id=parent_message_id,
                    parent_type='document_agent'
                )
        elif not agent.result:
            agent.result = "Error: Document agent completed but returned no content."

        log_tool_call(
            tool_name="document_agent",
            payload={"file_id": file_id, "query": query},
            response_data=agent.result,
            chat_id=agent.chat_id,
            duration_s=time.time() - start_time
        )

    except Exception as e:
        error_msg = f"Document agent failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        agent.result = error_msg
        
        # Log failure event to database
        try:
            db.add_message(
                chat_id=chat_id,
                role='event',
                content=f'Document Agent failed: {str(e)}',
                parent_id=parent_message_id,
                parent_type='document_agent'
            )
        except Exception as db_err:
            logger.error(f"Failed to log document agent failure event: {db_err}")

        log_tool_call(
            tool_name="document_agent",
            payload={"file_id": file_id, "query": query},
            response_data=agent.result,
            chat_id=agent.chat_id,
            duration_s=time.time() - start_time
        )
        yield error_msg
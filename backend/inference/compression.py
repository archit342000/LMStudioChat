import json
import logging
from typing import List, Dict, Any
from backend.models import get_model_metadata
from backend.rag.token_counter import count_chat_tokens
from backend.database import db

logger = logging.getLogger(__name__)


async def check_and_trigger_compression(
    chat_id: str,
    messages: List[Dict[str, Any]],
    model: str,
    max_tokens: int = 16384,
    **kwargs
) -> List[Dict[str, Any]]:
    """Checks if context compression needs to be triggered, runs it if so,

    and returns the sliced messages history list.

    Args:
        chat_id: Unique chat identifier.
        messages: Raw conversation history list.
        model: Model name.
        max_tokens: Expected max output tokens for the turn.

    Returns:
        List[Dict[str, Any]]: Sliced and compressed history list.
    """
    if not chat_id or not messages:
        return messages

    # 1. Load model metadata
    try:
        metadata = get_model_metadata(model)
        context_window = metadata["context_window"]
    except Exception as e:
        logger.warning(
            f"Failed to get model metadata for {model}: {e}. Skipping compression."
        )
        return messages

    expected_output = max_tokens or 16384

    # 2. Retrieve existing cached compression data
    chat = db.get_chat(chat_id)
    if not chat:
        return messages

    history_compression = chat.get("history_compression")
    comp_data = None
    if history_compression:
        try:
            comp_data = json.loads(history_compression)
        except Exception as e:
            logger.error(f"Failed to parse history_compression JSON: {e}")

    sliced_messages = messages
    if comp_data:
        boundary_id = comp_data.get("boundary_message_id")
        summary_text = comp_data.get("summary_text", "")
        file_notes = comp_data.get("file_notes", "")
        images = comp_data.get("images", [])

        # Find boundary message index
        boundary_idx = -1
        for idx, msg in enumerate(messages):
            if msg.get("id") == boundary_id:
                boundary_idx = idx
                break

        if boundary_idx != -1:
            # Construct synthetic message content
            synthetic_content = []
            synthetic_content.append(
                {
                    "type": "text",
                    "text": f"[System Context Note: Summarized History of Past Turns]\n{summary_text}",
                }
            )
            if file_notes:
                synthetic_content.append(
                    {
                        "type": "text",
                        "text": f"[Footnote: Attached Files Context]\n{file_notes}",
                    }
                )
            for img in images:
                synthetic_content.append(img)

            # Slice history list: System Prompt + Synthetic Message + Post-Boundary Messages
            sliced_messages = [
                messages[0],
                {"role": "user", "content": synthetic_content},
            ] + messages[boundary_idx + 1 :]

    # 3. Calculate context occupancy
    total_tokens = count_chat_tokens(sliced_messages, model)
    occupancy = total_tokens + expected_output

    if occupancy < 0.8 * context_window:
        return sliced_messages

    logger.info(
        f"Triggering sliding-window history compression for chat {chat_id}. "
        f"Occupancy {occupancy} >= 80% threshold ({int(0.8 * context_window)} tokens)."
    )

    # 4. Determine new boundary message (aiming for 70% compression)
    # Collect all messages that are saved in the DB (possess a valid id)
    db_messages = [msg for msg in messages if msg.get("id") is not None]
    if not db_messages:
        return sliced_messages

    # Accumulate tokens to find the 70% threshold
    msg_tokens = [count_chat_tokens([msg], model) for msg in db_messages]
    total_db_tokens = sum(msg_tokens)
    target_tokens = 0.7 * total_db_tokens
    acc = 0
    boundary_idx = -1

    for idx, tok in enumerate(msg_tokens):
        acc += tok
        if acc >= target_tokens:
            boundary_idx = idx
            break

    if boundary_idx == -1:
        boundary_idx = len(db_messages) - 1

    # Scan backward/forward to end the boundary strictly on an assistant message
    original_boundary_idx = boundary_idx
    while (
        boundary_idx >= 0
        and db_messages[boundary_idx].get("role") != "assistant"
    ):
        boundary_idx -= 1

    if boundary_idx < 0:
        boundary_idx = original_boundary_idx
        while (
            boundary_idx < len(db_messages)
            and db_messages[boundary_idx].get("role") != "assistant"
        ):
            boundary_idx += 1

    if boundary_idx >= len(db_messages) or boundary_idx < 0:
        boundary_idx = original_boundary_idx

    target_boundary_id = db_messages[boundary_idx].get("id")

    # Locate the boundary message index in the original messages list
    orig_boundary_idx = -1
    for idx, msg in enumerate(messages):
        if msg.get("id") == target_boundary_id:
            orig_boundary_idx = idx
            break

    if orig_boundary_idx == -1:
        return sliced_messages

    # History to compress starts from index 1 (after System Prompt) up to boundary
    history_to_compress = messages[1 : orig_boundary_idx + 1]

    # Extract non-image attachments (footnote list, cap at 200)
    chat_files = db.get_chat_files(chat_id)
    non_image_files = []
    for f in chat_files:
        mime = f.get("mime_type", "").lower()
        if not mime.startswith("image/"):
            non_image_files.append(f)

    file_notes_list = []
    for f in non_image_files[:200]:
        file_notes_list.append(
            f"Attachment: '{f.get('original_filename')}' ({f.get('mime_type')}) - "
            f"size: {f.get('file_size')} bytes"
        )
    file_notes = "\n".join(file_notes_list) if file_notes_list else ""

    # Extract image attachments (base64/multimodal payloads, cap at 20)
    images_payloads = []
    for msg in history_to_compress:
        content = msg.get("content")
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "image_url":
                    if len(images_payloads) < 20:
                        images_payloads.append(part)

    # 5. Build summarizer instruction and messages
    summarizer_prompt = (
        "You are a dense conversation summarizer. Your task is to compress the preceding conversation history "
        "into a highly detailed summary. Do NOT lose key technical choices, code structures discussed, user preferences, "
        "or specific requirements. Completely omit all pleasantries, greetings, and filler words.\n"
        "Crucial: Write the summary in the second person perspective (e.g., 'You helped the user write a Python function...', "
        "'The user asked you to use SQLite...') so that the assistant reading this summary understands its own past role. "
        "Be extremely detailed and maximize density of information. Do not generate markdown titles or introduction, "
        "start immediately with the summary content."
    )

    summarizer_messages = []
    if comp_data and comp_data.get("summary_text"):
        summarizer_messages.append(
            {
                "role": "user",
                "content": f"[System Context Note: Summarized History of Past Turns]\n{comp_data['summary_text']}",
            }
        )

    summarizer_messages.extend(history_to_compress)
    summarizer_messages.append({"role": "user", "content": summarizer_prompt})

    # Summarizer completion call using InferenceEngine
    from backend.inference.engine import InferenceEngine

    engine = InferenceEngine()

    summary_max_tokens = min(int(0.1 * context_window), 16384)

    summary_response = await engine.chat(
        messages=summarizer_messages,
        model=model,
        chat_id=chat_id,
        enable_thinking=False,
        max_tokens=summary_max_tokens,
        temperature=0.0,
        skip_compression=True,
    )

    summary_text = (
        summary_response.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )
    if not summary_text:
        summary_text = (
            f"Summary of past conversation up to message ID {target_boundary_id}."
        )

    # 6. Save compressed metadata to DB
    new_comp_data = {
        "boundary_message_id": target_boundary_id,
        "summary_text": summary_text,
        "file_notes": file_notes,
        "images": images_payloads,
    }

    db.update_chat(chat_id, history_compression=json.dumps(new_comp_data))

    # Re-slice messages list and return
    synthetic_content = []
    synthetic_content.append(
        {
            "type": "text",
            "text": f"[System Context Note: Summarized History of Past Turns]\n{summary_text}",
        }
    )
    if file_notes:
        synthetic_content.append(
            {
                "type": "text",
                "text": f"[Footnote: Attached Files Context]\n{file_notes}",
            }
        )
    for img in images_payloads:
        synthetic_content.append(img)

    sliced_messages = [
        messages[0],
        {"role": "user", "content": synthetic_content},
    ] + messages[orig_boundary_idx + 1 :]

    return sliced_messages

import json
from backend.database import db
from typing import List, Optional, Any

def manage_task_list(
    action: str,
    items: Optional[List[str]] = None,
    step_id: Optional[int] = None,
    status: Optional[str] = None,
    notes: Optional[str] = None,
    chat_id: str = None,
    parent_message_id: Any = None,
    turn_anchor_id: Any = None,
    parent_type: str = "main",
    **kwargs
) -> str:
    """
    Creates, updates, or views a persistent task list/checklist.
    """
    try:
        # Use turn_anchor_id if provided (stable for the duration of a turn).
        # Fall back to parent_message_id for sub-agents (their tool_call_id).
        anchor = turn_anchor_id if turn_anchor_id is not None else parent_message_id
        
        current_tasks = db.get_task_list(chat_id, parent_id=anchor, parent_type=parent_type)

        if action == "initialize":
            new_tasks = []
            if items:
                for idx, item in enumerate(items):
                    new_tasks.append({
                        "id": idx + 1,
                        "description": item,
                        "status": "TODO",
                        "notes": ""
                    })
            db.set_task_list(chat_id, new_tasks, parent_id=anchor, parent_type=parent_type)
            return json.dumps(new_tasks, indent=2)

        elif action == "add_step":
            if not items:
                return "Error: 'items' parameter is required for add_step."
            
            start_id = 1
            if current_tasks:
                start_id = max([t.get("id", 0) for t in current_tasks]) + 1
                
            for idx, item in enumerate(items):
                current_tasks.append({
                    "id": start_id + idx,
                    "description": item,
                    "status": "TODO",
                    "notes": ""
                })
            db.set_task_list(chat_id, current_tasks, parent_id=anchor, parent_type=parent_type)
            return json.dumps(current_tasks, indent=2)

        elif action == "update_status":
            if step_id is None or status is None:
                return "Error: 'step_id' and 'status' parameters are required for update_status."
            
            try:
                step_id = int(step_id)
            except ValueError:
                return "Error: 'step_id' must be an integer."

            found = False
            for task in current_tasks:
                if task.get("id") == step_id:
                    task["status"] = status
                    if notes:
                        task["notes"] = notes
                    found = True
                    break
            
            if not found:
                return f"Error: Task with step_id {step_id} not found."
                
            db.set_task_list(chat_id, current_tasks, parent_id=anchor, parent_type=parent_type)
            return json.dumps(current_tasks, indent=2)

        elif action == "view":
            return json.dumps(current_tasks, indent=2)

        else:
            return f"Error: Unknown action '{action}'"
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to manage task list: {e}", exc_info=True)
        return json.dumps({"error": f"Failed to manage task list: {str(e)}"}, indent=2)

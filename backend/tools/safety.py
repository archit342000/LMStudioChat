import json
from typing import List, Dict, Any, Optional
from backend import config

class ToolExecutionRecord:
    """
    Represents a single tool invocation and its execution output.
    Allows diagnosing if a tool call was successful or resulted in an error.
    """
    def __init__(self, name: str, arguments: Any, result: str, tool_call_id: str):
        self.name = name
        self.arguments = arguments
        self.result = result
        self.tool_call_id = tool_call_id
        
        # Safely coerce result to a string if it's a list, dict, or other non-string type
        if not isinstance(result, str):
            if isinstance(result, (list, dict)):
                try:
                    result_str = json.dumps(result)
                except Exception:
                    result_str = str(result)
            else:
                result_str = str(result) if result is not None else ""
        else:
            result_str = result

        # Clean up output string to detect error responses
        res_str = result_str.strip().lower()
        self.is_error = (
            res_str.startswith(("error", "failed", "exception", "err:", "fail:"))
            or "traceback" in res_str
            or "integrityerror" in res_str
            or "foreign key constraint failed" in res_str
        )

        # Recursively check structured dicts/lists for nested errors
        if not self.is_error and isinstance(result, (list, dict)):
            def _has_error(val: Any) -> bool:
                if isinstance(val, str):
                    val_lower = val.strip().lower()
                    return (
                        val_lower.startswith(("error", "failed", "exception", "err:", "fail:"))
                        or "traceback" in val_lower
                    )
                elif isinstance(val, dict):
                    return any(_has_error(k) or _has_error(v) for k, v in val.items())
                elif isinstance(val, list):
                    return any(_has_error(x) for x in val)
                return False
            
            self.is_error = _has_error(result)

def extract_tool_records(db_history: List[Dict[str, Any]]) -> List[ToolExecutionRecord]:
    """
    Reconstructs the chronological sequence of tool calls and their execution results
    from the sub-agent's chat history.
    """
    records = []
    
    # 1. Map tool_call_id -> execution result content
    tool_results = {}
    for msg in db_history:
        if msg.get("role") == "tool" and msg.get("tool_call_id"):
            tool_results[msg["tool_call_id"]] = msg.get("content", "")
            
    # 2. Match assistant tool_calls with their results
    for msg in db_history:
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            for tc in msg["tool_calls"]:
                tc_id = tc.get("id")
                func = tc.get("function", {})
                name = func.get("name")
                args_raw = func.get("arguments", {})
                
                # Parse arguments safely
                if isinstance(args_raw, str):
                    try:
                        args = json.loads(args_raw)
                    except Exception:
                        args = args_raw
                else:
                    args = args_raw
                    
                result_content = tool_results.get(tc_id, "")
                
                records.append(ToolExecutionRecord(
                    name=name,
                    arguments=args,
                    result=result_content,
                    tool_call_id=tc_id
                ))
                
    return records

def run_safety_audit(
    db_history: List[Dict[str, Any]], 
    task_list: List[Dict[str, Any]],
    stagnation_threshold: Optional[int] = None,
    error_threshold: Optional[int] = None,
    tool_threshold: Optional[int] = None
) -> Optional[str]:
    """
    Performs multiple dynamic safety audits: Error Loops, Tool Loops, and Task Stagnation.
    Returns a unified SYSTEM warning prompt if any checks fail, or None.
    """
    # Load thresholds from global configuration if not explicitly overridden
    stag_thresh = stagnation_threshold if stagnation_threshold is not None else config.AGENT_SAFETY_STAGNATION_THRESHOLD
    err_thresh = error_threshold if error_threshold is not None else config.AGENT_SAFETY_ERROR_LOOP_THRESHOLD
    tool_thresh = tool_threshold if tool_threshold is not None else config.AGENT_SAFETY_TOOL_LOOP_THRESHOLD

    records = extract_tool_records(db_history)
    warnings = []

    if not records:
        return None

    # Calculate consecutive identical calls (same tool + same arguments)
    last_record = records[-1]
    consecutive_count = 0
    for r in reversed(records):
        if r.name == last_record.name and r.arguments == last_record.arguments:
            consecutive_count += 1
        else:
            break

    # 🚨 CHECK 1 & 2: Tool repetition loops
    if consecutive_count >= 2:
        if last_record.is_error:
            # Check 1: Broken Tool Call Repeats (Error Loop)
            if consecutive_count >= err_thresh:
                warnings.append(f"""### ❌ REPETITIVE ERROR DETECTED
You have called the tool `{last_record.name}` with the exact same arguments `{last_record.arguments}` {consecutive_count} times consecutively, and the executions failed.
* **Last Error Output:** `{last_record.result}`
* **Requirement:** You MUST change your approach immediately. Adjust your arguments, check spelling/paths, check browser interactive elements, or choose a different tool. Repeating the same failing action is prohibited.""")
        else:
            # Check 2: Duplicate Successful Tool Calls (Tool Loop)
            if consecutive_count >= tool_thresh:
                warnings.append(f"""### 🔄 DUPLICATE ACTION LOOP DETECTED
You have executed `{last_record.name}` with the exact same arguments `{last_record.arguments}` {consecutive_count} times consecutively. 
Although the tool succeeded, repeating the same action indicates you are spinning your wheels (e.g., repeatedly reading the same page or making the same query without moving forward).
* **Requirement:** Evaluate your progress. If this action is not yielding new results or changes to the state, you must pivot, update your task list to reflect your observations, and move to the next logical step.""")

    # 📝 CHECK 3: Task List Stagnation
    if task_list:
        turns_since_update = 0
        for msg in reversed(db_history):
            if msg.get("role") == "assistant":
                has_update = False
                tool_calls = msg.get("tool_calls")
                if tool_calls:
                    for tc in tool_calls:
                        func = tc.get("function", {})
                        if func.get("name") == "manage_task_list":
                            args = func.get("arguments", {})
                            if isinstance(args, str):
                                try:
                                    args = json.loads(args)
                                except Exception:
                                    args = {}
                            if args.get("action") in ["initialize", "add_step", "update_status"]:
                                has_update = True
                                break
                if has_update:
                    break
                turns_since_update += 1

        if turns_since_update >= stag_thresh:
            task_list_str = json.dumps(task_list, indent=2)
            warnings.append(f"""### 📋 TASK LIST STAGNATION (Stale for {turns_since_update} turns)
You have executed {turns_since_update} turns without updating your high-level task list.
* **Current Task List:**
```json
{task_list_str}
```
* **Requirement:** Evaluate your checklist status. 
  1. If you have completed any steps, update them to `DONE` using `manage_task_list(action="update_status")`.
  2. If you are stuck or pivoting, add sub-tasks or update step notes.
  3. *False Alarm Exception:* If you are making solid progress on a single complex step and have not reached its end, you may proceed—but ensure you keep your high-level goal in mind.""")

    # Reconstruct all triggered warnings into a single cohesive interrupt prompt
    if warnings:
        unified_alert = "\n\n---\n\n".join(warnings)
        return f"""[SYSTEM INTERRUPT: SAFETY & PROGRESS AUDIT]
Your execution has triggered the following safety/progress alerts:

{unified_alert}

**You must address the alerts above in your next response.**"""

    return None

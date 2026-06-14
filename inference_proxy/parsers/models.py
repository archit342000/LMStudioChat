import json
import uuid
import re
from .base import BaseParser

class StandardParser(BaseParser):
    """Used for Qwen and Nemotron models."""
    start_tags = ("<think>\n", "<think>")
    end_tags = ("</think>\n", "</think>")

class GemmaParser(BaseParser):
    """Used for Google Gemma 4 models."""
    start_tags = ("<|channel>thought\n", "<|channel>thought", "<think>\n", "<think>")
    end_tags = ("<channel|>\n", "<channel|>", "</think>\n", "</think>")
    
    # Tool call tag signatures
    tool_call_start_tags = ("<|tool_call>",)
    tool_call_end_tags = ("<tool_call|>",)

    def parse_tool_call(self, raw_text: str) -> dict:
        """
        Parses raw Gemma 4 tool call text.
        Format expected: "call:NAME{ARG1:<|\"|>VAL1<|\"|>, ...}"
        Returns a standard OpenAI-compatible tool call dict.
        """
        raw_text = raw_text.strip()
        if not raw_text.startswith("call:"):
            # Allow tool calls that miss the "call:" prefix
            content = raw_text
        else:
            content = raw_text[5:]  # strip 'call:'
            
        content = content.strip()
        brace_idx = content.find('{')
        if brace_idx == -1:
            # Check if the entire content is a valid tool name without arguments
            tool_name = content.strip()
            if re.match(r'^[a-zA-Z0-9_-]+$', tool_name):
                args_str = "{}"
            else:
                raise ValueError(f"No arguments opening brace found in tool call: '{raw_text}'")
        else:
            tool_name = content[:brace_idx].strip()
            args_str = content[brace_idx:].strip()
            
        # Try direct JSON parsing first (in case it uses standard JSON formatting or is already valid)
        try:
            parsed_args = json.loads(args_str)
            if isinstance(parsed_args, dict):
                return {
                    "id": f"call_{uuid.uuid4().hex[:12]}",
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "arguments": json.dumps(parsed_args)
                    }
                }
        except Exception:
            pass
            
        # Split args_str by the Gemma 4 string delimiter <|\"|> (or <|"|>)
        parts = re.split(r'<\|\\?\"\|>', args_str)
        
        # If there's an even number of parts, it means there's an odd number of delimiters.
        # This usually means a trailing string was not closed (e.g. due to truncation). Auto-close it.
        if len(parts) % 2 == 0:
            last_part = parts[-1]
            match = re.search(r'([\}\],\s]+)$', last_part)
            if match:
                structural_suffix = match.group(1)
                parts[-1] = last_part[:-len(structural_suffix)]
                parts.append(structural_suffix)
            else:
                parts.append("")
            
        processed_parts = []
        for i, part in enumerate(parts):
            if i % 2 == 1:
                # Odd index: string literal content
                # 1. Escape any invalid backslashes (not followed by valid JSON escape chars)
                escaped_part = self._escape_invalid_json_escapes(part)
                # 2. Wrap and escape in json.dumps
                processed_parts.append(json.dumps(escaped_part))
            else:
                # Even index: structural JSON characters
                # Wrap unquoted identifier keys in double quotes
                quoted_key_part = re.sub(r'(?<!["\'a-zA-Z0-9_-])([a-zA-Z0-9_-]+)(?!["\'a-zA-Z0-9_-])\s*:', r'"\1":', part)
                # Clean trailing commas in structural parts
                quoted_key_part = re.sub(r',\s*(?=[\]}])', '', quoted_key_part)
                processed_parts.append(quoted_key_part)
                
        json_args_str = "".join(processed_parts).strip()
        
        # Auto-close unbalanced curly braces
        if json_args_str.startswith("{"):
            open_braces = json_args_str.count('{')
            close_braces = json_args_str.count('}')
            if open_braces > close_braces:
                json_args_str += "}" * (open_braces - close_braces)
                
        try:
            parsed_args = json.loads(json_args_str)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON validation failed for arguments: {json_args_str}. Error: {str(e)}")
            
        call_id = f"call_{uuid.uuid4().hex[:12]}"
        
        return {
            "id": call_id,
            "type": "function",
            "function": {
                "name": tool_name,
                "arguments": json.dumps(parsed_args)
            }
        }
        
    def _escape_invalid_json_escapes(self, s: str) -> str:
        result = []
        i = 0
        while i < len(s):
            if s[i] == '\\':
                if i + 1 < len(s):
                    next_char = s[i + 1]
                    if next_char in ['"', '\\', '/', 'b', 'f', 'n', 'r', 't']:
                        result.append(s[i:i+2])
                        i += 2
                        continue
                    elif next_char == 'u':
                        if i + 5 < len(s) and all(c in '0123456789abcdefABCDEF' for c in s[i+2:i+6]):
                            result.append(s[i:i+6])
                            i += 6
                            continue
                result.append('\\\\')
                i += 1
            else:
                result.append(s[i])
                i += 1
        return "".join(result)

class PassThroughParser(BaseParser):
    """Used for models like Qwen Coder that do not emit reasoning tags."""
    start_tags = ()
    end_tags = ()


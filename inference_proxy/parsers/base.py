from typing import Tuple

class BaseParser:
    """
    Base parser defining the tag signatures for intercepting reasoning content
    and tool call payloads. If start_tags, end_tags, tool_call_start_tags, 
    and tool_call_end_tags are all empty, the stream is considered pass-through.
    """
    start_tags: Tuple[str, ...] = ()
    end_tags: Tuple[str, ...] = ()
    tool_call_start_tags: Tuple[str, ...] = ()
    tool_call_end_tags: Tuple[str, ...] = ()

    def parse_tool_call(self, raw_text: str) -> dict:
        """
        Parses the extracted raw tool call text and returns a standard
        OpenAI-compatible tool call dict.
        """
        raise NotImplementedError()


class StreamInterceptor:
    """
    A state machine that intercepts raw text chunks and splits them into 
    content, reasoning_content, and tool_calls based on model-specific tags.
    """
    def __init__(self, parser: BaseParser):
        self.parser = parser
        self.in_reasoning_block = False
        self.in_tool_call_block = False
        self.buffer = ""
        self.tool_call_buffer = ""
        self.reasoning_started = False
        self.tool_call_index = 0
    
    def process_chunk(self, content_chunk: str) -> Tuple[str, str, list]:
        """
        Takes raw string from the chunk delta.content.
        Returns (content_to_emit, reasoning_to_emit, tool_calls_to_emit) strings and list.
        """
        # Pass-through for models without reasoning tags and without tool call tags
        if (not self.parser.start_tags or not self.parser.end_tags) and \
           (not self.parser.tool_call_start_tags or not self.parser.tool_call_end_tags):
            return (content_chunk, "", [])
            
        self.buffer += content_chunk
        emit_content = ""
        emit_reasoning = ""
        emit_tool_calls = []
        
        while self.buffer:
            if not self.in_reasoning_block and not self.in_tool_call_block:
                # Looking for start tag of either reasoning or tool calls
                r_match_idx, r_matched_tag = self._find_earliest_tag(self.buffer, self.parser.start_tags)
                tc_match_idx, tc_matched_tag = self._find_earliest_tag(self.buffer, self.parser.tool_call_start_tags)
                
                has_r = r_match_idx != -1
                has_tc = tc_match_idx != -1
                
                if has_r and (not has_tc or r_match_idx < tc_match_idx):
                    # Reasoning block starts first
                    emit_content += self.buffer[:r_match_idx]
                    self.buffer = self.buffer[r_match_idx + len(r_matched_tag):]
                    self.in_reasoning_block = True
                    self.reasoning_started = False
                    continue
                elif has_tc and (not has_r or tc_match_idx <= r_match_idx):
                    # Tool call block starts first
                    emit_content += self.buffer[:tc_match_idx]
                    self.buffer = self.buffer[tc_match_idx + len(tc_matched_tag):]
                    self.in_tool_call_block = True
                    self.tool_call_buffer = ""
                    continue
                
                # Check for partial overlaps
                r_partial_len = self._check_partial_overlap_any(self.buffer, self.parser.start_tags)
                tc_partial_len = self._check_partial_overlap_any(self.buffer, self.parser.tool_call_start_tags)
                
                max_partial = max(r_partial_len, tc_partial_len)
                if max_partial > 0:
                    emit_content += self.buffer[:-max_partial]
                    self.buffer = self.buffer[-max_partial:]
                    break  # Wait for next chunk to complete tag
                else:
                    emit_content += self.buffer
                    self.buffer = ""
            elif self.in_reasoning_block:
                # Looking for end reasoning tag
                match_idx, matched_tag = self._find_earliest_tag(self.buffer, self.parser.end_tags)
                
                if match_idx != -1:
                    # Found exactly
                    emit_reasoning += self.buffer[:match_idx]
                    self.buffer = self.buffer[match_idx + len(matched_tag):]
                    self.in_reasoning_block = False
                    continue
                
                # Check if buffer ends with partial end tag
                partial_match_len = self._check_partial_overlap_any(self.buffer, self.parser.end_tags)
                if partial_match_len > 0:
                    emit_reasoning += self.buffer[:-partial_match_len]
                    self.buffer = self.buffer[-partial_match_len:]
                    break  # Wait for next chunk to complete tag
                else:
                    emit_reasoning += self.buffer
                    self.buffer = ""
            elif self.in_tool_call_block:
                # Looking for end tool call tag
                match_idx, matched_tag = self._find_earliest_tag(self.buffer, self.parser.tool_call_end_tags)
                
                if match_idx != -1:
                    # Found exactly
                    self.tool_call_buffer += self.buffer[:match_idx]
                    self.buffer = self.buffer[match_idx + len(matched_tag):]
                    self.in_tool_call_block = False
                    
                    try:
                        parsed_tc = self.parser.parse_tool_call(self.tool_call_buffer)
                        parsed_tc["index"] = self.tool_call_index
                        self.tool_call_index += 1
                        emit_tool_calls.append(parsed_tc)
                    except Exception as e:
                        raise ValueError(f"Malformed tool call: {str(e)}") from e
                        
                    self.tool_call_buffer = ""
                    continue
                
                # Check if buffer ends with partial end tool call tag
                partial_match_len = self._check_partial_overlap_any(self.buffer, self.parser.tool_call_end_tags)
                if partial_match_len > 0:
                    self.tool_call_buffer += self.buffer[:-partial_match_len]
                    self.buffer = self.buffer[-partial_match_len:]
                    break  # Wait for next chunk to complete tag
                else:
                    self.tool_call_buffer += self.buffer
                    self.buffer = ""
                    
        # Strip leading whitespace from reasoning content
        if emit_reasoning and not self.reasoning_started:
            stripped = emit_reasoning.lstrip()
            if stripped:
                self.reasoning_started = True
                emit_reasoning = stripped
            else:
                emit_reasoning = ""
                    
        return emit_content, emit_reasoning, emit_tool_calls

    def _find_earliest_tag(self, text: str, tags: Tuple[str, ...]) -> Tuple[int, str]:
        earliest_idx = -1
        matched_tag = ""
        for tag in tags:
            idx = text.find(tag)
            if idx != -1:
                if earliest_idx == -1 or idx < earliest_idx:
                    earliest_idx = idx
                    matched_tag = tag
        return earliest_idx, matched_tag

    def _check_partial_overlap_any(self, text: str, tags: Tuple[str, ...]) -> int:
        max_partial = 0
        for tag in tags:
            partial = self._check_partial_overlap(text, tag)
            if partial > max_partial:
                max_partial = partial
        return max_partial

    def _check_partial_overlap(self, text: str, tag: str) -> int:
        """
        Returns the length of the suffix of `text` that is a valid prefix of `tag`.
        Example: text="hello <thi", tag="<think>" -> returns 4 ("<thi")
        """
        max_overlap = min(len(text), len(tag) - 1)
        for i in range(max_overlap, 0, -1):
            if text.endswith(tag[:i]):
                return i
        return 0
        
    def flush(self) -> Tuple[str, str, list]:
        """Call when the stream ends to flush any remaining buffer."""
        if (not self.parser.start_tags or not self.parser.end_tags) and \
           (not self.parser.tool_call_start_tags or not self.parser.tool_call_end_tags):
            ret = (self.buffer, "", [])
            self.buffer = ""
            return ret
            
        emit_content = ""
        emit_reasoning = ""
        emit_tool_calls = []
        
        if self.in_reasoning_block:
            emit_reasoning += self.buffer
        elif self.in_tool_call_block:
            raise ValueError(f"Stream truncated inside tool call buffer: '{self.tool_call_buffer + self.buffer}'")
        else:
            emit_content += self.buffer
            
        self.buffer = ""
        return emit_content, emit_reasoning, emit_tool_calls


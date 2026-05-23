from typing import Tuple

class BaseParser:
    """
    Base parser defining the tag signatures for intercepting reasoning content.
    If start_tags or end_tags are empty, the stream is considered pass-through.
    """
    start_tags: Tuple[str, ...] = ()
    end_tags: Tuple[str, ...] = ()


class StreamInterceptor:
    """
    A state machine that intercepts raw text chunks and splits them into 
    content and reasoning_content based on model-specific tags.
    """
    def __init__(self, parser: BaseParser):
        self.parser = parser
        self.in_reasoning_block = False
        self.buffer = ""
        self.reasoning_started = False
    
    def process_chunk(self, content_chunk: str) -> Tuple[str, str]:
        """
        Takes raw string from the chunk delta.content.
        Returns (content_to_emit, reasoning_to_emit) strings.
        """
        # Pass-through for models without reasoning tags
        if not self.parser.start_tags or not self.parser.end_tags:
            return (content_chunk, "")
            
        self.buffer += content_chunk
        emit_content = ""
        emit_reasoning = ""
        
        while self.buffer:
            if not self.in_reasoning_block:
                # Looking for start tag
                match_idx, matched_tag = self._find_earliest_tag(self.buffer, self.parser.start_tags)
                
                if match_idx != -1:
                    # Found exactly
                    emit_content += self.buffer[:match_idx]
                    self.buffer = self.buffer[match_idx + len(matched_tag):]
                    self.in_reasoning_block = True
                    self.reasoning_started = False
                    continue
                
                # Check if buffer ends with partial start tag
                partial_match_len = self._check_partial_overlap_any(self.buffer, self.parser.start_tags)
                if partial_match_len > 0:
                    emit_content += self.buffer[:-partial_match_len]
                    self.buffer = self.buffer[-partial_match_len:]
                    break  # Wait for next chunk to complete tag
                else:
                    emit_content += self.buffer
                    self.buffer = ""
            else:
                # Looking for end tag
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
                    
        # Strip leading whitespace from reasoning content
        if emit_reasoning and not self.reasoning_started:
            stripped = emit_reasoning.lstrip()
            if stripped:
                self.reasoning_started = True
                emit_reasoning = stripped
            else:
                emit_reasoning = ""
                    
        return emit_content, emit_reasoning

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
        
    def flush(self) -> Tuple[str, str]:
        """Call when the stream ends to flush any remaining buffer."""
        if not self.parser.start_tags or not self.parser.end_tags:
            ret = (self.buffer, "")
            self.buffer = ""
            return ret
            
        emit_content = ""
        emit_reasoning = ""
        if self.in_reasoning_block:
            emit_reasoning += self.buffer
        else:
            emit_content += self.buffer
        self.buffer = ""
        return emit_content, emit_reasoning

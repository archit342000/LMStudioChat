import re
import difflib

class MultipleMatchesError(Exception): pass
class MatchNotFoundError(Exception): pass
class OutOfBoundsError(Exception): pass

def _find_exact_match(document: str, target: str, start_line: int = None, end_line: int = None) -> str:
    """
    Find exact target string in document, constrained by optional start_line and end_line bounds.
    Falls back to whitespace-normalized matching if exact match fails.
    Raises MultipleMatchesError if >1 match.
    Raises MatchNotFoundError if 0 matches.
    Raises OutOfBoundsError if line bounds are invalid.
    """
    lines = document.split('\n')
    
    # 1-indexed to 0-indexed with bounds checking
    start_idx = max(0, start_line - 1) if start_line else 0
    end_idx = min(len(lines), end_line) if end_line else len(lines)
    
    if start_idx >= len(lines) or (start_line and end_line and start_idx > end_idx):
        raise OutOfBoundsError(f"Bounds {start_line}-{end_line} are invalid. Total lines: {len(lines)}")
        
    search_zone = '\n'.join(lines[start_idx:end_idx])
    
    # 1. Exact Match
    count = search_zone.count(target)
    if count == 1:
        return target
    if count > 1:
        raise MultipleMatchesError()
    
    # 2. Whitespace Normalization Fallback
    norm_zone = re.sub(r'\s+', ' ', search_zone)
    norm_tgt = re.sub(r'\s+', ' ', target).strip()
    
    if norm_zone.count(norm_tgt) == 1:
        # Regex to map back to original whitespace bounds
        escaped_words = [re.escape(w) for w in target.split()]
        pattern = r'\s+'.join(escaped_words)
        match = re.search(pattern, search_zone)
        if match:
            return match.group(0)
            
    if norm_zone.count(norm_tgt) > 1:
        raise MultipleMatchesError()
        
    raise MatchNotFoundError()

def _get_fuzzy_hint(document: str, target: str, start_line: int = None, end_line: int = None) -> str:
    """
    Find the most likely match for a failed target string and return a helpful context block.
    """
    lines = document.split('\n')
    start_idx = max(0, start_line - 1) if start_line else 0
    end_idx = min(len(lines), end_line) if end_line else len(lines)
    
    search_zone_lines = lines[start_idx:end_idx]
    if not search_zone_lines:
        return "Search zone is empty."
        
    # We use the first non-empty line of the target as a seed for difflib
    target_lines = [l.strip() for l in target.split('\n') if l.strip()]
    if not target_lines:
        return "Target text is empty."
    
    seed = target_lines[0]
    
    # Find close matches for the seed line in the document
    matches = difflib.get_close_matches(seed, search_zone_lines, n=1, cutoff=0.5)
    
    if matches:
        matched_line = matches[0]
        # Find the actual index of the matched line in the document (the first occurrence in search zone)
        try:
            line_idx = search_zone_lines.index(matched_line)
            actual_line_num = start_idx + line_idx + 1
            
            # Return a window around the match
            context_start = max(0, line_idx - 3)
            context_end = min(len(search_zone_lines), line_idx + 5)
            
            hint_lines = [f"{start_idx + i + 1} | {search_zone_lines[i]}" for i in range(context_start, context_end)]
            return f"I couldn't find an exact match, but I found a similar line at {actual_line_num}. Did you mean to target this area?\n\n" + "\n".join(hint_lines)
        except ValueError:
            pass
            
    # Fallback: Just return a small sample of the zone
    sample_size = min(10, len(search_zone_lines))
    hint_lines = [f"{start_idx + i + 1} | {search_zone_lines[i]}" for i in range(sample_size)]
    return "Target text not found. Here is the actual content in the specified bounds:\n\n" + "\n".join(hint_lines)

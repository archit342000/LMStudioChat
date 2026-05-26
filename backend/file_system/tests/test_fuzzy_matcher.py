import pytest
from backend.file_system.fuzzy_matcher import _find_exact_match, _get_fuzzy_hint, MultipleMatchesError, MatchNotFoundError, OutOfBoundsError

def test_find_exact_match_basic():
    doc = "line 1\nline 2\nline 3"
    assert _find_exact_match(doc, "line 2") == "line 2"
    
def test_find_exact_match_bounds():
    doc = "line 1\nline 2\nline 3\nline 2"
    assert _find_exact_match(doc, "line 2", start_line=1, end_line=2) == "line 2"
    with pytest.raises(MultipleMatchesError):
        _find_exact_match(doc, "line 2")
        
def test_find_exact_match_out_of_bounds():
    doc = "line 1\nline 2"
    with pytest.raises(OutOfBoundsError):
        _find_exact_match(doc, "line 1", start_line=5)
    with pytest.raises(OutOfBoundsError):
        _find_exact_match(doc, "line 1", start_line=4, end_line=2)

def test_find_exact_match_whitespace_fallback():
    doc = "def foo():\n    print(1)\n"
    # match normalized whitespace
    target = "def foo():\n  print(1)"
    assert _find_exact_match(doc, target) == "def foo():\n    print(1)"
    
def test_find_exact_match_whitespace_fallback_multiple():
    doc = "def foo():\n    print(1)\ndef foo():\n\tprint(1)\n"
    target = "def foo():\n  print(1)"
    with pytest.raises(MultipleMatchesError):
        _find_exact_match(doc, target)

def test_find_exact_match_not_found():
    doc = "line 1"
    with pytest.raises(MatchNotFoundError):
        _find_exact_match(doc, "line 2")

def test__get_fuzzy_hint():
    assert _get_fuzzy_hint("", "test", start_line=2) == "Search zone is empty."
    assert _get_fuzzy_hint("test", "") == "Target text is empty."

def test_get_fuzzy_hint_match():
    doc = "a b c\nd e f\nx y z\n1 2 3"
    hint = _get_fuzzy_hint(doc, "d e f x")
    assert "I couldn't find an exact match" in hint
    assert "2 | d e f" in hint

def test_get_fuzzy_hint_fallback():
    doc = "a b c\nd e f\nx y z"
    hint = _get_fuzzy_hint(doc, "1 2 3")
    assert "Target text not found" in hint
    assert "1 | a b c" in hint

def test_find_exact_match_extreme_whitespace_normalization():
    # Document with mixed spacing, tabs, and carriage returns (\r\n)
    doc = "first line\r\nsecond\t\tline\r\n\r\nthird   line\n"
    
    # 1. Match with tabs and carriage returns
    target1 = "second  line"
    assert _find_exact_match(doc, target1) == "second\t\tline"
    
    # 2. Match with multiple blank lines and spaces
    target2 = "third line"
    assert _find_exact_match(doc, target2) == "third   line"

def test_find_exact_match_exact_bounds_slicing():
    doc = "line 1\nline 2\nline 3"
    
    # Slice first line exactly
    assert _find_exact_match(doc, "line 1", start_line=1, end_line=1) == "line 1"
    
    # Slice last line exactly
    assert _find_exact_match(doc, "line 3", start_line=3, end_line=3) == "line 3"
    
    # Slice middle exactly
    assert _find_exact_match(doc, "line 2", start_line=2, end_line=2) == "line 2"


import pytest
from backend.file_types import EXHAUSTIVE_TEXT_EXTENSIONS

def test_file_types_mapping():
    assert '.py' in EXHAUSTIVE_TEXT_EXTENSIONS
    assert EXHAUSTIVE_TEXT_EXTENSIONS['.py'] == 'text/x-python'
    assert '.js' in EXHAUSTIVE_TEXT_EXTENSIONS
    assert EXHAUSTIVE_TEXT_EXTENSIONS['.js'] == 'application/javascript'
    assert '.md' in EXHAUSTIVE_TEXT_EXTENSIONS
    assert EXHAUSTIVE_TEXT_EXTENSIONS['.md'] == 'text/markdown'

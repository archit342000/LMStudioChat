import pytest
import os
from unittest.mock import patch, mock_open

from backend.prompts.loader import PromptLoader

def test_load_template_success():
    mock_template = "<test_tag>{param1} and {param2}</test_tag>"
    with patch("builtins.open", mock_open(read_data=mock_template)), \
         patch("os.path.exists", return_value=True):
        res = PromptLoader.load_template("test_template", param1="hello", param2="world")
        assert res == "<test_tag>hello and world</test_tag>"

def test_load_template_missing_file():
    with patch("os.path.exists", return_value=False):
        with pytest.raises(FileNotFoundError):
            PromptLoader.load_template("non_existent")

def test_load_template_missing_placeholder():
    mock_template = "<tag>{required_param}</tag>"
    with patch("builtins.open", mock_open(read_data=mock_template)), \
         patch("os.path.exists", return_value=True):
        with pytest.raises(KeyError, match="Missing placeholder variable"):
            PromptLoader.load_template("test_template")

def test_load_examples_success():
    # Setup static examples mock
    mock_yaml = """
test_agent:
  - query: "Check status"
    examples: "User: run status\\nAssistant: running status"
"""
    with patch("builtins.open", mock_open(read_data=mock_yaml)), \
         patch("os.path.exists", return_value=True):
        # Clear cache first
        PromptLoader._cached_examples = None
        examples = PromptLoader.load_examples("test_agent")
        
        assert "## FEW-SHOT EXAMPLES" in examples
        assert "<few_shot_example index=\"0\">" in examples
        assert "<user_query>\nCheck status\n</user_query>" in examples
        assert "User: run status\nAssistant: running status" in examples

def test_load_examples_not_found():
    with patch("os.path.exists", return_value=False):
        PromptLoader._cached_examples = None
        examples = PromptLoader.load_examples("unknown_agent")
        assert examples == ""

#!/usr/bin/env python3
import os
import re
import sys
import yaml
from string import Formatter
from typing import List, Tuple, Dict, Any

TEMPLATE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "backend", "prompts", "templates")
)
EXAMPLES_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "backend", "prompts", "examples.yaml")
)

# Tag regex to find <tag> and </tag>
TAG_REGEX = re.compile(r"<(/?[a-zA-Z_][a-zA-Z0-9_\-]*)(?:\s+[^>]*)?>")

def check_xml_tags(content: str) -> List[str]:
    """
    Check if XML tags in the content are balanced and correctly nested.
    Returns a list of error messages (empty if no errors).
    """
    errors = []
    stack = []
    
    for match in TAG_REGEX.finditer(content):
        tag_str = match.group(0)
        tag_name = match.group(1)
        
        # Check if self-closing (ends with />)
        if tag_str.endswith("/>"):
            continue
            
        if tag_name.startswith("/"):
            # Closing tag
            close_name = tag_name[1:]
            if not stack:
                errors.append(f"Mismatched closing tag {tag_str} with no open tag.")
            else:
                open_name, open_str = stack.pop()
                if open_name != close_name:
                    errors.append(f"Mismatched tags: open tag {open_str} closed by {tag_str}.")
        else:
            # Opening tag
            stack.append((tag_name, tag_str))
            
    # Check for remaining unclosed tags
    while stack:
        open_name, open_str = stack.pop()
        errors.append(f"Unclosed tag: {open_str} has no matching closing tag.")
        
    return errors

def check_placeholders(content: str) -> Tuple[List[str], List[str]]:
    """
    Check if curly brace placeholders are syntactically valid for .format().
    Returns a tuple of (errors, list_of_placeholders).
    """
    errors = []
    placeholders = []
    formatter = Formatter()
    try:
        for literal_text, field_name, format_spec, conversion in formatter.parse(content):
            if field_name is not None:
                placeholders.append(field_name)
    except ValueError as e:
        errors.append(f"Invalid placeholder or unbalanced curly braces: {e}")
        
    return errors, placeholders

def validate_templates() -> List[str]:
    """
    Validate all prompt templates in the TEMPLATE_DIR.
    Returns a list of validation errors.
    """
    errors = []
    if not os.path.exists(TEMPLATE_DIR):
        return [f"Template directory does not exist: {TEMPLATE_DIR}"]
        
    for filename in sorted(os.listdir(TEMPLATE_DIR)):
        if not filename.endswith(".txt"):
            continue
            
        path = os.path.join(TEMPLATE_DIR, filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            errors.append(f"Error reading file {filename}: {e}")
            continue
            
        # 1. Check XML tags
        tag_errors = check_xml_tags(content)
        for err in tag_errors:
            errors.append(f"[{filename}] XML error: {err}")
            
        # 2. Check string formatting placeholders
        fmt_errors, placeholders = check_placeholders(content)
        for err in fmt_errors:
            errors.append(f"[{filename}] Placeholder error: {err}")
            
    return errors

def run_all_evals() -> bool:
    """
    Run all evaluations and print findings. Returns True if all evaluations pass, False otherwise.
    """
    print("=== Running Prompt Evaluations ===")
    
    print("\n1. Validating prompt templates...")
    template_errors = validate_templates()
    if template_errors:
        print(f"❌ Failed. Found {len(template_errors)} errors:")
        for err in template_errors:
            print(f"  - {err}")
    else:
        print("✅ All prompt templates are valid.")
        
    total_errors = len(template_errors)
    print(f"\nEvaluation summary: {total_errors} errors found.")
    return total_errors == 0

if __name__ == "__main__":
    success = run_all_evals()
    sys.exit(0 if success else 1)

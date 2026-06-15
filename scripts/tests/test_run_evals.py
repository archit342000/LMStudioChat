from scripts.run_evals import check_xml_tags, check_placeholders, validate_templates

def test_check_xml_tags_balanced():
    content = "<system_identity>Hello World</system_identity>"
    errors = check_xml_tags(content)
    assert not errors

def test_check_xml_tags_unbalanced():
    content = "<system_identity>Hello World"
    errors = check_xml_tags(content)
    assert len(errors) == 1
    assert "Unclosed tag" in errors[0]

def test_check_xml_tags_mismatched():
    content = "<system_identity>Hello World</constraints>"
    errors = check_xml_tags(content)
    assert len(errors) == 1
    assert "Mismatched tags" in errors[0] or "Mismatched closing tag" in errors[0]

def test_check_xml_tags_self_closing():
    content = "<tag_name />"
    errors = check_xml_tags(content)
    assert not errors

def test_check_placeholders_valid():
    content = "Hello {name}, your task is {task}."
    errors, placeholders = check_placeholders(content)
    assert not errors
    assert set(placeholders) == {"name", "task"}

def test_check_placeholders_invalid():
    content = "Hello {name"
    errors, placeholders = check_placeholders(content)
    assert len(errors) == 1
    assert "Invalid placeholder" in errors[0]

def test_validate_actual_templates():
    errors = validate_templates()
    assert not errors, f"Actual templates validation failed: {errors}"

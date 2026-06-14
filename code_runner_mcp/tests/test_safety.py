from safety import classify_code

def test_python_safety():
    assert classify_code("print('Hello')", "python") == "safe"
    assert classify_code("x = 1 + 2", "python") == "safe"
    assert classify_code("import os", "python") == "dangerous"
    assert classify_code("from os import path", "python") == "dangerous"
    assert classify_code("open('test.txt', 'r')", "python") == "dangerous"

def test_sql_safety():
    assert classify_code("SELECT * FROM users", "sql") == "safe"
    assert classify_code("INSERT INTO users VALUES (1)", "sql") == "dangerous"
    assert classify_code("DROP TABLE users", "sql") == "dangerous"
    assert classify_code("-- comment\nSELECT * FROM test", "sql") == "safe"

def test_bash_safety():
    assert classify_code("echo hello", "bash") == "dangerous"

def test_c_safety():
    assert classify_code("int main() { return 0; }", "c") == "safe"
    assert classify_code("int main() { system(\"rm -rf /\"); }", "c") == "dangerous"

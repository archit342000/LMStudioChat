import re
from typing import Dict, List

# Define regex patterns or keyword lists for dangerous commands per language
DANGEROUS_PATTERNS: Dict[str, List[str]] = {
    "python": [
        r"\bimport\s+(?:os|subprocess|socket|shutil|requests|urllib|sys|builtins|importlib)\b",
        r"\bfrom\s+(?:os|subprocess|socket|shutil|requests|urllib|sys|builtins|importlib)\s+import\b",
        r"\bopen\s*\(",
        r"\beval\s*\(",
        r"\bexec\s*\(",
        r"\b__import__\s*\(",
    ],
    "c": [
        r"\bsystem\s*\(",
        r"\bexec[l|p|v|e]*\s*\(",
        r"\bfork\s*\(",
        r"\bpopen\s*\(",
        r"\bfopen\s*\(",
        r"\bFILE\s*[*]",
        r"#include\s+<sys/socket\.h>",
        r"#include\s+<unistd\.h>",
    ],
    "cpp": [
        r"\bsystem\s*\(",
        r"\bexec[l|p|v|e]*\s*\(",
        r"\bfork\s*\(",
        r"\bpopen\s*\(",
        r"\bfopen\s*\(",
        r"\bFILE\s*[*]",
        r"#include\s+<sys/socket\.h>",
        r"#include\s+<unistd\.h>",
        r"\bstd::filesystem\b",
        r"\bstd::ofstream\b",
        r"\bstd::ifstream\b",
        r"\bstd::fstream\b",
    ],
    "java": [
        r"\bProcessBuilder\b",
        r"\bRuntime\.getRuntime\s*\(\s*\)\.exec\b",
        r"\bSocket\b",
        r"\bServerSocket\b",
        r"\bFileWriter\b",
        r"\bFileOutputStream\b",
        r"\bFileInputStream\b",
        r"\bFileReader\b",
        r"\bFile\b",
        r"\bFiles\s*\.",
        r"\bPath\s*\.",
    ],
    "javascript": [
        r"\bchild_process\b",
        r"\bfs\b",
        r"\bnet\b",
        r"\bfetch\s*\(",
        r"\bXMLHttpRequest\b",
        r"\brequire\s*\(\s*['\"](?:child_process|fs|net|http|https)['\"]\s*\)",
        r"\bimport\s+.*\s+from\s+['\"](?:child_process|fs|net|http|https)['\"]",
    ],
    "typescript": [
        r"\bchild_process\b",
        r"\bfs\b",
        r"\bnet\b",
        r"\bfetch\s*\(",
        r"\bXMLHttpRequest\b",
        r"\brequire\s*\(\s*['\"](?:child_process|fs|net|http|https)['\"]\s*\)",
        r"\bimport\s+.*\s+from\s+['\"](?:child_process|fs|net|http|https)['\"]",
    ],
    "go": [
        r"\bos/exec\b",
        r"\bos\.Create\b",
        r"\bos\.Open\b",
        r"\bos\.OpenFile\b",
        r"\bnet\.Dial\b",
        r"\bnet\.Listen\b",
    ],
    "rust": [
        r"\bstd::process::Command\b",
        r"\bstd::fs::\b",
        r"\bstd::net::\b",
    ],
    "php": [
        r"\bexec\s*\(",
        r"\bsystem\s*\(",
        r"\bshell_exec\s*\(",
        r"\bpassthru\s*\(",
        r"\bpopen\s*\(",
        r"\bfopen\s*\(",
        r"\bfile_get_contents\s*\(",
        r"\bfsockopen\s*\(",
    ],
}

def classify_code(code: str, language: str) -> str:
    """
    Classify whether a piece of code is 'safe' or 'dangerous'.
    Returns 'dangerous' or 'safe'.
    """
    lang = language.lower()

    # Bash scripts are always dangerous
    if lang == "bash":
        return "dangerous"

    # SQL safety logic: Only pure SELECT queries are safe
    if lang == "sql":
        # Remove comments first to avoid false positives
        clean_code = re.sub(r"--.*?\n", "", code)
        clean_code = re.sub(r"/\*.*?\*/", "", clean_code, flags=re.DOTALL)
        
        # Check for mutative statements
        mutative_patterns = [
            r"\bINSERT\b", r"\bUPDATE\b", r"\bDELETE\b", r"\bDROP\b",
            r"\bALTER\b", r"\bCREATE\b", r"\bTRUNCATE\b", r"\bGRANT\b",
            r"\bREVOKE\b", r"\bREPLACE\b"
        ]
        for pattern in mutative_patterns:
            if re.search(pattern, clean_code, re.IGNORECASE):
                return "dangerous"
        return "safe"

    # Check for matched patterns in registered languages
    patterns = DANGEROUS_PATTERNS.get(lang, [])
    for pattern in patterns:
        if re.search(pattern, code):
            return "dangerous"

    return "safe"

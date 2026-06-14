# code_runner_mcp
**Role:** An isolated, sandboxed REST API server for compiling and executing multi-file scripts and managing packages.

## 📂 Subdirectories
| Folder | Responsibility |
| :--- | :--- |
| `tests/` | Unit tests for server, executor, and safety logic. |

## 📄 Core Files
| File | Purpose | Key Symbols/Exports |
| :--- | :--- | :--- |
| `server.py` | FastAPI application defining the endpoints and authorization. | `app`, `verify_api_key` |
| `executor.py` | Language-specific execution engine implementing subprocess execution, directory recreation, class parsing, and SQLite/MySQL setups. | `CodeExecutor`, `ExecutionResult` |
| `safety.py` | Heuristics-based static analysis classifier for detecting potentially dangerous execution patterns. | `classify_code` |

## 🧩 Architectural Context
*   **Dependencies:**
    - `fastapi`, `uvicorn`: Web frameworks.
    - Various OS language runtimes (gcc, g++, default-jdk, nodejs, npm, tsx, golang, rustc, php-cli, sqlite3, default-mysql-client).
*   **Flow:**
    1. The main app container makes an HTTP request to `/execute`, `/install`, or `/packages`.
    2. `server.py` verifies the `X-API-KEY` header.
    3. For `/execute`, `executor.py` writes the requested files into a temporary sandbox directory, sets the cwd to the parent of the entry file, executes the code via a subprocess as the non-privileged `runner` user, and cleans up the sandbox directory.

## 🛠️ Usage & Conventions
*   **Patterns:** Sandbox isolation by recreating the directory structure under `/tmp/sandbox/<uuid>/` for each run.
*   **Testing:**
    - Test files are in `code_runner_mcp/tests/`.
    - To run tests: `venv/bin/python -m pytest code_runner_mcp/tests/`

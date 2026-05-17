# AI Agent Documentation & Navigation Guide

## 🛑 STRICT COMPLIANCE DIRECTIVES (MANDATORY WORKFLOW)

To ensure deterministic behavior, you MUST adhere strictly to the following sequence for every task:

**1. Mandatory "Proof of Reading" (Documentation)**
Whenever entering a directory to modify code, your *first* action MUST be to read its `README.md`.
* You MUST output a `<doc_context>` block in your response summarizing the 'Architectural Context' to prove you understand the local rules *before* writing code.

**2. Mandatory Test Verification (Testing)**
You are prohibited from modifying implementation code without simultaneously maintaining its test file.
* Every source file requires a 1:1 `tests/test_<module>.py` file.
* To complete a task, you MUST run the test (e.g., `venv/bin/python -m pytest <test_path>`) and confirm passing output.

**3. Required "Compliance Check" Output**
At the end of every execution phase, you MUST output this exact block:
> **Compliance Check:**
> * **Documentation:** [Did you read/update the local README.md?]
> * **Testing:** [Path to test file and confirmation of passing execution]

---

This document provides essential context, architectural constraints, and operational rules for AI agents working on the `My-AI` repository.

## System Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, CSS3, ES6+ (no frameworks) |
| Backend | Python 3.12 Flask |
| Inference | External llama.cpp server (OpenAI-compatible) |
| Vector DB | ChromaDB |
| Storage | SQLite |

**MCP Architecture**: External tools run in isolated containers (`tavily_mcp`, `playwright_mcp`).

---

## Project Boundaries & Inference

**IMPORTANT**: There is a strict separation between this application and the inference infrastructure.

1.  **Inference is External**: The `llama.cpp` server is a **separate repository**.
2.  **No Orchestration**: This codebase contains **zero** logic for starting, managing, or deploying the inference server.
3.  **Consumption Only**: The application purely consumes the inference API via URLs and API Keys provided in the `secrets/` directory.

Any attempt to add inference orchestration (Docker services, model loaders, etc.) to this repository is a violation of the system architecture.

---

## 🧭 Navigation Directives

1.  **Read First:** Before exploring a directory's source code, check for a `README.md` file within that directory.
2.  **Top-Down Exploration:** Start from the root documentation and follow links or directory structures down to specific sub-modules.
3.  **Context Alignment:** Use the "Architectural Context" and "Role" sections in READMEs to align your understanding of a module's intent before suggesting changes.
4.  **Verification:** If a `README.md` exists but seems out of sync with the actual files, prioritize the source code as the source of truth but flag the documentation for an update.

## Documentation Compliance

**Critical**: The hierarchical `README.md` files located throughout the directories (e.g., `backend/README.md`) define the correct architecture and patterns for this codebase. Code must always adhere to this distributed documentation. Before starting any operation within a module, you must read its relevant `README.md` file to align with its intended role and context.

**If you encounter drift between code and documentation**:
1. **Stop** - do not proceed with changes that violate documentation
2. Request explicit permission from the user
3. Once approved, update the relevant documentation to reflect the new approach
4. Only then proceed with implementation

This ensures the documentation remains accurate and authoritative.

## 🧪 Testing Directives

Whenever a change is made to the codebase, the following testing protocol must be followed:

1.  **1:1 Test Mapping:** Every source file in a directory must have a corresponding dedicated test file in its `tests/` subdirectory (e.g., `module_name.py` must have `tests/test_module_name.py`).
2.  **Exhaustive Function & Class Coverage:** Each test script must comprehensively test *every* function within the file. If the file contains class definitions, the class must be tested as a whole, including *all* of its functionalities and methods.
3.  **Local Verification:** Run the tests located within the directory where the change occurred.
4.  **Hierarchical Regression Testing (Cascading Upwards):** When a change is made in a nested module (e.g., `backend/database/wrappers/x.py`), you must run the tests not only for that specific directory, but also recursively execute the test suites in every parent directory up to the root (e.g., `backend/database/tests/`, `backend/tests/`, and finally `tests/`). This ensures lower-level changes do not break higher-level systems.
5.  **Update Requirement:** If the implementation change breaks existing tests, the tests must be updated to reflect the new intended behavior.
6.  **No Regression Rule:** Ensure that local changes do not break unrelated functionality in higher-level systems.
7.  **Audit:** For agents, you must summarize the test results in your response to confirm that validation was completed.

## 🛠️ Creating New Documentation

When a new directory is created, a `README.md` must be added using the following standard template:

```markdown
# [Directory Name]
**Role:** A single-sentence summary of the directory's core responsibility.

## 📂 Subdirectories
| Folder | Responsibility |
| :--- | :--- |
| `subdirectory/` | Brief description of its focus. |

## 📄 Core Files
| File | Purpose | Key Symbols/Exports |
| :--- | :--- | :--- |
| `module.py` | What it does. | `MainClass`, `helper_function` |

## 🧩 Architectural Context
*   **Dependencies:** List key internal/external dependencies.
*   **Flow:** Describe how data/control flows through this directory.

## 🛠️ Usage & Conventions
*   **Patterns:** Note any specific design patterns or coding standards.
*   **Testing:** Location or commands for tests.
```

## 🔄 Updating Documentation

Documentation should be updated in the following scenarios:
- **File Changes:** When files are added, removed, or renamed within a directory.
- **Responsibility Shifts:** When a module's role or architectural context changes.
- **Dependency Changes:** When significant new dependencies are introduced.
- **Refinement:** When an agent or developer discovers a more accurate way to describe the flow or usage of a module.

### Update Workflow
1.  **Identify:** Scan the directory for changes not reflected in the `README.md`.
2.  **Draft:** Update the tables and descriptions while maintaining the established structure.
3.  **Prune:** Remove references to files or subdirectories that no longer exist.
4.  **Sync:** Ensure that "Architectural Context" still accurately reflects the current implementation.

---

## Critical Rules for AI Agents

1. **Library/Tool Versions**: Always confirm the latest version of any required library or tool from the internet before use. Consult their official documentation as needed.

2. **Python is NEVER to be used directly**: 
   - **Always** use the Python interpreter from `venv/` for ALL Python tasks
   - Activate with: `source venv/bin/activate`
   - Or use directly: `venv/bin/python <script.py>`
   - This applies to testing, development, and any code execution

3. **Frontend**: No frameworks. Single `static/script.js`, CSS Custom Properties only.

4. **Database**: Always use `db` from `backend.database`. Never write raw SQL.

5. **Configuration**: All config in `backend/config.py`. Never hardcode values.

6. **Logging**: Use `log_event()` from `backend.logging`, not `print()`.

7. **Branch Naming**: All branches start with version number (e.g., `3.1.0-feature-name`).

8. **Docker**: Never modify existing containers. Build temporary ones with unique names.

9. **Avoid Tool Call Loops**: If you encounter a pattern of repeated, erroneous tool calls, you must stop the current approach and attempt a different strategy (e.g., different search terms, a different tool, or a different exploration method) instead of repeating the same failing actions.

10. **Avoid Masking Errors with Fallbacks**: Do not implement unnecessary error handling or fallbacks (e.g., empty `try-except` blocks, returning `None` or empty lists instead of propagating errors) that might mask underlying issues. Errors should be handled explicitly or allowed to propagate so they can be detected and debugged.

11. **Avoid Large File Updates**: Even if all changes are within a single file, avoid large, monolithic updates. Instead, apply small, incremental changes to ensure correctness and minimize the risk of error.

---

## Historical Pitfalls

* Missing `<think>` tags (llama.cpp)
* File truncation on edits
* Vision payloads in tool messages
* Database locked errors
* State restoration on failures
* Sandbox first for complex logic
* RAG Grid Search: Ensure synthetic testing data is highly discriminative; generic or repetitive data causes zero-recall metric issues.
* FK Delete Order in `delete_chat`/`delete_all_chats`: SQLite enforces `PRAGMA foreign_keys=ON` per-statement. Child rows in `file_system_versions` and `file_system_permissions` must be deleted **before** `file_systems`, and all chat-level children before `chats`. Omitting `file_system_permissions` entirely, or deleting in wrong order, raises `sqlite3.IntegrityError: FOREIGN KEY constraint failed` when a chat has file attachments. Always wrap the full delete sequence in a single `BEGIN IMMEDIATE` transaction.

**When to add to this section:**
- When you encounter or fix a bug that could affect other agents
- When the user points out issues with your changes that reveal a pattern
- When a fix reveals a deeper architectural or workflow issue

Add a concise description that captures the core lesson.

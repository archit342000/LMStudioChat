# document_agent
**Role:** An autonomous sub-agent specialized in investigating the contents of uploaded files (PDFs, text, code, or images) using RAG, grep, and direct reading.

## 📂 Subdirectories
| Folder | Responsibility |
| :--- | :--- |
| `tests/` | Unit tests for the agent flow, tools, and prompts. |

## 📄 Core Files
| File | Purpose | Key Symbols/Exports |
| :--- | :--- | :--- |
| `agent.py` | Main execution loop and flow logic for file analysis. | `flow_fn`, `is_vision_model` |
| `prompts.py` | System prompts and directives for the document agent. | `DOCUMENT_AGENT_SYSTEM_PROMPT` |
| `tools.py` | Internal tool implementations for the agent (RAG, grep, read). | `document_agent_rag_tool`, `grep_uploaded_file_tool`, `read_uploaded_file_tool` |

## 🧩 Architectural Context
*   **Dependencies:** `backend.database`, `backend.rag`, `backend.models`, `backend.files.manager`.
*   **Flow:** The `flow_fn` initializes the investigation, checks for vision compatibility if it's an image, or enters an autonomous loop using tools to gather facts and synthesize a final response.

## 🛠️ Usage & Conventions
*   **Patterns:** Uses an autonomous loop with task list management to track progress.
*   **Testing:** Local tests are located in `tests/`. Run with `pytest backend/tools/agents/document_agent/tests/`.

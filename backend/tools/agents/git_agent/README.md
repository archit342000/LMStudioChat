# git_agent
**Role:** Autonomous sub-agent for version control operations using git commands.

## 📂 Subdirectories
| Folder | Responsibility |
| :--- | :--- |
| `tests/` | Unit tests for agent flow and integration. |

## 📄 Core Files
| File | Purpose | Key Symbols/Exports |
| :--- | :--- | :--- |
| `agent.py` | Main agent orchestration loop (flow_fn). | `flow_fn` |
| `prompts.py` | System prompt for the git agent. | `GIT_AGENT_SYSTEM_PROMPT` |

## 🧩 Architectural Context
* **Dependencies:** `backend.tools.definitions.GIT_AGENT_INTERNAL_TOOLS`, `backend.tools.implementations.git_executor`, `backend.tools.safety`, `backend.database.db`, `backend.config`
* **Flow:** Invoked by AgentHandler → flow_fn runs a multi-turn loop → calls execute_git (pure tool) via ToolHandler → cloned repos land on disk and become visible to file_system_agent via disk fallback in ls_files/read_fs_file.
* **Pattern:** Identical to file_system_agent — async generator, resume support, task-list enforcement, safety audit, turn limits.

## 🛠️ Usage & Conventions
* **Allowed commands:** Loaded at runtime from `system_settings` DB table (key: `git_allowed_commands`), falling back to `config.GIT_DEFAULT_ALLOWED_COMMANDS`.
* **Push:** Disabled by default. User can enable in System Settings → Git Agent.
* **Testing:** `venv/bin/python -m pytest backend/tools/agents/git_agent/tests/ -v`

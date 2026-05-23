# external_proxy
**Role:** A standalone microservice proxy for the llama.cpp server, responsible for request serialization, tag-parsing, and VRAM-aware model lifecycle swaps.

## 📂 Subdirectories
| Folder | Responsibility |
| :--- | :--- |
| `parsers/` | Contains the StreamInterceptor state machine for extracting `<think>` tags. |
| `tests/` | Exhaustive 1:1 unit test suite. |

## 📄 Core Files
| File | Purpose | Key Symbols/Exports |
| :--- | :--- | :--- |
| `app.py` | Flask application entry point. | `app` |
| `config.py` | Standalone environment-variable based configuration. | `AI_URL`, `EMBEDDING_URL` |
| `logging_utils.py` | Standard Python logging wrappers. | `log_event`, `log_llm_call` |
| `engine.py` | Stateless version of core singleton inference engine. | `InferenceEngine`, `AsyncMPSemaphore` |
| `router.py` | REST API routes for proxying and managing lifecycle. | `models_bp` |
| `lifecycle.py` | Swapping loaded models to manage VRAM. | `ensure_model_loaded` |
| `loader.py` | Loading and validating configurations. | `load_model_config` |

## 🧩 Architectural Context
*   **Dependencies:**
    - `Flask`: API routing web framework.
    - `httpx`: Underlying asynchronous HTTP communication.
    - `gunicorn` (optional): Production wsgi process manager.
*   **Flow:**
    1. Client applications send standard completions/embeddings HTTP requests to the proxy.
    2. `router.py` intercepts requests and passes them to `InferenceEngine`.
    3. `InferenceEngine` executes `ensure_model_loaded()` before hitting the backend server to swap models safely.
    4. SSE streams are intercepted by `parsers/` base machines, dynamically segregating text output from reasoning output.

## 🛠️ Usage & Conventions
*   **Patterns:**
    - **Stateless Operation:** No database connections are maintained; all historical state or media files are resolved app-side before sending.
    - **Concurrency Limits:** Shares concurrency slots via `AsyncMPSemaphore` across active Gunicorn workers.
    - **Testing:**
      - Run suite: `EMBEDDING_URL="http://mock" AI_URL="http://mock" PYTHONPATH=. venv/bin/python -m pytest tests/`

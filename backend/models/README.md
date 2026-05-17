# backend/models
**Role:** Manages the definition, discovery, and lifecycle of AI models (LLMs and embeddings), including model switching (swapping) logic and configuration loading.

## 📂 Subdirectories
| Folder | Responsibility |
| :--- | :--- |

## 📄 Core Files
| File | Purpose | Key Symbols/Exports |
| :--- | :--- | :--- |
| `__init__.py` | Package entry point and export aggregator. | `ensure_model_loaded`, `load_model_config` |
| `config.json` | Central registry for all model names used in the application. | N/A (JSON) |
| `lifecycle.py` | Logic for intelligent model swapping (load/unload). | `ensure_model_loaded`, `get_active_models` |
| `loader.py` | Utilities for loading and validating model configurations. | `load_model_config`, `get_embedding_model` |
| `router.py` | API endpoints for model management and performance testing. | `models_bp` |

## 🧩 Architectural Context
*   **Dependencies:**
    - `backend.config`: Configuration for the remote AI backend URL and credentials.
    - `backend.logging`: Detailed event logging for model load/unload cycles.
    - `httpx`: Used for asynchronous lifecycle management requests.
*   **Flow:**
    1. **Pre-flight Check:** `InferenceEngine` calls `ensure_model_loaded` before starting a turn.
    2. **State Analysis:** `lifecycle.py` queries the server for currently loaded models.
    3. **Category Enforcement:** If a model of the same category (LLM or Embedding) is loaded but differs from the target, it is unloaded to free resources.
    4. **Load Execution:** The target model is loaded, and the system polls until it is ready for inference.

## 🛠️ Usage & Conventions
*   **Patterns:** 
    - **VRAM Optimization:** The logic explicitly unloads other models in the same category before loading a new one to prevent OOM (Out Of Memory) errors on the inference server.
    - **Registry-First:** All model selections must be validated against `config.json`.
*   **Testing:** 
    - **Local:** Unit tests in `tests/` ensure strict compliance with the exhaustive 1:1 testing rule, verifying lifecycle loading/unloading logic, config parsing, and routing endpoints.
    - **Run Command:** `EMBEDDING_URL="http://mock" AI_URL="http://mock" ./venv/bin/python3 -m pytest backend/models/tests/`
    - **Performance:** `router.py` includes a `test-speed` endpoint that performs an automated context accumulation test to measure inference performance across long sequences.

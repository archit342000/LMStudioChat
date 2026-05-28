# inference_proxy/parsers
**Role:** Specialized model output parsers and stateful stream interceptors that separate reasoning/thought blocks from final response text.

## 📂 Subdirectories
| Folder | Responsibility |
| :--- | :--- |
| `tests/` | Unit tests for verifying standard, gemma, and pass-through parser interceptors. |

## 📄 Core Files
| File | Purpose | Key Symbols/Exports |
| :--- | :--- | :--- |
| `__init__.py` | Entry point resolving model strings to the appropriate parser schema. | `get_parser_for_model` |
| `base.py` | Stateful token-matching stream interceptor with partial tag overlap buffering. | `StreamInterceptor`, `BaseParser` |
| `models.py` | Model-specific tags defining standard `<think>`, Gemma thought-channels, or pass-through. | `StandardParser`, `GemmaParser`, `PassThroughParser` |

## 🧩 Architectural Context
*   **Dependencies:** Completely self-contained helper package with zero external package requirements.
*   **Flow:**
    1. **Lookup**: `get_parser_for_model` dynamically maps an LLM model string to its corresponding `BaseParser` subclass configuration.
    2. **Buffering & Processing**: Streamed text chunks are fed sequentially to `StreamInterceptor.process_chunk()`.
    3. **State Machine Filtering**: The interceptor tracks block states (`in_reasoning_block`), buffers incomplete tags, and isolates reasoning content.
    4. **Separate Emits**: Output is split into user-visible content and hidden reasoning content.

## 🛠️ Usage & Conventions
*   **Partial Token Safety**: The parser checks for partial overlaps at the end of each stream block so that tags split across multiple transport packets are resolved correctly rather than leaking into the response.
*   **Testing**:
    - Location: `inference_proxy/parsers/tests/`
    - Run Command: `PYTHONPATH=. ./venv/bin/python -m pytest inference_proxy/parsers/tests/ -v`

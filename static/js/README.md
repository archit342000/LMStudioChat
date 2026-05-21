# js
**Role:** Contains modularized javascript components, utilities, and bundles for the My-AI frontend.

## 📂 Subdirectories
| Folder | Responsibility |
| :--- | :--- |
| `tests/` | Contains unit tests for the modular javascript files located in this directory. |

## 📄 Core Files
| File | Purpose | Key Symbols/Exports |
| :--- | :--- | :--- |
| `agent-renderers.js` | Pure HTML string-building functions for sub-agent UI components. | `_renderSubAgentActivityItemHtml`, `_buildActivityFeedContent` |
| `attachment-manager.js` | Handles file selection, XHR uploading, and the preview UI chips. | `window.AttachmentManager` |
| `bg-animation.js` | Handles the 3D background animation. | N/A |
| `clarification-popover.js` | Universal multiple-choice UI for the `request_clarification` tool. | `showClarificationPopOver` |
| `cm6.bundle.js` | Pre-bundled CodeMirror 6 editor library. | N/A |
| `constants.js` | Shared configuration and constants (e.g. API endpoints, tool UI mappings). | `API_BASE`, `API_MODULES`, `TOOL_DISPLAY_CONFIG` |
| `editor-manager.js` | Manages CodeMirror 6 lazy loading, editor state, and HTML/Markdown previews. | `window.EditorManager` |
| `file-system-ui.js` | Singleton managing the Artifact sidebar, tree rendering, and filtering. | `window.FileSystemUI` |
| `icons.js` | Shared utility for generating agent SVG icons. | `getAgentIcon` |
| `image-modal.js` | Manages the full-screen lightbox overlay for images. | `openImageModal`, `closeImageModal` |
| `modals.js` | Universal dialog system replacing native alerts/confirms. | `showModal`, `showAlert`, `showConfirm`, `showPrompt` |
| `toast.js` | Universal floating toast notifications. | `showToast` |
| `utils.js` | Common utility functions. | `escapeHtml`, `hashContent` |
| `version-manager.js` | Singleton managing Artifact version history, UI, and non-linear Undo/Redo. | `window.VersionManager` |

## 🧩 Architectural Context
*   **Dependencies:** Relies on the broader static application context and DOM elements.
*   **Flow:** Functions are included or imported to provide specialized capabilities (like animations or text editing) independently of the main monolith.

## 🛠️ Usage & Conventions
*   **Patterns:** Functional modularity, ES6 syntax.
*   **Testing:** Location or commands for tests: `static/js/tests/`.
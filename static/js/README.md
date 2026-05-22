# js
**Role:** Contains modularized javascript components, utilities, and bundles for the My-AI frontend.

## 📂 Subdirectories
| Folder | Responsibility |
| :--- | :--- |
| `tests/` | Contains unit tests for the modular javascript files located in this directory. |

## 📄 Core Files
| File | Purpose | Key Symbols/Exports |
| :--- | :--- | :--- |
| `agent-renderers.js` | Pure HTML string-building functions for sub-agent UI components. | `initAgentRenderers`, `getSharedAgentCard`, `appendSubAgentActivity`, `_renderSubAgentActivityItemHtml`, `_buildActivityFeedContent`, `sortActivitiesChronologically`, `renderTaskListCard`, `_renderSubAgentSectionForTurn`, `_renderSubAgentActivityFeed` |
| `agent-config.js` | Governs thinking profiles selectors, budget sliders, and maximum token restraints for specialized backend tool agents. | `window.AgentConfig` |
| `attachment-manager.js` | Handles file selection, XHR uploading, and the preview UI chips. | `window.AttachmentManager` |
| `bg-animation.js` | Handles the 3D background animation. | N/A |
| `browser-portal.js` | Manages the proxied noVNC remote browser session, overlays, and event handlers. | `window.BrowserPortal` |
| `browser-stealth.js` | Manages global browser stealth levels and synchronizes them with the backend. | `window.BrowserStealth` |
| `clarification-popover.js` | Universal multiple-choice UI for the `request_clarification` tool. | `showClarificationPopOver` |
| `cm6.bundle.js` | Pre-bundled CodeMirror 6 editor library. | N/A |
| `constants.js` | Shared configuration and constants (e.g. API endpoints, tool UI mappings). | `API_BASE`, `API_MODULES`, `TOOL_DISPLAY_CONFIG` |
| `context-menu.js` | Manages modern, glassmorphic floating context menus for chats, workspaces, and virtual file systems. | `window.ContextMenu`, `window.showContextMenu` |
| `editor-manager.js` | Manages CodeMirror 6 lazy loading, editor state, and HTML/Markdown previews. | `window.EditorManager` |
| `file-explorer-modal.js` | Interactive modal for selecting paths, creating directories, and moving/renaming items. | `window.FileExplorerModal`, `window.showFileExplorerModal` |
| `file-system-ui.js` | Singleton managing the Artifact sidebar, tree rendering, and filtering. | `window.FileSystemUI` |
| `icons.js` | Shared utility for generating agent SVG icons. | `getAgentIcon` |
| `image-modal.js` | Manages the full-screen lightbox overlay for images. | `openImageModal`, `closeImageModal` |
| `markdown-renderer.js` | Configures marked.js renderer with custom code, blockquotes, images, links, tasks, subscripts, superscripts, and strikethroughs. | N/A |
| `message-manager.js` | Unified message bubble rendering and action lifecycle (append, delete, edit, retry, visibility updates). | `window.MessageManager`, `createMessageBubble`, `appendMessage`, `deleteMessageAction`, `editMessageAction`, `retryMessageAction`, `updateActionVisibility` |
| `modals.js` | Universal dialog system replacing native alerts/confirms. | `showModal`, `showAlert`, `showConfirm`, `showPromptModal` |
| `model-manager.js` | Singleton managing model selection, capability checks, and VRAM loading/unloading flow. | `window.ModelManager` |
| `persona-manager.js` | Singleton managing AI persona definitions, cards listing, customization forms, and default assignments. | `window.PersonaManager` |
| `preferences-manager.js` | Singleton managing custom user memories/preferences, search, tags, custom prompt dialog injections, and backend sync. | `window.PreferencesManager` |
| `scroll-manager.js` | Manages dynamic viewport syncing for iPad virtual keyboard, smart autoscroll, and Safari scroll locking. | `window.setScrollLock`, `window.scrollToBottom`, `window.initScrollManager` |
| `settings-manager.js` | Singleton governing system appearance (themes), chat sampling defaults, settings tabs, and danger-zone bulk resets. | `window.SettingsManager` |
| `toast.js` | Universal floating toast notifications. | `showToast` |
| `telemetry-chart.js` | Diagnostic speed test, SSE streaming metrics, and high-DPI canvas charting. | `window.TelemetryChart` |
| `utils.js` | Common utility functions. | `escapeHtml`, `getAssistantFriendlyContent`, `getIconClassForMime`, `getIconHtmlForMime`, `formatFileSize`, `parseContent`, `formatMarkdown`, `renderMermaidBlocks` |
| `version-manager.js` | Singleton managing Artifact version history, UI, and non-linear Undo/Redo. | `window.VersionManager` |
| `workspace-manager.js` | Singleton managing workspace creation, deletion, rename, chat moves, and localStorage persistence. | `window.WorkspaceManager` |

## 🧩 Architectural Context
*   **Dependencies:** Relies on the broader static application context and DOM elements.
*   **Flow:** Functions are included or imported to provide specialized capabilities (like animations or text editing) independently of the main monolith.

## 🛠️ Usage & Conventions
*   **Patterns:** Functional modularity, ES6 syntax.
*   **Testing:** Location or commands for tests: `static/js/tests/`.
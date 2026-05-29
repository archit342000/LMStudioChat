# static
**Role:** Serves as the frontend root containing the main HTML entry points, global stylesheets, and core javascript logic for the My-AI application.

## 📂 Subdirectories
| Folder | Responsibility |
| :--- | :--- |
| `js/` | Contains modularized javascript logic, bundles, and utility functions. |
| `tests/` | Contains test suites for the frontend files located in the static directory. |

## 📄 Core Files
| File | Purpose | Key Symbols/Exports |
| :--- | :--- | :--- |
| `index.html` | The main user interface for the AI chat application. | N/A |
| `logs.html` | An interface for viewing system logs. | N/A |
| `script.js` | The monolithic script handling core application state, API calls, and UI updates. | N/A |
| `styles.css` | The global stylesheet using CSS custom properties. | N/A |

## 🧩 Architectural Context
*   **Dependencies:** Vanilla HTML5, CSS3, ES6+ (no frameworks). Communicates directly with the Python backend via fetch API.
*   **Flow:** The user interacts with `index.html`. `script.js` orchestrates fetching data from backend APIs and updating the DOM dynamically.

## 🛠️ Usage & Conventions
*   **Patterns:** Vanilla JS, DOM manipulation, fetch API for backend communication. CSS custom properties for styling. No frontend frameworks are allowed.
*   **Testing:** Location or commands for tests: run all tests with `node --test static/tests/test_script.js static/tests/test_logs.js`.
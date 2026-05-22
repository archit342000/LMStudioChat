/**
 * Luminous Chat — Generic Modals & Alerts
 * Extracted from script.js
 */

/**
 * Shows a custom Luminous-styled prompt dialog with folder selection support.
 * @returns {Promise<string|null>} Resolves with the user input or null if cancelled.
 */
window.showPromptModal = async function(
    title,
    message,
    currentVal = "",
    folderList = null,
) {
    return new Promise((resolve) => {
        const modal = document.getElementById("prompt-modal");
        const titleEl = document.getElementById("prompt-title");
        const msgEl = document.getElementById("prompt-message");
        const inputEl = document.getElementById("prompt-input");
        const selectContainer = document.getElementById("prompt-select-container");
        const selectEl = document.getElementById("prompt-select");
        const confirmBtn = document.getElementById("prompt-action-btn");
        const cancelBtn = document.getElementById("prompt-cancel-btn");

        titleEl.textContent = title;
        msgEl.textContent = message;

        const iconSvg = document.getElementById("prompt-icon-svg");
        if (iconSvg) {
            iconSvg.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>`;
        }

        confirmBtn.textContent = "Confirm";
        cancelBtn.textContent = "Cancel";

        inputEl.value = currentVal;

        // --- Folder/Workspace Choice vs Text Input ---
        if (folderList !== null) {
            selectContainer.style.display = "block";
            inputEl.style.display = "none";

            selectEl.innerHTML = '<option value="">(No Workspace)</option>';
            folderList.forEach((f) => {
                const opt = document.createElement("option");
                opt.value = f.name;
                opt.textContent = f.displayName || f.name;
                if (f.name === currentVal) opt.selected = true;
                selectEl.appendChild(opt);
            });

            const optNew = document.createElement("option");
            optNew.value = "__new__";
            optNew.textContent = "+ Create New Workspace...";
            selectEl.appendChild(optNew);

            selectEl.onchange = () => {
                if (selectEl.value === "__new__") {
                    inputEl.style.display = "block";
                    inputEl.value = "";
                    inputEl.focus();
                } else {
                    inputEl.style.display = "none";
                }
            };

            if (currentVal && !folderList.find((f) => f.name === currentVal)) {
                inputEl.style.display = "block";
                selectEl.value = "__new__";
            }
        } else {
            selectContainer.style.display = "none";
            inputEl.style.display = "block";
        }

        modal.style.display = "flex";
        void modal.offsetWidth; // Force reflow
        modal.classList.add("open");
        if (inputEl.style.display !== "none") inputEl.focus();

        const cleanup = () => {
            modal.classList.remove("open");
            setTimeout(() => {
                modal.style.display = "none";
            }, 300);
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            inputEl.onkeydown = null;
        };

        confirmBtn.onclick = () => {
            let finalVal = inputEl.value;
            if (folderList !== null && selectEl.value !== "__new__")
                finalVal = selectEl.value;
            cleanup();
            resolve(finalVal);
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };

        inputEl.onkeydown = (e) => {
            if (e.key === "Enter") confirmBtn.click();
            if (e.key === "Escape") cancelBtn.click();
        };
    });
};

/**
 * Shows a universal modal dialog.
 * @param {string} title - Modal title.
 * @param {string} message - Content message.
 * @param {object} options - Configuration for type and buttons.
 * @returns {Promise<any>}
 */
window.showModal = async function(title, message, options = {}) {
    const {
        type = "confirm",
        isDanger = false,
        confirmText = type === "alert" ? "OK" : "Confirm",
        cancelText = "Cancel",
        placeholder = "Enter value...",
        defaultValue = "",
        showExtensions = false,
    } = options;

    // SVG Registry for Modal Icons
    const ICONS = {
        confirm: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
        alert: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
        prompt: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        danger: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };

    return new Promise((resolve) => {
        const modal = document.getElementById("confirm-modal");
        const titleEl = document.getElementById("confirm-title");
        const messageEl = document.getElementById("confirm-message");
        const confirmBtn = document.getElementById("confirm-action-btn");
        const cancelBtn = document.getElementById("confirm-cancel-btn");
        const iconContainer = document.getElementById("confirm-icon-container");
        const iconSvg = document.getElementById("confirm-icon-svg");
        const inputContainer = document.getElementById("confirm-input-container");
        const inputField = document.getElementById("confirm-input");
        const extContainer = document.getElementById("confirm-extension-container");
        const extSelect = document.getElementById("confirm-extension-select");

        // Fallback for missing DOM elements
        if (
            !modal ||
            !titleEl ||
            !messageEl ||
            !confirmBtn ||
            !cancelBtn ||
            !iconSvg
        ) {
            if (type === "prompt") resolve(prompt(message));
            else if (type === "alert") {
                alert(message);
                resolve(true);
            } else resolve(confirm(message));
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        // Icon & Style Logic
        iconSvg.innerHTML = isDanger
            ? ICONS.danger
            : ICONS[type] || ICONS.confirm;
        cancelBtn.style.display = type === "alert" ? "none" : "flex";

        if (isDanger) {
            confirmBtn.style.background = "var(--color-rose)";
            confirmBtn.style.borderColor = "var(--color-rose)";
            iconContainer.style.color = "var(--color-rose)";
            confirmBtn.style.color = "white";
        } else {
            confirmBtn.style.background = "";
            confirmBtn.style.borderColor = "";
            confirmBtn.style.color = "";
            iconContainer.style.color = "var(--accent)";
        }

        // --- Input Field Lifecycle ---
        if (inputContainer && inputField) {
            if (type === "prompt") {
                inputContainer.classList.remove("hidden");
                inputField.placeholder = placeholder;
                inputField.value = defaultValue;
                if (showExtensions && extContainer) {
                    extContainer.classList.remove("hidden");
                } else if (extContainer) {
                    extContainer.classList.add("hidden");
                }
                setTimeout(() => inputField.focus(), 100);
                inputField.onkeydown = (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        confirmBtn.click();
                    }
                };
            } else {
                inputContainer.classList.add("hidden");
                if (extContainer) extContainer.classList.add("hidden");
                inputField.onkeydown = null;
            }
        }

        const cleanup = () => {
            modal.classList.remove("open");
            confirmBtn.removeEventListener("click", onConfirm);
            cancelBtn.removeEventListener("click", onCancel);
        };

        const onConfirm = () => {
            let value = true;
            if (type === "prompt" && inputField) {
                value = showExtensions
                    ? { title: inputField.value, ext: extSelect ? extSelect.value : "" }
                    : inputField.value;
            }
            cleanup();
            resolve(value);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        confirmBtn.addEventListener("click", onConfirm, { once: true });
        cancelBtn.addEventListener("click", onCancel, { once: true });

        const onEsc = (e) => {
            if (e.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", onEsc, { once: true });

        modal.classList.add("open");
    });
};

window.showConfirm = async function(title, message, isDanger = false) {
    return await window.showModal(title, message, { type: "confirm", isDanger });
};

window.showAlert = async function(title, message) {
    return await window.showModal(title, message, { type: "alert" });
};

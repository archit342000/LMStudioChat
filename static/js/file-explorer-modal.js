/**
 * Luminous Chat — Interactive File Explorer Modal
 * Extracted from script.js
 */

window.FileExplorerModal = {
  // Dependencies injected via init
  deps: {
    getAllFileSystems: () => [],
    getChatId: () => null,
    fetchFileSystems: async () => {},
    showAlert: async (title, msg) => {},
    showPromptModal: async (title, msg, defaultVal) => {},
    setScrollLock: (isLocked) => {}
  },

  init: function(config) {
    this.deps = { ...this.deps, ...config };
  },

  /**
   * Shows an interactive file explorer modal for selecting a path.
   * @param {string} mode - 'file' (selecting file path), 'folder' (selecting directory), 'move' (renaming/moving)
   * @param {string} initialPath - Starting path
   * @returns {Promise<string|null>} Resolves with final full relative path or null if cancelled.
   */
  show: async function(mode = "file", initialPath = "") {
    const self = this;
    return new Promise((resolve) => {
      const modal = document.getElementById("file-explorer-modal");
      const titleEl = document.getElementById("file-explorer-title");
      const breadcrumbsEl = document.getElementById("file-explorer-breadcrumbs");
      const listEl = document.getElementById("file-explorer-list");
      const inputContainer = document.getElementById("file-explorer-input-container");
      const inputEl = document.getElementById("file-explorer-input");
      const extEl = document.getElementById("file-explorer-ext");
      const newFolderBtn = document.getElementById("file-explorer-new-folder-btn");
      const cancelBtn = document.getElementById("file-explorer-cancel-btn");
      const confirmBtn = document.getElementById("file-explorer-action-btn");

      if (!modal || !listEl) return resolve(null);

      let currentPath = initialPath.includes(".") ? initialPath.split("/").slice(0, -1).join("/") : initialPath;
      currentPath = self.sanitizePath(currentPath);

      if (mode === "file") {
        titleEl.textContent = "Create New File";
        inputContainer.style.display = "flex";
        extEl.style.display = "block";
        newFolderBtn.style.display = "flex";
        inputEl.value = "";
      } else if (mode === "folder") {
        titleEl.textContent = "Create Folder";
        inputContainer.style.display = "flex";
        extEl.style.display = "none";
        newFolderBtn.style.display = "none";
        inputEl.value = "";
      } else {
        titleEl.textContent = "Move / Rename";
        inputContainer.style.display = "flex";
        extEl.style.display = "none"; // Paths for move are full
        newFolderBtn.style.display = "flex";
        // Pre-populate with current basename
        inputEl.value = initialPath.split("/").pop();
      }

      const renderExplorer = () => {
        // Render Breadcrumbs
        breadcrumbsEl.innerHTML = "";
        const rootCrumb = document.createElement("span");
        rootCrumb.className = "breadcrumb-item";
        rootCrumb.textContent = "Root";
        rootCrumb.onclick = () => { currentPath = ""; renderExplorer(); };
        breadcrumbsEl.appendChild(rootCrumb);

        if (currentPath) {
          const parts = currentPath.split("/");
          let built = "";
          parts.forEach((p) => {
            const sep = document.createElement("span");
            sep.className = "breadcrumb-separator";
            sep.textContent = "/";
            breadcrumbsEl.appendChild(sep);

            built += (built ? "/" : "") + p;
            const crumb = document.createElement("span");
            crumb.className = "breadcrumb-item";
            crumb.textContent = p;
            const target = built;
            crumb.onclick = () => { currentPath = target; renderExplorer(); };
            breadcrumbsEl.appendChild(crumb);
          });
        }

        // Render Folder List
        listEl.innerHTML = "";
        const prefix = currentPath ? currentPath + "/" : "";
        
        // Find folders in current path from dependencies
        const subfolders = new Set();
        const allFileSystems = self.deps.getAllFileSystems() || [];
        allFileSystems.forEach(c => {
          const path = c.filename || c.title;
          if (path.startsWith(prefix)) {
            const remainder = path.substring(prefix.length);
            const parts = remainder.split("/");
            if (parts.length > 1) {
              subfolders.add(parts[0]);
            } else if (c.type === "directory") {
              subfolders.add(parts[0]);
            }
          }
        });

        const sorted = Array.from(subfolders).sort();
        if (sorted.length === 0) {
          listEl.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--content-ghost); font-size: 0.85rem;">No subfolders found</div>`;
        } else {
          sorted.forEach(folder => {
            const item = document.createElement("div");
            item.className = "explorer-item";
            const escapedFolderName = window.escapeHtml ? window.escapeHtml(folder) : folder;
            item.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>${escapedFolderName}</span>
            `;
            item.onclick = () => {
              currentPath = prefix + folder;
              renderExplorer();
            };
            listEl.appendChild(item);
          });
        }
      };

      const cleanup = () => {
        modal.classList.remove("open");
        setTimeout(() => { modal.style.display = "none"; self.deps.setScrollLock(false); }, 300);
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        newFolderBtn.onclick = null;
      };

      newFolderBtn.onclick = async () => {
        const name = await self.deps.showPromptModal("New Folder", `Create in ${currentPath || 'Root'}:`);
        if (name && name.trim()) {
          const fullPath = (currentPath ? currentPath + "/" : "") + name.trim();
          const apiModules = window.API_MODULES || (typeof API_MODULES !== "undefined" ? API_MODULES : null);
          if (!apiModules || !apiModules.FILE_SYSTEMS) {
            await self.deps.showAlert("Error", "API endpoints configuration is not available.");
            return;
          }
          
          try {
            const currentChatId = self.deps.getChatId();
            const res = await fetch(`${apiModules.FILE_SYSTEMS}/directory`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: currentChatId, path: fullPath }),
            });
            const data = await res.json();
            if (data.success) {
              await self.deps.fetchFileSystems(currentChatId);
              renderExplorer();
            } else {
              await self.deps.showAlert("Error", data.error || "Failed to create folder");
            }
          } catch (e) {
            await self.deps.showAlert("Error", "Network or system error occurred.");
          }
        }
      };

      confirmBtn.onclick = () => {
        const inputVal = inputEl.value.trim();
        if ((mode === "file" || mode === "folder" || mode === "move") && !inputVal) {
          self.deps.showAlert("Missing Name", "Please enter a name.");
          return;
        }

        let finalPath = (currentPath ? currentPath + "/" : "") + inputVal;
        if (mode === "file") {
          finalPath += extEl.value;
        }
        
        cleanup();
        resolve(finalPath);
      };

      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };

      modal.style.display = "flex";
      self.deps.setScrollLock(true);
      renderExplorer();
      requestAnimationFrame(() => modal.classList.add("open"));
    });
  },

  /**
   * Sanitizes a file/folder path for frontend use.
   */
  sanitizePath: function(path) {
    if (!path) return "";
    path = path.replace(/^\/+|\/+$/g, "");
    const parts = path.split("/");
    const safeParts = [];
    for (const part of parts) {
      if (part === ".." || part === ".") continue;
      const safePart = part.replace(/[^\w\s\-.]/g, "_").trim();
      if (safePart) safeParts.push(safePart);
    }
    return safeParts.join("/");
  }
};

// Backwards compatibility global alias
window.showFileExplorerModal = async function(mode = "file", initialPath = "") {
  return window.FileExplorerModal.show(mode, initialPath);
};

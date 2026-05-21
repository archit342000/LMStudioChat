/**
 * Luminous Chat — Artifact Version Manager
 * Extracted from script.js
 * Handles Undo/Redo tracking and the Version History Modal UI.
 */

window.VersionManager = {
    // DOM Elements
    elements: {},

    // Internal State
    state: {
        fileSystemId: null,
        currentVersionNumber: null,
        historyCache: null,
        navigationPath: [],
        navigationIndex: -1,
    },

    // Dependencies (Injected via init)
    deps: {
        getChatId: () => null,
        getFileSystemId: () => null,
        getWorkspaceId: () => null,
        onRestoreContent: (content) => {},
        refreshSidebar: () => {}
    },

    init: function(config) {
        this.deps = { ...this.deps, ...config };

        // Cache DOM elements
        this.elements = {
            undoBtn: document.getElementById("file-system-panel-undo-btn"),
            redoBtn: document.getElementById("file-system-panel-redo-btn"),
            historyBtn: document.getElementById("file-system-panel-history-btn"),
            modal: document.getElementById("version-history-modal"),
            closeBtn: document.getElementById("close-version-history"),
            fsName: document.getElementById("version-history-file-system-name"),
            listLoading: document.getElementById("version-list-loading"),
            listItems: document.getElementById("version-list"),
            diffPanel: document.getElementById("version-diff-panel"),
            diffTitle: document.getElementById("version-diff-title"),
            diffBody: document.getElementById("version-diff-body"),
            restoreBtn: document.getElementById("version-restore-btn"),
            fileSystemPanelTitle: document.getElementById("file-system-panel-title")
        };

        this.bindEvents();
    },

    bindEvents: function() {
        if (this.elements.historyBtn) {
            this.elements.historyBtn.addEventListener("click", () => this.openVersionHistory());
        }
        if (this.elements.closeBtn) {
            this.elements.closeBtn.addEventListener("click", () => {
                if (this.elements.modal) this.elements.modal.classList.remove("open");
            });
        }
        if (this.elements.restoreBtn) {
            this.elements.restoreBtn.addEventListener("click", (e) => {
                const vNum = parseInt(e.target.dataset.versionNumber, 10);
                if (vNum) this.restoreVersion(vNum);
            });
        }
        if (this.elements.undoBtn) {
            this.elements.undoBtn.addEventListener("click", () => this.handleUndo());
        }
        if (this.elements.redoBtn) {
            this.elements.redoBtn.addEventListener("click", () => this.handleRedo());
        }
    },

    updateUndoRedoButtons: function() {
        if (this.state.navigationIndex === -1 || !this.state.navigationPath) return;

        const isFirstInPath = this.state.navigationIndex <= 0;
        const isLastInPath = this.state.navigationIndex >= this.state.navigationPath.length - 1;

        if (this.elements.undoBtn) {
            this.elements.undoBtn.disabled = isFirstInPath;
        }
        if (this.elements.redoBtn) {
            this.elements.redoBtn.disabled = isLastInPath;
        }
    },

    loadVersionsWithCurrentState: async function(file_systemId, chatId, workspaceId = null) {
        try {
            const wsParam = workspaceId ? `&workspace_id=${workspaceId}` : "";
            
            // 1. Fetch versions
            const versionsRes = await fetch(
                `${API_MODULES.FILE_SYSTEMS}/${file_systemId}/versions?chat_id=${chatId}${wsParam}`
            );
            if (!versionsRes.ok) throw new Error("Failed to load versions");
            const versionsData = await versionsRes.json();
            if (!versionsData.success) throw new Error(versionsData.error || "Failed to load versions");

            this.state.historyCache = versionsData.versions.sort((a, b) => a.version_number - b.version_number);

            // 2. Fetch FileSystem Meta (for navigation path)
            const metaRes = await fetch(`${API_MODULES.FILE_SYSTEMS}/${file_systemId}?chat_id=${chatId}${wsParam}`);
            if (!metaRes.ok) throw new Error("Failed to load file_system metadata");
            const metaData = await metaRes.json();

            if (metaData.success) {
                try {
                    this.state.navigationPath = JSON.parse(metaData.navigation_history || "[]");
                    this.state.navigationIndex = parseInt(metaData.navigation_index, 10);
                } catch (e) {
                    this.state.navigationPath = [];
                    this.state.navigationIndex = -1;
                }

                // Sync current version number with the navigation index
                if (this.state.navigationIndex >= 0 && this.state.navigationIndex < this.state.navigationPath.length) {
                    this.state.currentVersionNumber = this.state.navigationPath[this.state.navigationIndex];
                } else {
                    this.state.currentVersionNumber = null;
                }
            }

            this.updateUndoRedoButtons();
            return this.state.historyCache;
        } catch (err) {
            console.error("Failed to load versions/metadata:", err);
            return [];
        }
    },

    _applyVersionState: async function(versionNumber) {
        if (!this.state.historyCache) return;
        const version = this.state.historyCache.find(v => v.version_number === versionNumber);
        if (!version) return;

        this.state.currentVersionNumber = versionNumber;
        this.deps.onRestoreContent(version.content);
        this.updateUndoRedoButtons();
    },

    openVersionHistory: async function() {
        const currentFileSystemId = this.deps.getFileSystemId();
        const currentChatId = this.deps.getChatId();

        if (!currentFileSystemId || !currentChatId) return;

        this.state.fileSystemId = currentFileSystemId;

        // Load current version state and versions
        await this.loadVersionsWithCurrentState(currentFileSystemId, currentChatId, this.deps.getWorkspaceId());

        // Show modal
        if (this.elements.modal) this.elements.modal.classList.add("open");

        // Update file_system name subtitle
        if (this.elements.fsName) {
            this.elements.fsName.textContent = this.elements.fileSystemPanelTitle?.textContent || currentFileSystemId;
        }

        // Reset to list view
        if (this.elements.diffPanel) this.elements.diffPanel.classList.add("hidden");
        if (this.elements.restoreBtn) this.elements.restoreBtn.style.display = "none";
        
        const placeholder = document.getElementById("version-preview-placeholder");
        if (placeholder) placeholder.classList.remove("hidden");
        
        if (this.elements.listItems) this.elements.listItems.innerHTML = "";
        if (this.elements.listLoading) this.elements.listLoading.classList.remove("hidden");

        try {
            const res = await fetch(
                `${API_MODULES.FILE_SYSTEMS}/${currentFileSystemId}/versions?chat_id=${currentChatId}`
            );
            if (!res.ok) {
                throw new Error("No versions found");
            }
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Failed to load versions");

            this.renderVersionList();
        } catch (err) {
            if (this.elements.listItems) {
                this.elements.listItems.innerHTML = `<div class="version-list-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;margin-bottom:0.5rem;">
                        <polyline points="12 8 12 12 14 14" stroke-linecap="round" stroke-linejoin="round"></polyline>
                        <path d="M3.05 11a9 9 0 1 0 .5-4" stroke-linecap="round"></path>
                    </svg>
                    <p>No version history yet.<br>Versions are saved automatically when content changes.</p>
                </div>`;
            }
        } finally {
            if (this.elements.listLoading) this.elements.listLoading.classList.add("hidden");
        }
    },

    renderVersionList: function() {
        if (!this.elements.listItems || !this.state.navigationPath || !this.state.historyCache) return;
        this.elements.listItems.innerHTML = "";

        // Show the navigation path in reverse (most recent navigation on top)
        for (let i = this.state.navigationPath.length - 1; i >= 0; i--) {
            const vNum = this.state.navigationPath[i];
            const vMeta = this.state.historyCache.find((v) => v.version_number === vNum);
            if (!vMeta) continue;

            const item = document.createElement("div");
            const isActive = i === this.state.navigationIndex;
            item.className = `version-item${isActive ? " current-version" : ""}`;
            item.dataset.navIndex = i;
            item.dataset.versionNumber = vNum;

            const date = new Date(vMeta.timestamp * 1000);
            const dateStr = date.toLocaleString([], {
                dateStyle: "short",
                timeStyle: "short",
            });
            const author = vMeta.author || "system";
            const comment = vMeta.comment || (i === 0 ? "Initial version" : "Navigated");

            const isCurrentBadge = isActive ? `<span class="version-current-badge">Current</span>` : "";

            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <span class="version-item-number">v${vNum}</span>
                    ${isCurrentBadge}
                </div>
                <div class="version-item-comment">${window.escapeHtml ? window.escapeHtml(comment) : comment}</div>
                <div class="version-item-meta">
                    <span class="version-item-author">${window.escapeHtml ? window.escapeHtml(author) : author}</span>
                    <span>·</span>
                    <span>${dateStr}</span>
                </div>
            `;

            item.addEventListener("click", () => {
                this.openVersionDiff(vNum, vMeta, i);
            });
            this.elements.listItems.appendChild(item);
        }
    },

    openVersionDiff: async function(versionNumber, versionMeta, navIndex = null) {
        if (!this.elements.diffPanel || !this.elements.diffBody || !this.elements.restoreBtn) return;

        // Show diff panel
        this.elements.diffPanel.classList.remove("hidden");
        const placeholder = document.getElementById("version-preview-placeholder");
        if (placeholder) placeholder.classList.add("hidden");

        // Mark item as active in list
        document.querySelectorAll(".version-item").forEach((el) => el.classList.remove("active"));
        
        let activeSelector = `.version-item[data-version-number="${versionNumber}"]`;
        if (navIndex !== null) {
            activeSelector = `.version-item[data-nav-index="${navIndex}"]`;
        }
        const activeItem = document.querySelector(activeSelector);
        if (activeItem) activeItem.classList.add("active");

        const isCurrentVersion = (versionNumber === this.state.currentVersionNumber);

        // Update diff panel header
        const dateStr = new Date(versionMeta.timestamp * 1000).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
        });
        if (this.elements.diffTitle) {
            this.elements.diffTitle.textContent = `v${versionNumber} — ${dateStr}`;
        }

        // Disable restore button for current version
        if (this.elements.restoreBtn) {
            this.elements.restoreBtn.style.display = ""; 
            this.elements.restoreBtn.disabled = isCurrentVersion;
            this.elements.restoreBtn.dataset.versionNumber = versionNumber;
            this.elements.restoreBtn.dataset.navIndex = navIndex;
            
            this.elements.restoreBtn.textContent = isCurrentVersion ? "Already at this version" : "Restore this version";
        }

        this.elements.diffBody.innerHTML = `<div class="version-list-loading" style="height:100%;justify-content:center;"><div class="spinner" style="width:24px;height:24px;"></div><span>Loading version…</span></div>`;

        try {
            const contentRes = await fetch(
                `${API_MODULES.FILE_SYSTEMS}/${this.state.fileSystemId}/versions/${versionNumber}?chat_id=${this.deps.getChatId()}`
            );
            if (!contentRes.ok) throw new Error("Failed to load version content");
            const contentData = await contentRes.json();
            const thisContent = contentData.content || "";

            this.elements.diffBody.innerHTML = "";

            const pre = document.createElement("div");
            pre.className = "version-preview-content";
            pre.textContent = thisContent;
            this.elements.diffBody.appendChild(pre);
        } catch (err) {
            this.elements.diffBody.innerHTML = `<div class="diff-no-changes"><p>Failed to load version content. Please try again.</p></div>`;
        }
    },

    restoreVersion: async function(versionNumber) {
        if (!this.state.fileSystemId || !versionNumber) return;

        try {
            const res = await fetch(
                `${API_MODULES.FILE_SYSTEMS}/${this.state.fileSystemId}/versions/${versionNumber}/restore`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: this.deps.getChatId() }),
                }
            );
            const data = await res.json();

            if (data.success) {
                // Refresh version state for non-linear undo/redo
                await this.loadVersionsWithCurrentState(this.state.fileSystemId, this.deps.getChatId(), this.deps.getWorkspaceId());

                // Reload file_system content in the panel
                const wsParam = this.deps.getWorkspaceId() ? `&workspace_id=${this.deps.getWorkspaceId()}` : "";
                const contentRes = await fetch(
                    `${API_MODULES.FILE_SYSTEMS}/${this.state.fileSystemId}?chat_id=${this.deps.getChatId()}${wsParam}`
                );
                const contentData = await contentRes.json();

                if (contentData.success) {
                    this.deps.onRestoreContent(contentData.content);
                }

                if (this.elements.modal) this.elements.modal.classList.remove("open");
                this.deps.refreshSidebar();
                
                if (window.showToast) window.showToast(`Restored to v${versionNumber}`, "success");
            } else {
                if (window.showModal) {
                    await window.showModal("Restore Failed", data.error || "Could not restore this version.", { type: "alert" });
                }
            }
        } catch (err) {
            if (window.showModal) {
                await window.showModal("Restore Failed", "A network error occurred.", { type: "alert" });
            }
        }
    },

    handleUndo: async function() {
        if (this.state.navigationIndex <= 0) return;

        this.state.navigationIndex--;
        const targetVersion = this.state.navigationPath[this.state.navigationIndex];

        try {
            await fetch(`${API_MODULES.FILE_SYSTEMS}/${this.deps.getFileSystemId()}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: this.deps.getChatId(),
                    workspace_id: this.deps.getWorkspaceId(),
                    navigation_index: this.state.navigationIndex,
                    current_version: targetVersion
                }),
            });
            await this._applyVersionState(targetVersion);
        } catch (err) {
            console.error("Undo failed:", err);
        }
    },

    handleRedo: async function() {
        if (!this.state.navigationPath || this.state.navigationIndex >= this.state.navigationPath.length - 1) return;

        this.state.navigationIndex++;
        const targetVersion = this.state.navigationPath[this.state.navigationIndex];

        try {
            await fetch(`${API_MODULES.FILE_SYSTEMS}/${this.deps.getFileSystemId()}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: this.deps.getChatId(),
                    workspace_id: this.deps.getWorkspaceId(),
                    navigation_index: this.state.navigationIndex,
                    current_version: targetVersion
                }),
            });
            await this._applyVersionState(targetVersion);
        } catch (err) {
            console.error("Redo failed:", err);
        }
    }
};

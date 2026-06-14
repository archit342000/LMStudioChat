/**
 * Luminous Chat — File System Sidebar UI
 * Extracted from script.js
 * Handles rendering the hierarchical tree, file list, search filtering, and item interactions.
 */

window.FileSystemUI = {
    container: null,
    
    // UI State
    state: {
        allFiles: [],
        searchQuery: "",
        folderFilter: "",
        expandedFolders: {},
        currentChatArtifactFolders: []
    },

    // Dependencies
    deps: {
        getActiveFileId: () => null,
        onFileClick: (id, workspaceId) => {},
        onFileDownload: (id, workspaceId) => {},
        onFileDelete: (id, title, workspaceId) => {},
        onContextMenu: (type, id, title, e, workspaceId) => {}
    },

    init: function(config) {
        this.deps = { ...this.deps, ...config };
        this.container = document.getElementById("file-system-list");
        
        try {
            this.state.expandedFolders = JSON.parse(localStorage.getItem("artifactFoldersExpanded") || "{}");
        } catch (e) {
            this.state.expandedFolders = {};
        }
    },

    updateData: function(files) {
        this.state.allFiles = files || [];
        this.applyFilter();
    },

    setSearchQuery: function(query) {
        this.state.searchQuery = (query || "").trim().toLowerCase();
        this.applyFilter();
    },

    setFolderFilter: function(folder) {
        this.state.folderFilter = folder || "";
        this.applyFilter();
    },

    saveExpandedState: function() {
        localStorage.setItem("artifactFoldersExpanded", JSON.stringify(this.state.expandedFolders));
    },

    applyFilter: function() {
        const q = this.state.searchQuery;
        const folder = this.state.folderFilter;

        let filtered = this.state.allFiles;

        // Filter out useless internal files
        filtered = filtered.filter((c) => {
            if (!c || !c.id) return true;
            return !(c.id.startsWith("plan_") || c.id === "plan" || c.id.startsWith("research_") || c.id.startsWith("section_"));
        });

        // Folder filter (matches top-level directory)
        if (folder) {
            filtered = filtered.filter((c) => {
                const path = c.filename || c.title;
                const cFolder = path.includes("/") ? path.split("/")[0] : "";
                return cFolder === folder;
            });
        }

        // Search filter — match filename/path or snippet
        if (q) {
            filtered = filtered.filter((c) => {
                const path = c.filename || c.title;
                const titleMatch = path.toLowerCase().includes(q);
                const contentMatch =
                    (c.content && c.content.toLowerCase().includes(q)) ||
                    (c.preview && c.preview.toLowerCase().includes(q));
                return titleMatch || contentMatch;
            });
        }

        this.renderFilteredList(filtered, q);
    },

    buildItem: function(file_system, highlightQuery) {
        const item = document.createElement("div");
        const isActive = this.deps.getActiveFileId() === file_system.id;
        item.className = `file-system-item ${isActive ? "active" : ""}`;
        item.dataset.file_systemId = file_system.id;

        const path = file_system.filename || file_system.title || "";
        const isDir = file_system.type === "directory";
        const ext = path.slice((path.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
        const runnableExtensions = ["py", "c", "cpp", "cc", "cxx", "java", "js", "mjs", "ts", "go", "rs", "sh", "bash", "php", "sql"];
        const isRunnable = !isDir && runnableExtensions.includes(ext);

        let typeBadge = "";
        if (file_system.language && file_system.language !== "markdown") {
            typeBadge = `<span class="type-badge" style="background: var(--surface-2); color: var(--content-muted); border: 1px solid var(--border);">${window.escapeHtml ? window.escapeHtml(file_system.language) : file_system.language}</span>`;
        }

        let snippet = "";
        if (file_system.content && file_system.content.length > 0) {
            let previewContent = file_system.content.replace(/\n/g, " ");
            if (highlightQuery) {
                const matchIdx = previewContent.toLowerCase().indexOf(highlightQuery);
                if (matchIdx !== -1) {
                    const start = Math.max(0, matchIdx - 40);
                    const end = Math.min(previewContent.length, matchIdx + highlightQuery.length + 60);
                    const raw = previewContent.substring(start, end);
                    const escaped = window.escapeHtml ? window.escapeHtml(raw) : raw;
                    const escapedQuery = window.escapeHtml ? window.escapeHtml(highlightQuery) : highlightQuery;
                    const highlighted = escaped.replace(
                        new RegExp(escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
                        (m) => `<mark class="file-system-highlight">${m}</mark>`
                    );
                    snippet = `<div class="file-system-snippet">${start > 0 ? "…" : ""}${highlighted}${end < previewContent.length ? "…" : ""}</div>`;
                } else {
                    const sub = previewContent.substring(0, 120);
                    snippet = `<div class="file-system-snippet">${window.escapeHtml ? window.escapeHtml(sub) : sub}${previewContent.length > 120 ? "…" : ""}</div>`;
                }
            } else {
                const sub = previewContent.substring(0, 120);
                snippet = `<div class="file-system-snippet">${window.escapeHtml ? window.escapeHtml(sub) : sub}${previewContent.length > 120 ? "…" : ""}</div>`;
            }
        }

        const dateStr = new Date(file_system.timestamp * 1000).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
        const displayTitle = file_system.displayTitle || file_system.title;

        const downloadButton = `
            <div class="file-system-export-inline">
                <button class="file-system-action-btn download-btn" title="Download File">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
            </div>
        `;

        const runButton = isRunnable ? `
            <button class="file-system-action-btn run-btn" title="Run File" style="margin-right: 4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
        ` : "";

        item.innerHTML = `
            <div class="file-system-item-header">
                <div class="file-system-item-title">${window.escapeHtml ? window.escapeHtml(displayTitle) : displayTitle}</div>
                <div class="file-system-item-badges">${typeBadge}</div>
            </div>
            ${snippet}
            <div class="file-system-item-meta">${dateStr}</div>
            <div class="file-system-item-actions">
                ${runButton}
                ${downloadButton}
                <button class="file-system-action-btn delete-btn" title="Delete Artifact">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-rose)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;

        item.addEventListener("click", () => this.deps.onFileClick(file_system.id, file_system.workspace_id));

        // Long press support
        let cLongPressTimer;
        let cIsLongPress = false;
        let cStartY = 0;
        let cStartX = 0;

        item.addEventListener("touchstart", (e) => {
            cIsLongPress = false;
            cStartY = e.touches[0].clientY;
            cStartX = e.touches[0].clientX;
            cLongPressTimer = setTimeout(() => {
                cIsLongPress = true;
                if (navigator.vibrate) navigator.vibrate(50);
                this.deps.onContextMenu("file_system", file_system.id, file_system.fullPath || file_system.title, e, file_system.workspace_id);
            }, 600);
        }, { passive: true });

        item.addEventListener("touchmove", (e) => {
            if (Math.abs(e.touches[0].clientY - cStartY) > 10 || Math.abs(e.touches[0].clientX - cStartX) > 10) {
                clearTimeout(cLongPressTimer);
            }
        }, { passive: true });

        item.addEventListener("touchend", (e) => {
            clearTimeout(cLongPressTimer);
            if (cIsLongPress) {
                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        item.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.deps.onContextMenu("file_system", file_system.id, file_system.fullPath || file_system.title, e, file_system.workspace_id);
        });

        item.querySelector(".run-btn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (this.deps.onFileRun) {
                this.deps.onFileRun(path);
            }
        });

        item.querySelector(".download-btn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.deps.onFileDownload(file_system.id, file_system.workspace_id);
        });
        
        item.querySelector(".delete-btn")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.deps.onFileDelete(file_system.id, file_system.displayTitle || file_system.title, file_system.workspace_id);
        });

        return item;
    },

    renderFilteredList: function(file_systems, highlightQuery) {
        if (!this.container) return;
        this.container.innerHTML = "";

        if (file_systems.length === 0) {
            const q = this.state.searchQuery;
            this.container.innerHTML = `<div class="file-system-list-empty-state">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.35;">
                    ${q ? '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' : '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/>'}
                </svg>
                <p>${q ? `No artifacts match "${window.escapeHtml ? window.escapeHtml(q) : q}"` : "No saved artifacts yet"}</p>
            </div>`;
            return;
        }

        // Build the tree
        const tree = { folders: {}, files: [] };
        const folderPaths = new Set();
        
        file_systems.forEach((file_system) => {
            const path = file_system.filename || file_system.title;
            const parts = path.split('/');
            
            let current = tree;
            let currentPath = "";
            
            if (file_system.type === "directory") {
                for (let i = 0; i < parts.length; i++) {
                    const folderName = parts[i];
                    currentPath += (currentPath ? "/" : "") + folderName;
                    folderPaths.add(currentPath);
                    
                    if (!current.folders[folderName]) {
                        current.folders[folderName] = { folders: {}, files: [], path: currentPath };
                    }
                    current = current.folders[folderName];
                }
                return;
            }
            
            for (let i = 0; i < parts.length - 1; i++) {
                const folderName = parts[i];
                currentPath += (currentPath ? "/" : "") + folderName;
                folderPaths.add(currentPath);
                
                if (!current.folders[folderName]) {
                    current.folders[folderName] = { folders: {}, files: [], path: currentPath };
                }
                current = current.folders[folderName];
            }
            
            file_system.displayTitle = parts[parts.length - 1];
            file_system.fullPath = path;
            current.files.push(file_system);
        });

        this.state.currentChatArtifactFolders = Array.from(folderPaths);

        const renderTree = (node, domContainer, level = 0) => {
            const sortedFolders = Object.keys(node.folders).sort();
            
            sortedFolders.forEach(folderName => {
                const folderNode = node.folders[folderName];
                const folderPath = folderNode.path;
                const isExpanded = this.state.expandedFolders[folderPath] !== false;
                
                const folderDiv = document.createElement("div");
                folderDiv.className = `folder-item ${isExpanded ? "expanded" : ""}`;
                folderDiv.style.marginLeft = level > 0 ? "2px" : "0";

                const folderHeader = document.createElement("div");
                folderHeader.className = "folder-header";

                const folderIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity: 0.7;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
                const chevronSvg = `<svg class="folder-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

                const nameWrapper = document.createElement("div");
                nameWrapper.style.cssText = "display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;";
                const nameSpan = document.createElement("span");
                nameSpan.style.cssText = "overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8125rem; font-weight: 600; color: var(--content-primary);";
                nameSpan.textContent = folderName;
                nameWrapper.innerHTML = folderIconSvg;
                nameWrapper.appendChild(nameSpan);

                let totalFiles = 0;
                function countFiles(n) {
                    let count = n.files.length;
                    for(let k in n.folders) {
                        count += countFiles(n.folders[k]);
                    }
                    return count;
                }
                totalFiles = countFiles(folderNode);

                const countSpan = document.createElement("span");
                countSpan.style.cssText = "font-size: 0.7rem; color: var(--content-muted); background: var(--surface-secondary); padding: 1px 6px; border-radius: 6px; font-weight: 500;";
                countSpan.textContent = totalFiles;

                folderHeader.innerHTML = chevronSvg;
                folderHeader.appendChild(nameWrapper);
                folderHeader.appendChild(countSpan);

                // Long press support for folders
                let fLongPressTimer;
                let fIsLongPress = false;
                let fStartY = 0;
                let fStartX = 0;

                folderHeader.addEventListener("touchstart", (e) => {
                    fIsLongPress = false;
                    fStartY = e.touches[0].clientY;
                    fStartX = e.touches[0].clientX;
                    fLongPressTimer = setTimeout(() => {
                        fIsLongPress = true;
                        if (navigator.vibrate) navigator.vibrate(50);
                        this.deps.onContextMenu("file-system-folder", folderPath, null, e);
                    }, 600);
                }, { passive: true });

                folderHeader.addEventListener("touchmove", (e) => {
                    if (Math.abs(e.touches[0].clientY - fStartY) > 10 || Math.abs(e.touches[0].clientX - fStartX) > 10) {
                        clearTimeout(fLongPressTimer);
                    }
                }, { passive: true });

                folderHeader.addEventListener("touchend", (e) => {
                    clearTimeout(fLongPressTimer);
                    if (fIsLongPress) {
                        if (e.cancelable) e.preventDefault();
                    }
                }, { passive: false });

                folderHeader.addEventListener("touchcancel", () => {
                    clearTimeout(fLongPressTimer);
                });

                folderHeader.onclick = (e) => {
                    if (fIsLongPress) {
                        e.preventDefault();
                        return;
                    }
                    const expanding = !folderDiv.classList.contains("expanded");
                    folderDiv.classList.toggle("expanded", expanding);
                    this.state.expandedFolders[folderPath] = expanding;
                    this.saveExpandedState();
                };

                folderHeader.oncontextmenu = (e) => {
                    e.preventDefault();
                    this.deps.onContextMenu("file-system-folder", folderPath, null, e);
                };

                const folderContent = document.createElement("div");
                folderContent.className = "folder-content";
                
                renderTree(folderNode, folderContent, level + 1);

                folderDiv.appendChild(folderHeader);
                folderDiv.appendChild(folderContent);
                domContainer.appendChild(folderDiv);
            });
            
            node.files.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
            
            node.files.forEach(file_system => {
                const item = this.buildItem(file_system, highlightQuery);
                if (level > 0) {
                    item.style.marginLeft = "2px";
                }
                domContainer.appendChild(item);
            });
        };
        
        renderTree(tree, this.container, 0);
    }
};

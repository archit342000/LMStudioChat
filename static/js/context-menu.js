/**
 * Sidebar Context Menu Component
 * Manages modern, glassmorphic floating context menus for chats, workspaces, and virtual file systems.
 */

(function () {
  const ContextMenu = {
    deps: {},
    activeMenu: null,

    /**
     * Initializes the context menu component with required dependencies.
     * @param {Object} dependencies - Core functions and active state getters from the monolithic app.
     */
    init(dependencies) {
      this.deps = dependencies;

      // Global click-away listener
      document.addEventListener("click", this.handleGlobalClick.bind(this));
      document.addEventListener("touchstart", this.handleGlobalClick.bind(this), { passive: true });

      // Global ESC key listener
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.close();
      });

      // Register wrapper in global scope
      window.showContextMenu = (type, id, extraData, e, workspaceId = null) => {
        return this.show(type, id, extraData, e, workspaceId);
      };
    },

    /**
     * Closes the active context menu.
     */
    close() {
      if (this.activeMenu) {
        const menu = this.activeMenu;
        menu.classList.remove("open");
        
        // Remove from DOM after transition
        setTimeout(() => {
          if (menu && menu.parentNode) {
            menu.parentNode.removeChild(menu);
          }
        }, 150);
        
        this.activeMenu = null;
      }
    },

    /**
     * Handles global clicks to dismiss the menu if clicked outside.
     * @param {Event} event 
     */
    handleGlobalClick(event) {
      if (this.activeMenu && !this.activeMenu.contains(event.target)) {
        this.close();
      }
    },

    /**
     * Shows a beautifully styled floating context menu.
     * @param {string} type - 'chat', 'workspace', 'file_system', or 'file-system-folder'
     * @param {string} id - Identifier of the active target
     * @param {any} extraData - Additional context data (e.g. workspace name, path)
     * @param {Event} e - Mouse or touch trigger event
     * @param {string} workspaceId - Optional workspace identifier
     */
    async show(type, id, extraData, e, workspaceId = null) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Close any active menu first
      this.close();

      const menu = document.createElement("div");
      menu.className = "sidebar-context-menu";
      document.body.appendChild(menu);
      this.activeMenu = menu;

      // Construct appropriate HTML based on type
      if (type === "chat") {
        this.renderChatMenu(menu, id, extraData, e);
      } else if (type === "workspace") {
        this.renderWorkspaceMenu(menu, id, extraData, e);
      } else if (type === "file_system") {
        this.renderFileSystemMenu(menu, id, extraData, workspaceId);
      } else if (type === "file-system-folder") {
        this.renderFileSystemFolderMenu(menu, id);
      } else {
        this.close();
        return;
      }

      // Position the menu with collision detection
      this.positionMenu(menu, e);
    },

    /**
     * Performs viewport boundary checking and positions the floating context menu.
     * @param {HTMLElement} menu 
     * @param {Event} e 
     */
    positionMenu(menu, e) {
      let x = 0;
      let y = 0;

      if (e) {
        if (e.touches && e.touches.length > 0) {
          x = e.touches[0].clientX;
          y = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
          x = e.changedTouches[0].clientX;
          y = e.changedTouches[0].clientY;
        } else {
          x = e.clientX;
          y = e.clientY;
        }
      }

      // Set initial styles
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;

      requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        const width = rect.width || 200;
        const height = rect.height || 180;

        // Viewport bounds collision checks
        if (x + width > window.innerWidth) {
          x = window.innerWidth - width - 10;
          menu.style.transformOrigin = "top right";
        } else {
          menu.style.transformOrigin = "top left";
        }

        if (y + height > window.innerHeight) {
          y = window.innerHeight - height - 10;
          const xOrigin = (x + width > window.innerWidth) ? "right" : "left";
          menu.style.transformOrigin = `bottom ${xOrigin}`;
        }

        // Set adjusted coordinates
        menu.style.left = `${Math.max(10, x)}px`;
        menu.style.top = `${Math.max(10, y)}px`;

        // Adjust sub-menu orientation if near right edge
        const subMenus = menu.querySelectorAll(".sidebar-context-menu-sub");
        subMenus.forEach((subMenu) => {
          if (x + width + 180 > window.innerWidth) {
            subMenu.style.left = "auto";
            subMenu.style.right = "100%";
            subMenu.style.transform = "translateX(10px)";
          } else {
            subMenu.style.left = "100%";
            subMenu.style.right = "auto";
            subMenu.style.transform = "translateX(-10px)";
          }
        });

        menu.classList.add("open");
      });
    },

    /**
     * Renders chat context menu options.
     */
    renderChatMenu(menu, id, folder, event) {
      const workspaces = this.deps.getChatWorkspaces ? this.deps.getChatWorkspaces() : [];
      const escape = window.escapeHtml || ((text) => text);

      let workspacesHtml = workspaces
        .map((ws) => `
          <button class="sidebar-context-menu-item" data-action="move-to" data-workspace="${escape(ws.name)}">
            ${escape(ws.displayName || ws.name)}
          </button>
        `)
        .join("");

      menu.innerHTML = `
        <button class="sidebar-context-menu-item" data-action="rename">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.8;"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Rename Chat
        </button>
        <div class="sidebar-context-menu-item has-sub" style="position: relative;">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <span style="display: flex; align-items: center; gap: 10px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.8;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Move to Workspace
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </div>
          <div class="sidebar-context-menu-sub">
            ${workspacesHtml}
            ${workspaces.length > 0 ? '<div class="sidebar-context-menu-separator"></div>' : ""}
            <button class="sidebar-context-menu-item" data-action="move-to" data-workspace="uncategorized">
              Uncategorized
            </button>
            <button class="sidebar-context-menu-item" data-action="move-to-prompt">
              New Workspace...
            </button>
          </div>
        </div>
        <div class="sidebar-context-menu-separator"></div>
        <button class="sidebar-context-menu-item danger" data-action="delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.8;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          Delete Chat
        </button>
      `;

      // Event delegation inside menu
      menu.addEventListener("click", async (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;

        const action = target.getAttribute("data-action");

        if (action === "rename") {
          this.close();
          if (this.deps.renameChat) this.deps.renameChat(id, event);
        } else if (action === "delete") {
          this.close();
          if (this.deps.deleteChat) this.deps.deleteChat(id, event);
        } else if (action === "move-to") {
          this.close();
          const targetWs = target.getAttribute("data-workspace");
          const finalWs = targetWs === "uncategorized" ? null : targetWs;
          if (this.deps.moveChatToWorkspace) {
            await this.deps.moveChatToWorkspace(id, finalWs);
          }
        } else if (action === "move-to-prompt") {
          this.close();
          if (this.deps.showPromptModal && this.deps.moveChatToWorkspace) {
            const workspaceName = await this.deps.showPromptModal(
              "Move to Workspace",
              "Select a workspace or create a new one:",
              folder || "",
              workspaces
            );
            if (workspaceName !== null) {
              const finalWorkspace = workspaceName.trim() === "" ? null : workspaceName.trim();
              await this.deps.moveChatToWorkspace(id, finalWorkspace);
            }
          }
        }
      });
    },

    /**
     * Renders workspace context menu options.
     */
    renderWorkspaceMenu(menu, id, extraData, event) {
      const escape = window.escapeHtml || ((text) => text);

      menu.innerHTML = `
        <button class="sidebar-context-menu-item" data-action="new-chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.8;"><path d="M12 5v14M5 12h14"/></svg>
          New Chat in Workspace
        </button>
        <button class="sidebar-context-menu-item" data-action="rename">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.8;"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Rename Workspace
        </button>
        <button class="sidebar-context-menu-item" data-action="uncategorize-all">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.8;"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          Uncategorize All Chats
        </button>
        <div class="sidebar-context-menu-separator"></div>
        <button class="sidebar-context-menu-item danger" data-action="delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.8;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          Delete Workspace
        </button>
      `;

      menu.addEventListener("click", async (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;

        const action = target.getAttribute("data-action");

        if (action === "new-chat") {
          this.close();
          if (this.deps.startNewChat) {
            this.deps.startNewChat(false, true, id);
            
            try {
              const res = await fetch(`${window.API_MODULES?.CHATS || "/api/chats"}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: this.deps.getCurrentChatId ? this.deps.getCurrentChatId() : null,
                  title: "New Chat",
                  workspace_id: id,
                  user_preferences: this.deps.getIsUserPreferences ? this.deps.getIsUserPreferences() : false,
                  research_mode: this.deps.getIsResearchMode ? this.deps.getIsResearchMode() : false,
                  ...(this.deps.getSamplingParams ? this.deps.getSamplingParams() : {}),
                }),
              });
              
              if (res.ok) {
                if (this.deps.loadChats) await this.deps.loadChats();
                if (this.deps.renderChatList) this.deps.renderChatList();
              } else {
                const errorText = await res.text();
                console.error("Failed to immediately persist new chat in workspace:", errorText);
              }
            } catch (err) {
              console.error("Error during immediate chat persistence:", err);
            }
          }
        } else if (action === "rename") {
          this.close();
          if (this.deps.renameWorkspace) this.deps.renameWorkspace(id, event);
        } else if (action === "uncategorize-all") {
          this.close();
          if (this.deps.getSavedChats) {
            const savedChats = this.deps.getSavedChats();
            const chatsToUncategorize = savedChats.filter((c) => c.workspace_id === id);
            if (chatsToUncategorize.length > 0) {
              const base = window.API_MODULES?.CHATS || "/api/chats";
              for (const chat of chatsToUncategorize) {
                try {
                  await fetch(`${base}/${chat.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ workspace_id: null }),
                  });
                } catch (err) {
                  console.error("Failed to uncategorize chat:", chat.id, err);
                }
              }
              if (this.deps.loadChats) await this.deps.loadChats();
            }
          }
        } else if (action === "delete") {
          this.close();
          if (this.deps.deleteWorkspace) this.deps.deleteWorkspace(id, event);
        }
      });
    },

    /**
     * Renders virtual file system context menu options.
     */
    renderFileSystemMenu(menu, id, pathData, workspaceId) {
      menu.innerHTML = `
        <button class="sidebar-context-menu-item" data-action="move-rename">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.8;"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Move/Rename File
        </button>
        <div class="sidebar-context-menu-separator"></div>
        <button class="sidebar-context-menu-item danger" data-action="delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.8;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          Delete File
        </button>
      `;

      menu.addEventListener("click", async (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;

        const action = target.getAttribute("data-action");

        if (action === "move-rename") {
          this.close();
          if (this.deps.showFileExplorerModal && this.deps.renameOrMoveFileSystemPath) {
            const newPath = await this.deps.showFileExplorerModal("move", pathData);
            if (newPath !== null) {
              const finalPath = newPath.trim();
              if (finalPath !== "" && finalPath !== pathData) {
                await this.deps.renameOrMoveFileSystemPath(id, finalPath, workspaceId);
              }
            }
          }
        } else if (action === "delete") {
          this.close();
          if (this.deps.deleteFileSystem) {
            this.deps.deleteFileSystem(id, workspaceId);
          }
        }
      });
    },

    /**
     * Renders virtual folder context menu options.
     */
    renderFileSystemFolderMenu(menu, id) {
      menu.innerHTML = `
        <button class="sidebar-context-menu-item danger" data-action="delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.8;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
          Delete Folder
        </button>
      `;

      menu.addEventListener("click", (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;

        const action = target.getAttribute("data-action");

        if (action === "delete") {
          this.close();
          if (this.deps.deleteFileSystemFolder) {
            this.deps.deleteFileSystemFolder(id);
          }
        }
      });
    },
  };

  // Export globally
  window.ContextMenu = ContextMenu;
})();

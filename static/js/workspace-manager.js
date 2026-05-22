/**
 * Workspace Manager Component
 * Governs workspace/folder creation, renaming, deleting, chat categorization, and local persistence.
 */

(function () {
  const WorkspaceManager = {
    deps: {},
    chatWorkspaces: [],

    // DOM References
    nodes: {},

    /**
     * Initializes the workspace manager module with dependencies.
     * @param {Object} dependencies - Core functions and state triggers.
     */
    init(dependencies) {
      this.deps = dependencies;

      // Cache DOM references
      this.nodes = {
        newFolderBtn: document.getElementById("new-folder-btn"),
      };

      // Set event listeners
      if (this.nodes.newFolderBtn) {
        this.nodes.newFolderBtn.addEventListener("click", () => this.createWorkspaceInteractive());
      }

      // Initial synchronization from localStorage
      this.loadWorkspacesFromStorage();
    },

    /**
     * Loads workspace states from localStorage.
     */
    loadWorkspacesFromStorage() {
      try {
        this.chatWorkspaces = JSON.parse(localStorage.getItem("chatWorkspaces") || "[]");
      } catch (e) {
        this.chatWorkspaces = [];
      }
    },

    /**
     * Returns the array of current workspaces.
     * @returns {Array} List of workspace objects.
     */
    getChatWorkspaces() {
      return this.chatWorkspaces;
    },

    /**
     * Sets workspaces array and persists to storage.
     * @param {Array} workspaces - New workspaces array.
     */
    setChatWorkspaces(workspaces) {
      this.chatWorkspaces = workspaces;
      this.saveWorkspaces();
    },

    /**
     * Serializes and persists workspace settings to localStorage.
     */
    saveWorkspaces() {
      try {
        localStorage.setItem("chatWorkspaces", JSON.stringify(this.chatWorkspaces));
      } catch (e) {
        console.error("Failed to persist workspaces to localStorage:", e);
      }
    },

    /**
     * Fetches workspaces list from backend, merges with current expansion states, and updates.
     */
    async fetchWorkspaces() {
      try {
        const base = window.API_MODULES?.CHATS || "/api/chats";
        const wsResponse = await fetch(`${base}/workspaces`);
        if (wsResponse.ok) {
          const fetchedWorkspaces = await wsResponse.json();
          // Merge with existing state (to preserve expanded property)
          const newWorkspaces = [];
          fetchedWorkspaces.forEach(ws => {
            const existing = this.chatWorkspaces.find(cw => cw.name === ws.id);
            newWorkspaces.push({
              name: ws.id, // Store ID as name for internal logic backward compatibility
              displayName: ws.name,
              expanded: existing ? existing.expanded : true
            });
          });
          this.chatWorkspaces = newWorkspaces;
          this.saveWorkspaces();
        }
      } catch (e) {
        console.error("Error fetching workspaces from API:", e);
      }
    },

    /**
     * Prompts the user for a workspace name and calls createWorkspace.
     */
    async createWorkspaceInteractive() {
      if (!this.deps.showPromptModal) return;

      const workspaceName = await this.deps.showPromptModal(
        "Create Workspace",
        "Enter a name for the new workspace:",
      );

      if (workspaceName && workspaceName.trim() !== "") {
        await this.createWorkspace(workspaceName.trim());
      }
    },

    /**
     * Dispatches a workspace creation request to the API.
     * @param {string} name - Name of new workspace.
     */
    async createWorkspace(name) {
      try {
        const base = window.API_MODULES?.CHATS || "/api/chats";
        const res = await fetch(`${base}/workspaces`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name })
        });
        if (res.ok) {
          if (this.deps.loadChats) {
            await this.deps.loadChats();
          }
        } else {
          if (this.deps.showModal) {
            this.deps.showModal("Notice", "Failed to create workspace.", { type: "alert" });
          }
        }
      } catch (e) {
        console.error("Error creating workspace:", e);
      }
    },

    /**
     * Deletes a workspace and shifts containing chats to 'uncategorized'.
     * @param {string} workspaceId - The target workspace ID.
     * @param {Event} event - The triggering UI click event.
     */
    async deleteWorkspace(workspaceId, event) {
      if (event) event.stopPropagation();

      const workspace = this.chatWorkspaces.find(w => w.name === workspaceId);
      const displayName = workspace ? workspace.displayName : "this workspace";

      const escape = window.escapeHtml || ((text) => text);

      if (this.deps.showConfirm) {
        const confirmed = await this.deps.showConfirm(
          "Delete Workspace",
          `Are you sure you want to delete the workspace "${escape(displayName)}"? The chats inside will be moved to uncategorized.`,
          true,
        );

        if (confirmed) {
          try {
            const base = window.API_MODULES?.CHATS || "/api/chats";
            const res = await fetch(`${base}/workspaces/${workspaceId}`, {
              method: "DELETE"
            });
            if (res.ok) {
              if (this.deps.loadChats) {
                await this.deps.loadChats();
              }
            }
          } catch (e) {
            console.error("Error deleting workspace:", e);
          }
        }
      }
    },

    /**
     * Renames an existing workspace and updates the backend definition.
     * @param {string} workspaceId - The target workspace ID.
     * @param {Event} event - The triggering UI click event.
     */
    async renameWorkspace(workspaceId, event) {
      if (event) event.stopPropagation();

      const workspace = this.chatWorkspaces.find(w => w.name === workspaceId);
      const displayName = workspace ? workspace.displayName : "";

      if (this.deps.showPromptModal) {
        const newWorkspaceName = await this.deps.showPromptModal(
          "Rename Workspace",
          "Enter new name for workspace:",
          displayName,
        );

        if (
          newWorkspaceName !== null &&
          newWorkspaceName.trim() !== "" &&
          newWorkspaceName.trim() !== displayName
        ) {
          const finalWorkspaceName = newWorkspaceName.trim();
          try {
            const base = window.API_MODULES?.CHATS || "/api/chats";
            const res = await fetch(`${base}/workspaces/${workspaceId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: finalWorkspaceName }),
            });
            if (res.ok) {
              if (this.deps.loadChats) {
                await this.deps.loadChats();
              }
            }
          } catch (e) {
            console.error("Error renaming workspace:", e);
          }
        }
      }
    },

    /**
     * Moves a chat into the specified workspace, creating the workspace on-the-fly if needed.
     * @param {string} chatId - Target chat's ID.
     * @param {string} workspaceIdOrName - ID or Name of target workspace.
     */
    async moveChatToWorkspace(chatId, workspaceIdOrName) {
      if (!this.deps.getSavedChats) return;

      const savedChats = this.deps.getSavedChats();
      const chat = savedChats.find((c) => c.id === chatId);
      if (!chat) return;

      let targetWorkspaceId = workspaceIdOrName;

      // If it's a new name not in our workspaces list, create it first
      if (workspaceIdOrName && !this.chatWorkspaces.find((f) => f.name === workspaceIdOrName)) {
        try {
          const base = window.API_MODULES?.CHATS || "/api/chats";
          const res = await fetch(`${base}/workspaces`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: workspaceIdOrName })
          });
          if (res.ok) {
            const data = await res.json();
            targetWorkspaceId = data.id;
            if (this.deps.loadChats) {
              await this.deps.loadChats(); // Refresh workspaces/chats state
            }
          } else {
            console.error("Failed to create workspace during move.");
            return;
          }
        } catch (e) {
          console.error("Error creating workspace:", e);
          return;
        }
      }

      chat.workspace_id = targetWorkspaceId;

      try {
        const base = window.API_MODULES?.CHATS || "/api/chats";
        await fetch(`${base}/${chatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_id: targetWorkspaceId }),
        });
        if (this.deps.loadChats) {
          await this.deps.loadChats();
        }
      } catch (err) {
        console.error("Error updating chat workspace:", err);
      }
    }
  };

  // Expose as window global
  window.WorkspaceManager = WorkspaceManager;
})();

/**
 * Persona Manager Component
 * Governs AI persona definitions, cards listing, customization forms, and default assignments.
 */

(function () {
  const PersonaManager = {
    deps: {},
    personas: [],
    selectedPersonaId: null,

    // DOM References
    nodes: {},

    /**
     * Initializes the persona manager module with dependencies.
     * @param {Object} dependencies - Core functions/state getters from script.js.
     */
    init(dependencies) {
      this.deps = dependencies;

      // Cache DOM references
      this.nodes = {
        personaListView: document.getElementById("persona-list-view"),
        personaListContainer: document.getElementById("persona-list-container"),
        personaEditView: document.getElementById("persona-edit-view"),
        personaIdInput: document.getElementById("persona-id-input"),
        personaNameInput: document.getElementById("persona-name-input"),
        personaContentInput: document.getElementById("persona-content-input"),
        personaDefaultCheckbox: document.getElementById("persona-default-checkbox"),
        personaResearchCheckbox: document.getElementById("persona-research-checkbox"),
        personaFileSystemCheckbox: document.getElementById("persona-file-system-checkbox"),
        personaBrowsingCheckbox: document.getElementById("persona-browsing-checkbox"),
        personaGitCheckbox: document.getElementById("persona-git-checkbox"),
        newPersonaBtn: document.getElementById("new-persona-btn"),
        cancelPersonaBtn: document.getElementById("cancel-persona-btn"),
        savePersonaBtn: document.getElementById("save-persona-btn"),
      };

      // Set event listeners
      if (this.nodes.newPersonaBtn) {
        this.nodes.newPersonaBtn.addEventListener("click", () => this.openEditPersona());
      }
      if (this.nodes.cancelPersonaBtn) {
        this.nodes.cancelPersonaBtn.addEventListener("click", () => this.closeEditPersona());
      }
      if (this.nodes.savePersonaBtn) {
        this.nodes.savePersonaBtn.addEventListener("click", () => this.savePersona());
      }
      if (this.nodes.personaResearchCheckbox) {
        this.nodes.personaResearchCheckbox.addEventListener("change", () => this.syncPersonaAgentCheckboxes());
      }

      // Initial synchronization
      this.fetchPersonas();
    },

    /**
     * Instantly disables and unchecks other agents if Research Agent is enabled in persona editor.
     */
    syncPersonaAgentCheckboxes() {
      const isResearch = this.nodes.personaResearchCheckbox && this.nodes.personaResearchCheckbox.checked;
      if (isResearch) {
        if (this.nodes.personaFileSystemCheckbox) {
          this.nodes.personaFileSystemCheckbox.checked = false;
          this.nodes.personaFileSystemCheckbox.disabled = true;
          this.nodes.personaFileSystemCheckbox.parentElement.style.opacity = "0.4";
        }
        if (this.nodes.personaBrowsingCheckbox) {
          this.nodes.personaBrowsingCheckbox.checked = false;
          this.nodes.personaBrowsingCheckbox.disabled = true;
          this.nodes.personaBrowsingCheckbox.parentElement.style.opacity = "0.4";
        }
      } else {
        if (this.nodes.personaFileSystemCheckbox) {
          this.nodes.personaFileSystemCheckbox.disabled = false;
          this.nodes.personaFileSystemCheckbox.parentElement.style.opacity = "1";
        }
        if (this.nodes.personaBrowsingCheckbox) {
          this.nodes.personaBrowsingCheckbox.disabled = false;
          this.nodes.personaBrowsingCheckbox.parentElement.style.opacity = "1";
        }
      }
    },

    /**
     * Fetches personas list from the backend API.
     */
    async fetchPersonas() {
      try {
        const response = await fetch("/api/personas");
        const data = await response.json();
        if (data.success) {
          this.personas = data.personas;

          // Set default persona if no chat/persona has been chosen yet
          if (!this.deps.getCurrentChatId() && !this.selectedPersonaId) {
            const defaultPersona = this.personas.find((p) => p.is_default);
            if (defaultPersona) {
              this.selectedPersonaId = defaultPersona.id;
              if (this.deps.onPersonaSelected) {
                this.deps.onPersonaSelected(defaultPersona);
              }
            }
          }

          this.renderPersonas();
        }
      } catch (error) {
        console.error("Error fetching personas:", error);
      }
    },

    /**
     * Renders personas as premium cards in the list view.
     */
    renderPersonas() {
      const container = this.nodes.personaListContainer;
      if (!container) return;

      if (this.personas.length === 0) {
        container.innerHTML = `
          <div style="color: var(--content-muted); font-size: 0.85rem; text-align: center; padding: 2rem;">
            No personas created yet. Click + to create one.
          </div>
        `;
        return;
      }

      container.innerHTML = "";

      const chatHistory = this.deps.getChatHistory ? this.deps.getChatHistory() : [];
      const chatStarted = chatHistory.length > 0;

      this.personas.forEach((persona) => {
        const isSelected = this.selectedPersonaId === persona.id;

        const item = document.createElement("div");
        item.className = `persona-item ${isSelected ? "selected" : ""}`;

        // Disable switching if chat is already underway
        if (chatStarted && !isSelected) {
          item.style.opacity = "0.4";
          item.style.pointerEvents = "none";
          item.style.filter = "grayscale(1)";
        }

        // Header section (Title + Badge)
        const header = document.createElement("div");
        header.className = "persona-name";

        const title = document.createElement("span");
        title.style.flex = "1";
        title.textContent = persona.name;
        header.appendChild(title);

        if (persona.is_default) {
          const badge = document.createElement("span");
          badge.className = "persona-badge";
          badge.textContent = "Default";
          header.appendChild(badge);
        }

        // Actions section (Edit + Delete)
        const actions = document.createElement("div");
        actions.className = "persona-actions";

        // Edit button
        const editBtn = document.createElement("button");
        editBtn.className = "persona-action-btn";
        editBtn.title = "Edit Persona";
        editBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        `;
        editBtn.onclick = (e) => {
          e.stopPropagation();
          this.openEditPersona(persona);
        };
        actions.appendChild(editBtn);

        // Delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "persona-action-btn delete";
        deleteBtn.title = "Delete Persona";
        deleteBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        `;
        deleteBtn.onclick = async (e) => {
          e.stopPropagation();
          const showConfirm = window.showConfirm || (async (title, msg) => window.confirm(msg));
          const confirmed = await showConfirm(
            "Delete Persona",
            `Are you sure you want to delete "${persona.name}"?`,
            true
          );

          if (confirmed) {
            try {
              const res = await fetch(`/api/personas/${persona.id}`, { method: "DELETE" });
              if (res.ok) {
                if (this.selectedPersonaId === persona.id) {
                  this.selectedPersonaId = null;
                }
                await this.fetchPersonas();
              }
            } catch (err) {
              console.error("Failed to delete persona:", err);
            }
          }
        };
        actions.appendChild(deleteBtn);

        item.appendChild(header);
        item.appendChild(actions);

        // Card click handler for selection
        item.onclick = () => {
          if (!chatStarted) {
            this.selectedPersonaId = this.selectedPersonaId === persona.id ? null : persona.id;
            this.renderPersonas();
            if (this.deps.onPersonaSelected) {
              const selectedPersona = this.personas.find(p => p.id === this.selectedPersonaId);
              this.deps.onPersonaSelected(selectedPersona || null);
            }
          }
        };

        container.appendChild(item);
      });
    },

    /**
     * Opens the edit view loaded with persona details.
     * @param {Object|null} persona 
     */
    openEditPersona(persona = null) {
      if (this.nodes.personaListView) this.nodes.personaListView.classList.add("hidden");
      if (this.nodes.personaEditView) this.nodes.personaEditView.classList.remove("hidden");
      if (this.nodes.newPersonaBtn) this.nodes.newPersonaBtn.style.display = "none";

      if (persona) {
        if (this.nodes.personaIdInput) this.nodes.personaIdInput.value = persona.id;
        if (this.nodes.personaNameInput) this.nodes.personaNameInput.value = persona.name;
        if (this.nodes.personaContentInput) this.nodes.personaContentInput.value = persona.content;
        if (this.nodes.personaDefaultCheckbox) {
          this.nodes.personaDefaultCheckbox.checked = persona.is_default === 1;
        }
        if (this.nodes.personaResearchCheckbox) {
          this.nodes.personaResearchCheckbox.checked = persona.research_mode === 1;
        }
        if (this.nodes.personaFileSystemCheckbox) {
          this.nodes.personaFileSystemCheckbox.checked = persona.file_system_mode === 1;
        }
        if (this.nodes.personaBrowsingCheckbox) {
          this.nodes.personaBrowsingCheckbox.checked = persona.browsing_mode === 1;
        }
        if (this.nodes.personaGitCheckbox) {
          this.nodes.personaGitCheckbox.checked = persona.git_mode === 1;
        }
      } else {
        if (this.nodes.personaIdInput) this.nodes.personaIdInput.value = "";
        if (this.nodes.personaNameInput) this.nodes.personaNameInput.value = "";
        if (this.nodes.personaContentInput) this.nodes.personaContentInput.value = "";
        if (this.nodes.personaDefaultCheckbox) {
          this.nodes.personaDefaultCheckbox.checked = false;
        }
        if (this.nodes.personaResearchCheckbox) {
          this.nodes.personaResearchCheckbox.checked = false;
        }
        if (this.nodes.personaFileSystemCheckbox) {
          this.nodes.personaFileSystemCheckbox.checked = false;
        }
        if (this.nodes.personaBrowsingCheckbox) {
          this.nodes.personaBrowsingCheckbox.checked = false;
        }
        if (this.nodes.personaGitCheckbox) {
          this.nodes.personaGitCheckbox.checked = false;
        }
      }
      this.syncPersonaAgentCheckboxes();
    },

    /**
     * Closes the edit view and restores the list view.
     */
    closeEditPersona() {
      if (this.nodes.personaListView) this.nodes.personaListView.classList.remove("hidden");
      if (this.nodes.personaEditView) this.nodes.personaEditView.classList.add("hidden");
      if (this.nodes.newPersonaBtn) this.nodes.newPersonaBtn.style.display = "flex";
    },

    /**
     * Saves a persona (either POST for new or PUT for edit).
     */
    async savePersona() {
      const id = this.nodes.personaIdInput ? this.nodes.personaIdInput.value : "";
      const name = this.nodes.personaNameInput ? this.nodes.personaNameInput.value.trim() : "";
      const content = this.nodes.personaContentInput ? this.nodes.personaContentInput.value.trim() : "";
      const is_default = this.nodes.personaDefaultCheckbox && this.nodes.personaDefaultCheckbox.checked ? 1 : 0;
      const research_mode = this.nodes.personaResearchCheckbox && this.nodes.personaResearchCheckbox.checked ? 1 : 0;
      const file_system_mode = this.nodes.personaFileSystemCheckbox && this.nodes.personaFileSystemCheckbox.checked ? 1 : 0;
      const browsing_mode = this.nodes.personaBrowsingCheckbox && this.nodes.personaBrowsingCheckbox.checked ? 1 : 0;
      const git_mode = this.nodes.personaGitCheckbox && this.nodes.personaGitCheckbox.checked ? 1 : 0;

      const showAlert = window.showAlert || ((title, msg) => window.alert(msg));

      if (!name || !content) {
        showAlert("Validation Error", "Name and Instructions are required.");
        return;
      }

      const payload = { name, content, is_default, research_mode, file_system_mode, browsing_mode, git_mode };
      const url = id ? `/api/personas/${id}` : "/api/personas";
      const method = id ? "PUT" : "POST";

      try {
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (data.success) {
          this.closeEditPersona();
          if (is_default) {
            this.selectedPersonaId = data.persona.id;
          }
          await this.fetchPersonas();
        } else {
          showAlert("Save Failed", "Failed to save persona: " + data.error);
        }
      } catch (err) {
        console.error("Error saving persona:", err);
        showAlert("Save Failed", "A network error occurred while saving the persona.");
      }
    },

    /**
     * Gets the currently active persona ID.
     * @returns {string|null}
     */
    getSelectedPersonaId() {
      return this.selectedPersonaId;
    },

    /**
     * Sets the active persona ID and triggers a rerender.
     * @param {string|null} id 
     */
    setSelectedPersonaId(id) {
      this.selectedPersonaId = id;
      this.renderPersonas();
    },

    /**
     * Returns the array of personas.
     * @returns {Array}
     */
    getPersonas() {
      return this.personas;
    },

    /**
     * Resets the active persona to the default defined in the list.
     */
    resetToDefault() {
      const defaultPersona = this.personas.find((p) => p.is_default);
      this.selectedPersonaId = defaultPersona ? defaultPersona.id : null;
      this.renderPersonas();
      if (this.deps.onPersonaSelected) {
        this.deps.onPersonaSelected(defaultPersona || null);
      }
    },
  };

  // Export globally
  window.PersonaManager = PersonaManager;
})();

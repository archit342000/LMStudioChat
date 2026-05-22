/**
 * Luminous Chat — Skills Store Manager Component
 * Governs system skills definitions, cards listing, dynamic custom previews, and REST CRUD sync.
 */

(function () {
  const SkillsManager = {
    deps: {},
    skills: [],

    // DOM References
    nodes: {},

    /**
     * Initializes the skills manager module with dependencies.
     * @param {Object} dependencies - Core functions/state getters from script.js.
     */
    init(dependencies) {
      this.deps = dependencies;

      // Cache DOM references
      this.cacheDOM();

      // Set event listeners
      this.bindEvents();

      // Prefetch skills so they are available for autocomplete
      this.fetchSkills();
    },

    /**
     * Cache all required DOM elements
     */
    cacheDOM() {
      this.nodes = {
        sysManageSkillsBtn: document.getElementById("sys-manage-skills"),
        skillsStoreOverlay: document.getElementById("skills-store-overlay"),
        closeSkillsBtn: document.getElementById("close-skills-btn"),
        skillsSearchInput: document.getElementById("skills-search-input"),
        
        // List elements
        skillsListView: document.getElementById("skills-list-view"),
        skillsListContainer: document.getElementById("skills-list-container"),
        skillsSearchContainer: document.getElementById("skills-search-bar-container"),
        skillsAddFab: document.getElementById("skills-add-fab"),

        // Form elements
        skillEditView: document.getElementById("skill-edit-view"),
        skillIdInput: document.getElementById("skill-id-input"),
        skillNameInput: document.getElementById("skill-name-input"),
        skillDescriptionInput: document.getElementById("skill-description-input"),
        skillInstructionsInput: document.getElementById("skill-instructions-input"),
        cancelSkillBtn: document.getElementById("cancel-skill-btn"),
        saveSkillBtn: document.getElementById("save-skill-btn"),
        skillsStoreTitle: document.getElementById("skills-store-title")
      };
    },

    /**
     * Bind UI event listeners
     */
    bindEvents() {
      // Toggle opening
      if (this.nodes.sysManageSkillsBtn) {
        this.nodes.sysManageSkillsBtn.addEventListener("click", () => {
          if (this.deps.closeSystemSettings) {
            this.deps.closeSystemSettings();
          }
          this.openSkillsOverlay();
        });
      }

      // Close overlay
      if (this.nodes.closeSkillsBtn) {
        this.nodes.closeSkillsBtn.addEventListener("click", () => this.closeSkillsOverlay());
      }

      // Search input filtering
      if (this.nodes.skillsSearchInput) {
        this.nodes.skillsSearchInput.addEventListener("input", () => this.renderSkills());
      }

      // Format skill name trigger on input to prevent spaces/invalid triggers
      if (this.nodes.skillNameInput) {
        this.nodes.skillNameInput.addEventListener("input", (e) => {
          const val = e.target.value;
          // Convert to lowercase, replace spaces with hyphens, strip slashes, keep only a-z0-9-_
          const cleaned = val.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '').replace(/[^a-z0-9-_]/g, '');
          if (val !== cleaned) {
            e.target.value = cleaned;
          }
        });
      }

      // Add Skill trigger
      if (this.nodes.skillsAddFab) {
        this.nodes.skillsAddFab.addEventListener("click", () => this.openEditSkill());
      }

      // Cancel Skill Form
      if (this.nodes.cancelSkillBtn) {
        this.nodes.cancelSkillBtn.addEventListener("click", () => this.closeEditSkill());
      }

      // Save/Submit Skill Form
      if (this.nodes.saveSkillBtn) {
        this.nodes.saveSkillBtn.addEventListener("click", () => this.saveSkill());
      }

      // Backdrop closing click
      window.addEventListener("click", (e) => {
        if (e.target === this.nodes.skillsStoreOverlay) {
          this.closeSkillsOverlay();
        }
      });
    },

    /**
     * Opens the skills overlay and fetches current lists
     */
    openSkillsOverlay() {
      if (!this.nodes.skillsStoreOverlay) return;

      this.nodes.skillsStoreOverlay.classList.remove("hidden");
      void this.nodes.skillsStoreOverlay.offsetWidth; // force reflow
      this.nodes.skillsStoreOverlay.classList.add("open");

      this.fetchSkills();
    },

    /**
     * Closes the skills overlay
     */
    closeSkillsOverlay() {
      if (!this.nodes.skillsStoreOverlay) return;

      this.nodes.skillsStoreOverlay.classList.remove("open");
      setTimeout(() => {
        this.nodes.skillsStoreOverlay.classList.add("hidden");
        this.closeEditSkill();
      }, 300);
    },

    /**
     * Fetches all skills from the server APIs
     */
    async fetchSkills() {
      try {
        const response = await fetch("/api/skills");
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            this.skills = data.skills || [];
            this.renderSkills();
          }
        }
      } catch (error) {
        console.error("Error loading skills store:", error);
        if (window.showToast) {
          window.showToast("Failed to load skills store.", "error");
        }
      }
    },

    /**
     * Render the skills list beautifully inside the overlay
     */
    renderSkills() {
      const container = this.nodes.skillsListContainer;
      if (!container) return;

      container.innerHTML = "";

      const query = this.nodes.skillsSearchInput ? this.nodes.skillsSearchInput.value.toLowerCase().trim() : "";
      const filtered = this.skills.filter(s => 
        s.name.toLowerCase().includes(query) || 
        s.description.toLowerCase().includes(query)
      );

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="color: var(--content-muted); font-size: 0.85rem; text-align: center; padding: 2rem;">
            ${query ? "No matching skills found." : "No skills created yet. Click '+' to create your first skill!"}
          </div>
        `;
        return;
      }

      const escapeFn = window.escapeHtml || (str => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      });

      filtered.forEach((skill) => {
        const item = document.createElement("div");
        item.className = "hardware-surface";
        item.style.padding = "1.25rem";
        item.style.display = "flex";
        item.style.flexDirection = "column";
        item.style.gap = "0.5rem";
        item.style.marginBottom = "0"; // rely on gap

        // Header Row
        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";
        header.style.width = "100%";

        const titleBadge = document.createElement("span");
        titleBadge.className = "badge";
        titleBadge.style.fontFamily = "monospace";
        titleBadge.style.fontSize = "0.85rem";
        titleBadge.style.background = "var(--accent-subtle)";
        titleBadge.style.color = "var(--accent)";
        titleBadge.style.padding = "4px 8px";
        titleBadge.style.borderRadius = "6px";
        titleBadge.textContent = `/${skill.name}`;
        header.appendChild(titleBadge);

        // Actions (Edit, Delete)
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "0.5rem";

        // Edit
        const editBtn = document.createElement("button");
        editBtn.className = "btn-ghost";
        editBtn.title = "Edit Skill";
        editBtn.style.width = "2rem";
        editBtn.style.height = "2rem";
        editBtn.style.padding = "0";
        editBtn.style.borderRadius = "0.5rem";
        editBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        `;
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.openEditSkill(skill);
        });
        actions.appendChild(editBtn);

        // Delete
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn-ghost";
        deleteBtn.title = "Delete Skill";
        deleteBtn.style.width = "2rem";
        deleteBtn.style.height = "2rem";
        deleteBtn.style.padding = "0";
        deleteBtn.style.borderRadius = "0.5rem";
        deleteBtn.style.color = "var(--color-rose)";
        deleteBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        `;
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.deleteSkillAction(skill);
        });
        actions.appendChild(deleteBtn);

        header.appendChild(actions);
        item.appendChild(header);

        // Description
        const desc = document.createElement("p");
        desc.style.fontSize = "0.85rem";
        desc.style.color = "var(--content-muted)";
        desc.style.margin = "0.25rem 0 0 0";
        desc.style.lineHeight = "1.5";
        desc.textContent = skill.description;
        item.appendChild(desc);

        // Expandable Instruction block
        const toggleWrapper = document.createElement("div");
        toggleWrapper.style.marginTop = "0.75rem";
        toggleWrapper.style.borderTop = "1px dashed var(--glass-border)";
        toggleWrapper.style.paddingTop = "0.75rem";

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "btn-ghost";
        toggleBtn.style.padding = "2px 6px";
        toggleBtn.style.height = "auto";
        toggleBtn.style.fontSize = "0.75rem";
        toggleBtn.style.display = "flex";
        toggleBtn.style.alignItems = "center";
        toggleBtn.style.gap = "4px";
        toggleBtn.innerHTML = `
          <span>Show Instructions</span>
          <svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transition: transform 0.2s;"><path d="M6 9l6 6 6-6"/></svg>
        `;
        
        const preview = document.createElement("div");
        preview.className = "instructions-preview hidden";
        preview.style.marginTop = "0.5rem";
        preview.style.background = "rgba(0,0,0,0.15)";
        preview.style.borderRadius = "8px";
        preview.style.padding = "0.75rem";
        preview.style.fontFamily = "var(--font-serif)";
        preview.style.fontSize = "0.8rem";
        preview.style.lineHeight = "1.4";
        preview.style.whiteSpace = "pre-wrap";
        preview.style.color = "var(--content-primary)";
        preview.style.border = "1px solid var(--glass-border)";
        preview.textContent = skill.instructions;

        toggleBtn.addEventListener("click", () => {
          const isHidden = preview.classList.contains("hidden");
          const chevron = toggleBtn.querySelector(".chevron-icon");
          if (isHidden) {
            preview.classList.remove("hidden");
            chevron.style.transform = "rotate(180deg)";
            toggleBtn.querySelector("span").textContent = "Hide Instructions";
          } else {
            preview.classList.add("hidden");
            chevron.style.transform = "rotate(0deg)";
            toggleBtn.querySelector("span").textContent = "Show Instructions";
          }
        });

        toggleWrapper.appendChild(toggleBtn);
        toggleWrapper.appendChild(preview);
        item.appendChild(toggleWrapper);

        container.appendChild(item);
      });
    },

    /**
     * Swaps to form screen loaded with skill details or blank
     * @param {Object|null} skill
     */
    openEditSkill(skill = null) {
      const isEdit = !!skill;

      if (this.nodes.skillsStoreTitle) {
        this.nodes.skillsStoreTitle.textContent = isEdit ? "Edit Skill" : "Create Skill";
      }

      if (this.nodes.skillIdInput) this.nodes.skillIdInput.value = isEdit ? skill.id : "";
      if (this.nodes.skillNameInput) {
        this.nodes.skillNameInput.value = isEdit ? skill.name : "";
        this.nodes.skillNameInput.disabled = isEdit; // Block changing name once created to prevent triggers/DB schema key mismatches
      }
      if (this.nodes.skillDescriptionInput) this.nodes.skillDescriptionInput.value = isEdit ? skill.description : "";
      if (this.nodes.skillInstructionsInput) this.nodes.skillInstructionsInput.value = isEdit ? skill.instructions : "";

      // Swap UI visibility
      if (this.nodes.skillsListView) this.nodes.skillsListView.classList.add("hidden");
      if (this.nodes.skillsSearchContainer) this.nodes.skillsSearchContainer.classList.add("hidden");
      if (this.nodes.skillsAddFab) this.nodes.skillsAddFab.classList.add("hidden");
      if (this.nodes.skillEditView) this.nodes.skillEditView.classList.remove("hidden");

      if (this.nodes.skillNameInput && !isEdit) {
        this.nodes.skillNameInput.focus();
      } else if (this.nodes.skillDescriptionInput && isEdit) {
        this.nodes.skillDescriptionInput.focus();
      }
    },

    /**
     * Resets form states and returns to list view
     */
    closeEditSkill() {
      if (this.nodes.skillsStoreTitle) {
        this.nodes.skillsStoreTitle.textContent = "Skills Store";
      }

      if (this.nodes.skillIdInput) this.nodes.skillIdInput.value = "";
      if (this.nodes.skillNameInput) {
        this.nodes.skillNameInput.value = "";
        this.nodes.skillNameInput.disabled = false;
      }
      if (this.nodes.skillDescriptionInput) this.nodes.skillDescriptionInput.value = "";
      if (this.nodes.skillInstructionsInput) this.nodes.skillInstructionsInput.value = "";

      // Swap UI visibility
      if (this.nodes.skillEditView) this.nodes.skillEditView.classList.add("hidden");
      if (this.nodes.skillsListView) this.nodes.skillsListView.classList.remove("hidden");
      if (this.nodes.skillsSearchContainer) this.nodes.skillsSearchContainer.classList.remove("hidden");
      if (this.nodes.skillsAddFab) this.nodes.skillsAddFab.classList.remove("hidden");
    },

    /**
     * Submits the skill creation/update to backend
     */
    async saveSkill() {
      const skillId = this.nodes.skillIdInput ? this.nodes.skillIdInput.value : "";
      const name = this.nodes.skillNameInput ? this.nodes.skillNameInput.value.trim() : "";
      const description = this.nodes.skillDescriptionInput ? this.nodes.skillDescriptionInput.value.trim() : "";
      const instructions = this.nodes.skillInstructionsInput ? this.nodes.skillInstructionsInput.value.trim() : "";

      if (!name || !description || !instructions) {
        if (window.showToast) {
          window.showToast("All fields are required.", "error");
        }
        return;
      }

      const body = { name, description, instructions };
      const url = skillId ? `/api/skills/${skillId}` : "/api/skills";
      const method = skillId ? "PUT" : "POST";

      try {
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const data = await response.json();
        if (response.ok && data.success) {
          if (window.showToast) {
            window.showToast(skillId ? "Skill updated successfully!" : "Skill created successfully!", "success");
          }
          this.closeEditSkill();
          await this.fetchSkills();
        } else {
          const errorMsg = data.error || "Failed to save skill.";
          if (window.showToast) {
            window.showToast(errorMsg, "error");
          }
        }
      } catch (error) {
        console.error("Error saving skill:", error);
        if (window.showToast) {
          window.showToast("Network error saving skill.", "error");
        }
      }
    },

    /**
     * Perform DELETE operation for skill card
     * @param {Object} skill
     */
    async deleteSkillAction(skill) {
      if (!window.showConfirm) return;

      const confirmed = await window.showConfirm(
        "Delete Skill",
        `Are you sure you want to permanently delete "/${skill.name}"? This action cannot be undone.`,
        true // isDanger
      );

      if (confirmed) {
        try {
          const response = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" });
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              if (window.showToast) {
                window.showToast("Skill deleted successfully.", "success");
              }
              await this.fetchSkills();
            }
          }
        } catch (error) {
          console.error("Failed to delete skill:", error);
          if (window.showToast) {
            window.showToast("Failed to delete skill.", "error");
          }
        }
      }
    }
  };

  // Expose to window
  window.SkillsManager = SkillsManager;
})();

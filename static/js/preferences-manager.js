/**
 * Luminous Chat — User Preferences Manager UI
 * Handles the display, addition, modification, searching, sorting, and deletion of custom user memories and preferences.
 */

window.PreferencesManager = {
  allPreferences: [],
  deps: {
    getCurrentChatId: null,
    closeSystemSettings: null
  },

  // DOM Elements
  elements: {
    sysManagePreferencesBtn: null,
    preferencesFileSystemOverlay: null,
    closePreferencesBtn: null,
    preferencesAddBtn: null,
    preferencesListContainer: null,
    preferencesSearchInput: null,
    preferencesFilterSelect: null,
    preferencesSortSelect: null
  },

  init: function(deps) {
    this.deps = { ...this.deps, ...deps };
    this.elements.sysManagePreferencesBtn = document.getElementById("sys-manage-preferences");
    this.elements.preferencesFileSystemOverlay = document.getElementById("preferences-file-system-overlay");
    this.elements.closePreferencesBtn = document.getElementById("close-preferences-btn");
    this.elements.preferencesAddBtn = document.getElementById("preferences-add-fab");
    this.elements.preferencesListContainer = document.getElementById("preferences-list-container");
    this.elements.preferencesSearchInput = document.getElementById("preferences-search-input");
    this.elements.preferencesFilterSelect = document.getElementById("preferences-filter-select");
    this.elements.preferencesSortSelect = document.getElementById("preferences-sort-select");

    this.bindEvents();
  },

  bindEvents: function() {
    if (this.elements.preferencesSearchInput) {
      this.elements.preferencesSearchInput.addEventListener("input", () => this.renderPreferences());
    }
    if (this.elements.preferencesFilterSelect) {
      this.elements.preferencesFilterSelect.addEventListener("change", () => this.renderPreferences());
    }
    if (this.elements.preferencesSortSelect) {
      this.elements.preferencesSortSelect.addEventListener("change", () => this.renderPreferences());
    }

    if (this.elements.sysManagePreferencesBtn) {
      this.elements.sysManagePreferencesBtn.addEventListener("click", () => {
        if (this.deps.closeSystemSettings) {
          this.deps.closeSystemSettings();
        }
        if (this.elements.preferencesFileSystemOverlay) {
          this.elements.preferencesFileSystemOverlay.classList.remove("hidden");
          setTimeout(() => {
            this.elements.preferencesFileSystemOverlay.classList.add("open");
          }, 10);
          this.loadPreferences();
        }
      });
    }

    if (this.elements.closePreferencesBtn) {
      this.elements.closePreferencesBtn.addEventListener("click", () => {
        if (this.elements.preferencesFileSystemOverlay) {
          this.elements.preferencesFileSystemOverlay.classList.remove("open");
          setTimeout(() => {
            this.elements.preferencesFileSystemOverlay.classList.add("hidden");
          }, 300);
        }
      });
    }

    if (this.elements.preferencesAddBtn) {
      this.elements.preferencesAddBtn.addEventListener("click", () => {
        this.openEditPreferenceModal();
      });
    }
  },

  loadPreferences: async function() {
    const chatId = this.deps.getCurrentChatId ? this.deps.getCurrentChatId() : "";
    const apiTools = (window.API_MODULES && window.API_MODULES.TOOLS) || "/api/tools";
    try {
      const res = await fetch(`${apiTools}/preferences?chat_id=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.allPreferences = data.preferences || [];
          this.renderPreferences();
        }
      }
    } catch (e) {
      console.error("Error loading memories:", e);
    }
  },

  renderPreferences: function() {
    if (!this.elements.preferencesListContainer) return;
    this.elements.preferencesListContainer.innerHTML = "";

    let filtered = [...this.allPreferences];

    // Filter by Tag
    const tagFilter = this.elements.preferencesFilterSelect ? this.elements.preferencesFilterSelect.value : "all";
    if (tagFilter !== "all") {
      filtered = filtered.filter((m) => m.tag === tagFilter);
    }

    // Search
    const query = this.elements.preferencesSearchInput ? this.elements.preferencesSearchInput.value.toLowerCase() : "";
    if (query) {
      filtered = filtered.filter((m) =>
        m.content.toLowerCase().includes(query)
      );
    }

    // Sort
    const sortMode = this.elements.preferencesSortSelect ? this.elements.preferencesSortSelect.value : "newest";
    if (sortMode === "newest") {
      filtered.sort((a, b) => b.timestamp - a.timestamp);
    } else {
      filtered.sort((a, b) => a.timestamp - b.timestamp);
    }

    if (filtered.length === 0) {
      this.elements.preferencesListContainer.innerHTML = `<div class="text-center" style="color: var(--content-muted); padding: 2rem;">No preferences found.</div>`;
      return;
    }

    const escapeFn = window.escapeHtml || (str => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    });

    filtered.forEach((mem) => {
      const item = document.createElement("div");
      item.className = "hardware-surface";
      item.style.padding = "1rem";
      item.style.display = "flex";
      item.style.flexDirection = "column";
      item.style.gap = "0.5rem";

      const tagColorMap = {
        preference: "var(--color-primary-500)",
        personal_info: "var(--brand-accent-1)",
        dislike: "var(--color-rose-500)",
        other: "var(--color-amber)"
      };
      const tagColor = tagColorMap[mem.tag] || "var(--content-muted)";
      const dateStr = new Date(mem.timestamp * 1000).toLocaleString();

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: ${tagColor}; border: 1px solid ${tagColor}; padding: 2px 6px; border-radius: 4px;">${mem.tag.replace("_", " ")}</span>
              <span style="font-size: 0.7rem; color: var(--content-muted);">${dateStr}</span>
            </div>
            <div style="font-size: 0.95rem; color: var(--content-primary); line-height: 1.5; white-space: pre-wrap;">${escapeFn(mem.content)}</div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-ghost edit-mem-btn" title="Edit" style="padding: 0.5rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button class="btn-ghost delete-mem-btn" title="Delete" style="padding: 0.5rem; color: var(--color-rose-500);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;

      item.querySelector(".edit-mem-btn").addEventListener("click", () => {
        this.openEditPreferenceModal(mem);
      });

      item.querySelector(".delete-mem-btn").addEventListener("click", async () => {
        const confirmFn = window.showConfirm || (async () => confirm("Are you sure you want to delete this preference?"));
        if (await confirmFn("Delete Preference", "Are you sure you want to delete this preference?")) {
          const chatId = this.deps.getCurrentChatId ? this.deps.getCurrentChatId() : "";
          const apiTools = (window.API_MODULES && window.API_MODULES.TOOLS) || "/api/tools";
          try {
            const res = await fetch(`${apiTools}/preferences/${mem.id}?chat_id=${chatId}`, {
              method: "DELETE"
            });
            if (res.ok) {
              this.loadPreferences();
            }
          } catch (err) {
            console.error("Failed to delete preference:", err);
          }
        }
      });

      this.elements.preferencesListContainer.appendChild(item);
    });
  },

  openEditPreferenceModal: async function(mem = null) {
    const isEdit = !!mem;
    const inputEl = document.getElementById("prompt-input");
    if (!inputEl) return;
    const parent = inputEl.parentNode;

    // Create container for Fact text area
    const factContainer = document.createElement("div");
    factContainer.style.width = "100%";
    factContainer.style.marginBottom = "1.25rem";
    factContainer.style.textAlign = "left";

    const factLabel = document.createElement("label");
    factLabel.style.display = "block";
    factLabel.style.fontSize = "0.75rem";
    factLabel.style.fontWeight = "700";
    factLabel.style.textTransform = "uppercase";
    factLabel.style.letterSpacing = "0.05em";
    factLabel.style.color = "var(--content-muted)";
    factLabel.style.marginBottom = "0.5rem";
    factLabel.textContent = "Fact / Memory Detail";

    const textarea = document.createElement("textarea");
    textarea.className = "input-luminous";
    textarea.style.minHeight = "110px";
    textarea.style.width = "100%";
    textarea.style.padding = "0.75rem 1rem";
    textarea.style.resize = "vertical";
    textarea.style.lineHeight = "1.5";
    textarea.placeholder = "Enter key details to remember...";
    if (isEdit) textarea.value = mem.content;

    factContainer.appendChild(factLabel);
    factContainer.appendChild(textarea);

    // Create container for Category select dropdown
    const catContainer = document.createElement("div");
    catContainer.style.width = "100%";
    catContainer.style.marginBottom = "1.75rem";
    catContainer.style.textAlign = "left";

    const catLabel = document.createElement("label");
    catLabel.style.display = "block";
    catLabel.style.fontSize = "0.75rem";
    catLabel.style.fontWeight = "700";
    catLabel.style.textTransform = "uppercase";
    catLabel.style.letterSpacing = "0.05em";
    catLabel.style.color = "var(--content-muted)";
    catLabel.style.marginBottom = "0.5rem";
    catLabel.textContent = "Category";

    const tagSelect = document.createElement("select");
    tagSelect.className = "input-luminous";
    tagSelect.style.width = "100%";
    tagSelect.style.cursor = "pointer";
    tagSelect.innerHTML = `
      <option value="preference">Preference</option>
      <option value="personal_info">Personal Info</option>
      <option value="dislike">Dislike</option>
      <option value="other">Other</option>
    `;
    if (isEdit) tagSelect.value = mem.tag;

    catContainer.appendChild(catLabel);
    catContainer.appendChild(tagSelect);

    parent.insertBefore(factContainer, inputEl);
    parent.insertBefore(catContainer, inputEl);
    inputEl.style.display = "none";

    const result = await new Promise((resolve) => {
      const modal = document.getElementById("prompt-modal");
      const titleEl = document.getElementById("prompt-title");
      const msgEl = document.getElementById("prompt-message");
      const confirmBtn = document.getElementById("prompt-action-btn");
      const cancelBtn = document.getElementById("prompt-cancel-btn");
      const selectContainer = document.getElementById("prompt-select-container");

      if (selectContainer) selectContainer.style.display = "none";
      if (titleEl) titleEl.textContent = isEdit ? "Edit Preference" : "Add Preference";
      if (msgEl) msgEl.textContent = "Provide the fact and select its category:";
      if (confirmBtn) confirmBtn.textContent = "Save Preference";
      if (cancelBtn) cancelBtn.textContent = "Cancel";

      const iconSvg = document.getElementById("prompt-icon-svg");
      if (iconSvg) {
        iconSvg.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M15 13a4.5 4.5 0 0 0-3-4" /><path d="M17.599 6.5a3 3 0 0 0 1.225-3.048" /><path d="M9.5 13.5c-1.5 0-3-1-3-3" /><path d="M6.4 6.5c-1.12.5-2.4 1.5-2.4 3.5" /></svg>`;
      }

      if (modal) {
        modal.style.display = "flex";
        void modal.offsetWidth;
        modal.classList.add("open");
      }
      textarea.focus();

      const cleanup = () => {
        if (modal) modal.classList.remove("open");
        setTimeout(() => {
          if (modal) modal.style.display = "none";
          factContainer.remove();
          catContainer.remove();
          inputEl.style.display = "block";
        }, 300);
        if (confirmBtn) confirmBtn.onclick = null;
        if (cancelBtn) cancelBtn.onclick = null;
      };

      if (confirmBtn) {
        confirmBtn.onclick = () => {
          const content = textarea.value.trim();
          const tag = tagSelect.value;
          cleanup();
          resolve(content ? { content, tag } : null);
        };
      }

      if (cancelBtn) {
        cancelBtn.onclick = () => {
          cleanup();
          resolve(null);
        };
      }
    });

    // Backend Sync
    if (result) {
      const chatId = this.deps.getCurrentChatId ? this.deps.getCurrentChatId() : "";
      const apiTools = (window.API_MODULES && window.API_MODULES.TOOLS) || "/api/tools";
      try {
        if (isEdit) {
          await fetch(`${apiTools}/preferences/${mem.id}?chat_id=${chatId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result)
          });
        } else {
          await fetch(`${apiTools}/preferences?chat_id=${chatId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result)
          });
        }
        this.loadPreferences();
      } catch (e) {
        console.error("Failed to save preference:", e);
      }
    }
  },

  getAllPreferences: function() {
    return this.allPreferences;
  }
};

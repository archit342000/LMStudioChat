/**
 * Luminous Chat — Slash Command Autocomplete Dropdown
 * Handles showing a premium dropdown when user types "/" as the first character of the prompt input.
 */

(function () {
  const SlashAutocomplete = {
    isOpen: false,
    activeIndex: 0,
    filteredItems: [],
    
    builtInCommands: [
      {
        trigger: "/help",
        description: "Explain how to use skills and list available options",
        isBuiltIn: true
      },
      {
        trigger: "/skills",
        description: "Manage custom AI skills and prompt templates",
        isBuiltIn: true
      }
    ],

    // DOM Elements
    nodes: {},

    /**
     * Initializes the autocomplete manager
     */
    init() {
      this.cacheDOM();
      if (!this.nodes.textarea || !this.nodes.dropdown) return;
      this.bindEvents();
    },

    cacheDOM() {
      this.nodes = {
        textarea: document.getElementById("chat-textarea"),
        dropdown: document.getElementById("slash-commands-autocomplete")
      };
    },

    bindEvents() {
      // Listen to typing in prompt input
      this.nodes.textarea.addEventListener("input", () => this.handleInput());
      
      // Key navigation
      this.nodes.textarea.addEventListener("keydown", (e) => this.handleKeyDown(e), true);

      // Hide on clicking outside
      document.addEventListener("click", (e) => {
        if (this.isOpen && !this.nodes.dropdown.contains(e.target) && e.target !== this.nodes.textarea) {
          this.closeDropdown();
        }
      });

      // Show dropdown on focus if the textarea starts with "/" and has no spaces
      this.nodes.textarea.addEventListener("focus", () => {
        if (this.nodes.textarea.value.startsWith("/") && !this.nodes.textarea.value.includes(" ")) {
          this.handleInput();
        }
      });
    },

    /**
     * Filters options and manages opening/closing the dropdown
     */
    handleInput() {
      const value = this.nodes.textarea.value;

      // Only trigger if input starts with "/" and doesn't contain space
      if (!value.startsWith("/") || value.includes(" ")) {
        this.closeDropdown();
        return;
      }

      this.activeIndex = 0;

      const query = value.slice(1).toLowerCase();

      // Retrieve custom skills
      const customSkills = (window.SkillsManager && window.SkillsManager.skills) || [];
      const skillOptions = customSkills.map(skill => ({
        trigger: `/${skill.name}`,
        description: skill.description || "Custom skill trigger",
        isBuiltIn: false,
        skill: skill
      }));

      // Combine built-ins with custom skills
      const allOptions = [...this.builtInCommands, ...skillOptions];

      // Filter based on matching query
      this.filteredItems = allOptions.filter(item => 
        item.trigger.toLowerCase().includes(`/${query}`)
      );

      if (this.filteredItems.length === 0) {
        this.closeDropdown();
        return;
      }

      // Keep active index in bounds
      if (this.activeIndex >= this.filteredItems.length) {
        this.activeIndex = 0;
      }

      this.renderDropdown();
      this.openDropdown();
    },

    /**
     * Handles keyboard navigation and selection
     */
    handleKeyDown(e) {
      if (!this.isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        this.activeIndex = (this.activeIndex + 1) % this.filteredItems.length;
        this.updateActiveItem();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        this.activeIndex = (this.activeIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
        this.updateActiveItem();
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const selected = this.filteredItems[this.activeIndex];
        if (selected) {
          this.selectItem(selected);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.closeDropdown();
      }
    },

    /**
     * Renders dropdown items elegantly
     */
    renderDropdown() {
      const container = this.nodes.dropdown;
      if (!container) return;

      container.innerHTML = "";

      // Create scrollable wrapper for items
      const itemsContainer = document.createElement("div");
      itemsContainer.className = "slash-autocomplete-items-list";

      this.filteredItems.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "slash-autocomplete-item";
        if (idx === this.activeIndex) {
          div.classList.add("active");
        }

        const headerDiv = document.createElement("div");
        headerDiv.className = "command-header";

        const triggerSpan = document.createElement("span");
        triggerSpan.className = "command-trigger";
        triggerSpan.textContent = item.trigger;

        const badgeSpan = document.createElement("span");
        badgeSpan.className = `command-badge ${item.isBuiltIn ? 'badge-builtin' : 'badge-skill'}`;
        badgeSpan.textContent = item.isBuiltIn ? "System" : "Skill";

        headerDiv.appendChild(triggerSpan);
        headerDiv.appendChild(badgeSpan);

        const descSpan = document.createElement("span");
        descSpan.className = "command-description";
        descSpan.textContent = item.description;

        div.appendChild(headerDiv);
        div.appendChild(descSpan);

        div.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.selectItem(item);
        });

        itemsContainer.appendChild(div);
      });

      container.appendChild(itemsContainer);

      // Render legend footer
      const legendDiv = document.createElement("div");
      legendDiv.className = "slash-autocomplete-legend";
      legendDiv.innerHTML = `
        <span class="legend-title">Slash Commands</span>
        <span class="legend-keys">Navigate <kbd>↑</kbd><kbd>↓</kbd> · Select <kbd>Tab</kbd>/<kbd>Enter</kbd> · Close <kbd>Esc</kbd></span>
      `;
      container.appendChild(legendDiv);

      this.scrollActiveIntoView();
    },

    updateActiveItem() {
      const items = this.nodes.dropdown.querySelectorAll(".slash-autocomplete-item");
      items.forEach((item, idx) => {
        if (idx === this.activeIndex) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });
      this.scrollActiveIntoView();
    },

    scrollActiveIntoView() {
      const activeEl = this.nodes.dropdown.querySelector(".slash-autocomplete-item.active");
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    },

    openDropdown() {
      if (this.isOpen) return;
      this.nodes.dropdown.classList.remove("hidden");
      this.isOpen = true;
    },

    closeDropdown() {
      if (!this.isOpen) return;
      this.nodes.dropdown.classList.add("hidden");
      this.isOpen = false;
      this.activeIndex = 0;
    },

    /**
     * Injects the selected command trigger into the chat textarea
     */
    selectItem(item) {
      this.nodes.textarea.value = item.trigger + " ";
      
      // Auto-resize textarea event
      const event = new Event("input", { bubbles: true });
      this.nodes.textarea.dispatchEvent(event);

      this.closeDropdown();
      this.nodes.textarea.focus();
    }
  };

  // Expose to window
  window.SlashAutocomplete = SlashAutocomplete;
})();

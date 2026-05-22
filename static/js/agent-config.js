/**
 * Luminous Chat — Sub-Agent Configuration Manager
 * Handles showing the sub-agent config modal, adjusting thinking profiles, tokens, thinking budget, and saving changes to the backend.
 */

window.AgentConfig = {
  agentsConfig: {},
  currentEditingAgent: null,
  deps: {
    showAlert: null
  },

  // DOM Elements
  elements: {
    modal: null,
    closeBtn: null,
    title: null,
    thinkingProfileSelector: null,
    maxTokensSlider: null,
    maxTokensVal: null,
    thinkingBudgetSlider: null,
    thinkingBudgetVal: null,
    saveBtn: null
  },

  init: function(deps) {
    this.deps = { ...this.deps, ...deps };
    this.elements.modal = document.getElementById("agent-config-modal");
    this.elements.closeBtn = document.getElementById("close-agent-config");
    this.elements.title = document.getElementById("agent-config-title");
    this.elements.thinkingProfileSelector = document.getElementById("agent-thinking-profile-selector");
    this.elements.maxTokensSlider = document.getElementById("agent-max-tokens-slider");
    this.elements.maxTokensVal = document.getElementById("agent-max-tokens-val");
    this.elements.thinkingBudgetSlider = document.getElementById("agent-thinking-budget-slider");
    this.elements.thinkingBudgetVal = document.getElementById("agent-thinking-budget-val");
    this.elements.saveBtn = document.getElementById("save-agent-config");

    this.bindEvents();
    this.fetchAgentsConfig();
  },

  bindEvents: function() {
    // Triggers in the DOM
    const configBtns = document.querySelectorAll(".agent-config-btn");
    configBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        this.openAgentConfig(btn.dataset.agent);
      });
    });

    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener("click", () => this.closeAgentConfig());
    }

    if (this.elements.thinkingProfileSelector) {
      this.elements.thinkingProfileSelector.addEventListener("click", (e) => {
        const btn = e.target.closest(".profile-btn");
        if (btn && this.currentEditingAgent && this.agentsConfig[this.currentEditingAgent]) {
          const profile = btn.dataset.profile;
          this.agentsConfig[this.currentEditingAgent].thinking_profile = profile;
          const btns = this.elements.thinkingProfileSelector.querySelectorAll(".profile-btn");
          btns.forEach(b => b.classList.toggle("active", b.dataset.profile === profile));
        }
      });
    }

    if (this.elements.maxTokensSlider) {
      this.elements.maxTokensSlider.addEventListener("input", (e) => {
        if (this.currentEditingAgent && this.agentsConfig[this.currentEditingAgent]) {
          const val = parseInt(e.target.value);
          this.agentsConfig[this.currentEditingAgent].max_tokens = val;
          if (this.elements.maxTokensVal) {
            this.elements.maxTokensVal.textContent = val;
          }
        }
      });
    }

    if (this.elements.thinkingBudgetSlider) {
      this.elements.thinkingBudgetSlider.addEventListener("input", (e) => {
        if (this.currentEditingAgent && this.agentsConfig[this.currentEditingAgent]) {
          const val = parseInt(e.target.value);
          this.agentsConfig[this.currentEditingAgent].thinking_budget = val;
          if (this.elements.thinkingBudgetVal) {
            this.elements.thinkingBudgetVal.textContent = val;
          }
        }
      });
    }

    if (this.elements.saveBtn) {
      this.elements.saveBtn.addEventListener("click", () => this.saveAgentConfig());
    }
  },

  fetchAgentsConfig: async function() {
    try {
      const res = await fetch("/api/tools/config/agents");
      if (res.ok) {
        this.agentsConfig = await res.json();
      }
    } catch (err) {
      console.error("Error fetching agents config:", err);
    }
  },

  openAgentConfig: function(agentName) {
    this.currentEditingAgent = agentName;
    const config = this.agentsConfig[agentName];
    if (!config) return;

    // Set title
    const labels = {
      document_agent: "Document Agent",
      file_system_agent: "FileSystem Agent",
      browsing_agent: "Browsing Agent",
      search_web: "Search Agent",
      visit_page: "Visit Page Agent"
    };
    if (this.elements.title) {
      this.elements.title.textContent = labels[agentName] || agentName;
    }

    // Sync UI profile buttons
    if (this.elements.thinkingProfileSelector) {
      const btns = this.elements.thinkingProfileSelector.querySelectorAll(".profile-btn");
      btns.forEach(b => b.classList.toggle("active", b.dataset.profile === config.thinking_profile));
    }

    if (this.elements.maxTokensSlider) {
      this.elements.maxTokensSlider.value = config.max_tokens;
    }
    if (this.elements.maxTokensVal) {
      this.elements.maxTokensVal.textContent = config.max_tokens;
    }

    if (this.elements.thinkingBudgetSlider) {
      this.elements.thinkingBudgetSlider.value = config.thinking_budget;
    }
    if (this.elements.thinkingBudgetVal) {
      this.elements.thinkingBudgetVal.textContent = config.thinking_budget;
    }

    if (this.elements.modal) {
      this.elements.modal.style.display = "flex";
      setTimeout(() => this.elements.modal.classList.add("open"), 10);
    }
  },

  closeAgentConfig: function() {
    if (this.elements.modal) {
      this.elements.modal.classList.remove("open");
      setTimeout(() => {
        this.elements.modal.style.display = "none";
      }, 300);
    }
  },

  saveAgentConfig: async function() {
    const agent = this.currentEditingAgent;
    const config = this.agentsConfig[agent];
    if (!agent || !config) return;

    const alertFn = this.deps.showAlert || window.showAlert || alert;

    try {
      const res = await fetch(`/api/tools/config/agents/${agent}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });

      if (res.ok) {
        this.closeAgentConfig();
        await alertFn("Success", `${agent} configuration saved.`);
      } else {
        throw new Error("Failed to save config");
      }
    } catch (err) {
      console.error("Error saving agent config:", err);
      await alertFn("Error", "Failed to save configuration.");
    }
  },

  // Getters/setters for testing and integration
  getAgentsConfig: function() {
    return this.agentsConfig;
  },

  getCurrentEditingAgent: function() {
    return this.currentEditingAgent;
  }
};

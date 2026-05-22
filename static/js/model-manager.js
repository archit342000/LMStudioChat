/**
 * Model Selection & GPU Loading Controller (ModelManager)
 *
 * Handles fetching available models from the backend, loading them to VRAM,
 * unloading inactive instances, checking model capability compatibility,
 * and maintaining model selection states.
 */

(function () {
  let selectedModel = localStorage.getItem("my_ai_selected_model") || "";
  let selectedModelName =
    localStorage.getItem("my_ai_selected_model_name") || "Select a Model";
  let isVisionEnabled =
    localStorage.getItem("my_ai_vision_enabled") !== "false";
  let availableModels = [];

  let deps = {};
  let elements = {};

  const ModelManager = {
    /**
     * Initializes the ModelManager with dynamic dependency getters.
     * @param {Object} injectedDeps Injected callback hooks and parameters
     */
    init(injectedDeps) {
      deps = {
        getIsResearchMode: () => false,
        getCurrentChatId: () => null,
        getCurrentChatData: () => null,
        onModelChanged: () => {},
        ...injectedDeps,
      };

      // Resolve selector cache
      elements.modelSelectDropdown = document.getElementById("model-select-dropdown");
      elements.sendBtn = document.getElementById("send-btn");
      elements.sendBtnWrapper = document.getElementById("send-btn-wrapper");
      elements.settingsModal = document.getElementById("settings-modal");

      // Bind drop-down change handler
      if (elements.modelSelectDropdown) {
        elements.modelSelectDropdown.addEventListener("change", (e) => {
          const modelId = e.target.value;
          const model = availableModels.find((m) => m.key === modelId);
          if (model) {
            const shortName = model.display_name || modelId.split("/").pop();
            this.selectModel(modelId, shortName);
          }
        });
      }

      // Initialize UI display to match current selected model name
      if (elements.modelSelectDropdown) {
        elements.modelSelectDropdown.value = selectedModel || "";
      }

      this.checkSendButtonCompatibility();
    },

    // Getters for external integration and testing
    getSelectedModel: () => selectedModel,
    getSelectedModelName: () => selectedModelName,
    getAvailableModels: () => availableModels,
    getIsVisionEnabled: () => isVisionEnabled,
    setIsVisionEnabled: (val) => {
      isVisionEnabled = val;
      localStorage.setItem("my_ai_vision_enabled", val ? "true" : "false");
    },
    setAvailableModels: (models) => { availableModels = models; },

    /**
     * Translates a standard model key/name to its full customized display name.
     */
    resolveModelDisplayName(modelKey) {
      if (!modelKey) return "";
      const models = window.availableModels || availableModels || [];
      const modelDef = models.find((m) => m.key === modelKey || m.display_name === modelKey);
      return modelDef ? modelDef.display_name : modelKey;
    },

    /**
     * Fetches compatible configured models from backend categorized configuration.
     * Triggers dynamic dropdown rendering and default-selection routines.
     */
    async fetchModels(forceLoad = false) {
      if (elements.modelSelectDropdown) {
        elements.modelSelectDropdown.innerHTML =
          '<option value="" disabled selected>Loading config...</option>';
      }

      try {
        const response = await fetch(`${API_MODULES.MODELS}/config`);
        if (!response.ok) throw new Error("Failed to fetch model config");
        const config = await response.json();

        const getModelDisplayName = (key, value) => {
          let base = key.charAt(0).toUpperCase() + key.slice(1);
          if (key === "main") base = "Research Main";
          if (key === "text") base = "General Text";
          if (key === "vision") base = "General Vision";
          if (key === "vision2") base = "General Vision (High)";
          if (key === "coder") base = "General Coder";

          const modelName = value.split("/").pop() || value;
          return `${base} (${modelName})`;
        };

        const allModelsMap = new Map();

        // Populate internal model registry from categorized config
        if (config.research) {
          Object.entries(config.research).forEach(([key, value]) => {
            if (typeof value === "string") {
              allModelsMap.set(value, {
                key: value,
                display_name: getModelDisplayName(key, value),
                capabilities: { vision: key.toLowerCase().includes("vision") },
                category: "research",
              });
            }
          });
        }
        if (config.general) {
          Object.entries(config.general).forEach(([key, value]) => {
            if (typeof value === "string") {
              allModelsMap.set(value, {
                key: value,
                display_name: getModelDisplayName(key, value),
                capabilities: { vision: key.toLowerCase().includes("vision") },
                category: "general",
              });
            }
          });
        }
        availableModels = Array.from(allModelsMap.values());
        window.availableModels = availableModels; // Backward compatibility

        window.modelConfig = config; // Global exposure for other components

        this.renderModelOptions();

        // --- Auto-selection Logic ---
        const isResearchMode = deps.getIsResearchMode();
        if (
          !selectedModel ||
          !availableModels.some((m) => m.key === selectedModel)
        ) {
          // Default pick based on current app mode
          const defaultModel = isResearchMode
            ? config.research?.main
            : config.general?.text;
          const modelDef = availableModels.find((m) => m.key === defaultModel);
          if (modelDef) {
            this.selectModel(modelDef.key, modelDef.display_name, forceLoad);
          }
        } else if (selectedModel) {
          const modelDef = availableModels.find((m) => m.key === selectedModel);
          if (modelDef) {
            this.selectModel(modelDef.key, modelDef.display_name, forceLoad);
          }
        }
      } catch (err) {
        console.error("Failed to fetch models:", err);
        if (elements.modelSelectDropdown) {
          elements.modelSelectDropdown.innerHTML =
            '<option value="" disabled selected>Error loading models</option>';
        }
      }
    },

    /**
     * Builds and inserts dropdown options for all retrieved models.
     */
    renderModelOptions() {
      if (!elements.modelSelectDropdown) return;

      const currentSelected = selectedModel;

      elements.modelSelectDropdown.disabled = false;
      elements.modelSelectDropdown.title = "Select main model";

      elements.modelSelectDropdown.innerHTML = "";
      if (!Array.isArray(availableModels) || availableModels.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.disabled = true;
        opt.selected = true;
        opt.textContent = "No models available";
        elements.modelSelectDropdown.appendChild(opt);
      } else {
        availableModels.forEach((model) => {
          const opt = document.createElement("option");
          opt.value = model.key;
          opt.textContent = model.display_name || model.key.split("/").pop();
          if (model.key === currentSelected) opt.selected = true;
          elements.modelSelectDropdown.appendChild(opt);
        });

        if (
          currentSelected &&
          availableModels.some((m) => m.key === currentSelected)
        ) {
          elements.modelSelectDropdown.value = currentSelected;
        }
      }
    },

    /**
     * Retrieves currently active statuses for loaded engines, syncing labels.
     */
    async updateModelStatusUI() {
      try {
        const res = await fetch(`${API_MODULES.MODELS}/?t=${Date.now()}`, {
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;
        const data = await res.json();

        const modelStatuses = {};
        if (Array.isArray(data.data)) {
          data.data.forEach((m) => {
            modelStatuses[m.id] = m.status?.value || "unloaded";
          });
        }

        const getStatusText = (status) => {
          if (status === "loaded") return "Active";
          if (status === "loading") return "Loading...";
          return "Inactive";
        };

        if (elements.modelSelectDropdown) {
          Array.from(elements.modelSelectDropdown.options).forEach((opt) => {
            if (opt.value && !opt.disabled) {
              const status = modelStatuses[opt.value] || "unloaded";
              const statusLabel = getStatusText(status);
              let baseText = opt.textContent.replace(
                /\s\((Active|Inactive|Loading\.\.\.)\)$/,
                "",
              );
              opt.textContent = `${baseText} (${statusLabel})`;
            }
          });
        }
      } catch (e) {
        console.error("Failed to update model statuses:", e);
      }
    },

    /**
     * Blocks or releases model selection options depending on application state.
     */
    checkSendButtonCompatibility() {
      const sendBtn = elements.sendBtn;
      const sendBtnWrapper = elements.sendBtnWrapper;
      if (!sendBtn || !sendBtnWrapper) return;

      const isResearchMode = deps.getIsResearchMode();
      if (isResearchMode) {
        sendBtn.disabled = false;
        sendBtn.title = "";
        sendBtnWrapper.title = "";
        return;
      }

      sendBtn.classList.remove("incompatible-model");
      sendBtn.title = "";
      sendBtnWrapper.title = "";
    },

    /**
     * Requests the backend to unload loaded AI model configurations.
     */
    async unloadAllModels(excludeIds = []) {
      try {
        const exclusions = Array.isArray(excludeIds) ? excludeIds : [excludeIds];
        if (
          window.modelConfig?.embedding &&
          !exclusions.includes(window.modelConfig.embedding)
        ) {
          exclusions.push(window.modelConfig.embedding);
        }

        const response = await fetch(`${API_MODULES.MODELS}/`);
        if (!response.ok) return;
        const data = await response.json();
        const modelsArray = data.data || [];

        const activeModels = modelsArray.filter((m) => {
          const isBusy =
            m.status &&
            (m.status.value === "loaded" || m.status.value === "loading");
          return isBusy && !exclusions.includes(m.id);
        });

        for (const model of activeModels) {
          console.log(`Unloading LLM Instance: ${model.id}`);
          await fetch(`${API_MODULES.MODELS}/unload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: model.id }),
          }).catch((err) =>
            console.error(`Failed to unload instance ${model.id}:`, err),
          );
        }
      } catch (err) {
        console.error("Error during model unloading:", err);
      }
    },

    /**
     * Requests a specific model load, blocking until readiness reports show loaded status.
     */
    async loadModel(modelKey) {
      try {
        console.log(`Loading model: ${modelKey}`);
        const overlayText = document.getElementById("model-switch-text");
        if (overlayText) overlayText.textContent = "Loading Model to VRAM...";

        const response = await fetch(`${API_MODULES.MODELS}/load`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelKey }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (typeof showAlert === "function") {
            await showAlert(
              "Model Load Failed",
              `Failed to load model. Output: ${errorText}`,
            );
          } else {
            alert(`Model Load Failed: ${errorText}`);
          }
          return false;
        }

        // Polling loop to wait for VRAM residency
        while (true) {
          await new Promise((r) => setTimeout(r, 1500));
          let pollResp = await fetch(`${API_MODULES.MODELS}/`);
          if (pollResp.ok) {
            let pollData = await pollResp.json();
            let targetModel = (pollData.data || []).find(
              (m) => m.id === modelKey,
            );
            if (targetModel?.status?.value === "loaded") {
              console.log(`Model ${modelKey} is now fully loaded in VRAM.`);
              return true;
            }
          }
        }
      } catch (err) {
        console.error("Error loading model:", err);
        if (typeof showAlert === "function") {
          await showAlert("Error", `Error loading model: ${err.message}`);
        } else {
          alert(`Error loading model: ${err.message}`);
        }
        return false;
      }
    },

    /**
     * Triggers active switching sequences for active model targets.
     * Updates local state and UI elements without triggering automatic model loading.
     */
    async selectModel(id, name, isManual = true) {
      selectedModel = id;
      selectedModelName = name;
      localStorage.setItem("my_ai_selected_model", id);
      localStorage.setItem("my_ai_selected_model_name", name);

      if (elements.modelSelectDropdown) elements.modelSelectDropdown.value = id;
      this.checkSendButtonCompatibility();

      if (elements.settingsModal) {
        elements.settingsModal.classList.remove("open");
        setTimeout(() => (elements.settingsModal.style.display = "none"), 300);
      }
      this.renderModelOptions();
      deps.onModelChanged(id, name);
    },
  };

  window.ModelManager = ModelManager;
})();

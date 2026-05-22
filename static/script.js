/**
 * Luminous Chat Application - Main Frontend Controller
 *
 * This file serves as the primary entry point for the Luminous chat interface.
 * It manages the UI lifecycle, state synchronization between the client and
 * backend APIs, real-time message streaming (SSE), and complex UI features
 * like the FileSystem editor, research modes, and user preferences.
 */

document.addEventListener("DOMContentLoaded", () => {
  /**
   * 0. Security & Utilities
   * Provides basic obfuscation for sensitive client-side strings and
   * configures the Markdown renderer (marked.js) with syntax highlighting.
   */

  // Marked.js Markdown renderer configuration is managed dynamically in static/js/markdown-renderer.js
  // Basic XOR-based XOR encryption for client-side storage obfuscation

  // Scroll Lock and Autoscrolling are managed in static/js/scroll-manager.js



  /**
   * 0.1 Modular API Registry
   * Standardized prefixes for the backend's modular Blueprint architecture.
   */
  
  /**
   * Tool Display Configuration
   * Maps internal tool names to user-friendly labels and icons.
   */
  ;

  /**
   * 1. Selector Cache & UI Registry
   * Centralized references to DOM elements to improve performance and maintainability.
   */

  // → getAssistantFriendlyContent moved to static/js/utils.js

  // Main Layout & Navigation
  const sidebar = document.getElementById("sidebar");
  const foldersSidebarSection = document.getElementById("folders-sidebar-section");
  const foldersSectionHeader = document.getElementById("folders-section-header");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const toggleIconPath = document.getElementById("toggle-icon-path");
  const resizer = document.getElementById("sidebar-resizer");
  const textArea = document.getElementById("chat-textarea");
  const sendBtn = document.getElementById("send-btn");
  const filePreviewContainer = document.getElementById("file-preview-container");
  const sendBtnWrapper = document.getElementById("send-btn-wrapper");
  const messagesContainer = document.getElementById("messages");
  const welcomeHero = document.getElementById("welcome-hero");
  const mainElement = document.querySelector("main");
  const appRoot = document.getElementById("app-root");
  const chatInputArea = document.getElementById("chat-input-area");

  // Theme & Aesthetic Controls (managed via System Settings modal)

  // System Settings (Clear Chats, App Reset)
  const systemSettingsTrigger = document.getElementById(
    "system-settings-trigger",
  );
  const systemSettingsModal = document.getElementById("system-settings-modal");
  const closeSystemSettingsBtn = document.getElementById(
    "close-system-settings",
  );
  const sysClearAllChatsBtn = document.getElementById("sys-clear-all-chats");
  const sysResetAppBtn = document.getElementById("sys-reset-app");
  const themeRadios = document.querySelectorAll('input[name="theme"]');






  // User Preferences (Preferences FileSystem Interface) DOM selectors have been modularized

  // Unified Model & Sampling Settings
  const settingsTrigger = document.getElementById("settings-trigger");
  const settingsModal = document.getElementById("settings-modal");
  const closeSettingsBtn = document.getElementById("close-settings");
  const closeSettingsActionBtn = document.getElementById("close-settings-btn");
  const tabItems = document.querySelectorAll(".tab-item");
  const tabContents = document.querySelectorAll(".tab-content");

  // Persona Management has been modularized into static/js/persona-manager.js

  // Sampling Parameter Sliders & Values
  const maxTokensSlider = document.getElementById("max-tokens-slider");
  const maxTokensVal = document.getElementById("max-tokens-val");
  const thinkingBudgetSlider = document.getElementById(
    "thinking-budget-slider",
  );
  const thinkingBudgetVal = document.getElementById("thinking-budget-val");

  // System Settings - New Chat Defaults
  const defaultThinkingProfileSelector = document.getElementById(
    "default-thinking-profile-selector",
  );
  const defaultPreferencesToggle = document.getElementById(
    "default-preferences-toggle",
  );
  const defaultMaxTokensSlider = document.getElementById(
    "default-max-tokens-slider",
  );
  const defaultMaxTokensVal = document.getElementById("default-max-tokens-val");
  const defaultThinkingBudgetSlider = document.getElementById(
    "default-thinking-budget-slider",
  );
  const defaultThinkingBudgetVal = document.getElementById(
    "default-thinking-budget-val",
  );

  // Model Selection UI
  const modelSelectDropdown = document.getElementById("model-select-dropdown");
  const currentModelDisplay = modelSelectDropdown;
  const thinkingProfileSelector = document.getElementById(
    "thinking-profile-selector",
  );

  // Onboarding/Feature Carousel Removed

  const clearChatBtn = document.getElementById("clear-chat-btn");
  const mobileToggle = document.getElementById("mobile-toggle");

  // Chat Organization & Controls
  const newChatBtn = document.getElementById("new-chat-btn");
  const tempChatBtn = document.getElementById("temp-chat-btn");
  const newFolderBtn = document.getElementById("new-folder-btn");
  const chatHistoryList = document.getElementById("chat-history-list");
  const tempChatBanner = document.getElementById("temp-chat-banner");
  const saveTempChatBtn = document.getElementById("save-temp-chat-btn");
  const preferencesToggleSwitch = document.getElementById(
    "preferences-toggle-switch",
  );
  const uiResearchToggle = document.getElementById("deep-research-toggle");
  
  const toolsButton = document.getElementById("tools-button");
  const toolsDropdown = document.getElementById("tools-dropdown");
  const activeToolIconContainer = document.getElementById("active-tool-icon");

  // FileSystem & Artifact Management
  const fileSystemModeToggle = document.getElementById("file-system-mode-toggle");
  const browsingModeToggle = document.getElementById("browsing-mode-toggle");
  const fileSystemPanel = document.getElementById("file-system-panel");
  const fileSystemPanelTitle = document.getElementById("file-system-panel-title");
  const closeFileSystemPanelBtn = document.getElementById("close-file-system-panel");
  const fileSystemPanelResizer = document.getElementById("file-system-resizer");
  const fileSystemPanelCopyBtn = document.getElementById("file-system-panel-copy-btn");
  const fileSystemCodemirrorContainer = document.getElementById(
    "file-system-codemirror-container",
  );
  const fileSystemPreviewContainer = document.getElementById(
    "file-system-preview-container",
  );
  const viewModeSelector = document.getElementById("view-mode-selector");
  const viewModeBtns = document.querySelectorAll(".view-mode-btn");

  let currentFileSystemViewMode = "code"; // "code" or "preview"

  // --- Editor Manager Initialization ---
  window.EditorManager.init({
    getContent: () => currentFileSystemContentRaw,
    setContent: (c) => { currentFileSystemContentRaw = c; },
    getFileId: () => currentFileSystemId,
    getChatId: () => currentChatId,
    getWorkspaceId: () => currentFileSystemWorkspaceId,
    onSave: (id, content) => saveDebounced(id, content),
    onVersionEdit: () => {
      if (typeof handleVersionEdit === "function") handleVersionEdit();
    }
  });

const chatTitleHeader = document.getElementById("chat-title-header");
  const chatTitleDisplay = document.getElementById("chat-title-display");
  const navFilesBtn = document.getElementById("nav-files-btn");
  const rightSidebarResizer = document.getElementById("right-sidebar-resizer");

  // Right Sidebar / Universal FileSystem Panel
  const fileSystemPanelApproveBtn = document.getElementById(
    "file-system-panel-approve-btn",
  );
  const fileSystemPanelSuggestBtn = document.getElementById(
    "file-system-panel-suggest-btn",
  );
  const file_systemPlanEditArea = document.getElementById("file-system-plan-edit-area");
  const file_systemPlanEditTextarea = document.getElementById(
    "file-system-plan-edit-textarea",
  );
  const file_systemPlanEditSubmit = document.getElementById(
    "file-system-plan-edit-submit",
  );
  const file_systemPlanEditClose = document.getElementById("file-system-plan-edit-close");
  const rightSidebar = document.getElementById("right-sidebar");
  const rightSidebarClose = document.getElementById("right-sidebar-close");
  const file_systemListContainer = document.getElementById("file-system-list");

  // Research Hero Selectors (Legacy but preserved for safety)
  const toggleRegularSearchBtn = document.getElementById(
    "toggle-regular-search",
  );

  /**
   * 2. Application State Management
   * Defines the reactive state of the application.
   * Selective persistence is used (localStorage for settings, SQL for chats).
   */

  let chatHistory = []; // Current turn-by-turn history

  let savedChats = []; // Metadata of all persistent chats
  let currentChatId = null; // UUID or local ID of active chat
  let currentFileSystemId = null; // ID of the file_system being edited
  let currentFileSystemWorkspaceId = null; 
  let currentFileSystemLanguage = "markdown"; // Language of the current file_system
  let currentFileSystemContentRaw = ""; // Un-rendered markdown/code for file_system
  let currentAbortController = null; // Used to stop SSE streams
  let isTemporaryChat = false; // If true, chat is not sent to DB
  let isUserPreferences = true; // Toggle for history-aware context
  let isResearchMode =
    localStorage.getItem("my_ai_is_research_mode") === "true";
  let isResearchCompleted = false;
  let isResearchOngoing = false;
  let fileSystemMode = false; // If file_system panel is active
  let browsingMode = false; // If browsing agent is enabled
  let fileSystemPanelVisible = false;
  let wasUserPreferences = true;
  let currentResearchPlan = null;
  let isFetchingFileSystems = false;
  let isChatLoading = false;

  // FileSystem/Artifact Registry
  let _allFileSystems = [];
  
  // Workspace & Organization State
  let activeClarificationIds = []; // IDs of tool calls waiting for input
  const _cwcKey = "my_ai_chats_with_file_systems";
  const chatsWithFileSystems = new Set(
    JSON.parse(sessionStorage.getItem(_cwcKey) || "[]"),
  );

  /**
   * Persists the set of chat IDs that have associated file_systems.
   * This helps in UI hints (e.g. showing a file icon in sidebar).
   */
  function _persistChatsWithFileSystems() {
    try {
      sessionStorage.setItem(_cwcKey, JSON.stringify([...chatsWithFileSystems]));
    } catch (e) {
      /* quota */
    }
  }





  let currentChatData = null;

  const chatDefaults = window.SettingsManager.getChatDefaults();
  const samplingParams = window.SettingsManager.getSamplingParams();
  let isGenerating = false; // True when an SSE stream is active
  let activeThoughtModalSource = null; // Track which .activity-feed is currently in the modal
  let pendingEditIndex = null; // Tracks message being edited for replacement

  // Initialize Message Manager
  window.MessageManager.init({
    getIsGenerating: () => isGenerating,
    getIsResearchMode: () => isResearchMode,
    getCurrentChatId: () => currentChatId,
    getIsTemporaryChat: () => isTemporaryChat,
    getChatHistory: () => chatHistory,
    getPendingEditIndex: () => pendingEditIndex,
    setPendingEditIndex: (val) => { pendingEditIndex = val; },
    getEditingMessageId: () => editingMessageId,
    setEditingMessageId: (val) => { editingMessageId = val; },
    getTextArea: () => textArea,
    getMessagesContainer: () => messagesContainer,
    loadChat: loadChat,
    sendMessage: sendMessage,
    renderHistoryFromLocal: renderHistoryFromLocal,
    updateTempChatBtnState: updateTempChatBtnState
  });

  // Initialize Scroll Manager
  window.initScrollManager();

  // Initialize Workspace Manager
  window.WorkspaceManager.init({
    loadChats: loadChats,
    getSavedChats: () => savedChats,
    getCurrentChatId: () => currentChatId,
    showConfirm: showConfirm,
    showPromptModal: showPromptModal,
    showModal: showModal
  });

  // Initialize Subagent Renderers
  window.initAgentRenderers({
    getActiveThoughtModalSource: () => activeThoughtModalSource,
    getActiveClarificationIds: () => activeClarificationIds,
    addActiveClarificationId: (id) => {
      if (!activeClarificationIds.includes(id)) {
        activeClarificationIds.push(id);
      }
    },
    removeActiveClarificationId: (id) => {
      activeClarificationIds = activeClarificationIds.filter(cid => cid !== id);
    },
    getCurrentChatId: () => currentChatId,
    showConfirm: showConfirm
  });

  // Load session
  updateResearchUI();
  window.ModelManager.init({
    getIsResearchMode: () => isResearchMode,
    getCurrentChatId: () => currentChatId,
    getCurrentChatData: () => currentChatData,
    onModelChanged: (id, name) => {
      if (currentChatData && !isResearchMode) {
        currentChatData.last_model = name;
        if (currentChatId) {
          fetch(`${API_MODULES.CHATS}/${currentChatId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ last_model: name }),
          }).catch((e) => console.error("Error updating last model:", e));
        }
      }
    }
  });
  window.ModelManager.fetchModels();

  loadChats();

  function syncSidebarWidth() {
    if (window.innerWidth <= 768) {
      document.documentElement.style.setProperty("--sidebar-width", "0px");
      return;
    }
    const width = sidebar.getBoundingClientRect().width;
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
  }
  syncSidebarWidth();
  window.addEventListener("resize", syncSidebarWidth);

  // Initialize Settings Manager
  window.SettingsManager.init({
    getCurrentChatId: () => currentChatId,
    getIsTemporaryChat: () => isTemporaryChat,
    getChatHistoryLength: () => chatHistory.length,
    startNewChat: startNewChat,
    renderChatList: renderChatList,
    loadChats: loadChats,
    showConfirm: showConfirm,
    showAlert: showAlert,
    setScrollLock: setScrollLock,
    onChatsCleared: async () => {
      savedChats = [];
      startNewChat();
      renderChatList();
    }
  });

  // Initialize Model UI
  currentModelDisplay.textContent = window.ModelManager.getSelectedModelName();

  async function loadChats() {
    try {
      const response = await fetch(`${API_MODULES.CHATS}/`);
      if (response.ok) {
        savedChats = await response.json();
      } else {
        console.error("Failed to load chats from backend");
        savedChats = [];
      }

      // Also fetch workspaces
      await window.WorkspaceManager.fetchWorkspaces();
    } catch (e) {
      console.error("Error loading chats/workspaces:", e);
      savedChats = [];
    }
    renderChatList();
  }

  async function patchChat(updates) {
    if (!currentChatId || isTemporaryChat) return;
    try {
      const response = await fetch(`${API_MODULES.CHATS}/${currentChatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        console.error("Failed to patch chat:", await response.text());
      }
    } catch (error) {
      console.error("Error patching chat:", error);
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function resetGenerationState(keepInput = false) {
    if (isGenerating && currentAbortController) {
      try {
        currentAbortController.abort();
      } catch (e) {}
    }
    isGenerating = false;
    currentAbortController = null;
    currentFileSystemId = null;
    if (sendBtn) {
      sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      sendBtn.classList.remove("stop-mode");
    }
    if (textArea && !keepInput) {
      textArea.value = "";
      textArea.style.height = "auto";
    }

    // Update file_system lock state
    updateFileSystemLockState();
  }

  function startNewChat(temporary = false, updateUrl = true, folder = null) {
    resetGenerationState();
    isTemporaryChat = temporary;
    chatHistory = [];
    currentResearchPlan = null;
    messagesContainer.innerHTML = "";
    currentChatId = generateId(); // Always assign an ID for backend task routing (temporary chats are still prevented from persisting by the isTemporaryChat flag)
    currentChatData = { folder: folder }; // Set initial folder if provided
    window.ModelManager.checkSendButtonCompatibility();

    // User Preferences default to true, but must be off for temporary chats
    isUserPreferences = temporary
      ? false
      : chatDefaults.userPreferences !== undefined
        ? chatDefaults.userPreferences
        : true;
    if (preferencesToggleSwitch) {
      preferencesToggleSwitch.classList.toggle("active", isUserPreferences);
    }

    isResearchMode = false;
    isResearchCompleted = false;
    // Issue 3.1/3.2/3.3 fix: reset file_system mode and close panel on new chat
    fileSystemMode = false;
    fileSystemPanelVisible = false;
    if (fileSystemModeToggle) {
      fileSystemModeToggle.classList.remove("active");
      fileSystemModeToggle.classList.remove("locked");
      fileSystemModeToggle.title = "Enable FileSystem Mode";
    }
    browsingMode = false;
    if (browsingModeToggle) {
      browsingModeToggle.classList.remove("active");
      browsingModeToggle.title = "Enable Browsing Agent";
    }
    closeFileSystemPanel();
    if (rightSidebar) rightSidebar.classList.add("collapsed");
    currentFileSystemContentRaw = "";
    currentFileSystemId = null;
    currentFileSystemLanguage = "markdown";
    window.EditorManager.setLanguage(currentFileSystemLanguage);

    updateResearchUI();
    updateSearchDepthUI();

    // Reset Sampling Parameters for new chats
    const targetProfile = chatDefaults.thinkingProfile || "general";
    window.SettingsManager.setSamplingParams({
      thinking_profile: targetProfile,
      enable_thinking: THINKING_PROFILES[targetProfile].enable_thinking,
      max_tokens: chatDefaults.maxTokens || 32768,
      thinking_budget_tokens: chatDefaults.thinkingBudgetTokens || 2000,
    });
    window.SettingsManager.saveSamplingParams();

    if (welcomeHero) {
      messagesContainer.appendChild(welcomeHero);
      welcomeHero.classList.remove("hidden");
    }
    if (clearChatBtn) clearChatBtn.classList.remove("visible");

    // Hide chat title header for new chats until first message
    if (chatTitleHeader) chatTitleHeader.classList.add("hidden");

    // Reset persona to default for new chat
    if (window.PersonaManager) {
      window.PersonaManager.resetToDefault();
    }

    fetchFileSystems(null);

    // Show/hide temp chat banner
    if (tempChatBanner) {
      if (temporary) {
        tempChatBanner.classList.remove("hidden");
      } else {
        tempChatBanner.classList.add("hidden");
      }
    }

    if (tempChatBtn) {
      if (temporary) {
        tempChatBtn.classList.add("active");
      } else {
        tempChatBtn.classList.remove("active");
      }
    }

    document
      .querySelectorAll(".chat-list-item")
      .forEach((el) => el.classList.remove("active"));

    // Update URL to root for new persistent chats
    if (updateUrl && !temporary && window.location.pathname !== "/") {
      history.pushState({ chatId: null }, "", "/");
    }
  }

  async function loadChat(id, pushState = true, keepInput = false) {
    resetGenerationState(keepInput);
    pendingEditIndex = null;
    
    isChatLoading = true;
    
    // Add loading indicator to clicked chat list item
    const allChatItems = document.querySelectorAll(".chat-list-item");
    allChatItems.forEach(item => {
      if (item.getAttribute("href") === `/chat/${id}`) {
        item.classList.add("loading-active");
      } else {
        item.classList.remove("loading-active");
      }
    });

    // Show top progress bar
    let topLoader = document.querySelector(".slim-top-loader");
    if (!topLoader) {
      topLoader = document.createElement("div");
      topLoader.className = "slim-top-loader";
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.appendChild(topLoader);
    }
    if (topLoader) {
      // Force a reflow
      topLoader.getBoundingClientRect();
      topLoader.classList.add("active");
    }

    // Inject shimmering skeletons
    if (welcomeHero) welcomeHero.classList.add("hidden");
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="skeleton-wrapper">
          <div class="skeleton-turn user-turn">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-bubble user-bubble">
              <div class="skeleton-line width-80"></div>
              <div class="skeleton-line width-60"></div>
            </div>
          </div>
          <div class="skeleton-turn assistant-turn">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-bubble assistant-bubble">
              <div class="skeleton-line width-90"></div>
              <div class="skeleton-line width-75"></div>
              <div class="skeleton-line width-50"></div>
            </div>
          </div>
        </div>
      `;
    }

    try {
      const response = await fetch(`${API_MODULES.CHATS}/${id}?chat_id=${id}`);
      if (!response.ok) {
        console.error("Failed to load chat details");
        if (messagesContainer) messagesContainer.innerHTML = "";
        if (welcomeHero) welcomeHero.classList.remove("hidden");
        return;
      }
      const chat = await response.json();

      // Fetch active clarification callbacks for state synchronization
      try {
        const activeRes = await fetch(`${API_MODULES.TOOLS}/active/${id}`);
        if (activeRes.ok) {
          const activeData = await activeRes.json();
          activeClarificationIds = activeData.active_callback_ids || [];
        }
      } catch (e) {
        console.warn("Failed to fetch active callbacks:", e);
        activeClarificationIds = [];
      }

      currentChatId = id;
      currentChatData = chat;
      isTemporaryChat = false;
      if (tempChatBanner) tempChatBanner.classList.add("hidden");
      if (tempChatBtn) tempChatBtn.classList.remove("active");

      chatHistory = (chat.messages || []).map((msg, idx) => {
        let parsedContent = msg.content;
        let uploadedFiles = null;

        try {
          if (
            typeof msg.content === "string" &&
            (msg.content.startsWith("[") || msg.content.startsWith("{"))
          ) {
            parsedContent = JSON.parse(msg.content);
          }
        } catch (e) {}

        if (
          typeof parsedContent === "object" &&
          parsedContent !== null &&
          !Array.isArray(parsedContent)
        ) {
          uploadedFiles = parsedContent.uploadedFiles || null;
          if (
            parsedContent.text !== undefined &&
            parsedContent.uploadedFiles !== undefined
          ) {
            parsedContent = parsedContent.text;
          }
        }

        if (!uploadedFiles && msg.uploadedFiles) {
          uploadedFiles = msg.uploadedFiles;
        }

        return {
          ...msg,
          content: parsedContent,
          uploadedFiles,
          _originalIndex: idx,
        };
      });

      currentResearchPlan = null;
      isUserPreferences = !!chat.user_preferences;
      isResearchMode = !!chat.research_mode;
      isResearchCompleted = !!chat.research_completed;
      isResearchOngoing = chat.research_state === "ongoing";

      // Restore last used model
      if (chat.last_model) {
        const modelDef = window.ModelManager.getAvailableModels().find(
          (m) => m.key === chat.last_model,
        );
        if (modelDef) {
          window.ModelManager.selectModel(modelDef.key, modelDef.display_name, false);
        }
      }

      fileSystemMode = !!chat.file_system_mode;
      if (fileSystemMode) {
        chatsWithFileSystems.add(id);
        _persistChatsWithFileSystems();
        if (fileSystemModeToggle) {
          fileSystemModeToggle.classList.add("active");
          fileSystemModeToggle.classList.add("locked");
        }
      } else {
        if (fileSystemModeToggle) {
          fileSystemModeToggle.classList.remove("active");
          fileSystemModeToggle.classList.remove("locked");
        }
      }

      browsingMode = !!chat.browsing_mode;
      if (browsingModeToggle) {
        if (browsingMode) {
          browsingModeToggle.classList.add("active");
        } else {
          browsingModeToggle.classList.remove("active");
        }
      }

      currentFileSystemContentRaw = "";
      currentFileSystemId = null;
      currentFileSystemLanguage = "markdown";
      window.EditorManager.setLanguage(currentFileSystemLanguage);

      if (window.PersonaManager) {
        window.PersonaManager.setSelectedPersonaId(chat.persona_id || null);
      }

      // Restore sampling parameters
      const loadedParams = {};
      if (chat.max_tokens !== undefined && chat.max_tokens !== null)
        loadedParams.max_tokens = chat.max_tokens;
      if (
        chat.thinking_budget_tokens !== undefined &&
        chat.thinking_budget_tokens !== null
      )
        loadedParams.thinking_budget_tokens = chat.thinking_budget_tokens;
      if (chat.temperature !== undefined && chat.temperature !== null)
        loadedParams.temperature = chat.temperature;
      if (chat.top_p !== undefined && chat.top_p !== null)
        loadedParams.top_p = chat.top_p;
      if (chat.top_k !== undefined && chat.top_k !== null)
        loadedParams.top_k = chat.top_k;
      if (chat.min_p !== undefined && chat.min_p !== null)
        loadedParams.min_p = chat.min_p;
      if (chat.presence_penalty !== undefined && chat.presence_penalty !== null)
        loadedParams.presence_penalty = chat.presence_penalty;
      if (
        chat.frequency_penalty !== undefined &&
        chat.frequency_penalty !== null
      )
        loadedParams.frequency_penalty = chat.frequency_penalty;
      if (chat.enable_thinking !== undefined && chat.enable_thinking !== null)
        loadedParams.enable_thinking = !!chat.enable_thinking;
      if (chat.thinking_profile)
        loadedParams.thinking_profile = chat.thinking_profile;

      window.SettingsManager.setSamplingParams(loadedParams);

      updateResearchUI();
      window.ModelManager.checkSendButtonCompatibility();

      messagesContainer.innerHTML = "";
      if (welcomeHero) welcomeHero.classList.add("hidden");
      if (clearChatBtn) clearChatBtn.classList.add("visible");

      // Header Title
      if (chatTitleHeader) chatTitleHeader.classList.remove("hidden");
      if (chatTitleDisplay) {
        let headerHtml = `<span>${chat.title || "Untitled Chat"}</span>`;
        if (chat.is_vision)
          headerHtml += ` <span class="badge vision">Vision</span>`;
        if (chat.research_mode)
          headerHtml += ` <span class="badge research">Research</span>`;
        chatTitleDisplay.innerHTML = headerHtml;
      }

      // FileSystems
      fetchFileSystems(id).then((file_systemCount) => {
        if (id !== currentChatId) return;
        if (
          file_systemCount > 0 &&
          fileSystemMode &&
          fileSystemModeToggle &&
          !fileSystemModeToggle.classList.contains("locked")
        ) {
          fileSystemModeToggle.classList.add("locked");
        }
      });

      // Woven History Rendering (Turn-Grouped)
      chatHistory = []; // Reset local tracking
      const turns = [];
      let currentTurn = null;

      (chat.messages || []).forEach((msg, idx) => {
        if (msg.role === "user") {
          if (currentTurn) turns.push(currentTurn);
          turns.push({ ...msg, _originalIndex: idx });
          currentTurn = null;
        } else {
          if (!currentTurn) {
            currentTurn = {
              role: "assistant",
              interleaved: [],
              content: "",
              model: msg.model,
              id: msg.id,
              timestamp: msg.timestamp,
              collections: msg.collections || [],
              uploadedFiles: msg.uploadedFiles || [],
            };
          }

          if (msg.role === "tool") {
            currentTurn.interleaved.push({
              type: "tool_result",
              content: msg.content,
              name: msg.name,
              toolCallId: msg.tool_call_id,
              timestamp: msg.timestamp,
              agentName: msg.parent_type || "assistant",
            });
          } else if (msg.role === "event") {
            if (!currentTurn) {
              // Events can trigger Turn start if they happen before assistant content
              currentTurn = {
                role: "assistant",
                interleaved: [],
                content: "",
                id: msg.id,
                timestamp: msg.timestamp,
              };
            }
            currentTurn.interleaved.push({
              type: "event",
              content: msg.content,
              agentName: msg.parent_type || "assistant",
              timestamp: msg.timestamp,
            });
          } else if (
            msg.role === "assistant" ||
            msg.role === "assistant_active"
          ) {
            const agentName = msg.parent_type || "assistant";
            if (msg.reasoning_content) {
              currentTurn.interleaved.push({
                type: "thinking",
                content: msg.reasoning_content,
                agentName,
              });
            }
            if (msg.tool_calls) {
              const tcs =
                typeof msg.tool_calls === "string"
                  ? JSON.parse(msg.tool_calls)
                  : msg.tool_calls;
              (Array.isArray(tcs) ? tcs : [tcs]).forEach((tc) => {
                currentTurn.interleaved.push({
                  type: "tool_call",
                  content: JSON.stringify(tc),
                  agentName,
                });
              });
            }
            if (msg.sub_agent_history) {
              msg.sub_agent_history.forEach((subTurn) => {
                const agentName = subTurn.agent_name || "Sub-Agent";
                if (subTurn.reasoning_content) {
                  currentTurn.interleaved.push({
                    type: "thinking",
                    content: subTurn.reasoning_content,
                    agentName,
                    timestamp: subTurn.timestamp,
                  });
                }
                if (subTurn.tool_calls) {
                  const tcs =
                    typeof subTurn.tool_calls === "string"
                      ? JSON.parse(subTurn.tool_calls)
                      : subTurn.tool_calls;
                  (Array.isArray(tcs) ? tcs : [tcs]).forEach((tc) => {
                    currentTurn.interleaved.push({
                      type: "tool_call",
                      content: JSON.stringify(tc),
                      agentName,
                      timestamp: subTurn.timestamp,
                    });
                  });
                }
                if (subTurn.role === "tool") {
                  currentTurn.interleaved.push({
                    type: "tool_result",
                    content: subTurn.content,
                    name: subTurn.name,
                    toolCallId: subTurn.tool_call_id,
                    agentName,
                    timestamp: subTurn.timestamp,
                  });
                } else if (subTurn.role === "event") {
                  currentTurn.interleaved.push({
                    type: "event",
                    content: subTurn.content,
                    agentName,
                    timestamp: subTurn.timestamp,
                  });
                } else if (subTurn.content) {
                  currentTurn.interleaved.push({
                    type: "content",
                    content: subTurn.content,
                    agentName,
                    timestamp: subTurn.timestamp,
                  });
                }
              });
            }
            if (msg.content) {
              currentTurn.content = (currentTurn.content || "") + msg.content;
            }
            if (msg.role === "assistant_active")
              currentTurn.role = "assistant_active";
          }
        }
      });
      if (currentTurn) turns.push(currentTurn);

      turns.forEach((turn, idx) => {
        chatHistory.push(turn);

        let text = turn.content || "";
        let images = [];
        if (Array.isArray(turn.content)) {
          text = turn.content.find((c) => c.type === "text")?.text || "";
          images = turn.content
            .filter((c) => c.type === "image_url")
            .map((c) => c.image_url?.url)
            .filter(Boolean);
        }

        const row = createMessageBubble({
          role: turn.role,
          text: text,
          modelName: turn.role.includes("assistant") ? window.ModelManager.resolveModelDisplayName(turn.model) : "",
          messageId: turn.id,
          historyIndex: idx,
          images: images,
          files: turn.uploadedFiles,
          interleaved: turn.interleaved,
          collections: turn.collections,
          sub_agent_history: turn.sub_agent_history,
          reasoningContent: "", // Now handled via interleaved
        });

        messagesContainer.appendChild(row);

        if (turn.role === "assistant_active") {
          isGenerating = true;
          updateUIState(true);
        }
      });

      if (preferencesToggleSwitch)
        preferencesToggleSwitch.classList.toggle("active", isUserPreferences);

      renderChatList();
      
      // Render mermaid blocks that may be in the history
      setTimeout(window.renderMermaidBlocks, 100);

      // Resume detection: show banner if backend flags resume_needed
      // and no task is currently running (prevents double-trigger)
      if (chat.resume_needed && !chat.is_running) {
        showResumeBanner();
      }

      // Reattach: if a background task is still running, reconnect to its stream
      if (chat.is_running) {
        sendMessage(null, null, false, null, true);
      }

      if (pushState && window.location.pathname !== `/chat/${id}`) {
        history.pushState({ chatId: id }, "", `/chat/${id}`);
      }

      if (window.innerWidth <= 768) {
        sidebar.classList.remove("sidebar-expanded");
        sidebar.classList.add("sidebar-collapsed");
        if (toggleIconPath) toggleIconPath.setAttribute("d", "M9 6l6 6-6 6");
      }
      
      scrollToBottom("auto", true);
    } catch (e) {
      console.error("Error loading chat:", e);
      if (messagesContainer) messagesContainer.innerHTML = "";
      if (welcomeHero) welcomeHero.classList.remove("hidden");
    } finally {
      isChatLoading = false;
      const allChatItems = document.querySelectorAll(".chat-list-item");
      allChatItems.forEach(item => item.classList.remove("loading-active"));
      const topLoader = document.querySelector(".slim-top-loader");
      if (topLoader) topLoader.classList.remove("active");
    }
  }

  /**
   * Re-renders the chat history in the UI from the local chatHistory array.
   */
  function renderHistoryFromLocal() {
    messagesContainer.innerHTML = "";
    if (welcomeHero) welcomeHero.classList.add("hidden");
    
    chatHistory.forEach((turn, idx) => {
      let text = turn.content || "";
      let images = [];
      if (Array.isArray(turn.content)) {
        text = turn.content.find((c) => c.type === "text")?.text || "";
        images = turn.content
          .filter((c) => c.type === "image_url")
          .map((c) => c.image_url?.url)
          .filter(Boolean);
      }

      const row = window.MessageManager.createMessageBubble({
        role: turn.role,
        text: text,
        modelName: turn.role.includes("assistant") ? window.ModelManager.resolveModelDisplayName(turn.model) : "",
        messageId: turn.id,
        historyIndex: idx,
        images: images,
        files: turn.uploadedFiles,
        interleaved: turn.interleaved,
        collections: turn.collections,
        sub_agent_history: turn.sub_agent_history,
        reasoningContent: "",
      });

      messagesContainer.appendChild(row);
    });

    window.MessageManager.updateActionVisibility();
    setTimeout(window.renderMermaidBlocks, 100);
  }

  /**
   * Deletes a chat entry from the backend and updates the UI.
   * @param {string} id - The UUID of the chat to delete.
   * @param {Event} event - The DOM event that triggered the deletion.
   */
  async function deleteChat(id, event) {
    if (event) event.stopPropagation();
    if (
      await showConfirm(
        "Delete Chat",
        "Are you sure you want to delete this chat permanently?",
        true,
      )
    ) {
      try {
        await fetch(`${API_MODULES.CHATS}/${id}`, { method: "DELETE" });
        savedChats = savedChats.filter((c) => c.id !== id);
        renderChatList(); // Update UI immediately

        if (currentChatId === id) {
          startNewChat();
        }
      } catch (e) {
        console.error("Error deleting chat:", e);
      }
    }
  }



  /**
   * Updates the title of a specific chat in the sidebar and header.
   * @param {string} id - The chat ID.
   * @param {Event} event - The DOM event.
   */
  async function renameChat(id, event) {
    if (event) event.stopPropagation();
    const chatItem = document.querySelector(
      `.chat-list-item[href="/chat/${id}"]`,
    );
    if (!chatItem) return;

    const titleSpan =
      chatItem.querySelector(".chat-list-item-title span:first-child") ||
      chatItem.querySelector(".chat-list-item-title");
    const chat = savedChats.find((c) => c.id === id);
    const oldTitle = chat
      ? chat.title || "Untitled Chat"
      : titleSpan.textContent;

    const newTitle = await showPromptModal(
      "Rename Chat",
      "Enter a new name:",
      oldTitle,
    );

    if (
      newTitle !== null &&
      newTitle.trim() !== "" &&
      newTitle.trim() !== oldTitle
    ) {
      try {
        const finalTitle = newTitle.trim();
        const response = await fetch(`${API_MODULES.CHATS}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: finalTitle }),
        });
        if (response.ok) {
          if (chat) chat.title = finalTitle;
          titleSpan.textContent = finalTitle;
          // Also update top header if this is the current chat
          if (currentChatId === id && chatTitleDisplay) {
            chatTitleDisplay.textContent = finalTitle;
          }
        }
      } catch (e) {
        console.error("Error renaming chat:", e);
      }
    }
  }

  /**
   * Renders the chat history list in the sidebar, grouping by workspaces
   * and handling empty states.
   */
  function renderChatList() {
    if (!chatHistoryList) return;
    const folderListEl = document.getElementById("folder-list");
    const foldersSection = document.getElementById("folders-sidebar-section");
    const recentChatsSection = document.getElementById(
      "recent-chats-sidebar-section",
    );

    chatHistoryList.innerHTML = "";
    if (folderListEl) folderListEl.innerHTML = "";

    const sorted = [...savedChats].sort((a, b) => b.timestamp - a.timestamp);

    const workspaces = window.WorkspaceManager.getChatWorkspaces();
    if (sorted.length === 0 && workspaces.length === 0) {
      chatHistoryList.innerHTML = `<div style="padding: 1rem; color: var(--content-muted); font-size: 0.8rem; text-align: center;">No saved chats</div>`;
      return;
    }

    // --- Grouping Logic ---
    const grouped = { uncategorized: [] };
    workspaces.forEach((f) => {
      grouped[f.name] = [];
    });

    sorted.forEach((chat) => {
      const workspaceName = chat.workspace_id || "uncategorized";
      if (!grouped[workspaceName]) {
        // Handle legacy folders not in registry
        workspaces.push({ name: workspaceName, expanded: false });
        window.WorkspaceManager.setChatWorkspaces(workspaces);
        grouped[workspaceName] = [];
      }
      grouped[workspaceName].push(chat);
    });

    // --- Render Workspace Tree ---
    workspaces.forEach((workspace) => {
      const folderDiv = document.createElement("div");
      folderDiv.className = `folder-item ${workspace.expanded ? "expanded" : ""}`;

      const folderHeader = document.createElement("div");
      folderHeader.className = "folder-header";

      const folderIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity: 0.7;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
      const chevronSvg = `<svg class="folder-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

      const nameWrapper = document.createElement("div");
      nameWrapper.style.cssText =
        "display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;";

      const nameSpan = document.createElement("span");
      nameSpan.style.cssText =
        "overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8125rem; font-weight: 600; color: var(--content-primary);";
      nameSpan.textContent = workspace.displayName || workspace.name;

      nameWrapper.innerHTML = folderIconSvg;
      nameWrapper.appendChild(nameSpan);

      const countSpan = document.createElement("span");
      countSpan.style.cssText =
        "font-size: 0.7rem; color: var(--content-muted); background: var(--surface-secondary); padding: 1px 6px; border-radius: 6px; font-weight: 500;";
      countSpan.textContent = grouped[workspace.name].length;

      folderHeader.innerHTML = chevronSvg;
      folderHeader.appendChild(nameWrapper);
      folderHeader.appendChild(countSpan);

      // Context Menu & Touch Logic for Workspaces
      let fLongPressTimer;
      let fIsLongPress = false;
      let fStartY = 0;
      let fStartX = 0;

      folderHeader.addEventListener(
        "touchstart",
        (e) => {
          fIsLongPress = false;
          fStartY = e.touches[0].clientY;
          fStartX = e.touches[0].clientX;
          fLongPressTimer = setTimeout(() => {
            fIsLongPress = true;
            if (navigator.vibrate) navigator.vibrate(50);
            showContextMenu("workspace", workspace.name, null, e);
          }, 500);
        },
        { passive: true },
      );

      folderHeader.addEventListener(
        "touchmove",
        (e) => {
          if (
            Math.abs(e.touches[0].clientY - fStartY) > 10 ||
            Math.abs(e.touches[0].clientX - fStartX) > 10
          ) {
            clearTimeout(fLongPressTimer);
          }
        },
        { passive: true },
      );

      folderHeader.addEventListener(
        "touchend",
        (e) => {
          clearTimeout(fLongPressTimer);
          if (fIsLongPress && e.cancelable) e.preventDefault();
        },
        { passive: false },
      );

      folderHeader.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showContextMenu("workspace", workspace.name, null, e);
      });

      folderHeader.onclick = (e) => {
        if (fIsLongPress) {
          e.preventDefault();
          return;
        }
        workspace.expanded = !workspace.expanded;
        window.WorkspaceManager.setChatWorkspaces(workspaces);
        renderChatList();
      };

      // Drag-and-Drop Dropzone Logic
      folderDiv.addEventListener("dragover", (e) => {
        e.preventDefault();
        folderHeader.classList.add("drag-over");
      });

      folderDiv.addEventListener("dragleave", (e) => {
        e.preventDefault();
        folderHeader.classList.remove("drag-over");
      });

      folderDiv.addEventListener("drop", async (e) => {
        e.preventDefault();
        folderHeader.classList.remove("drag-over");
        const dragChatId = e.dataTransfer.getData("text/plain");
        if (dragChatId) {
          await window.WorkspaceManager.moveChatToWorkspace(dragChatId, workspace.name);
        }
      });

      folderDiv.appendChild(folderHeader);

      const folderContent = document.createElement("div");
      folderContent.className = "folder-content";

      grouped[workspace.name].forEach((chat) => {
        const item = createChatItemElement(chat);
        folderContent.appendChild(item);
      });

      folderDiv.appendChild(folderContent);
      if (folderListEl) folderListEl.appendChild(folderDiv);
    });

    // --- Render Uncategorized Chats ---
    grouped["uncategorized"].forEach((chat) => {
      const item = createChatItemElement(chat);
      chatHistoryList.appendChild(item);
    });

    // Visibility Toggles
    if (foldersSection)
      foldersSection.classList.toggle("hidden", workspaces.length === 0);
    if (recentChatsSection)
      recentChatsSection.classList.toggle("hidden", sorted.length === 0);
  }



  function createChatItemElement(chat) {
    const item = document.createElement("a");
    item.href = `/chat/${chat.id}`;
    item.className = `chat-list-item ${chat.id === currentChatId ? "active" : ""}`;

    // Switch to unified detection for mobile/touch mode
    const isMobileMode = typeof isMobileOrTouchDevice === "function" ? isMobileOrTouchDevice() : window.innerWidth <= 1024;

    if (!isMobileMode) {
      item.draggable = true;
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", chat.id);
        item.classList.add("dragging");
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
      });
    }

    item.onclick = (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      if (isChatLoading) return;
      loadChat(chat.id);
    };

    let title = chat.title || "Untitled Chat";
    const displayTitle = title;

    // FIX L1: Use the global escapeHtml() instead of a redundant local definition.
    item.innerHTML = `
            <div class="chat-list-item-title" style="display: flex; align-items: center; gap: 6px; overflow: hidden; white-space: nowrap; flex: 1; min-width: 0; width: 100%;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; flex: 1; min-width: 0;">${escapeHtml(displayTitle)}</span>
                ${chat.is_vision ? `<span style="font-size: 0.6rem; font-weight: 500; letter-spacing: 0.02em; padding: 1px 4px; background: rgba(6, 182, 212, 0.1); color: var(--brand-accent-1); border-radius: 4px; border: 1px solid rgba(6, 182, 212, 0.2); flex-shrink: 0;">Vision</span>` : ""}
                ${chat.research_mode ? `<span style="font-size: 0.6rem; font-weight: 500; letter-spacing: 0.02em; padding: 1px 4px; background: rgba(59, 130, 246, 0.1); color: var(--accent); border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.2); flex-shrink: 0;">Research</span>` : ""}
            </div>
        `;

    // Long Press Logic / Right Click Context Menu
    let longPressTimer;
    let isLongPress = false;
    let startY = 0;
    let startX = 0;

    item.addEventListener(
      "touchstart",
      (e) => {
        isLongPress = false;
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;

        longPressTimer = setTimeout(() => {
          isLongPress = true;
          if (navigator.vibrate) navigator.vibrate(50);
          showContextMenu("chat", chat.id, chat.folder, e);
        }, 500);
      },
      { passive: true },
    );

    item.addEventListener(
      "touchmove",
      (e) => {
        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        if (
          Math.abs(currentY - startY) > 10 ||
          Math.abs(currentX - startX) > 10
        ) {
          clearTimeout(longPressTimer);
        }
      },
      { passive: true },
    );

    item.addEventListener(
      "touchend",
      (e) => {
        clearTimeout(longPressTimer);
        if (isLongPress) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      },
      { passive: false },
    );

    item.addEventListener("touchcancel", () => {
      clearTimeout(longPressTimer);
    });

    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu("chat", chat.id, chat.folder, e);
    });

    item.addEventListener("click", (e) => {
      if (isLongPress) {
        e.preventDefault();
      }
    });

    return item;
  }

  // Legacy showContextMenu is now modularized and handled globally by window.ContextMenu in static/js/context-menu.js


  if (preferencesToggleSwitch) {
    preferencesToggleSwitch.classList.toggle("active", isUserPreferences);
    preferencesToggleSwitch.addEventListener("click", () => {
      isUserPreferences = !isUserPreferences;
      preferencesToggleSwitch.classList.toggle("active", isUserPreferences);

      if (currentChatId && !isTemporaryChat) {
        patchChat({ user_preferences: isUserPreferences });
      }
      if (!isResearchMode) wasUserPreferences = isUserPreferences;
    });
  }

  // Research Toggle Logic

  /**
   * Shows a custom Luminous-styled prompt dialog
   */


  /**
   * Shows a custom Luminous-styled prompt dialog with folder selection support.
   * @returns {Promise<string|null>} Resolves with the user input or null if cancelled.
   */

  /**
   * Shows a custom Luminous-styled dialog (Alert or Confirm)
   */

  function showLightbox(src, alt) {
    let lightbox = document.getElementById("lightbox-modal");
    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.id = "lightbox-modal";
      lightbox.className = "lightbox-modal";
      lightbox.innerHTML = `
        <div class="lightbox-close">&times;</div>
        <img class="lightbox-content" id="lightbox-img-element">
        <div class="lightbox-caption" id="lightbox-caption-element"></div>
      `;
      document.body.appendChild(lightbox);
      
      lightbox.addEventListener('click', (e) => {
        if (e.target !== document.getElementById('lightbox-img-element')) {
          lightbox.classList.remove('open');
        }
      });
    }
    
    const imgEl = document.getElementById('lightbox-img-element');
    const capEl = document.getElementById('lightbox-caption-element');
    imgEl.src = src;
    imgEl.alt = alt || '';
    capEl.textContent = alt || '';
    
    lightbox.classList.add('open');
  }

  /**
   * Synchronizes the UI state based on research, preferences, and file_system modes.
   * Toggles visibility of specialized buttons, locks inputs during agent execution,
   * and updates greeting text.
   */
  function updateResearchUI() {
    document.body.classList.toggle("research-agent-active", isResearchMode);

    // 1. Research Agent Toggle logic
    if (uiResearchToggle) {
      uiResearchToggle.classList.toggle("active", isResearchMode);

      // Lock research toggle if research is ongoing
      const shouldBlockResearch = isResearchOngoing;

      if (shouldBlockResearch) {
        uiResearchToggle.parentElement.style.opacity = "0.5";
        uiResearchToggle.parentElement.style.pointerEvents = "none";
        uiResearchToggle.parentElement.style.cursor = "not-allowed";
        uiResearchToggle.title = "Research is currently in progress.";
      } else {
        uiResearchToggle.parentElement.style.opacity = "1";
        uiResearchToggle.parentElement.style.pointerEvents = "auto";
        uiResearchToggle.parentElement.style.cursor = "pointer";
        uiResearchToggle.title = "Toggle Research Mode";
      }
    }

    // Update the Tools Button icon based on active complex modes
    const attachBtn = document.getElementById("attach-btn");
    if (activeToolIconContainer) {
      if (isResearchMode) {
        activeToolIconContainer.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12M12 3v11M9 21h6a4 4 0 0 0 4-4V10a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7a4 4 0 0 0 4 4z"/></svg>`;
        toolsButton.classList.add("active");
      } else if (fileSystemMode && typeof fileSystemMode !== "undefined") {
        activeToolIconContainer.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`;
        toolsButton.classList.add("active");
      } else {
        activeToolIconContainer.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/></svg>`;
        toolsButton.classList.remove("active");
      }
    }

    // Handle Preferences Toggle availability based on chat type
    if (preferencesToggleSwitch) {
      if (isTemporaryChat) {
        wasUserPreferences = isUserPreferences;
        isUserPreferences = false;
        preferencesToggleSwitch.classList.remove("active");
        preferencesToggleSwitch.style.pointerEvents = "none";
        preferencesToggleSwitch.style.opacity = "0.5";
        preferencesToggleSwitch.title =
          "User Preferences are disabled for Temporary Chats.";
      } else {
        if (preferencesToggleSwitch.style.pointerEvents === "none")
          isUserPreferences = wasUserPreferences;
        preferencesToggleSwitch.classList.toggle("active", isUserPreferences);
        preferencesToggleSwitch.style.pointerEvents = "auto";
        preferencesToggleSwitch.style.opacity = "1";
        preferencesToggleSwitch.title = "Toggle User Preferences";
      }
    }

    // Toggle Settings containers visibility
    const generalSettingsContainer = document.getElementById(
      "general-model-settings",
    );
    const visionSettingsContainer = document.getElementById("vision-settings");
    if (generalSettingsContainer)
      generalSettingsContainer.style.display = "block";
    if (visionSettingsContainer)
      visionSettingsContainer.style.display = isResearchMode ? "block" : "none";

    // Update Vision status in Research options
    const visionToggle = document.getElementById("vision-toggle");
    const visionStatus = document.getElementById("research-vision-status");
    if (visionToggle && visionStatus) {
      const isVisionEnabled = window.ModelManager.getIsVisionEnabled();
      visionToggle.classList.toggle("active", isVisionEnabled);
      visionStatus.textContent = isVisionEnabled ? "Enabled" : "Disabled";
      visionStatus.style.color = isVisionEnabled
        ? "var(--accent)"
        : "var(--content-muted)";
    }

    // Reset Sampler and Prompt UI states if needed
    if (modelSelectDropdown) {
      modelSelectDropdown.disabled = false;
      modelSelectDropdown.style.opacity = "1";
    }

    // Update Greeting content
    const greetingText = welcomeHero
      ? welcomeHero.querySelector(".greeting-text")
      : null;
    const greetingSub = welcomeHero
      ? welcomeHero.querySelector(".greeting-sub")
      : null;
    if (greetingText && greetingSub) {
      if (isResearchMode) {
        greetingText.textContent = "Research Agent";
        greetingSub.textContent =
          "I'll follow a multi-step research plan, analyzing dozens of search results to build a thorough report.";
      } else {
        greetingText.textContent = "Hello there";
        greetingSub.textContent = "How can I help you today?";
      }
    }

  // --- Chat Input Lockdown Logic ---
    if (textArea) {
      textArea.disabled = false;
      textArea.placeholder = "Start a conversation...";
      textArea.style.opacity = "1";
    }

        if (attachBtn) {
      if (isResearchMode) {
        attachBtn.style.opacity = "0.3";
        attachBtn.style.pointerEvents = "none";
        attachBtn.title = "File uploads are not supported in Research mode.";
      } else {
        attachBtn.style.opacity = "1";
        attachBtn.style.pointerEvents = "auto";
        attachBtn.title = "Attach files";
      }
    }

    updateTempChatBtnState();

    // Files visibility state
    if (navFilesBtn) {
      if (fileSystemMode) {
        navFilesBtn.classList.remove("disabled");
        navFilesBtn.style.opacity = "1";
        navFilesBtn.style.pointerEvents = "auto";
      } else {
        navFilesBtn.classList.add("disabled");
        navFilesBtn.style.opacity = "0.35";
        navFilesBtn.style.pointerEvents = "none";
      }
    }
  }

  function updateTempChatBtnState() {
    if (!tempChatBtn) return;

    const hasOngoingChat = chatHistory.length > 0;
    const isDisabled = isResearchMode || hasOngoingChat;

    tempChatBtn.disabled = isDisabled;
    if (isDisabled) {
      tempChatBtn.style.opacity = "0.4";
      tempChatBtn.style.cursor = "not-allowed";
      if (isResearchMode) {
        tempChatBtn.title = "Temporary chat is not available in Research mode.";
      } else {
        tempChatBtn.title =
          "Temporary chat cannot be started during an ongoing conversation.";
      }
    } else {
      tempChatBtn.style.opacity = "1";
      tempChatBtn.style.cursor = "pointer";
      tempChatBtn.title = "Temporary Chat";
    }
  }

  function updateSearchDepthUI() {
    // Legacy function, replaced largely by updateResearchUI logic but retained for any external calls
    updateResearchUI();
  }

  // Tools Dropdown Listeners
  if (toolsButton && toolsDropdown) {
    toolsButton.addEventListener("click", (e) => {
      e.stopPropagation();
      toolsDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (
        !toolsButton.contains(e.target) &&
        !toolsDropdown.contains(e.target)
      ) {
        toolsDropdown.classList.add("hidden");
      }
    });

    if (uiResearchToggle) {
      // Find the parent row to attach click event (better UX)
      uiResearchToggle.parentElement.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isResearchOngoing) return; // Prevent toggle if research is executing
        // Toggle Research Mode
        isResearchMode = !isResearchMode;
        localStorage.setItem("my_ai_is_research_mode", isResearchMode);

        updateResearchUI();
        window.ModelManager.checkSendButtonCompatibility();
        // If research is turning ON, force load the specialized models
        window.ModelManager.fetchModels(isResearchMode);

        // Sync to backend mid-chat
        if (chatHistory.length > 0) {
          patchChat({
            research_mode: isResearchMode,
          });
        }
      });
    }

    // Vision Toggle Click Handler
    const visionToggleRef = document.getElementById("vision-toggle");
    if (visionToggleRef) {
      visionToggleRef.addEventListener("click", (e) => {
        e.stopPropagation();
        const newVal = !window.ModelManager.getIsVisionEnabled();
        window.ModelManager.setIsVisionEnabled(newVal);
        updateResearchUI();
        if (chatHistory.length > 0) {
          patchChat({ is_vision: newVal });
        }
      });
    }

    // LEGACY: Research Mode Selector Click Handlers (PRESERVED FOR FUTURE USE)
  }

  if (toggleRegularSearchBtn) {
    toggleRegularSearchBtn.addEventListener("click", () => {
      updateResearchUI();
    });
  }

  const sysResetPreferencesBtn = document.getElementById(
    "sys-reset-preferences",
  );
  if (sysResetPreferencesBtn) {
    sysResetPreferencesBtn.addEventListener("click", async () => {
      if (
        await showConfirm(
          "Reset Preferences",
          "Are you sure you want to permanently clear ALL learned user preferences and profile data? This cannot be undone.",
          true,
        )
      ) {
        try {
          const response = await fetch(
            `${API_MODULES.TOOLS}/preferences/reset`,
            { method: "POST" },
          );
          if (response.ok) {
            await showAlert(
              "Preferences Reset",
              "User preferences have been reset successfully.",
            );
          } else {
            await showAlert(
              "Error",
              "Failed to reset preferences. Please check your backend logs.",
            );
          }
        } catch (e) {
          console.error("Error resetting preferences:", e);
          await showAlert(
            "Error",
            "An error occurred while resetting preferences.",
          );
        }
      }
    });
  }

  if (newChatBtn)
    newChatBtn.addEventListener("click", () => startNewChat(false));

  if (tempChatBtn)
    tempChatBtn.addEventListener("click", () => {
      if (isTemporaryChat) {
        startNewChat(false);
      } else {
        startNewChat(true);
      }
    });
  if (saveTempChatBtn)
    saveTempChatBtn.addEventListener("click", () => {
      if (isTemporaryChat) {
        isTemporaryChat = false;
        // We now maintain the originally generated currentChatId
        if (tempChatBanner) tempChatBanner.classList.add("hidden");
        if (tempChatBtn) tempChatBtn.classList.remove("active");
        if (chatHistory.length > 0) {
          const title =
            chatHistory.find((m) => m.role === "user")?.content || "New Chat";
          const titleText =
            typeof title === "string" ? title.substring(0, 50) : "New Chat";
          fetch(`${API_MODULES.CHATS}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: currentChatId,
              title: titleText,
              messages: chatHistory,
              user_preferences: isUserPreferences,
              research_mode: isResearchMode,
              persona_id: window.PersonaManager ? window.PersonaManager.getSelectedPersonaId() : null,
              ...samplingParams,
            }),
          }).then(() => {
            loadChats();
            renderChatList();
          });
        }
        updateResearchUI();
      }
    });

  function checkSendButtonState() {
    if (!sendBtn || !filePreviewContainer) return;

    // Don't block if in Research Mode (different workflow)
    if (isResearchMode) return;

    // Check if there are any files being uploaded or processing
    const fileItems = filePreviewContainer.querySelectorAll(".file-item");
    let hasUploadingFiles = false;

    fileItems.forEach((item) => {
      const statusEl = item.querySelector(".upload-status");
      if (
        statusEl &&
        (statusEl.textContent.includes("Uploading") ||
          statusEl.textContent === "Processing...")
      ) {
        hasUploadingFiles = true;
      }
    });

    // Block send button if files are uploading or processing
    sendBtn.disabled = hasUploadingFiles;
    if (hasUploadingFiles) {
      sendBtn.title =
        "Please wait for file uploads to complete before sending.";
      sendBtnWrapper.title = sendBtn.title;
    } else {
      sendBtn.title = "";
      sendBtnWrapper.title = "";
    }
  }

  // Final Safety Check for Empty State
  setTimeout(() => {
    if (!currentChatId && (!chatHistory || chatHistory.length === 0)) {
      const hero = document.getElementById("welcome-hero");
      if (hero) {
        hero.classList.remove("hidden");
        hero.style.opacity = "1";
        hero.style.display = "block";
      }
    }
  }, 500);

  // Auto-collapse for mobile on load
  if (window.innerWidth <= 768) {
    sidebar.classList.remove("sidebar-expanded");
    sidebar.classList.add("sidebar-collapsed");
    toggleIconPath.setAttribute("d", "M9 6l6 6-6 6");
  }

  // 3. Resizable Navigation Rail Logic
  let isResizing = false;

  resizer.addEventListener("pointerdown", (e) => {
    isResizing = true;
    sidebar.classList.add("resizing");
    document.body.style.cursor = "col-resize";
    e.preventDefault();
  });

  document.addEventListener("pointermove", (e) => {
    if (!isResizing) return;

    let newWidth = e.clientX;

    if (newWidth < 120) {
      sidebar.classList.remove("sidebar-expanded");
      sidebar.classList.add("sidebar-collapsed");
      sidebar.style.width = "";
      toggleIconPath.setAttribute("d", "M9 6l6 6-6 6");
    } else if (window.innerWidth > 768 && newWidth >= 240 && newWidth <= 480) {
      sidebar.classList.remove("sidebar-collapsed");
      sidebar.classList.add("sidebar-expanded");
      sidebar.style.width = `${newWidth}px`;
      toggleIconPath.setAttribute("d", "M15 6l-6 6 6 6");
    }
    syncSidebarWidth();
  });

  document.addEventListener("pointerup", () => {
    if (isResizing) {
      isResizing = false;
      sidebar.classList.remove("resizing");
      document.body.style.cursor = "default";
    }
    if (isResizingRight) {
      isResizingRight = false;
      rightSidebar.classList.remove("resizing");
      document.body.style.cursor = "default";
    }
  });

  // ─── Right Sidebar Resizing ───
  let isResizingRight = false;
  rightSidebarResizer?.addEventListener("pointerdown", (e) => {
    isResizingRight = true;
    rightSidebar.classList.add("resizing");
    document.body.style.cursor = "col-resize";
    e.preventDefault();
  });

  document.addEventListener("pointermove", (e) => {
    if (!isResizingRight) return;

    let newWidth = window.innerWidth - e.clientX;

    if (newWidth < 120) {
      rightSidebar.classList.add("collapsed");
      rightSidebar.style.width = "";
    } else if (newWidth >= 240 && newWidth <= window.innerWidth * 0.8) {
      rightSidebar.classList.remove("collapsed");
      rightSidebar.style.width = `${newWidth}px`;
      document.documentElement.style.setProperty(
        "--right-sidebar-width",
        `${newWidth}px`,
      );
    }
  });

  [sidebarToggle, mobileToggle].forEach((btn) => {
    btn?.addEventListener("click", () => {
      const isCollapsed = sidebar.classList.contains("sidebar-collapsed");
      sidebar.style.width = "";

      if (isCollapsed) {
        sidebar.classList.remove("sidebar-collapsed");
        sidebar.classList.add("sidebar-expanded");
        toggleIconPath.setAttribute("d", "M15 6l-6 6 6 6");
        if (window.innerWidth <= 768) {
          document.documentElement.style.setProperty("--sidebar-width", "0px");
        } else {
          document.documentElement.style.setProperty("--sidebar-width", "16rem");
        }
      } else {
        sidebar.classList.remove("sidebar-expanded");
        sidebar.classList.add("sidebar-collapsed");
        toggleIconPath.setAttribute("d", "M9 6l6 6-6 6");
        if (window.innerWidth <= 768) {
          document.documentElement.style.setProperty("--sidebar-width", "0px");
        } else {
          document.documentElement.style.setProperty("--sidebar-width", "4.5rem");
        }
      }
    });
  });

  // Folders Section Collapsible Logic
  if (localStorage.getItem("foldersSectionCollapsed") === "true") {
    foldersSidebarSection?.classList.add("collapsed");
  }

  foldersSectionHeader?.addEventListener("click", () => {
    foldersSidebarSection?.classList.toggle("collapsed");
    localStorage.setItem(
      "foldersSectionCollapsed",
      foldersSidebarSection?.classList.contains("collapsed"),
    );
  });

  // System Settings Logic delegated to SettingsManager
  const closeSystemSettings = () => window.SettingsManager.closeSystemSettings();



  /* ═══════════════════════════════════════════
       SUB-AGENT CONFIGURATION INITIALIZATION
       ═══════════════════════════════════════════ */
  window.AgentConfig.init({
    showAlert: showAlert
  });

  /* ═══════════════════════════════════════════
       USER PREFERENCES INITIALIZATION
       ═══════════════════════════════════════════ */
  window.PreferencesManager.init({
    getCurrentChatId: () => currentChatId,
    closeSystemSettings: closeSystemSettings
  });

  // --- Thought Process Full View Modal ---
  const thoughtFullViewModal = document.getElementById("thought-full-view-modal");
  const closeThoughtFullViewBtn = document.getElementById("close-thought-full-view");

  const closeThoughtFullView = () => {
    if (thoughtFullViewModal) {
      activeThoughtModalSource = null; // STOP TRACKING
      thoughtFullViewModal.classList.remove("open");
      setTimeout(() => {
        thoughtFullViewModal.style.display = "none";
        setScrollLock(false);
      }, 300);
    }
  };

  if (closeThoughtFullViewBtn) {
    closeThoughtFullViewBtn.addEventListener("click", closeThoughtFullView);
  }

  if (thoughtFullViewModal) {
    thoughtFullViewModal.addEventListener("click", (e) => {
      if (e.target === thoughtFullViewModal) closeThoughtFullView();
      
      // Card expansion within the modal
      const header = e.target.closest(".activity-header, .sub-agent-header, .sub-agent-summary");
      if (header) {
        const container = header.closest(".activity-item, .sub-agent-container, .sub-agent-section");
        if (container) {
          const wasExpanded = container.classList.contains("expanded");
          container.classList.toggle("collapsed", wasExpanded);
          container.classList.toggle("expanded", !wasExpanded);
        }
      }
    });
  }



  // User Preferences UI Logic has been modularized into static/js/preferences-manager.js

  // Deprecated theme toggle listener removed

  // Model Selection Logic (handled inside renderModelOptions)

  // 4.2 Cleanup Actions

  clearChatBtn?.addEventListener("click", async () => {
    if (
      await showConfirm(
        "Clear Chat",
        "Are you sure you want to clear the current conversation?",
      )
    ) {
      chatHistory = [];
      messagesContainer.innerHTML = "";

      if (welcomeHero) {
        messagesContainer.appendChild(welcomeHero);
        welcomeHero.classList.remove("hidden");
      }
      clearChatBtn.classList.remove("visible");
    }
  });



/**
   * Determines MIME type based on File API or extension fallback.
   */

// Helper function to upload file with progress tracking

// → formatFileSize, getIconClassForMime, getIconHtmlForMime moved to static/js/utils.js

/* ═══════════════════════════════════════════
       ATTACHMENT MANAGER INITIALIZATION
       ═══════════════════════════════════════════ */
  window.AttachmentManager.init({
    getChatId: () => currentChatId,
    onUploadStateChange: () => checkSendButtonState()
  });

// 5. Chat Interaction Core (Backend API with RAG)
  /**
   * CORE MESSAGING ENGINE: Sends a user message and orchestrates the AI response streaming.
   * Handles both standard chat and specialized Research Agent execution.
   */
  async function sendMessage(
    authOverride = null,
    approvedPlanPayload = null,
    isResume = false,
    resumeState = null,
    isReattach = false,
  ) {
    if (isGenerating || (!window.ModelManager.getSelectedModel() && !isResume && !isReattach)) return;

    // Ensure session integrity
    if (!currentChatId) currentChatId = generateId();

    const content = textArea.value.trim();

    // --- Phase 0: Edit Persistence ---
    if (pendingEditIndex !== null && !isResume && !approvedPlanPayload) {
      const editIdx = pendingEditIndex;
      const messageId = editingMessageId; // Need to track this explicitly
      pendingEditIndex = null;
      editingMessageId = null;

      // Truncate local chat history immediately to prevent context bloat
      if (editIdx !== -1 && editIdx < chatHistory.length) {
        chatHistory.splice(editIdx);
      }

      if (currentChatId && !isTemporaryChat && messageId) {
        try {
          await fetch(
            `${API_MODULES.CHATS}/${currentChatId}/messages/${messageId}`,
            {
              method: "DELETE",
            },
          );
        } catch (e) {
          console.error("Edit DELETE failed", e);
        }
      }
    }

    if (
      !isResume &&
      !isReattach &&
      !content &&
      !window.AttachmentManager.getStagedFiles().length &&
      !approvedPlanPayload &&
      !resumeState
    )
      return;

    // --- Phase 1: Optimistic UI Rendering ---
    isGenerating = true;
    currentAbortController = new AbortController();
    updateUIState(true);
    updateFileSystemLockState();

    if (!isResume && !isReattach && !resumeState) {
      if (isResearchMode) {
        isResearchCompleted = false;
        updateResearchUI();
      }
      textArea.value = "";
      textArea.style.height = "auto";

      if (welcomeHero) welcomeHero.classList.add("hidden");
      if (clearChatBtn) clearChatBtn.classList.add("visible");

      if (approvedPlanPayload) {
        appendMessage(
          "User",
          "The research plan is approved. Proceed with execution.",
          "user",
          null,
          [],
          [],
          chatHistory.length,
        );
        chatHistory.push({
          role: "user",
          content: "The research plan is approved. Proceed with execution.",
        });
      } else {
        const sentFiles = window.AttachmentManager.getStagedFiles();
        appendMessage(
          "User",
          content,
          "user",
          null,
          [],
          sentFiles,
          chatHistory.length,
        );
        chatHistory.push({
          role: "user",
          content: content,
          uploadedFiles: sentFiles.length > 0 ? sentFiles : undefined,
        });
      }

      // Persistence: New Chat Creation
      if (!isTemporaryChat && currentChatId) {
        let chat = savedChats.find((c) => c.id === currentChatId);
        if (!chat) {
          const titleStr =
            content.substring(0, 50) ||
            (approvedPlanPayload ? "Research Execution" : "New Conversation");
          chat = {
            id: currentChatId,
            title: titleStr,
            timestamp: Date.now(),
            messages: [],
            folder: currentChatData ? currentChatData.folder : null,
            user_preferences: isUserPreferences,
            research_mode: isResearchMode ? 1 : 0,
            is_vision: 0,
          };
          savedChats.push(chat);
          renderChatList();
          history.replaceState(
            { chatId: currentChatId },
            "",
            `/chat/${currentChatId}`,
          );
          // Persist the generated title and initial state to the backend DB
          await patchChat({
            title: titleStr,
            user_preferences: isUserPreferences,
            research_mode: isResearchMode ? 1 : 0,
            folder: currentChatData ? currentChatData.folder : null,
            file_system_mode: fileSystemMode ? 1 : 0,
            browsing_mode: browsingMode ? 1 : 0,
            thinking_profile: samplingParams.thinking_profile,
          });
          if (chatTitleHeader) chatTitleHeader.classList.remove("hidden");
          if (chatTitleDisplay) chatTitleDisplay.textContent = chat.title;
        }
      }
    }

    if (isResume) {
      console.log("Resuming existing task, skipping VRAM cleanup.");
    } else {
      await window.ModelManager.unloadAllModels([window.ModelManager.getSelectedModel()]);
    }

    updateResearchUI();

    // 2. Initial Bot Message Row (will be updated if turn splitting occurs)
    // ON RESUME OR REATTACH: The backend (re)streams the entire turn starting from
    // the last assistant message. We must clear any existing rows following the last
    // user message to prevent duplicating content that was already partially committed
    // to the DB or rendered in a previous session.
    let botMsgDiv;
    if (isResume || isReattach) {
      // FIX: Robust Turn Cleanup
      // When resuming or reattaching, the backend re-streams the ENTIRE turn from the beginning
      // of the last assistant response (including any tool calls/results).
      // We must clear any partial/stale rows from the DOM and truncate chatHistory to avoid duplication.

      // 1. Clear DOM rows after the last user message
      const allRows = Array.from(
        messagesContainer.querySelectorAll(".chat-row"),
      );
      let lastUserIdx = -1;
      for (let i = allRows.length - 1; i >= 0; i--) {
        if (allRows[i].classList.contains("user-message")) {
          lastUserIdx = i;
          break;
        }
      }
      if (lastUserIdx !== -1) {
        for (let i = allRows.length - 1; i > lastUserIdx; i--) {
          allRows[i].remove();
        }
      }

      // 2. Truncate chatHistory to match the DOM state
      let lastUserHistoryIdx = -1;
      for (let i = chatHistory.length - 1; i >= 0; i--) {
        if (chatHistory[i].role === "user") {
          lastUserHistoryIdx = i;
          break;
        }
      }
      if (lastUserHistoryIdx !== -1) {
        chatHistory = chatHistory.slice(0, lastUserHistoryIdx + 1);
      }
    }

    botMsgDiv = appendMessage("Assistant", "", "bot");
    botMsgDiv.classList.add("thinking"); // Restore rotating square animation on the avatar

    // Setup standardized content wrappers from the appendMessage template
    let mainWrapper = botMsgDiv.querySelector(".raw-text-content");
    let activityFeed = botMsgDiv.querySelector(".activity-feed");
    let thoughtWrapper = botMsgDiv.querySelector(".thought-content-wrapper");

    // Capture initial indices for tracking rounds (Thinking vs Content)
    let historyContentStartIdx = 0;
    let historyReasoningStartIdx = 0;

    // Construct Messages for Backend
    const messages = [];

    // System prompt handled backend side using persona_id

    // Add history (last 20 turns)
    messages.push(...chatHistory);

    // Clean up file state - files are stored in chat history for persistence
    const sentFiles = window.AttachmentManager.getStagedFiles();

    let reqModel = window.ModelManager.getSelectedModel();
    let reqModelName = window.ModelManager.getSelectedModelName();

    try {
      const requestBody = {
        model: reqModel,
        lastModelName: reqModelName,
        messages: messages,
        userPreferences: isUserPreferences,
        researchMode: isResearchMode,
        visionEnabled: window.ModelManager.getIsVisionEnabled(),
        fileSystemMode: fileSystemMode,
        browsingMode: browsingMode,
        persona_id: window.PersonaManager ? window.PersonaManager.getSelectedPersonaId() : null,

        approvedPlan: approvedPlanPayload || undefined,
        resumeState: resumeState || undefined,
        chatId: currentChatId,
        folder: currentChatData ? currentChatData.folder : null,
        stream: true,
        stream_options: { include_usage: true },
        fileSystemMode: fileSystemMode,
        activeFileSystemContext: currentFileSystemContentRaw
          ? {
              id: currentFileSystemId,
              content: currentFileSystemContentRaw,
            }
          : null,
        uploadedFiles: sentFiles.length > 0 ? sentFiles : undefined,
      };

      // Clear uploadedFiles after request is constructed (files are now part of request)
      window.AttachmentManager.clearStagedFiles();
      // Clear file preview container from DOM
      if (filePreviewContainer) {
        filePreviewContainer.innerHTML = "";
        filePreviewContainer.classList.add("hidden");
      }
      // Update send button state after clearing files
      checkSendButtonState();

      // Only include sampling params for normal chat (deep research uses its own)
      // Include sampling params for all modes
      requestBody.enable_thinking = samplingParams.enable_thinking;
      requestBody.temperature = samplingParams.temperature;
      requestBody.top_p = samplingParams.top_p;
      requestBody.max_tokens = samplingParams.max_tokens;
      requestBody.thinking_budget_tokens =
        samplingParams.thinking_budget_tokens;
      requestBody.top_k = samplingParams.top_k;
      requestBody.min_p = samplingParams.min_p;
      requestBody.presence_penalty = samplingParams.presence_penalty;
      requestBody.frequency_penalty = samplingParams.frequency_penalty;
      requestBody.thinking_profile = samplingParams.thinking_profile;

      // Use the dedicated resume endpoint when resuming an interrupted turn,
      // or the lightweight stream endpoint when reattaching to an active task.
      let endpoint, fetchOpts;
      if (isReattach) {
        endpoint = `${API_MODULES.CHATS}/${currentChatId}/stream`;
        fetchOpts = { method: "GET", signal: currentAbortController.signal };
      } else if (isResume) {
        endpoint = `${API_MODULES.CHATS}/${currentChatId}/resume`;
        fetchOpts = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: currentAbortController.signal,
        };
      } else {
        endpoint = "/v1/chat/completions";
        fetchOpts = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: currentAbortController.signal,
        };
      }

      const response = await fetch(endpoint, fetchOpts);

      // Reattach: 204 means task already finished — just reload history
      if (isReattach && response.status === 204) {
        isGenerating = false;
        updateUIState(false);
        loadChat(currentChatId, false, true);
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `API Error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let accumulatedReasoning = ""; // Raw accumulator for DB persistence (includes JSON activity chunks)
      let historyContentStartIdx = 0;
      let historyReasoningStartIdx = 0;
      let buffer = "";
      let usageCounted = false;
      let isReasoningPhase = true; // Track if we're still in reasoning-only mode
      let contentStarted = false; // Track if actual content has started
      let actualModelName = window.ModelManager.getSelectedModelName(); // Fallback
      
      // Retries & Targeted Redaction Tracking
      let currentAttemptId = Date.now().toString();
      let snapshotContent = "";
      let snapshotReasoning = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));

            // Handle Usage
            if (json.usage && !usageCounted) {
              continue;
            }

            // Handle Errors sent as data
            if (json.error) {
              throw new Error(json.error);
            }

            // Capture the actual model name from the server stream if present
            if (json.model) {
              actualModelName = json.model;
            }

            if (json.type === "state_sync") {
              if (json.research_mode !== undefined)
                isResearchMode = !!json.research_mode;
              if (json.research_state !== undefined)
                isResearchOngoing = json.research_state === "ongoing";
              updateResearchUI();
              continue;
            }

            // --- Backend Orchestration Handlers ---

            // [DEPRECATED] Legacy file_system updates removed.
            // Now handled via tool_result logic in main loop below.

            // Handle redaction (validation detected formatting issues, or transaction failure)
            if (json.__redact__) {
              // Revert to snapshot
              accumulatedContent = snapshotContent;
              accumulatedReasoning = snapshotReasoning;

              if (mainWrapper) {
                if (
                  json.message &&
                  json.message.includes("Database transaction")
                ) {
                  // Transaction failure - show error
                  mainWrapper.innerHTML = `<span style="color: var(--color-rose-500)">Database transaction failed: ${json.message}</span>`;
                } else {
                  // Validation fix - show correcting indicator
                  mainWrapper.innerHTML = `<div class="validation-fixing" style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; color: var(--content-muted); font-style: italic;">
                                        <span class="processing-spinner"></span>
                                        <span>${json.message || "Correcting formatting..."}</span>
                                    </div>`;
                }
              }

              // Selectively remove elements from this failed attempt
              if (activityFeed) {
                activityFeed.querySelectorAll(`[data-attempt-id="${currentAttemptId}"]`).forEach(el => el.remove());
              }
              
              // Generate new attempt ID for the upcoming retry
              currentAttemptId = Date.now().toString();

              continue;
            }

            const delta = json.choices?.[0]?.delta;
            if (delta) {
              const isSubAgent =
                json.parent_type && json.parent_type !== "main";
              const agentName = isSubAgent ? json.parent_type : "Assistant"; // Default to Assistant if not a sub-agent

              // Ensure thought wrapper is visible if any internal activity occurs
              if (
                (delta.reasoning_content ||
                  delta.tool_calls ||
                  delta.tool_result ||
                  delta.role === "event" ||
                  isSubAgent) &&
                thoughtWrapper
              ) {
                const sectionWrapper = thoughtWrapper.closest(".thought-section-wrapper");
                if (sectionWrapper) sectionWrapper.classList.remove("hidden");
                thoughtWrapper.classList.remove("hidden");
                const timeline = botMsgDiv.querySelector(".thought-timeline-wrapper");
                if (timeline) {
                  timeline.classList.remove("hidden");
                  if (!thoughtWrapper.dataset.hasExpanded) {
                    thoughtWrapper.dataset.hasExpanded = "true";
                    const container = thoughtWrapper.querySelector(".thought-container");
                    if (container) container.classList.add("expanded");
                    timeline.classList.add("expanded");
                  }
                }
              }

              // 1. REASONING: Always a discrete activity in the thought process
              if (delta.reasoning_content) {
                if (!activityFeed && botMsgDiv)
                  activityFeed = botMsgDiv.querySelector(".activity-feed");
                appendSubAgentActivity(
                  activityFeed,
                  isSubAgent ? agentName : "Assistant",
                  "thinking",
                  delta.reasoning_content,
                  Date.now(),
                  true,
                  true,
                  currentAttemptId
                );
                accumulatedReasoning += delta.reasoning_content;
                continue;
              }

              // 2. TOOL CALLS: Discrete activity
              if (delta.tool_calls) {
                if (!activityFeed && botMsgDiv)
                  activityFeed = botMsgDiv.querySelector(".activity-feed");
                if (activityFeed) {
                  delta.tool_calls.forEach((tc) => {
                    const toolName = tc?.function?.name || "tool";
                    appendSubAgentActivity(
                      activityFeed,
                      isSubAgent ? agentName : "Assistant",
                      "tool_call",
                      JSON.stringify(tc),
                      Date.now(),
                      false,
                      true,
                      currentAttemptId
                    );
                  });
                  continue;
                }
              }

              // 3. TOOL RESULTS: Discrete activity
              if (delta.tool_result) {
                // Update snapshot: a tool result means the previous LLM step succeeded
                currentAttemptId = Date.now().toString();
                snapshotContent = accumulatedContent;
                snapshotReasoning = accumulatedReasoning;
                
                if (!activityFeed && botMsgDiv)
                  activityFeed = botMsgDiv.querySelector(".activity-feed");
                if (activityFeed) {
                  appendSubAgentActivity(
                    activityFeed,
                    isSubAgent ? agentName : "Assistant",
                    "tool_result",
                    delta.tool_result.content,
                    Date.now(),
                    false,
                    true
                  );
                }

                continue;
              }

              // 4. EVENTS: Discrete activity
              if (delta.role === "event") {
                // Update snapshot: an event means a new phase is starting or previous succeeded
                currentAttemptId = Date.now().toString();
                snapshotContent = accumulatedContent;
                snapshotReasoning = accumulatedReasoning;
                
                if (!activityFeed && botMsgDiv)
                  activityFeed = botMsgDiv.querySelector(".activity-feed");
                if (activityFeed) {
                  appendSubAgentActivity(
                    activityFeed,
                    agentName,
                    "event",
                    delta.content,
                    Date.now(),
                    false,
                    true
                  );
                  continue;
                }
              }

              // 5. SUB-AGENT CONTENT: Goes into agent card, discrete blocks
              if (isSubAgent && delta.content) {
                if (!activityFeed && botMsgDiv)
                  activityFeed = botMsgDiv.querySelector(".activity-feed");
                if (activityFeed) {
                  appendSubAgentActivity(
                    activityFeed,
                    agentName,
                    "content",
                    delta.content,
                    Date.now(),
                    true,
                    true,
                    currentAttemptId
                  );
                  continue;
                }
              }

              // 6. MAIN ASSISTANT CONTENT: Only thing that concatenates to the bubble
              if (delta.content) {
                accumulatedContent += delta.content;
              }

              // Determine phase for Content bubble
              const currentRoundContent = accumulatedContent
                .substring(historyContentStartIdx)
                .trim();
              const hasRealContent = currentRoundContent.length > 0;

              if (hasRealContent && !contentStarted) {
                contentStarted = true;
                isReasoningPhase = false;
              }
            }
          } catch (e) {
            console.error("[SSE parse error]", e, "Raw line:", line);
          }
        }

        const hasRealContentBatch = accumulatedContent.trim().length > 0;
        if (hasRealContentBatch) {
          const currentRoundContent = accumulatedContent.substring(
            historyContentStartIdx,
          );
          const formattedNewContent = formatMarkdown(currentRoundContent);
          if (mainWrapper.innerHTML !== formattedNewContent) {
            mainWrapper.innerHTML = formattedNewContent;
          }
        }

        if (contentStarted || accumulatedReasoning) {
          scrollToBottom("auto", false);
        } else if (isResearchMode) {
          scrollToBottom("auto", false);
        }
      }

      // Finalize thought container state
      if (thoughtWrapper) {
        const tc = thoughtWrapper.querySelector(".thought-container");
        if (tc) {
          tc.classList.remove("reasoning-active");
          const titleText = tc.querySelector(".thought-header-title");
          if (titleText) titleText.textContent = "Thought Process";
        }
      }

      if (!accumulatedContent && !accumulatedReasoning) {
        botMsgDiv.classList.remove("thinking");
        mainWrapper.innerHTML = `<span style="color: var(--color-neutral-400); font-style: italic;">[No content received]</span>`;
      } else {
        const { cleaned } = parseContent(accumulatedContent);
        mainWrapper.innerHTML = formatMarkdown(cleaned);
      }

      // Combine for history persistence (matches DB format)
      // Build the final message content using ONLY the text after the last tool call
      let finalContent = accumulatedContent.substring(historyContentStartIdx);
      let finalReasoning = accumulatedReasoning.substring(
        historyReasoningStartIdx,
      );

      let finalCombinedContent = finalContent;
      if (finalReasoning) {
        finalCombinedContent = `<think>\n${finalReasoning}\n</think>\n${finalContent}`;
      }

      // Persistence fix:
      // We always want to push the final response.
      // If tools were called, assistantMessagePushed is true, but that only pushed the turn leading to tools.
      // This final push captures the actual answer after tools.
      const assistantMsgObj = {
        role: "assistant",
        content: finalCombinedContent,
        model: actualModelName,
        sub_agent_history: JSON.parse(activityFeed?.dataset?.history || "[]"),
      };
      chatHistory.push(assistantMsgObj);

      // Update the bot message row to show which model generated this response
      const modelLabel = botMsgDiv.querySelector(".bot-model-label");
      if (modelLabel) {
        modelLabel.textContent = window.ModelManager.resolveModelDisplayName(actualModelName);
        modelLabel.closest(".bot-message-footer").style.display = "flex";
      }

      // Backend handles persistence, so we just reload list to get updated timestamp
      if (!isTemporaryChat && currentChatId) {
        // Update local model tracker
        if (currentChatData) {
          currentChatData.last_model = window.ModelManager.getSelectedModelName();
        }

        // Explicitly sync the last model to the backend immediately
        // This ensures it's saved even if the chat save endpoint doesn't catch it
        fetch(`${API_MODULES.CHATS}/${currentChatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ last_model: window.ModelManager.getSelectedModelName() }),
        }).catch((e) => console.error("Error updating last model:", e));

        // Delay slightly to ensure backend commit
        setTimeout(loadChats, 1000);
      }

      // Sync the full chat state natively with the DB now that the turn is complete
      if (currentChatId) {
        await loadChat(currentChatId, false, true);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Stream aborted by user");
        // Don't return — let finally block run for cleanup.
        // stopGeneration() already handled DOM cleanup.
        return;
      }
      botMsgDiv.classList.remove("thinking");
      // Clean up reasoning state on error
      const tcErr = thoughtWrapper?.querySelector(".thought-box");
      if (tcErr) {
        tcErr.classList.remove("reasoning-active");
        const titleText = tcErr.querySelector(".thought-title-text");
        if (titleText) titleText.textContent = "Thought Process";
        const dots = tcErr.querySelector(".thought-progress-dots");
        if (dots) dots.remove();
      }
      mainWrapper.innerHTML = `<span style="color: var(--color-rose-500)">API Error: ${error.message}</span>`;
      console.error("Chat Error:", error);
    } finally {
      botMsgDiv.classList.remove("thinking");
      isGenerating = false;
      currentAbortController = null;
      updateUIState(false);
      
      // Render any mermaid diagrams now that streaming is complete
      setTimeout(window.renderMermaidBlocks, 100);

      if (isResearchMode) updateResearchUI();
      if (activityFeed) {
        const liveInd = activityFeed.querySelector(".research-live-indicator");
        if (liveInd) liveInd.remove();
      }
      // Unlock file_system after generation
      updateFileSystemLockState();
    }
  }

  /**
   * Message Interaction Controller
   * Handles copy, delete, edit, and retry actions on chat bubbles.
   */
  messagesContainer.addEventListener("click", async (e) => {
    // Thought Process Full View Modal Toggle
    const fullViewBtn = e.target.closest(".thought-full-view-btn");
    if (fullViewBtn) {
      e.stopPropagation();
      const parentRow = fullViewBtn.closest(".bot-message.message-row");
      if (parentRow) {
        const activityFeed = parentRow.querySelector(".activity-feed");
        if (activityFeed) {
          activeThoughtModalSource = activityFeed; // TRACK SOURCE
          const modal = document.getElementById("thought-full-view-modal");
          const modalContentArea = document.getElementById("thought-modal-content-area");
          if (modal && modalContentArea) {
            // Clone the activity feed into the modal
            modalContentArea.innerHTML = "";
            const clone = activityFeed.cloneNode(true);
            
            // Collapse all items in the clone for the default modal view
            clone.querySelectorAll(".activity-item, .sub-agent-container, .sub-agent-section").forEach(item => {
              item.classList.add("collapsed");
              item.classList.remove("expanded");
            });

            modalContentArea.appendChild(clone);
            modal.style.display = "flex";
            setTimeout(() => modal.classList.add("open"), 10);
            setScrollLock(true);
          }
        }
      }
      return;
    }

    // File deep links
    const fileLink = e.target.closest('.file-link');
    if (fileLink) {
      e.preventDefault();
      const path = fileLink.getAttribute('data-path');
      
      // Attempt to locate file in current workspace
      if (_allFileSystems && _allFileSystems.length > 0) {
        const file = _allFileSystems.find(f => (f.filename || f.title) === path);
        if (file) {
          loadFileSystem(file.id, file.workspace_id || currentFileSystemWorkspaceId);
        } else {
          console.warn('File not found in current workspace:', path);
          // If we had a mechanism to open file by path alone, we'd use it here.
          // For now, we fall back to a visual alert or do nothing.
          showAlert("File Not Found", `The file ${path} was not found in the current workspace's artifact tree.`);
        }
      }
      return;
    }

    // Code Copy Button
    const copyCodeBtn = e.target.closest('.copy-code-btn');
    if (copyCodeBtn) {
      e.preventDefault();
      const codeToCopy = decodeURIComponent(copyCodeBtn.getAttribute('data-code'));
      navigator.clipboard.writeText(codeToCopy).then(() => {
        const originalHtml = copyCodeBtn.innerHTML;
        copyCodeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>`;
        copyCodeBtn.classList.add('copied');
        setTimeout(() => {
          copyCodeBtn.innerHTML = originalHtml;
          copyCodeBtn.classList.remove('copied');
        }, 2000);
      });
      return;
    }

    // Lightbox Image
    const lightboxImg = e.target.closest('.lightbox-img');
    if (lightboxImg) {
      e.preventDefault();
      const src = lightboxImg.getAttribute('src');
      const alt = lightboxImg.getAttribute('alt') || lightboxImg.getAttribute('title');
      showLightbox(src, alt);
      return;
    }

    // Dropdown/Card Expand Toggles
    const header = e.target.closest(
      ".thought-header, .activity-header, .sub-agent-header, .sse-chunk-header, .phase-header, .sub-agent-summary",
    );
    if (header) {
      const container = header.closest(
        ".thought-container, .thought-box, .activity-item, .sub-agent-container, .sub-agent-section, .sse-chunk, .research-phase-indicator, .research-activity-item",
      );
      if (container) {
        const wasExpanded = container.classList.contains("expanded");
        const isCollapsed = container.classList.toggle("collapsed", wasExpanded);
        container.classList.toggle("expanded", !wasExpanded);

        // Handle full-width reasoning sibling if it exists
        if (container.classList.contains("thought-container") || container.classList.contains("thought-box")) {
          const row = container.closest(".bot-message.message-row");
          if (row) {
            const timeline = row.querySelector(".thought-timeline-wrapper");
            if (timeline) {
              timeline.classList.toggle("expanded", !wasExpanded);
            }
          }
        }
      }
      return;
    }

    // Read More expansion / Read Less collapse for truncated user messages
    const readMoreBtn = e.target.closest(".read-more-btn, .read-less-btn");
    if (readMoreBtn) {
      const isExpanding = readMoreBtn.classList.contains("read-more-btn");
      const messageContent = readMoreBtn.closest(".message-content");
      const rawText = decodeURIComponent(messageContent.dataset.raw);
      const textWrapper = messageContent.querySelector(".message-text-wrapper");

      if (textWrapper) {
        if (isExpanding) {
          textWrapper.innerHTML = formatMarkdown(rawText);
          readMoreBtn.textContent = "Read Less";
          readMoreBtn.className = "read-less-btn";
          messageContent.classList.remove("truncated-content");

          // Re-run highlighting for code blocks in the expanded content
          textWrapper.querySelectorAll("pre code").forEach((block) => {
            if (typeof hljs !== "undefined") {
              hljs.highlightElement(block);
            }
          });
        } else {
          // Collapse back
          const limit = 1000;
          const displayContent = rawText.substring(0, limit) + "...";
          textWrapper.innerHTML = formatMarkdown(displayContent);
          readMoreBtn.textContent = "Read More";
          readMoreBtn.className = "read-more-btn";
          messageContent.classList.add("truncated-content");
          scrollToBottom("smooth");
        }
      }
      return;
    }

    if (isGenerating) return;

    // View FileSystem Attachment
    const viewReportBtn = e.target.closest(".view-report-btn");
    if (viewReportBtn) {
      const reportLang = viewReportBtn.dataset.reportLanguage || "markdown";
      openReportFileSystem(
        decodeURIComponent(viewReportBtn.dataset.reportContent),
        "report",
        false,
        null,
        null,
        reportLang,
      );
      return;
    }

    // Copy to Clipboard
    const copyBtn = e.target.closest(".copy-msg-btn");
    if (copyBtn) {
      const row = copyBtn.closest(".message-row");
      const index =
        row.dataset.historyIndex !== undefined
          ? parseInt(row.dataset.historyIndex, 10)
          : -1;
      let textToCopy = "";
      if (index !== -1 && chatHistory[index]) {
        const content = chatHistory[index].content;
        textToCopy = Array.isArray(content)
          ? content.find((i) => i.type === "text")?.text || ""
          : content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      }
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          setTimeout(() => (copyBtn.innerHTML = originalHTML), 2000);
        });
      }
      return;
    }

    // Action Buttons
    const deleteBtn = e.target.closest(".delete-msg-btn");
    if (deleteBtn) {
      deleteMessageAction(deleteBtn);
      return;
    }
    const editBtn = e.target.closest(".edit-msg-btn");
    if (editBtn) {
      editMessageAction(editBtn);
      return;
    }
    const retryBtn = e.target.closest(".retry-msg-btn");
    if (retryBtn) {
      retryMessageAction(retryBtn);
      return;
    }
  });

  // Handle Autoscroll on Image Load
  messagesContainer.addEventListener(
    "load",
    (e) => {
      if (e.target.tagName === "IMG") {
        scrollToBottom("smooth");
      }
    },
    true,
  ); // Use capture phase because 'load' doesn't bubble

  function updateUIState(loading) {
    if (loading) {
      sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>`;
      sendBtn.classList.add("stop-mode");
    } else {
      sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      sendBtn.classList.remove("stop-mode");
    }
  }

  /**
   * Abort Controller & DB Truncation logic.
   * Performs a 4-step cleanup:
   * 1. Cancels the active AbortController (stopped client-side fetch).
   * 2. Synchronously truncates Local ChatHistory.
   * 3. Sends Truncate Command to Backend (prevents diverged state).
   * 4. Cleans up dangling server-side SSE resources.
   */
  async function stopGeneration() {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    isGenerating = false;
    updateUIState(false);

    if (currentChatId && !isTemporaryChat) {
      try {
        await fetch(`${API_MODULES.CHATS}/${currentChatId}/stop`, {
          method: "POST",
        });
        // Reload chat to reflect rolled-back state
        loadChat(currentChatId, false, true);
      } catch (e) {
        console.error("Failed to stop via API:", e);
      }
    }
  }

  // → renderResearchPlanToHtml, formatMarkdown, getFileIconForMime,
  //   formatFileSize, parseContent, cleanReasoningForPersistence
  //   moved to static/js/utils.js

  /**
   * Shows a resume banner at the bottom of the message list.
   * The user must click "Resume" to re-trigger the interrupted turn.
   */
  function showResumeBanner() {
    // Remove any existing banner
    const existing = document.getElementById("resume-banner");
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.id = "resume-banner";
    banner.className = "resume-banner";
    banner.innerHTML = `
            <div class="resume-banner-content">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>This conversation was interrupted. Resume where it left off?</span>
            </div>
            <div class="resume-banner-actions">
                <button class="btn-secondary resume-dismiss">Dismiss</button>
                <button class="btn-primary resume-confirm">Resume</button>
            </div>
        `;

    banner.querySelector(".resume-confirm").addEventListener("click", () => {
      if (!window.ModelManager.getSelectedModel()) {
        showAlert(
          "Model Not Ready",
          "Please wait for models to load before resuming.",
        );
        return;
      }
      banner.remove();
      sendMessage(null, null, true);
    });
    banner
      .querySelector(".resume-dismiss")
      .addEventListener("click", async () => {
        banner.remove();
        // Persist dismissal so banner doesn't re-appear on navigation
        try {
          await fetch(`${API_MODULES.CHATS}/${currentChatId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resume_suppressed: 1 }),
          });
        } catch (e) {
          console.warn("Failed to persist banner dismiss:", e);
        }
      });

    messagesContainer.appendChild(banner);
    scrollToBottom();
  }

  // ==================== PHASE 2: ASSISTANT TURNS & ACTIVITY FEED ====================

  /**
   * Sort activities chronologically
   * Used for the activity feed display
   *
   * @param {Array} activities - Array of activity objects
   * @returns {Array} Sorted array of activities
   */

  /**
   * Render an activity feed as expandable items
   *
   * @param {Array} activities - Sorted activity objects
   * @returns {string} HTML for the activity feed
   */
  /**
   * Build the inner HTML content for an activity feed (without the .activity-feed wrapper).
   * Groups named sub-agent activities into .sub-agent-section containers that are
   * structurally identical to what getSharedAgentCard produces during live streaming.
   * Main agent activities (thinking, tool_call, tool_result with no agentName) render inline.
   */

  /**
   * Render a single activity item for display INSIDE a sub-agent container.
   * Produces the same inner structure as renderActivityItem but without an outer agent wrapper.
   */

  /**
   * Public wrapper: returns the full <div class="activity-feed"> block.
   * Use _buildActivityFeedContent when you need just the inner HTML.
   */

  // → parseResearchPlan moved to static/js/utils.js

  // → getSharedAgentCard and appendSubAgentActivity moved to static/js/agent-renderers.js


  // → escapeHtml moved to static/js/utils.js

  // Auto-resize textarea
  textArea.addEventListener("input", () => {
    textArea.style.height = "auto";
    textArea.style.height = textArea.scrollHeight + "px";
  });

  textArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating) {
        sendMessage();
      }
    }
  });

  sendBtn.addEventListener("click", () => {
    if (isGenerating) {
      stopGeneration();
    } else {
      sendMessage();
    }
  });

  // Visual Viewport Sync for keyboard height adjustment is managed in static/js/scroll-manager.js

  // → hashContent moved to static/js/utils.js

  window.openReportFileSystem = async function (
    content,
    mode = "report",
    isFinalized = false,
    file_systemId = null,
    title = null,
    language = "markdown",
    workspaceId = null,
  ) {
    handleFileSystemUpdate({
      action: "create",
      id: file_systemId || (mode === "plan" ? "plan" : "report"),
      title:
        title || (mode === "plan" ? "Research Strategy" : "Research Report"),
      content: content,
      language: language,
      workspace_id: workspaceId,
    });
  };

  async function fetchFileSystems(chatId) {
    if (!file_systemListContainer) return 0;
    if (isFetchingFileSystems) return 0;
    if (!chatId) {
      _allFileSystems = [];
      file_systemListContainer.innerHTML =
        '<div style="padding: 1.5rem; color: var(--content-muted); font-size: 0.85rem; text-align: center;">New chat started</div>';
      return 0;
    }
    isFetchingFileSystems = true;
    try {
      const res = await fetch(`${API_MODULES.FILE_SYSTEMS}?chat_id=${chatId}`);
      const data = await res.json();
      if (data.success) {
        _allFileSystems = data.file_systems;
        window.FileSystemUI.updateData(data.file_systems);
        return data.file_systems.length;
      }
      return 0;
    } catch (e) {
      console.error("Failed to fetch file_systems:", e);
      return 0;
    } finally {
      isFetchingFileSystems = false;
    }
  }

  // Apply current search query + folder filter, then re-render

// Keep the old name as an alias so callers outside still work

// Build a single file_system item DOM node

// Render filtered list with true nested tree

async function loadFileSystem(file_systemId, workspaceId = null) {
    try {
      const wsParam = workspaceId ? `&workspace_id=${workspaceId}` : "";
      const res = await fetch(
        `${API_MODULES.FILE_SYSTEMS}/${file_systemId}?chat_id=${currentChatId}${wsParam}`,
      );
      const data = await res.json();
      if (data.success) {
        // Initialize version state for undo/redo
        if (currentChatId) {
          await window.VersionManager.loadVersionsWithCurrentState(file_systemId, currentChatId, workspaceId);
        }
        // Call openReportFileSystem but prevent auto-save-loop by passing the ID
        openReportFileSystem(
          data.content,
          "report",
          true,
          data.id,
          data.title,
          data.language,
          data.workspace_id,
        );
      }
    } catch (e) {
      console.error("Failed to load file_system:", e);
    }
  }

  // Enhanced file_system preview: Export file_system to file
  async function downloadFileSystem(file_systemId, workspaceId = null) {
    const wsParam = workspaceId ? `&workspace_id=${workspaceId}` : "";
    try {
      const res = await fetch(
        `${API_MODULES.FILE_SYSTEMS}/${file_systemId}?chat_id=${currentChatId}${wsParam}`,
      );
      const data = await res.json();
      if (!data.success) {
        console.error("Failed to fetch file_system for download");
        return;
      }

      const blob = new Blob([data.content], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "file.txt";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed:", e);
    }
  }

  // Enhanced file_system preview: Delete file_system from sidebar
  async function deleteFileSystem(file_systemId, workspaceId = null) {
    if (isGenerating) {
      await showAlert(
        "Generation in Progress",
        "Please wait for the AI to finish before deleting artifacts.",
      );
      return;
    }
    if (!currentChatId) return;
    try {
      const wsParam = workspaceId ? `&workspace_id=${workspaceId}` : "";
      const res = await fetch(
        `${API_MODULES.FILE_SYSTEMS}/${file_systemId}?chat_id=${currentChatId}${wsParam}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await fetchFileSystems(currentChatId);
        if (currentFileSystemId === file_systemId) {
          closeFileSystemPanel();
        }
      }
    } catch (e) {
      console.error("Error deleting file_system:", e);
    }
  }

  async function renameOrMoveFileSystemPath(file_systemId, newPath, workspaceId = null) {
    if (isGenerating) {
      await showAlert(
        "Generation in Progress",
        "Please wait for the AI to finish before moving artifacts.",
      );
      return;
    }
    if (!currentChatId) return;

    // Check if path already exists
    if (_allFileSystems.some(c => c.filename === newPath && c.id !== file_systemId)) {
      await showModal("Path Already Taken", `A file already exists at path: ${newPath}`, { type: "alert" });
      return;
    }

    try {
      const res = await fetch(
        `${API_MODULES.FILE_SYSTEMS}/${file_systemId}?chat_id=${currentChatId}${workspaceId ? `&workspace_id=${workspaceId}` : ''}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            new_path: newPath,
            workspace_id: workspaceId
          }),
        },
      );
      if (res.ok) {
        await fetchFileSystems(currentChatId);
      }
    } catch (e) {
      console.error("Error moving/renaming file_system:", e);
    }
  }

  async function deleteFileSystemFolder(folderPath) {
    if (isGenerating) {
      await showAlert(
        "Generation in Progress",
        "Please wait for the AI to finish before deleting artifacts.",
      );
      return;
    }
    if (!currentChatId) return;
    
    if (await showConfirm("Delete Directory", `Are you sure you want to delete the empty directory '${folderPath}'?`, true)) {
      try {
        const res = await fetch(
          `${API_MODULES.FILE_SYSTEMS}/directory?chat_id=${currentChatId}&path=${encodeURIComponent(folderPath)}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (data.success) {
          await fetchFileSystems(currentChatId);
        } else {
          await showModal("Error", data.error || "Failed to delete directory", { type: "alert" });
        }
      } catch (e) {
        console.error("Error deleting file_system folder:", e);
        await showModal("Error", "An error occurred while deleting the directory.", { type: "alert" });
      }
    }
  }

  // Files nav button - always visible, click opens right sidebar
  if (navFilesBtn) {
    navFilesBtn.addEventListener("click", (e) => {
      e.preventDefault();
      rightSidebar?.classList.toggle("collapsed");
      if (!rightSidebar?.classList.contains("collapsed") && currentChatId) {
        fetchFileSystems(currentChatId);
      }
    });
  }
  // Right sidebar close button
  if (rightSidebarClose && rightSidebar) {
    rightSidebarClose.addEventListener("click", () => {
      rightSidebar.classList.add("collapsed");
    });
  }

  // ─── New FileSystem Button ─────────────────────────────────────────────
  const newFileSystemBtn = document.getElementById("new-file-system-btn");
  if (newFileSystemBtn) {
    newFileSystemBtn.addEventListener("click", async () => {
      if (!currentChatId) {
        await showModal(
          "Cannot Create FileSystem",
          "Please start a chat first before creating a file_system.",
          { type: "alert" },
        );
        return;
      }

      const finalPath = await showFileExplorerModal("file");
      if (!finalPath) return;

      // Check if path already exists
      if (_allFileSystems.some(c => c.filename === finalPath)) {
        await showModal("File Already Exists", `A file already exists at path: ${finalPath}. Please use a different name or path.`, { type: "alert" });
        return;
      }

      // Infer language from extension
      const ext = finalPath.includes(".") ? finalPath.split(".").pop().toLowerCase() : "";
      let inferredLang = "markdown"; // Default for reports/folders
      
      if (ext) {
        // If it's a known markdown extension, keep it as markdown
        if (ext === "md" || ext === "markdown") {
          inferredLang = "markdown";
        } else {
          // Otherwise, use the extension itself. 
          // setEditorLanguage handles mapping 'py' to Python, 'js' to JS, etc.
          inferredLang = ext;
        }
      }

      try {
        const res = await fetch(`${API_MODULES.FILE_SYSTEMS}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: currentChatId,
            title: finalPath, // Sending as title which backend translates to path
            content: "",
            language: inferredLang,
          }),
        });

        const data = await res.json();
        if (data.success) {
          fetchFileSystems(currentChatId);
        } else {
          await showModal("Error", data.error || "Failed to create file_system", {
            type: "alert",
          });
        }
      } catch (e) {
        console.error("Failed to create file_system:", e);
        await showModal(
          "Error",
          "An error occurred while creating the file_system.",
          { type: "alert" },
        );
      }
    });
  }

  const newFileSystemFolderBtn = document.getElementById("new-file-system-folder-btn");
  if (newFileSystemFolderBtn) {
    newFileSystemFolderBtn.addEventListener("click", async () => {
      if (!currentChatId) {
        await showModal(
          "Cannot Create Folder",
          "Please start a chat first before creating a folder.",
          { type: "alert" },
        );
        return;
      }
      const finalPath = await showFileExplorerModal("folder");
      if (finalPath) {
        // Check if path already exists
        if (_allFileSystems.some(c => c.filename === finalPath || c.filename.startsWith(finalPath + "/"))) {
          await showModal("Folder Already Exists", `A folder or file already exists at path: ${finalPath}.`, { type: "alert" });
          return;
        }

        try {
          const res = await fetch(`${API_MODULES.FILE_SYSTEMS}/directory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: currentChatId,
              path: finalPath
            }),
          });
          const data = await res.json();
          if (data.success) {
            // Re-render
            await fetchFileSystems(currentChatId);
          } else {
            await showModal("Error", data.error || "Failed to create folder", { type: "alert" });
          }
        } catch (e) {
          console.error("Error creating folder:", e);
          await showModal("Error", "An error occurred while creating the folder.", { type: "alert" });
        }
      }
    });
  }

  // ─── Sidebar Search & Filter ─────────────────────────────────────────────
  const file_systemSearchInput = document.getElementById("file-system-search-input");
  const file_systemSearchClear = document.getElementById("file-system-search-clear");
  const file_systemFilterRow = document.getElementById("file-system-filter-row");

  if (file_systemSearchInput) {
    file_systemSearchInput.addEventListener("input", () => {
      const q = file_systemSearchInput.value;
      if (file_systemSearchClear) {
        file_systemSearchClear.classList.toggle("hidden", !q);
      }
      window.FileSystemUI.setSearchQuery(q);
    });
  }

  if (file_systemSearchClear) {
    file_systemSearchClear.addEventListener("click", () => {
      if (file_systemSearchInput) file_systemSearchInput.value = "";
      file_systemSearchClear.classList.add("hidden");
      window.FileSystemUI.setSearchQuery("");
      window.FileSystemUI.setFolderFilter("");
    });
  }

  if (file_systemFilterRow) {
    file_systemFilterRow.addEventListener("click", (e) => {
      const pill = e.target.closest(".file-system-filter-pill");
      if (!pill) return;
      // Update active pill (visual only, actual filter was never implemented in original logic)
      file_systemFilterRow
        .querySelectorAll(".file-system-filter-pill")
        .forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
    });
  }

  /* ═══════════════════════════════════════════
       UNIVERSAL FILE_SYSTEM SYSTEM (Phase 4 Logic)
       ═══════════════════════════════════════════ */

  async function handleFileSystemUpdate(data) {
    if (!data) return;

    // Resolve ID if missing but path is present
    if (!data.id && data.path) {
      const found = (_allFileSystems || []).find((c) => c.filename === data.path);
      if (found) data.id = found.id;
    }

    if (!data.id) return;

    // Set current file_system ID for autosave to work
    currentFileSystemId = data.id;
    currentFileSystemWorkspaceId = data.workspace_id;
    currentFileSystemLanguage = data.language || "markdown";

    // Update content
    if ((data.filename || data.title) && fileSystemPanelTitle) {
      fileSystemPanelTitle.textContent = data.filename || data.title;
    }

    const langBadge = document.getElementById("language-badge");
    if (langBadge) {
      if (currentFileSystemLanguage && currentFileSystemLanguage !== "markdown") {
        langBadge.textContent = currentFileSystemLanguage;
        langBadge.classList.remove("hidden");
      } else {
        langBadge.classList.add("hidden");
      }
    }

    // Correctly synchronize fileSystemMode state (Issue fix)
    fileSystemMode = true;
    if (fileSystemModeToggle && !fileSystemModeToggle.classList.contains("active")) {
      fileSystemModeToggle.classList.add("active");
    }

    if (data.action === "create" || data.action === "replace") {
      currentFileSystemContentRaw = data.content;
      // Lock file_system mode once a file_system is created - prevent turning off
      // Track this chat as having a file_system
      if (currentChatId) {
        chatsWithFileSystems.add(currentChatId);
      }

      if (fileSystemModeToggle && !fileSystemModeToggle.classList.contains("locked")) {
        fileSystemModeToggle.classList.add("locked");
        fileSystemModeToggle.title =
          "FileSystem mode is permanently enabled for this chat";
      }
    } else if (data.action === "append") {
      currentFileSystemContentRaw += "\n\n" + data.content;
    } else if (data.action === "patch") {
      currentFileSystemContentRaw = data.content;
    } else if (data.action === "read") {
      currentFileSystemContentRaw = data.content;
    }

    // Apply language parser first, then insert content so the parser is active
    // when CodeMirror tokenises the new text. setEditorLanguage is async because
    // uncommon languages (rust, yaml, go…) are loaded dynamically.
    await window.EditorManager.setLanguage(currentFileSystemLanguage);

    // Update editors with new content (runs after language parser is ready)
    window.EditorManager.setEditorContent(currentFileSystemContentRaw);

    // Handle view mode toggle (Code/Preview)
    const cleanExt = (currentFileSystemLanguage || "markdown")
      .replace(".", "")
      .toLowerCase();
    const supportsPreview =
      cleanExt === "markdown" || cleanExt === "md" || cleanExt === "html";

    if (viewModeSelector) {
      if (supportsPreview) {
        viewModeSelector.classList.remove("hidden");
      } else {
        viewModeSelector.classList.add("hidden");
        // Revert to code mode if preview was active but is no longer supported
        if (currentFileSystemViewMode === "preview") {
          currentFileSystemViewMode = "code";
          viewModeBtns.forEach((b) =>
            b.classList.toggle("active", b.dataset.mode === "code"),
          );
          if (viewModeSelector) viewModeSelector.setAttribute("data-mode", "code");
          if (fileSystemPreviewContainer)
            fileSystemPreviewContainer.classList.add("hidden");
          if (fileSystemCodemirrorContainer)
            fileSystemCodemirrorContainer.classList.remove("hidden");
        }
      }
    }

    // Update preview if in preview mode
    if (currentFileSystemViewMode === "preview" && supportsPreview) {
      window.EditorManager.renderPreview(
        currentFileSystemContentRaw,
        currentFileSystemLanguage,
      );
    }

    // Handle the "Approve" and "Suggest Changes" buttons for research plans
    const isPlan =
      data.id === "plan" ||
      data.id.startsWith("research_strategy") ||
      data.id.startsWith("plan_");

    // Show/Hide buttons
    if (isPlan && fileSystemPanelApproveBtn && fileSystemPanelSuggestBtn) {
      fileSystemPanelApproveBtn.classList.remove("hidden");
      fileSystemPanelSuggestBtn.classList.remove("hidden");

      // Buttons are always available for interaction as per request

      // If it's already approved, update button state
      const isApprovedPlan =
        data.content &&
        (data.content.includes('<research_plan status="approved"') ||
          data.content.includes('<research_plan status="executed"'));
      if (isApprovedPlan) {
        // Keep interactive but update text to show it ran
        fileSystemPanelApproveBtn.querySelector("span").textContent = "Executed";
        fileSystemPanelSuggestBtn.classList.add("hidden"); // Hide suggest when approved
      } else {
        fileSystemPanelApproveBtn.style.opacity = "1";
        fileSystemPanelApproveBtn.querySelector("span").textContent = "Approve";
        fileSystemPanelSuggestBtn.classList.remove("hidden");
      }

      // Permanently hide undo/redo/history for plan file_systems
      const undoBtn = document.getElementById("file-system-panel-undo-btn");
      const redoBtn = document.getElementById("file-system-panel-redo-btn");
      const historyBtn = document.getElementById("file-system-panel-history-btn");
      
      if (undoBtn) undoBtn.classList.add("hidden");
      if (redoBtn) redoBtn.classList.add("hidden");
      if (historyBtn) historyBtn.classList.add("hidden");
    } else {
      if (fileSystemPanelApproveBtn) fileSystemPanelApproveBtn.classList.add("hidden");
      if (fileSystemPanelSuggestBtn) fileSystemPanelSuggestBtn.classList.add("hidden");
      if (file_systemPlanEditArea) file_systemPlanEditArea.classList.add("hidden"); // Ensure edit area is closed

      // Re-show undo/redo/history for normal artifacts
      const undoBtn = document.getElementById("file-system-panel-undo-btn");
      const redoBtn = document.getElementById("file-system-panel-redo-btn");
      const historyBtn = document.getElementById("file-system-panel-history-btn");
      
      if (undoBtn) undoBtn.classList.remove("hidden");
      if (redoBtn) redoBtn.classList.remove("hidden");
      if (historyBtn) historyBtn.classList.remove("hidden");
    }

    // Lock research plan file_system from editing
    const isPlanFileSystem =
      data.id && (data.id.startsWith("plan_") || data.id === "plan");
    if (isPlanFileSystem) {
      window.EditorManager.setReadOnly(true);
      if (fileSystemCodemirrorContainer)
        fileSystemCodemirrorContainer.style.opacity = "0.7"; // Visual hint
    } else {
      window.EditorManager.setReadOnly(isGenerating);
      if (fileSystemCodemirrorContainer)
        fileSystemCodemirrorContainer.style.opacity = "1";
    }

    // Open file_system panel for everything (Phase 4 Unification)
    if (fileSystemPanel) {
      fileSystemPanel.classList.remove("hidden");
      mainElement.classList.add("file-system-open");
      if (appRoot) appRoot.classList.add("file-system-open");

      // Sync current width to CSS variable for side-by-side transition
      const currentWidth = fileSystemPanel.offsetWidth;
      if (currentWidth > 0) {
        document.documentElement.style.setProperty(
          "--file-system-panel-width",
          `${currentWidth}px`,
        );
      }
    }
    fileSystemPanelVisible = true;

    // Immediate sidebar refresh for new file_system creation, debounced for updates
    if (currentChatId) {
      if (data.action === "create") {
        // Refresh immediately for new file_system
        fetchFileSystems(currentChatId);
        // Also initialize version history state
        window.VersionManager.loadVersionsWithCurrentState(data.id, currentChatId, data.workspace_id);
      } else {
        // Use debounce for updates to avoid spam
        debouncedFetchFileSystems(currentChatId);
        // Also refresh version state (for UNDO/REDO buttons)
        window.VersionManager.loadVersionsWithCurrentState(data.id, currentChatId, data.workspace_id);
      }
    }
  }

  function updateFileSystemLockState() {
    window.EditorManager.setReadOnly(isGenerating);
    // Approve and Suggest buttons remain enabled even during generation
    // to allow interaction as soon as the plan appears.
  }
  // Debounce helper used by handleFileSystemUpdate to avoid network spam during research
  let _fetchFileSystemsDebounceTimer = null;
  function debouncedFetchFileSystems(chatId) {
    clearTimeout(_fetchFileSystemsDebounceTimer);
    _fetchFileSystemsDebounceTimer = setTimeout(() => fetchFileSystems(chatId), 2500);
  }

  function closeFileSystemPanel() {
    if (!fileSystemPanel) return;
    fileSystemPanel.classList.add("hidden");
    mainElement.classList.remove("file-system-open");
    if (appRoot) appRoot.classList.remove("file-system-open");
    fileSystemPanelVisible = false;
  }

  if (closeFileSystemPanelBtn) {
    closeFileSystemPanelBtn.addEventListener("click", closeFileSystemPanel);
  }

  // Unified "Approve & Execute Plan" Handler (FileSystem Panel)
  if (fileSystemPanelApproveBtn) {
    fileSystemPanelApproveBtn.addEventListener("click", async () => {
      if (!currentFileSystemContentRaw || !currentFileSystemId) return;
      if (currentFileSystemId !== "plan" && !currentFileSystemId.startsWith("plan_"))
        return;

      // Extract callback_id from the content if possible, or just send the approval
      // The backend PlannerAgent should have left a callback_id in its metadata or the turn
      // For now, we rely on the agent_callback resume mechanism.

      fileSystemPanelApproveBtn.querySelector("span").textContent = "Executing...";

      try {
        // Try to find the most recent callback ID for this chat
        const callbackRes = await fetch(
          `${API_MODULES.CHATS}/${currentChatId}/agent/callback/latest`,
        );
        const callbackData = await callbackRes.json();

        const callbackId = callbackData.callback_id;
        if (!callbackId) {
          alert("No active research session found to approve.");

          fileSystemPanelApproveBtn.style.opacity = "1";
          fileSystemPanelApproveBtn.querySelector("span").textContent = "Approve";
          return;
        }

        const res = await fetch(`${API_MODULES.TOOLS}/clarification/response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_id: callbackId,
            chat_id: currentChatId,
            type: "approved",
          }),
        });

        if (res.ok) {
          fileSystemPanelApproveBtn.querySelector("span").textContent =
            "Executing...";

          // The turn is suspended on the backend. Waking it up will cause it to finish the planner turn.
          // We must wait for THAT turn to finish before initiating the next turn.
          const checkFinished = setInterval(() => {
            if (!isGenerating) {
              clearInterval(checkFinished);
              sendMessage(null, { approvedPlan: true });
            }
          }, 100);
        } else {
          alert("Failed to approve plan.");

          fileSystemPanelApproveBtn.style.opacity = "1";
          fileSystemPanelApproveBtn.querySelector("span").textContent = "Approve";
        }
      } catch (e) {
        console.error("Error in FileSystem Approve:", e);

        fileSystemPanelApproveBtn.style.opacity = "1";
        fileSystemPanelApproveBtn.querySelector("span").textContent = "Approve";
      }
    });
  }

  // Suggest Changes Handlers
  if (fileSystemPanelSuggestBtn) {
    fileSystemPanelSuggestBtn.addEventListener("click", () => {
      if (file_systemPlanEditArea) {
        file_systemPlanEditArea.classList.remove("hidden");
        if (file_systemPlanEditTextarea) file_systemPlanEditTextarea.focus();
      }
    });
  }

  if (file_systemPlanEditClose) {
    file_systemPlanEditClose.addEventListener("click", () => {
      if (file_systemPlanEditArea) file_systemPlanEditArea.classList.add("hidden");
    });
  }

  if (file_systemPlanEditSubmit) {
    file_systemPlanEditSubmit.addEventListener("click", async () => {
      const edits = file_systemPlanEditTextarea.value.trim();
      if (!edits || !currentChatId) return;

      file_systemPlanEditSubmit.disabled = true;
      file_systemPlanEditSubmit.textContent = "Submitting Revisions...";

      try {
        // For direct resume on revisions, we find the latest thread task
        const wovenRes = await fetch(`${API_MODULES.CHATS}/${currentChatId}`);
        const wovenData = await wovenRes.json();

        // Find latest tool call with 'awaiting_response' in woven history
        let callbackId = null;
        for (const turn of (wovenData.messages || []).reverse()) {
          if (turn.tool_calls) {
            const tc = turn.tool_calls.find(
              (t) => t.status === "awaiting_response",
            );
            if (tc) {
              callbackId = tc.callback_id;
              break;
            }
          }
        }

        if (!callbackId) {
          alert("No active research session found.");
          file_systemPlanEditSubmit.disabled = false;
          file_systemPlanEditSubmit.textContent = "Submit Revisions";
          return;
        }

        const res = await fetch(`${API_MODULES.TOOLS}/clarification/response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_id: callbackId,
            chat_id: currentChatId,
            type: "edit",
            content: edits,
          }),
        });

        if (res.ok) {
          // Success! Hide the edit area and wait for the plan to be revised
          if (file_systemPlanEditArea) file_systemPlanEditArea.classList.add("hidden");
          if (file_systemPlanEditTextarea) file_systemPlanEditTextarea.value = "";

          // We don't trigger a new turn here because the sub-agent is already running/resumed
          // and will yield new SSE chunks with the revised plan.
        } else {
          alert("Failed to submit revisions.");
        }
      } catch (e) {
        console.error("Error submitting edits from FileSystem:", e);
      } finally {
        file_systemPlanEditSubmit.disabled = false;
        file_systemPlanEditSubmit.textContent = "Submit Revisions";
      }
    });
  }

  if (fileSystemModeToggle) {
    fileSystemModeToggle.addEventListener("click", () => {
      // Don't allow toggling when locked (chat has file_systems)
      if (fileSystemModeToggle.classList.contains("locked")) {
        return; // Prevent any toggle action when locked
      }
      fileSystemMode = !fileSystemMode;
      fileSystemModeToggle.classList.toggle("active", fileSystemMode);
      if (chatHistory.length > 0) {
        patchChat({ file_system_mode: fileSystemMode });
      }
      if (!fileSystemMode) {
        closeFileSystemPanel();
      }
      // Visual feedback - update active tool icon
      updateResearchUI();
    });
  }

  if (viewModeBtns) {
    viewModeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        if (mode === currentFileSystemViewMode) return;

        currentFileSystemViewMode = mode;

        // Update UI
        viewModeBtns.forEach((b) => b.classList.toggle("active", b === btn));
        if (viewModeSelector) {
          viewModeSelector.setAttribute("data-mode", mode);
        }

        // Switch panels
        if (mode === "preview") {
          if (fileSystemCodemirrorContainer)
            fileSystemCodemirrorContainer.classList.add("hidden");
          if (fileSystemPreviewContainer) {
            fileSystemPreviewContainer.classList.remove("hidden");
            window.EditorManager.renderPreview(
              currentFileSystemContentRaw,
              currentFileSystemLanguage,
            );
          }
        } else {
          if (fileSystemPreviewContainer)
            fileSystemPreviewContainer.classList.add("hidden");
          if (fileSystemCodemirrorContainer)
            fileSystemCodemirrorContainer.classList.remove("hidden");
        }
      });
    });
  }

  if (browsingModeToggle) {
    browsingModeToggle.addEventListener("click", () => {
      browsingMode = !browsingMode;
      browsingModeToggle.classList.toggle("active", browsingMode);
      if (chatHistory.length > 0) {
        patchChat({ browsing_mode: browsingMode });
      }
    });
  }

  if (fileSystemPanelCopyBtn) {
    fileSystemPanelCopyBtn.addEventListener("click", () => {
      if (currentFileSystemContentRaw) {
        navigator.clipboard.writeText(currentFileSystemContentRaw).then(() => {
          const originalBtn = fileSystemPanelCopyBtn.innerHTML;
          fileSystemPanelCopyBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          setTimeout(() => (fileSystemPanelCopyBtn.innerHTML = originalBtn), 2000);
        });
      }
    });
  }

  // Autosave indicator element
  const autosaveIndicator = document.getElementById("autosave-indicator");
  const autosaveStatus = document.getElementById("autosave-status");

  // Debounced save function for file_system content with autosave indicator
  let _saveDebouncedTimer = null;
  function saveDebounced(file_systemId, content) {
    // Show "Saving..." indicator
    if (autosaveIndicator) {
      autosaveIndicator.style.display = "block";
      autosaveIndicator.className = "saving";
      autosaveStatus.textContent = "Saving...";
    }

    clearTimeout(_saveDebouncedTimer);
    _saveDebouncedTimer = setTimeout(() => {
      fetch(`${API_MODULES.FILE_SYSTEMS}/${file_systemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chat_id: currentChatId, 
          workspace_id: currentFileSystemWorkspaceId,
          content: content 
        }),
      })
        .then((res) => res.json())
        .then((result) => {
          // Show "Saved" indicator on success
          if (autosaveIndicator) {
            autosaveIndicator.className = "saved";
            autosaveStatus.textContent = "Saved";
            setTimeout(() => {
              autosaveIndicator.style.display = "none";
              autosaveIndicator.className = "";
            }, 1500);
          }

          // Refresh version state
          if (result.success && currentFileSystemId && currentChatId) {
            window.VersionManager.loadVersionsWithCurrentState(currentFileSystemId, currentChatId, currentFileSystemWorkspaceId);
          }
        })
        .catch((err) => {
          console.error("Failed to persist file_system edit:", err);
          // Show error state
          if (autosaveIndicator) {
            autosaveIndicator.className = "";
            autosaveStatus.textContent = "Error saving";
            setTimeout(() => {
              autosaveIndicator.style.display = "none";
              autosaveIndicator.className = "";
            }, 2000);
          }
        });
    }, 2500); // Save 2.5 seconds after user stops typing
  }

  // Auto-save on input for file_system panel and report file_system
  // Removed old fileSystemPanelEditor listener since CodeMirror's updateListener handles it

  /* ═══════════════════════════════════════════
       VERSION HISTORY SYSTEM (via VersionManager)
       ═══════════════════════════════════════════ */
  window.VersionManager.init({
    getChatId: () => currentChatId,
    getFileSystemId: () => currentFileSystemId,
    getWorkspaceId: () => currentFileSystemWorkspaceId,
    onRestoreContent: (newContent) => {
      currentFileSystemContentRaw = newContent;
      if (window.fileSystemEditor) {
        window.fileSystemEditor.dispatch({
          changes: {
            from: 0,
            to: window.fileSystemEditor.state.doc.length,
            insert: currentFileSystemContentRaw,
          },
        });
      }
    },
    refreshSidebar: () => {
      if (currentChatId) fetchFileSystems(currentChatId);
    }
  });

  /* ═══════════════════════════════════════════
       FILE SYSTEM UI INITIALIZATION
       ═══════════════════════════════════════════ */
  window.FileSystemUI.init({
    getActiveFileId: () => currentFileSystemId,
    onFileClick: (id, workspaceId) => loadFileSystem(id, workspaceId),
    onFileDownload: (id, workspaceId) => downloadFileSystem(id, workspaceId),
    onFileDelete: async (id, title, workspaceId) => {
      const confirmed = await showConfirm(
        "Delete Artifact",
        `Are you sure you want to delete "${title}"? This action cannot be undone.`,
        true,
      );
      if (confirmed) {
        await deleteFileSystem(id, workspaceId);
      }
    },
    onContextMenu: (type, id, title, e, workspaceId) => showContextMenu(type, id, title, e, workspaceId)
  });

  /* ═══════════════════════════════════════════
       FILE EXPLORER MODAL INITIALIZATION
       ═══════════════════════════════════════════ */
  window.FileExplorerModal.init({
    getAllFileSystems: () => _allFileSystems,
    getChatId: () => currentChatId,
    fetchFileSystems: fetchFileSystems,
    showAlert: showAlert,
    showPromptModal: showPromptModal,
    setScrollLock: setScrollLock
  });

  /* ═══════════════════════════════════════════
       BROWSER PORTAL INITIALIZATION
       ═══════════════════════════════════════════ */
  window.BrowserPortal.init({
    showAlert: showAlert
  });

  /* ═══════════════════════════════════════════
       BROWSER STEALTH INITIALIZATION
       ═══════════════════════════════════════════ */
  window.BrowserStealth.init();

  window.TelemetryChart.init({
    closeSystemSettings: closeSystemSettings
  });

  /* ═══════════════════════════════════════════
       SIDEBAR CONTEXT MENU INITIALIZATION
       ═══════════════════════════════════════════ */
  window.ContextMenu.init({
    renameChat: renameChat,
    deleteChat: deleteChat,
    moveChatToWorkspace: (id, ws) => window.WorkspaceManager.moveChatToWorkspace(id, ws),
    getChatWorkspaces: () => window.WorkspaceManager.getChatWorkspaces(),
    getSavedChats: () => savedChats,
    loadChats: loadChats,
    renderChatList: renderChatList,
    startNewChat: startNewChat,
    renameWorkspace: (id, ev) => window.WorkspaceManager.renameWorkspace(id, ev),
    deleteWorkspace: (id, ev) => window.WorkspaceManager.deleteWorkspace(id, ev),
    showPromptModal: showPromptModal,
    showFileExplorerModal: showFileExplorerModal,
    renameOrMoveFileSystemPath: renameOrMoveFileSystemPath,
    deleteFileSystem: deleteFileSystem,
    deleteFileSystemFolder: deleteFileSystemFolder,
    getIsUserPreferences: () => isUserPreferences,
    getIsResearchMode: () => isResearchMode,
    getSamplingParams: () => samplingParams,
    getCurrentChatId: () => currentChatId
  });

  /* ═══════════════════════════════════════════
       PERSONA MANAGER INITIALIZATION
       ═══════════════════════════════════════════ */
  if (window.PersonaManager) {
    window.PersonaManager.init({
      getChatHistory: () => chatHistory,
      getCurrentChatId: () => currentChatId
    });
  }


/* ═══════════════════════════════════════════
       DOWNLOAD (FileSystem Panel Header)
       ═══════════════════════════════════════════ */

  const fileSystemPanelDownloadBtn = document.getElementById(
    "file-system-panel-download-btn",
  );

  if (fileSystemPanelDownloadBtn) {
    fileSystemPanelDownloadBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!currentFileSystemId) return;

      const orig = fileSystemPanelDownloadBtn.innerHTML;
      fileSystemPanelDownloadBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin-anim"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
      await downloadFileSystem(currentFileSystemId, currentFileSystemWorkspaceId);
      fileSystemPanelDownloadBtn.innerHTML = orig;
    });
  }

  // Close export menu on Escape
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      file_systemExportMenu &&
      !file_systemExportMenu.classList.contains("hidden")
    ) {
      toggleExportMenu(false);
    }
  });

  if (fileSystemPanelResizer) {
    let isResizing = false;
    const minWidth = 200;
    const maxWidth = window.innerWidth * 0.8;

    fileSystemPanelResizer.addEventListener("pointerdown", (e) => {
      isResizing = true;
      document.body.style.cursor = "col-resize";
      fileSystemPanelResizer.classList.add("resizing");
      e.preventDefault();
    });

    document.addEventListener("pointermove", (e) => {
      if (!isResizing) return;
      // The file_system is on the right, so width is (innerWidth - mouseX)
      const width = window.innerWidth - e.clientX;

      if (width > minWidth && width < maxWidth) {
        fileSystemPanel.style.width = `${width}px`;
        // Sync to CSS variable for app-root shrinking
        document.documentElement.style.setProperty(
          "--file-system-panel-width",
          `${width}px`,
        );

        // Scale content based on panel width
        const scale = width / 500; // Reference width of 500px
        const minScale = 0.85;
        const maxScale = 1.1;
        const clampedScale = Math.min(maxScale, Math.max(minScale, scale));
        fileSystemPanel.style.setProperty("--panel-scale", clampedScale);
      }
    });

    document.addEventListener("pointerup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = "";
        fileSystemPanelResizer.classList.remove("resizing");
      }
    });
  }

  window.addEventListener("popstate", (event) => {
    const urlPath = window.location.pathname;
    const urlChatId = urlPath.startsWith("/chat/")
      ? urlPath.replace("/chat/", "")
      : null;
    if (urlChatId) {
      loadChat(urlChatId, false);
    } else {
      startNewChat(false, false);
    }
  });

  // Setup static drag & drop events for the main history list (uncategorized drop zone)
  if (chatHistoryList) {
    chatHistoryList.addEventListener("dragover", (e) => {
      e.preventDefault();
      chatHistoryList.classList.add("drag-over");
    });
    chatHistoryList.addEventListener("dragleave", (e) => {
      e.preventDefault();
      chatHistoryList.classList.remove("drag-over");
    });
    chatHistoryList.addEventListener("drop", async (e) => {
      e.preventDefault();
      chatHistoryList.classList.remove("drag-over");
      const dragChatId = e.dataTransfer.getData("text/plain");
      if (dragChatId) {
        await moveChatToFolder(dragChatId, null);
      }
    });
  }

  // Initialize
  const urlInitPath = window.location.pathname;
  const urlInitChatId = urlInitPath.startsWith("/chat/")
    ? urlInitPath.replace("/chat/", "")
    : null;

  loadChats().then(() => {
    if (urlInitChatId) {
      loadChat(urlInitChatId, false);
    } else {
      startNewChat();
    }
  });

  // → 3D background animation moved to static/js/bg-animation.js

});
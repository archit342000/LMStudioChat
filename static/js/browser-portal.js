/**
 * Luminous Chat — Browser Portal Component (Proxied noVNC)
 * Extracted from script.js
 */

window.BrowserPortal = {
  deps: {
    showAlert: async (title, msg) => {
      if (window.showAlert) return window.showAlert(title, msg);
      alert(`${title}: ${msg}`);
    }
  },

  elements: {},

  init: function(config = {}) {
    this.deps = { ...this.deps, ...config };

    this.elements = {
      portalModal: document.getElementById("browser-portal-modal"),
      openPortalBtn: document.getElementById("open-browser-portal"),
      closePortalBtn: document.getElementById("close-browser-portal"),
      portalIframe: document.getElementById("portal-iframe"),
      portalLoadingOverlay: document.getElementById("portal-loading-overlay"),
      portalErrorOverlay: document.getElementById("portal-error-overlay"),
      portalErrorMessage: document.getElementById("portal-error-message"),
      portalRetryBtn: document.getElementById("portal-retry-btn"),
      portalStatusText: document.getElementById("portal-status-text")
    };

    this.setupListeners();
  },

  setupListeners: function() {
    const { openPortalBtn, closePortalBtn, portalRetryBtn } = this.elements;

    if (openPortalBtn) {
      openPortalBtn.addEventListener("click", () => this.open());
    }

    if (closePortalBtn) {
      closePortalBtn.addEventListener("click", () => this.close());
    }

    if (portalRetryBtn) {
      portalRetryBtn.addEventListener("click", () => this.initBrowserPortal());
    }
  },

  open: function() {
    const { portalModal } = this.elements;
    if (portalModal) {
      portalModal.classList.add("open");
      this.initBrowserPortal();
    }
  },

  close: function() {
    const { portalModal, portalIframe, portalStatusText } = this.elements;
    if (portalModal) {
      portalModal.classList.remove("open");
    }
    if (portalIframe) {
      portalIframe.src = ""; // Disconnect VNC
    }
    if (portalStatusText) {
      portalStatusText.textContent = "Disconnected.";
    }
  },

  initBrowserPortal: async function() {
    const {
      portalLoadingOverlay,
      portalErrorOverlay,
      portalIframe,
      portalStatusText,
      portalErrorMessage
    } = this.elements;

    if (!portalLoadingOverlay || !portalErrorOverlay || !portalIframe || !portalStatusText) {
      return;
    }

    // Show loading, hide error
    portalLoadingOverlay.style.display = "flex";
    portalErrorOverlay.classList.add("hidden");
    portalIframe.src = "";
    portalStatusText.textContent = "Initializing browser session...";

    try {
      // 1. Wait for backend to launch the browser (blocking call)
      const res = await fetch("/api/tools/portal/init", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }

      portalStatusText.textContent = "Connecting to display...";

      // 2. Set the iframe src to our proxied noVNC URL
      //    The `path` param tells noVNC where to open its WebSocket
      portalIframe.src =
        "/api/tools/portal/vnc/vnc.html?autoconnect=true&resize=scale&path=api/tools/portal/ws";

      // 3. Hide loading overlay once iframe loads
      portalIframe.onload = () => {
        portalLoadingOverlay.style.display = "none";
        portalStatusText.textContent = "Connected — interactive live view.";
      };

      // 4. Timeout fallback — if iframe takes too long, assume failure
      setTimeout(() => {
        if (portalLoadingOverlay.style.display !== "none") {
          // Still loading after 15s — hide spinner, show iframe anyway
          // (noVNC may still be connecting internally)
          portalLoadingOverlay.style.display = "none";
          portalStatusText.textContent = "Connected (stream may still be loading).";
        }
      }, 15000);
    } catch (err) {
      console.error("Portal init failed:", err);
      portalLoadingOverlay.style.display = "none";
      portalErrorOverlay.classList.remove("hidden");
      if (portalErrorMessage) {
        portalErrorMessage.textContent = err.message || "Could not reach the browser service.";
      }
      portalStatusText.textContent = "Connection failed.";
    }
  }
};

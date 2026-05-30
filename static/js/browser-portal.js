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
      // Apply full-screen overrides as inline !important, which per the CSS cascade
      // beats any author stylesheet !important (including iOS modal-content overrides).
      // Using 100% instead of viewport units: the backdrop is already position:fixed
      // inset:0 so 100% == full viewport, with no risk of overflow side-effects.
      const wrapper = portalModal.querySelector('.modal-content');
      if (wrapper) {
        wrapper.style.setProperty('width', '100%', 'important');
        wrapper.style.setProperty('max-width', '100%', 'important');
        wrapper.style.setProperty('height', '100%', 'important');
        wrapper.style.setProperty('max-height', '100%', 'important');
        wrapper.style.setProperty('border-radius', '0', 'important');
        wrapper.style.setProperty('border', 'none', 'important');
        wrapper.style.setProperty('margin', '0', 'important');
      }
      this.initBrowserPortal();
    }
  },

  close: function() {
    const { portalModal, portalIframe, portalStatusText } = this.elements;
    if (portalModal) {
      portalModal.classList.remove("open");
      // Remove the inline full-screen overrides so the element reverts to its
      // normal CSS-controlled state. This is critical: while closed the
      // modal-content has transform:scale(0.92) translateY(8px); if height were
      // still 100% that translateY would cause invisible overflow and break
      // iOS scroll on the rest of the page.
      const wrapper = portalModal.querySelector('.modal-content');
      if (wrapper) {
        ['width', 'max-width', 'height', 'max-height', 'border-radius', 'border', 'margin']
          .forEach(p => wrapper.style.removeProperty(p));
      }
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

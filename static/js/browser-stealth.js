/**
 * Luminous Chat — Browser Stealth Configuration Controller
 * Extracted from script.js
 */

window.BrowserStealth = {
  stealthRadios: [],

  init: function() {
    this.stealthRadios = document.querySelectorAll('input[name="stealth-level"]');
    this.setupListeners();
    this.initBrowserStealth();
  },

  setupListeners: function() {
    this.stealthRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.updateBrowserStealth(e.target.value);
        }
      });
    });
  },

  updateBrowserStealth: async function(level) {
    try {
      const res = await fetch("/api/tools/config/browser", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stealth_level: level }),
      });
      if (!res.ok) throw new Error("Failed to update browser stealth config");
      console.log(`Global browser stealth level updated to: ${level}`);
    } catch (err) {
      console.error("Error updating browser stealth:", err);
    }
  },

  initBrowserStealth: async function() {
    try {
      const res = await fetch("/api/tools/config/browser");
      if (res.ok) {
        const data = await res.json();
        this.stealthRadios.forEach((radio) => {
          if (radio.value === data.stealth_level) {
            radio.checked = true;
          }
        });
      }
    } catch (err) {
      console.error("Error fetching browser stealth config:", err);
    }
  }
};

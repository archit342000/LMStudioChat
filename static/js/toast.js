/**
 * Luminous Chat — Toast Notifications
 * Extracted from script.js
 */

window.showToast = function(message, type = "info") {
    // Icons based on type
    const ICONS = {
        success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" stroke-width="2.5"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-rose)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    const icon = ICONS[type] || ICONS.info;

    const toast = document.createElement("div");
    toast.className = "toast-notification";
    
    // Safety fallback if escapeHtml isn't globally available for some reason
    const safeMessage = window.escapeHtml ? window.escapeHtml(message) : message;
    
    toast.innerHTML = `${icon} <span>${safeMessage}</span>`;
    
    document.body.appendChild(toast);
    
    // Trigger reflow for CSS transition
    void toast.offsetWidth;
    
    // Add show class in the next frame to trigger transition
    setTimeout(() => {
        toast.classList.add("show");
    }, 10);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove("show");
        // Remove from DOM after fade out transition (300ms)
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
};

/**
 * Luminous Chat — Shared Icon Utilities
 * Extracted from script.js (Phase 3 refactor).
 */

/**
 * Get a representative SVG icon for a sub-agent based on its name or parent_type.
 * @param {string} agentName 
 * @returns {string} SVG HTML string
 */
function getAgentIcon(agentName) {
    const name = String(agentName || "").toLowerCase();

    // Research Agent
    if (name === "research") {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;
    }
    // File System Agent
    if (name === "file_system_agent") {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;
    }
    // Default / Assistant
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;
}

/* ═══════════════════════════════════════════════════════════════
 *  Workspace Icon Registry — Monochrome SVG Icon Set
 *  All icons use viewBox="0 0 24 24", stroke="currentColor",
 *  stroke-linecap="round", stroke-linejoin="round".
 *
 *  Categories:
 *    General, Work & Productivity, Creative & Media,
 *    Science & Tech, Communication, Nature & Places, Misc
 * ═══════════════════════════════════════════════════════════════ */

window.WORKSPACE_ICONS = {
    // ── General ──────────────────────────────────────────────
    "grid": {
        label: "Grid",
        paths: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    },
    "folder": {
        label: "Folder",
        paths: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    },
    "bookmark": {
        label: "Bookmark",
        paths: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    },
    "star": {
        label: "Star",
        paths: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    },
    "heart": {
        label: "Heart",
        paths: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    },
    "flag": {
        label: "Flag",
        paths: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    },
    "tag": {
        label: "Tag",
        paths: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    },

    // ── Work & Productivity ──────────────────────────────────
    "briefcase": {
        label: "Briefcase",
        paths: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    },
    "clipboard": {
        label: "Clipboard",
        paths: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
    },
    "calendar": {
        label: "Calendar",
        paths: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    },
    "clock": {
        label: "Clock",
        paths: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    },
    "target": {
        label: "Target",
        paths: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    },
    "bar-chart": {
        label: "Chart",
        paths: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    },

    // ── Creative & Media ─────────────────────────────────────
    "pen-tool": {
        label: "Design",
        paths: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
    },
    "image": {
        label: "Image",
        paths: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    },
    "music": {
        label: "Music",
        paths: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    },
    "film": {
        label: "Film",
        paths: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/>',
    },
    "edit": {
        label: "Write",
        paths: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    },

    // ── Science & Tech ───────────────────────────────────────
    "code": {
        label: "Code",
        paths: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    },
    "terminal": {
        label: "Terminal",
        paths: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    },
    "cpu": {
        label: "CPU",
        paths: '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
    },
    "database": {
        label: "Database",
        paths: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    },
    "flask": {
        label: "Science",
        paths: '<path d="M9 3h6"/><path d="M10 3v7.4a2 2 0 0 1-.6 1.4L4 17.2a2 2 0 0 0-.6 1.4V20a2 2 0 0 0 2 2h13.2a2 2 0 0 0 2-2v-1.4a2 2 0 0 0-.6-1.4L14.6 11.8a2 2 0 0 1-.6-1.4V3"/>',
    },
    "brain": {
        label: "Brain",
        paths: '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/>',
    },
    "zap": {
        label: "Lightning",
        paths: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    },

    // ── Communication ────────────────────────────────────────
    "message-circle": {
        label: "Chat",
        paths: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    },
    "mail": {
        label: "Mail",
        paths: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    },
    "users": {
        label: "Team",
        paths: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    },
    "user": {
        label: "Person",
        paths: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    },

    // ── Nature & Places ──────────────────────────────────────
    "globe": {
        label: "Globe",
        paths: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    },
    "home": {
        label: "Home",
        paths: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    },
    "sun": {
        label: "Sun",
        paths: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    },
    "leaf": {
        label: "Leaf",
        paths: '<path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 20 2 20 2s-2.9 4.5-4.9 10.1A7 7 0 0 1 11 20z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    },

    // ── Misc & Symbols ───────────────────────────────────────
    "lock": {
        label: "Lock",
        paths: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    },
    "shield": {
        label: "Shield",
        paths: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    },
    "rocket": {
        label: "Rocket",
        paths: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    },
    "compass": {
        label: "Compass",
        paths: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    },
    "book-open": {
        label: "Book",
        paths: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    },
    "layers": {
        label: "Layers",
        paths: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    },
    "settings": {
        label: "Settings",
        paths: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    },
    "lightbulb": {
        label: "Idea",
        paths: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
    },
    "search": {
        label: "Search",
        paths: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    },
};

/**
 * Returns the full SVG markup for a workspace icon key.
 * Falls back to the default "grid" icon for unknown keys.
 *
 * @param {string} key      - The icon registry key (e.g. "code", "brain").
 * @param {number} [size=24] - Width/height of the rendered SVG.
 * @param {string} [strokeColor="currentColor"] - SVG stroke colour.
 * @param {number} [strokeWidth=2] - SVG stroke width.
 * @returns {string} Complete <svg> markup string.
 */
window.getWorkspaceIconSvg = function(key, size = 24, strokeColor = "currentColor", strokeWidth = 2) {
    const icon = window.WORKSPACE_ICONS[key] || window.WORKSPACE_ICONS["grid"];
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${icon.paths}</svg>`;
};

/**
 * Returns the HTML markup (SVG or text span) for a workspace icon key.
 * Falls back to default folder icon if empty.
 *
 * @param {string} iconKey  - The icon registry key or emoji.
 * @param {number} [size=18] - Size in pixels.
 * @param {string} [strokeColor="currentColor"] - SVG stroke color.
 * @param {number} [strokeWidth=2.5] - SVG stroke width.
 * @returns {string} HTML string.
 */
window.getWorkspaceIconHtml = function(iconKey, size = 18, strokeColor = "currentColor", strokeWidth = 2.5) {
    if (!iconKey) {
        // Default 4-rect Grid SVG
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
    }
    if (window.WORKSPACE_ICONS && window.WORKSPACE_ICONS[iconKey]) {
        return window.getWorkspaceIconSvg(iconKey, size, strokeColor, strokeWidth);
    }
    // Else it might be an emoji / legacy symbol
    return `<span style="font-size: ${size * 0.8}px; width: ${size}px; height: ${size}px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;">${iconKey}</span>`;
};

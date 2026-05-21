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

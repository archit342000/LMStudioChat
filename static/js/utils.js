/**
 * Luminous Chat — Shared Utility Functions
 * Extracted from script.js (Phase 2 refactor).
 * All functions are pure / dependency-free and declared at global scope.
 * Load order: utils.js → bg-animation.js → script.js
 */

// ---------------------------------------------------------------------------
// Environment / Device Detection
// ---------------------------------------------------------------------------

function isMobileOrTouchDevice() {
    return window.innerWidth <= 1024 ||
        ("ontouchstart" in window) ||
        (navigator.maxTouchPoints > 0);
}

// ---------------------------------------------------------------------------
// String / Encoding Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Message Content Helpers
// ---------------------------------------------------------------------------

function getAssistantFriendlyContent(message) {
    let content = message.content || '';
    if (Array.isArray(content)) {
        content = content.find(c => c.type === 'text')?.text || '';
    }
    if (content && content.trim()) return content;
    return '';
}

// ---------------------------------------------------------------------------
// File / MIME Helpers
// ---------------------------------------------------------------------------

function getIconClassForMime(mime) {
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('word') || mime.includes('docx')) return 'docx';
    if (mime.includes('txt')) return 'txt';
    if (mime.includes('image')) return 'image';
    if (mime.includes('video')) return 'video';
    if (mime.includes('audio')) return 'audio';
    return 'default';
}

function getIconHtmlForMime(mime) {
    if (mime.includes('pdf')) {
        return `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
    }
    if (mime.includes('docx')) {
        return `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    }
    if (mime.includes('txt')) {
        return `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    }
    if (mime.includes('image')) {
        return `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    }
    if (mime.includes('video')) {
        return `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`;
    }
    if (mime.includes('audio')) {
        return `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
    }
    return `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>`;
}

function formatFileSize(bytes) {
    if (bytes === undefined || bytes === null) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ---------------------------------------------------------------------------
// Content Parsing
// ---------------------------------------------------------------------------

function parseContent(text) {
    let textStr = text;
    if (!textStr) return { thoughts: '', cleaned: '', plan: null, report: null };
    if (typeof textStr !== 'string') textStr = JSON.stringify(textStr);

    let thoughts = '';
    let cleaned = textStr;
    let plan = null;

    // Extract Thoughts (<think>)
    let thinkStart = cleaned.indexOf('<think>');
    while (thinkStart !== -1) {
        let thinkEnd = cleaned.indexOf('</think>', thinkStart + 7);
        if (thinkEnd !== -1) {
            thoughts += (thoughts ? '\n' : '') + cleaned.substring(thinkStart + 7, thinkEnd);
            cleaned = cleaned.substring(0, thinkStart) + cleaned.substring(thinkEnd + '</think>'.length).trim();
        } else {
            console.warn('[parseContent] Unclosed <think> tag detected; content after tag position will be hidden from the message bubble.');
            thoughts += (thoughts ? '\n' : '') + cleaned.substring(thinkStart + 7);
            cleaned = cleaned.substring(0, thinkStart);
            break;
        }
        thinkStart = cleaned.indexOf('<think>');
    }

    return { thoughts: thoughts.trim(), cleaned: cleaned.trim() };
}

/**
 * Helper to preprocess LaTeX block equations to ensure that display math blocks
 * ($$ ... $$) containing newlines are correctly padded with newlines and isolated on their
 * own paragraph boundaries so marked-katex-extension's blockRule can match them.
 */
function preprocessLatex(text) {
    if (!text) return text;
    return text.replace(/\$\$(.+?)\$\$/gs, (match, content) => {
        if (content.includes('\n')) {
            return `\n\n$$\n${content.trim()}\n$$\n\n`;
        }
        return match;
    });
}

// ---------------------------------------------------------------------------
// Markdown / HTML Rendering
// ---------------------------------------------------------------------------

/**
 * CENTRAL MARKDOWN RENDERING PIPELINE
 * Converts AI-generated text into safe, interactive HTML.
 * Depends on: marked.js, DOMPurify (loaded as global scripts in index.html)
 */
function formatMarkdown(text) {
    if (!text) return '';
    const textStr = (typeof text === 'string') ? text : (typeof text === 'object' ? JSON.stringify(text) : String(text));

    const { cleaned } = parseContent(textStr);
    let normalized = cleaned.replace(/\\n(?![a-zA-Z])/g, '\n');
    normalized = preprocessLatex(normalized);

    const trimmed = normalized.trim();

    if (trimmed.startsWith('<') && (trimmed.includes('</') || trimmed.endsWith('/>'))) {
        if (!trimmed.startsWith('```')) {
            normalized = '```xml\n' + normalized + '\n```';
        }
    }

    let html;
    if (typeof marked !== 'undefined') {
        html = marked.parse(normalized, { breaks: true });
    } else {
        html = normalized.replace(/\n/g, '<br>');
    }

    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true, mathMl: true, svg: true },
            ADD_ATTR: ['target', 'aria-hidden', 'xmlns', 'encoding']
        });
    }

    console.error('DOMPurify unavailable. Using defensive escaping.');
    const escapeDiv = document.createElement('div');
    escapeDiv.textContent = html;
    return `<pre style="white-space:pre-wrap;word-break:break-word">${escapeDiv.innerHTML}</pre>`;
}

window.renderMermaidBlocks = function() {
    if (typeof mermaid !== 'undefined') {
        try {
            mermaid.run({ querySelector: '.mermaid' });
        } catch (e) {
            console.warn("Mermaid rendering failed or no elements found.", e);
        }
    }
};

// ---------------------------------------------------------------------------
// Timestamp Helpers
// ---------------------------------------------------------------------------

function parseChatTimestamp(ts) {
    if (!ts) return null;
    const num = parseFloat(ts);
    if (isNaN(num)) return new Date(ts);
    return new Date(num < 1000000000000 ? num * 1000 : num);
}


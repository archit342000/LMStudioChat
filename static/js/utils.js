/**
 * Luminous Chat — Shared Utility Functions
 * Extracted from script.js (Phase 2 refactor).
 * All functions are pure / dependency-free and declared at global scope.
 * Load order: utils.js → bg-animation.js → script.js
 */

// Global modal placeholders
window.closeMermaidModal = function() {};

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
            const runPromise = mermaid.run({ querySelector: '.mermaid' });
            Promise.resolve(runPromise).then(() => {
                setTimeout(() => {
                    const containers = document.querySelectorAll('.mermaid-wrapper-container');
                    containers.forEach(container => {
                        if (!container.dataset.mermaidInitialized) {
                            container.dataset.mermaidInitialized = 'true';
                            initMermaidZoomPan(container);
                        }
                    });
                }, 100);
            }).catch(err => {
                console.warn("Mermaid run promise rejected:", err);
            });
        } catch (e) {
            console.warn("Mermaid rendering failed or no elements found.", e);
        }
    }
};

function bindMermaidButton(btn, action) {
    if (!btn) return;
    btn.ontouchend = (e) => {
        e.preventDefault();
        e.stopPropagation();
        action();
    };
    btn.onclick = (e) => {
        e.stopPropagation();
        action();
    };
}

function initMermaidZoomPan(container) {
    const viewport = container.querySelector('.mermaid-pan-viewport');
    const pre = container.querySelector('pre.mermaid');
    const zoomInBtn = container.querySelector('.zoom-in-btn');
    const zoomOutBtn = container.querySelector('.zoom-out-btn');
    const zoomResetBtn = container.querySelector('.zoom-reset-btn');
    const zoomPopoutBtn = container.querySelector('.zoom-popout-btn');

    if (!viewport || !pre) return;

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    function applyTransform() {
        pre.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    // Apply the initial scale (1 is default, forced to fit via CSS)
    applyTransform();

    function zoomIn() {
        scale = Math.min(scale + 0.15, 4);
        applyTransform();
    }

    function zoomOut() {
        scale = Math.max(scale - 0.15, 0.1);
        applyTransform();
    }

    function reset() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
    }

    bindMermaidButton(zoomInBtn, zoomIn);
    bindMermaidButton(zoomOutBtn, zoomOut);
    bindMermaidButton(zoomResetBtn, reset);
    bindMermaidButton(zoomPopoutBtn, () => {
        let svgHtml = "";
        const svg = pre.querySelector('svg');
        if (svg) {
            svgHtml = svg.outerHTML;
        } else if (pre.innerHTML && pre.innerHTML.includes('<svg')) {
            svgHtml = pre.innerHTML;
        }

        if (svgHtml) {
            window.openMermaidModal(svgHtml);
        } else {
            console.warn("No SVG element or markup found in mermaid pre block");
            if (window.showToast) {
                window.showToast("Unable to open viewer: Mermaid SVG not found.", "warning");
            }
        }
    });

    // Mouse Drag to Pan
    viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left click
        isPanning = true;
        viewport.classList.add('panning');
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
    });

    window.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            viewport.classList.remove('panning');
        }
    });

    // Touch support
    let touchStartX = 0;
    let touchStartY = 0;
    viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isPanning = true;
            touchStartX = e.touches[0].clientX - translateX;
            touchStartY = e.touches[0].clientY - translateY;
        }
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
        if (!isPanning || e.touches.length !== 1) return;
        translateX = e.touches[0].clientX - touchStartX;
        translateY = e.touches[0].clientY - touchStartY;
        applyTransform();
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
        isPanning = false;
    });

    // Scroll wheel zoom (only with Ctrl key to not hijack page scrolling)
    viewport.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const zoomFactor = 0.05;
            if (e.deltaY < 0) {
                scale = Math.min(scale + zoomFactor, 4);
            } else {
                scale = Math.max(scale - zoomFactor, 0.4);
            }
            applyTransform();
        }
    }, { passive: false });
}

window.openMermaidModal = function(svgHtml) {
    const modal = document.getElementById('mermaid-modal');
    const modalBody = document.getElementById('mermaid-modal-body');
    if (!modal || !modalBody) {
        console.error("Mermaid modal or body element not found in DOM.");
        if (window.showToast) {
            window.showToast("Unable to open viewer: Modal element is missing from the page. Please reload.", "error");
        }
        return;
    }

    modalBody.innerHTML = `<pre class="mermaid-modal-content" style="margin:0; padding:0; background:transparent; border:none; display:flex; align-items:center; justify-content:center; transform-origin:center center; width:100%; height:100%; transition:transform 0.1s ease-out;">${svgHtml}</pre>`;
    const pre = modalBody.querySelector('.mermaid-modal-content');

    const svg = pre.querySelector('svg');
    if (svg) {
        svg.style.maxWidth = 'none';
        svg.style.maxHeight = 'none';
        svg.style.pointerEvents = 'none';
    }

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.add('open');

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    function applyTransform() {
        pre.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    // Apply the initial scale (1 is default, forced to fit via CSS)
    applyTransform();

    function zoomIn() {
        scale = Math.min(scale + 0.2, 8);
        applyTransform();
    }

    function zoomOut() {
        scale = Math.max(scale - 0.2, 0.05);
        applyTransform();
    }

    function reset() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
    }

    bindMermaidButton(document.getElementById('mermaid-modal-zoom-in'), zoomIn);
    bindMermaidButton(document.getElementById('mermaid-modal-zoom-out'), zoomOut);
    bindMermaidButton(document.getElementById('mermaid-modal-zoom-reset'), reset);
    bindMermaidButton(document.getElementById('close-mermaid-modal'), () => window.closeMermaidModal());
    bindMermaidButton(modal, () => window.closeMermaidModal());

    modalBody.onmousedown = function(e) {
        if (e.button !== 0) return;
        isPanning = true;
        modalBody.classList.add('panning');
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        e.preventDefault();
    };

    const mouseMoveHandler = function(e) {
        if (!isPanning) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
    };

    const mouseUpHandler = function() {
        if (isPanning) {
            isPanning = false;
            modalBody.classList.remove('panning');
        }
    };

    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);

    // Touch support for mobile panning and pinch-to-zoom
    let touchStartX = 0;
    let touchStartY = 0;
    let initialDistance = 0;
    let initialMidX = 0;
    let initialMidY = 0;
    let startScale = 1;
    let startTranslateX = 0;
    let startTranslateY = 0;
    let touchMode = 'none'; // 'none', 'pan', 'pinch'

    const touchStartHandler = function(e) {
        if (e.touches.length === 1) {
            touchMode = 'pan';
            isPanning = true;
            touchStartX = e.touches[0].clientX - translateX;
            touchStartY = e.touches[0].clientY - translateY;
        } else if (e.touches.length === 2) {
            touchMode = 'pinch';
            isPanning = false;
            initialDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            initialMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            startScale = scale;
            startTranslateX = translateX;
            startTranslateY = translateY;
        }
    };

    const touchMoveHandler = function(e) {
        if (touchMode === 'pan' && e.touches.length === 1) {
            if (e.cancelable) e.preventDefault();
            translateX = e.touches[0].clientX - touchStartX;
            translateY = e.touches[0].clientY - touchStartY;
            applyTransform();
        } else if (touchMode === 'pinch' && e.touches.length === 2) {
            if (e.cancelable) e.preventDefault();
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const currentMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

            if (initialDistance > 0) {
                const factor = currentDistance / initialDistance;
                scale = Math.min(Math.max(startScale * factor, 0.2), 8);
                translateX = startTranslateX + (currentMidX - initialMidX);
                translateY = startTranslateY + (currentMidY - initialMidY);
                applyTransform();
            }
        }
    };

    const touchEndHandler = function(e) {
        if (e.touches.length === 0) {
            touchMode = 'none';
            isPanning = false;
        } else if (e.touches.length === 1 && touchMode === 'pinch') {
            touchMode = 'pan';
            isPanning = true;
            touchStartX = e.touches[0].clientX - translateX;
            touchStartY = e.touches[0].clientY - translateY;
        }
    };

    modalBody.addEventListener('touchstart', touchStartHandler, { passive: true });
    modalBody.addEventListener('touchmove', touchMoveHandler, { passive: false });
    modalBody.addEventListener('touchend', touchEndHandler, { passive: true });

    window.closeMermaidModal = function() {
        modal.classList.remove('open');
        setTimeout(() => {
            modal.classList.add('hidden');
            modalBody.innerHTML = '';
        }, 300);
        window.removeEventListener('mousemove', mouseMoveHandler);
        window.removeEventListener('mouseup', mouseUpHandler);
        modalBody.removeEventListener('touchstart', touchStartHandler);
        modalBody.removeEventListener('touchmove', touchMoveHandler);
        modalBody.removeEventListener('touchend', touchEndHandler);
    };

    modalBody.onwheel = function(e) {
        e.preventDefault();
        const zoomFactor = 0.08;
        if (e.deltaY < 0) {
            scale = Math.min(scale + zoomFactor, 8);
        } else {
            scale = Math.max(scale - zoomFactor, 0.2);
        }
        applyTransform();
    };
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

// ---------------------------------------------------------------------------
// Inline Badge Input Helpers
// ---------------------------------------------------------------------------

function makeBadgeEditable(badgeElement, sliderElement, onUpdateCallback) {
    if (!badgeElement || !sliderElement) return;

    badgeElement.classList.add("badge-interactive");
    badgeElement.title = "Click to enter value";

    badgeElement.addEventListener("click", function () {
        if (badgeElement.querySelector("input")) return;

        const currentVal = parseInt(sliderElement.value);

        const input = document.createElement("input");
        input.type = "number";
        input.className = "badge-input";
        input.value = currentVal;
        input.min = sliderElement.min || 0;
        input.max = sliderElement.max || 32768;
        input.step = sliderElement.step || 1;

        badgeElement.textContent = "";
        badgeElement.appendChild(input);
        input.focus();
        input.select();

        let finished = false;

        function finishEdit(save) {
            if (finished) return;
            finished = true;

            let finalVal = currentVal;
            if (save) {
                const parsedVal = parseInt(input.value);
                if (!isNaN(parsedVal)) {
                    const min = parseInt(input.min);
                    const max = parseInt(input.max);
                    finalVal = Math.max(min, Math.min(max, parsedVal));
                }
            }

            badgeElement.textContent = finalVal;

            if (save && finalVal !== currentVal) {
                sliderElement.value = finalVal;
                sliderElement.dispatchEvent(new Event("input", { bubbles: true }));
                sliderElement.dispatchEvent(new Event("change", { bubbles: true }));
                if (typeof onUpdateCallback === "function") {
                    onUpdateCallback(finalVal);
                }
            }
        }

        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                finishEdit(true);
            } else if (e.key === "Escape") {
                finishEdit(false);
            }
        });

        input.addEventListener("blur", function () {
            finishEdit(true);
        });
    });
}



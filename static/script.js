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
   * 0. Environment Detection
   * Identifies if the user is on a touch device to adapt UI interactions
   * (e.g., hover states, drag-and-drop behavior).
   */
  document.addEventListener(
    "touchstart",
    function onFirstTouch() {
      document.body.classList.add("is-touch-device");
      document.removeEventListener("touchstart", onFirstTouch, false);

      document.addEventListener(
        "mousemove",
        function onFirstMouse() {
          document.body.classList.remove("is-touch-device");
          document.removeEventListener("mousemove", onFirstMouse, false);
          document.addEventListener("touchstart", onFirstTouch, false);
        },
        false,
      );
    },
    false,
  );

  /**
   * 0. Security & Utilities
   * Provides basic obfuscation for sensitive client-side strings and
   * configures the Markdown renderer (marked.js) with syntax highlighting.
   */

  // Configure marked with highlight.js integration for code block rendering
  if (typeof marked !== "undefined" && typeof hljs !== "undefined") {
    const renderer = new marked.Renderer();
    renderer.code = function (code, language) {
      let textVal = code;
      let langVal = language;

      // Handle different marked versions signatures
      if (
        typeof code === "object" &&
        code !== null &&
        typeof code.text === "string"
      ) {
        textVal = code.text;
        langVal = code.lang;
      }

      const validLanguage = hljs.getLanguage(langVal) ? langVal : "plaintext";
      
      if (langVal === 'mermaid') {
        // Escape HTML to prevent DOMPurify from breaking diagram code (like `<` or `>`)
        const escaped = typeof escapeHtml === 'function' ? escapeHtml(textVal) : textVal.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre class="mermaid">${escaped}</pre>`;
      }

      const highlighted = hljs.highlight(textVal, {
        language: validLanguage,
      }).value;
      const encodedCode = typeof escapeHtml === 'function' ? escapeHtml(textVal) : textVal.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return `<div class="code-block-wrapper">
                <div class="code-block-header">
                  <span class="code-block-lang">${validLanguage}</span>
                  <button class="action-btn copy-code-btn" data-code="${encodeURIComponent(textVal)}" title="Copy code">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span>Copy</span>
                  </button>
                </div>
                <pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
              </div>`;
    };

    renderer.image = function(href, title, text) {
      if (typeof href === "object" && href !== null && typeof href.href === "string") {
        text = href.text;
        title = href.title;
        href = href.href;
      }
      
      let out = `<img src="${href}" alt="${text || ''}" class="markdown-image lightbox-img" loading="lazy" ${title ? `title="${title}"` : ''} />`;
      if (title || text) {
        out = `<figure class="markdown-figure">${out}<figcaption class="markdown-caption">${title || text}</figcaption></figure>`;
      }
      return out;
    };

    renderer.blockquote = function(quote) {
      let textVal = quote;
      if (typeof quote === "object" && quote !== null && typeof quote.text === "string") {
        textVal = quote.text;
      }
      
      const match = textVal.match(/^<p>\[!(NOTE|WARNING|IMPORTANT|CAUTION|TIP)\](?:<br>|\n)?([\s\S]*)$/i);
      if (match) {
        const type = match[1].toLowerCase();
        let content = match[2];
        if (content.endsWith('</p>\n')) {
           content = content.slice(0, -5) + '</p>';
        }
        
        const icons = {
          note: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
          warning: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.396A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.557Zm1.763 1.27a.25.25 0 0 0-.44 0L1.698 13.713a.25.25 0 0 0 .22.387h12.164a.25.25 0 0 0 .22-.387Zm0 2.433a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1 0-1.5v-3.5a.75.75 0 0 1 .75-.75Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
          important: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.75.75 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>',
          caution: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
          tip: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.843a5.314 5.314 0 0 1-.675-.848 5.463 5.463 0 0 1-.215-.254C3.176 7.674 2.5 6.641 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.391-.676 2.424-1.248 3.161l-.215.254a5.314 5.314 0 0 1-.675.848c-.207.296-.33.561-.37.843a.75.75 0 0 1-1.484-.21c.084-.594.337-1.079.621-1.49.203-.292.45-.584.673-.848.075-.088.147-.173.214-.253.56-.679.984-1.32.984-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"></path></svg>'
        };

        const icon = icons[type] || icons.note;
        return `<blockquote class="markdown-alert markdown-alert-${type}">
                  <div class="markdown-alert-title">
                      ${icon}
                      <span>${match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()}</span>
                  </div>
                  <div class="markdown-alert-content">${content}</div>
                </blockquote>\n`;
      }
      return `<blockquote>\n${textVal}</blockquote>\n`;
    };
    
    renderer.listitem = function(item) {
      // marked v18: item.text is raw markdown. Must render from item.tokens.
      let textVal;
      if (item.tokens && this.parser) {
        textVal = this.parser.parse(item.tokens, !!item.loose);
      } else {
        textVal = item.text;
      }

      if (item.task) {
        // For task items, render inline to avoid paragraph wrapping
        let taskContent;
        if (item.tokens && this.parser) {
          taskContent = this.parser.parseInline(item.tokens);
        } else {
          taskContent = item.text;
        }
        return `<li class="task-list-item" style="list-style-type: none; margin-left: -1.5rem; display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.25rem;">
                  <input type="checkbox" class="task-list-item-checkbox" ${item.checked ? 'checked' : ''} disabled style="margin-top: 0.25rem;">
                  <span>${taskContent}</span>
                </li>\n`;
      }
      return `<li>${textVal}</li>\n`;
    };

    renderer.link = function(link) {
      let href = link.href;
      let text = link.text;
      if (typeof link === "object" && link !== null && typeof link.href === "string") {
        href = link.href;
        text = link.text;
      }
      
      if (href && !/^https?:\/\//i.test(href) && !href.startsWith('/') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        return `<a href="${href}" class="file-link" data-path="${href}" title="Open file in workspace">${text}</a>`;
      }
      
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    };

    if (marked.use) {
      marked.use({ renderer });
      
      // Advanced Markdown Extensions
      const subscript = {
        name: 'subscript',
        level: 'inline',
        start(src) { return src.match(/~(?=\S)/)?.index; },
        tokenizer(src, tokens) {
          const rule = /^~((?:\\.|[^~])+)~/;
          const match = rule.exec(src);
          if (match) {
            return {
              type: 'subscript',
              raw: match[0],
              text: match[1],
              tokens: this.lexer.inlineTokens(match[1])
            };
          }
        },
        renderer(token) {
          return `<sub>${this.parser.parseInline(token.tokens)}</sub>`;
        }
      };

      const superscript = {
        name: 'superscript',
        level: 'inline',
        start(src) { return src.match(/\^(?=\S)/)?.index; },
        tokenizer(src, tokens) {
          const rule = /^\^((?:\\.|[^\^])+)\^/;
          const match = rule.exec(src);
          if (match) {
            return {
              type: 'superscript',
              raw: match[0],
              text: match[1],
              tokens: this.lexer.inlineTokens(match[1])
            };
          }
        },
        renderer(token) {
          return `<sup>${this.parser.parseInline(token.tokens)}</sup>`;
        }
      };

      const strikethrough = {
        name: 'strikethrough',
        level: 'inline',
        start(src) { return src.match(/~~(?=\S)/)?.index; },
        tokenizer(src, tokens) {
          const rule = /^~~((?:\\.|[^~])+)~~/;
          const match = rule.exec(src);
          if (match) {
            return {
              type: 'strikethrough',
              raw: match[0],
              text: match[1],
              tokens: this.lexer.inlineTokens(match[1])
            };
          }
        },
        renderer(token) {
          return `<del>${this.parser.parseInline(token.tokens)}</del>`;
        }
      };

      marked.use({ extensions: [subscript, superscript, strikethrough] });

      if (typeof markedFootnote !== 'undefined') {
        marked.use(markedFootnote());
      }

      // Add KaTeX extension
      if (typeof markedKatex !== 'undefined') {
        marked.use(markedKatex({
            throwOnError: false,
            nonStandard: true
        }));
      }
    } else {
      marked.setOptions({ renderer });
    }
  }

  // Basic XOR-based XOR encryption for client-side storage obfuscation
  const salt = "luminous-v30-secure-core";
  const e = (t) =>
    btoa(
      t
        .split("")
        .map((c, i) =>
          String.fromCharCode(
            c.charCodeAt(0) ^ salt.charCodeAt(i % salt.length),
          ),
        )
        .join(""),
    );
  const d = (t) => {
    try {
      return atob(t)
        .split("")
        .map((c, i) =>
          String.fromCharCode(
            c.charCodeAt(0) ^ salt.charCodeAt(i % salt.length),
          ),
        )
        .join("");
    } catch (e) {
      return "";
    }
  };

  /**
   * Scroll Lock Utility (Safari/iOS Fix)
   * Prevents the background body from scrolling when a modal or
   * expanded thought process is active.
   */
  let _scrollLockY = 0;

  function setScrollLock(isLocked) {
    if (isLocked) {
      _scrollLockY = window.scrollY || window.pageYOffset;
      document.body.classList.add("no-scroll");
      document.body.style.top = `-${_scrollLockY}px`;
    } else {
      // Check if any other locking elements are still open
      const anyModalsOpen = document.querySelector(".modal-backdrop.open");
      const anyThoughtsExpanded = document.querySelector(
        ".thought-container.expanded, .thought-box.expanded",
      );
      if (!anyModalsOpen && !anyThoughtsExpanded) {
        document.body.classList.remove("no-scroll");
        document.body.style.top = "";
        window.scrollTo(0, _scrollLockY);
      }
    }
  }

  /**
   * Sanitizes a file/folder path for frontend use.
   */
  function sanitizePath(path) {
    if (!path) return "";
    // Remove leading/trailing slashes
    path = path.replace(/^\/+|\/+$/g, "");
    // Split into segments
    const parts = path.split("/");
    const safeParts = [];
    for (const part of parts) {
      if (part === ".." || part === ".") continue;
      // Allow letters, numbers, underscores, dashes, dots, and spaces
      const safePart = part.replace(/[^\w\s\-.]/g, "_").trim();
      if (safePart) safeParts.push(safePart);
    }
    return safeParts.join("/");
  }


  /**
   * 0.1 Modular API Registry
   * Standardized prefixes for the backend's modular Blueprint architecture.
   */
  const API_BASE = "/api";
  const API_MODULES = {
    CHATS: `${API_BASE}/chats`,
    TOOLS: `${API_BASE}/tools`,
    FILE_SYSTEMS: `${API_BASE}/file_systems`,
    FILES: `${API_BASE}/files`,
    MODELS: `${API_BASE}/models`,
    LOGS: `${API_BASE}/logs`,
  };

  /**
   * Tool Display Configuration
   * Maps internal tool names to user-friendly labels and icons.
   */
  const TOOL_DISPLAY_CONFIG = {
    grep_search: {
      name: "Search Code",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
    },
    read_file: {
      name: "Read File",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
    },
    write_file: {
      name: "Save File",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>',
    },
    run_shell_command: {
      name: "Terminal",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>',
    },
    list_directory: {
      name: "List Files",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
    },
    glob: {
      name: "Find Files",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    },
    replace: {
      name: "Edit File",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    },
    web_fetch: {
      name: "Fetch URL",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    },
    google_web_search: {
      name: "Google Search",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    },
    search_web: {
      name: "Web Search",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    },
    request_clarification: {
      name: "Question",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    },
    update_topic: {
      name: "Context Update",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
    },
    enter_plan_mode: {
      name: "Planning",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>',
    },
    exit_plan_mode: {
      name: "End Plan",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg>',
    },
    invoke_agent: {
      name: "Delegate",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    },
    manage_user_preferences: {
      name: "Preferences",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    },
    visit_page_tool: {
      name: "Visit Page",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    },
    get_time: {
      name: "Get Time",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    },
    create_fs_file: {
      name: "Create FileSystem",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>',
    },
    list_file_systems: {
      name: "List FileSystems",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
    },
    grep_files: {
      name: "Search FileSystems",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    },
    read_fs_file: {
      name: "Read FileSystem",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    },
    edit_file_system: {
      name: "Edit FileSystem",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
    },
    patch_file_system: {
      name: "Patch FileSystem",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
    },
    manage_task_list: {
      name: "Tasks",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
    },
    research: {
      name: "Research",
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    },
  };

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
  const stealthRadios = document.querySelectorAll(
    'input[name="stealth-level"]',
  );
  // Test Model Speed Diagnostic Tool
  const sysTestModelSpeedBtn = document.getElementById("sys-test-model-speed");
  const testModelSpeedModal = document.getElementById("test-model-speed-modal");
  const closeTestModelSpeedBtn = document.getElementById(
    "close-test-model-speed",
  );

  // Agent Configuration Modal
  const agentConfigModal = document.getElementById("agent-config-modal");
  const closeAgentConfigBtn = document.getElementById("close-agent-config");
  const agentConfigBtns = document.querySelectorAll(".agent-config-btn");
  const agentConfigTitle = document.getElementById("agent-config-title");
  const agentThinkingProfileSelector = document.getElementById("agent-thinking-profile-selector");
  const agentMaxTokensSlider = document.getElementById("agent-max-tokens-slider");
  const agentMaxTokensVal = document.getElementById("agent-max-tokens-val");
  const agentThinkingBudgetSlider = document.getElementById("agent-thinking-budget-slider");
  const agentThinkingBudgetVal = document.getElementById("agent-thinking-budget-val");
  const saveAgentConfigBtn = document.getElementById("save-agent-config");

  let currentEditingAgent = null;
  let agentsConfig = {};
  const runTestModelSpeedBtn = document.getElementById("run-model-speed-test");
  const testSpeedModelSelect = document.getElementById(
    "test-speed-model-select",
  );
  const testSpeedContextSlider = document.getElementById(
    "test-speed-context-slider",
  );
  const testSpeedContextVal = document.getElementById("test-speed-context-val");

  // Telemetry Dashboard
  const telemetryDashboardModal = document.getElementById(
    "telemetry-dashboard-modal",
  );
  const closeTelemetryDashboardBtn = document.getElementById(
    "close-telemetry-dashboard",
  );
  const telemetryModelName = document.getElementById("telemetry-model-name");
  const telemetryChartFileSystem = document.getElementById("telemetry-chart");
  const testSpeedStatus = document.getElementById("test-speed-status");
  const testSpeedTokensGen = document.getElementById("test-speed-tokens-gen");
  const testSpeedTtft = document.getElementById("test-speed-ttft");
  const testSpeedPrefillTps = document.getElementById("test-speed-prefill-tps");
  const testSpeedCurrentTps = document.getElementById("test-speed-current-tps");

  // User Preferences (Preferences FileSystem Interface)
  const sysManagePreferencesBtn = document.getElementById(
    "sys-manage-preferences",
  );

  const preferencesFileSystemOverlay = document.getElementById(
    "preferences-file-system-overlay",
  );
  const closePreferencesBtn = document.getElementById("close-preferences-btn");
  const preferencesAddBtn = document.getElementById("preferences-add-fab");
  const preferencesListContainer = document.getElementById(
    "preferences-list-container",
  );
  const preferencesSearchInput = document.getElementById(
    "preferences-search-input",
  );
  const preferencesFilterSelect = document.getElementById(
    "preferences-filter-select",
  );
  const preferencesSortSelect = document.getElementById(
    "preferences-sort-select",
  );

  // Unified Model & Sampling Settings
  const settingsTrigger = document.getElementById("settings-trigger");
  const settingsModal = document.getElementById("settings-modal");
  const closeSettingsBtn = document.getElementById("close-settings");
  const closeSettingsActionBtn = document.getElementById("close-settings-btn");
  const tabItems = document.querySelectorAll(".tab-item");
  const tabContents = document.querySelectorAll(".tab-content");

  // Persona Management UI
  const personaListView = document.getElementById("persona-list-view");
  const personaListContainer = document.getElementById("persona-list-container");
  const personaEditView = document.getElementById("persona-edit-view");
  const personaIdInput = document.getElementById("persona-id-input");
  const personaNameInput = document.getElementById("persona-name-input");
  const personaContentInput = document.getElementById("persona-content-input");
  const personaDefaultCheckbox = document.getElementById("persona-default-checkbox");
  const newPersonaBtn = document.getElementById("new-persona-btn");
  const cancelPersonaBtn = document.getElementById("cancel-persona-btn");
  const savePersonaBtn = document.getElementById("save-persona-btn");

  // --- Persona Management Logic ---

  async function fetchPersonas() {
    try {
      const response = await fetch('/api/personas');
      const data = await response.json();
      if (data.success) {
        personas = data.personas;
        
        // Ensure default is selected if no chat is active
        if (!currentChatId && !selectedPersonaId) {
          const defaultPersona = personas.find(p => p.is_default);
          if (defaultPersona) {
            selectedPersonaId = defaultPersona.id;
          }
        }
        
        renderPersonas();
      }
    } catch (error) {
      console.error("Error fetching personas:", error);
    }
  }

  function renderPersonas() {
    if (!personaListContainer) return;
    
    if (personas.length === 0) {
      personaListContainer.innerHTML = '<div style="color: var(--content-muted); font-size: 0.85rem; text-align: center; padding: 2rem;">No personas created yet. Click + to create one.</div>';
      return;
    }

    personaListContainer.innerHTML = '';
    
    personas.forEach(persona => {
      const isSelected = selectedPersonaId === persona.id;
      const chatStarted = chatHistory.length > 0;
      
      const item = document.createElement('div');
      item.className = `persona-item ${isSelected ? 'selected' : ''}`;
      
      if (chatStarted && !isSelected) {
        item.style.opacity = '0.4';
        item.style.pointerEvents = 'none';
        item.style.filter = 'grayscale(1)';
      }

      const header = document.createElement('div');
      header.className = 'persona-name';
      
      const title = document.createElement('span');
      title.style.flex = '1';
      title.textContent = persona.name;
      header.appendChild(title);
      
      if (persona.is_default) {
        const badge = document.createElement('span');
        badge.className = 'persona-badge';
        badge.textContent = 'Default';
        header.appendChild(badge);
      }
      
      const actions = document.createElement('div');
      actions.className = 'persona-actions';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'persona-action-btn';
      editBtn.title = 'Edit Persona';
      editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        openEditPersona(persona);
      };
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'persona-action-btn delete';
      deleteBtn.title = 'Delete Persona';
      deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirm("Delete Persona", `Are you sure you want to delete "${persona.name}"?`, true);
        if (confirmed) {
          try {
            await fetch(`/api/personas/${persona.id}`, { method: 'DELETE' });
            if (selectedPersonaId === persona.id) selectedPersonaId = null;
            await fetchPersonas();
          } catch(err) { console.error(err); }
        }
      };

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(header);
      item.appendChild(actions);
      
      item.onclick = () => {
        if (chatHistory.length === 0) {
          selectedPersonaId = selectedPersonaId === persona.id ? null : persona.id;
          renderPersonas();
        }
      };

      personaListContainer.appendChild(item);
    });
  }

  function openEditPersona(persona = null) {
    personaListView.classList.add('hidden');
    personaEditView.classList.remove('hidden');
    newPersonaBtn.style.display = 'none';

    if (persona) {
      personaIdInput.value = persona.id;
      personaNameInput.value = persona.name;
      personaContentInput.value = persona.content;
      personaDefaultCheckbox.checked = persona.is_default === 1;
    } else {
      personaIdInput.value = '';
      personaNameInput.value = '';
      personaContentInput.value = '';
      personaDefaultCheckbox.checked = false;
    }
  }

  function closeEditPersona() {
    personaListView.classList.remove('hidden');
    personaEditView.classList.add('hidden');
    newPersonaBtn.style.display = 'flex';
  }

  if (newPersonaBtn) newPersonaBtn.addEventListener('click', () => openEditPersona());
  if (cancelPersonaBtn) cancelPersonaBtn.addEventListener('click', closeEditPersona);
  if (savePersonaBtn) {
    savePersonaBtn.addEventListener('click', async () => {
      const id = personaIdInput.value;
      const name = personaNameInput.value.trim();
      const content = personaContentInput.value.trim();
      const is_default = personaDefaultCheckbox.checked ? 1 : 0;

      if (!name || !content) {
        alert("Name and Content are required.");
        return;
      }

      const payload = { name, content, is_default };
      const url = id ? `/api/personas/${id}` : '/api/personas';
      const method = id ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
          closeEditPersona();
          if (is_default) selectedPersonaId = data.persona.id;
          await fetchPersonas();
        } else {
          alert("Failed to save persona: " + data.error);
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // --- End Persona Management ---


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
  // Legacy Research Mode Selector - PRESERVED FOR FUTURE USE (DIRECTIVE M)
  const uiResearchDepthSelector = document.getElementById(
    "research-mode-selector",
  );
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

  // Global CodeMirror Instance
  window.fileSystemEditor = null;
  let _cmThemeCompartment = null;
  let _cmLanguageCompartment = null;
  let _cmReadOnlyCompartment = null;
  let _cmStyleCompartment = null;
  let _cmState = null;
  let _cmView = null;
  let _cmKeymap = null;
  let _cmBasicSetup = null;
  let _cmMarkdown = null;
  let _cmLanguages = null;
  let _cmOneDarkTheme = null;
  let _cmIndentWithTab = null;
  let _cmMarkdownRichText = null;
  let _cmParsers = {};

  // Load CodeMirror 6 Modules
  async function loadCodeMirror() {
    try {
      // Load via locally compiled esbuild bundle to guarantee a single unified dependencies graph
      // and eliminate network module resolution bugs (e.g. esm.sh timeouts and 400 errors).
      const deps = await import("/js/cm6.bundle.js");

      const { EditorState, Compartment } = deps;
      const { EditorView, keymap, lineNumbers } = deps;
      const { basicSetup } = deps;
      const { markdown, markdownLanguage } = deps;
      const { languages } = deps;
      const { oneDark } = deps;
      const { indentWithTab, python, javascript, html, css, json, cpp } = deps;
      const { HighlightStyle, syntaxHighlighting, tags: t } = deps;

      // Define custom styles for Markdown so it looks like rich text and is monochrome
      const markdownRichText = HighlightStyle.define([
        { tag: t.heading1, fontSize: "1.6em", fontWeight: "bold", color: "inherit" },
        { tag: t.heading2, fontSize: "1.4em", fontWeight: "bold", color: "inherit" },
        { tag: t.heading3, fontSize: "1.2em", fontWeight: "bold", color: "inherit" },
        { tag: t.heading4, fontSize: "1.1em", fontWeight: "bold", color: "inherit" },
        { tag: t.heading5, fontSize: "1.0em", fontWeight: "bold", color: "inherit" },
        { tag: t.heading6, fontSize: "0.9em", fontWeight: "bold", color: "inherit" },
        { tag: t.strong, fontWeight: "bold", color: "inherit" },
        { tag: t.emphasis, fontStyle: "italic", color: "inherit" },
        { tag: t.strikethrough, textDecoration: "line-through", color: "inherit" },
        { tag: t.link, color: "inherit", textDecoration: "underline" },
        { tag: t.url, color: "inherit", textDecoration: "underline" },
        {
          tag: t.quote,
          borderLeft: "4px solid var(--border-subtle)",
          paddingLeft: "12px",
          color: "var(--content-muted)",
          fontStyle: "italic",
        },
        { tag: t.list, color: "inherit" },
        { tag: t.monospace, color: "inherit" },
        // Monochrome for code blocks inside markdown
        { tag: t.keyword, color: "inherit" },
        { tag: t.operator, color: "inherit" },
        { tag: t.variableName, color: "inherit" },
        { tag: t.propertyName, color: "inherit" },
        { tag: t.string, color: "inherit" },
        { tag: t.number, color: "inherit" },
        { tag: t.bool, color: "inherit" },
        { tag: t.null, color: "inherit" },
        { tag: t.comment, color: "var(--content-muted)" },
        { tag: t.className, color: "inherit" },
        { tag: t.typeName, color: "inherit" },
        { tag: t.labelName, color: "inherit" },
        { tag: t.atom, color: "inherit" },
        { tag: t.bool, color: "inherit" },
        { tag: t.special(t.variableName), color: "inherit" },
        { tag: t.attributeName, color: "inherit" },
        { tag: t.meta, color: "inherit" },
        { tag: t.processingInstruction, color: "inherit" },
        { tag: t.punctuation, color: "inherit" },
        { tag: t.inserted, color: "inherit" },
        { tag: t.deleted, color: "inherit" },
        { tag: t.changed, color: "inherit" },
      ]);

      _cmState = EditorState;
      _cmView = EditorView;
      _cmKeymap = keymap;
      _cmBasicSetup = basicSetup;
      _cmThemeCompartment = new Compartment();
      _cmLanguageCompartment = new Compartment();
      _cmReadOnlyCompartment = new Compartment();
      _cmStyleCompartment = new Compartment();
      _cmMarkdown = markdown;
      _cmLanguages = languages;
      _cmOneDarkTheme = oneDark;
      _cmIndentWithTab = indentWithTab;
      _cmMarkdownRichText = syntaxHighlighting(markdownRichText);

      _cmParsers = { python, javascript, html, css, json, cpp };

      console.log("CodeMirror 6 loaded successfully from local bundle.");
    } catch (e) {
      console.error("Failed to load CodeMirror 6:", e);
    }
  }

  async function initFileSystemEditor() {
    if (!_cmView || !fileSystemCodemirrorContainer) return;

    const isDark = document.documentElement.classList.contains("dark");
    const themeExtension = isDark ? _cmOneDarkTheme : [];

    // Determine initial language extension - START EMPTY to prevent bleed-over
    let langExt = [];
    let styleExt = [];

    // Define an update listener to sync state back to currentFileSystemContentRaw
    const updateListener = _cmView.updateListener.of((update) => {
      if (update.docChanged) {
        currentFileSystemContentRaw = update.state.doc.toString();

        // Only trigger autosave and version branching if the change was made by the user
        const isUserChange = update.transactions.some(
          (tr) =>
            tr.isUserEvent &&
            (tr.isUserEvent("input") ||
              tr.isUserEvent("delete") ||
              tr.isUserEvent("undo") ||
              tr.isUserEvent("redo") ||
              tr.isUserEvent("paste") ||
              tr.isUserEvent("drop")),
        );

        if (isUserChange) {
          // Handle version branching when editing after navigating
          if (typeof handleVersionEdit === "function") handleVersionEdit();

          // Trigger save Debounce
          if (currentFileSystemId) {
            saveDebounced(currentFileSystemId, currentFileSystemContentRaw);
          }
        }
      }
    });

    const state = _cmState.create({
      doc: currentFileSystemContentRaw || "",
      extensions: [
        _cmBasicSetup,
        _cmThemeCompartment.of(themeExtension),
        _cmLanguageCompartment.of(langExt),
        _cmReadOnlyCompartment.of(_cmState.readOnly.of(false)),
        _cmStyleCompartment.of(styleExt),
        updateListener,
        _cmView.lineWrapping,
        _cmKeymap ? _cmKeymap.of([_cmIndentWithTab]) : [],
      ]
        .flat()
        .filter(Boolean),
    });

    window.fileSystemEditor = new _cmView({
      state,
      parent: fileSystemCodemirrorContainer,
    });

    // Atomic application of initial language
    if (currentFileSystemLanguage) {
      setEditorLanguage(currentFileSystemLanguage);
    }
  }

  function updateEditorTheme(isDark) {
    if (window.fileSystemEditor && _cmThemeCompartment && _cmOneDarkTheme) {
      window.fileSystemEditor.dispatch({
        effects: _cmThemeCompartment.reconfigure(isDark ? _cmOneDarkTheme : []),
      });
    }
  }

  function setEditorReadOnly(isReadOnly) {
    if (window.fileSystemEditor && _cmReadOnlyCompartment && _cmState) {
      window.fileSystemEditor.dispatch({
        effects: _cmReadOnlyCompartment.reconfigure(
          _cmState.readOnly.of(isReadOnly),
        ),
      });
    }
  }

  async function setEditorLanguage(extensionStr) {
    if (!window.fileSystemEditor || !_cmLanguageCompartment || !_cmStyleCompartment)
      return;

    // Step 1: Force UI Reset (Atomic)
    if (fileSystemCodemirrorContainer) {
      fileSystemCodemirrorContainer.classList.remove("is-markdown-mode");
      if (fileSystemCodemirrorContainer.parentElement) {
        fileSystemCodemirrorContainer.parentElement.classList.remove(
          "is-markdown-mode"
        );
      }
    }

    // Step 2: Clear Styles Compartment (Atomic)
    window.fileSystemEditor.dispatch({
      effects: _cmStyleCompartment.reconfigure([]),
    });

    // Step 3: Determine New Parser
    let langExt = [];
    const cleanExt = (extensionStr || "markdown")
      .replace(".", "")
      .toLowerCase();
    const isMarkdown = cleanExt === "markdown" || cleanExt === "md";

    if (isMarkdown) {
      if (_cmMarkdown) langExt = _cmMarkdown({ codeLanguages: _cmLanguages });
    } else if (cleanExt === "python" || cleanExt === "py") {
      if (_cmParsers.python) langExt = _cmParsers.python();
    } else if (
      cleanExt === "javascript" ||
      cleanExt === "js" ||
      cleanExt === "ts" ||
      cleanExt === "typescript"
    ) {
      if (_cmParsers.javascript) langExt = _cmParsers.javascript();
    } else if (cleanExt === "html") {
      if (_cmParsers.html) langExt = _cmParsers.html();
    } else if (cleanExt === "css") {
      if (_cmParsers.css) langExt = _cmParsers.css();
    } else if (cleanExt === "json") {
      if (_cmParsers.json) langExt = _cmParsers.json();
    } else if (cleanExt === "cpp" || cleanExt === "c" || cleanExt === "h") {
      if (_cmParsers.cpp) langExt = _cmParsers.cpp();
    } else {
      // Find language by extension or name
      if (_cmLanguages) {
        const langDesc = _cmLanguages.find(
          (l) =>
            (l.extensions && l.extensions.includes(cleanExt)) ||
            l.name.toLowerCase() === cleanExt,
        );

        if (langDesc) {
          try {
            const langSupport = await langDesc.load();
            langExt = langSupport;
          } catch (e) {
            console.warn(
              `Could not dynamically load language: ${cleanExt}. Defaulting to plain text.`,
              e,
            );
          }
        }
      }
    }

    // Step 4: Apply Language Parser
    window.fileSystemEditor.dispatch({
      effects: _cmLanguageCompartment.reconfigure(langExt),
    });

    // Step 5: (Removed) Markdown files now render as standard line-numbered code.
  }

  function renderFileSystemPreview(content, language) {
    if (!fileSystemPreviewContainer) return;

    const cleanExt = (language || "markdown").replace(".", "").toLowerCase();
    const isMarkdown = cleanExt === "markdown" || cleanExt === "md";
    const isHtml = cleanExt === "html";

    if (isMarkdown) {
      fileSystemPreviewContainer.style.padding = "2rem";
      if (typeof marked !== "undefined") {
        let htmlContent = formatMarkdown(content || "");
        // Remove 'disabled' attribute from checkboxes to allow interaction
        htmlContent = htmlContent.replace(/<input([^>]*?)disabled([^>]*?)>/gi, '<input$1$2>');
        fileSystemPreviewContainer.innerHTML = htmlContent;
        setTimeout(renderMermaidBlocks, 100);

        // Add event listeners to checkboxes to persist state
        const checkboxes = fileSystemPreviewContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((cb, index) => {
          cb.addEventListener('change', () => {
             let cbCount = -1;
             let newContent = currentFileSystemContentRaw.replace(/^[ \t]*[-*+][ \t]+\[([ xX])\]/gm, (match, innerText) => {
                cbCount++;
                if (cbCount === index) {
                   return match.replace(`[${innerText}]`, cb.checked ? '[x]' : '[ ]');
                }
                return match;
             });
             if (newContent !== currentFileSystemContentRaw) {
                currentFileSystemContentRaw = newContent;
                if (window.fileSystemEditor) {
                  window.fileSystemEditor.dispatch({
                    changes: { from: 0, to: window.fileSystemEditor.state.doc.length, insert: currentFileSystemContentRaw }
                  });
                }
                saveDebounced(currentFileSystemId, currentFileSystemContentRaw);
             }
          });
        });
      } else {
        fileSystemPreviewContainer.innerHTML = `<pre>${content}</pre>`;
      }
    } else if (isHtml) {
      fileSystemPreviewContainer.style.padding = "0";
      // Use iframe for safe HTML rendering
      const iframe = document.createElement("iframe");
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      iframe.style.background = "white";
      fileSystemPreviewContainer.innerHTML = "";
      fileSystemPreviewContainer.appendChild(iframe);

      // Pre-process HTML to replace relative URLs with the new raw API endpoints
      let processedContent = content || "";
      processedContent = processedContent.replace(
        /(href|src)=["'](?!http|https|data|blob|\/)([^"']+)["']/gi,
        (match, attr, filename) => {
          let qs = `chat_id=${encodeURIComponent(currentChatId || '')}&filename=${encodeURIComponent(filename)}`;
          if (currentFileSystemWorkspaceId) {
             qs += `&workspace_id=${encodeURIComponent(currentFileSystemWorkspaceId)}`;
          }
          return `${attr}="/api/file_systems/raw?${qs}"`;
        }
      );

      // Write content to iframe
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(processedContent);
      doc.close();

      // Attach event listeners to persist input changes
      const iDoc = iframe.contentWindow.document;
      iDoc.body.addEventListener('change', (e) => {
         const target = e.target;
         if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
            const allInputs = Array.from(iDoc.querySelectorAll('input, textarea, select'));
            const index = allInputs.indexOf(target);
            if (index === -1) return;

            let currentIdx = -1;
            let newContent = currentFileSystemContentRaw.replace(/<(input|textarea|select)([^>]*)>/gi, (match, tag, attrs) => {
                currentIdx++;
                if (currentIdx === index) {
                    let newAttrs = attrs;
                    let trailingSlash = '';
                    if (newAttrs.endsWith('/')) {
                        trailingSlash = '/';
                        newAttrs = newAttrs.substring(0, newAttrs.length - 1);
                    }
                    if (tag.toLowerCase() === 'input' && (target.type === 'checkbox' || target.type === 'radio')) {
                        if (target.checked) {
                            if (!/checked/i.test(newAttrs)) newAttrs += ' checked ';
                        } else {
                            newAttrs = newAttrs.replace(/\s?checked(?:=(?:'[^']*'|"[^"]*"|[^>\s]+))?/gi, '');
                        }
                    } else {
                        const val = target.value.replace(/"/g, '&quot;');
                        if (/value(?:=(?:'[^']*'|"[^"]*"|[^>\s]+))?/i.test(newAttrs)) {
                            newAttrs = newAttrs.replace(/value(?:=(?:'[^']*'|"[^"]*"|[^>\s]+))?/gi, `value="${val}"`);
                        } else {
                            newAttrs += ` value="${val}" `;
                        }
                    }
                    return `<${tag}${newAttrs}${trailingSlash}>`;
                }
                return match;
            });

            if (newContent !== currentFileSystemContentRaw) {
                currentFileSystemContentRaw = newContent;
                if (window.fileSystemEditor) {
                  window.fileSystemEditor.dispatch({
                    changes: { from: 0, to: window.fileSystemEditor.state.doc.length, insert: currentFileSystemContentRaw }
                  });
                }
                saveDebounced(currentFileSystemId, currentFileSystemContentRaw);
            }
         }
      });
    } else {
      fileSystemPreviewContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--content-muted);">Preview not available for this file type.</div>`;
    }
  }

  // Call load immediately
  loadCodeMirror().then(() => {
    initFileSystemEditor();
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
  const researchActions = document.getElementById("research-actions");
  const discardResearchBtn = document.getElementById("discard-research-btn");

  /**
   * 2. Application State Management
   * Defines the reactive state of the application.
   * Selective persistence is used (localStorage for settings, SQL for chats).
   */

  let chatHistory = []; // Current turn-by-turn history

  let personas = [];
  let selectedPersonaId = null;

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
  let isFileSystemRendered = false; // Toggle between preview and raw edit
  let wasUserPreferences = true;
  let currentResearchPlan = null;
  let isSavingFileSystem = false;
  let isFetchingFileSystems = false;

  // FileSystem/Artifact Registry
  let _allFileSystems = [];
  let _file_systemSearchQuery = "";
  let _file_systemTypeFilter = "all";
  let _currentFolderFilter = "";

  // Workspace & Organization State
  let chatWorkspaces = JSON.parse(localStorage.getItem("chatWorkspaces") || "[]");
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

  let artifactFoldersExpanded = JSON.parse(
    localStorage.getItem("artifactFoldersExpanded") || "{}",
  );
  let chatArtifactFolders = JSON.parse(
    localStorage.getItem("chatArtifactFolders") || "{}",
  );
  let currentChatArtifactFolders = [];

  /**
   * Storage Helpers for Workspaces and Artifacts
   */
  function saveWorkspaces() {
    localStorage.setItem("chatWorkspaces", JSON.stringify(chatWorkspaces));
  }
  function saveArtifactFoldersExpanded() {
    localStorage.setItem(
      "artifactFoldersExpanded",
      JSON.stringify(artifactFoldersExpanded),
    );
  }
  function saveChatArtifactFolders() {
    localStorage.setItem(
      "chatArtifactFolders",
      JSON.stringify(chatArtifactFolders),
    );
  }

  // Model & Vision State
  let selectedModel = localStorage.getItem("my_ai_selected_model") || "";
  let selectedModelName =
    localStorage.getItem("my_ai_selected_model_name") || "Select a Model";
  let isVisionEnabled =
    localStorage.getItem("my_ai_vision_enabled") !== "false";
  let availableModels = [];
  
  function resolveModelDisplayName(modelKey) {
    if (!modelKey) return "";
    const models = window.availableModels || availableModels || [];
    const modelDef = models.find((m) => m.key === modelKey || m.display_name === modelKey);
    return modelDef ? modelDef.display_name : modelKey;
  }
  
  let currentChatData = null;

  let storedChatDefaults =
    JSON.parse(localStorage.getItem("my_ai_chat_defaults")) || {};
  let chatDefaults = {
    thinkingProfile: "general",
    userPreferences: true,
    maxTokens: 32768,
    thinkingBudgetTokens: 2000,
    ...storedChatDefaults,
  };

  // LLM Sampling Parameters
  const THINKING_PROFILES = {
    none: {
      enable_thinking: false,
    },
    general: {
      enable_thinking: true,
    },
    precision: {
      enable_thinking: true,
    },
  };

  let storedSamplingParams =
    JSON.parse(localStorage.getItem("my_ai_sampling_params")) || {};
  let samplingParams = {
    max_tokens: 16384,
    thinking_budget_tokens: 2000,
    enable_thinking: true,
    thinking_profile: "general",
    ...storedSamplingParams,
  };
  if (samplingParams.thinking_profile === undefined)
    samplingParams.thinking_profile = "general";

  /**
   * Saves sampling parameters to local storage and syncs with backend if chat is persistent.
   */
  function saveSamplingParams() {
    localStorage.setItem(
      "my_ai_sampling_params",
      JSON.stringify(samplingParams),
    );

    // Only sync to backend if the chat has actually been persisted (contains messages)
    if (currentChatId && !isTemporaryChat && chatHistory.length > 0) {
      fetch(`${API_MODULES.CHATS}/${currentChatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(samplingParams),
      }).catch((e) => console.error("Error updating sampling parameters:", e));
    }
  }

  /**
   * Updates the active state of thinking profile buttons.
   */
  function updateThinkingProfileUI() {
    if (!thinkingProfileSelector) return;
    const buttons = thinkingProfileSelector.querySelectorAll(".profile-btn");
    buttons.forEach((btn) => {
      if (btn.dataset.profile === samplingParams.thinking_profile) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  /**
   * Applies a thinking profile's parameters to samplingParams and updates UI.
   */
  function applyThinkingProfile(profileKey) {
    const profile = THINKING_PROFILES[profileKey];
    if (!profile) return;

    samplingParams.thinking_profile = profileKey;
    samplingParams.enable_thinking = profile.enable_thinking;

    updateThinkingProfileUI();
    saveSamplingParams();
  }
  let isGenerating = false; // True when an SSE stream is active
  let activeThoughtModalSource = null; // Track which .activity-feed is currently in the modal
  let pendingEditIndex = null; // Tracks message being edited for replacement

  // Load session
  updateResearchUI();
  fetchModels();

  loadChats();
  updateThinkingProfileUI();

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

  // Initialize Theme
  let themeMode = localStorage.getItem("my_ai_theme_mode") || "system";

  function applyTheme() {
    let isDark = false;
    if (themeMode === "system") {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
      isDark = themeMode === "dark";
    }

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Update Highlight.js theme
    const highlightThemeLink = document.getElementById("highlight-theme");
    if (highlightThemeLink) {
      highlightThemeLink.href = isDark
        ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css";
    }
    updateEditorTheme(isDark);

    // Update radio buttons
    themeRadios.forEach((radio) => {
      if (radio.value === themeMode) radio.checked = true;
    });
  }

  applyTheme();

  // Listen for system changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (themeMode === "system") applyTheme();
    });



  // Initialize Model UI
  currentModelDisplay.textContent = selectedModelName;

  fetchPersonas();

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
      const wsResponse = await fetch(`${API_MODULES.CHATS}/workspaces`);
      if (wsResponse.ok) {
        const fetchedWorkspaces = await wsResponse.json();
        // Merge with existing state (to preserve expanded property)
        const newWorkspaces = [];
        fetchedWorkspaces.forEach(ws => {
            const existing = chatWorkspaces.find(cw => cw.name === ws.id);
            newWorkspaces.push({
                name: ws.id, // Store ID as name for internal logic backward compatibility
                displayName: ws.name,
                expanded: existing ? existing.expanded : true
            });
        });
        chatWorkspaces = newWorkspaces;
        saveWorkspaces();
      }
    } catch (e) {
      console.error("Error loading chats/workspaces:", e);
      savedChats = [];
    }
    renderChatList();
  }

  // saveChats is no longer needed as backend handles persistence
  function saveChats() {
    // No-op for compatibility if called elsewhere, or trigger reload
    renderChatList();
  }

  // Force synchronization of a modified chat state back to the SQLite layer (e.g. after message edits/deletions)
  function persistChat() {
    // NOP: We now use Action-Based APIs for all state changes.
    // This prevents stale tabs from overwriting newer DB entries.
    console.debug("persistChat() - No-op (Redirected to Action-Based APIs)");
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

  function resetGenerationState() {
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
    if (textArea) {
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
    checkSendButtonCompatibility();

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
    setEditorLanguage(currentFileSystemLanguage);

    updateResearchUI();
    updateSearchDepthUI();

    // Reset Sampling Parameters for new chats
    const targetProfile = chatDefaults.thinkingProfile || "general";
    if (typeof applyThinkingProfile === "function") {
      applyThinkingProfile(targetProfile);
    } else {
      samplingParams.thinking_profile = targetProfile;
      samplingParams.enable_thinking =
        THINKING_PROFILES[targetProfile].enable_thinking;
    }

    samplingParams.max_tokens = chatDefaults.maxTokens || 32768;
    if (maxTokensSlider) maxTokensSlider.value = samplingParams.max_tokens;
    if (maxTokensVal)
      maxTokensVal.textContent = samplingParams.max_tokens.toString();

    samplingParams.thinking_budget_tokens =
      chatDefaults.thinkingBudgetTokens || 2000;
    if (thinkingBudgetSlider)
      thinkingBudgetSlider.value = samplingParams.thinking_budget_tokens;
    if (thinkingBudgetVal)
      thinkingBudgetVal.textContent =
        samplingParams.thinking_budget_tokens.toString();

    if (typeof saveSamplingParams === "function") {
      saveSamplingParams();
    }

    if (welcomeHero) {
      messagesContainer.appendChild(welcomeHero);
      welcomeHero.classList.remove("hidden");
    }
    if (clearChatBtn) clearChatBtn.classList.remove("visible");

    // Hide chat title header for new chats until first message
    if (chatTitleHeader) chatTitleHeader.classList.add("hidden");

    // Reset persona to default for new chat
    const defaultPersona = personas.find(p => p.is_default);
    selectedPersonaId = defaultPersona ? defaultPersona.id : null;
    renderPersonas();

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

  async function loadChat(id, pushState = true) {
    resetGenerationState();
    pendingEditIndex = null;
    try {
      const response = await fetch(`${API_MODULES.CHATS}/${id}?chat_id=${id}`);
      if (!response.ok) {
        console.error("Failed to load chat details");
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
        const modelDef = (window.availableModels || availableModels).find(
          (m) => m.key === chat.last_model,
        );
        if (modelDef) {
          selectModel(modelDef.key, modelDef.display_name, false);
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
      setEditorLanguage(currentFileSystemLanguage);

      if (chat.persona_id) {
        selectedPersonaId = chat.persona_id;
      } else {
        selectedPersonaId = null;
      }
      renderPersonas();

      // Restore sampling parameters
      if (chat.max_tokens !== undefined && chat.max_tokens !== null)
        samplingParams.max_tokens = chat.max_tokens;
      if (
        chat.thinking_budget_tokens !== undefined &&
        chat.thinking_budget_tokens !== null
      )
        samplingParams.thinking_budget_tokens = chat.thinking_budget_tokens;
      if (chat.temperature !== undefined && chat.temperature !== null)
        samplingParams.temperature = chat.temperature;
      if (chat.top_p !== undefined && chat.top_p !== null)
        samplingParams.top_p = chat.top_p;
      if (chat.top_k !== undefined && chat.top_k !== null)
        samplingParams.top_k = chat.top_k;
      if (chat.min_p !== undefined && chat.min_p !== null)
        samplingParams.min_p = chat.min_p;
      if (chat.presence_penalty !== undefined && chat.presence_penalty !== null)
        samplingParams.presence_penalty = chat.presence_penalty;
      if (
        chat.frequency_penalty !== undefined &&
        chat.frequency_penalty !== null
      )
        samplingParams.frequency_penalty = chat.frequency_penalty;
      if (chat.enable_thinking !== undefined && chat.enable_thinking !== null)
        samplingParams.enable_thinking = !!chat.enable_thinking;
      if (chat.thinking_profile)
        samplingParams.thinking_profile = chat.thinking_profile;

      // Sync UI
      const updateSlider = (slider, val, value) => {
        if (slider) {
          slider.value = value;
          if (val)
            val.textContent =
              typeof value === "number" && !Number.isInteger(value)
                ? value.toFixed(2)
                : value;
        }
      };
      updateSlider(maxTokensSlider, maxTokensVal, samplingParams.max_tokens);
      updateSlider(
        thinkingBudgetSlider,
        thinkingBudgetVal,
        samplingParams.thinking_budget_tokens,
      );
      updateThinkingProfileUI();

      updateResearchUI();
      checkSendButtonCompatibility();

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
          modelName: turn.role.includes("assistant") ? resolveModelDisplayName(turn.model) : "",
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
      setTimeout(renderMermaidBlocks, 100);

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
    }
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
   * Deletes a workspace and moves its containing chats to 'uncategorized'.
   * @param {string} workspaceId - The ID of the workspace to delete.
   * @param {Event} event - The DOM event that triggered the action.
   */
  async function deleteWorkspace(workspaceId, event) {
    if (event) event.stopPropagation();
    
    const workspace = chatWorkspaces.find(w => w.name === workspaceId);
    const displayName = workspace ? workspace.displayName : "this workspace";

    if (
      await showConfirm(
        "Delete Workspace",
        `Are you sure you want to delete the workspace "${escapeHtml(displayName)}"? The chats inside will be moved to uncategorized.`,
        true,
      )
    ) {
      try {
        const res = await fetch(`${API_MODULES.CHATS}/workspaces/${workspaceId}`, {
          method: "DELETE"
        });
        if (res.ok) {
           await loadChats();
        }
      } catch (e) {
        console.error("Error deleting workspace:", e);
      }
    }
  }

  /**
   * Renames an existing workspace and syncs the change with the backend.
   * @param {string} workspaceId - The workspace ID.
   * @param {Event} event - The DOM event.
   */
  async function renameWorkspace(workspaceId, event) {
    if (event) event.stopPropagation();

    const workspace = chatWorkspaces.find(w => w.name === workspaceId);
    const displayName = workspace ? workspace.displayName : "";

    const newWorkspaceName = await showPromptModal(
      "Rename Workspace",
      "Enter new name for workspace:",
      displayName,
    );
    if (
      newWorkspaceName !== null &&
      newWorkspaceName.trim() !== "" &&
      newWorkspaceName.trim() !== displayName
    ) {
      const finalWorkspaceName = newWorkspaceName.trim();
      try {
        const res = await fetch(`${API_MODULES.CHATS}/workspaces/${workspaceId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: finalWorkspaceName }),
        });
        if (res.ok) {
            await loadChats();
        }
      } catch (e) {
        console.error("Error renaming workspace:", e);
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

    if (sorted.length === 0 && chatWorkspaces.length === 0) {
      chatHistoryList.innerHTML = `<div style="padding: 1rem; color: var(--content-muted); font-size: 0.8rem; text-align: center;">No saved chats</div>`;
      return;
    }

    // --- Grouping Logic ---
    const grouped = { uncategorized: [] };
    chatWorkspaces.forEach((f) => {
      grouped[f.name] = [];
    });

    sorted.forEach((chat) => {
      const workspaceName = chat.workspace_id || "uncategorized";
      if (!grouped[workspaceName]) {
        // Handle legacy folders not in registry
        chatWorkspaces.push({ name: workspaceName, expanded: false });
        grouped[workspaceName] = [];
        saveWorkspaces();
      }
      grouped[workspaceName].push(chat);
    });

    // --- Render Workspace Tree ---
    chatWorkspaces.forEach((workspace) => {
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
        saveWorkspaces();
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
          await moveChatToWorkspace(dragChatId, workspace.name);
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
      foldersSection.classList.toggle("hidden", chatWorkspaces.length === 0);
    if (recentChatsSection)
      recentChatsSection.classList.toggle("hidden", sorted.length === 0);
  }

  async function moveChatToWorkspace(chatId, workspaceIdOrName) {
    const chat = savedChats.find((c) => c.id === chatId);
    if (!chat) return;

    let targetWorkspaceId = workspaceIdOrName;

    // If it's a new name not in our workspaces list, create it first
    if (workspaceIdOrName && !chatWorkspaces.find((f) => f.name === workspaceIdOrName)) {
      try {
        const res = await fetch(`${API_MODULES.CHATS}/workspaces`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: workspaceIdOrName })
        });
        if (res.ok) {
            const data = await res.json();
            targetWorkspaceId = data.id;
            await loadChats(); // Refresh full state
        } else {
            console.error("Failed to create workspace during move.");
            return;
        }
      } catch (e) {
          console.error("Error creating workspace:", e);
          return;
      }
    }

    chat.workspace_id = targetWorkspaceId;

    try {
      await fetch(`${API_MODULES.CHATS}/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: targetWorkspaceId }),
      });
      // Always reload state after moving to ensure consistency
      await loadChats();
    } catch (err) {
      console.error("Error updating workspace", err);
    }
  }

  function createChatItemElement(chat) {
    const item = document.createElement("a");
    item.href = `/chat/${chat.id}`;
    item.className = `chat-list-item ${chat.id === currentChatId ? "active" : ""}`;

    // Switch to window width detection for mobile mode
    const isMobileMode = window.innerWidth <= 768;

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

  /**
   * Closes the context menu and removes it from the screen.
   */
  async function showContextMenu(type, id, extraData, e, workspaceId = null) {
    const modalId = "universal-context-modal";
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement("div");
      modal.id = modalId;
      modal.className = "modal-backdrop";
      modal.style.display = "flex";
      modal.style.alignItems = "center";
      modal.style.justifyContent = "center";
      document.body.appendChild(modal);
      setScrollLock(true);
      modal.addEventListener('touchmove', (e) => {
        if (!e.target.closest('.modal-content')) e.preventDefault();
      }, { passive: false });
    }

    // --- Build Context Menu HTML based on type ---
    if (type === "chat") {
      modal.innerHTML = `
                <div class="modal-content hardware-surface" style="max-width: 320px; text-align: center;">
                    <h3 class="text-h2" style="margin-bottom: 24px; font-size: 1.25rem;">Chat Actions</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button id="ctx-rename-btn" class="btn-secondary" style="width: 100%; justify-content: center; padding: 12px;">Rename Chat</button>
                        <button id="ctx-move-btn" class="btn-secondary" style="width: 100%; justify-content: center; padding: 12px;">Move to Workspace</button>
                        <button id="ctx-delete-btn" class="btn-primary" style="width: 100%; justify-content: center; padding: 12px; background: var(--color-rose-500); border-color: var(--color-rose-500);">Delete Chat</button>
                    </div>
                    <button id="ctx-cancel-btn" class="btn-ghost" style="margin-top: 16px; width: 100%; justify-content: center;">Cancel</button>
                </div>
            `;
    } else if (type === "workspace") {
      modal.innerHTML = `
                <div class="modal-content hardware-surface" style="max-width: 320px; text-align: center;">
                    <h3 class="text-h2" style="margin-bottom: 24px; font-size: 1.25rem;">Workspace Actions</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button id="ctx-new-chat-btn" class="btn-primary" style="width: 100%; justify-content: center; padding: 12px;">New Chat in Workspace</button>
                        <button id="ctx-rename-workspace-btn" class="btn-secondary" style="width: 100%; justify-content: center; padding: 12px;">Rename Workspace</button>
                        <button id="ctx-delete-btn" class="btn-primary" style="width: 100%; justify-content: center; padding: 12px; background: var(--color-rose-500); border-color: var(--color-rose-500);">Delete Workspace</button>
                    </div>
                    <button id="ctx-cancel-btn" class="btn-ghost" style="margin-top: 16px; width: 100%; justify-content: center;">Cancel</button>
                </div>
            `;
    } else if (type === "file_system") {
      modal.innerHTML = `
                <div class="modal-content hardware-surface" style="max-width: 320px; text-align: center;">
                    <h3 class="text-h2" style="margin-bottom: 24px; font-size: 1.25rem;">File Actions</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button id="ctx-move-btn" class="btn-secondary" style="width: 100%; justify-content: center; padding: 12px;">Move/Rename File</button>
                        <button id="ctx-delete-btn" class="btn-primary" style="width: 100%; justify-content: center; padding: 12px; background: var(--color-rose-500); border-color: var(--color-rose-500);">Delete File</button>
                    </div>
                    <button id="ctx-cancel-btn" class="btn-ghost" style="margin-top: 16px; width: 100%; justify-content: center;">Cancel</button>
                </div>
            `;
    } else if (type === "file-system-folder") {
      modal.innerHTML = `
                <div class="modal-content hardware-surface" style="max-width: 320px; text-align: center;">
                    <h3 class="text-h2" style="margin-bottom: 24px; font-size: 1.25rem;">Folder Actions</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button id="ctx-delete-btn" class="btn-primary" style="width: 100%; justify-content: center; padding: 12px; background: var(--color-rose-500); border-color: var(--color-rose-500);">Delete Folder</button>
                    </div>
                    <button id="ctx-cancel-btn" class="btn-ghost" style="margin-top: 16px; width: 100%; justify-content: center;">Cancel</button>
                </div>
            `;
    }

    const closeModal = () => {
      modal.classList.remove("open");
      setTimeout(() => {
        modal.style.display = "none";
        setScrollLock(false);
      }, 300);
    };

    const deleteBtn = document.getElementById("ctx-delete-btn");
    const cancelBtn = document.getElementById("ctx-cancel-btn");
    if (cancelBtn) cancelBtn.onclick = closeModal;

    // Action Handlers
    if (type === "chat") {
      const renameBtn = document.getElementById("ctx-rename-btn");
      const moveBtn = document.getElementById("ctx-move-btn");
      if (renameBtn)
        renameBtn.onclick = () => {
          closeModal();
          renameChat(id, e);
        };
      if (moveBtn) {
        moveBtn.onclick = async () => {
          closeModal();
          const workspaceName = await showPromptModal(
            "Move to Workspace",
            "Select a workspace or create a new one:",
            extraData || "",
            chatWorkspaces,
          );
          if (workspaceName !== null) {
            const finalWorkspace =
              workspaceName.trim() === "" ? null : workspaceName.trim();
            await moveChatToWorkspace(id, finalWorkspace);
          }
        };
      }
      if (deleteBtn)
        deleteBtn.onclick = () => {
          closeModal();
          deleteChat(id, e);
        };
    } else if (type === "file_system") {
      const moveBtn = document.getElementById("ctx-move-btn");
      if (moveBtn) {
        moveBtn.onclick = async () => {
          closeModal();
          const newPath = await showFileExplorerModal("move", extraData);
          if (newPath !== null) {
            const finalPath = newPath.trim();
            if (finalPath !== "" && finalPath !== extraData) {
               await renameOrMoveFileSystemPath(id, finalPath, workspaceId);
            }
          }
        };
      }
      if (deleteBtn)
        deleteBtn.onclick = () => {
          closeModal();
          deleteFileSystem(id, workspaceId);
        };
    } else if (type === "file-system-folder") {
      if (deleteBtn) {
        deleteBtn.onclick = () => {
          closeModal();
          deleteFileSystemFolder(id);
        };
      }
    } else if (type === "workspace") {
      const newChatBtn = document.getElementById("ctx-new-chat-btn");
      const renameWorkspaceBtn = document.getElementById("ctx-rename-workspace-btn");
      if (newChatBtn) {
        newChatBtn.onclick = async () => {
          closeModal();
          startNewChat(false, true, id);
          
          try {
            const res = await fetch(`${API_MODULES.CHATS}/save`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: currentChatId,
                title: "New Chat",
                workspace_id: id,
                user_preferences: isUserPreferences,
                research_mode: isResearchMode,
                ...samplingParams,
              }),
            });
            
            if (res.ok) {
              await loadChats();
              renderChatList();
            } else {
              const errorText = await res.text();
              console.error("Failed to immediately persist new chat in workspace:", errorText);
            }
          } catch (e) {
            console.error("Error during immediate chat persistence:", e);
          }
        };
      }
      if (renameWorkspaceBtn) {
        renameWorkspaceBtn.onclick = () => {
          closeModal();
          renameWorkspace(id, e);
        };
      }
      if (deleteBtn) {
        deleteBtn.onclick = () => {
          closeModal();
          deleteWorkspace(id, e);
        };
      }
    }

    modal.onclick = (eEvent) => {
      if (eEvent.target === modal) closeModal();
    };

    modal.style.display = "flex";
    requestAnimationFrame(() => {
      modal.classList.add("open");
    });
  }

  /**
   * User Preferences Toggle Switch Listener
   * Handles the inclusion of user profile and preferences in the LLM context.
   */
  const preferencesSwitchContainer = document.getElementById(
    "preferences-toggle-switch",
  )?.parentElement?.parentElement;
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
   * Shows an interactive file explorer modal for selecting a path.
   * @param {string} mode - 'file' (selecting file path), 'folder' (selecting directory), 'move' (renaming/moving)
   * @param {string} initialPath - Starting path
   * @returns {Promise<string|null>} Resolves with final full relative path or null if cancelled.
   */
  async function showFileExplorerModal(mode = "file", initialPath = "") {
    return new Promise((resolve) => {
      const modal = document.getElementById("file-explorer-modal");
      const titleEl = document.getElementById("file-explorer-title");
      const breadcrumbsEl = document.getElementById("file-explorer-breadcrumbs");
      const listEl = document.getElementById("file-explorer-list");
      const inputContainer = document.getElementById("file-explorer-input-container");
      const inputEl = document.getElementById("file-explorer-input");
      const extEl = document.getElementById("file-explorer-ext");
      const newFolderBtn = document.getElementById("file-explorer-new-folder-btn");
      const cancelBtn = document.getElementById("file-explorer-cancel-btn");
      const confirmBtn = document.getElementById("file-explorer-action-btn");

      if (!modal || !listEl) return resolve(null);

      let currentPath = initialPath.includes(".") ? initialPath.split("/").slice(0, -1).join("/") : initialPath;
      currentPath = sanitizePath(currentPath);

      if (mode === "file") {
        titleEl.textContent = "Create New File";
        inputContainer.style.display = "flex";
        extEl.style.display = "block";
        newFolderBtn.style.display = "flex";
        inputEl.value = "";
      } else if (mode === "folder") {
        titleEl.textContent = "Create Folder";
        inputContainer.style.display = "flex";
        extEl.style.display = "none";
        newFolderBtn.style.display = "none";
        inputEl.value = "";
      } else {
        titleEl.textContent = "Move / Rename";
        inputContainer.style.display = "flex";
        extEl.style.display = "none"; // Paths for move are full
        newFolderBtn.style.display = "flex";
        // Pre-populate with current basename
        inputEl.value = initialPath.split("/").pop();
      }

      const renderExplorer = () => {
        // Render Breadcrumbs
        breadcrumbsEl.innerHTML = "";
        const rootCrumb = document.createElement("span");
        rootCrumb.className = "breadcrumb-item";
        rootCrumb.textContent = "Root";
        rootCrumb.onclick = () => { currentPath = ""; renderExplorer(); };
        breadcrumbsEl.appendChild(rootCrumb);

        if (currentPath) {
          const parts = currentPath.split("/");
          let built = "";
          parts.forEach((p, i) => {
            const sep = document.createElement("span");
            sep.className = "breadcrumb-separator";
            sep.textContent = "/";
            breadcrumbsEl.appendChild(sep);

            built += (built ? "/" : "") + p;
            const crumb = document.createElement("span");
            crumb.className = "breadcrumb-item";
            crumb.textContent = p;
            const target = built;
            crumb.onclick = () => { currentPath = target; renderExplorer(); };
            breadcrumbsEl.appendChild(crumb);
          });
        }

        // Render Folder List
        listEl.innerHTML = "";
        const prefix = currentPath ? currentPath + "/" : "";
        
        // Find folders in current path from _allFileSystems
        const subfolders = new Set();
        _allFileSystems.forEach(c => {
          const path = c.filename || c.title;
          if (path.startsWith(prefix)) {
            const remainder = path.substring(prefix.length);
            const parts = remainder.split("/");
            if (parts.length > 1) {
              subfolders.add(parts[0]);
            } else if (c.type === "directory") {
              subfolders.add(parts[0]);
            }
          }
        });

        const sorted = Array.from(subfolders).sort();
        if (sorted.length === 0) {
          listEl.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--content-ghost); font-size: 0.85rem;">No subfolders found</div>`;
        } else {
          sorted.forEach(folder => {
            const item = document.createElement("div");
            item.className = "explorer-item";
            item.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>${escapeHtml(folder)}</span>
            `;
            item.onclick = () => {
              currentPath = prefix + folder;
              renderExplorer();
            };
            listEl.appendChild(item);
          });
        }
      };

      const cleanup = () => {
        modal.classList.remove("open");
        setTimeout(() => { modal.style.display = "none"; setScrollLock(false); }, 300);
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        newFolderBtn.onclick = null;
      };

      newFolderBtn.onclick = async () => {
        const name = await showPromptModal("New Folder", `Create in ${currentPath || 'Root'}:`);
        if (name && name.trim()) {
          const fullPath = (currentPath ? currentPath + "/" : "") + name.trim();
          const res = await fetch(`${API_MODULES.FILE_SYSTEMS}/directory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: currentChatId, path: fullPath }),
          });
          const data = await res.json();
          if (data.success) {
            await fetchFileSystems(currentChatId);
            renderExplorer();
          } else {
            await showAlert("Error", data.error || "Failed to create folder");
          }
        }
      };

      confirmBtn.onclick = () => {
        const inputVal = inputEl.value.trim();
        if ((mode === "file" || mode === "folder" || mode === "move") && !inputVal) {
          showAlert("Missing Name", "Please enter a name.");
          return;
        }

        let finalPath = (currentPath ? currentPath + "/" : "") + inputVal;
        if (mode === "file") {
          finalPath += extEl.value;
        }
        
        cleanup();
        resolve(finalPath);
      };

      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };

      modal.style.display = "flex";
      setScrollLock(true);
      renderExplorer();
      requestAnimationFrame(() => modal.classList.add("open"));
    });
  }

  /**
   * Shows a custom Luminous-styled prompt dialog with folder selection support.
   * @returns {Promise<string|null>} Resolves with the user input or null if cancelled.
   */
  async function showPromptModal(
    title,
    message,
    currentVal = "",
    folderList = null,
  ) {
    return new Promise((resolve) => {
      const modal = document.getElementById("prompt-modal");
      const titleEl = document.getElementById("prompt-title");
      const msgEl = document.getElementById("prompt-message");
      const inputEl = document.getElementById("prompt-input");
      const selectContainer = document.getElementById(
        "prompt-select-container",
      );
      const selectEl = document.getElementById("prompt-select");
      const confirmBtn = document.getElementById("prompt-action-btn");
      const cancelBtn = document.getElementById("prompt-cancel-btn");

      titleEl.textContent = title;
      msgEl.textContent = message;

      const iconSvg = document.getElementById("prompt-icon-svg");
      if (iconSvg) {
        iconSvg.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>`;
      }

      confirmBtn.textContent = "Confirm";
      cancelBtn.textContent = "Cancel";

      inputEl.value = currentVal;

      // --- Folder/Workspace Choice vs Text Input ---
      if (folderList !== null) {
        selectContainer.style.display = "block";
        inputEl.style.display = "none";

        selectEl.innerHTML = '<option value="">(No Workspace)</option>';
        folderList.forEach((f) => {
          const opt = document.createElement("option");
          opt.value = f.name;
          opt.textContent = f.displayName || f.name;
          if (f.name === currentVal) opt.selected = true;
          selectEl.appendChild(opt);
        });

        const optNew = document.createElement("option");
        optNew.value = "__new__";
        optNew.textContent = "+ Create New Workspace...";
        selectEl.appendChild(optNew);

        selectEl.onchange = () => {
          if (selectEl.value === "__new__") {
            inputEl.style.display = "block";
            inputEl.value = "";
            inputEl.focus();
          } else {
            inputEl.style.display = "none";
          }
        };

        if (currentVal && !folderList.find((f) => f.name === currentVal)) {
          inputEl.style.display = "block";
          selectEl.value = "__new__";
        }
      } else {
        selectContainer.style.display = "none";
        inputEl.style.display = "block";
      }

      modal.style.display = "flex";
      void modal.offsetWidth; // Force reflow
      modal.classList.add("open");
      if (inputEl.style.display !== "none") inputEl.focus();

      const cleanup = () => {
        modal.classList.remove("open");
        setTimeout(() => {
          modal.style.display = "none";
        }, 300);
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        inputEl.onkeydown = null;
      };

      confirmBtn.onclick = () => {
        let finalVal = inputEl.value;
        if (folderList !== null && selectEl.value !== "__new__")
          finalVal = selectEl.value;
        cleanup();
        resolve(finalVal);
      };

      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };

      inputEl.onkeydown = (e) => {
        if (e.key === "Enter") confirmBtn.click();
        if (e.key === "Escape") cancelBtn.click();
      };
    });
  }

  /**
   * Shows a custom Luminous-styled dialog (Alert or Confirm)
   */
  /**
   * Shows a universal modal dialog.
   * @param {string} title - Modal title.
   * @param {string} message - Content message.
   * @param {object} options - Configuration for type and buttons.
   * @returns {Promise<any>}
   */
  async function showModal(title, message, options = {}) {
    const {
      type = "confirm",
      isDanger = false,
      confirmText = type === "alert" ? "OK" : "Confirm",
      cancelText = "Cancel",
      placeholder = "Enter value...",
      defaultValue = "",
      showExtensions = false,
    } = options;

    // SVG Registry for Modal Icons
    const ICONS = {
      confirm: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
      alert: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
      prompt: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      danger: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };

    return new Promise((resolve) => {
      const modal = document.getElementById("confirm-modal");
      const titleEl = document.getElementById("confirm-title");
      const messageEl = document.getElementById("confirm-message");
      const confirmBtn = document.getElementById("confirm-action-btn");
      const cancelBtn = document.getElementById("confirm-cancel-btn");
      const iconContainer = document.getElementById("confirm-icon-container");
      const iconSvg = document.getElementById("confirm-icon-svg");
      const inputContainer = document.getElementById("confirm-input-container");
      const inputField = document.getElementById("confirm-input");
      const extContainer = document.getElementById(
        "confirm-extension-container",
      );
      const extSelect = document.getElementById("confirm-extension-select");

      // Fallback for missing DOM elements
      if (
        !modal ||
        !titleEl ||
        !messageEl ||
        !confirmBtn ||
        !cancelBtn ||
        !iconSvg
      ) {
        if (type === "prompt") resolve(prompt(message));
        else if (type === "alert") {
          alert(message);
          resolve(true);
        } else resolve(confirm(message));
        return;
      }

      titleEl.textContent = title;
      messageEl.textContent = message;
      confirmBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;

      // Icon & Style Logic
      iconSvg.innerHTML = isDanger
        ? ICONS.danger
        : ICONS[type] || ICONS.confirm;
      cancelBtn.style.display = type === "alert" ? "none" : "flex";

      if (isDanger) {
        confirmBtn.style.background = "var(--color-rose)";
        confirmBtn.style.borderColor = "var(--color-rose)";
        iconContainer.style.color = "var(--color-rose)";
        confirmBtn.style.color = "white";
      } else {
        confirmBtn.style.background = "";
        confirmBtn.style.borderColor = "";
        confirmBtn.style.color = "";
        iconContainer.style.color = "var(--accent)";
      }

      // --- Input Field Lifecycle ---
      if (inputContainer && inputField) {
        if (type === "prompt") {
          inputContainer.classList.remove("hidden");
          inputField.placeholder = placeholder;
          inputField.value = defaultValue;
          if (showExtensions && extContainer) {
            extContainer.classList.remove("hidden");
          } else if (extContainer) {
            extContainer.classList.add("hidden");
          }
          setTimeout(() => inputField.focus(), 100);
          inputField.onkeydown = (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmBtn.click();
            }
          };
        } else {
          inputContainer.classList.add("hidden");
          if (extContainer) extContainer.classList.add("hidden");
          inputField.onkeydown = null;
        }
      }

      const cleanup = () => {
        modal.classList.remove("open");
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
      };

      const onConfirm = () => {
        let value = true;
        if (type === "prompt" && inputField) {
          value = showExtensions
            ? { title: inputField.value, ext: extSelect ? extSelect.value : "" }
            : inputField.value;
        }
        cleanup();
        resolve(value);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      confirmBtn.addEventListener("click", onConfirm, { once: true });
      cancelBtn.addEventListener("click", onCancel, { once: true });

      const onEsc = (e) => {
        if (e.key === "Escape") onCancel();
      };
      document.addEventListener("keydown", onEsc, { once: true });

      modal.classList.add("open");
    });
  }

  async function showPrompt(title, message, options = {}) {
    return await showModal(title, message, {
      type: "prompt",
      ...options,
    });
  }

  async function showConfirm(title, message, isDanger = false) {
    return await showModal(title, message, { type: "confirm", isDanger });
  }

  async function showAlert(title, message) {
    return await showModal(title, message, { type: "alert" });
  }

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
    const isChatStarted = chatHistory.length > 0;
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

    // 3. Research Depth UI Styling
    if (uiResearchDepthSelector) {
      uiResearchDepthSelector.classList.toggle("hidden", !isResearchMode);
      uiResearchDepthSelector.setAttribute("data-mode", "regular");
      uiResearchDepthSelector.style.opacity = "1";
      uiResearchDepthSelector.style.pointerEvents = "auto";

      const btns = uiResearchDepthSelector.querySelectorAll(".mode-btn");
      btns.forEach((btn) => {
        btn.classList.toggle(
          "active",
          btn.getAttribute("data-mode") === "regular",
        );
      });
    }

    // Update the Tools Button icon based on active complex modes
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
    const indexApproval = chatHistory.findIndex(
      (m) =>
        m.content === "Plan Approved. Proceed with research." ||
        m.content === "Proceed with research.",
    );
    let hasApprovedResearch = false;
    if (isResearchMode) {
      const hasFinalMessage = chatHistory.some(
        (m, i) => i > indexApproval && m.role === "assistant",
      );
      hasApprovedResearch =
        indexApproval > -1 && !isResearchCompleted && !hasFinalMessage;
    }

    if (textArea) {
      textArea.disabled = hasApprovedResearch;
      textArea.placeholder = hasApprovedResearch
        ? "Chat is locked during research. Use 'Discard' to restart."
        : "Start a conversation...";
      textArea.style.opacity = hasApprovedResearch ? "0.6" : "1";
    }

    if (researchActions)
      researchActions.style.display = hasApprovedResearch ? "flex" : "none";

    const attachBtn = document.getElementById("attach-btn");
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
        checkSendButtonCompatibility();
        // If research is turning ON, force load the specialized models
        fetchModels(isResearchMode);

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
        isVisionEnabled = !isVisionEnabled;
        localStorage.setItem(
          "my_ai_vision_enabled",
          isVisionEnabled ? "true" : "false",
        );
        updateResearchUI();
        if (chatHistory.length > 0) {
          patchChat({ is_vision: isVisionEnabled });
        }
      });
    }

    // LEGACY: Research Mode Selector Click Handlers (PRESERVED FOR FUTURE USE)
    if (uiResearchDepthSelector) {
      const btns = uiResearchDepthSelector.querySelectorAll(".mode-btn");
      btns.forEach((btn) => {
        btn.addEventListener("click", () => {
          updateResearchUI();
        });
      });
    }
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
  if (newFolderBtn) {
    newFolderBtn.addEventListener("click", async () => {
      const workspaceName = await showPromptModal(
        "Create Workspace",
        "Enter a name for the new workspace:",
      );
      if (workspaceName && workspaceName.trim() !== "") {
        const name = workspaceName.trim();
        try {
          const res = await fetch(`${API_MODULES.CHATS}/workspaces`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name })
          });
          if (res.ok) {
            await loadChats();
          } else {
            showModal("Notice", "Failed to create workspace.", { type: "alert" });
          }
        } catch (e) {
          console.error("Error creating workspace:", e);
        }
      }
    });
  }
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
              persona_id: selectedPersonaId,
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

  if (discardResearchBtn) {
    discardResearchBtn.addEventListener("click", async () => {
      if (!currentChatId) return;
      if (
        await showConfirm(
          "Discard Research",
          "Are you sure you want to abandon the current research session and restart? All gathered data and state will be cleared.",
          true,
        )
      ) {
        try {
          // 1. Stop local generation if active
          resetGenerationState();

          // 2. Capture current query to restore it for the user
          let lastQuery = "";
          if (chatHistory.length > 0 && chatHistory[0].role === "user") {
            lastQuery = chatHistory[0].content;
            if (Array.isArray(lastQuery)) {
              const textPart = lastQuery.find((p) => p.type === "text");
              lastQuery = textPart ? textPart.text : "";
            }
          }

          const response = await fetch(
            `${API_MODULES.CHATS}/${currentChatId}/discard`,
            { method: "POST" },
          );
          if (response.ok) {
            // 3. Reload the chat
            await loadChat(currentChatId);

            // 4. Restore query to textarea so user can refine and resubmit
            if (textArea && lastQuery) {
              textArea.value = lastQuery;
              textArea.focus();
              // Trigger auto-resize
              textArea.style.height = "auto";
              textArea.style.height = textArea.scrollHeight + "px";
            }
          } else {
            showAlert(
              "Error",
              "Failed to discard research. Please check backend logs.",
            );
          }
        } catch (e) {
          console.error("Discard error:", e);
          showAlert("Error", "An error occurred while discarding research.");
        }
      }
    });
  }

  async function fetchModels(forceLoad = false) {
    if (modelSelectDropdown) {
      modelSelectDropdown.innerHTML =
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
      availableModels = Array.from(allModelsMap.values());

      window.modelConfig = config; // Global exposure for other components

      renderModelOptions();

      // --- Auto-selection Logic ---
      if (
        !selectedModel ||
        !availableModels.some((m) => m.key === selectedModel)
      ) {
        // Default pick based on current app mode
        const defaultModel = isResearchMode
          ? config.research.main
          : config.general.text;
        const modelDef = availableModels.find((m) => m.key === defaultModel);
        if (modelDef) {
          selectModel(modelDef.key, modelDef.display_name, forceLoad);
        }
      } else if (selectedModel) {
        // No-op
      }
    } catch (err) {
      console.error("Model config fetch error:", err);
      if (modelSelectDropdown)
        modelSelectDropdown.innerHTML =
          '<option value="" disabled selected>Error fetching config</option>';
    }
  }

  /**
   * Updates the model selection dropdowns in the settings UI.
   * Groups models by capability (Vision vs Text).
   */
  function renderModelOptions() {
    if (!modelSelectDropdown) return;

    const currentSelected = selectedModel;

    if (modelSelectDropdown) {
      modelSelectDropdown.disabled = false;
      modelSelectDropdown.title = "Select main model";
    }

    modelSelectDropdown.innerHTML = "";
    if (!Array.isArray(availableModels) || availableModels.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = "No models available";
      modelSelectDropdown.appendChild(opt);
    } else {
      // Flatten model list, removing vision/text grouping as per legacy logic removal
      availableModels.forEach((model) => {
        const opt = document.createElement("option");
        opt.value = model.key;
        opt.textContent = model.display_name || model.key.split("/").pop();
        if (model.key === currentSelected) opt.selected = true;
        modelSelectDropdown.appendChild(opt);
      });

      if (
        currentSelected &&
        availableModels.some((m) => m.key === currentSelected)
      )
        modelSelectDropdown.value = currentSelected;
    }
  }

  /**
   * Polls the backend for active model status and updates the UI dropdown
   * labels with (Active/Inactive/Loading) indicators.
   */
  async function updateModelStatusUI() {
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

      if (modelSelectDropdown) {
        Array.from(modelSelectDropdown.options).forEach((opt) => {
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
  }

  function checkSendButtonCompatibility() {
    if (!sendBtn || !sendBtnWrapper) return;

    // NEW: This logic ONLY applies to regular chats, not Research
    if (isResearchMode) {
      sendBtn.disabled = false;
      sendBtn.title = "";
      sendBtnWrapper.title = "";
      return;
    }

    sendBtn.classList.remove("incompatible-model");
    sendBtn.title = "";
    sendBtnWrapper.title = "";
  }

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
          statusEl.textContent.includes("Processing"))
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

  // Add dropdown event listeners
  if (modelSelectDropdown) {
    modelSelectDropdown.addEventListener("change", (e) => {
      const modelId = e.target.value;
      const model = availableModels.find((m) => m.key === modelId);
      if (model) {
        const shortName = model.display_name || modelId.split("/").pop();
        selectModel(modelId, shortName);
      }
    });
  }

  /**
   * Sends unload requests to the backend for all currently loaded models,
   * except for specified exclusions (usually to keep embeddings or the new target loaded).
   */
  async function unloadAllModels(excludeIds = []) {
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
  }

  /**
   * Requests the backend to load a specific model file into VRAM.
   * Blocks (via polling) until the backend reports a 'loaded' status.
   * @returns {Promise<boolean>} Resolves when the model is ready or failed.
   */
  async function loadModel(modelKey) {
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
        await showAlert(
          "Model Load Failed",
          `Failed to load model. Output: ${errorText}`,
        );
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
      await showAlert("Error", `Error loading model: ${err.message}`);
      return false;
    }
  }

  /**
   * Handles the complete flow of switching the active LLM.
   * Includes confirmation, unloading, loading overlay, and VRAM residency check.
   */
  async function selectModel(id, name, isManual = true) {
    if (isManual) {
      const confirmed = await showConfirm(
        "Switch Model",
        `Switch to ${name}? This will unload the current model and load the new one into memory, which may take a few moments.`,
      );
      if (!confirmed) {
        if (modelSelectDropdown)
          modelSelectDropdown.value = selectedModel || "";
        renderModelOptions();
        return;
      }

      // Check if already residency in VRAM to skip reload
      let isLoadedInLlama = false;
      try {
        const response = await fetch(`${API_MODULES.MODELS}/`);
        if (response.ok) {
          const data = await response.json();
          const found = (data.data || []).find((m) => m.id === id);
          if (found?.status?.value === "loaded") isLoadedInLlama = true;
        }
      } catch (err) {
        console.warn("VRAM status check failed", err);
      }

      if (isLoadedInLlama) {
        selectedModel = id;
        selectedModelName = name;
        localStorage.setItem("my_ai_selected_model", id);
        localStorage.setItem("my_ai_selected_model_name", name);
        if (modelSelectDropdown) modelSelectDropdown.value = id;
        if (settingsModal) {
          settingsModal.classList.remove("open");
          setTimeout(() => (settingsModal.style.display = "none"), 300);
        }
        renderModelOptions();
        return;
      }

      // --- Reload Triggered ---
      const overlay = document.getElementById("model-switch-overlay");
      const overlayText = document.getElementById("model-switch-text");
      if (overlay) {
        overlay.style.display = "flex";
        requestAnimationFrame(() => overlay.classList.add("open"));
        if (overlayText)
          overlayText.textContent = "Unloading previous models...";
      }

      await unloadAllModels([id]);
      const success = await loadModel(id);

      if (overlay) {
        overlay.classList.remove("open");
        setTimeout(() => (overlay.style.display = "none"), 300);
      }
      if (!success) {
        if (modelSelectDropdown)
          modelSelectDropdown.value = selectedModel || "";
        renderModelOptions();
        return;
      }
    }

    // Finalize selection state
    selectedModel = id;
    selectedModelName = name;
    localStorage.setItem("my_ai_selected_model", id);
    localStorage.setItem("my_ai_selected_model_name", name);

    if (modelSelectDropdown) modelSelectDropdown.value = id;
    checkSendButtonCompatibility();

    // Update chat metadata with the new model used
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

    if (settingsModal) {
      settingsModal.classList.remove("open");
      setTimeout(() => (settingsModal.style.display = "none"), 300);
    }
    renderModelOptions();
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
      } else {
        sidebar.classList.remove("sidebar-expanded");
        sidebar.classList.add("sidebar-collapsed");
        toggleIconPath.setAttribute("d", "M9 6l6 6-6 6");
      }
      syncSidebarWidth();
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

  // 4. Configuration Event Listeners
  [maxTokensSlider, thinkingBudgetSlider].forEach((slider) => {
    slider?.addEventListener("change", saveSamplingParams);
  });

  maxTokensSlider.addEventListener("input", (e) => {
    samplingParams.max_tokens = parseInt(e.target.value);
    maxTokensVal.textContent = samplingParams.max_tokens;
  });

  if (thinkingBudgetSlider) {
    thinkingBudgetSlider.addEventListener("input", (e) => {
      samplingParams.thinking_budget_tokens = parseInt(e.target.value);
      if (thinkingBudgetVal)
        thinkingBudgetVal.textContent = samplingParams.thinking_budget_tokens;
    });
  }

  if (thinkingProfileSelector) {
    thinkingProfileSelector.addEventListener("click", (e) => {
      const btn = e.target.closest(".profile-btn");
      if (btn) {
        applyThinkingProfile(btn.dataset.profile);
      }
    });
  }

  // System Settings Logic
  const openSystemSettings = () => {
    if (systemSettingsModal) {
      // Sync New Chat Defaults UI
      if (defaultThinkingProfileSelector) {
        const btns =
          defaultThinkingProfileSelector.querySelectorAll(".profile-btn");
        btns.forEach((btn) => {
          btn.classList.toggle(
            "active",
            btn.dataset.profile === chatDefaults.thinkingProfile,
          );
        });
      }
      if (defaultPreferencesToggle) {
        defaultPreferencesToggle.classList.toggle(
          "active",
          chatDefaults.userPreferences,
        );
      }
      if (defaultMaxTokensSlider) {
        defaultMaxTokensSlider.value = chatDefaults.maxTokens;
      }
      if (defaultMaxTokensVal) {
        defaultMaxTokensVal.textContent = chatDefaults.maxTokens.toString();
      }

      if (defaultThinkingBudgetSlider) {
        defaultThinkingBudgetSlider.value =
          chatDefaults.thinkingBudgetTokens || 2000;
      }
      if (defaultThinkingBudgetVal) {
        defaultThinkingBudgetVal.textContent = (
          chatDefaults.thinkingBudgetTokens || 2000
        ).toString();
      }

      systemSettingsModal.style.display = "flex";
      setTimeout(() => systemSettingsModal.classList.add("open"), 10);
      setScrollLock(true);
    }
  };

  const closeSystemSettings = () => {
    if (systemSettingsModal) {
      systemSettingsModal.classList.remove("open");
      setTimeout(() => {
        systemSettingsModal.style.display = "none";
        setScrollLock(false);
      }, 300);
    }
  };

  if (systemSettingsTrigger)
    systemSettingsTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      openSystemSettings();
    });

  if (closeSystemSettingsBtn)
    closeSystemSettingsBtn.addEventListener("click", closeSystemSettings);

  // Test Model Speed Logic
  if (sysTestModelSpeedBtn) {
    sysTestModelSpeedBtn.addEventListener("click", async () => {
      // Close system settings
      closeSystemSettings();

      // Open test model speed modal
      if (testModelSpeedModal) {
        testModelSpeedModal.style.display = "flex";
        setTimeout(() => testModelSpeedModal.classList.add("open"), 10);
      }

      // Fetch models for dropdown
      if (testSpeedModelSelect) {
        try {
          const response = await fetch("/api/models/config");
          if (response.ok) {
            const data = await response.json();
            testSpeedModelSelect.innerHTML = "";

            const llmModels = new Set();
            if (data.research) {
              Object.values(data.research).forEach((m) => llmModels.add(m));
            }
            if (data.general) {
              Object.values(data.general).forEach((m) => llmModels.add(m));
            }

            if (llmModels.size > 0) {
              Array.from(llmModels).forEach((model) => {
                const option = document.createElement("option");
                option.value = model;
                option.textContent = model;
                testSpeedModelSelect.appendChild(option);
              });
            } else {
              testSpeedModelSelect.innerHTML =
                '<option value="" disabled selected>No models found.</option>';
            }
          }
        } catch (e) {
          console.error("Failed to fetch models for speed test:", e);
          testSpeedModelSelect.innerHTML =
            '<option value="" disabled selected>Failed to load models.</option>';
        }
      }
    });
  }

  if (closeTestModelSpeedBtn) {
    closeTestModelSpeedBtn.addEventListener("click", () => {
      if (testModelSpeedModal) {
        testModelSpeedModal.classList.remove("open");
        setTimeout(() => (testModelSpeedModal.style.display = "none"), 300);
      }
    });
  }

  if (testSpeedContextSlider && testSpeedContextVal) {
    testSpeedContextSlider.addEventListener("input", (e) => {
      testSpeedContextVal.textContent = e.target.value;
    });
  }

  if (closeTelemetryDashboardBtn) {
    closeTelemetryDashboardBtn.addEventListener("click", () => {
      if (telemetryDashboardModal) {
        telemetryDashboardModal.classList.remove("open");
        setTimeout(() => (telemetryDashboardModal.style.display = "none"), 300);
      }
    });
  }

  if (runTestModelSpeedBtn) {
    runTestModelSpeedBtn.addEventListener("click", async () => {
      const selectedModel = testSpeedModelSelect.value;
      if (!selectedModel) {
        showToast("Please select a model first.", "error");
        return;
      }

      const targetContextThreshold = parseInt(testSpeedContextSlider.value);

      // Transition UI
      if (testModelSpeedModal) {
        testModelSpeedModal.classList.remove("open");
        setTimeout(() => (testModelSpeedModal.style.display = "none"), 300);
      }
      if (telemetryDashboardModal) {
        telemetryDashboardModal.style.display = "flex";
        setTimeout(() => telemetryDashboardModal.classList.add("open"), 10);
      }

      // Dashboard Reset
      telemetryModelName.textContent = selectedModel;
      testSpeedStatus.textContent =
        "Unloading & Loading (may take a moment)...";
      testSpeedStatus.style.color = "var(--color-blue-400)";
      testSpeedTokensGen.textContent = "0";
      testSpeedTtft.textContent = "-";
      testSpeedPrefillTps.textContent = "-";
      testSpeedCurrentTps.textContent = "-";

      // Chart Setup
      const ctx = telemetryChartFileSystem.getContext("2d");
      const telemetryDataPoints = []; // Array of {tokens, tps}

      function drawTelemetryChart() {
        if (!ctx) return;

        // Handle high-DPI displays
        const rect = telemetryChartFileSystem.getBoundingClientRect();
        telemetryChartFileSystem.width = rect.width * window.devicePixelRatio;
        telemetryChartFileSystem.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        const width = rect.width;
        const height = rect.height;
        const paddingLeft = 45;
        const paddingBottom = 35;
        const paddingTop = 20;
        const paddingRight = 20;
        const plotWidth = width - paddingLeft - paddingRight;
        const plotHeight = height - paddingTop - paddingBottom;

        ctx.clearRect(0, 0, width, height);

        if (telemetryDataPoints.length === 0) return;

        // Determine max values for scaling
        let minX = telemetryDataPoints[0].tokens;
        let maxX = telemetryDataPoints[telemetryDataPoints.length - 1].tokens;
        let rangeX = maxX - minX;
        if (rangeX === 0) rangeX = 1; // Prevent division by zero

        let maxY = Math.max(...telemetryDataPoints.map((p) => p.tps), 10); // Floor of 10 TPS
        maxY = maxY * 1.2; // Add 20% headroom

        // Draw Grid & Labels
        ctx.lineWidth = 1;
        ctx.font = "10px monospace";
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        // Horizontal lines (Y-axis)
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        for (let i = 0; i <= 4; i++) {
          const y = paddingTop + plotHeight * (i / 4);
          // Draw grid line
          ctx.moveTo(paddingLeft, y);
          ctx.lineTo(width - paddingRight, y);

          // Draw label
          const labelValue = (maxY - maxY * (i / 4)).toFixed(0);
          ctx.fillText(labelValue, paddingLeft - 10, y);
        }
        ctx.stroke();

        // Vertical lines (X-axis) - Dynamic 'Nice Ticks'
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";

        // Calculate a clean step size based on range
        let tickStep;
        if (rangeX <= 500) tickStep = 50;
        else if (rangeX <= 2500) tickStep = 250;
        else if (rangeX <= 10000) tickStep = 1000;
        else if (rangeX <= 50000) tickStep = 5000;
        else tickStep = 10000;

        // Find the first clean multiple of tickStep that is >= minX
        let currentTick = Math.ceil(minX / tickStep) * tickStep;

        while (currentTick <= maxX) {
          const x = paddingLeft + ((currentTick - minX) / rangeX) * plotWidth;

          // Draw grid line
          ctx.moveTo(x, paddingTop);
          ctx.lineTo(x, height - paddingBottom);

          // Draw label
          let labelText;
          if (tickStep >= 1000) {
            labelText = (currentTick / 1000).toFixed(0) + "k";
          } else {
            // For small steps, use 1 decimal if needed, but drop .0
            labelText = (currentTick / 1000).toFixed(1).replace(".0", "") + "k";
          }

          ctx.fillText(labelText, x, height - paddingBottom + 10);

          currentTick += tickStep;
        }
        ctx.stroke();

        // Create gradient for fill
        const gradient = ctx.createLinearGradient(
          0,
          paddingTop,
          0,
          height - paddingBottom,
        );
        gradient.addColorStop(0, "rgba(16, 185, 129, 0.4)"); // Emerald
        gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");

        // Draw Filled Area
        ctx.beginPath();
        telemetryDataPoints.forEach((point, index) => {
          const x = paddingLeft + ((point.tokens - minX) / rangeX) * plotWidth;
          const y = height - paddingBottom - (point.tps / maxY) * plotHeight;
          if (index === 0) {
            ctx.moveTo(x, height - paddingBottom);
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });

        if (telemetryDataPoints.length > 0) {
          const lastPoint = telemetryDataPoints[telemetryDataPoints.length - 1];
          const lastX =
            paddingLeft + ((lastPoint.tokens - minX) / rangeX) * plotWidth;
          const firstPoint = telemetryDataPoints[0];
          const firstX =
            paddingLeft + ((firstPoint.tokens - minX) / rangeX) * plotWidth;
          ctx.lineTo(lastX, height - paddingBottom);
          ctx.lineTo(firstX, height - paddingBottom);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Draw Waveform Line
        ctx.beginPath();
        ctx.strokeStyle = "var(--color-emerald)";
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "var(--color-emerald)";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        telemetryDataPoints.forEach((point, index) => {
          const x = paddingLeft + ((point.tokens - minX) / rangeX) * plotWidth;
          const y = height - paddingBottom - (point.tps / maxY) * plotHeight;

          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();

        // Draw Data Points
        ctx.shadowBlur = 0;
        telemetryDataPoints.forEach((point) => {
          const x = paddingLeft + ((point.tokens - minX) / rangeX) * plotWidth;
          const y = height - paddingBottom - (point.tps / maxY) * plotHeight;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = "var(--color-neutral-900)";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "var(--color-emerald)";
          ctx.stroke();
        });
      }

      // Initial empty draw
      drawTelemetryChart();

      try {
        let requestStartTime = Date.now();
        const response = await fetch("/api/models/test-speed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            target_context_threshold: targetContextThreshold,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Server error");
        }

        testSpeedStatus.textContent = "Streaming Generation...";
        testSpeedStatus.style.color = "var(--color-green-400)";

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let ttftLogged = false;
        let currentTurnTokens = 0;

        let buffer = "";

        // Aggregates
        let totalTtftSum = 0;
        let totalPrefillTpsSum = 0;
        let totalDecodeTpsSum = 0;
        let turnCount = 0;

        // Temporary storage to sync timings and usage
        let currentTurnDecodeTps = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop(); // Keep the last incomplete line

          for (let line of lines) {
            line = line.trim();
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.substring(6));

                if (data.error) {
                  throw new Error(data.error);
                }

                if (data.test_status) {
                  testSpeedStatus.textContent = data.test_status;
                  if (data.test_status.startsWith("Completed")) {
                    testSpeedStatus.style.color = "var(--color-green-400)";
                  } else {
                    testSpeedStatus.style.color = "var(--color-blue-400)";
                  }
                  if (data.test_status.startsWith("Starting Turn")) {
                    ttftLogged = false;
                  }
                }

                if (
                  data.choices &&
                  data.choices.length > 0 &&
                  data.choices[0].delta &&
                  "content" in data.choices[0].delta
                ) {
                  if (!ttftLogged) {
                    ttftLogged = true;
                    testSpeedStatus.textContent = "Streaming Generation...";
                    testSpeedStatus.style.color = "var(--color-green-400)";
                  }
                }

                // Handle native timings block if available
                if (data.timings) {
                  turnCount++;
                  const ttft = data.timings.prompt_ms;
                  const prefillTps =
                    data.timings.prompt_n / (data.timings.prompt_ms / 1000);
                  currentTurnDecodeTps =
                    data.timings.predicted_n /
                    (data.timings.predicted_ms / 1000);

                  totalTtftSum += ttft;
                  totalPrefillTpsSum += prefillTps;
                  totalDecodeTpsSum += currentTurnDecodeTps;

                  const avgTtft = (totalTtftSum / turnCount).toFixed(0);
                  const avgPrefill = (totalPrefillTpsSum / turnCount).toFixed(
                    2,
                  );
                  const avgDecode = (totalDecodeTpsSum / turnCount).toFixed(2);

                  testSpeedTtft.textContent = `${avgTtft}`;
                  testSpeedPrefillTps.textContent = `${avgPrefill}`;
                  testSpeedCurrentTps.textContent = `${avgDecode}`;

                  const prompt_n = data.timings.prompt_n || 0;
                  const predicted_n = data.timings.predicted_n || 0;
                  // Fallback context size if usage block doesn't come
                  if (
                    prompt_n + predicted_n > 0 &&
                    (!data.usage || !data.usage.total_tokens)
                  ) {
                    currentTurnTokens = prompt_n + predicted_n;
                    testSpeedTokensGen.textContent =
                      currentTurnTokens.toString();
                  }
                }

                if (data.usage && data.usage.total_tokens) {
                  currentTurnTokens = data.usage.total_tokens;
                  testSpeedTokensGen.textContent = currentTurnTokens.toString();
                }

                // Sync Plotting
                if (currentTurnTokens > 0 && currentTurnDecodeTps !== null) {
                  telemetryDataPoints.push({
                    tokens: currentTurnTokens,
                    tps: currentTurnDecodeTps,
                  });
                  drawTelemetryChart();
                  currentTurnDecodeTps = null; // Reset for next turn
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        if (testSpeedStatus.textContent === "Streaming Generation...") {
          testSpeedStatus.textContent = "Completed";
        }
      } catch (err) {
        testSpeedStatus.textContent = "Failed";
        testSpeedStatus.style.color = "var(--color-rose-500)";
        testSpeedCurrentTps.textContent = err.message;
      }
    });
  }

  // Theme Radios
  themeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.checked) {
        themeMode = e.target.value;
        localStorage.setItem("my_ai_theme_mode", themeMode);
        applyTheme();
      }
    });
  });

  // Browser Stealth Radios
  async function updateBrowserStealth(level) {
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
  }

  stealthRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.checked) {
        updateBrowserStealth(e.target.value);
      }
    });
  });

  // Initialize Browser Stealth from server
  async function initBrowserStealth() {
    try {
      const res = await fetch("/api/tools/config/browser");
      if (res.ok) {
        const data = await res.json();
        stealthRadios.forEach((radio) => {
          if (radio.value === data.stealth_level) radio.checked = true;
        });
      }
    } catch (err) {
      console.error("Error fetching browser stealth config:", err);
    }
  }
  initBrowserStealth();

  // Agent Config Implementation
  async function fetchAgentsConfig() {
    try {
      const res = await fetch("/api/tools/config/agents");
      if (res.ok) {
        agentsConfig = await res.json();
      }
    } catch (err) {
      console.error("Error fetching agents config:", err);
    }
  }

  function openAgentConfig(agentName) {
    currentEditingAgent = agentName;
    const config = agentsConfig[agentName];
    if (!config) return;

    // Set title
    const labels = {
      file_agent: "File Agent",
      file_system_agent: "FileSystem Agent",
      browsing_agent: "Browsing Agent",
      search_web: "Search Agent",
      visit_page: "Visit Page Agent"
    };
    agentConfigTitle.textContent = labels[agentName] || agentName;

    // Sync UI
    const btns = agentThinkingProfileSelector.querySelectorAll(".profile-btn");
    btns.forEach(b => b.classList.toggle("active", b.dataset.profile === config.thinking_profile));

    agentMaxTokensSlider.value = config.max_tokens;
    agentMaxTokensVal.textContent = config.max_tokens;
    agentThinkingBudgetSlider.value = config.thinking_budget;
    agentThinkingBudgetVal.textContent = config.thinking_budget;

    agentConfigModal.style.display = "flex";
    setTimeout(() => agentConfigModal.classList.add("open"), 10);
  }

  function closeAgentConfig() {
    agentConfigModal.classList.remove("open");
    setTimeout(() => {
      agentConfigModal.style.display = "none";
    }, 300);
  }

  agentConfigBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      openAgentConfig(btn.dataset.agent);
    });
  });

  closeAgentConfigBtn.addEventListener("click", closeAgentConfig);

  agentThinkingProfileSelector.addEventListener("click", (e) => {
    const btn = e.target.closest(".profile-btn");
    if (btn) {
      const profile = btn.dataset.profile;
      agentsConfig[currentEditingAgent].thinking_profile = profile;
      const btns = agentThinkingProfileSelector.querySelectorAll(".profile-btn");
      btns.forEach(b => b.classList.toggle("active", b.dataset.profile === profile));
    }
  });

  agentMaxTokensSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    agentsConfig[currentEditingAgent].max_tokens = val;
    agentMaxTokensVal.textContent = val;
  });

  agentThinkingBudgetSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    agentsConfig[currentEditingAgent].thinking_budget = val;
    agentThinkingBudgetVal.textContent = val;
  });

  saveAgentConfigBtn.addEventListener("click", async () => {
    const agent = currentEditingAgent;
    const config = agentsConfig[agent];
    
    try {
      const res = await fetch(`/api/tools/config/agents/${agent}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      
      if (res.ok) {
        closeAgentConfig();
        await showAlert("Success", `${agent} configuration saved.`);
      } else {
        throw new Error("Failed to save config");
      }
    } catch (err) {
      console.error("Error saving agent config:", err);
      await showAlert("Error", "Failed to save configuration.");
    }
  });

  fetchAgentsConfig();

  // --- Browser Portal Implementation (Proxied noVNC) ---
  const portalModal = document.getElementById("browser-portal-modal");
  const openPortalBtn = document.getElementById("open-browser-portal");
  const closePortalBtn = document.getElementById("close-browser-portal");
  const portalIframe = document.getElementById("portal-iframe");

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
  const portalLoadingOverlay = document.getElementById(
    "portal-loading-overlay",
  );
  const portalErrorOverlay = document.getElementById("portal-error-overlay");
  const portalErrorMessage = document.getElementById("portal-error-message");
  const portalRetryBtn = document.getElementById("portal-retry-btn");
  const portalStatusText = document.getElementById("portal-status-text");

  async function initBrowserPortal() {
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
          portalStatusText.textContent =
            "Connected (stream may still be loading).";
        }
      }, 15000);
    } catch (err) {
      console.error("Portal init failed:", err);
      portalLoadingOverlay.style.display = "none";
      portalErrorOverlay.classList.remove("hidden");
      portalErrorMessage.textContent =
        err.message || "Could not reach the browser service.";
      portalStatusText.textContent = "Connection failed.";
    }
  }

  openPortalBtn.addEventListener("click", () => {
    portalModal.classList.add("open");
    initBrowserPortal();
  });

  closePortalBtn.addEventListener("click", () => {
    portalModal.classList.remove("open");
    portalIframe.src = ""; // Disconnect VNC
    portalStatusText.textContent = "Disconnected.";
  });

  if (portalRetryBtn) {
    portalRetryBtn.addEventListener("click", () => initBrowserPortal());
  }

  // New Chat Defaults Event Listeners
  if (defaultThinkingProfileSelector) {
    defaultThinkingProfileSelector.addEventListener("click", (e) => {
      const btn = e.target.closest(".profile-btn");
      if (btn) {
        chatDefaults.thinkingProfile = btn.dataset.profile;
        localStorage.setItem(
          "my_ai_chat_defaults",
          JSON.stringify(chatDefaults),
        );

        // Update UI active state
        const btns =
          defaultThinkingProfileSelector.querySelectorAll(".profile-btn");
        btns.forEach((b) =>
          b.classList.toggle(
            "active",
            b.dataset.profile === chatDefaults.thinkingProfile,
          ),
        );
      }
    });
  }

  if (defaultPreferencesToggle) {
    defaultPreferencesToggle.addEventListener("click", () => {
      chatDefaults.userPreferences = !chatDefaults.userPreferences;
      defaultPreferencesToggle.classList.toggle(
        "active",
        chatDefaults.userPreferences,
      );
      localStorage.setItem("my_ai_chat_defaults", JSON.stringify(chatDefaults));
    });
  }

  if (defaultMaxTokensSlider) {
    defaultMaxTokensSlider.addEventListener("input", (e) => {
      chatDefaults.maxTokens = parseInt(e.target.value);
      if (defaultMaxTokensVal)
        defaultMaxTokensVal.textContent = chatDefaults.maxTokens.toString();
    });
    defaultMaxTokensSlider.addEventListener("change", () => {
      localStorage.setItem("my_ai_chat_defaults", JSON.stringify(chatDefaults));
    });
  }

  if (defaultThinkingBudgetSlider) {
    defaultThinkingBudgetSlider.addEventListener("input", (e) => {
      chatDefaults.thinkingBudgetTokens = parseInt(e.target.value);
      if (defaultThinkingBudgetVal)
        defaultThinkingBudgetVal.textContent =
          chatDefaults.thinkingBudgetTokens.toString();
    });
    defaultThinkingBudgetSlider.addEventListener("change", () => {
      localStorage.setItem("my_ai_chat_defaults", JSON.stringify(chatDefaults));
    });
  }

  if (sysClearAllChatsBtn) {
    sysClearAllChatsBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (
        await showConfirm(
          "Clear All Chats",
          "Are you sure you want to delete ALL chat conversations? This cannot be undone.",
          true,
        )
      ) {
        try {
          const response = await fetch(`${API_MODULES.CHATS}/`, {
            method: "DELETE",
          });
          if (response.ok) {
            savedChats = [];
            startNewChat();
            renderChatList();
            closeSystemSettings();
            await showAlert(
              "Success",
              "All chat conversations have been cleared.",
            );
          }
        } catch (e) {
          console.error("Error clearing chats:", e);
        }
      }
    });
  }

  if (sysResetAppBtn) {
    sysResetAppBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (
        await showConfirm(
          "Reset App",
          "Are you sure you want to clear your connection settings? This will require a re-authorization.",
          true,
        )
      ) {
        localStorage.removeItem("my_ai_server_link");
        localStorage.removeItem("my_ai_api_token_secure");
        localStorage.removeItem("my_ai_selected_model");
        localStorage.removeItem("my_ai_selected_model_name");
        localStorage.removeItem("my_ai_theme_mode");
        location.reload();
      }
    });
  }

  // User Preferences UI Logic
  let allPreferences = [];

  const loadPreferences = async () => {
    try {
      const res = await fetch(
        `${API_MODULES.TOOLS}/preferences?chat_id=${currentChatId}`,
      );
      const data = await res.json();
      if (data.success) {
        allPreferences = data.preferences;
        renderPreferences();
      }
    } catch (e) {
      console.error("Error loading memories:", e);
    }
  };

  const renderPreferences = () => {
    if (!preferencesListContainer) return;
    preferencesListContainer.innerHTML = "";

    let filtered = [...allPreferences];

    // Filter by Tag
    const tagFilter = preferencesFilterSelect.value;
    if (tagFilter !== "all") {
      filtered = filtered.filter((m) => m.tag === tagFilter);
    }

    // Search
    const query = preferencesSearchInput.value.toLowerCase();
    if (query) {
      filtered = filtered.filter((m) =>
        m.content.toLowerCase().includes(query),
      );
    }

    // Sort
    const sortMode = preferencesSortSelect.value;
    if (sortMode === "newest") {
      filtered.sort((a, b) => b.timestamp - a.timestamp);
    } else {
      filtered.sort((a, b) => a.timestamp - b.timestamp);
    }

    if (filtered.length === 0) {
      preferencesListContainer.innerHTML = `<div class="text-center" style="color: var(--content-muted); padding: 2rem;">No preferences found.</div>`;
      return;
    }

    filtered.forEach((mem) => {
      const item = document.createElement("div");
      item.className = "hardware-surface";
      item.style.padding = "1rem";
      item.style.display = "flex";
      item.style.flexDirection = "column";
      item.style.gap = "0.5rem";

      const tagColorMap = {
        user_preference: "var(--color-primary-500)",
        user_profile: "var(--brand-accent-1)",
        environment_global: "var(--color-emerald)",
        explicit_fact: "var(--color-amber)",
      };
      const tagColor = tagColorMap[mem.tag] || "var(--content-muted)";

      const dateStr = new Date(mem.timestamp * 1000).toLocaleString();

      item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: ${tagColor}; border: 1px solid ${tagColor}; padding: 2px 6px; border-radius: 4px;">${mem.tag.replace("_", " ")}</span>
                            <span style="font-size: 0.7rem; color: var(--content-muted);">${dateStr}</span>
                        </div>
                        <div style="font-size: 0.95rem; color: var(--content-primary); line-height: 1.5; white-space: pre-wrap;">${escapeHtml(mem.content)}</div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-ghost edit-mem-btn" title="Edit" style="padding: 0.5rem;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                        <button class="btn-ghost delete-mem-btn" title="Delete" style="padding: 0.5rem; color: var(--color-rose-500);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            `;

      item
        .querySelector(".edit-mem-btn")
        .addEventListener("click", () => openEditPreferenceModal(mem));
      item
        .querySelector(".delete-mem-btn")
        .addEventListener("click", async () => {
          if (
            await showConfirm(
              "Delete Preference",
              "Are you sure you want to delete this preference?",
            )
          ) {
            try {
              const res = await fetch(
                `${API_MODULES.TOOLS}/preferences/${mem.id}?chat_id=${currentChatId}`,
                { method: "DELETE" },
              );
              if (res.ok) {
                loadPreferences();
              }
            } catch (e) {
              console.error("Failed to delete", e);
            }
          }
        });

      preferencesListContainer.appendChild(item);
    });
  };

  if (preferencesSearchInput)
    preferencesSearchInput.addEventListener("input", renderPreferences);
  if (preferencesFilterSelect)
    preferencesFilterSelect.addEventListener("change", renderPreferences);
  if (preferencesSortSelect)
    preferencesSortSelect.addEventListener("change", renderPreferences);

  if (sysManagePreferencesBtn) {
    sysManagePreferencesBtn.addEventListener("click", () => {
      closeSystemSettings();
      if (preferencesFileSystemOverlay) {
        preferencesFileSystemOverlay.classList.remove("hidden");
        setTimeout(() => preferencesFileSystemOverlay.classList.add("open"), 10);
        loadPreferences();
      }
    });
  }

  if (closePreferencesBtn) {
    closePreferencesBtn.addEventListener("click", () => {
      preferencesFileSystemOverlay.classList.remove("open");
      setTimeout(() => preferencesFileSystemOverlay.classList.add("hidden"), 300);
    });
  }

  /**
   * Opens a prompt modal to add a new preference or edit an existing one.
   * Manually creates textarea and select elements for granular control.
   * @param {object} mem - Existing preference object for editing (null for new).
   */
  const openEditPreferenceModal = async (mem = null) => {
    const isEdit = !!mem;
    const inputEl = document.getElementById("prompt-input");
    const parent = inputEl.parentNode;

    // Custom UI injectors for preferences dialog
    const textarea = document.createElement("textarea");
    textarea.className = "input-primary";
    textarea.style.minHeight = "120px";
    textarea.placeholder = "Enter key details to remember...";
    if (isEdit) textarea.value = mem.content;

    const tagSelect = document.createElement("select");
    tagSelect.className = "select-primary";
    tagSelect.innerHTML = `
            <option value="user_preference">User Preference</option>
            <option value="user_profile">User Profile</option>
            <option value="environment_global">Environment Fact</option>
            <option value="explicit_fact">Explicit Fact</option>
        `;
    if (isEdit) tagSelect.value = mem.tag;

    parent.insertBefore(textarea, inputEl);
    parent.insertBefore(tagSelect, inputEl);
    inputEl.style.display = "none";

    const result = await new Promise((resolve) => {
      const modal = document.getElementById("prompt-modal");
      const titleEl = document.getElementById("prompt-title");
      const msgEl = document.getElementById("prompt-message");
      const confirmBtn = document.getElementById("prompt-action-btn");
      const cancelBtn = document.getElementById("prompt-cancel-btn");
      const selectContainer = document.getElementById(
        "prompt-select-container",
      );

      selectContainer.style.display = "none";
      titleEl.textContent = isEdit ? "Edit Preference" : "Add Preference";
      msgEl.textContent = "Provide the fact and select its category:";
      confirmBtn.textContent = "Save Preference";
      cancelBtn.textContent = "Cancel";

      const iconSvg = document.getElementById("prompt-icon-svg");
      if (iconSvg) {
        iconSvg.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 8.125A5.002 5.002 0 0 0 14 18a5 5 0 0 0 4-8 4.003 4.003 0 0 0-3-6.912Q13.5 3 12 5Z"/><path d="M9 18q4.5 0 4.5-4.5c0-4.5 4.5-4.5 4.5-4.5"/><path d="M12 5v14"/></svg>`;
      }

      modal.style.display = "flex";
      void modal.offsetWidth;
      modal.classList.add("open");
      textarea.focus();

      const cleanup = () => {
        modal.classList.remove("open");
        setTimeout(() => {
          modal.style.display = "none";
          textarea.remove();
          tagSelect.remove();
          inputEl.style.display = "block";
        }, 300);
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
      };

      confirmBtn.onclick = () => {
        const content = textarea.value.trim();
        const tag = tagSelect.value;
        cleanup();
        resolve(content ? { content, tag } : null);
      };

      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };
    });

    // Backend Sync
    if (result) {
      try {
        if (isEdit) {
          await fetch(
            `${API_MODULES.TOOLS}/preferences/${mem.id}?chat_id=${currentChatId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            },
          );
        } else {
          await fetch(
            `${API_MODULES.TOOLS}/preferences?chat_id=${currentChatId}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            },
          );
        }
        loadPreferences();
      } catch (e) {
        console.error("Failed to save preference", e);
      }
    }
  };

  if (preferencesAddBtn)
    preferencesAddBtn.addEventListener("click", () =>
      openEditPreferenceModal(),
    );

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
   * Settings Lifecycle Logic
   */
  const openSettings = () => {
    if (settingsModal) {
      settingsModal.style.display = "flex";
      setTimeout(() => settingsModal.classList.add("open"), 10);
      setScrollLock(true);
    }
  };

  const closeSettings = () => {
    if (settingsModal) {
      settingsModal.classList.remove("open");
      setTimeout(() => {
        settingsModal.style.display = "none";
        setScrollLock(false);
      }, 300);
    }
  };

  if (settingsTrigger)
    settingsTrigger.addEventListener("click", async (e) => {
      e.preventDefault();
      openSettings();
      await updateModelStatusUI(); // Ensure model activity status is fresh
    });

  if (closeSettingsBtn)
    closeSettingsBtn.addEventListener("click", closeSettings);
  if (closeSettingsActionBtn)
    closeSettingsActionBtn.addEventListener("click", closeSettings);

  // Tab Interface within Settings Modal
  tabItems.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabItems.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => {
        c.classList.remove("active");
        c.classList.add("hidden");
      });

      tab.classList.add("active");
      const targetContent = document.getElementById(`tab-${tab.dataset.tab}`);
      if (targetContent) {
        targetContent.classList.remove("hidden");
        targetContent.classList.add("active");
      }
    });
  });

  // Close modal on backdrop click
  window.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      closeSettings();
    }
  });

  const attachBtn = document.getElementById("attach-btn");

  /**
   * Determines MIME type based on File API or extension fallback.
   */
  function getFileType(file) {
    if (file.type) return file.type;
    const ext = file.name.split(".").pop().toLowerCase();
    const extToMime = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      txt: "text/plain",
      csv: "text/csv",
      md: "text/markdown",
      json: "application/json",
      js: "application/javascript",
      py: "text/x-python",
      html: "text/html",
      css: "text/css",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      heic: "image/heic",
      mp4: "video/mp4",
      webm: "video/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
    };
    return extToMime[ext] || "";
  }

  /**
   * File Upload Pipeline
   * Handles validation, optimistic UI preview, and backend upload via XHR for progress tracking.
   */
  async function handleFileUpload(file) {
    const fileType = getFileType(file);
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
      "text/markdown",
      "application/json",
      "application/javascript",
      "text/x-python",
      "text/html",
      "text/css",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/heic",
      "video/mp4",
      "video/webm",
      "audio/mpeg",
      "audio/wav",
    ];

    // Capability Validation: Legacy blocks multimedia if the current model lacks Vision capability
    // This is now handled by the Agentic File Tool which routes to vision models on the backend.

    if (!allowedTypes.includes(fileType)) {
      // Fallback: Heuristic check for readable text
      const isReadable = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const arr = new Uint8Array(e.target.result);
          for (let i = 0; i < arr.length; i++) {
            if (arr[i] === 0) {
              resolve(false); // Found null byte, likely binary
              return;
            }
          }
          resolve(true); // No null bytes, assume safe text
        };
        reader.onerror = () => resolve(false);
        // Read up to first 1024 bytes
        const slice = file.slice(0, Math.min(file.size, 1024));
        reader.readAsArrayBuffer(slice);
      });

      if (!isReadable) {
        await showAlert(
          "File Type Not Supported",
          `${file.name} appears to be a binary file and is not supported. Only text, code, and media files are allowed.`,
        );
        return;
      }
    }

    if (file.size > 100 * 1024 * 1024) {
      // 100MB limit
      await showAlert(
        "File Too Large",
        `${file.name} exceeds the 100MB limit.`,
      );
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("chat_id", currentChatId);

    // Render Optimistic Upload Item
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.innerHTML = `
            <div class="file-icon">
                <div class="upload-spinner" style="width: 16px; height: 16px; border: 2px solid currentColor; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-meta">
                    <span class="upload-status">Uploading...</span>
                    <span class="upload-size">${formatFileSize(0)} / ${formatFileSize(file.size)}</span>
                </div>
            </div>
            <button class="remove-file-btn" title="Remove file"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        `;

    const removeBtn = fileItem.querySelector(".remove-file-btn");
    removeBtn.addEventListener("click", () => {
      uploadedFiles = uploadedFiles.filter(
        (f) => f.name === file.name && !f.file_id,
      );
      if (fileItem.parentNode) fileItem.parentNode.removeChild(fileItem);
      checkSendButtonState();
    });

    if (filePreviewContainer) {
      filePreviewContainer.classList.remove("hidden");
      filePreviewContainer.appendChild(fileItem);
    }
    checkSendButtonState();

    try {
      // --- Phase 1: Physical Upload ---
      const uploadResult = await uploadFileWithProgress(
        file,
        formData,
        (loaded, total) => {
          const percent = Math.round((loaded / total) * 100);
          const statusEl = fileItem.querySelector(".upload-status");
          const sizeEl = fileItem.querySelector(".upload-size");
          if (statusEl) statusEl.textContent = `Uploading ${percent}%`;
          if (sizeEl)
            sizeEl.textContent = `${formatFileSize(loaded)} / ${formatFileSize(file.size)}`;
        },
      );

      // --- Phase 2: Server-Side Processing ---
      const statusEl = fileItem.querySelector(".upload-status");
      const spinnerEl = fileItem.querySelector(".upload-spinner");
      const sizeEl = fileItem.querySelector(".upload-size");
      if (statusEl) statusEl.textContent = "Processing...";
      if (sizeEl) sizeEl.textContent = formatFileSize(file.size);

      const fileData = {
        file_id: uploadResult.file_id,
        name: uploadResult.original_filename,
        size: uploadResult.file_size,
        mime_type: uploadResult.mime_type,
      };
      uploadedFiles.push(fileData);

      /**
       * Polling loop for processing status (extraction, embedding, etc).
       */
      const pollProcessingStatus = async () => {
        try {
          const response = await fetch(
            `${API_MODULES.FILES}/${fileData.file_id}/status`,
          );
          if (response.ok) {
            const result = await response.json();
            const status = result.processing_status;

            if (!status) {
              setTimeout(pollProcessingStatus, 1000);
              return;
            }

            if (status === "completed") {
              if (fileItem.parentNode) {
                fileItem.innerHTML = `
                                    <div class="file-icon file-type-icon ${getIconClassForMime(fileData.mime_type)}">${getIconHtmlForMime(fileData.mime_type)}</div>
                                    <div class="file-info">
                                        <div class="file-name">${fileData.name}</div>
                                        <div class="file-meta"><span class="file-status">Ready</span><span class="file-size">${formatFileSize(fileData.size)}</span></div>
                                    </div>
                                    <button class="remove-file-btn" title="Remove file"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                `;
                const newRemoveBtn = fileItem.querySelector(".remove-file-btn");
                newRemoveBtn.addEventListener("click", () => {
                  uploadedFiles = uploadedFiles.filter(
                    (f) => f.file_id !== fileData.file_id,
                  );
                  if (fileItem.parentNode)
                    fileItem.parentNode.removeChild(fileItem);
                  checkSendButtonState();
                });
              }
              checkSendButtonState(); // Enable send button when all processed
            } else if (status === "failed") {
              if (fileItem.parentNode) {
                const statusEl = fileItem.querySelector(".upload-status");
                if (statusEl) statusEl.textContent = "Processing Failed";
              }
              checkSendButtonState();
            } else {
              setTimeout(pollProcessingStatus, 1000);
            }
          } else {
            setTimeout(pollProcessingStatus, 1000);
          }
        } catch (error) {
          setTimeout(pollProcessingStatus, 1000);
        }
      };
      pollProcessingStatus();
    } catch (error) {
      console.error("File upload error:", error);
      const statusEl = fileItem.querySelector(".upload-status");
      if (statusEl) statusEl.textContent = "Upload Failed";
      await showAlert(
        "File Upload Failed",
        error.message || "An error occurred while uploading.",
      );
      uploadedFiles = uploadedFiles.filter(
        (f) => f.name === file.name && !f.file_id,
      );
      setTimeout(() => {
        if (fileItem.parentNode) fileItem.parentNode.removeChild(fileItem);
        checkSendButtonState();
      }, 2000);
    }
  }

  // Helper function to upload file with progress tracking
  function uploadFileWithProgress(file, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded, event.total);
        }
      };

      xhr.onload = () => {
        try {
          const contentType = xhr.getResponseHeader("content-type");
          let result;
          if (contentType && contentType.includes("application/json")) {
            result = JSON.parse(xhr.responseText);
          } else {
            result = { success: false, error: `Server returned ${xhr.status}` };
          }

          if (xhr.status === 200 && result.success) {
            resolve(result);
          } else {
            let errorMsg =
              result.error || `Upload failed with status ${xhr.status}`;
            if (xhr.status === 413) {
              errorMsg = "File too large. Maximum size is 100MB.";
            }
            reject(new Error(errorMsg));
          }
        } catch (e) {
          reject(new Error("Failed to parse upload response"));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error during upload"));
      };

      xhr.ontimeout = () => {
        reject(new Error("Upload timed out"));
      };

      xhr.open("POST", `${API_MODULES.FILES}/upload`, true);
      xhr.timeout = 3600000; // 1 hour timeout for very large files on slow hardware
      xhr.setRequestHeader("Accept", "application/json");
      xhr.send(formData);
    });
  }

  // → formatFileSize, getIconClassForMime, getIconHtmlForMime moved to static/js/utils.js

  // Attach button - opens file picker
  if (attachBtn) {
    attachBtn.addEventListener("click", () => {
      fileInput.click();
    });
  }

  // File Upload State
  const fileInput = document.getElementById("file-input");
  const fileUploadZone = document.getElementById("file-upload-zone");
  const filePreviewContainer = document.getElementById(
    "file-preview-container",
  );
  let uploadedFiles = []; // Array of { file_id, name, size, mime_type }

  // File Upload Event Listeners
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      for (const file of files) {
        await handleFileUpload(file);
      }
      fileInput.value = ""; // Reset input
    });
  }

  if (fileUploadZone) {
    // Click to open file picker (shows zone for attach button toggle)
    fileUploadZone.addEventListener("click", () => {
      fileInput.click();
    });

    fileUploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      fileUploadZone.classList.add("dragover");
    });

    fileUploadZone.addEventListener("dragleave", () => {
      fileUploadZone.classList.remove("dragover");
    });

    fileUploadZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      fileUploadZone.classList.remove("dragover");

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        for (const file of files) {
          await handleFileUpload(file);
        }
      }
    });
  }

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
    if (isGenerating || (!selectedModel && !isResume && !isReattach)) return;

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
      !uploadedFiles.length &&
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
        const sentFiles = [...uploadedFiles];
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
      await unloadAllModels([selectedModel]);
    }

    // Block follow-up messages in Research mode ONLY if an active execution is underway
    const indexApproval = chatHistory.findIndex(
      (m) =>
        m.content === "Plan Approved. Proceed with research." ||
        m.content === "Proceed with research.",
    );
    const isExecuting =
      isResearchMode && indexApproval > -1 && !isResearchCompleted;

    if (
      isResearchMode &&
      isExecuting &&
      !isResume &&
      !approvedPlanPayload &&
      !resumeState
    ) {
      await showAlert(
        "Research in Progress",
        "Research is currently executing. You can chat once the final report is generated.",
      );
      isGenerating = false;
      updateUIState(false);
      return;
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
    const sentFiles = [...uploadedFiles];

    let reqModel = selectedModel;
    let reqModelName = selectedModelName;

    try {
      const requestBody = {
        model: reqModel,
        lastModelName: reqModelName,
        messages: messages,
        userPreferences: isUserPreferences,
        researchMode: isResearchMode,
        visionEnabled: isVisionEnabled,
        fileSystemMode: fileSystemMode,
        browsingMode: browsingMode,
        persona_id: selectedPersonaId,

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
      uploadedFiles = [];
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
        loadChat(currentChatId, false);
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
      let liveSubAgentHistory = [];
      let displayReasoning = ""; // Clean accumulator for live thought bubble rendering
      let historyContentStartIdx = 0;
      let historyReasoningStartIdx = 0;
      let buffer = "";
      let usageCounted = false;
      let isReasoningPhase = true; // Track if we're still in reasoning-only mode
      let contentStarted = false; // Track if actual content has started
      let assistantMessagePushed = false; // Track if assistant message was already pushed to chatHistory
      let actualModelName = selectedModelName; // Fallback
      
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
        modelLabel.textContent = resolveModelDisplayName(actualModelName);
        modelLabel.closest(".bot-message-footer").style.display = "flex";
      }

      // Backend handles persistence, so we just reload list to get updated timestamp
      if (!isTemporaryChat && currentChatId) {
        // Update local model tracker
        if (currentChatData) {
          currentChatData.last_model = selectedModelName;
        }

        // Explicitly sync the last model to the backend immediately
        // This ensures it's saved even if the chat save endpoint doesn't catch it
        fetch(`${API_MODULES.CHATS}/${currentChatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ last_model: selectedModelName }),
        }).catch((e) => console.error("Error updating last model:", e));

        // Delay slightly to ensure backend commit
        setTimeout(loadChats, 1000);
      }

      // Sync the full chat state natively with the DB now that the turn is complete
      if (currentChatId) {
        await loadChat(currentChatId, false);
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
      setTimeout(renderMermaidBlocks, 100);

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

        setScrollLock(container.classList.contains("expanded"));
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

  /**
   * Handles message deletion with DB synchronization.
   * Deletes the message and all subsequent messages to maintain context integrity.
   */
  async function deleteMessageAction(btn) {
    if (isGenerating) {
      await showAlert(
        "Generation in Progress",
        "Please wait for the current response to finish.",
      );
      return;
    }
    const row = btn.closest(".message-row");
    const messageId = row.dataset.messageId;
    if (!messageId) {
      console.error("deleteMessageAction: messageId missing from row");
      return;
    }

    const confirmed = await showConfirm(
      "Delete Message",
      "Delete this message and all subsequent history permanently?",
    );
    if (!confirmed) return;

    if (currentChatId && !isTemporaryChat) {
      try {
        const res = await fetch(
          `${API_MODULES.CHATS}/${currentChatId}/messages/${messageId}`,
          {
            method: "DELETE",
          },
        );
        if (res.ok) {
          // Refresh history to ensure UI sync
          loadChat(currentChatId, false);
        } else {
          console.error("Delete failed", await res.text());
        }
      } catch (e) {
        console.error("Error during delete:", e);
      }
    } else {
      // Logic for temporary chats (local only)
      const index = parseInt(row.dataset.historyIndex, 10);
      if (index !== -1) {
        chatHistory.splice(index);
        renderHistoryFromLocal();
      }
    }
  }

  async function editMessageAction(btn) {
    if (isGenerating) {
      await showAlert(
        "Generation in Progress",
        "Please wait for the current response to finish before editing messages.",
      );
      return;
    }
    const row = btn.closest(".message-row");

    // Fix D: Same data-history-index approach as delete — immune to DOM collapsing.
    const index =
      row.dataset.historyIndex !== undefined
        ? parseInt(row.dataset.historyIndex, 10)
        : -1;
    if (index === -1) {
      console.error(
        "editMessageAction: could not resolve historyIndex from row. Aborting.",
      );
      return;
    }

    if (index !== -1 && chatHistory[index]) {
      const content = chatHistory[index].content;
      let textToEdit = "";
      if (Array.isArray(content)) {
        const textObj = content.find((i) => i.type === "text");
        if (textObj) textToEdit = textObj.text;
        // Note: Images in edited messages are not editable - they were uploaded files
        // The image_url is kept in the message for display purposes only
      } else {
        textToEdit = content;
      }

      textArea.value = textToEdit;
      textArea.style.height = "auto";
      textArea.style.height = textArea.scrollHeight + "px";
      textArea.focus();

      // Fix E: Defer the destructive truncate until the user actually hits Send.
      pendingEditIndex = index;
      editingMessageId = row.dataset.messageId;

      // Optimistic UI: remove everything from this row onwards so the user sees
      // the textarea in context, but we haven't touched the DB yet.
      if (isTemporaryChat) {
        // For temp chats there is no DB, so truncate history immediately.
        chatHistory.splice(index);
        while (row.nextSibling) row.nextSibling.remove();
        row.remove();
        updateActionVisibility();
        pendingEditIndex = null; // no deferred DB call needed
      } else {
        // For persisted chats: remove DOM rows visually only.
        while (row.nextSibling) row.nextSibling.remove();
        row.remove();
        updateActionVisibility();
        // chatHistory and DB truncation happen in sendMessage via pendingEditIndex.
      }
    }
  }

  async function retryMessageAction(btn) {
    if (isGenerating) {
      await showAlert(
        "Generation in Progress",
        "Please wait for the current response to finish before retrying messages.",
      );
      return;
    }
    const row = btn.closest(".message-row");
    const messageId = row.dataset.messageId;

    if (currentChatId && !isTemporaryChat && messageId) {
      try {
        await fetch(
          `${API_MODULES.CHATS}/${currentChatId}/messages/${messageId}`,
          {
            method: "DELETE",
          },
        );
        await loadChat(currentChatId, false);
        sendMessage(null, null, true);
      } catch (error) {
        console.error("Failed to delete for retry:", error);
      }
    } else {
      const index = parseInt(row.dataset.historyIndex, 10);
      if (index !== -1) {
        chatHistory.splice(index);
        renderHistoryFromLocal();
        sendMessage(null, null, true);
      }
    }
  }

  async function showRetryModelDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop open";
      overlay.style.zIndex = "9999";

      let compatibleModels = availableModels;

      let optionsHtml = compatibleModels
        .map((m) => {
          const shortName = m.display_name || m.key.split("/").pop();
          const isActive = m.key === selectedModel;
          return `<div class="retry-model-option" data-id="${m.key}" data-name="${shortName}" style="padding: 12px; border: 1px solid var(--border-subtle); border-radius: 8px; margin-bottom: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: ${isActive ? "var(--color-primary-500)" : "transparent"}; color: ${isActive ? "white" : "var(--content-primary)"}">
                    <span>${shortName}</span>
                    ${isActive ? '<span style="font-size: 0.8rem; opacity: 0.8;">Current</span>' : ""}
                </div>`;
        })
        .join("");

      if (optionsHtml === "") {
        optionsHtml = `<div style="padding: 16px; text-align: center; color: var(--color-rose-500);">No compatible models found to retry this chat.</div>`;
      }

      overlay.innerHTML = `
                <div class="modal-content" style="max-width: 400px; text-align: left;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">Retry with Model</h3>
                        <button class="modal-close" style="background:none; border:none; cursor:pointer; color: var(--content-muted);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 16px; font-size: 0.9rem; color: var(--content-muted); line-height: 1.5;">
                            Select a model to retry the latest message cycle. Warning: Switching to a new model might take a few moments.
                        </p>
                        <div style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column;">
                            ${optionsHtml}
                        </div>
                    </div>
                </div>
            `;
      document.body.appendChild(overlay);

      const closeBtn = overlay.querySelector(".modal-close");
      closeBtn.onclick = () => {
        overlay.remove();
        resolve(false);
      };

      const options = overlay.querySelectorAll(".retry-model-option");
      options.forEach((opt) => {
        opt.onclick = async () => {
          const newModelId = opt.getAttribute("data-id");
          const newModelName = opt.getAttribute("data-name");
          overlay.remove();

          if (newModelId !== selectedModel) {
            await selectModel(newModelId, newModelName);
            // Delay briefly to allow settings load overlays to finish transitioning
            await new Promise((r) => setTimeout(r, 600));
          }
          resolve(true);
        };
      });
    });
  }

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

  let lastScrollTime = 0;
  function renderMermaidBlocks() {
    if (typeof mermaid !== 'undefined') {
      try {
        mermaid.run({ querySelector: '.mermaid' });
      } catch (e) {
        console.warn("Mermaid rendering failed or no elements found.", e);
      }
    }
  }

  /**
   * Orchestrates container scrolling with smart behavior.
   * Prevents autoscroll if the user has manually scrolled up to read earlier history.
   */
  function scrollToBottom(behavior = "auto", forced = false) {
    const messages = document.getElementById("messages");
    if (!messages) return;

    // Throttled scrolling to prevent UI jank
    const now = Date.now();
    if (!forced && now - lastScrollTime < 100) return;
    lastScrollTime = now;

    // Smart Scroll: Detection of user scroll position relative to bottom
    const isNearBottom =
      messages.scrollHeight - messages.scrollTop <= messages.clientHeight + 60;

    if (forced || isNearBottom) {
      requestAnimationFrame(() => {
        messages.scrollTo({ top: messages.scrollHeight, behavior: behavior });
      });
    }
  }

  /**
   * UNIFIED MESSAGE CONSTRUCTOR
   * Generates a fully-styled chat bubble for both User and Assistant roles.
   * Includes support for avatars, action menus, image previews, and file pills.
   * @param {object} config - Configuration for the bubble (role, text, attachments).
   * @returns {HTMLElement} The constructed message row.
   */
  function createMessageBubble(config) {
    let {
      role,
      text = "",
      modelName = "",
      thoughtBoxHtml = null,
      messageId = null,
      historyIndex = 0,
      images = [],
      files = [],
      sub_agent_history = [],
      collections = [],
      reasoningContent = "",
      interleaved = [],
    } = config;

    // Strip System Note about files from user messages to prevent UI clutter
    if (role === "user" && text) {
      text = text.replace(/\n\n\[System Note: The user has attached the following files\. Use the `file_agent` tool with the provided file_id to read their contents if needed:[\s\S]*?\]/g, "");
      text = text.replace(/\n\n\[System Note: The user has attached the following files\. Use the `read_file` tool with the provided file_id to read their contents if needed:[\s\S]*?\]/g, "");
    }

    const row = document.createElement("div");
    row.className = `message-row chat-row ${role === "user" ? "user-message" : "bot-message bot"}`;
    if (messageId) row.dataset.messageId = messageId;
    if (historyIndex !== null) row.dataset.historyIndex = historyIndex;

    let avatarMarkup = "";
    let actionsMarkup = "";

    // Template Selection based on Role
    if (role === "user") {
      avatarMarkup = `
                <div class="avatar-wrapper">
                    <div class="avatar" style="display: flex; align-items: center; justify-content: center; color: var(--content-muted); font-weight: 800; font-size: 0.75rem;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                </div>
            `;
      actionsMarkup = `
                <div class="message-actions-container user-actions">
                    <button class="action-btn edit-msg-btn" title="Edit Message"><svg viewBox="0 0 24 24" fill="none" class="edit-icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
                    <button class="action-btn copy-msg-btn" title="Copy Text"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                    <button class="action-btn delete-msg-btn" title="Delete Message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                </div>
            `;
    } else {
      avatarMarkup = `
                <div class="avatar-wrapper">
                    <div class="avatar-orbit"></div>
                    <div class="avatar" style="display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 0.75rem;">
                        <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><path d="M16 2L26 12L16 30L6 12Z" fill="white" opacity="0.9"/><path d="M16 2L26 12H6Z" fill="white" opacity="0.3"/><circle cx="16" cy="12" r="2.5" fill="white" opacity="0.7"/></svg>
                    </div>
                </div>
            `;
      actionsMarkup = `
                <div class="message-actions-container bot-actions">
                    <button class="action-btn copy-msg-btn" title="Copy Text"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                    <button class="action-btn retry-msg-btn" title="Retry with a different model"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path></svg></button>
                </div>
            `;
    }

    // --- Attachments & Collections ---
    let combinedFiles = [...(files || [])];
    if (collections && collections.length > 0) {
      collections.forEach((coll) => {
        if (coll.collection_type === "files") {
          let items = coll.items;
          if (typeof items === "string") {
            try {
              items = JSON.parse(items);
            } catch (e) {
              console.error("Failed to parse collection items", e);
            }
          }
          if (Array.isArray(items)) {
            combinedFiles.push(...items);
          }
        }
      });
    }

    let imageMarkup =
      images && images.length > 0
        ? `
            <div class="message-images" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
                ${images.map((img) => `<img src="${img}" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 1px solid var(--border-subtle); cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" onclick="openImageModal(this.src)">`).join("")}
            </div>`
        : "";

    let fileAttachmentsMarkup =
      combinedFiles && combinedFiles.length > 0
        ? `
            <div class="message-attachments" style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
                ${combinedFiles
                  .map(
                    (
                      f,
                    ) => `<div class="file-attachment-pill" style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--surface-secondary); border: 1px solid var(--border-subtle); border-radius: 6px; font-size: 0.75rem;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                    <span>${escapeHtml(f.name || f.filename || f.original_filename || "File")}</span>
                </div>`,
                  )
                  .join("")}
            </div>`
        : "";

    // Unified Bubble Structure
    if (role === "assistant" || role === "assistant_active") {
      const hasReasoning =
        thoughtBoxHtml ||
        (sub_agent_history && sub_agent_history.length > 0) ||
        reasoningContent ||
        (interleaved && interleaved.length > 0) ||
        (text && text.includes("<think>"));

      row.innerHTML = `
                <div class="assistant-header-row" style="display: flex; align-items: stretch; gap: 16px; width: 100%; margin-bottom: 12px;">
                    <div class="assistant-avatar-column" style="display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        ${avatarMarkup.trim()}
                    </div>
                    <div class="thought-section-wrapper ${hasReasoning ? "" : "hidden"}" style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;">
                        <div class="thought-content-wrapper" style="width: 100%;">
                            <div class="thought-container ${role === "assistant_active" ? "reasoning-active" : ""}" style="margin-bottom: 0;">
                                <div class="thought-header">
                                    <div class="thought-status" style="display: flex; align-items: center; gap: 8px;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.3-3.6z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.3-3.6z"/></svg>
                                        <span class="thought-header-title">${role === "assistant_active" ? 'Thinking...<span class="thought-progress-dots"><span></span><span></span><span></span></span>' : "Thought Process"}</span>
                                    </div>
                                    <div class="thought-actions" style="display: flex; align-items: center; gap: 8px;">
                                        <button class="thought-full-view-btn btn-ghost" title="Full Screen View" style="width: 2.25rem; height: 2.25rem; padding: 0; border-radius: 0.6rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                        </button>
                                        <svg class="thought-chevron" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="thought-timeline-wrapper full-width-reasoning" style="width: 100%; margin-bottom: 0;">
                    <div class="thought-body">
                        <div class="thought-body-inner">
                            ${thoughtBoxHtml || `<div class="activity-feed-wrapper"><div class="activity-feed"></div></div>`}
                        </div>
                    </div>
                </div>
                <div class="message-content-wrapper" style="width: 100%; display: flex; flex-direction: column;">
                    <div class="message-content raw-text-content" style="width: 100%;" data-raw="${encodeURIComponent(text)}">
                        ${imageMarkup}${fileAttachmentsMarkup}${formatMarkdown(text)}
                    </div>
                    <div class="bot-message-footer" style="display: ${modelName ? "flex" : "none"}; align-items: center; margin-top: 4px; padding: 0 4px;">
                        <span class="bot-model-label" style="font-size: 0.65rem; font-weight: 500; color: var(--content-muted); user-select: none; opacity: 0.8;">${modelName || ""}</span>
                    </div>
                    ${actionsMarkup}
                </div>
            `;

      const activityFeed = row.querySelector(".activity-feed");
      // Interleaved items: route through appendSubAgentActivity (discrete mode)
      // so rehydrated history produces the exact same .sub-agent-container DOM
      // as live streaming does. This is now the UNIFIED path for all activities.
      if (interleaved && interleaved.length > 0) {
        interleaved.forEach((item) => {
          const agentName = item.agentName || item.agent_name || "Assistant";
          appendSubAgentActivity(
            activityFeed,
            agentName,
            item.type,
            item.content,
            item.timestamp || Date.now(),
            false,
            false,
          );
        });
      }

      // SCOPED ANCHORING: Also render persistent collections (like task lists)
      // that were attached via get_woven_history.
      if (collections && collections.length > 0) {
        collections.forEach((coll) => {
          if (coll.collection_type === "task_list") {
            const agentName =
              coll.parent_type === "main" ? "Assistant" : coll.parent_type;
              
            let items = coll.items;
            if (typeof items === "string") {
              try {
                items = JSON.parse(items);
              } catch (e) {
                console.error("Failed to parse task list items", e);
              }
            }

            appendSubAgentActivity(
              activityFeed,
              agentName,
              "tool_result",
              items,
              coll.timestamp || Date.now(),
              false,
              false,
            );
          }
        });
      }

      if (role === "assistant_active") {
        row.classList.add("thinking");
      }
    } else {
      const limit = 1000;
      const isTruncated = text && text.length > limit;
      const displayContent = isTruncated
        ? text.substring(0, limit) + "..."
        : text;

      row.innerHTML = `
                ${avatarMarkup}
                <div class="message-content raw-text-content ${isTruncated ? "truncated-content" : ""}" data-raw="${encodeURIComponent(text)}">
                    ${imageMarkup}${fileAttachmentsMarkup}
                    <div class="message-text-wrapper">${formatMarkdown(displayContent)}</div>
                    ${isTruncated ? '<button class="read-more-btn">Read More</button>' : ""}
                </div>
                ${actionsMarkup}
            `;
    }
    return row;
  }

  /**
   * Unified message bubble constructor.
   * Generates a styled chat row for any participant.
   */
  function appendMessage(
    role,
    text,
    type = "user",
    messageId = null,
    images = [],
    files = [],
    historyIndex = 0,
  ) {
    const row = createMessageBubble({
      role: role === "Assistant" ? "assistant" : "user",
      text: text,
      modelName: role === "Assistant" ? selectedModelName : null,
      messageId: messageId,
      historyIndex: historyIndex,
      images: images,
      files: files,
    });
    messagesContainer.appendChild(row);

    updateActionVisibility();
    scrollToBottom("smooth");
    return row;
  }

  /**
   * Contextual Action Visibility Controller
   * Toggles visibility of edit/delete/retry buttons based on:
   * 1. Message position (only last user msg is editable)
   * 2. Interaction state (hidden during research/generation)
   */
  function updateActionVisibility() {
    const userRows = messagesContainer.querySelectorAll(".user-message");
    const botRows = messagesContainer.querySelectorAll(".bot-message");

    userRows.forEach((r, i) => {
      const editBtn = r.querySelector(".edit-msg-btn");
      const deleteBtn = r.querySelector(".delete-msg-btn");
      if (isResearchMode || isGenerating) {
        if (editBtn) editBtn.style.display = "none";
        if (deleteBtn) deleteBtn.style.display = "none";
      } else {
        // User Edit: only allow editing the absolute last turn to prevent history divergence
        if (editBtn)
          editBtn.style.display = i === userRows.length - 1 ? "flex" : "none";
        if (deleteBtn) deleteBtn.style.display = "flex";
      }
    });

    botRows.forEach((r, i) => {
      const retryBtn = r.querySelector(".retry-msg-btn");
      if (isResearchMode || isGenerating) {
        if (retryBtn) retryBtn.style.display = "none";
      } else {
        // Bot Retry: only allowed on the final response index
        if (retryBtn)
          retryBtn.style.display = i === botRows.length - 1 ? "flex" : "none";
      }
    });

    updateTempChatBtnState();
  }

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
        loadChat(currentChatId, false);
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
      if (!selectedModel) {
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

  function getLogicalMessageGroups(history) {
    const groups = [];
    let currentGroup = null;

    history.forEach((msg, index) => {
      if (msg.role === "user") {
        if (currentGroup) groups.push(currentGroup);
        groups.push({
          role: "user",
          messages: [{ ...msg, _originalIndex: index }],
        });
        currentGroup = null;
      } else {
        if (!currentGroup) {
          currentGroup = { role: "bot", messages: [] };
        }
        currentGroup.messages.push({ ...msg, _originalIndex: index });
      }
    });

    if (currentGroup) groups.push(currentGroup);
    return groups;
  }

  async function getToolCallHtmlForMessageGroup(group) {
    // Redundant polling for /sse_chunks removed.
    // Component activity is now rendered directly via woven history.
    return "";
  }

  // ==================== PHASE 2: ASSISTANT TURNS & ACTIVITY FEED ====================

  function _extractActivitiesFromMessage(msg, isSubAgent = false) {
    const activities = [];
    const contentStr =
      typeof msg.content === "string"
        ? msg.content
        : msg.content
          ? JSON.stringify(msg.content)
          : "";

    if (contentStr) {
      const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/g;
      let m;
      while ((m = thinkRegex.exec(contentStr)) !== null) {
        activities.push({
          type: "thinking",
          content: m[1].trim(),
          timestamp: msg.timestamp,
          agentName: isSubAgent
            ? msg.agent_name || msg.parent_type
            : msg.parent_type || null,
          isSubAgent: isSubAgent,
          chunkId: `${isSubAgent ? "sub" : "msg"}-think-${msg.id}`,
        });
      }
    }

    if (msg.role === "event") {
      activities.push({
        type: "event",
        content: msg.content,
        timestamp: msg.timestamp,
        agentName: isSubAgent ? msg.agent_name : msg.parent_type || null,
        isSubAgent: isSubAgent,
        chunkId: `event-${msg.id}`,
      });
    }

    if (msg.tool_calls) {
      try {
        const tcList =
          typeof msg.tool_calls === "string"
            ? JSON.parse(msg.tool_calls)
            : msg.tool_calls;
        (Array.isArray(tcList) ? tcList : [tcList]).forEach((tc) => {
          activities.push({
            type: "tool_call",
            content: JSON.stringify(tc),
            timestamp: msg.timestamp,
            agentName: isSubAgent
              ? msg.agent_name || msg.parent_type
              : msg.parent_type || null,
            isSubAgent: isSubAgent,
            chunkId: `${isSubAgent ? "sub" : "msg"}-call-${tc.id}`,
            toolCallId: tc.id,
          });
        });
      } catch (e) {}
    }

    if (msg.role === "tool") {
      activities.push({
        type: "tool_result",
        content: isSubAgent
          ? JSON.stringify({ output: msg.content })
          : msg.content,
        timestamp: msg.timestamp,
        agentName: isSubAgent
          ? msg.agent_name || msg.parent_type
          : msg.parent_type || "Assistant",
        isSubAgent: isSubAgent,
        chunkId: `${isSubAgent ? "sub" : "msg"}-res-${msg.id}`,
      });
    }
    return activities;
  }

  function _extractActivitiesFromSseChunks(chunks) {
    const activities = [];
    let currentCluster = null;

    const flush = () => {
      if (!currentCluster) return;
      if (currentCluster.type !== "content") {
        activities.push({
          type: currentCluster.type,
          content: currentCluster.content,
          timestamp: currentCluster.timestamp,
          chunkId: `sse-cluster-${currentCluster.type}-${currentCluster.timestamp}`,
        });
      }
    };

    const sorted = [...chunks].sort(
      (a, b) => (a.chunk_index || 0) - (b.chunk_index || 0),
    );
    for (const c of sorted) {
      const type = c.chunk_type;
      if (currentCluster && currentCluster.type === type) {
        currentCluster.content += c.content || "";
      } else {
        flush();
        currentCluster = {
          type,
          content: c.content || "",
          timestamp: c.timestamp,
        };
      }
    }
    flush();
    return activities;
  }

  /**
   * Sort activities chronologically
   * Used for the activity feed display
   *
   * @param {Array} activities - Array of activity objects
   * @returns {Array} Sorted array of activities
   */
  function sortActivitiesChronologically(activities) {
    return activities.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

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
  function _buildActivityFeedContent(activities) {
    if (!activities || activities.length === 0) return "";

    const sorted = sortActivitiesChronologically([...activities]);
    let finalHtml = "";
    let currentAgentName = null;
    let currentItemsHtml = "";

    const renderSubAgentCard = (name, items) => {
      if (!items) return "";
      const key = name.toLowerCase();
      let label = name.replace(/_/g, " ");
      if (key === "research") label = "Research Agent";
      if (key === "file_system_agent") label = "FileSystem Agent";

      return `
                <div class="activity-item sub-agent-container collapsed" data-agent-name="${key}">
                    <div class="activity-header">
                        <div class="sub-agent-icon-wrapper" style="margin-right: 6px; display: flex; align-items: center; justify-content: center; color: var(--content-muted);">${getAgentIcon(key)}</div>
                        <div class="activity-type" style="margin-right: auto;">${label}</div>
                        <div class="thought-chevron" style="margin-left: auto;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                    </div>
                    <div class="activity-content sub-agent-activity-feed" style="margin-left: 0; border-left: none;">${items}</div>
                </div>
            `;
    };

    for (const activity of sorted) {
      // Determine agent name for this activity
      let agentName =
        activity.agentName ||
        activity.agent_name ||
        (activity.parent_type !== "main" ? activity.parent_type : "Assistant");
      if (agentName === "Thinking") agentName = "Assistant";

      const normalized = agentName.toLowerCase();
      const isAssistant =
        normalized === "assistant" || normalized === "assistant_active";

      if (currentAgentName !== null && normalized !== currentAgentName.toLowerCase()) {
        // Agent switched — if previous was sub-agent, close its card
        if (currentAgentName.toLowerCase() !== "assistant" && currentAgentName.toLowerCase() !== "assistant_active") {
          finalHtml += renderSubAgentCard(currentAgentName, currentItemsHtml);
        } else {
          finalHtml += currentItemsHtml;
        }
        currentItemsHtml = "";
      }

      currentAgentName = agentName;
      currentItemsHtml += _renderSubAgentActivityItemHtml(activity);
    }

    // Flush final items
    if (currentAgentName !== null) {
      if (currentAgentName.toLowerCase() !== "assistant" && currentAgentName.toLowerCase() !== "assistant_active") {
        finalHtml += renderSubAgentCard(currentAgentName, currentItemsHtml);
      } else {
        finalHtml += currentItemsHtml;
      }
    }

    return finalHtml;
  }

  /**
   * Render a single activity item for display INSIDE a sub-agent container.
   * Produces the same inner structure as renderActivityItem but without an outer agent wrapper.
   */
  function _renderSubAgentActivityItemHtml(activity) {
    const type = activity.type || "thinking";
    const content = activity.content || "";
    const timestamp = activity.timestamp || Date.now();

    const chevronSvg = `<div class="thought-chevron" style="margin-left: auto;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;

    if (type === "thinking") {
      return `
                <div class="activity-item thinking-item collapsed" data-role="thinking" data-timestamp="${timestamp}">
                    <div class="activity-header">
                        <div class="activity-type">Reasoning</div>
                        ${chevronSvg}
                    </div>
                    <div class="activity-content sub-agent-thinking" data-raw="${escapeHtml(content)}">${escapeHtml(content)}</div>
                </div>
            `;
    } else if (type === "content") {
      return `
                <div class="activity-item content-item collapsed" data-role="content" data-timestamp="${timestamp}">
                    <div class="activity-header">
                        <span class="activity-type">Assistant Response</span>
                        ${chevronSvg}
                    </div>
                    <div class="activity-content sub-agent-response" data-raw="${escapeHtml(content)}">${escapeHtml(content)}</div>
                </div>
            `;
    }

    let typeLabel, typeClass, contentHtml;

    if (type === "tool_call") {
      typeClass = "tool-call-activity";
      let toolName = "Unknown Tool";
      let args = {};
      try {
        const parsed =
          typeof content === "string" ? JSON.parse(content) : content;
        toolName = parsed.function?.name || "Unknown Tool";
        args = parsed.function?.arguments || {};
        if (typeof args === "string") {
          try {
            args = JSON.parse(args);
          } catch (e) {}
        }
      } catch (e) {}

      const config = TOOL_DISPLAY_CONFIG[toolName] || {
        name: toolName,
        icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
      };
      typeLabel = config.name;
      contentHtml = `<code class="font-mono">${escapeHtml(JSON.stringify(args, null, 2))}</code>`;

      return `
                <div class="activity-item tool-call-item collapsed ${typeClass}" data-role="tool_call" data-timestamp="${timestamp}">
                    <div class="activity-header">
                        <div class="activity-type">${config.icon} <span>Call: ${escapeHtml(typeLabel)}</span></div>
                        ${chevronSvg}
                    </div>
                    <div class="activity-content tool-call-content">${contentHtml}</div>
                </div>
            `;
    } else if (type === "tool_result") {
      typeLabel = "Result";
      typeClass = "tool-result-activity";
      let isTaskTool = false;
      try {
        const parsed =
          typeof content === "string" ? JSON.parse(content) : content;
        const targetObj = parsed.output ?? parsed;
        if (
          Array.isArray(targetObj) &&
          targetObj.length > 0 &&
          typeof targetObj[0] === "object" &&
          targetObj[0].hasOwnProperty("status") &&
          targetObj[0].hasOwnProperty("description")
        ) {
          isTaskTool = true;
          contentHtml = renderTaskListCard(targetObj);
          typeLabel = "Task List";
        } else {
          contentHtml = `<code class="font-mono">${escapeHtml(JSON.stringify(targetObj, null, 2))}</code>`;
        }
      } catch (e) {
        contentHtml = escapeHtml(content);
      }

      return `
                <div class="activity-item tool-result-item collapsed ${typeClass}" data-role="tool_result" data-timestamp="${timestamp}">
                    <div class="activity-header">
                        <div class="activity-type">Tool Result: ${typeLabel}</div>
                        ${chevronSvg}
                    </div>
                    <div class="activity-content tool-result-content" ${isTaskTool ? 'style="padding-top: 0;"' : ""}>${contentHtml}</div>
                </div>
            `;
    } else if (type === "event") {
      return `
                <div class="activity-item event-divider" data-role="event" data-timestamp="${timestamp}" style="display: flex; align-items: center; justify-content: center; margin: 1.5rem 0; gap: 1rem;">
                    <div style="flex: 1; height: 1px; background-color: var(--border-subtle, var(--border-subtle));"></div>
                    <span class="event-text" style="color: var(--content-muted); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;" data-raw="${escapeHtml(content)}">${escapeHtml(content)}</span>
                    <div style="flex: 1; height: 1px; background-color: var(--border-subtle, var(--border-subtle));"></div>
                </div>
            `;
    } else {
      typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      typeClass = "generic-activity";
      contentHtml = `<div style="white-space: pre-wrap; font-family: var(--font-mono, monospace); font-size: 0.85em;">${escapeHtml(content)}</div>`;
    }

    return `
            <div class="activity-item ${typeClass} collapsed" data-timestamp="${timestamp}">
                <div class="activity-header">
                    <span class="activity-type">${typeLabel}</span>
                </div>
                <div class="activity-content">${contentHtml}</div>
            </div>
        `;
  }

  /**
   * Public wrapper: returns the full <div class="activity-feed"> block.
   * Use _buildActivityFeedContent when you need just the inner HTML.
   */
  function renderActivityFeed(activities) {
    if (!activities || activities.length === 0) return "";
    return `<div class="activity-feed">${_buildActivityFeedContent(activities)}</div>`;
  }

  function renderToolArguments(args) {
    if (!args || Object.keys(args).length === 0) return "";

    let html = '<div class="tool-args">';
    for (const [key, value] of Object.entries(args)) {
      let displayValue = value;
      if (typeof value === "object") {
        displayValue = JSON.stringify(value);
      }
      const isLong = String(displayValue).length > 60;
      const truncatedValue = isLong
        ? String(displayValue).substring(0, 57) + "..."
        : displayValue;

      html += `
                <div class="arg-badge" title="${escapeHtml(String(displayValue))}">
                    <span class="arg-key">${escapeHtml(key)}:</span>
                    <span class="arg-value">${escapeHtml(String(truncatedValue))}</span>
                </div>
            `;
    }
    html += "</div>";
    return html;
  }

  function renderToolCallActivity(activity) {
    const content = activity.content || "";
    const timestamp = activity.timestamp || Date.now();
    let toolName = "Unknown Tool";
    let args = {};
    let isClarificationTool = false;

    try {
      const parsed = JSON.parse(content);
      toolName = parsed.function?.name || "Unknown Tool";
      args = parsed.function?.arguments || {};
      if (typeof args === "string") {
        try {
          args = JSON.parse(args);
        } catch (e) {}
      }
      isClarificationTool = toolName === "request_clarification";
    } catch (e) {}

    const config = TOOL_DISPLAY_CONFIG[toolName] || {
      name: toolName,
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    };

    const clarifierClass = isClarificationTool ? " clarifier-tool-call" : "";
    const clarifierAttr = isClarificationTool
      ? ' data-clarification="true"'
      : "";

    const contentHtml = renderToolArguments(args);

    return `
            <div class="activity-item tool-call-activity collapsed${clarifierClass}" data-timestamp="${timestamp}"${clarifierAttr}>
                <div class="activity-header">
                    ${config.icon}
                    <span class="activity-type">${escapeHtml(config.name)}</span>
                    <span class="sse-chunk-sub-label">${escapeHtml(toolName)}</span>
                </div>
                <div class="activity-content tool-call-content">
                    ${contentHtml}
                    <div style="margin-top: 10px; font-size: 0.75rem; opacity: 0.5;">
                        <details>
                            <summary style="cursor: pointer; user-select: none;">Raw Arguments</summary>
                            <pre style="margin-top: 5px; font-size: 0.7rem;"><code class="language-json">${escapeHtml(JSON.stringify(args, null, 2))}</code></pre>
                        </details>
                    </div>
                </div>
            </div>
        `;
  }

  function renderTaskListCard(tasks) {
    let html =
      '<div class="task-list-card" style="background: var(--surface-secondary); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: 12px; margin-top: 8px; font-family: var(--font-body);">';
    html +=
      '<div style="font-weight: 600; font-size: 0.9em; color: var(--content-primary); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Task Checklist</div>';
    html +=
      '<ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">';

    tasks.forEach((task) => {
      let icon = "";
      let opacity = "1";
      let textDecoration = "none";
      if (task.status === "DONE") {
        icon =
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        opacity = "0.6";
        textDecoration = "line-through";
      } else if (task.status === "DROPPED") {
        icon =
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-rose)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        opacity = "0.5";
        textDecoration = "line-through";
      } else if (task.status === "BLOCKED") {
        icon =
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-amber)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        opacity = "0.8";
      } else {
        icon =
          '<div style="width: 13px; height: 13px; border: 2px solid var(--content-muted); border-radius: 3px; margin-top: 1px;"></div>';
      }

      html += `<li style="display: flex; flex-direction: column; opacity: ${opacity};">
                <div style="display: flex; gap: 8px; align-items: flex-start;">
                    <div style="flex-shrink: 0; margin-top: 2px;">${icon}</div>
                    <div style="flex-grow: 1;">
                        <div style="font-weight: 500; font-size: 0.85em; text-decoration: ${textDecoration}; line-height: 1.4; color: var(--content-primary);">${escapeHtml(task.description)}</div>
                        ${task.notes ? `<div style="font-size: 0.75em; color: var(--content-muted); margin-top: 4px; border-left: 2px solid var(--glass-border); padding-left: 6px;">${escapeHtml(task.notes)}</div>` : ""}
                    </div>
                </div>
            </li>`;
    });

    html += "</ul></div>";
    return html;
  }

  function renderToolResultActivity(activity) {
    const content = activity.content || "";
    const timestamp = activity.timestamp || Date.now();
    let resultJson = "";
    let isTaskTool = false;
    let taskListHtml = "";

    try {
      const parsed = JSON.parse(content);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        typeof parsed[0] === "object" &&
        parsed[0].hasOwnProperty("status") &&
        parsed[0].hasOwnProperty("description")
      ) {
        isTaskTool = true;
        taskListHtml = renderTaskListCard(parsed);
      }
      resultJson = JSON.stringify(parsed, null, 2);
    } catch (e) {
      resultJson = content;
    }

    if (isTaskTool) {
      return `
                <div class="activity-item tool-result-activity" data-timestamp="${timestamp}">
                    <div class="activity-header">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span class="activity-type">Task List Updated</span>
                    </div>
                    <div class="activity-content tool-result-content" style="padding-top: 0;">
                        ${taskListHtml}
                    </div>
                </div>
            `;
    }

    const isLong = resultJson.length > 5000;
    const displayJson = isLong
      ? resultJson.substring(0, 5000) +
        "\n\n... (output truncated for performance)"
      : resultJson;

    return `
            <div class="activity-item tool-result-activity collapsed" data-timestamp="${timestamp}">
                <div class="activity-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span class="activity-type">Result</span>
                </div>
                <div class="activity-content tool-result-content">
                    <code class="language-json">${escapeHtml(displayJson)}</code>
                </div>
            </div>
        `;
  }

  // → parseResearchPlan moved to static/js/utils.js

  function showClarificationPopOver(question, options, callbackId) {
    const popoverId = "clarification-popover";
    let popover = document.getElementById(popoverId);
    if (!popover) {
      popover = document.createElement("div");
      popover.id = popoverId;
      popover.className = "clarification-popover";
      const inputContainer = document.querySelector(".input-container");
      if (inputContainer) {
        inputContainer.appendChild(popover);
      } else {
        document.body.appendChild(popover);
      }
    }

    const optionsArray = Array.isArray(options) ? options : [];

    popover.innerHTML = `
            <div class="clarification-popover-arrow"></div>
            <div class="clarification-popover-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <h3>Clarification Required</h3>
            </div>
            <div class="clarification-popover-question">${formatMarkdown(question)}</div>
            <ul class="clarification-options-list">
                ${optionsArray
                  .map(
                    (opt, i) => `
                    <li class="clarification-option-item" data-value="${escapeHtml(opt)}">
                        <div class="clarification-option-main">
                            <div class="clarification-radio"><div class="clarification-radio-inner"></div></div>
                            <span class="clarification-option-text">${escapeHtml(opt)}</span>
                        </div>
                    </li>
                `,
                  )
                  .join("")}
                <li class="clarification-option-item custom-option selected">
                    <div class="clarification-option-main">
                        <div class="clarification-radio"><div class="clarification-radio-inner"></div></div>
                        <span class="clarification-option-text">Custom response...</span>
                    </div>
                    <div class="clarification-custom-container">
                        <textarea class="clarification-custom-textarea" placeholder="Type your answer here..."></textarea>
                    </div>
                </li>
            </ul>
            <div class="clarification-popover-footer">
                <button class="clarification-btn clarification-btn-cancel">Cancel</button>
                <button class="clarification-btn clarification-btn-confirm" disabled>Confirm Response</button>
            </div>
        `;

    const confirmBtn = popover.querySelector(".clarification-btn-confirm");
    const cancelBtn = popover.querySelector(".clarification-btn-cancel");
    const items = popover.querySelectorAll(".clarification-option-item");
    const customItem = popover.querySelector(".custom-option");
    const customTextarea = popover.querySelector(
      ".clarification-custom-textarea",
    );

    let currentResponse = "";

    const updateUI = () => {
      confirmBtn.disabled = !currentResponse.trim();
    };

    items.forEach((item) => {
      item.onclick = () => {
        items.forEach((i) => i.classList.remove("selected"));
        item.classList.add("selected");

        if (item === customItem) {
          currentResponse = customTextarea.value;
          customTextarea.focus();
        } else {
          currentResponse = item.dataset.value;
        }
        updateUI();
      };
    });

    customTextarea.onfocus = () => {
      items.forEach((i) => i.classList.remove("selected"));
      customItem.classList.add("selected");
      currentResponse = customTextarea.value;
      updateUI();
    };

    customTextarea.oninput = () => {
      currentResponse = customTextarea.value;
      updateUI();
    };

    confirmBtn.onclick = async () => {
      const finalContent = currentResponse.trim();
      if (!finalContent) return;

      confirmBtn.disabled = true;
      confirmBtn.textContent = "Processing...";

      try {
        const res = await fetch(`${API_MODULES.TOOLS}/clarification/response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_id: callbackId,
            chat_id: currentChatId,
            type: "answer",
            content: finalContent,
          }),
        });

        if (res.ok) {
          popover.style.display = "none";
          // Local cleanup to prevent re-trigger during re-renders before next loadChat
          activeClarificationIds = activeClarificationIds.filter(
            (id) => id !== callbackId,
          );
        } else {
          const data = await res.json();
          showNotification(
            "Error: " + (data.error || "Failed to resume."),
            "error",
          );
          confirmBtn.disabled = false;
          confirmBtn.textContent = "Confirm Response";
        }
      } catch (e) {
        console.error("Error submitting clarification:", e);
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm Response";
      }
    };

    cancelBtn.onclick = async () => {
      if (
        await showConfirm(
          "Cancel Process",
          "Are you sure you want to stop this process?",
          true,
        )
      ) {
        fetch(`${API_MODULES.CHATS}/${currentChatId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        });
        popover.style.display = "none";
      }
    };

    popover.style.display = "flex";
    customTextarea.focus();
  }

  /**
   * Get a representative SVG icon for a sub-agent based on its name.
   */
  /**
   * Get a representative SVG icon for a sub-agent based on its backend parent_type.
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

  function getSharedAgentCard(activityFeed, rawAgentName, attemptId = null) {
    if (!activityFeed) return null;
    const agentName = String(rawAgentName || "Agent").toLowerCase();

    // CHRONOLOGY FIX: For main Assistant activities, we append directly to the activityFeed (no card)
    if (agentName === "assistant" || agentName === "main" || agentName === "assistant_active") {
      return activityFeed;
    }

    // CHRONOLOGY FIX: Check if the LAST card in the feed matches this agent.
    // If not, we MUST create a new card to preserve the Assistant -> Agent -> Assistant flow.
    let card = activityFeed.lastElementChild;
    if (
      !card ||
      !card.classList.contains("sub-agent-container") ||
      card.dataset.agentName !== agentName
    ) {
      let label = rawAgentName.replace(/_/g, " ");
      if (agentName === "research") label = "Research Agent";
      if (agentName === "file_system_agent") label = "File System Agent";
      if (agentName === "assistant" || agentName === "main")
        label = "Assistant";

      const html = `
                <div class="activity-item sub-agent-container collapsed" data-agent-name="${agentName}">
                    <div class="activity-header">
                        <div class="sub-agent-icon-wrapper" style="margin-right: 6px; display: flex; align-items: center; justify-content: center; color: var(--content-muted);">${getAgentIcon(agentName)}</div>
                        <div class="activity-type" style="margin-right: auto;">${label}</div>
                        <div class="thought-chevron" style="margin-left: auto;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                    </div>
                    <div class="activity-content sub-agent-activity-feed" style="margin-left: 0; border-left: none;"></div>
                </div>
            `;
      activityFeed.insertAdjacentHTML("beforeend", html);
      card = activityFeed.lastElementChild;

      // SYNC TO MODAL
      if (activeThoughtModalSource === activityFeed) {
        const modalBody = document.getElementById("thought-modal-content-area");
        if (modalBody) {
          const clone = card.cloneNode(true);
          clone.classList.add("collapsed");
          clone.classList.remove("expanded");
          modalBody.appendChild(clone);
        }
      }

      if (attemptId) card.dataset.attemptId = attemptId;      
      // Wire up click-to-toggle for the new sub-agent container
      const hdr = card.querySelector(".activity-header");
      if (hdr) {
        hdr.addEventListener("click", (e) => {
          e.stopPropagation();
          const isCollapsed = card.classList.toggle("collapsed");
          card.classList.toggle("expanded", !isCollapsed);
        });
      }
    }
    return card;
  }

  /**
   * UNIFIED sub-agent activity insertion.
   * The single canonical function for adding any activity item to an agent container.
   * Used by ALL live-streaming paths so rendering code is in one place.
   *
   * @param {Element}  activityFeed  - The .activity-feed DOM element
   * @param {string}   rawAgentName  - Agent identifier (any casing)
   * @param {string}   activityType  - 'thinking' | 'content' | 'tool_call' | 'tool_result'
   * @param {string}   content       - Text/JSON content to display
   * @param {number}   timestamp     - Unix ms timestamp
   * @param {boolean}  accumulate    - true = streaming mode (append chars to open item,
   *                                   seal on type-change to preserve chronological order);
   *                                   false = discrete mode (always create a new item)
   * @param {boolean}  isLive        - true = this is a fresh event (trigger interactions)
   */
  function appendSubAgentActivity(
    activityFeed,
    rawAgentName,
    activityType,
    content,
    timestamp,
    accumulate,
    isLive = false,
    attemptId = null
  ) {
    const targetContainer = getSharedAgentCard(activityFeed, rawAgentName, attemptId);
    if (!targetContainer) return null;

    // If targetContainer is the activityFeed itself, it's a naked stream item.
    // Otherwise, it's a sub-agent card and we need its .sub-agent-activity-feed.
    const contentArea =
      targetContainer === activityFeed
        ? activityFeed
        : targetContainer.querySelector(".sub-agent-activity-feed");
    if (!contentArea) return null;

    if (accumulate) {
      // Seal any streaming items whose type DIFFERS from the incoming type.
      // This is what enforces chronological order: thinking→output→thinking
      // instead of merging all thinking chunks into a single monster block.
      let currentItem = null;
      contentArea
        .querySelectorAll(":scope > .activity-item[data-streaming]")
        .forEach((item) => {
          if (item.dataset.role === activityType) {
            currentItem = item; // same type — reuse (still streaming)
          } else {
            // Different type started — seal it
            delete item.dataset.streaming;
          }
        });

      if (!currentItem) {
        // No open accumulator of this type — create one
        const html = _renderSubAgentActivityItemHtml({
          type: activityType,
          content: "",
          timestamp: timestamp || Date.now(),
        });
        contentArea.insertAdjacentHTML("beforeend", html);
        currentItem = contentArea.lastElementChild;

        // SYNC TO MODAL (Creation)
        if (activeThoughtModalSource === activityFeed) {
          const modalBody = document.getElementById("thought-modal-content-area");
          if (modalBody) {
            // We need to find where to append this in the modal.
            // If contentArea is the main feed, append to root.
            // If contentArea is a sub-agent's feed, we need to find that agent's feed in the modal.
            if (contentArea === activityFeed) {
              const clone = currentItem.cloneNode(true);
              clone.classList.add("collapsed");
              clone.classList.remove("expanded");
              modalBody.appendChild(clone);
            } else {
              // Nested item - find parent container in modal
              const parentAgent = contentArea.closest(".sub-agent-container");
              if (parentAgent) {
                const agentName = parentAgent.dataset.agentName;
                const modalParentAgent = modalBody.querySelector(`.sub-agent-container[data-agent-name="${agentName}"]`);
                if (modalParentAgent) {
                  const modalContentArea = modalParentAgent.querySelector(".sub-agent-activity-feed");
                  if (modalContentArea) {
                    const clone = currentItem.cloneNode(true);
                    clone.classList.add("collapsed");
                    clone.classList.remove("expanded");
                    modalContentArea.appendChild(clone);
                  }
                }
              }
            }
          }
        }

        if (currentItem) {
          currentItem.dataset.role = activityType;
          currentItem.dataset.streaming = "true";
          if (attemptId) currentItem.dataset.attemptId = attemptId;
          // Wire up click-to-toggle so the header chevron works
          const hdr = currentItem.querySelector(".activity-header");
          if (hdr) {
            hdr.addEventListener("click", (e) => {
              e.stopPropagation();
              const isCollapsed = currentItem.classList.toggle("collapsed");
              currentItem.classList.toggle("expanded", !isCollapsed);
            });
          }
        }
      }

      if (currentItem) {
        const textWrapper = currentItem.querySelector(".activity-content, .event-text");
        if (textWrapper) {
          const raw = (textWrapper.dataset.raw || "") + (content || "");
          textWrapper.dataset.raw = raw;
          textWrapper.innerHTML = escapeHtml(raw);

          // SYNC TO MODAL (Text Update)
          if (activeThoughtModalSource === activityFeed) {
            const modalBody = document.getElementById("thought-modal-content-area");
            if (modalBody) {
              // We need to find this item in the modal.
              // It should have the same timestamp and role.
              const timestamp = currentItem.dataset.timestamp;
              const modalItem = modalBody.querySelector(`.activity-item[data-timestamp="${timestamp}"][data-role="${activityType}"]`);
              if (modalItem) {
                const modalTextWrapper = modalItem.querySelector(".activity-content, .event-text");
                if (modalTextWrapper) {
                  modalTextWrapper.innerHTML = escapeHtml(raw);
                }
              }
            }
          }

          // Trigger clarification pop-over if this is a request_clarification tool call
          if (activityType === "tool_call") {
            try {
              const parsed = JSON.parse(raw);
              if (parsed.function?.name === "request_clarification") {
                // Check if this ID is in the active list (from backend or live stream)
                if (isLive || activeClarificationIds.includes(parsed.id)) {
                  const args =
                    typeof parsed.function.arguments === "string"
                      ? JSON.parse(parsed.function.arguments)
                      : parsed.function.arguments;
                  showClarificationPopOver(
                    args.question,
                    args.options,
                    parsed.id,
                  );
                  // Ensure it's in the list for re-renders during this session
                  if (!activeClarificationIds.includes(parsed.id)) {
                    activeClarificationIds.push(parsed.id);
                  }
                }
              }
            } catch (e) {}
          }
        }

        // Update history dataset for persistence
        const history = JSON.parse(activityFeed.dataset.history || "[]");
        const lastIdx = history.length - 1;
        if (
          lastIdx >= 0 &&
          history[lastIdx].agentName === rawAgentName &&
          history[lastIdx].type === activityType &&
          history[lastIdx].accumulate
        ) {
          history[lastIdx].content = (history[lastIdx].content || "") + content;
        } else {
          history.push({
            agentName: rawAgentName,
            type: activityType,
            content: content,
            timestamp: timestamp || Date.now(),
            accumulate: true,
          });
        }
        activityFeed.dataset.history = JSON.stringify(history);
      }
      return currentItem;
    } else {
      // Discrete mode: seal any open streaming items, then insert a complete item
      contentArea
        .querySelectorAll(".activity-item[data-streaming]")
        .forEach((item) => {
          delete item.dataset.streaming;
        });
      const html = _renderSubAgentActivityItemHtml({
        type: activityType,
        content: content || "",
        timestamp: timestamp || Date.now(),
      });
      contentArea.insertAdjacentHTML("beforeend", html);
      const newItem = contentArea.lastElementChild;

      // SYNC TO MODAL (Discrete Creation)
      if (activeThoughtModalSource === activityFeed) {
        const modalBody = document.getElementById("thought-modal-content-area");
        if (modalBody) {
          if (contentArea === activityFeed) {
            const clone = newItem.cloneNode(true);
            clone.classList.add("collapsed");
            clone.classList.remove("expanded");
            modalBody.appendChild(clone);
          } else {
            // Nested item - find parent container in modal
            const parentAgent = contentArea.closest(".sub-agent-container");
            if (parentAgent) {
              const agentName = parentAgent.dataset.agentName;
              const modalParentAgent = modalBody.querySelector(`.sub-agent-container[data-agent-name="${agentName}"]`);
              if (modalParentAgent) {
                const modalContentArea = modalParentAgent.querySelector(".sub-agent-activity-feed");
                if (modalContentArea) {
                  const clone = newItem.cloneNode(true);
                  clone.classList.add("collapsed");
                  clone.classList.remove("expanded");
                  modalContentArea.appendChild(clone);
                }
              }
            }
          }
        }
      }

      if (newItem) {
        newItem.dataset.role = activityType;
        if (attemptId) newItem.dataset.attemptId = attemptId;
        // Wire up click-to-toggle
        const hdr = newItem.querySelector(".activity-header");
        if (hdr) {
          hdr.addEventListener("click", (e) => {
            e.stopPropagation();
            const isCollapsed = newItem.classList.toggle("collapsed");
            newItem.classList.toggle("expanded", !isCollapsed);
          });
        }

        // Trigger clarification pop-over for discrete tool calls
        if (activityType === "tool_call") {
          try {
            const parsed = JSON.parse(content);
            if (parsed.function?.name === "request_clarification") {
              if (isLive || activeClarificationIds.includes(parsed.id)) {
                const args =
                  typeof parsed.function.arguments === "string"
                    ? JSON.parse(parsed.function.arguments)
                    : parsed.function.arguments;
                showClarificationPopOver(
                  args.question,
                  args.options,
                  parsed.id,
                );
                if (!activeClarificationIds.includes(parsed.id)) {
                  activeClarificationIds.push(parsed.id);
                }
              }
            }
          } catch (e) {}
        }
      }

      // Update history dataset for persistence (discrete item)
      const history = JSON.parse(activityFeed.dataset.history || "[]");
      history.push({
        agentName: rawAgentName,
        type: activityType,
        content: content,
        timestamp: timestamp || Date.now(),
        accumulate: false,
      });
      activityFeed.dataset.history = JSON.stringify(history);

      return newItem;
    }
  }

  function handleLiveSubAgentData(data) {
    const isSse = !!data.__sse_chunk__;
    const chunk = isSse ? data.__sse_chunk__ : data.__sub_agent_message__;
    if (!chunk) return;

    // Strict adherence to instruction: labels determined ONLY through parent_type (SSE) and agent_name (messages)
    const agentName = isSse ? chunk.parent_type : chunk.agent_name;

    // Final fallback for display if both are missing or 'main'
    const label = agentName === "main" || !agentName ? "Agent" : agentName;
    const pId = String(chunk.parent_message_id);

    let parentRow = messagesContainer.querySelector(
      `[data-message-id="${pId}"]`,
    );
    if (!parentRow && botMsgDiv) parentRow = botMsgDiv;

    if (!parentRow) {
      // FIX M2 + C1: Log the drop instead of silently discarding.
      console.warn(
        "[handleLiveSubAgentData] No parentRow found for parent_message_id:",
        pId,
        "— sub-agent chunk dropped:",
        chunk,
      );
      return;
    }

    {
      let activityFeed = parentRow.querySelector(".activity-feed");
      if (!activityFeed) {
        let thoughtBox = parentRow.querySelector(".thought-box");
        if (!thoughtBox) {
          // FIX C1: renderThoughtBox() was never defined. Inline the DOM creation
          // to match the structure emitted by createMessageBubble().
          const contentWrapper = parentRow.querySelector(
            ".message-content-wrapper",
          );
          const thoughtContentWrapper = parentRow.querySelector(
            ".thought-content-wrapper",
          );
          if (contentWrapper && thoughtContentWrapper) {
            thoughtContentWrapper.classList.remove("hidden");
            
            // The thought header is already in the DOM from createMessageBubble,
            // we just need to ensure the timeline wrapper exists and is visible.
            const timelineWrapper = parentRow.querySelector(".thought-timeline-wrapper");
            if (timelineWrapper) {
              timelineWrapper.classList.remove("hidden");
              timelineWrapper.style.display = "block";
              
              if (!timelineWrapper.querySelector(".activity-feed")) {
                timelineWrapper.innerHTML = `
                    <div class="thought-body">
                        <div class="thought-body-inner">
                            <div class="activity-feed-wrapper"><div class="activity-feed"></div></div>
                        </div>
                    </div>`;
              }
            }
            thoughtBox = timelineWrapper;
          }
        }
        activityFeed = thoughtBox?.querySelector(".activity-feed");
      }

      if (activityFeed) {
        const activityType = chunk.chunk_type || "thinking";
        const ok = appendSubAgentActivity(
          activityFeed,
          agentName,
          activityType,
          chunk.content || "",
          chunk.timestamp || Date.now(),
          false,
        );
        if (!ok) {
          // Fallback for special chunk types (planning cards, retry indicators, etc.)
          const agentCard = getSharedAgentCard(activityFeed, agentName);
          const contentArea = agentCard?.querySelector(".activity-content");
          if (contentArea) {
            const chunkEl = _renderSSEChunk(chunk);
            if (chunkEl) contentArea.appendChild(chunkEl);
          }
        }
        scrollToBottom("auto");
      }
    }
  }

  function renderResearchActivity(feed, type, data) {
    if (!feed) return;
    const item = document.createElement("div");

    if (type === "planning") {
      // Planning uses a single persistent element that updates in-place
      let planningEl = feed.querySelector(".research-planning-indicator");
      if (!planningEl) {
        planningEl = document.createElement("div");
        planningEl.className = "research-planning-indicator";
        planningEl.innerHTML = `
                    <div class="planning-icon-wrapper">
                        <div class="planning-spinner"></div>
                    </div>
                    <div class="planning-body">
                        <div class="planning-title">Generating Research Plan</div>
                        <div class="planning-detail"></div>
                    </div>
                `;
        feed.appendChild(planningEl);
      }

      const detailEl = planningEl.querySelector(".planning-detail");
      const titleEl = planningEl.querySelector(".planning-title");
      const iconWrapper = planningEl.querySelector(".planning-icon-wrapper");

      // Update state
      planningEl.dataset.state = data.state || "thinking";

      if (data.state === "complete") {
        titleEl.textContent = "Plan Ready";
        detailEl.textContent = "";
        iconWrapper.innerHTML = '<span class="planning-check">✓</span>';
        planningEl.classList.add("complete");
      } else if (data.state === "warning") {
        detailEl.textContent = data.message || "";
      } else if (data.state === "validating") {
        titleEl.textContent = "Validating Plan";
        detailEl.textContent = data.message || "";
      } else {
        // 'thinking' — show reasoning snippet
        if (data.message) {
          const truncated =
            data.message.length > 120
              ? "..." + data.message.slice(-120)
              : data.message;
          detailEl.textContent = truncated;
        }
      }
      return;
    }

    if (type === "needs_retry") {
      item.className = "research-retry-indicator";
      item.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; border: 1px solid rgba(255,100,100,0.3); border-radius: 8px; background: rgba(255,50,50,0.05); margin-top: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #ff6b6b; font-weight: 600;">
                        <span>⚠️</span> <span>${escapeHtml(data.message)}</span>
                    </div>
                    <button class="btn-primary" style="align-self: flex-start; padding: 0.5rem 1rem; font-size: 0.875rem;" data-retry-state="${escapeHtml(data.state)}">
                        Resume Research from Failed State
                    </button>
                </div>
            `;
      const retryBtn = item.querySelector("button");
      retryBtn.addEventListener("click", () => {
        const rs = retryBtn.getAttribute("data-retry-state");
        retryBtn.disabled = true;
        retryBtn.textContent = "Resuming...";
        // Trigger sendMessage with resumeState
        sendMessage(null, null, false, rs);
      });
      // If this is a retry/alert, we want it OUTSIDE the collapsible activity feed
      // so it remains visible even if the user has closed the activity view.
      const statusContainer = feed
        .closest(".message-content")
        ?.querySelector(".research-status-bars");
      if (statusContainer) {
        statusContainer.appendChild(item);
      } else {
        feed.appendChild(item);
      }
      return;
    }

    if (type === "clarification") {
      // Forward to the universal pop-over system
      showClarificationPopOver(
        data.question,
        data.options || [],
        data.callback_id,
      );

      // Still render a visual placeholder in the feed
      item.className = "research-activity-item compact clarifier-request";
      item.innerHTML = `
                <div class="activity-icon status">❓</div>
                <div class="activity-body">
                    <div class="activity-label">Clarification Requested</div>
                    <div class="activity-detail">${escapeHtml(data.question)}</div>
                </div>
            `;
      feed.appendChild(item);
      return;
    }

    if (type === "phase") {
      item.className = "research-phase-indicator";
      if (data.collapsible) {
        item.classList.add("collapsible");
        item.innerHTML = `
                    <div class="phase-header">
                        <span>${data.icon || "🔬"}</span> <span>${escapeHtml(data.message)}</span>
                    </div>
                    <div class="phase-content"></div>
                `;
      } else {
        item.innerHTML = `
                    <div class="phase-header" style="cursor: default;">
                        <span>${data.icon || "🔬"}</span> <span>${escapeHtml(data.message)}</span>
                    </div>
                `;
      }
      feed.appendChild(item);

      // Add click-to-toggle logic for collapsible phases
      if (data.collapsible) {
        const header = item.querySelector(".phase-header");
        if (header) {
          header.addEventListener("click", (e) => {
            e.stopPropagation();
            item.classList.toggle("expanded");
          });
        }
      }
      return;
    }

    if (type === "reflection") {
      const currentPhase = feed.querySelector(
        ".research-phase-indicator.collapsible:last-of-type",
      );
      const targetContainer = currentPhase
        ? currentPhase.querySelector(".phase-content")
        : feed;
      item.className = "research-activity-item compact";
      item.innerHTML = `
                <div class="activity-icon status">🧠</div>
                <div class="activity-body">
                    <div class="activity-detail">${escapeHtml(data.message)}</div>
                </div>
            `;
      targetContainer.appendChild(item);
      return;
    }

    if (type === "follow_up_search") {
      const currentPhase = feed.querySelector(
        ".research-phase-indicator.collapsible:last-of-type",
      );
      const targetContainer = currentPhase
        ? currentPhase.querySelector(".phase-content")
        : feed;
      item.className = "research-activity-item compact";
      let queriesHtml = "";
      if (data.queries && data.queries.length) {
        queriesHtml = data.queries
          .map((q) => `<code>${escapeHtml(q)}</code>`)
          .join(" ");
      }
      item.innerHTML = `
                <div class="activity-icon status">🔎</div>
                <div class="activity-body">
                    <div class="activity-label">${escapeHtml(data.message)}</div>
                    ${queriesHtml ? `<div class="activity-detail">${queriesHtml}</div>` : ""}
                </div>
            `;
      targetContainer.appendChild(item);
      return;
    }

    if (type === "retrieval_planning") {
      item.className = "research-activity-item compact";
      item.innerHTML = `
                <div class="activity-icon status">${data.icon || "🔗"}</div>
                <div class="activity-body">
                    <div class="activity-detail">${escapeHtml(data.message)}</div>
                </div>
            `;
      feed.appendChild(item);
      return;
    }

    if (type === "search") {
      const targetContainer =
        feed.querySelector(
          ".research-phase-indicator.collapsible:last-of-type .phase-content",
        ) || feed;
      let existingItem = targetContainer.querySelector(
        `[data-step-id="${data.step_id}"]`,
      );

      if (!existingItem) {
        existingItem = document.createElement("div");
        existingItem.className = "research-activity-item activity-item compact";
        existingItem.dataset.stepId = data.step_id;
        existingItem.innerHTML = `
                    <div class="activity-header">
                        <span class="activity-icon search">🔍</span>
                        <span class="activity-label">${escapeHtml(data.displayMessage || "Searching...")}</span>
                    </div>
                    <div class="activity-content">
                        <code>${escapeHtml(data.query)}</code>
                    </div>
                `;
        targetContainer.appendChild(existingItem);

        // Add click-to-toggle logic for search items
        const header = existingItem.querySelector(".activity-header");
        if (header) {
          header.addEventListener("click", (e) => {
            e.stopPropagation();
            existingItem.classList.toggle("expanded");
          });
        }
      } else {
        const label = existingItem.querySelector(".activity-label");
        if (label) label.textContent = data.displayMessage || "Searching...";
      }
      return;
    }

    if (
      type === "search_results" ||
      type === "status" ||
      type === "visit" ||
      type === "visit_complete"
    ) {
      const currentPhase = feed.querySelector(
        ".research-phase-indicator.collapsible:last-of-type",
      );
      const targetContainer = currentPhase
        ? currentPhase.querySelector(".phase-content")
        : feed;

      if (type === "search_results") {
        const stepItem = targetContainer.querySelector(
          `[data-step-id="${data.step_id}"]`,
        );
        if (stepItem && data.results) {
          let resultsDiv = stepItem.querySelector(".activity-search-results");
          if (!resultsDiv) {
            resultsDiv = document.createElement("div");
            resultsDiv.className = "activity-search-results";
            stepItem.querySelector(".activity-body").appendChild(resultsDiv);
          }
          data.results.forEach((r) => {
            const pill = document.createElement("a");
            pill.className = "activity-search-result-pill";
            pill.href = r.url;
            pill.target = "_blank";
            pill.rel = "noopener";
            pill.title = r.snippet || r.title;
            pill.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke-linecap="round" stroke-linejoin="round"/></svg>${escapeHtml(r.title)}`;
            resultsDiv.appendChild(pill);
          });
        }
        return;
      }

      if (type === "status") {
        const stepItem = targetContainer.querySelector(
          `[data-step-id="${data.step_id}"]`,
        );
        if (stepItem) {
          const label = stepItem.querySelector(".activity-label");
          if (label) label.textContent = data.message;
          const icon = stepItem.querySelector(".activity-icon");
          if (icon && data.icon) icon.textContent = data.icon;
        } else {
          item.className = "research-activity-item compact";
          item.innerHTML = `
                        <div class="activity-icon status">${data.icon || "⚙️"}</div>
                        <div class="activity-body">
                            <div class="activity-detail">${escapeHtml(data.message)}</div>
                        </div>
                    `;
          targetContainer.appendChild(item);
        }
        return;
      }

      if (type === "visit") {
        item.className = "research-activity-item compact processing";
        const urlDisplay =
          data.url.length > 50 ? data.url.substring(0, 47) + "..." : data.url;
        item.innerHTML = `
                    <div class="activity-icon visit">📄</div>
                    <div class="activity-body">
                        <div class="activity-detail" style="font-weight: 500;"><a class="activity-visit-url" href="${escapeHtml(data.url)}" target="_blank" rel="noopener">${escapeHtml(urlDisplay)}</a></div>
                    </div>
                `;
        item.dataset.url = data.url;
        targetContainer.appendChild(item);
        return;
      }

      if (type === "visit_complete") {
        const visitItem = targetContainer.querySelector(
          `[data-url="${data.url}"]`,
        );
        if (visitItem) {
          visitItem.classList.remove("processing");
          const body = visitItem.querySelector(".activity-body");
          if (body && (data.preview || data.full_content)) {
            const detail = document.createElement("div");
            detail.className = "activity-visit-card";
            detail.innerHTML = data.full_content
              ? `
                             <div class="activity-visit-preview">${escapeHtml(data.preview)}</div>
                             <details class="activity-visit-full-content">
                                 <summary>${(data.chars || 0).toLocaleString()} chars</summary>
                                 <div class="full-content-text">${escapeHtml(data.full_content)}</div>
                             </details>
                         `
              : `
                             <div class="activity-visit-preview">${escapeHtml(data.preview || "")}</div>
                         `;
            body.appendChild(detail);
          }
        }
        return;
      }
    }
  }

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

  // 6. Mobile Keyboard Stability (Visual Viewport Sync)
  if (window.visualViewport) {
    const chatInputArea = document.getElementById("chat-input-area");

    const syncViewport = () => {
      if (window.innerWidth <= 768) {
        // Calculate the offset from the bottom of the layout viewport
        const offset = window.innerHeight - window.visualViewport.height;

        // Only move if keyboard height is significant (> 10px) to avoid jitter
        if (offset > 10) {
          chatInputArea.style.transform = `translateY(-${offset}px)`;
        } else {
          chatInputArea.style.transform = "translateY(0)";
        }
      } else {
        chatInputArea.style.transform = "";
      }
    };

    window.visualViewport.addEventListener("resize", syncViewport);
    window.visualViewport.addEventListener("scroll", syncViewport);
  }

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
        applyFileSystemFilter();
        return data.file_systems.length; // Issue 3.5: return count for fileSystemMode auto-inference
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
  function applyFileSystemFilter() {
    const q = _file_systemSearchQuery.trim().toLowerCase();
    const folder = _currentFolderFilter;

    let filtered = _allFileSystems;

    // Filter out useless internal files (plans, research, sections)
    filtered = filtered.filter((c) => {
      if (!c || !c.id) return true;
      return !(c.id.startsWith("plan_") || c.id === "plan" || c.id.startsWith("research_") || c.id.startsWith("section_"));
    });

    // Folder filter (matches top-level directory)
    if (folder) {
      filtered = filtered.filter((c) => {
        const path = c.filename || c.title;
        const cFolder = path.includes("/") ? path.split("/")[0] : "";
        return cFolder === folder;
      });
    }

    // Search filter — match filename/path or snippet
    if (q) {
      filtered = filtered.filter((c) => {
        const path = c.filename || c.title;
        const titleMatch = path.toLowerCase().includes(q);
        const contentMatch =
          (c.content && c.content.toLowerCase().includes(q)) ||
          (c.preview && c.preview.toLowerCase().includes(q));
        return titleMatch || contentMatch;
      });
    }

    renderFilteredFileSystemList(filtered, q);
  }

  // Keep the old name as an alias so callers outside still work
  function renderFileSystemList(file_systems) {
    _allFileSystems = file_systems || [];
    applyFileSystemFilter();
  }

  // Build a single file_system item DOM node
  function buildFileSystemItem(file_system, highlightQuery) {
    const item = document.createElement("div");
    item.className = `file-system-item ${currentFileSystemId === file_system.id ? "active" : ""}`;
    item.dataset.file_systemId = file_system.id;

    let typeBadge = "";
    if (file_system.language && file_system.language !== "markdown") {
      typeBadge = `<span class="type-badge" style="background: var(--surface-2); color: var(--content-muted); border: 1px solid var(--border);">${escapeHtml(file_system.language)}</span>`;
    }

    // Build snippet — highlight search match if present
    let snippet = "";
    if (file_system.content && file_system.content.length > 0) {
      let previewContent = file_system.content.replace(/\n/g, " ");
      if (highlightQuery) {
        // Find match position, center snippet around it
        const matchIdx = previewContent.toLowerCase().indexOf(highlightQuery);
        if (matchIdx !== -1) {
          const start = Math.max(0, matchIdx - 40);
          const end = Math.min(
            previewContent.length,
            matchIdx + highlightQuery.length + 60,
          );
          const raw = previewContent.substring(start, end);
          const escaped = escapeHtml(raw);
          const escapedQuery = escapeHtml(highlightQuery);
          const highlighted = escaped.replace(
            new RegExp(
              escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "gi",
            ),
            (m) => `<mark class="file-system-highlight">${m}</mark>`,
          );
          snippet = `<div class="file-system-snippet">${start > 0 ? "…" : ""}${highlighted}${end < previewContent.length ? "…" : ""}</div>`;
        } else {
          const sub = previewContent.substring(0, 120);
          snippet = `<div class="file-system-snippet">${escapeHtml(sub)}${previewContent.length > 120 ? "…" : ""}</div>`;
        }
      } else {
        const sub = previewContent.substring(0, 120);
        snippet = `<div class="file-system-snippet">${escapeHtml(sub)}${previewContent.length > 120 ? "…" : ""}</div>`;
      }
    }

    const dateStr = new Date(file_system.timestamp * 1000).toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short",
    });
    const displayTitle = file_system.displayTitle || file_system.title;

    const downloadButton = `
        <div class="file-system-export-inline">
            <button class="file-system-action-btn download-btn" title="Download File">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
        </div>
    `;

    item.innerHTML = `
            <div class="file-system-item-header">
                <div class="file-system-item-title">${escapeHtml(displayTitle)}</div>
                <div class="file-system-item-badges">${typeBadge}</div>
            </div>
            ${snippet}
            <div class="file-system-item-meta">${dateStr}</div>
            <div class="file-system-item-actions">
                ${downloadButton}
                <button class="file-system-action-btn delete-btn" title="Delete Artifact">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-rose)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;

    item.addEventListener("click", () => loadFileSystem(file_system.id, file_system.workspace_id));

    // FileSystem context menu / Long press support
    let cLongPressTimer;
    let cIsLongPress = false;
    let cStartY = 0;
    let cStartX = 0;

    item.addEventListener(
      "touchstart",
      (e) => {
        cIsLongPress = false;
        cStartY = e.touches[0].clientY;
        cStartX = e.touches[0].clientX;
        cLongPressTimer = setTimeout(() => {
          cIsLongPress = true;
          if (navigator.vibrate) navigator.vibrate(50);
          showContextMenu("file_system", file_system.id, file_system.fullPath || file_system.title, e, file_system.workspace_id);
        }, 600);
      },
      { passive: true },
    );

    item.addEventListener(
      "touchmove",
      (e) => {
        if (
          Math.abs(e.touches[0].clientY - cStartY) > 10 ||
          Math.abs(e.touches[0].clientX - cStartX) > 10
        ) {
          clearTimeout(cLongPressTimer);
        }
      },
      { passive: true },
    );

    item.addEventListener(
      "touchend",
      (e) => {
        clearTimeout(cLongPressTimer);
        if (cIsLongPress) {
          if (e.cancelable) e.preventDefault();
        }
      },
      { passive: false },
    );

    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showContextMenu("file_system", file_system.id, file_system.fullPath || file_system.title, e, file_system.workspace_id);
    });

    item.querySelector(".download-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      downloadFileSystem(file_system.id, file_system.workspace_id);
    });
    item.querySelector(".delete-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirmed = await showConfirm(
        "Delete Artifact",
        `Are you sure you want to delete "${file_system.displayTitle || file_system.title}"? This action cannot be undone.`,
        true,
      );
      if (confirmed) {
        await deleteFileSystem(file_system.id, file_system.workspace_id);
      }
    });

    return item;
  }

  // Render filtered list with true nested tree
  function renderFilteredFileSystemList(file_systems, highlightQuery) {
    if (!file_systemListContainer) return;
    file_systemListContainer.innerHTML = "";

    if (file_systems.length === 0) {
      const q = (_file_systemSearchQuery || "").trim();
      file_systemListContainer.innerHTML = `<div class="file-system-list-empty-state">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.35;">
                    ${q ? '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' : '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/>'}
                </svg>
                <p>${q ? `No artifacts match "${escapeHtml(q)}"` : "No saved artifacts yet"}</p>
            </div>`;
      return;
    }

    // Build the tree from filenames (paths)
    const tree = { folders: {}, files: [] };
    const folderPaths = new Set();
    
    file_systems.forEach((file_system) => {
      const path = file_system.filename || file_system.title;
      const parts = path.split('/');
      
      let current = tree;
      let currentPath = "";
      
      if (file_system.type === "directory") {
        for (let i = 0; i < parts.length; i++) {
          const folderName = parts[i];
          currentPath += (currentPath ? "/" : "") + folderName;
          folderPaths.add(currentPath);
          
          if (!current.folders[folderName]) {
            current.folders[folderName] = { folders: {}, files: [], path: currentPath };
          }
          current = current.folders[folderName];
        }
        return; // It's just an empty directory placeholder, do not push to files
      }
      
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        currentPath += (currentPath ? "/" : "") + folderName;
        folderPaths.add(currentPath);
        
        if (!current.folders[folderName]) {
          current.folders[folderName] = { folders: {}, files: [], path: currentPath };
        }
        current = current.folders[folderName];
      }
      
      // Update display title to basename
      file_system.displayTitle = parts[parts.length - 1];
      file_system.fullPath = path;
      current.files.push(file_system);
    });

    currentChatArtifactFolders = Array.from(folderPaths);

    // Recursive function to render tree
    function renderTree(node, container, level = 0) {
      const sortedFolders = Object.keys(node.folders).sort();
      
      sortedFolders.forEach(folderName => {
        const folderNode = node.folders[folderName];
        const folderPath = folderNode.path;
        const isExpanded = artifactFoldersExpanded[folderPath] !== false; // Default true
        
        const folderDiv = document.createElement("div");
        folderDiv.className = `folder-item ${isExpanded ? "expanded" : ""}`;
        folderDiv.style.marginLeft = level > 0 ? "2px" : "0";

        const folderHeader = document.createElement("div");
        folderHeader.className = "folder-header";

        const folderIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity: 0.7;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
        const chevronSvg = `<svg class="folder-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

        const nameWrapper = document.createElement("div");
        nameWrapper.style.cssText = "display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;";
        const nameSpan = document.createElement("span");
        nameSpan.style.cssText = "overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8125rem; font-weight: 600; color: var(--content-primary);";
        nameSpan.textContent = folderName;
        nameWrapper.innerHTML = folderIconSvg;
        nameWrapper.appendChild(nameSpan);

        // Count logic: sum of all files in this subtree
        let totalFiles = 0;
        function countFiles(n) {
           let count = n.files.length;
           for(let k in n.folders) {
              count += countFiles(n.folders[k]);
           }
           return count;
        }
        totalFiles = countFiles(folderNode);

        const countSpan = document.createElement("span");
        countSpan.style.cssText = "font-size: 0.7rem; color: var(--content-muted); background: var(--surface-secondary); padding: 1px 6px; border-radius: 6px; font-weight: 500;";
        countSpan.textContent = totalFiles;

        folderHeader.innerHTML = chevronSvg;
        folderHeader.appendChild(nameWrapper);
        folderHeader.appendChild(countSpan);

        folderHeader.onclick = () => {
          const expanding = !folderDiv.classList.contains("expanded");
          folderDiv.classList.toggle("expanded", expanding);
          artifactFoldersExpanded[folderPath] = expanding;
          saveArtifactFoldersExpanded();
        };

        folderHeader.oncontextmenu = (e) => {
          e.preventDefault();
          showContextMenu("file-system-folder", folderPath, null, e);
        };

        const folderContent = document.createElement("div");
        folderContent.className = "folder-content";
        
        renderTree(folderNode, folderContent, level + 1);

        folderDiv.appendChild(folderHeader);
        folderDiv.appendChild(folderContent);
        container.appendChild(folderDiv);
      });
      
      // Sort files alphabetically
      node.files.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
      
      node.files.forEach(file_system => {
         const item = buildFileSystemItem(file_system, highlightQuery);
         if (level > 0) {
             item.style.marginLeft = "2px";
         }
         container.appendChild(item);
      });
    }
    
    renderTree(tree, file_systemListContainer, 0);
  }

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
          await loadVersionsWithCurrentState(file_systemId, currentChatId, workspaceId);
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

  async function exportFileSystem(file_systemId, format = "markdown") {
    // Legacy export function - still here in case something else uses it
    try {
      const res = await fetch(
        `${API_MODULES.FILE_SYSTEMS}/${file_systemId}/export/${format}?chat_id=${currentChatId}`,
      );
      if (!res.ok) {
        console.error("Failed to export file_system");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = res.headers.get("content-disposition");
      let filename = `file_system.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Failed to export file_system:", e);
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
      _file_systemSearchQuery = file_systemSearchInput.value;
      if (file_systemSearchClear) {
        file_systemSearchClear.classList.toggle("hidden", !_file_systemSearchQuery);
      }
      applyFileSystemFilter();
    });
  }

  if (file_systemSearchClear) {
    file_systemSearchClear.addEventListener("click", () => {
      if (file_systemSearchInput) file_systemSearchInput.value = "";
      _file_systemSearchQuery = "";
      _currentFolderFilter = ""; // Clear folder filter when clearing search
      file_systemSearchClear.classList.add("hidden");
      applyFileSystemFilter();
    });
  }

  if (file_systemFilterRow) {
    file_systemFilterRow.addEventListener("click", (e) => {
      const pill = e.target.closest(".file-system-filter-pill");
      if (!pill) return;
      // Update active pill
      file_systemFilterRow
        .querySelectorAll(".file-system-filter-pill")
        .forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      _file_systemTypeFilter = pill.dataset.filter;
      _currentFolderFilter = ""; // Clear folder filter when changing type
      applyFileSystemFilter();
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
    await setEditorLanguage(currentFileSystemLanguage);

    // Update editors with new content (runs after language parser is ready)
    if (window.fileSystemEditor) {
      window.fileSystemEditor.dispatch({
        changes: {
          from: 0,
          to: window.fileSystemEditor.state.doc.length,
          insert: currentFileSystemContentRaw,
        },
      });
    }

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
      renderFileSystemPreview(
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
      if (fileSystemPanelUndoBtn) fileSystemPanelUndoBtn.classList.add("hidden");
      if (fileSystemPanelRedoBtn) fileSystemPanelRedoBtn.classList.add("hidden");
      if (fileSystemPanelHistoryBtn) fileSystemPanelHistoryBtn.classList.add("hidden");
    } else {
      if (fileSystemPanelApproveBtn) fileSystemPanelApproveBtn.classList.add("hidden");
      if (fileSystemPanelSuggestBtn) fileSystemPanelSuggestBtn.classList.add("hidden");
      if (file_systemPlanEditArea) file_systemPlanEditArea.classList.add("hidden"); // Ensure edit area is closed

      // Re-show undo/redo/history for normal artifacts
      if (fileSystemPanelUndoBtn) fileSystemPanelUndoBtn.classList.remove("hidden");
      if (fileSystemPanelRedoBtn) fileSystemPanelRedoBtn.classList.remove("hidden");
      if (fileSystemPanelHistoryBtn)
        fileSystemPanelHistoryBtn.classList.remove("hidden");
    }

    // Lock research plan file_system from editing
    const isPlanFileSystem =
      data.id && (data.id.startsWith("plan_") || data.id === "plan");
    if (isPlanFileSystem) {
      setEditorReadOnly(true);
      if (fileSystemCodemirrorContainer)
        fileSystemCodemirrorContainer.style.opacity = "0.7"; // Visual hint
    } else {
      setEditorReadOnly(isGenerating);
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
        loadVersionsWithCurrentState(data.id, currentChatId, data.workspace_id);
      } else {
        // Use debounce for updates to avoid spam
        debouncedFetchFileSystems(currentChatId);
        // Also refresh version state (for UNDO/REDO buttons)
        loadVersionsWithCurrentState(data.id, currentChatId, data.workspace_id);
      }
    }
  }

  function updateFileSystemLockState() {
    setEditorReadOnly(isGenerating);
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
            renderFileSystemPreview(
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
            loadVersionsWithCurrentState(currentFileSystemId, currentChatId, currentFileSystemWorkspaceId);
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

  // Persist AI-generated file_system changes to backend
  function persistFileSystemChange(file_systemId, content) {
    fetch(`${API_MODULES.FILE_SYSTEMS}/${file_systemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: currentChatId, 
        workspace_id: currentFileSystemWorkspaceId,
        content: content 
      }),
    }).catch((err) =>
      console.error("Failed to persist AI file_system change:", err),
    );
  }

  // Auto-save on input for file_system panel and report file_system
  // Removed old fileSystemPanelEditor listener since CodeMirror's updateListener handles it

  /* ═══════════════════════════════════════════
       VERSION HISTORY SYSTEM
       ═══════════════════════════════════════════ */

  // Undo/Redo buttons
  const fileSystemPanelUndoBtn = document.getElementById("file-system-panel-undo-btn");
  const fileSystemPanelRedoBtn = document.getElementById("file-system-panel-redo-btn");

  const versionHistoryModal = document.getElementById("version-history-modal");
  const closeVersionHistoryBtn = document.getElementById(
    "close-version-history",
  );
  const versionHistoryFileSystemName = document.getElementById(
    "version-history-file-system-name",
  );
  const versionListLoading = document.getElementById("version-list-loading");
  // Fix: ID mismatch between index.html ('version-list') and script.js ('version-list-items')
  const versionListItems = document.getElementById("version-list");
  const versionDiffPanel = document.getElementById("version-diff-panel");
  const versionDiffTitle = document.getElementById("version-diff-title");
  const versionDiffBody = document.getElementById("version-diff-body");
  const versionRestoreBtn = document.getElementById("version-restore-btn");
  const fileSystemPanelHistoryBtn = document.getElementById(
    "file-system-panel-history-btn",
  );

  let _versionHistoryFileSystemId = null;
  let _versionHistoryVersions = [];
  let _selectedVersionNumber = null;
  let _selectedNavIndex = null;

  // Undo/Redo state
  let _currentVersionNumber = null; // Current active version number for the file_system
  let _versionHistoryCache = null; // Cached versions list
  let _navigationPath = []; // Non-linear version path (e.g. [1,2,3,4,5,6,4,7])
  let _navigationIndex = -1; // Current pointer in the navigation path

  // Get current version number for a file_system
  async function getCurrentVersionNumber(file_systemId, chatId) {
    try {
      const res = await fetch(
        `${API_MODULES.FILE_SYSTEMS}/${file_systemId}/current-version?chat_id=${chatId}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.current_version) {
          return data.current_version;
        }
      }
    } catch (err) {
      console.error("Failed to get current version:", err);
    }
    return null;
  }

  // Update undo/redo button states
  function updateUndoRedoButtons() {
    if (_navigationIndex === -1 || !_navigationPath) return;

    const isFirstInPath = _navigationIndex <= 0;
    const isLastInPath = _navigationIndex >= _navigationPath.length - 1;

    if (fileSystemPanelUndoBtn) {
      fileSystemPanelUndoBtn.disabled = isFirstInPath;
    }
    if (fileSystemPanelRedoBtn) {
      fileSystemPanelRedoBtn.disabled = isLastInPath;
    }
  }

  // Load versions and set current version
  async function loadVersionsWithCurrentState(file_systemId, chatId, workspaceId = null) {
    try {
      const wsParam = workspaceId ? `&workspace_id=${workspaceId}` : "";
      // 1. Fetch versions
      const versionsRes = await fetch(
        `${API_MODULES.FILE_SYSTEMS}/${file_systemId}/versions?chat_id=${chatId}${wsParam}`,
      );
      if (!versionsRes.ok) throw new Error("Failed to load versions");
      const versionsData = await versionsRes.json();
      if (!versionsData.success) throw new Error(versionsData.error || "Failed to load versions");

      _versionHistoryCache = versionsData.versions.sort((a, b) => a.version_number - b.version_number);

      // 2. Fetch FileSystem Meta (for navigation path)
      const metaRes = await fetch(`${API_MODULES.FILE_SYSTEMS}/${file_systemId}?chat_id=${chatId}${wsParam}`);
      if (!metaRes.ok) throw new Error("Failed to load file_system metadata");
      const metaData = await metaRes.json();

      if (metaData.success) {
        try {
          _navigationPath = JSON.parse(metaData.navigation_history || "[]");
          _navigationIndex = parseInt(metaData.navigation_index, 10);
        } catch (e) {
          _navigationPath = [];
          _navigationIndex = -1;
        }

        // Sync current version number with the navigation index
        if (_navigationIndex >= 0 && _navigationIndex < _navigationPath.length) {
          _currentVersionNumber = _navigationPath[_navigationIndex];
        } else {
          _currentVersionNumber = null;
        }
      }

      updateUndoRedoButtons();
      return _versionHistoryCache;
    } catch (err) {
      console.error("Failed to load versions/metadata:", err);
      return [];
    }
  }

  // Internal helper to apply version state to UI
  async function _applyVersionState(versionNumber) {
    if (!_versionHistoryCache) return;
    const version = _versionHistoryCache.find(v => v.version_number === versionNumber);
    if (!version) return;

    _currentVersionNumber = versionNumber;
    currentFileSystemContentRaw = version.content;

    if (window.fileSystemEditor) {
      window.fileSystemEditor.dispatch({
        changes: {
          from: 0,
          to: window.fileSystemEditor.state.doc.length,
          insert: currentFileSystemContentRaw,
        },
      });
    }
    const badge = document.getElementById("version-badge");
    if (badge) {
      badge.textContent = `V${versionNumber}`;
      badge.classList.remove("hidden");
    }
    updateUndoRedoButtons();
  }

  // Navigate to a specific version
  async function navigateToVersion(versionNumber, addToHistory = true) {
    if (!_versionHistoryCache) return;

    try {
      if (addToHistory) {
        // Prune future path if we are in the middle of history
        if (_navigationIndex >= 0 && _navigationIndex < _navigationPath.length - 1) {
          _navigationPath = _navigationPath.slice(0, _navigationIndex + 1);
        }
        _navigationPath.push(versionNumber);
        _navigationIndex = _navigationPath.length - 1;
      }

      // Persist the current_version and navigation state in the DB
      const patchData = {
        chat_id: currentChatId,
        workspace_id: currentFileSystemWorkspaceId,
        current_version: versionNumber
      };
      if (addToHistory) {
        patchData.navigation_history = JSON.stringify(_navigationPath);
        patchData.navigation_index = _navigationIndex;
      }

      const res = await fetch(`${API_MODULES.FILE_SYSTEMS}/${currentFileSystemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });

      if (res.ok) {
        await _applyVersionState(versionNumber);
      }
    } catch (err) {
      console.error("Failed to navigate to version:", err);
    }
  }

  // Undo: traverse back in the navigation path
  async function handleUndo() {
    if (_navigationIndex <= 0) return;

    _navigationIndex--;
    const targetVersion = _navigationPath[_navigationIndex];

    try {
      await fetch(`${API_MODULES.FILE_SYSTEMS}/${currentFileSystemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: currentChatId,
          workspace_id: currentFileSystemWorkspaceId,
          navigation_index: _navigationIndex,
          current_version: targetVersion
        }),
      });
      await _applyVersionState(targetVersion);
    } catch (err) {
      console.error("Undo failed:", err);
    }
  }

  // Redo: traverse forward in the navigation path
  async function handleRedo() {
    if (!_navigationPath || _navigationIndex >= _navigationPath.length - 1) return;

    _navigationIndex++;
    const targetVersion = _navigationPath[_navigationIndex];

    try {
      await fetch(`${API_MODULES.FILE_SYSTEMS}/${currentFileSystemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: currentChatId,
          workspace_id: currentFileSystemWorkspaceId,
          navigation_index: _navigationIndex,
          current_version: targetVersion
        }),
      });
      await _applyVersionState(targetVersion);
    } catch (err) {
      console.error("Redo failed:", err);
    }
  }

  // Handle version navigation after navigating away and editing (Branching)
  async function handleVersionEdit() {
    if (!_currentVersionNumber || !_versionHistoryCache) return;

    const maxVersion = _versionHistoryCache.length;
    if (_currentVersionNumber < maxVersion) {
      console.log(
        "Branching edit: Current version is",
        _currentVersionNumber,
        "of",
        maxVersion,
      );
      // In a branching model, we don't delete future versions.
      // The next PATCH will automatically create a new version head (maxVersion + 1).
      // We just need to make sure the local state is ready.
    }
  }

  async function openVersionHistory() {
    if (!currentFileSystemId || !currentChatId) return;

    _versionHistoryFileSystemId = currentFileSystemId;
    _versionHistoryVersions = [];
    _selectedVersionNumber = null;

    // Load current version state and versions
    await loadVersionsWithCurrentState(currentFileSystemId, currentChatId, currentFileSystemWorkspaceId);

    // Show modal
    versionHistoryModal.classList.add("open");

    // Update file_system name subtitle
    if (versionHistoryFileSystemName) {
      versionHistoryFileSystemName.textContent =
        fileSystemPanelTitle?.textContent || currentFileSystemId;
    }

    // Reset to list view
    if (versionDiffPanel) versionDiffPanel.classList.add("hidden");
    if (versionRestoreBtn) versionRestoreBtn.style.display = "none";
    const placeholder = document.getElementById("version-preview-placeholder");
    if (placeholder) placeholder.classList.remove("hidden");
    if (versionListItems) versionListItems.innerHTML = "";
    if (versionListLoading) versionListLoading.classList.remove("hidden");

    try {
      const res = await fetch(
        `${API_MODULES.FILE_SYSTEMS}/${currentFileSystemId}/versions?chat_id=${currentChatId}`,
      );
      if (!res.ok) {
        throw new Error("No versions found");
      }
      const data = await res.json();
      if (!data.success)
        throw new Error(data.error || "Failed to load versions");

      // Sort newest first for display (if we still need this for some reason, but we use map now)
      _versionHistoryVersions = data.versions.sort(
        (a, b) => b.version_number - a.version_number,
      );
      renderVersionList();
    } catch (err) {
      if (versionListItems) {
        versionListItems.innerHTML = `<div class="version-list-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;margin-bottom:0.5rem;">
                        <polyline points="12 8 12 12 14 14" stroke-linecap="round" stroke-linejoin="round"></polyline>
                        <path d="M3.05 11a9 9 0 1 0 .5-4" stroke-linecap="round"></path>
                    </svg>
                    <p>No version history yet.<br>Versions are saved automatically when content changes.</p>
                </div>`;
      }
    } finally {
      if (versionListLoading) versionListLoading.classList.add("hidden");
    }
  }

  function renderVersionList() {
    if (!versionListItems || !_navigationPath || !_versionHistoryCache) return;
    versionListItems.innerHTML = "";

    // Show the navigation path in reverse (most recent navigation on top)
    for (let i = _navigationPath.length - 1; i >= 0; i--) {
      const vNum = _navigationPath[i];
      const vMeta = _versionHistoryCache.find((v) => v.version_number === vNum);
      if (!vMeta) continue;

      const item = document.createElement("div");
      const isActive = i === _navigationIndex;
      item.className = `version-item${isActive ? " current-version" : ""}`;
      item.dataset.navIndex = i;
      item.dataset.versionNumber = vNum;

      const date = new Date(vMeta.timestamp * 1000);
      const dateStr = date.toLocaleString([], {
        dateStyle: "short",
        timeStyle: "short",
      });
      const author = vMeta.author || "system";
      const comment = vMeta.comment || (i === 0 ? "Initial version" : "Navigated");

      const isCurrentBadge = isActive
        ? `<span class="version-current-badge">Current</span>`
        : "";

      item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <span class="version-item-number">v${vNum}</span>
                    ${isCurrentBadge}
                </div>
                <div class="version-item-comment">${escapeHtml(comment)}</div>
                <div class="version-item-meta">
                    <span class="version-item-author">${escapeHtml(author)}</span>
                    <span>·</span>
                    <span>${dateStr}</span>
                </div>
            `;

      item.addEventListener("click", () => {
        // Preview the version and show its diff
        openVersionDiff(vNum, vMeta, i);
      });
      versionListItems.appendChild(item);
    }
  }

  async function openVersionDiff(versionNumber, versionMeta, navIndex = null) {
    if (!versionDiffPanel || !versionDiffBody || !versionRestoreBtn) return;

    _selectedVersionNumber = versionNumber;
    _selectedNavIndex = navIndex;

    // Show diff panel
    versionDiffPanel.classList.remove("hidden");
    const placeholder = document.getElementById("version-preview-placeholder");
    if (placeholder) placeholder.classList.add("hidden");

    // Mark item as active in list
    document
      .querySelectorAll(".version-item")
      .forEach((el) => el.classList.remove("active"));
    
    let activeSelector = `.version-item[data-version-number="${versionNumber}"]`;
    if (navIndex !== null) {
      activeSelector = `.version-item[data-nav-index="${navIndex}"]`;
    }
    const activeItem = document.querySelector(activeSelector);
    if (activeItem) activeItem.classList.add("active");

    const isCurrentVersion = (versionNumber === _currentVersionNumber);

    // Update diff panel header
    const dateStr = new Date(versionMeta.timestamp * 1000).toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short",
    });
    if (versionDiffTitle) {
      versionDiffTitle.textContent = `v${versionNumber} — ${dateStr}`;
    }

    // Disable restore button for current version
    if (versionRestoreBtn) {
      versionRestoreBtn.style.display = ""; 
      versionRestoreBtn.disabled = isCurrentVersion;
      versionRestoreBtn.dataset.versionNumber = versionNumber;
      versionRestoreBtn.dataset.navIndex = navIndex;
      
      // Update text to reflect status
      versionRestoreBtn.textContent = isCurrentVersion ? "Already at this version" : "Restore this version";
    }

    versionDiffBody.innerHTML = `<div class="version-list-loading" style="height:100%;justify-content:center;"><div class="spinner" style="width:24px;height:24px;"></div><span>Loading version…</span></div>`;

    try {
      // Fetch the version content preview
      const contentRes = await fetch(
        `${API_MODULES.FILE_SYSTEMS}/${_versionHistoryFileSystemId}/versions/${versionNumber}?chat_id=${currentChatId}`,
      );
      if (!contentRes.ok) throw new Error("Failed to load version content");
      const contentData = await contentRes.json();
      const thisContent = contentData.content || "";

      versionDiffBody.innerHTML = "";

      // Show full content preview
      const pre = document.createElement("div");
      pre.className = "version-preview-content";
      pre.textContent = thisContent;
      versionDiffBody.appendChild(pre);
    } catch (err) {
      versionDiffBody.innerHTML = `<div class="diff-no-changes"><p>Failed to load version content. Please try again.</p></div>`;
    }
  }

  async function restoreVersion(versionNumber) {
    if (!_versionHistoryFileSystemId || !versionNumber) return;

    try {
      const res = await fetch(
        `${API_MODULES.FILE_SYSTEMS}/${_versionHistoryFileSystemId}/versions/${versionNumber}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: currentChatId }),
        },
      );
      const data = await res.json();

      if (data.success) {
        // Refresh version state for non-linear undo/redo
        await loadVersionsWithCurrentState(_versionHistoryFileSystemId, currentChatId, currentFileSystemWorkspaceId);

        // Reload file_system content in the panel
        const wsParam = currentFileSystemWorkspaceId ? `&workspace_id=${currentFileSystemWorkspaceId}` : "";
        const contentRes = await fetch(
          `${API_MODULES.FILE_SYSTEMS}/${_versionHistoryFileSystemId}?chat_id=${currentChatId}${wsParam}`,
        );
        const contentData = await contentRes.json();

        if (contentData.success) {
          currentFileSystemContentRaw = contentData.content;
          if (window.fileSystemEditor) {
            window.fileSystemEditor.dispatch({
              changes: {
                from: 0,
                to: window.fileSystemEditor.state.doc.length,
                insert: currentFileSystemContentRaw,
              },
            });
          }
        }

        // Close the modal
        versionHistoryModal.classList.remove("open");

        // Refresh sidebar
        if (currentChatId) fetchFileSystems(currentChatId);

        // Toast feedback
        const toast = document.createElement("div");
        toast.className = "toast-notification";
        toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" stroke-width="2.5"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg> Restored to v${versionNumber}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add("show"), 10);
        setTimeout(() => {
          toast.classList.remove("show");
          setTimeout(() => toast.remove(), 300);
        }, 3000);
      } else {
        await showModal(
          "Restore Failed",
          data.error || "Could not restore this version.",
          { type: "alert" },
        );
      }
    } catch (err) {
      await showModal("Restore Failed", "A network error occurred.", {
        type: "alert",
      });
    }
  }

  // Wire up history button
  if (fileSystemPanelHistoryBtn) {
    fileSystemPanelHistoryBtn.addEventListener("click", openVersionHistory);
  }

  // Wire up undo/redo buttons
  if (fileSystemPanelUndoBtn) {
    fileSystemPanelUndoBtn.addEventListener("click", handleUndo);
  }
  if (fileSystemPanelRedoBtn) {
    fileSystemPanelRedoBtn.addEventListener("click", handleRedo);
  }

  // Close version history modal
  if (closeVersionHistoryBtn) {
    closeVersionHistoryBtn.addEventListener("click", () => {
      versionHistoryModal.classList.remove("open");
    });
  }

  // Backdrop click to close
  if (versionHistoryModal) {
    versionHistoryModal.addEventListener("click", (e) => {
      if (e.target === versionHistoryModal) {
        versionHistoryModal.classList.remove("open");
      }
    });
  }

  // Restore button
  if (versionRestoreBtn) {
    versionRestoreBtn.addEventListener("click", () => {
      const vNum = parseInt(versionRestoreBtn.dataset.versionNumber, 10);
      if (vNum) restoreVersion(vNum);
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
    const baseWidth = 50; // Base width as percentage
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

  // ==================== PHASE 9: NEW RENDERING PIPELINE ====================

  /**
   * Get sub-agent messages for a specific assistant turn
   *
   * @param {number} parentMessageId - The parent assistant message ID
   * @param {Array} allSubAgents - All sub-agent messages
   * @returns {Array} Filtered sub-agent messages for this turn
   */
  function getSubAgentsForTurn(parentMessageId, allSubAgents) {
    if (!allSubAgents || !Array.isArray(allSubAgents)) return [];
    return allSubAgents.filter((m) => m.parent_message_id === parentMessageId);
  }

  /**
   * Render a unified thought box with activity feed for an assistant turn
   *
   * @param {Object} turnData - Assistant turn data with userMessage, assistantMessages, chunks, activities
   * @param {Array} subAgents - Sub-agent messages for this turn
   * @returns {string} HTML for the thought box with activity feed
   */
  function _renderAssistantTurnThoughtBox(
    turnData,
    subAgents = [],
    extraContent = "",
  ) {
    const {
      userMessage,
      assistantMessages = [],
      chunks,
      activities,
    } = turnData;

    // Allow rendering even if no assistantMessages exist (for in-progress turn recovery from SSE chunks)
    const hasAssistantMessages =
      assistantMessages && assistantMessages.length > 0;
    const lastAssistantMsg = hasAssistantMessages
      ? assistantMessages[assistantMessages.length - 1]
      : null;
    const model = lastAssistantMsg ? lastAssistantMsg.model : "";

    // Extract clean content from assistant messages (excluding reasoning tags, sub-agent tags)
    let cleanContent = "";
    for (const msg of assistantMessages) {
      if (msg.role === "assistant" && msg.content) {
        let content = msg.content;
        if (Array.isArray(content)) {
          content = content.find((c) => c.type === "text")?.text || "";
        } else if (typeof content === "object") {
          try {
            content = JSON.stringify(content);
          } catch (e) {
            content = String(content);
          }
        }
        // Remove <think> tags
        const startTag = "<think>";
        const endTag = "</think>";
        const startIdx = content.indexOf(startTag);
        const endIdx =
          startIdx !== -1
            ? content.indexOf(endTag, startIdx) + endTag.length
            : -1;
        if (startIdx !== -1 && endIdx !== -1) {
          content = content.substring(0, startIdx) + content.substring(endIdx);
        }
        // Remove <think> tags (legacy)
        const startTag2 = "<think>";
        const endTag2 = "</think>";
        const startIdx2 = content.indexOf(startTag2);
        const endIdx2 =
          startIdx2 !== -1
            ? content.indexOf(endTag2, startIdx2) + endTag2.length
            : -1;
        if (startIdx2 !== -1 && endIdx2 !== -1) {
          content =
            content.substring(0, startIdx2) + content.substring(endIdx2);
        }
        if (content) {
          if (cleanContent) cleanContent += "\n\n";
          cleanContent += content;
        }
      }
    }

    // If content is still empty, check for friendly tool call status
    if (!cleanContent.trim() && lastAssistantMsg) {
      cleanContent = getAssistantFriendlyContent(lastAssistantMsg);
    }

    // Append extra content from SSE chunks (e.g. for incomplete turns)
    if (extraContent && !cleanContent.includes(extraContent.substring(0, 10))) {
      if (cleanContent) cleanContent += "\n";
      cleanContent += extraContent;
    }

    // Build activity feed inner HTML.
    // _buildActivityFeedContent handles grouping of named-agent activities into
    // .sub-agent-section containers that match the live-streaming DOM exactly.
    const activityFeedInner = _buildActivityFeedContent(activities);

    // Fallback: only render sub_agent_messages when SSE chunks produced no sub-agent sections
    // (e.g. for older records written before SSE chunk storage was added).
    const hasSseSubAgentActivities = activities.some((a) => a.isSubAgent);
    let fallbackSubAgentsHtml = "";
    if (!hasSseSubAgentActivities && subAgents.length > 0) {
      // Group sub-agent messages by agent name
      const groupMap = {};
      const groupOrder = [];
      for (const msg of subAgents) {
        const name = (msg.agent_name || msg.agent || "Sub-Agent").toLowerCase();
        const displayName = msg.agent_name || msg.agent || "Sub-Agent";
        if (!groupMap[name]) {
          groupMap[name] = { displayName, messages: [] };
          groupOrder.push(name);
        }
        groupMap[name].messages.push(msg);
      }
      for (const key of groupOrder) {
        fallbackSubAgentsHtml += _renderSubAgentSectionForTurn(groupMap[key]);
      }
    }

    // Check if there's any content to display
    const hasThinking = activities.some((a) => a.type === "thinking");
    const hasToolCalls = activities.some((a) => a.type === "tool_call");
    const hasToolResults = activities.some((a) => a.type === "tool_result");
    const hasSubAgents = hasSseSubAgentActivities || subAgents.length > 0;
    const hasCleanContent = !!cleanContent.trim();

    // Extract file attachments from collections
    let collectionsHtml = "";
    const fileCollections = (turnData.collections || []).filter(
      (c) => c.collection_type === "files",
    );
    for (const col of fileCollections) {
      try {
        if (col.items) {
          let items = col.items;
          if (typeof items === "string") items = JSON.parse(items);
          if (items && items.length > 0) {
            collectionsHtml += renderUploadedFiles(JSON.stringify(items));
          }
        }
      } catch (e) {
        console.error("Failed to parse collection items", e);
      }
    }

    // Build thought box HTML if there's content
    const hasThoughtBoxContent =
      hasThinking || hasToolCalls || hasToolResults || hasSubAgents;
    let thoughtBoxHtml = "";

    if (hasThoughtBoxContent) {
      const parentMsgId = lastAssistantMsg
        ? lastAssistantMsg.id
        : activities[0]?.parentId ||
          turnData.contentChunks[0]?.parent_message_id;
      // Use a single .activity-feed containing both main activities and agent containers.
      const feedInnerHtml = activityFeedInner + fallbackSubAgentsHtml;

      thoughtBoxHtml = `
                <div class="activity-feed" data-parent-message-id="${parentMsgId}">
                    ${feedInnerHtml}
                </div>
            `;
    }

    const assistantContentHtml = `
            ${collectionsHtml}
            ${hasCleanContent ? formatMarkdown(cleanContent) : ""}
        `;

    return { thoughtBoxHtml, assistantContentHtml, cleanContent };
  }

  /**
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span style="font-weight: 500;">${item.name || 'Activity'}:</span>
                        <span>${item.content}</span>
                    </div>
                </div>`;
        }
    }

    /**
     * Render sub-agent section for an assistant turn
     *
     * @param {Object} subAgent - Sub-agent data with agent name and messages
     * @returns {string} HTML for the sub-agent section
     */
  function _renderSubAgentSectionForTurn(subAgent) {
    const agentName = subAgent.agent_name || subAgent.agent || "Sub-Agent";
    const messages = subAgent.messages || [];
    const activityCount = messages.length;

    let label = agentName.replace(/_/g, " ");
    if (agentName.toLowerCase() === "research") label = "Research Agent";
    if (agentName.toLowerCase() === "file_system_agent") label = "FileSystem Agent";

    return `
            <div class="activity-item sub-agent-container collapsed" data-agent-name="${escapeHtml(agentName)}">
                <div class="activity-header">
                    <div class="sub-agent-icon-wrapper" style="margin-right: 6px; display: flex; align-items: center; justify-content: center; color: var(--content-muted);">${getAgentIcon(agentName)}</div>
                    <div class="activity-type" style="margin-right: auto;">${escapeHtml(label)}</div>
                    <span class="sub-agent-badge" style="margin-right: 12px; font-size: 0.7rem; opacity: 0.6;">${activityCount} ${activityCount === 1 ? "activity" : "activities"}</span>
                    <div class="thought-chevron"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                </div>
                <div class="activity-content sub-agent-activity-feed" style="margin-left: 0; border-left: none;">
                    ${_renderSubAgentActivityFeed(messages)}
                </div>
            </div>
        `;
  }

  /**
   * Render activity feed for sub-agent messages
   *
   * @param {Array} messages - Sub-agent messages
   * @returns {string} HTML for sub-agent activity feed
   */
  function _renderSubAgentActivityFeed(messages) {
    if (!messages || messages.length === 0) return "";

    let html = "";

    for (const msg of messages) {
      // Re-use activity-item pattern for internal sub-agent sections
      const roleLabel =
        msg.role === "user"
          ? "User"
          : msg.role === "assistant"
            ? "Assistant"
            : msg.role;
      const contentHtml = msg.content ? formatMarkdown(msg.content) : "";
      const timestamp = msg.timestamp || Date.now();

      // Reconstruct tool-calls if present in the message
      let toolsHtml = "";
      if (msg.tool_calls) {
        try {
          const tools =
            typeof msg.tool_calls === "string"
              ? JSON.parse(msg.tool_calls)
              : msg.tool_calls;
          if (Array.isArray(tools)) {
            for (const tool of tools) {
              const toolName = tool.function?.name || "tool";
              const args = tool.function?.arguments || "{}";
              toolsHtml += `
                                <div class="sub-agent-tool-call" style="margin-top: 8px; padding-left: 4px; border-left: none;">
                                    <div style="font-size: 0.65rem; font-weight: 700; color: var(--content-muted); margin-bottom: 4px;">TOOL CALL: ${escapeHtml(toolName)}</div>
                                    <code style="font-size: 0.75rem; display: block; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 4px;">${escapeHtml(typeof args === "string" ? args : JSON.stringify(args))}</code>
                                </div>
                            `;
            }
          }
        } catch (e) {
          console.error("Failed to parse sub-agent tools", e);
        }
      }

      html += `
                <div class="sub-agent-activity-item activity-item" data-timestamp="${timestamp}">
                    <div class="sub-agent-activity-header activity-header">
                        <span class="activity-type">${escapeHtml(roleLabel)}</span>
                        <span class="activity-meta" style="font-size: 0.6rem; opacity: 0.6; margin-left: 8px;">${new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                    <div class="sub-agent-activity-content activity-content">
                        ${contentHtml}
                        ${toolsHtml}
                    </div>
                </div>
            `;
    }

    return html;
  }

  function renderSubAgentTurn(activityFeed, turn) {
    if (!turn) return;
    const agentName = turn.agent_name || "Sub-Agent";

    if (turn.role === "assistant") {
      if (turn.reasoning_content) {
        appendSubAgentActivity(
          activityFeed,
          agentName,
          "thinking",
          turn.reasoning_content,
          turn.timestamp,
          false,
        );
      }
      if (turn.tool_calls) {
        const tcs =
          typeof turn.tool_calls === "string"
            ? JSON.parse(turn.tool_calls)
            : turn.tool_calls;
        (Array.isArray(tcs) ? tcs : [tcs]).forEach((tc) => {
          appendSubAgentActivity(
            activityFeed,
            agentName,
            "tool_call",
            JSON.stringify(tc),
            turn.timestamp,
            false,
          );
        });
      }
      if (turn.content) {
        appendSubAgentActivity(
          activityFeed,
          agentName,
          "content",
          turn.content,
          turn.timestamp,
          false,
        );
      }
    } else if (turn.role === "tool") {
      appendSubAgentActivity(
        activityFeed,
        agentName,
        "tool_result",
        turn.content,
        turn.timestamp,
        false,
      );
    } else if (turn.role === "event") {
      appendSubAgentActivity(
        activityFeed,
        agentName,
        "event",
        turn.content,
        turn.timestamp,
        false,
      );
    }
  }

  /**
   * Helper to render a discrete activity item based on type.
   */
  function renderActivityItem(activityFeed, item) {
    if (item.type === "thinking") {
      appendThinkingActivity(activityFeed, item.content);
      sealThinkingActivity(activityFeed);
    } else if (item.type === "tool_call") {
      activityFeed.innerHTML += renderToolCallActivity({
        content: item.content,
      });
    } else if (item.type === "tool_result") {
      activityFeed.innerHTML += renderToolResultActivity(item);
    } else if (item.type === "event" || item.type === "status") {
      activityFeed.innerHTML += `
                <div class="activity-item event-divider" data-role="event" style="display: flex; align-items: center; justify-content: center; margin: 1.5rem 0; gap: 1rem;">
                    <div style="flex: 1; height: 1px; background-color: var(--border-subtle, var(--border-subtle));"></div>
                    <span class="event-text" style="color: var(--content-muted); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(item.content)}</span>
                    <div style="flex: 1; height: 1px; background-color: var(--border-subtle, var(--border-subtle));"></div>
                </div>`;
    }
  }

  // --- Image Modal Logic ---
  window.openImageModal = function(src) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    if (modal && modalImg) {
      modalImg.src = src;
      modal.classList.remove('hidden');
      // Trigger reflow
      void modal.offsetWidth;
      modal.classList.add('open');
    }
  };

  window.closeImageModal = function() {
    const modal = document.getElementById('image-modal');
    if (modal) {
      modal.classList.remove('open');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 300); // Matches transition duration
    }
  };

  // Close image modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('image-modal');
      if (modal && modal.classList.contains('open')) {
        window.closeImageModal();
      }
    }
  });
});
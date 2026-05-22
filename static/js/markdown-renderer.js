/**
 * Markdown Renderer Configuration
 * Configures the Markdown renderer (marked.js) with syntax highlighting,
 * custom element renderers, and advanced extensions (subscript, superscript, strikethrough, Katex, footnotes).
 */

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
    if (typeof quote === "object" && quote !== null) {
      if (this.parser && quote.tokens) {
        textVal = this.parser.parse(quote.tokens);
      } else if (typeof quote.text === "string") {
        textVal = quote.text;
      }
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

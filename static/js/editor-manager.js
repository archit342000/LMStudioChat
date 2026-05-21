/**
 * Luminous Chat — Editor Manager
 * Extracted from script.js
 * Handles CodeMirror 6 lazy loading, initialization, state compartments, and Markdown/HTML previews.
 */

window.EditorManager = {
    // Internal CodeMirror State
    _cmThemeCompartment: null,
    _cmLanguageCompartment: null,
    _cmReadOnlyCompartment: null,
    _cmStyleCompartment: null,
    _cmState: null,
    _cmView: null,
    _cmKeymap: null,
    _cmBasicSetup: null,
    _cmMarkdown: null,
    _cmLanguages: null,
    _cmOneDarkTheme: null,
    _cmIndentWithTab: null,
    _cmMarkdownRichText: null,
    _cmParsers: {},

    // Dependencies (Injected via init)
    deps: {
        getContent: () => "",
        setContent: (content) => {},
        getFileId: () => null,
        getChatId: () => null,
        getWorkspaceId: () => null,
        onSave: (id, content) => {},
        onVersionEdit: () => {}
    },

    // Elements
    elements: {
        codemirrorContainer: null,
        previewContainer: null
    },

    init: async function(config) {
        this.deps = { ...this.deps, ...config };
        this.elements.codemirrorContainer = document.getElementById("file-system-codemirror-container");
        this.elements.previewContainer = document.getElementById("file-system-preview-container");

        await this.loadCodeMirror();
        this.initEditor();
    },

    loadCodeMirror: async function() {
        try {
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
                { tag: t.special(t.variableName), color: "inherit" },
                { tag: t.attributeName, color: "inherit" },
                { tag: t.meta, color: "inherit" },
                { tag: t.processingInstruction, color: "inherit" },
                { tag: t.punctuation, color: "inherit" },
                { tag: t.inserted, color: "inherit" },
                { tag: t.deleted, color: "inherit" },
                { tag: t.changed, color: "inherit" },
            ]);

            this._cmState = EditorState;
            this._cmView = EditorView;
            this._cmKeymap = keymap;
            this._cmBasicSetup = basicSetup;
            this._cmThemeCompartment = new Compartment();
            this._cmLanguageCompartment = new Compartment();
            this._cmReadOnlyCompartment = new Compartment();
            this._cmStyleCompartment = new Compartment();
            this._cmMarkdown = markdown;
            this._cmLanguages = languages;
            this._cmOneDarkTheme = oneDark;
            this._cmIndentWithTab = indentWithTab;
            this._cmMarkdownRichText = syntaxHighlighting(markdownRichText);

            this._cmParsers = { python, javascript, html, css, json, cpp };

            console.log("CodeMirror 6 loaded successfully from local bundle.");
        } catch (e) {
            console.error("Failed to load CodeMirror 6:", e);
        }
    },

    initEditor: function() {
        if (!this._cmView || !this.elements.codemirrorContainer) return;

        const isDark = document.documentElement.classList.contains("dark");
        const themeExtension = isDark ? this._cmOneDarkTheme : [];

        let langExt = [];
        let styleExt = [];

        const updateListener = this._cmView.updateListener.of((update) => {
            if (update.docChanged) {
                const newContent = update.state.doc.toString();
                this.deps.setContent(newContent);

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
                    this.deps.onVersionEdit();
                    const fileId = this.deps.getFileId();
                    if (fileId) {
                        this.deps.onSave(fileId, newContent);
                    }
                }
            }
        });

        const state = this._cmState.create({
            doc: this.deps.getContent() || "",
            extensions: [
                this._cmBasicSetup,
                this._cmThemeCompartment.of(themeExtension),
                this._cmLanguageCompartment.of(langExt),
                this._cmReadOnlyCompartment.of(this._cmState.readOnly.of(false)),
                this._cmStyleCompartment.of(styleExt),
                updateListener,
                this._cmView.lineWrapping,
                this._cmKeymap ? this._cmKeymap.of([this._cmIndentWithTab]) : [],
            ]
            .flat()
            .filter(Boolean),
        });

        window.fileSystemEditor = new this._cmView({
            state,
            parent: this.elements.codemirrorContainer,
        });
    },

    setEditorContent: function(content) {
        if (window.fileSystemEditor) {
            window.fileSystemEditor.dispatch({
                changes: {
                    from: 0,
                    to: window.fileSystemEditor.state.doc.length,
                    insert: content,
                },
            });
        }
    },

    updateTheme: function(isDark) {
        if (window.fileSystemEditor && this._cmThemeCompartment && this._cmOneDarkTheme) {
            window.fileSystemEditor.dispatch({
                effects: this._cmThemeCompartment.reconfigure(isDark ? this._cmOneDarkTheme : []),
            });
        }
    },

    setReadOnly: function(isReadOnly) {
        if (window.fileSystemEditor && this._cmReadOnlyCompartment && this._cmState) {
            window.fileSystemEditor.dispatch({
                effects: this._cmReadOnlyCompartment.reconfigure(
                    this._cmState.readOnly.of(isReadOnly),
                ),
            });
        }
    },

    setLanguage: async function(extensionStr) {
        if (!window.fileSystemEditor || !this._cmLanguageCompartment || !this._cmStyleCompartment)
            return;

        if (this.elements.codemirrorContainer) {
            this.elements.codemirrorContainer.classList.remove("is-markdown-mode");
            if (this.elements.codemirrorContainer.parentElement) {
                this.elements.codemirrorContainer.parentElement.classList.remove("is-markdown-mode");
            }
        }

        window.fileSystemEditor.dispatch({
            effects: this._cmStyleCompartment.reconfigure([]),
        });

        let langExt = [];
        const cleanExt = (extensionStr || "markdown").replace(".", "").toLowerCase();
        const isMarkdown = cleanExt === "markdown" || cleanExt === "md";

        if (isMarkdown) {
            if (this._cmMarkdown) langExt = this._cmMarkdown({ codeLanguages: this._cmLanguages });
        } else if (cleanExt === "python" || cleanExt === "py") {
            if (this._cmParsers.python) langExt = this._cmParsers.python();
        } else if (
            cleanExt === "javascript" ||
            cleanExt === "js" ||
            cleanExt === "ts" ||
            cleanExt === "typescript"
        ) {
            if (this._cmParsers.javascript) langExt = this._cmParsers.javascript();
        } else if (cleanExt === "html") {
            if (this._cmParsers.html) langExt = this._cmParsers.html();
        } else if (cleanExt === "css") {
            if (this._cmParsers.css) langExt = this._cmParsers.css();
        } else if (cleanExt === "json") {
            if (this._cmParsers.json) langExt = this._cmParsers.json();
        } else if (cleanExt === "cpp" || cleanExt === "c" || cleanExt === "h") {
            if (this._cmParsers.cpp) langExt = this._cmParsers.cpp();
        } else {
            if (this._cmLanguages) {
                const langDesc = this._cmLanguages.find(
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

        window.fileSystemEditor.dispatch({
            effects: this._cmLanguageCompartment.reconfigure(langExt),
        });
    },

    renderPreview: function(content, language) {
        if (!this.elements.previewContainer) return;

        const cleanExt = (language || "markdown").replace(".", "").toLowerCase();
        const isMarkdown = cleanExt === "markdown" || cleanExt === "md";
        const isHtml = cleanExt === "html";

        if (isMarkdown) {
            this.elements.previewContainer.style.padding = "2rem";
            if (typeof window.formatMarkdown !== "undefined") {
                let htmlContent = window.formatMarkdown(content || "");
                // Remove 'disabled' attribute from checkboxes to allow interaction
                htmlContent = htmlContent.replace(/<input([^>]*?)disabled([^>]*?)>/gi, '<input$1$2>');
                this.elements.previewContainer.innerHTML = htmlContent;
                
                if (typeof window.renderMermaidBlocks !== "undefined") {
                    setTimeout(window.renderMermaidBlocks, 100);
                }

                // Add event listeners to checkboxes to persist state
                const checkboxes = this.elements.previewContainer.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach((cb, index) => {
                    cb.addEventListener('change', () => {
                        let cbCount = -1;
                        let currentContent = this.deps.getContent();
                        let newContent = currentContent.replace(/^[ \t]*[-*+][ \t]+\[([ xX])\]/gm, (match, innerText) => {
                            cbCount++;
                            if (cbCount === index) {
                                return match.replace(`[${innerText}]`, cb.checked ? '[x]' : '[ ]');
                            }
                            return match;
                        });
                        if (newContent !== currentContent) {
                            this.deps.setContent(newContent);
                            if (window.fileSystemEditor) {
                                window.fileSystemEditor.dispatch({
                                    changes: { from: 0, to: window.fileSystemEditor.state.doc.length, insert: newContent }
                                });
                            }
                            const fileId = this.deps.getFileId();
                            if (fileId) {
                                this.deps.onSave(fileId, newContent);
                            }
                        }
                    });
                });
            } else {
                this.elements.previewContainer.innerHTML = `<pre>${content}</pre>`;
            }
        } else if (isHtml) {
            this.elements.previewContainer.style.padding = "0";
            // Use iframe for safe HTML rendering
            const iframe = document.createElement("iframe");
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "none";
            iframe.style.background = "white";
            this.elements.previewContainer.innerHTML = "";
            this.elements.previewContainer.appendChild(iframe);

            // Pre-process HTML to replace relative URLs with the new raw API endpoints
            let processedContent = content || "";
            const currentChatId = this.deps.getChatId();
            const currentWorkspaceId = this.deps.getWorkspaceId();

            processedContent = processedContent.replace(
                /(href|src)=["'](?!http|https|data|blob|\/)([^"']+)["']/gi,
                (match, attr, filename) => {
                    let qs = `chat_id=${encodeURIComponent(currentChatId || '')}&filename=${encodeURIComponent(filename)}`;
                    if (currentWorkspaceId) {
                        qs += `&workspace_id=${encodeURIComponent(currentWorkspaceId)}`;
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
                    let currentContent = this.deps.getContent();
                    let newContent = currentContent.replace(/<(input|textarea|select)([^>]*)>/gi, (match, tag, attrs) => {
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

                    if (newContent !== currentContent) {
                        this.deps.setContent(newContent);
                        if (window.fileSystemEditor) {
                            window.fileSystemEditor.dispatch({
                                changes: { from: 0, to: window.fileSystemEditor.state.doc.length, insert: newContent }
                            });
                        }
                        const fileId = this.deps.getFileId();
                        if (fileId) {
                            this.deps.onSave(fileId, newContent);
                        }
                    }
                }
            });
        } else {
            this.elements.previewContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--content-muted);">Preview not available for this file type.</div>`;
        }
    }
};

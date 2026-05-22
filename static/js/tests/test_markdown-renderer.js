import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererPath = path.resolve(__dirname, '../markdown-renderer.js');
const rendererCode = fs.readFileSync(rendererPath, 'utf8');

describe('markdown-renderer.js', () => {
    let window;
    let dom;

    test('setup', () => {
        dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { runScripts: "dangerously" });
        window = dom.window;

        // Mock hljs
        window.hljs = {
            getLanguage: (lang) => {
                if (lang === 'javascript' || lang === 'js') return { name: 'javascript' };
                return null;
            },
            highlight: (code, options) => {
                return { value: `highlighted:${code}` };
            }
        };

        // Mock escapeHtml
        window.escapeHtml = (html) => html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Expose marked (from packages) to window
        window.marked = marked;

        // Mock extensions
        window.markedFootnote = () => () => {};
        window.markedKatex = () => () => {};

        // Inject markdown-renderer.js script
        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = rendererCode;
        window.document.body.appendChild(scriptEl);
    });

    test('code block rendering (javascript)', () => {
        const markdown = '```javascript\nconsole.log(123);\n```';
        const html = window.marked.parse(markdown);
        
        assert.ok(html.includes('class="code-block-wrapper"'));
        assert.ok(html.includes('class="code-block-lang">javascript</span>'));
        assert.ok(html.includes('data-code="console.log(123)%3B"'));
        assert.ok(html.includes('highlighted:console.log(123);'));
    });

    test('code block rendering (mermaid)', () => {
        const markdown = '```mermaid\ngraph TD;\n  A-->B;\n```';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('<pre class="mermaid">graph TD;\n  A--&gt;B;</pre>'));
    });

    test('image rendering', () => {
        const markdown = '![Alt text](/path/to/img.png "Title Text")';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('<figure class="markdown-figure">'));
        assert.ok(html.includes('<img src="/path/to/img.png" alt="Alt text" class="markdown-image lightbox-img" loading="lazy" title="Title Text" />'));
        assert.ok(html.includes('<figcaption class="markdown-caption">Title Text</figcaption>'));
    });

    test('blockquote alert NOTE rendering', () => {
        const markdown = '> [!NOTE]\n> Hello world';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('class="markdown-alert markdown-alert-note"'));
        assert.ok(html.includes('class="markdown-alert-title"'));
        assert.ok(html.includes('<span>Note</span>'));
        assert.ok(html.includes('Hello world'));
    });

    test('blockquote alert WARNING rendering', () => {
        const markdown = '> [!WARNING]\n> Care!';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('class="markdown-alert markdown-alert-warning"'));
        assert.ok(html.includes('<span>Warning</span>'));
        assert.ok(html.includes('Care!'));
    });

    test('blockquote alert IMPORTANT rendering', () => {
        const markdown = '> [!IMPORTANT]\n> Crit!';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('class="markdown-alert markdown-alert-important"'));
        assert.ok(html.includes('<span>Important</span>'));
        assert.ok(html.includes('Crit!'));
    });

    test('blockquote alert CAUTION rendering', () => {
        const markdown = '> [!CAUTION]\n> Danger!';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('class="markdown-alert markdown-alert-caution"'));
        assert.ok(html.includes('<span>Caution</span>'));
        assert.ok(html.includes('Danger!'));
    });

    test('blockquote alert TIP rendering', () => {
        const markdown = '> [!TIP]\n> Hint!';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('class="markdown-alert markdown-alert-tip"'));
        assert.ok(html.includes('<span>Tip</span>'));
        assert.ok(html.includes('Hint!'));
    });

    test('standard blockquote rendering', () => {
        const markdown = '> Standard quote';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('<blockquote>'));
        assert.ok(html.includes('Standard quote'));
        assert.ok(!html.includes('markdown-alert'));
    });

    test('list item checkbox rendering (checked)', () => {
        const markdown = '- [x] Task completed';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('class="task-list-item"'));
        assert.ok(html.includes('type="checkbox"'));
        assert.ok(html.includes('checked'));
        assert.ok(html.includes('disabled'));
        assert.ok(html.includes('Task completed'));
    });

    test('list item checkbox rendering (unchecked)', () => {
        const markdown = '- [ ] Task pending';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('class="task-list-item"'));
        assert.ok(html.includes('type="checkbox"'));
        assert.ok(!html.includes('checked'));
        assert.ok(html.includes('Task pending'));
    });

    test('plain list item rendering', () => {
        const markdown = '- Plain item';
        const html = window.marked.parse(markdown);

        assert.ok(html.includes('<li>Plain item</li>'));
    });

    test('link rendering (local vs external)', () => {
        const localMarkdown = '[local docs](docs/README.md)';
        const localHtml = window.marked.parse(localMarkdown);
        assert.ok(localHtml.includes('class="file-link"'));
        assert.ok(localHtml.includes('data-path="docs/README.md"'));
        assert.ok(localHtml.includes('title="Open file in workspace"'));
        assert.ok(localHtml.includes('>local docs</a>'));

        const externalMarkdown = '[external link](https://google.com)';
        const externalHtml = window.marked.parse(externalMarkdown);
        assert.ok(externalHtml.includes('target="_blank"'));
        assert.ok(externalHtml.includes('rel="noopener noreferrer"'));
        assert.ok(externalHtml.includes('>external link</a>'));
    });

    test('custom extensions (subscript, superscript, strikethrough)', () => {
        const subscriptMarkdown = 'This is ~sub~ text';
        const subscriptHtml = window.marked.parse(subscriptMarkdown);
        assert.ok(subscriptHtml.includes('<sub>sub</sub>'));

        const superscriptMarkdown = 'This is ^sup^ text';
        const superscriptHtml = window.marked.parse(superscriptMarkdown);
        assert.ok(superscriptHtml.includes('<sup>sup</sup>'));

        const strikethroughMarkdown = 'This is ~~del~~ text';
        const strikethroughHtml = window.marked.parse(strikethroughMarkdown);
        assert.ok(strikethroughHtml.includes('<del>del</del>'));
    });
});

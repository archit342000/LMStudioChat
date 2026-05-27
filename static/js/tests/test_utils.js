import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const utilsPath = path.resolve(__dirname, '../utils.js');
const utilsCode = fs.readFileSync(utilsPath, 'utf8');

describe('utils.js', () => {
    let dom;
    let window;
    
    test('setup', () => {
        dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { runScripts: "dangerously" });
        window = dom.window;
        
        window.marked = {
            parse: (text, options) => `<p>${text}</p>`
        };
        window.DOMPurify = {
            sanitize: (html, options) => html
        };

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = utilsCode;
        window.document.body.appendChild(scriptEl);
    });

    test('escapeHtml', () => {
        const escapeHtml = window.escapeHtml;
        assert.strictEqual(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    });


    test('getAssistantFriendlyContent', () => {
        const getAssistantFriendlyContent = window.getAssistantFriendlyContent;
        assert.strictEqual(getAssistantFriendlyContent({ content: 'hello' }), 'hello');
        assert.strictEqual(getAssistantFriendlyContent({ content: [{ type: 'text', text: 'array text' }] }), 'array text');
    });

    test('getIconClassForMime', () => {
        const getIconClassForMime = window.getIconClassForMime;
        assert.strictEqual(getIconClassForMime('application/pdf'), 'pdf');
        assert.strictEqual(getIconClassForMime('image/png'), 'image');
        assert.strictEqual(getIconClassForMime('unknown/type'), 'default');
    });

    test('formatFileSize', () => {
        const formatFileSize = window.formatFileSize;
        assert.strictEqual(formatFileSize(500), '500 B');
        assert.strictEqual(formatFileSize(1500), '1.5 KB');
        assert.strictEqual(formatFileSize(1500000), '1.4 MB');
    });

    test('getIconHtmlForMime', () => {
        const getIconHtmlForMime = window.getIconHtmlForMime;
        assert.ok(getIconHtmlForMime('application/pdf').includes('viewBox'));
        assert.ok(getIconHtmlForMime('text/plain').includes('viewBox'));
        assert.ok(getIconHtmlForMime('image/png').includes('viewBox'));
    });

    test('parseContent', () => {
        const parseContent = window.parseContent;
        const result1 = parseContent('plain text');
        assert.strictEqual(result1.cleaned, 'plain text');
        assert.strictEqual(result1.thoughts, '');

        const result2 = parseContent('<think>my reasoning</think>actual message');
        assert.strictEqual(result2.cleaned, 'actual message');
        assert.strictEqual(result2.thoughts, 'my reasoning');
    });

    test('formatMarkdown', () => {
        const formatMarkdown = window.formatMarkdown;
        const result = formatMarkdown('hello **world**');
        assert.strictEqual(result, '<p>hello **world**</p>');
    });

    test('formatMarkdown with LaTeX display math preprocessing', () => {
        const formatMarkdown = window.formatMarkdown;
        const latexInput = `Here is a matrix: $$\\begin{bmatrix}\nx & y\n\\end{bmatrix}$$ and text after.`;
        const result = formatMarkdown(latexInput);
        assert.strictEqual(
            result,
            '<p>Here is a matrix: \n\n$$\n\\begin{bmatrix}\nx & y\n\\end{bmatrix}\n$$\n\n and text after.</p>'
        );
    });

    test('formatMarkdown protects LaTeX commands starting with n', () => {
        const formatMarkdown = window.formatMarkdown;
        const latexInput = `$$\\nabla f(x) + \\nu + \\nearrow + \\neq$$`;
        const result = formatMarkdown(latexInput);
        assert.strictEqual(result, '<p>$$\\nabla f(x) + \\nu + \\nearrow + \\neq$$</p>');
    });

    test('renderMermaidBlocks', () => {
        const renderMermaidBlocks = window.renderMermaidBlocks;
        let runCalled = false;
        window.mermaid = {
            run: (options) => {
                runCalled = true;
                assert.strictEqual(options.querySelector, '.mermaid');
            }
        };
        renderMermaidBlocks();
        assert.strictEqual(runCalled, true);
    });
});

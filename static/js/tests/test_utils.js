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

    test('hashContent', () => {
        const hashContent = window.hashContent;
        assert.notStrictEqual(hashContent('test string'), 'empty');
        assert.strictEqual(hashContent(''), 'empty');
    });

    test('cleanReasoningForPersistence', () => {
        const cleanReasoningForPersistence = window.cleanReasoningForPersistence;
        assert.strictEqual(cleanReasoningForPersistence('reasoning'), 'reasoning');
        assert.strictEqual(cleanReasoningForPersistence(null), '');
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
});

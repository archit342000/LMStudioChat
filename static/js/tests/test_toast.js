import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toastCode = fs.readFileSync(path.resolve(__dirname, '../toast.js'), 'utf8');

describe('toast.js', () => {
    let window;
    let document;

    test('setup', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { runScripts: "dangerously" });
        window = dom.window;
        document = window.document;
        
        window.escapeHtml = (text) => text;

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = toastCode;
        window.document.body.appendChild(scriptEl);
    });

    test('showToast creates a toast element with correct message and type', () => {
        window.showToast('Test Error Msg', 'error');
        
        const toast = document.querySelector('.toast-notification');
        assert.ok(toast);
        assert.ok(toast.innerHTML.includes('Test Error Msg'));
        assert.ok(toast.innerHTML.includes('var(--color-rose)')); // Error icon color
    });

    test('showToast defaults to info type', () => {
        window.showToast('Test Info Msg');
        
        const toasts = document.querySelectorAll('.toast-notification');
        const toast = toasts[toasts.length - 1]; // get the latest one
        
        assert.ok(toast);
        assert.ok(toast.innerHTML.includes('Test Info Msg'));
        assert.ok(toast.innerHTML.includes('currentColor')); // Info icon color
    });
});

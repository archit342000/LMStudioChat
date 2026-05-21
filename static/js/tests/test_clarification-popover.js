import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const popoverCode = fs.readFileSync(path.resolve(__dirname, '../clarification-popover.js'), 'utf8');

describe('clarification-popover.js', () => {
    let window;
    let document;

    test('setup', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body><div class="input-container"></div></body></html>`, { runScripts: "dangerously" });
        window = dom.window;
        document = window.document;

        // Mock globals
        window.API_MODULES = { TOOLS: '/api/tools', CHATS: '/api/chats' };
        window.formatMarkdown = (text) => text;
        window.escapeHtml = (text) => text;

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = popoverCode;
        window.document.body.appendChild(scriptEl);
    });

    test('showClarificationPopOver creates elements and handles interactions', async () => {
        let successCalled = false;
        let notificationCalled = false;
        let fetchCalledWith = null;

        window.fetch = async (url, options) => {
            fetchCalledWith = { url, options };
            return { ok: true, json: async () => ({}) };
        };

        const config = {
            chatId: 'test-chat-123',
            onSuccess: (id) => { successCalled = true; assert.strictEqual(id, 'cb-456'); },
            showNotification: () => { notificationCalled = true; },
            showConfirm: async () => true
        };

        window.showClarificationPopOver('Select an option?', ['Opt 1', 'Opt 2'], 'cb-456', config);

        const popover = document.getElementById('clarification-popover');
        assert.ok(popover);
        assert.strictEqual(popover.style.display, 'flex');

        const items = popover.querySelectorAll('.clarification-option-item');
        assert.strictEqual(items.length, 3); // 2 options + 1 custom

        // Test custom input
        const textarea = popover.querySelector('.clarification-custom-textarea');
        textarea.value = 'My Custom Answer';
        textarea.oninput();

        const confirmBtn = popover.querySelector('.clarification-btn-confirm');
        assert.strictEqual(confirmBtn.disabled, false);

        // Click confirm
        await confirmBtn.onclick();

        assert.strictEqual(successCalled, true);
        assert.strictEqual(popover.style.display, 'none');
        assert.ok(fetchCalledWith);
        assert.strictEqual(fetchCalledWith.url, '/api/tools/clarification/response');
        
        const body = JSON.parse(fetchCalledWith.options.body);
        assert.strictEqual(body.content, 'My Custom Answer');
        assert.strictEqual(body.chat_id, 'test-chat-123');
    });
});

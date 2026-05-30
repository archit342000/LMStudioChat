import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsCode = fs.readFileSync(path.resolve(__dirname, '../icons.js'), 'utf8');
const modalsCode = fs.readFileSync(path.resolve(__dirname, '../modals.js'), 'utf8');

describe('modals.js', () => {
    let window;
    let document;

    test('setup', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <div id="confirm-modal" class="hidden">
                <h3 id="confirm-title"></h3>
                <p id="confirm-message"></p>
                <div id="confirm-icon-container"></div>
                <div id="confirm-icon-svg"></div>
                <div id="confirm-input-container">
                    <input id="confirm-input" />
                </div>
                <div id="confirm-extension-container">
                    <select id="confirm-extension-select">
                        <option value=".js">.js</option>
                    </select>
                </div>
                <button id="confirm-action-btn"></button>
                <button id="confirm-cancel-btn"></button>
            </div>
            
            <div id="prompt-modal" class="hidden">
                <h3 id="prompt-title"></h3>
                <p id="prompt-message"></p>
                <div id="prompt-select-container"><select id="prompt-select"></select></div>
                <input id="prompt-input" />
                <button id="prompt-action-btn"></button>
                <button id="prompt-cancel-btn"></button>
            </div>
            
            <div id="workspace-icon-modal" class="hidden">
                <div id="workspace-icon-preview-circle"></div>
                <div class="emoji-grid"></div>
                <button id="workspace-icon-confirm-btn"></button>
                <button id="workspace-icon-cancel-btn"></button>
                <button id="workspace-icon-clear-btn"></button>
            </div>
        </body></html>`, { runScripts: "dangerously" });
        
        window = dom.window;
        document = window.document;
        window.setTimeout = (cb) => cb(); // mock timeout

        // Load icons first
        const iconsScript = window.document.createElement("script");
        iconsScript.textContent = iconsCode;
        window.document.body.appendChild(iconsScript);

        // Load modals second
        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = modalsCode;
        window.document.body.appendChild(scriptEl);
    });

    test('showAlert displays and resolves true on confirm', async () => {
        const promise = window.showAlert('Test Alert', 'Alert Msg');
        
        const modal = document.getElementById('confirm-modal');
        assert.ok(modal.classList.contains('open'));
        assert.strictEqual(document.getElementById('confirm-title').textContent, 'Test Alert');
        assert.strictEqual(document.getElementById('confirm-message').textContent, 'Alert Msg');
        
        // click OK
        document.getElementById('confirm-action-btn').click();
        const result = await promise;
        assert.strictEqual(result, true);
    });

    test('showConfirm displays and resolves false on cancel', async () => {
        const promise = window.showConfirm('Test Confirm', 'Confirm Msg', true);
        
        // click Cancel
        document.getElementById('confirm-cancel-btn').click();
        const result = await promise;
        assert.strictEqual(result, false);
    });

    test('showPromptModal resolves input on custom folder modal', async () => {
        const promise = window.showPromptModal('Folder Prompt', 'Msg', 'default');
        
        const input = document.getElementById('prompt-input');
        assert.strictEqual(input.value, 'default');
        input.value = 'New Folder Name';
        
        document.getElementById('prompt-action-btn').click();
        const result = await promise;
        assert.strictEqual(result, 'New Folder Name');
    });

    test('showWorkspaceIconPicker resolves chosen icon or empty string', async () => {
        const promise = window.showWorkspaceIconPicker('code');
        
        const preview = document.getElementById('workspace-icon-preview-circle');
        assert.ok(preview.innerHTML.includes('<svg'));
        
        // Find grid button for briefcase
        const grid = document.querySelector('.emoji-grid');
        const briefcaseBtn = grid.querySelector('[data-icon-key="briefcase"]');
        assert.ok(briefcaseBtn);
        briefcaseBtn.click();
        
        assert.ok(preview.innerHTML.includes('<svg'));
        
        document.getElementById('workspace-icon-confirm-btn').click();
        const result = await promise;
        assert.strictEqual(result, 'briefcase');
    });
});

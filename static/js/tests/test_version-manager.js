import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const versionManagerCode = fs.readFileSync(path.resolve(__dirname, '../version-manager.js'), 'utf8');

describe('version-manager.js', () => {
    let window;
    let document;

    test('setup', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html>
        <head>
            <script>
                const API_MODULES = { FILE_SYSTEMS: '/api/fs' };
            </script>
        </head>
        <body>
            <button id="file-system-panel-undo-btn"></button>
            <button id="file-system-panel-redo-btn"></button>
            <button id="file-system-panel-history-btn"></button>
            <div id="version-history-modal" class="hidden"></div>
            <button id="close-version-history"></button>
            <span id="version-history-file-system-name"></span>
            <div id="version-list-loading"></div>
            <div id="version-list"></div>
            <div id="version-diff-panel" class="hidden"></div>
            <span id="version-diff-title"></span>
            <div id="version-diff-body"></div>
            <button id="version-restore-btn"></button>
            <span id="file-system-panel-title"></span>
        </body></html>`, { runScripts: "dangerously" });
        
        window = dom.window;
        document = window.document;
        
        // Mock globals
        window.escapeHtml = (text) => text;

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = versionManagerCode;
        window.document.body.appendChild(scriptEl);
    });

    test('VersionManager initializes and binds elements', () => {
        assert.ok(window.VersionManager);
        
        window.VersionManager.init({
            getChatId: () => 'chat123',
            getFileSystemId: () => 'fs123'
        });

        assert.ok(window.VersionManager.elements.undoBtn);
        assert.ok(window.VersionManager.elements.modal);
        assert.strictEqual(window.VersionManager.deps.getChatId(), 'chat123');
    });

    test('updateUndoRedoButtons disables correctly', () => {
        window.VersionManager.state.navigationPath = [1, 2, 3];
        window.VersionManager.state.navigationIndex = 0; // At the start
        window.VersionManager.updateUndoRedoButtons();
        
        assert.strictEqual(window.VersionManager.elements.undoBtn.disabled, true);
        assert.strictEqual(window.VersionManager.elements.redoBtn.disabled, false);

        window.VersionManager.state.navigationIndex = 2; // At the end
        window.VersionManager.updateUndoRedoButtons();
        
        assert.strictEqual(window.VersionManager.elements.undoBtn.disabled, false);
        assert.strictEqual(window.VersionManager.elements.redoBtn.disabled, true);
    });

    test('loadVersionsWithCurrentState handles fetch', async () => {
        // Mock fetch
        window.fetch = async (url) => {
            if (url.includes('/versions')) {
                return { ok: true, json: async () => ({ success: true, versions: [{ version_number: 1 }] }) };
            } else {
                return { ok: true, json: async () => ({ success: true, navigation_history: "[1,2]", navigation_index: "1" }) };
            }
        };

        await window.VersionManager.loadVersionsWithCurrentState('fs1', 'chat1');
        
        assert.strictEqual(window.VersionManager.state.historyCache.length, 1);
        assert.strictEqual(window.VersionManager.state.navigationPath.length, 2);
        assert.strictEqual(window.VersionManager.state.navigationIndex, 1);
        assert.strictEqual(window.VersionManager.state.currentVersionNumber, 2);
    });
});

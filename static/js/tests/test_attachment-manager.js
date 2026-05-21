import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const attachmentManagerCode = fs.readFileSync(path.resolve(__dirname, '../attachment-manager.js'), 'utf8');

describe('attachment-manager.js', () => {
    let window;
    let document;

    test('setup', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html>
        <head>
            <script>const API_MODULES = { FILES: '/api/files' };</script>
        </head>
        <body>
            <button id="attach-btn"></button>
            <input id="file-input" type="file" />
            <div id="file-upload-zone"></div>
            <div id="file-preview-container"></div>
        </body></html>`, { runScripts: "dangerously", url: "http://localhost/" });
        
        window = dom.window;
        document = window.document;

        // Mock utilities
        window.escapeHtml = (text) => text;
        window.formatFileSize = (bytes) => `${bytes} B`;
        window.getIconClassForMime = () => 'icon-class';
        window.getIconHtmlForMime = () => '📄';

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = attachmentManagerCode;
        window.document.body.appendChild(scriptEl);
    });

    test('AttachmentManager initializes', () => {
        assert.ok(window.AttachmentManager);

        let stateChangeCalled = false;
        
        window.AttachmentManager.init({
            getChatId: () => 'chat-123',
            onUploadStateChange: () => { stateChangeCalled = true; }
        });

        assert.ok(window.AttachmentManager.elements.fileInput);
        assert.ok(window.AttachmentManager.elements.previewContainer);
        assert.strictEqual(window.AttachmentManager.deps.getChatId(), 'chat-123');
    });

    test('getFileType returns correct mime types', () => {
        const am = window.AttachmentManager;
        assert.strictEqual(am.getFileType({ name: 'test.pdf' }), 'application/pdf');
        assert.strictEqual(am.getFileType({ name: 'test.py' }), 'text/x-python');
        assert.strictEqual(am.getFileType({ type: 'image/png', name: 'test.png' }), 'image/png');
        assert.strictEqual(am.getFileType({ name: 'unknown.xyz' }), '');
    });

    test('clearStagedFiles clears state and DOM', () => {
        const am = window.AttachmentManager;
        
        // Mock state
        am.state.uploadedFiles = [{ file_id: '1', name: 'test' }];
        am.elements.previewContainer.innerHTML = '<div>Mock Preview</div>';
        
        am.clearStagedFiles();
        
        assert.strictEqual(am.state.uploadedFiles.length, 0);
        assert.strictEqual(am.elements.previewContainer.innerHTML, '');
    });

    test('getStagedFiles returns a copy of the array', () => {
        const am = window.AttachmentManager;
        am.state.uploadedFiles = [{ file_id: '1' }];
        
        const staged = am.getStagedFiles();
        assert.strictEqual(staged.length, 1);
        
        // Mutate copy, ensure original is safe
        staged.push({ file_id: '2' });
        assert.strictEqual(am.state.uploadedFiles.length, 1);
    });
});

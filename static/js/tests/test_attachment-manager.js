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

    test('clearStagedFiles tracks and defers revoking sent localUrls', () => {
        const am = window.AttachmentManager;
        let revokedUrl = null;
        window.URL.revokeObjectURL = (url) => { revokedUrl = url; };

        am.state.sentLocalUrls = [];
        am.state.uploadedFiles = [
            { file_id: '1', name: 'img1.png', localUrl: 'blob:123' },
            { file_id: '2', name: 'doc1.pdf', localUrl: null }
        ];

        am.clearStagedFiles();

        assert.strictEqual(am.state.uploadedFiles.length, 0);
        assert.strictEqual(am.state.sentLocalUrls.length, 1);
        assert.strictEqual(am.state.sentLocalUrls[0], 'blob:123');
        assert.strictEqual(revokedUrl, null); // Not revoked immediately

        am.revokeSentUrls();
        assert.strictEqual(revokedUrl, 'blob:123'); // Revoked on call
        assert.strictEqual(am.state.sentLocalUrls.length, 0);
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

    test('handleFileUpload adds elements and handles success', async () => {
        const am = window.AttachmentManager;
        am.clearStagedFiles();
        
        // Mock uploadFileWithProgress
        const originalUpload = am.uploadFileWithProgress;
        am.uploadFileWithProgress = async (file, formData, onProgress) => {
            onProgress(50, 100);
            return {
                file_id: 'file-456',
                original_filename: 'uploaded.png',
                file_size: 100,
                mime_type: 'image/png'
            };
        };

        // Mock global fetch for status polling
        let statusPollResolver;
        const statusPollPromise = new Promise(resolve => { statusPollResolver = resolve; });
        window.fetch = async (url) => {
            if (url.includes('/file-456/status')) {
                statusPollResolver();
                return {
                    ok: true,
                    json: async () => ({ processing_status: 'completed' })
                };
            }
            return { ok: false };
        };

        const file = { name: 'uploaded.png', size: 100, type: 'image/png' };
        await am.handleFileUpload(file);

        // Check that the file was added to state
        const uploaded = am.state.uploadedFiles;
        assert.strictEqual(uploaded[0].file_id, 'file-456');

        // Check preview UI has updated
        const preview = am.elements.previewContainer;
        assert.ok(preview.innerHTML.includes('uploaded.png'));

        // Wait for polling loop
        await statusPollPromise;

        // Restore original
        am.uploadFileWithProgress = originalUpload;
    });

    test('uploadFileWithProgress resolves on success', async () => {
        const am = window.AttachmentManager;
        am.clearStagedFiles();

        const mockXHR = {
            upload: {},
            open: () => {},
            setRequestHeader: () => {},
            send: function() {
                this.status = 200;
                this.responseText = JSON.stringify({ success: true, file_id: '123' });
                this.onload();
            },
            getResponseHeader: () => 'application/json'
        };
        window.XMLHttpRequest = function() {
            return mockXHR;
        };

        const result = await am.uploadFileWithProgress({ name: 'test' }, new window.FormData(), () => {});
        assert.strictEqual(result.file_id, '123');
    });
});

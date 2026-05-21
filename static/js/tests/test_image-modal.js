import { test, describe, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imageModalCode = fs.readFileSync(path.resolve(__dirname, '../image-modal.js'), 'utf8');

describe('image-modal.js', () => {
    let window;
    let document;
    let modal;
    let modalImg;

    test('setup', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <div id="image-modal" class="hidden">
                <img id="modal-img" src="" />
            </div>
        </body></html>`, { runScripts: "dangerously" });
        window = dom.window;
        document = window.document;

        // Mock setTimeout to execute immediately for testing
        window.setTimeout = (cb) => cb();

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = imageModalCode;
        window.document.body.appendChild(scriptEl);

        modal = document.getElementById('image-modal');
        modalImg = document.getElementById('modal-img');
    });

    test('openImageModal sets src and shows modal', () => {
        const testSrc = 'http://example.com/test.jpg';
        window.openImageModal(testSrc);
        
        assert.strictEqual(modalImg.src, testSrc);
        assert.ok(!modal.classList.contains('hidden'));
        assert.ok(modal.classList.contains('open'));
    });

    test('closeImageModal hides modal', () => {
        window.closeImageModal();
        
        assert.ok(!modal.classList.contains('open'));
        assert.ok(modal.classList.contains('hidden'));
    });

    test('Escape key closes an open modal', () => {
        // First open it
        window.openImageModal('test.jpg');
        assert.ok(modal.classList.contains('open'));

        // Dispatch escape key
        const event = new window.KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);

        assert.ok(!modal.classList.contains('open'));
        assert.ok(modal.classList.contains('hidden'));
    });

    test('Escape key does nothing if modal is not open', () => {
        // Ensure it's closed
        window.closeImageModal();
        assert.ok(!modal.classList.contains('open'));

        // Dispatch escape key
        const event = new window.KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);

        // State should be unchanged
        assert.ok(!modal.classList.contains('open'));
        assert.ok(modal.classList.contains('hidden'));
    });
});

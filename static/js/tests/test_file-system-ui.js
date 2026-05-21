import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fsUiCode = fs.readFileSync(path.resolve(__dirname, '../file-system-ui.js'), 'utf8');

describe('file-system-ui.js', () => {
    let window;
    let document;

    test('setup', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <div id="file-system-list"></div>
        </body></html>`, { runScripts: "dangerously" });
        
        window = dom.window;
        document = window.document;
        
        // Mock globals
        window.escapeHtml = (text) => text;

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = fsUiCode;
        window.document.body.appendChild(scriptEl);
    });

    test('FileSystemUI initializes and sets container', () => {
        assert.ok(window.FileSystemUI);
        
        window.FileSystemUI.init({
            getActiveFileId: () => 'file1'
        });

        assert.ok(window.FileSystemUI.container);
        assert.strictEqual(window.FileSystemUI.container.id, 'file-system-list');
    });

    test('updateData renders flat files correctly', () => {
        const files = [
            { id: 'file1', title: 'File 1', content: 'test content' },
            { id: 'file2', title: 'File 2', content: 'other' }
        ];

        window.FileSystemUI.updateData(files);
        
        const items = document.querySelectorAll('.file-system-item');
        assert.strictEqual(items.length, 2);
        
        // Active state check based on mocked getActiveFileId
        assert.ok(items[0].classList.contains('active'));
        assert.ok(!items[1].classList.contains('active'));
    });

    test('applyFilter filters by search query', () => {
        window.FileSystemUI.setSearchQuery('other');
        
        const items = document.querySelectorAll('.file-system-item');
        assert.strictEqual(items.length, 1);
        assert.ok(items[0].innerHTML.includes('File 2'));
    });

    test('renderFilteredList handles folders', () => {
        window.FileSystemUI.setSearchQuery(''); // clear filter
        const files = [
            { id: 'file1', title: 'Folder/File 1', content: '' },
            { id: 'file2', title: 'Folder/File 2', content: '' },
            { id: 'file3', title: 'Root File', content: '' }
        ];

        window.FileSystemUI.updateData(files);
        
        const folders = document.querySelectorAll('.folder-item');
        assert.strictEqual(folders.length, 1);
        assert.ok(folders[0].innerHTML.includes('Folder'));
        
        const filesRendered = document.querySelectorAll('.file-system-item');
        assert.strictEqual(filesRendered.length, 3);
    });
});

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

    test('folder long press triggers context menu and prevents toggle on click', () => {
        const files = [
            { id: 'file1', title: 'TestFolder/File 1', content: '' }
        ];
        
        let contextMenuCalled = false;
        let lastMenuType = null;
        let lastPath = null;
        
        window.FileSystemUI.init({
            getActiveFileId: () => null,
            onContextMenu: (type, path, title, e) => {
                contextMenuCalled = true;
                lastMenuType = type;
                lastPath = path;
            }
        });
        
        window.FileSystemUI.updateData(files);
        
        const folderHeader = document.querySelector('.folder-header');
        const folderDiv = document.querySelector('.folder-item');
        
        // Assert initial state is expanded
        assert.ok(folderDiv.classList.contains('expanded'));
        
        const touchstartEvt = new window.TouchEvent('touchstart', {
            touches: [{ clientX: 100, clientY: 100 }]
        });
        const touchendEvt = new window.TouchEvent('touchend', {
            cancelable: true
        });
        
        folderHeader.dispatchEvent(touchstartEvt);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                folderHeader.dispatchEvent(touchendEvt);
                
                const clickEvt = new window.MouseEvent('click', {
                    bubbles: true,
                    cancelable: true
                });
                folderHeader.dispatchEvent(clickEvt);
                
                // Verify context menu was called
                assert.ok(contextMenuCalled);
                assert.strictEqual(lastMenuType, 'file-system-folder');
                assert.strictEqual(lastPath, 'TestFolder');
                
                // Verify that the folder did NOT collapse
                assert.ok(folderDiv.classList.contains('expanded'));
                
                // Reset longpress state by triggering a touchstart and touchmove (to cancel it), or just click
                const startEvt2 = new window.TouchEvent('touchstart', {
                    touches: [{ clientX: 100, clientY: 100 }]
                });
                const endEvt2 = new window.TouchEvent('touchend', {
                    cancelable: true
                });
                folderHeader.dispatchEvent(startEvt2);
                folderHeader.dispatchEvent(endEvt2);
                
                const clickEvtNormal = new window.MouseEvent('click', {
                    bubbles: true,
                    cancelable: true
                });
                folderHeader.dispatchEvent(clickEvtNormal);
                
                // Now it should collapse
                assert.ok(!folderDiv.classList.contains('expanded'));
                
                resolve();
            }, 700);
        });
    });
});

import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const explorerCode = fs.readFileSync(path.resolve(__dirname, '../file-explorer-modal.js'), 'utf8');

describe('file-explorer-modal.js', () => {
    let window;
    let document;
    let mockFetchCalls = [];

    test('setup JSDOM environment', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <div id="file-explorer-modal" style="display: none;">
                <h3 id="file-explorer-title"></h3>
                <div id="file-explorer-breadcrumbs"></div>
                <div id="file-explorer-list"></div>
                <div id="file-explorer-input-container">
                    <input id="file-explorer-input" />
                    <select id="file-explorer-ext">
                        <option value="">(No Ext)</option>
                        <option value=".md">.md</option>
                        <option value=".py">.py</option>
                    </select>
                </div>
                <button id="file-explorer-new-folder-btn"></button>
                <button id="file-explorer-cancel-btn"></button>
                <button id="file-explorer-action-btn"></button>
            </div>
        </body></html>`, { runScripts: "dangerously" });
        
        window = dom.window;
        document = window.document;
        window.requestAnimationFrame = (cb) => cb();
        window.setTimeout = (cb, ms) => cb();
        
        // Mock global fetch
        window.fetch = async (url, options) => {
            mockFetchCalls.push({ url, options });
            return {
                ok: true,
                json: async () => ({ success: true, file_systems: [] })
            };
        };

        // Mock window API config
        window.API_MODULES = {
            FILE_SYSTEMS: '/api/file_systems'
        };

        // Inject script
        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = explorerCode;
        window.document.body.appendChild(scriptEl);
    });

    test('verifies structure and API exports', () => {
        assert.ok(window.FileExplorerModal);
        assert.strictEqual(typeof window.FileExplorerModal.init, 'function');
        assert.strictEqual(typeof window.FileExplorerModal.show, 'function');
        assert.strictEqual(typeof window.showFileExplorerModal, 'function');
    });

    test('sanitizePath utility logic', () => {
        const sanitize = window.FileExplorerModal.sanitizePath;
        assert.strictEqual(sanitize('///foo/bar///'), 'foo/bar');
        assert.strictEqual(sanitize('foo/../bar'), 'foo/bar');
        assert.strictEqual(sanitize('foo/./bar'), 'foo/bar');
        assert.strictEqual(sanitize('foo/bar/baz.py'), 'foo/bar/baz.py');
        assert.strictEqual(sanitize('foo/$bar/baz'), 'foo/_bar/baz');
    });

    test('show file mode initial layout', async () => {
        const mockFiles = [
            { id: 1, filename: 'folder1/file1.md', type: 'file' },
            { id: 2, filename: 'folder2/subfolder/file2.py', type: 'file' }
        ];

        window.FileExplorerModal.init({
            getAllFileSystems: () => mockFiles,
            getChatId: () => 'chat123',
            fetchFileSystems: async () => {},
            showAlert: async () => {},
            showPromptModal: async () => {},
            setScrollLock: () => {}
        });

        // Start file mode
        const promise = window.showFileExplorerModal('file', 'folder1');

        const title = document.getElementById('file-explorer-title');
        const inputContainer = document.getElementById('file-explorer-input-container');
        const extSelect = document.getElementById('file-explorer-ext');
        const newFolderBtn = document.getElementById('file-explorer-new-folder-btn');

        assert.strictEqual(title.textContent, 'Create New File');
        assert.strictEqual(inputContainer.style.display, 'flex');
        assert.strictEqual(extSelect.style.display, 'block');
        assert.strictEqual(newFolderBtn.style.display, 'flex');

        // Confirm
        document.getElementById('file-explorer-input').value = 'newfile';
        document.getElementById('file-explorer-ext').value = '.md';
        document.getElementById('file-explorer-action-btn').click();

        const result = await promise;
        assert.strictEqual(result, 'folder1/newfile.md');
    });

    test('show folder mode initial layout', async () => {
        window.FileExplorerModal.init({
            getAllFileSystems: () => [],
            getChatId: () => 'chat123',
            fetchFileSystems: async () => {},
            showAlert: async () => {},
            showPromptModal: async () => {},
            setScrollLock: () => {}
        });

        const promise = window.showFileExplorerModal('folder', 'some/path');

        const title = document.getElementById('file-explorer-title');
        const extSelect = document.getElementById('file-explorer-ext');
        const newFolderBtn = document.getElementById('file-explorer-new-folder-btn');

        assert.strictEqual(title.textContent, 'Create Folder');
        assert.strictEqual(extSelect.style.display, 'none');
        assert.strictEqual(newFolderBtn.style.display, 'none');

        // Confirm
        document.getElementById('file-explorer-input').value = 'subfolder';
        document.getElementById('file-explorer-action-btn').click();

        const result = await promise;
        assert.strictEqual(result, 'some/path/subfolder');
    });

    test('show move mode initial layout and cancel resolving null', async () => {
        window.FileExplorerModal.init({
            getAllFileSystems: () => [],
            getChatId: () => 'chat123',
            fetchFileSystems: async () => {},
            showAlert: async () => {},
            showPromptModal: async () => {},
            setScrollLock: () => {}
        });

        const promise = window.showFileExplorerModal('move', 'dir1/dir2/file.txt');

        const title = document.getElementById('file-explorer-title');
        const input = document.getElementById('file-explorer-input');

        assert.strictEqual(title.textContent, 'Move / Rename');
        assert.strictEqual(input.value, 'file.txt');

        // Cancel
        document.getElementById('file-explorer-cancel-btn').click();

        const result = await promise;
        assert.strictEqual(result, null);
    });

    test('folder navigation list and breadcrumbs rendering', async () => {
        const mockFiles = [
            { id: 1, filename: 'src/components/button.js', type: 'file' },
            { id: 2, filename: 'src/utils/math.js', type: 'file' },
            { id: 3, filename: 'docs/guide.md', type: 'file' }
        ];

        window.FileExplorerModal.init({
            getAllFileSystems: () => mockFiles,
            getChatId: () => 'chat123',
            fetchFileSystems: async () => {},
            showAlert: async () => {},
            showPromptModal: async () => {},
            setScrollLock: () => {}
        });

        // Start at Root
        const promise = window.showFileExplorerModal('file', '');

        // Should list folders under root: 'src', 'docs'
        const listEl = document.getElementById('file-explorer-list');
        const items = listEl.querySelectorAll('.explorer-item');
        assert.strictEqual(items.length, 2);
        
        const folderNames = Array.from(items).map(item => item.querySelector('span').textContent);
        assert.deepStrictEqual(folderNames.sort(), ['docs', 'src']);

        // Click 'src' folder
        const srcItem = Array.from(items).find(item => item.querySelector('span').textContent === 'src');
        srcItem.click();

        // Breadcrumbs should render 'Root' and 'src'
        const breadcrumbsEl = document.getElementById('file-explorer-breadcrumbs');
        const crumbs = breadcrumbsEl.querySelectorAll('.breadcrumb-item');
        assert.strictEqual(crumbs.length, 2);
        assert.strictEqual(crumbs[0].textContent, 'Root');
        assert.strictEqual(crumbs[1].textContent, 'src');

        // List should render folders under src: 'components', 'utils'
        const innerItems = listEl.querySelectorAll('.explorer-item');
        assert.strictEqual(innerItems.length, 2);
        const innerFolderNames = Array.from(innerItems).map(item => item.querySelector('span').textContent);
        assert.deepStrictEqual(innerFolderNames.sort(), ['components', 'utils']);

        // Resolve
        document.getElementById('file-explorer-input').value = 'index.js';
        document.getElementById('file-explorer-ext').value = '';
        document.getElementById('file-explorer-action-btn').click();

        const result = await promise;
        assert.strictEqual(result, 'src/index.js');
    });

    test('new folder button triggers prompt and makes POST call', async () => {
        mockFetchCalls = [];
        let promptTriggered = false;
        let sidebarRefreshed = false;

        window.FileExplorerModal.init({
            getAllFileSystems: () => [],
            getChatId: () => 'chat123',
            fetchFileSystems: async (chatId) => {
                assert.strictEqual(chatId, 'chat123');
                sidebarRefreshed = true;
            },
            showAlert: async () => {},
            showPromptModal: async (title, message) => {
                assert.strictEqual(title, 'New Folder');
                promptTriggered = true;
                return 'new_dir';
            },
            setScrollLock: () => {}
        });

        const promise = window.showFileExplorerModal('file', 'src');

        const newFolderBtn = document.getElementById('file-explorer-new-folder-btn');
        await newFolderBtn.onclick();

        assert.ok(promptTriggered);
        assert.strictEqual(mockFetchCalls.length, 1);
        assert.strictEqual(mockFetchCalls[0].url, '/api/file_systems/directory');
        
        const bodyObj = JSON.parse(mockFetchCalls[0].options.body);
        assert.strictEqual(bodyObj.chat_id, 'chat123');
        assert.strictEqual(bodyObj.path, 'src/new_dir');
        assert.ok(sidebarRefreshed);

        // Cancel dialog
        document.getElementById('file-explorer-cancel-btn').click();
        await promise;
    });
});

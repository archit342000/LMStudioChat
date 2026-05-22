import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contextMenuCode = fs.readFileSync(path.resolve(__dirname, '../context-menu.js'), 'utf8');

describe('context-menu.js', () => {
    let window;
    let document;
    let mockFetchCalls = [];
    let mockFetchResponse = { ok: true, text: async () => 'OK' };
    
    // Dependencies mocks
    let mockDeps = {};
    let lastRenameChat = null;
    let lastDeleteChat = null;
    let lastMoveChat = null;
    let lastStartNewChat = null;
    let lastRenameWorkspace = null;
    let lastDeleteWorkspace = null;
    let lastPromptResult = null;
    let lastExplorerResult = null;
    let lastRenameOrMoveFileSystemPath = null;
    let lastDeleteFileSystem = null;
    let lastDeleteFileSystemFolder = null;

    test('setup JSDOM environment', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { runScripts: "dangerously" });
        window = dom.window;
        document = window.document;

        // Mock window dimensions
        window.innerWidth = 1024;
        window.innerHeight = 768;

        // Mock requestAnimationFrame
        window.requestAnimationFrame = (callback) => callback();

        // Mock fetch
        window.fetch = async (url, options) => {
            mockFetchCalls.push({ url, options });
            return mockFetchResponse;
        };

        // Reset variables
        lastRenameChat = null;
        lastDeleteChat = null;
        lastMoveChat = null;
        lastStartNewChat = null;
        lastRenameWorkspace = null;
        lastDeleteWorkspace = null;
        lastPromptResult = null;
        lastExplorerResult = null;
        lastRenameOrMoveFileSystemPath = null;
        lastDeleteFileSystem = null;
        lastDeleteFileSystemFolder = null;

        // Mock dependencies
        mockDeps = {
            renameChat: (id, e) => { lastRenameChat = { id, e }; },
            deleteChat: (id, e) => { lastDeleteChat = { id, e }; },
            moveChatToWorkspace: async (id, ws) => { lastMoveChat = { id, ws }; },
            getChatWorkspaces: () => [{ name: 'ws-1', displayName: 'Workspace 1' }, { name: 'ws-2', displayName: 'Workspace 2' }],
            getSavedChats: () => [
                { id: 'chat-1', workspace_id: 'ws-1' },
                { id: 'chat-2', workspace_id: 'ws-1' },
                { id: 'chat-3', workspace_id: 'ws-2' }
            ],
            loadChats: async () => {},
            renderChatList: () => {},
            startNewChat: (f1, f2, id) => { lastStartNewChat = { f1, f2, id }; },
            renameWorkspace: (id, e) => { lastRenameWorkspace = { id, e }; },
            deleteWorkspace: (id, e) => { lastDeleteWorkspace = { id, e }; },
            showPromptModal: async (title, desc, val) => lastPromptResult,
            showFileExplorerModal: async (action, path) => lastExplorerResult,
            renameOrMoveFileSystemPath: async (id, path, wsId) => { lastRenameOrMoveFileSystemPath = { id, path, wsId }; },
            deleteFileSystem: (id, wsId) => { lastDeleteFileSystem = { id, wsId }; },
            deleteFileSystemFolder: (id) => { lastDeleteFileSystemFolder = { id }; },
            getIsUserPreferences: () => false,
            getIsResearchMode: () => false,
            getSamplingParams: () => ({}),
            getCurrentChatId: () => 'chat-new-123'
        };

        // Inject ContextMenu code
        const scriptEl = document.createElement("script");
        scriptEl.textContent = contextMenuCode;
        document.body.appendChild(scriptEl);
    });

    test('verifies structure and exports', () => {
        assert.ok(window.ContextMenu);
        assert.strictEqual(typeof window.ContextMenu.init, 'function');
        assert.strictEqual(typeof window.ContextMenu.show, 'function');
        assert.strictEqual(typeof window.ContextMenu.close, 'function');
        
        // Initialize
        window.ContextMenu.init(mockDeps);
        assert.strictEqual(typeof window.showContextMenu, 'function');
    });

    test('renders, positions, and closes context menu', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {},
            clientX: 100,
            clientY: 200
        };

        await window.ContextMenu.show('chat', 'chat-1', null, mockEvent);

        const menu = document.querySelector('.sidebar-context-menu');
        assert.ok(menu);
        assert.strictEqual(menu.style.left, '100px');
        assert.strictEqual(menu.style.top, '200px');

        // Test outside click dismissal
        const clickEvent = new window.MouseEvent('click', { bubbles: true });
        document.body.dispatchEvent(clickEvent);

        // Wait for removal transition (150ms timeout inside close())
        await new Promise(resolve => setTimeout(resolve, 200));
        assert.strictEqual(document.querySelector('.sidebar-context-menu'), null);
    });

    test('viewport bounds collision positioning', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {},
            clientX: 950, // Near the right edge (innerWidth is 1024)
            clientY: 700  // Near the bottom edge (innerHeight is 768)
        };

        // We override bounding rect for the created menu element to simulate its physical dimension
        const originalCreate = document.createElement;
        document.createElement = function(tagName) {
            const el = originalCreate.call(document, tagName);
            if (tagName === 'div') {
                el.getBoundingClientRect = () => ({
                    width: 200,
                    height: 180,
                    left: 950,
                    top: 700,
                    right: 1150,
                    bottom: 880
                });
            }
            return el;
        };

        await window.ContextMenu.show('chat', 'chat-1', null, mockEvent);
        document.createElement = originalCreate; // Restore

        const menu = document.querySelector('.sidebar-context-menu');
        assert.ok(menu);
        
        // Collision adjustments:
        // x + width = 950 + 200 = 1150 > 1024 => adjusted x should be 1024 - 200 - 10 = 814px
        // y + height = 700 + 180 = 880 > 768 => adjusted y should be 768 - 180 - 10 = 578px
        assert.strictEqual(menu.style.left, '814px');
        assert.strictEqual(menu.style.top, '578px');

        window.ContextMenu.close();
        await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('chat menu rename action works', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        await window.ContextMenu.show('chat', 'chat-1', null, mockEvent);

        const menu = document.querySelector('.sidebar-context-menu');
        assert.ok(menu);

        const renameBtn = Array.from(menu.querySelectorAll('.sidebar-context-menu-item'))
            .find(btn => btn.textContent.includes('Rename Chat'));
        assert.ok(renameBtn);

        renameBtn.click();
        
        assert.ok(lastRenameChat);
        assert.strictEqual(lastRenameChat.id, 'chat-1');

        await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('chat menu delete action works', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        await window.ContextMenu.show('chat', 'chat-1', null, mockEvent);

        const menu = document.querySelector('.sidebar-context-menu');
        const deleteBtn = menu.querySelector('.sidebar-context-menu-item.danger');
        assert.ok(deleteBtn);

        deleteBtn.click();
        
        assert.ok(lastDeleteChat);
        assert.strictEqual(lastDeleteChat.id, 'chat-1');

        await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('chat menu move-to workspace action works', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        await window.ContextMenu.show('chat', 'chat-1', null, mockEvent);

        const menu = document.querySelector('.sidebar-context-menu');
        
        // Find workspace 2 button in sub-menu
        const ws2Btn = menu.querySelector('[data-workspace="ws-2"]');
        assert.ok(ws2Btn);

        ws2Btn.click();
        assert.ok(lastMoveChat);
        assert.strictEqual(lastMoveChat.id, 'chat-1');
        assert.strictEqual(lastMoveChat.ws, 'ws-2');

        await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('chat menu move-to uncategorized works', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        await window.ContextMenu.show('chat', 'chat-1', null, mockEvent);

        const menu = document.querySelector('.sidebar-context-menu');
        const uncategorizedBtn = menu.querySelector('[data-workspace="uncategorized"]');
        assert.ok(uncategorizedBtn);

        uncategorizedBtn.click();
        assert.ok(lastMoveChat);
        assert.strictEqual(lastMoveChat.id, 'chat-1');
        assert.strictEqual(lastMoveChat.ws, null); // uncategorized moves to null

        await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('chat menu move-to new workspace prompt works', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        await window.ContextMenu.show('chat', 'chat-1', 'ws-old', mockEvent);

        const menu = document.querySelector('.sidebar-context-menu');
        const promptBtn = menu.querySelector('[data-action="move-to-prompt"]');
        assert.ok(promptBtn);

        lastPromptResult = "Brand New Workspace";
        promptBtn.click();

        // Wait a microtask for async clicks to propagate
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.ok(lastMoveChat);
        assert.strictEqual(lastMoveChat.id, 'chat-1');
        assert.strictEqual(lastMoveChat.ws, 'Brand New Workspace');

        await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('workspace menu new chat in workspace works', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        mockFetchCalls = [];

        await window.ContextMenu.show('workspace', 'ws-1', null, mockEvent);

        const menu = document.querySelector('.sidebar-context-menu');
        assert.ok(menu);

        const newChatBtn = menu.querySelector('[data-action="new-chat"]');
        assert.ok(newChatBtn);

        newChatBtn.click();

        await new Promise(resolve => setTimeout(resolve, 20));

        assert.ok(lastStartNewChat);
        assert.strictEqual(lastStartNewChat.id, 'ws-1');
        
        // Verifies the POST save chat call was triggered
        assert.ok(mockFetchCalls.some(call => call.url.includes('/save') && call.options.method === 'POST'));
        const body = JSON.parse(mockFetchCalls[0].options.body);
        assert.strictEqual(body.workspace_id, 'ws-1');

        await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('workspace menu rename and delete actions work', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        await window.ContextMenu.show('workspace', 'ws-1', null, mockEvent);

        const menu = document.querySelector('.sidebar-context-menu');
        
        const renameBtn = menu.querySelector('[data-action="rename"]');
        renameBtn.click();
        assert.ok(lastRenameWorkspace);
        assert.strictEqual(lastRenameWorkspace.id, 'ws-1');

        await window.ContextMenu.show('workspace', 'ws-1', null, mockEvent);
        const nextMenu = document.querySelector('.sidebar-context-menu');
        const deleteBtn = nextMenu.querySelector('[data-action="delete"]');
        deleteBtn.click();
        assert.ok(lastDeleteWorkspace);
        assert.strictEqual(lastDeleteWorkspace.id, 'ws-1');

        await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('workspace menu uncategorize all chats works', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        mockFetchCalls = [];

        await window.ContextMenu.show('workspace', 'ws-1', null, mockEvent);

        const menu = document.querySelector('.sidebar-context-menu');
        const uncategorizeBtn = menu.querySelector('[data-action="uncategorize-all"]');
        assert.ok(uncategorizeBtn);

        uncategorizeBtn.click();

        await new Promise(resolve => setTimeout(resolve, 20));

        // We mapped getSavedChats to return chat-1 and chat-2 inside ws-1
        // So we expect exactly 2 PATCH requests uncategorizing those chats
        const patchCalls = mockFetchCalls.filter(call => call.options.method === 'PATCH');
        assert.strictEqual(patchCalls.length, 2);
        assert.ok(patchCalls.some(call => call.url.includes('/chat-1')));
        assert.ok(patchCalls.some(call => call.url.includes('/chat-2')));
        const body = JSON.parse(patchCalls[0].options.body);
        assert.strictEqual(body.workspace_id, null);

        await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('file system and folder context menus work', async () => {
        const mockEvent = {
            preventDefault: () => {},
            stopPropagation: () => {}
        };

        // File menu
        await window.ContextMenu.show('file_system', 'file-abc', '/my/src/file.py', mockEvent, 'workspace-fs');
        const menu = document.querySelector('.sidebar-context-menu');
        assert.ok(menu);

        const deleteBtn = menu.querySelector('[data-action="delete"]');
        deleteBtn.click();
        
        await new Promise(resolve => setTimeout(resolve, 200)); // wait for close transition to finish
        assert.ok(lastDeleteFileSystem);
        assert.strictEqual(lastDeleteFileSystem.id, 'file-abc');
        assert.strictEqual(lastDeleteFileSystem.wsId, 'workspace-fs');

        // Test File move-rename
        await window.ContextMenu.show('file_system', 'file-abc', '/my/src/file.py', mockEvent, 'workspace-fs');
        const nextMenu = document.querySelector('.sidebar-context-menu');
        const moveBtn = nextMenu.querySelector('[data-action="move-rename"]');
        
        lastExplorerResult = '/my/src/file-new.py';
        moveBtn.click();
        
        await new Promise(resolve => setTimeout(resolve, 200)); // wait for close transition to finish
        assert.ok(lastRenameOrMoveFileSystemPath);
        assert.strictEqual(lastRenameOrMoveFileSystemPath.id, 'file-abc');
        assert.strictEqual(lastRenameOrMoveFileSystemPath.path, '/my/src/file-new.py');
        assert.strictEqual(lastRenameOrMoveFileSystemPath.wsId, 'workspace-fs');

        // Folder menu
        await window.ContextMenu.show('file-system-folder', 'folder-xyz', null, mockEvent);
        const folderMenu = document.querySelector('.sidebar-context-menu');
        assert.ok(folderMenu);

        const folderDeleteBtn = folderMenu.querySelector('[data-action="delete"]');
        folderDeleteBtn.click();
        
        await new Promise(resolve => setTimeout(resolve, 200)); // wait for close transition to finish
        assert.ok(lastDeleteFileSystemFolder);
        assert.strictEqual(lastDeleteFileSystemFolder.id, 'folder-xyz');
    });
});

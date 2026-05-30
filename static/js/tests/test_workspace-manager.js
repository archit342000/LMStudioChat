import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdom from 'jsdom';
const { JSDOM } = jsdom;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceManagerCode = fs.readFileSync(path.resolve(__dirname, '../workspace-manager.js'), 'utf8');

describe('workspace-manager.js', () => {
    let window;
    let document;
    let fetchCalls = [];
    let loadChatsCalled = false;
    let getSavedChatsResult = [];
    let showConfirmCalled = false;
    let showConfirmResult = true;
    let showPromptModalCalled = false;
    let showPromptModalResult = null;
    let showModalCalled = false;

    beforeEach(() => {
        fetchCalls = [];
        loadChatsCalled = false;
        getSavedChatsResult = [];
        showConfirmCalled = false;
        showConfirmResult = true;
        showPromptModalCalled = false;
        showPromptModalResult = null;
        showModalCalled = false;
    });

    test('setup', () => {
        const virtualConsole = new jsdom.VirtualConsole();
        virtualConsole.on("jsdomError", (error) => {
            console.error("JSDOM Error:", error);
        });

        const dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <button id="new-folder-btn"></button>
            </body>
            </html>
        `, { 
            runScripts: "dangerously",
            virtualConsole
        });

        window = dom.window;
        document = window.document;

        // Mock localStorage
        const storageMock = {
            _store: {},
            getItem(key) { return this._store[key] || null; },
            setItem(key, value) { this._store[key] = String(value); },
            removeItem(key) { delete this._store[key]; },
            clear() { this._store = {}; }
        };
        Object.defineProperty(window, 'localStorage', {
            value: storageMock,
            writable: true,
            configurable: true
        });

        // Set up global Constants / API paths
        window.API_MODULES = {
            CHATS: 'http://localhost/api/chats'
        };

        // Inject helper
        window.escapeHtml = (text) => text;

        // Load model code in window environment
        const scriptEl = document.createElement("script");
        scriptEl.textContent = workspaceManagerCode;
        document.body.appendChild(scriptEl);

        assert.ok(window.WorkspaceManager);
    });

    test('initial state and storage serialization', () => {
        // Mock localStorage setup with existing workspace
        window.localStorage.setItem('chatWorkspaces', JSON.stringify([
            { name: 'ws-123', displayName: 'Development', expanded: false }
        ]));

        window.WorkspaceManager.init({
            loadChats: () => { loadChatsCalled = true; },
            getSavedChats: () => getSavedChatsResult,
            showConfirm: async () => { showConfirmCalled = true; return showConfirmResult; },
            showPromptModal: async () => { showPromptModalCalled = true; return showPromptModalResult; },
            showModal: () => { showModalCalled = true; }
        });

        const list = window.WorkspaceManager.getChatWorkspaces();
        assert.strictEqual(list.length, 1);
        assert.strictEqual(list[0].name, 'ws-123');
        assert.strictEqual(list[0].displayName, 'Development');
        assert.strictEqual(list[0].expanded, false);

        // Verify set and save
        window.WorkspaceManager.setChatWorkspaces([
            { name: 'ws-123', displayName: 'Development', expanded: true },
            { name: 'ws-456', displayName: 'Production', expanded: true }
        ]);

        const rawStorage = window.localStorage.getItem('chatWorkspaces');
        assert.ok(rawStorage.includes('Production'));
        assert.ok(rawStorage.includes('ws-456'));
    });

    test('fetchWorkspaces merges list preserving expansion state', async () => {
        window.WorkspaceManager.setChatWorkspaces([
            { name: 'ws-existing', displayName: 'Old Name', expanded: false }
        ]);

        window.fetch = async (url, options = {}) => {
            fetchCalls.push({ url, options });
            return {
                ok: true,
                json: async () => [
                    { id: 'ws-existing', name: 'New Merged Name' },
                    { id: 'ws-brand-new', name: 'Brand New Workspace' }
                ]
            };
        };

        await window.WorkspaceManager.fetchWorkspaces();

        const workspaces = window.WorkspaceManager.getChatWorkspaces();
        assert.strictEqual(workspaces.length, 2);

        // ws-existing should preserve expanded: false and update displayName
        const first = workspaces.find(w => w.name === 'ws-existing');
        assert.strictEqual(first.displayName, 'New Merged Name');
        assert.strictEqual(first.expanded, false);

        // ws-brand-new should default to expanded: true
        const second = workspaces.find(w => w.name === 'ws-brand-new');
        assert.strictEqual(second.displayName, 'Brand New Workspace');
        assert.strictEqual(second.expanded, true);
    });

    test('createWorkspaceInteractive triggers showPromptModal and sends POST request', async () => {
        showPromptModalResult = "   Awesome Workspace  ";

        window.fetch = async (url, options = {}) => {
            fetchCalls.push({ url, options });
            return {
                ok: true,
                json: async () => ({ id: 'new-id', name: 'Awesome Workspace' })
            };
        };

        await window.WorkspaceManager.createWorkspaceInteractive();

        assert.ok(showPromptModalCalled);
        assert.strictEqual(fetchCalls.length, 1);
        assert.strictEqual(fetchCalls[0].options.method, 'POST');
        assert.strictEqual(JSON.parse(fetchCalls[0].options.body).name, 'Awesome Workspace');
        assert.ok(loadChatsCalled);
    });

    test('deleteWorkspace prompts confirm and calls DELETE API on confirm', async () => {
        window.WorkspaceManager.setChatWorkspaces([
            { name: 'ws-del', displayName: 'ToDelete', expanded: true }
        ]);

        showConfirmResult = true;

        window.fetch = async (url, options = {}) => {
            fetchCalls.push({ url, options });
            return { ok: true };
        };

        const mockEvent = { stopPropagation() {} };
        await window.WorkspaceManager.deleteWorkspace('ws-del', mockEvent);

        assert.ok(showConfirmCalled);
        assert.strictEqual(fetchCalls.length, 1);
        assert.strictEqual(fetchCalls[0].options.method, 'DELETE');
        assert.ok(fetchCalls[0].url.includes('/workspaces/ws-del'));
        assert.ok(loadChatsCalled);
    });

    test('renameWorkspace prompts new name and PATCHes API on submit', async () => {
        window.WorkspaceManager.setChatWorkspaces([
            { name: 'ws-rename', displayName: 'OldName', expanded: true }
        ]);

        showPromptModalResult = "NewName";

        window.fetch = async (url, options = {}) => {
            fetchCalls.push({ url, options });
            return { ok: true };
        };

        const mockEvent = { stopPropagation() {} };
        await window.WorkspaceManager.renameWorkspace('ws-rename', mockEvent);

        assert.ok(showPromptModalCalled);
        assert.strictEqual(fetchCalls.length, 1);
        assert.strictEqual(fetchCalls[0].options.method, 'PATCH');
        assert.strictEqual(JSON.parse(fetchCalls[0].options.body).name, 'NewName');
        assert.ok(loadChatsCalled);
    });

    test('moveChatToWorkspace shifts chat using existing workspace', async () => {
        window.WorkspaceManager.setChatWorkspaces([
            { name: 'ws-exists', displayName: 'Existing Workspace', expanded: true }
        ]);

        getSavedChatsResult = [
            { id: 'chat-abc', workspace_id: 'ws-other' }
        ];

        window.fetch = async (url, options = {}) => {
            fetchCalls.push({ url, options });
            return { ok: true };
        };

        await window.WorkspaceManager.moveChatToWorkspace('chat-abc', 'ws-exists');

        // We only expect a PATCH request to /api/chats/chat-abc since workspace exists
        assert.strictEqual(fetchCalls.length, 1);
        assert.strictEqual(fetchCalls[0].options.method, 'PATCH');
        assert.ok(fetchCalls[0].url.includes('/chat-abc'));
        assert.strictEqual(JSON.parse(fetchCalls[0].options.body).workspace_id, 'ws-exists');
        assert.ok(loadChatsCalled);
    });

    test('moveChatToWorkspace creates brand new workspace before moving chat', async () => {
        window.WorkspaceManager.setChatWorkspaces([]); // empty workspaces

        getSavedChatsResult = [
            { id: 'chat-xyz', workspace_id: null }
        ];

        window.fetch = async (url, options = {}) => {
            fetchCalls.push({ url, options });
            if (url.includes('/workspaces')) {
                return {
                    ok: true,
                    json: async () => ({ id: 'new-ws-id', name: 'FreshWorkspace' })
                };
            }
            return { ok: true };
        };

        await window.WorkspaceManager.moveChatToWorkspace('chat-xyz', 'FreshWorkspace');

        // Expect 2 fetch calls: POST to create workspace first, followed by PATCH to update chat
        assert.strictEqual(fetchCalls.length, 2);
        assert.strictEqual(fetchCalls[0].options.method, 'POST');
        assert.ok(fetchCalls[0].url.includes('/workspaces'));
        assert.strictEqual(JSON.parse(fetchCalls[0].options.body).name, 'FreshWorkspace');

        assert.strictEqual(fetchCalls[1].options.method, 'PATCH');
        assert.ok(fetchCalls[1].url.includes('/chat-xyz'));
        assert.strictEqual(JSON.parse(fetchCalls[1].options.body).workspace_id, 'new-ws-id');
        assert.ok(loadChatsCalled);
    });

    test('updateWorkspaceIcon PATCHes API and reloads chats', async () => {
        window.fetch = async (url, options = {}) => {
            fetchCalls.push({ url, options });
            return { ok: true };
        };

        await window.WorkspaceManager.updateWorkspaceIcon('ws-123', '🚀');

        assert.strictEqual(fetchCalls.length, 1);
        assert.strictEqual(fetchCalls[0].options.method, 'PATCH');
        assert.ok(fetchCalls[0].url.includes('/workspaces/ws-123'));
        assert.strictEqual(JSON.parse(fetchCalls[0].options.body).icon, '🚀');
        assert.ok(loadChatsCalled);
    });
});

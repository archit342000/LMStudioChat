import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const personaManagerCode = fs.readFileSync(path.resolve(__dirname, '../persona-manager.js'), 'utf8');

describe('persona-manager.js', () => {
    let window;
    let document;
    let mockFetchCalls = [];
    let mockFetchResponse = null;
    let mockFetchError = false;

    // Test data
    const mockPersonas = [
        { id: 1, name: 'Developer', content: 'Be a coder', is_default: 1 },
        { id: 2, name: 'Writer', content: 'Be a poet', is_default: 0 }
    ];

    beforeEach(() => {
        mockFetchCalls = [];
        mockFetchResponse = {
            success: true,
            personas: [...mockPersonas]
        };
        mockFetchError = false;

        const html = `
            <!DOCTYPE html>
            <html>
            <body>
                <div id="persona-list-view">
                    <div id="persona-list-container">Loading...</div>
                </div>
                <div id="persona-edit-view" class="hidden">
                    <input type="hidden" id="persona-id-input">
                    <input type="text" id="persona-name-input">
                    <textarea id="persona-content-input"></textarea>
                    <input type="checkbox" id="persona-default-checkbox">
                    <button id="cancel-persona-btn">Cancel</button>
                    <button id="save-persona-btn">Save</button>
                </div>
                <button id="new-persona-btn">+</button>
            </body>
            </html>
        `;

        const dom = new JSDOM(html, { runScripts: "dangerously" });
        window = dom.window;
        document = window.document;

        // Mock window.fetch
        window.fetch = async (url, options) => {
            mockFetchCalls.push({ url, options });
            if (mockFetchError) {
                throw new Error("Network Error");
            }
            return {
                ok: true,
                json: async () => mockFetchResponse
            };
        };

        // Mock window.showConfirm and window.showAlert
        window.showAlert = (title, msg) => {
            window.alertCalled = { title, msg };
        };
        window.showConfirm = async (title, msg) => {
            window.confirmCalled = { title, msg };
            return window.confirmResult !== false; // defaults to true
        };

        // Inject persona-manager script
        const scriptEl = document.createElement("script");
        scriptEl.textContent = personaManagerCode;
        document.body.appendChild(scriptEl);
    });

    test('structure and global registration', () => {
        assert.ok(window.PersonaManager);
        assert.strictEqual(typeof window.PersonaManager.init, 'function');
        assert.strictEqual(typeof window.PersonaManager.fetchPersonas, 'function');
        assert.strictEqual(typeof window.PersonaManager.getSelectedPersonaId, 'function');
    });

    test('initialization pulls list and selects default persona when no chat is active', async () => {
        let chatHistory = [];
        let currentChatId = null;

        window.PersonaManager.init({
            getChatHistory: () => chatHistory,
            getCurrentChatId: () => currentChatId
        });

        // Wait for fetchPersonas async call
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(mockFetchCalls.length, 1);
        assert.strictEqual(mockFetchCalls[0].url, '/api/personas');
        
        // Assert selected persona defaults to id 1 (marked default in mockPersonas)
        assert.strictEqual(window.PersonaManager.getSelectedPersonaId(), 1);
        
        // Verify container rendering
        const cards = document.querySelectorAll('.persona-item');
        assert.strictEqual(cards.length, 2);
        
        // Assert card with id 1 is marked selected
        assert.ok(cards[0].classList.contains('selected'));
        assert.ok(!cards[1].classList.contains('selected'));
    });

    test('switching personas is enabled when no messages in history', async () => {
        let chatHistory = [];
        window.PersonaManager.init({
            getChatHistory: () => chatHistory,
            getCurrentChatId: () => null
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        const cards = document.querySelectorAll('.persona-item');
        
        // Click on second card
        cards[1].click();
        
        assert.strictEqual(window.PersonaManager.getSelectedPersonaId(), 2);
        
        // Re-query cards from DOM after state rerender
        const updatedCards = document.querySelectorAll('.persona-item');
        assert.ok(updatedCards[1].classList.contains('selected'));
        assert.ok(!updatedCards[0].classList.contains('selected'));
    });

    test('switching personas is disabled when chat has message history', async () => {
        let chatHistory = [{ role: 'user', content: 'hello' }];
        window.PersonaManager.init({
            getChatHistory: () => chatHistory,
            getCurrentChatId: () => 'chat-123'
        });

        // Manually select default persona first since automated setup is bypassed during active chat loading
        window.PersonaManager.setSelectedPersonaId(1);

        await new Promise(resolve => setTimeout(resolve, 10));

        const cards = document.querySelectorAll('.persona-item');
        
        // Card 1 (selected) should be fully opaque/active
        assert.strictEqual(cards[0].style.opacity, '');
        
        // Card 2 (not selected) should be disabled
        assert.strictEqual(cards[1].style.opacity, '0.4');
        assert.strictEqual(cards[1].style.pointerEvents, 'none');

        // Clicking card 2 should not change selected persona ID
        cards[1].click();
        assert.strictEqual(window.PersonaManager.getSelectedPersonaId(), 1);
    });

    test('new-persona FAB opens blank edit view', async () => {
        window.PersonaManager.init({
            getChatHistory: () => [],
            getCurrentChatId: () => null
        });

        await new Promise(resolve => setTimeout(resolve, 5));

        const newBtn = document.getElementById('new-persona-btn');
        newBtn.click();

        assert.ok(document.getElementById('persona-list-view').classList.contains('hidden'));
        assert.ok(!document.getElementById('persona-edit-view').classList.contains('hidden'));

        assert.strictEqual(document.getElementById('persona-id-input').value, '');
        assert.strictEqual(document.getElementById('persona-name-input').value, '');
        assert.strictEqual(document.getElementById('persona-content-input').value, '');
        assert.strictEqual(document.getElementById('persona-default-checkbox').checked, false);
    });

    test('edit card button opens populated edit view', async () => {
        window.PersonaManager.init({
            getChatHistory: () => [],
            getCurrentChatId: () => null
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        // Click edit on the second card (Writer)
        const editBtn = document.querySelectorAll('.persona-action-btn')[0]; // first card edit btn
        editBtn.click();

        assert.ok(document.getElementById('persona-list-view').classList.contains('hidden'));
        assert.strictEqual(document.getElementById('persona-id-input').value, '1');
        assert.strictEqual(document.getElementById('persona-name-input').value, 'Developer');
        assert.strictEqual(document.getElementById('persona-content-input').value, 'Be a coder');
        assert.strictEqual(document.getElementById('persona-default-checkbox').checked, true);
    });

    test('cancel button closes edit view and returns to list view', async () => {
        window.PersonaManager.init({
            getChatHistory: () => [],
            getCurrentChatId: () => null
        });

        await new Promise(resolve => setTimeout(resolve, 5));
        
        window.PersonaManager.openEditPersona();
        assert.ok(document.getElementById('persona-list-view').classList.contains('hidden'));

        document.getElementById('cancel-persona-btn').click();
        assert.ok(!document.getElementById('persona-list-view').classList.contains('hidden'));
        assert.ok(document.getElementById('persona-edit-view').classList.contains('hidden'));
    });

    test('saving edits sends PUT request to backend for existing persona', async () => {
        window.PersonaManager.init({
            getChatHistory: () => [],
            getCurrentChatId: () => null
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        // Open edit
        window.PersonaManager.openEditPersona(mockPersonas[0]);

        // Change values
        document.getElementById('persona-name-input').value = 'Senior Developer';
        document.getElementById('persona-content-input').value = 'Write clean Python code';
        document.getElementById('persona-default-checkbox').checked = true;

        // Mock save response
        mockFetchResponse = {
            success: true,
            persona: { id: 1, name: 'Senior Developer', content: 'Write clean Python code', is_default: 1 }
        };

        // Click save
        document.getElementById('save-persona-btn').click();

        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify save PUT call
        const putCall = mockFetchCalls.find(c => c.options && c.options.method === 'PUT');
        assert.ok(putCall);
        assert.strictEqual(putCall.url, '/api/personas/1');
        
        const payload = JSON.parse(putCall.options.body);
        assert.strictEqual(payload.name, 'Senior Developer');
        assert.strictEqual(payload.content, 'Write clean Python code');
        assert.strictEqual(payload.is_default, 1);
    });

    test('saving new persona sends POST request to backend', async () => {
        window.PersonaManager.init({
            getChatHistory: () => [],
            getCurrentChatId: () => null
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        // Open edit for a new persona (empty)
        window.PersonaManager.openEditPersona(null);

        // Fill values
        document.getElementById('persona-name-input').value = 'Blogger';
        document.getElementById('persona-content-input').value = 'Write engaging blog posts';
        document.getElementById('persona-default-checkbox').checked = false;

        // Mock save response
        mockFetchResponse = {
            success: true,
            persona: { id: 3, name: 'Blogger', content: 'Write engaging blog posts', is_default: 0 }
        };

        // Click save
        document.getElementById('save-persona-btn').click();

        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify save POST call
        const postCall = mockFetchCalls.find(c => c.options && c.options.method === 'POST');
        assert.ok(postCall);
        assert.strictEqual(postCall.url, '/api/personas');
        
        const payload = JSON.parse(postCall.options.body);
        assert.strictEqual(payload.name, 'Blogger');
        assert.strictEqual(payload.content, 'Write engaging blog posts');
        assert.strictEqual(payload.is_default, 0);
    });

    test('validation blocks saving with empty name or instructions', async () => {
        window.PersonaManager.init({
            getChatHistory: () => [],
            getCurrentChatId: () => null
        });

        await new Promise(resolve => setTimeout(resolve, 5));

        window.PersonaManager.openEditPersona(null);
        document.getElementById('persona-name-input').value = '';
        document.getElementById('persona-content-input').value = 'Some description';

        document.getElementById('save-persona-btn').click();
        assert.ok(window.alertCalled);
        assert.strictEqual(window.alertCalled.title, 'Validation Error');

        // Check that no save fetch call was made (fetch only has the initial GET call)
        const saveCalls = mockFetchCalls.filter(c => c.options && (c.options.method === 'POST' || c.options.method === 'PUT'));
        assert.strictEqual(saveCalls.length, 0);
    });

    test('deleting card shows confirm modal and issues DELETE fetch request', async () => {
        window.PersonaManager.init({
            getChatHistory: () => [],
            getCurrentChatId: () => null
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        // Get delete button for card 1 (Developer)
        const deleteBtn = document.querySelectorAll('.persona-action-btn.delete')[0];
        
        // Mock confirmation result: true
        window.confirmResult = true;

        deleteBtn.click();

        await new Promise(resolve => setTimeout(resolve, 10));

        assert.ok(window.confirmCalled);
        assert.strictEqual(window.confirmCalled.title, 'Delete Persona');
        assert.ok(window.confirmCalled.msg.includes('Developer'));

        // Verify delete fetch call was sent
        const deleteCall = mockFetchCalls.find(c => c.options && c.options.method === 'DELETE');
        assert.ok(deleteCall);
        assert.strictEqual(deleteCall.url, '/api/personas/1');
    });

    test('resetToDefault activates default persona correctly', async () => {
        window.PersonaManager.init({
            getChatHistory: () => [],
            getCurrentChatId: () => null
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        // First select persona 2 manually
        window.PersonaManager.setSelectedPersonaId(2);
        assert.strictEqual(window.PersonaManager.getSelectedPersonaId(), 2);

        // Reset to default
        window.PersonaManager.resetToDefault();
        assert.strictEqual(window.PersonaManager.getSelectedPersonaId(), 1);
    });
});

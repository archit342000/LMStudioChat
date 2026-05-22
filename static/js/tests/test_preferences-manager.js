import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const preferencesManagerCode = fs.readFileSync(path.resolve(__dirname, '../preferences-manager.js'), 'utf8');

describe('preferences-manager.js', () => {
    let window;
    let document;
    let mockFetchCalls = [];
    let mockFetchResponse = {
        ok: true,
        json: async () => ({
            success: true,
            preferences: [
                { id: '1', tag: 'preference', content: 'Preloaded preference one', timestamp: 1684713600 },
                { id: '2', tag: 'personal_info', content: 'Preloaded preference two', timestamp: 1684713700 }
            ]
        })
    };
    let mockFetchError = false;
    let mockConfirmCalls = [];
    let mockConfirmResult = true;
    let closeSystemSettingsCalled = false;

    test('setup JSDOM environment', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <button id="sys-manage-preferences">Manage Preferences</button>

            <div id="preferences-file-system-overlay" class="hidden">
                <span id="close-preferences-btn">Close</span>
                <button id="preferences-add-fab">Add</button>
                <input id="preferences-search-input">
                <select id="preferences-filter-select">
                    <option value="all">All</option>
                    <option value="preference">Preference</option>
                    <option value="personal_info">Personal Info</option>
                </select>
                <select id="preferences-sort-select">
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                </select>
                <div id="preferences-list-container"></div>
            </div>

            <!-- Prompt Modal Mock -->
            <div id="prompt-modal" style="display:none;">
                <h3 id="prompt-title"></h3>
                <p id="prompt-message"></p>
                <input id="prompt-input" style="display:block;">
                <div id="prompt-select-container"></div>
                <div id="prompt-icon-svg"></div>
                <button id="prompt-action-btn">Save</button>
                <button id="prompt-cancel-btn">Cancel</button>
            </div>
        </body></html>`, { runScripts: "dangerously" });

        window = dom.window;
        document = window.document;

        // Mock fetch
        window.fetch = async (url, options) => {
            mockFetchCalls.push({ url, options });
            if (mockFetchError) {
                throw new Error("Network Error");
            }
            return mockFetchResponse;
        };

        // Mock showConfirm
        window.showConfirm = async (title, message) => {
            mockConfirmCalls.push({ title, message });
            return mockConfirmResult;
        };

        // Inject script
        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = preferencesManagerCode;
        window.document.body.appendChild(scriptEl);
    });

    test('verifies exports and structure', () => {
        assert.ok(window.PreferencesManager);
        assert.strictEqual(typeof window.PreferencesManager.init, 'function');
        assert.strictEqual(typeof window.PreferencesManager.loadPreferences, 'function');
        assert.strictEqual(typeof window.PreferencesManager.renderPreferences, 'function');
        assert.strictEqual(typeof window.PreferencesManager.openEditPreferenceModal, 'function');
        assert.strictEqual(typeof window.PreferencesManager.getAllPreferences, 'function');
    });

    test('initialization registers events correctly', async () => {
        mockFetchCalls = [];
        closeSystemSettingsCalled = false;

        window.PreferencesManager.init({
            getCurrentChatId: () => 'chat-123',
            closeSystemSettings: () => { closeSystemSettingsCalled = true; }
        });

        // Trigger opening
        const openBtn = document.getElementById("sys-manage-preferences");
        openBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

        assert.ok(closeSystemSettingsCalled);
        
        // Wait for class transitions
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const overlay = document.getElementById("preferences-file-system-overlay");
        assert.ok(overlay.classList.contains("open"));

        // Wait for async preference loading
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.strictEqual(mockFetchCalls.length, 1);
        assert.ok(mockFetchCalls[0].url.includes('/api/tools/preferences?chat_id=chat-123'));

        // Verify preloaded list is rendered
        const items = document.querySelectorAll("#preferences-list-container .hardware-surface");
        assert.strictEqual(items.length, 2);
    });

    test('filters list by tag and search input', () => {
        const searchInput = document.getElementById("preferences-search-input");
        const filterSelect = document.getElementById("preferences-filter-select");

        // Filter by Tag
        filterSelect.value = 'preference';
        filterSelect.dispatchEvent(new window.Event('change'));

        let items = document.querySelectorAll("#preferences-list-container .hardware-surface");
        assert.strictEqual(items.length, 1);
        assert.ok(items[0].innerHTML.includes('Preloaded preference one'));

        // Reset Filter and Search
        filterSelect.value = 'all';
        filterSelect.dispatchEvent(new window.Event('change'));

        searchInput.value = 'two';
        searchInput.dispatchEvent(new window.Event('input'));

        items = document.querySelectorAll("#preferences-list-container .hardware-surface");
        assert.strictEqual(items.length, 1);
        assert.ok(items[0].innerHTML.includes('Preloaded preference two'));

        // Reset search
        searchInput.value = '';
        searchInput.dispatchEvent(new window.Event('input'));
    });

    test('sorts list newest vs oldest', () => {
        const sortSelect = document.getElementById("preferences-sort-select");

        // Newest First (default, timestamps 1684713700 at index 0 vs 1684713600 at index 1)
        sortSelect.value = 'newest';
        sortSelect.dispatchEvent(new window.Event('change'));
        let items = document.querySelectorAll("#preferences-list-container .hardware-surface");
        assert.ok(items[0].innerHTML.includes('Preloaded preference two'));

        // Oldest First
        sortSelect.value = 'oldest';
        sortSelect.dispatchEvent(new window.Event('change'));
        items = document.querySelectorAll("#preferences-list-container .hardware-surface");
        assert.ok(items[0].innerHTML.includes('Preloaded preference one'));
    });

    test('adding a preference triggers custom edit modal and posts to API', async () => {
        mockFetchCalls = [];
        // Ensure mock fetch response returns preferences on subsequent reloads
        mockFetchResponse = {
            ok: true,
            json: async () => ({
                success: true,
                preferences: [
                    { id: '1', tag: 'preference', content: 'Preloaded preference one', timestamp: 1684713600 },
                    { id: '2', tag: 'personal_info', content: 'Preloaded preference two', timestamp: 1684713700 }
                ]
            })
        };

        const promise = window.PreferencesManager.openEditPreferenceModal();

        // Simulate prompt modal rendering in body
        const textarea = document.querySelector("#prompt-modal textarea");
        const select = document.querySelector("#prompt-modal select");
        const saveBtn = document.getElementById("prompt-action-btn");

        assert.ok(textarea);
        assert.ok(select);

        // Fill contents
        textarea.value = "New user fact";
        select.value = "preference";

        // Save
        saveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

        await promise;

        // Verify POST call
        const postCall = mockFetchCalls.find(call => call.options && call.options.method === 'POST');
        assert.ok(postCall);
        assert.ok(postCall.url.includes('/api/tools/preferences?chat_id=chat-123'));
        
        const payload = JSON.parse(postCall.options.body);
        assert.strictEqual(payload.content, "New user fact");
        assert.strictEqual(payload.tag, "preference");

        // Wait for the modal close timeout of 300ms to clear elements
        await new Promise(resolve => setTimeout(resolve, 310));
    });

    test('editing an existing preference triggers edit modal with prefilled data and updates API', async () => {
        mockFetchCalls = [];
        const memToEdit = { id: '42', tag: 'personal_info', content: 'Prefilled details', timestamp: 1684713600 };

        const promise = window.PreferencesManager.openEditPreferenceModal(memToEdit);

        const textarea = document.querySelector("#prompt-modal textarea");
        const select = document.querySelector("#prompt-modal select");
        const saveBtn = document.getElementById("prompt-action-btn");

        assert.strictEqual(textarea.value, 'Prefilled details');
        assert.strictEqual(select.value, 'personal_info');

        // Modify content
        textarea.value = "Prefilled details updated";
        saveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

        await promise;

        // Verify PUT call
        const putCall = mockFetchCalls.find(call => call.options && call.options.method === 'PUT');
        assert.ok(putCall);
        assert.ok(putCall.url.includes('/api/tools/preferences/42?chat_id=chat-123'));

        const payload = JSON.parse(putCall.options.body);
        assert.strictEqual(payload.content, "Prefilled details updated");

        // Wait for the modal close timeout of 300ms to clear elements
        await new Promise(resolve => setTimeout(resolve, 310));
    });

    test('deleting a preference displays showConfirm and calls DELETE on API', async () => {
        mockConfirmCalls = [];
        mockConfirmResult = true;
        mockFetchCalls = [];

        // Ensure mock fetch response returns success list after refresh
        mockFetchResponse = {
            ok: true,
            json: async () => ({
                success: true,
                preferences: [
                    { id: '2', tag: 'personal_info', content: 'Preloaded preference two', timestamp: 1684713700 }
                ]
            })
        };

        // Click delete btn on item 1
        const listContainer = document.getElementById("preferences-list-container");
        window.PreferencesManager.renderPreferences(); // Re-render first to ensure clean state
        
        const deleteBtn = listContainer.querySelector(".delete-mem-btn");
        assert.ok(deleteBtn, "Delete button should be found in preferences list card");
        deleteBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

        // Wait for confirmation promise and fetch calls
        await new Promise(resolve => setTimeout(resolve, 20));

        assert.strictEqual(mockConfirmCalls.length, 1);
        assert.strictEqual(mockConfirmCalls[0].title, 'Delete Preference');

        const deleteCall = mockFetchCalls.find(call => call.options && call.options.method === 'DELETE');
        assert.ok(deleteCall, "Should trigger DELETE request on backend preferences endpoint");
        assert.ok(deleteCall.url.includes('/api/tools/preferences/1?chat_id=chat-123'));
    });
});

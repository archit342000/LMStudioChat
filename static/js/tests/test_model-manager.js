import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdom from 'jsdom';
const { JSDOM } = jsdom;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelManagerCode = fs.readFileSync(path.resolve(__dirname, '../model-manager.js'), 'utf8');

describe('model-manager.js', () => {
    let window;
    let document;
    let fetchCalls = [];
    let showConfirmCalled = false;
    let showConfirmResult = true;

    test('setup', () => {
        const virtualConsole = new jsdom.VirtualConsole();
        virtualConsole.on("jsdomError", (error) => {
            console.error("JSDOM Error:", error);
        });
        virtualConsole.on("error", (error) => {
            console.error("JSDOM Console Error:", error);
        });
        virtualConsole.on("log", (message) => {
            console.log("JSDOM Console Log:", message);
        });

        const dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <select id="model-select-dropdown"></select>
                <button id="send-btn"></button>
                <div id="send-btn-wrapper"></div>
                <div id="settings-modal" class="open"></div>
                <div id="model-switch-overlay" style="display: none;">
                    <div id="model-switch-text"></div>
                </div>
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
            MODELS: 'http://localhost/api/models',
            CHATS: 'http://localhost/api/chats'
        };

        // Mock window alert/confirm helpers
        window.showConfirm = async (title, message) => {
            showConfirmCalled = true;
            return showConfirmResult;
        };

        window.showAlert = async (title, message) => {
            return true;
        };

        // Mock Fetch inside the JSDOM window context
        window.fetch = async (url, options = {}) => {
            fetchCalls.push({ url, options });

            if (url.includes('/config')) {
                return {
                    ok: true,
                    json: async () => ({
                        research: {
                            main: 'llama3:8b-research',
                            vision: 'llama3:vision'
                        },
                        general: {
                            text: 'llama3:8b-text',
                            vision2: 'llama3:vision2'
                        }
                    })
                };
            }

            if (url.includes('/unload')) {
                return { ok: true, json: async () => ({ success: true }) };
            }

            if (url.includes('/load')) {
                return { ok: true, text: async () => 'ok' };
            }

            // Status poll endpoint
            if (url.includes('/api/models') && !url.includes('/config') && !url.includes('/load') && !url.includes('/unload')) {
                // If it is status fetch, return mock loaded models list
                return {
                    ok: true,
                    json: async () => ({
                        data: [
                            { id: 'llama3:8b-research', status: { value: 'loaded' } },
                            { id: 'llama3:vision', status: { value: 'unloaded' } },
                            { id: 'llama3:8b-text', status: { value: 'loaded' } }
                        ]
                    })
                };
            }

            return { ok: false, text: async () => 'Not found' };
        };

        // Load the module code inside window environment
        const scriptEl = document.createElement("script");
        scriptEl.textContent = modelManagerCode;
        document.body.appendChild(scriptEl);
    });

    test('initial state and variables are correctly initialized', () => {
        assert.ok(window.ModelManager);
        assert.strictEqual(typeof window.ModelManager.init, 'function');
        assert.strictEqual(window.ModelManager.getSelectedModel(), '');
        assert.strictEqual(window.ModelManager.getSelectedModelName(), 'Select a Model');
    });

    test('init maps DOM references, loads state, and checks send btn compatibility', () => {
        let onModelChangedCalled = false;
        let isResearchModeVal = false;

        window.ModelManager.init({
            getIsResearchMode: () => isResearchModeVal,
            getCurrentChatId: () => 'chat-123',
            getCurrentChatData: () => ({ last_model: '' }),
            onModelChanged: (id, name) => {
                onModelChangedCalled = true;
            }
        });

        // Dropdown element resolved
        const dropdown = document.getElementById("model-select-dropdown");
        assert.strictEqual(dropdown.value, '');
    });

    test('resolveModelDisplayName maps key to display name correctly', () => {
        window.ModelManager.setAvailableModels([
            { key: 'model-a', display_name: 'Super Model A' }
        ]);

        const displayName = window.ModelManager.resolveModelDisplayName('model-a');
        assert.strictEqual(displayName, 'Super Model A');

        // Fallback for non-existent model
        const fallback = window.ModelManager.resolveModelDisplayName('non-existent');
        assert.strictEqual(fallback, 'non-existent');
    });

    test('fetchModels parses config, sets availableModels and selects default model', async () => {
        fetchCalls = [];
        await window.ModelManager.fetchModels();

        // config call made
        const configCall = fetchCalls.find(c => c.url.includes('/config'));
        assert.ok(configCall);

        const models = window.ModelManager.getAvailableModels();
        assert.ok(models.length > 0);

        // Research main resolved
        const resMain = models.find(m => m.key === 'llama3:8b-research');
        assert.ok(resMain);
        assert.strictEqual(resMain.category, 'research');
        assert.strictEqual(resMain.display_name, 'Research Main (llama3:8b-research)');

        // General text resolved
        const genText = models.find(m => m.key === 'llama3:8b-text');
        assert.ok(genText);
        assert.strictEqual(genText.category, 'general');
    });

    test('renderModelOptions correctly populates the dropdown options', () => {
        const dropdown = document.getElementById("model-select-dropdown");
        assert.ok(dropdown.options.length > 0);
        
        const optionKeys = Array.from(dropdown.options).map(o => o.value);
        assert.ok(optionKeys.includes('llama3:8b-research'));
        assert.ok(optionKeys.includes('llama3:8b-text'));
    });

    test('updateModelStatusUI maps active and inactive badges to options text', async () => {
        fetchCalls = [];
        await window.ModelManager.updateModelStatusUI();

        const dropdown = document.getElementById("model-select-dropdown");
        const loadedOpt = Array.from(dropdown.options).find(o => o.value === 'llama3:8b-text');
        assert.ok(loadedOpt.textContent.includes('(Active)'));
    });

    test('checkSendButtonCompatibility releases or leaves button unchanged', () => {
        const sendBtn = document.getElementById("send-btn");
        window.ModelManager.checkSendButtonCompatibility();
        assert.strictEqual(sendBtn.disabled, false);
    });

    test('unloadAllModels triggers unload request to backend excluding target model', async () => {
        fetchCalls = [];
        // Test unload all except text target model
        await window.ModelManager.unloadAllModels(['llama3:8b-text']);
        
        // Assert that llama3:8b-research unload request was made because it was active
        const unloadCall = fetchCalls.find(c => c.url.includes('/unload') && c.options.body.includes('llama3:8b-research'));
        assert.ok(unloadCall);
    });

    test('selectModel manual switch updates state variables and UI without VRAM reload triggers', async () => {
        fetchCalls = [];
        showConfirmCalled = false;

        await window.ModelManager.selectModel('llama3:8b-research', 'Research Main (llama3:8b-research)', true);

        // Assert no confirmation prompt was shown and no reload API calls were made
        assert.strictEqual(showConfirmCalled, false);
        const loadCall = fetchCalls.find(c => c.url.includes('/load'));
        assert.strictEqual(loadCall, undefined);

        // Model changed status updated correctly
        assert.strictEqual(window.ModelManager.getSelectedModel(), 'llama3:8b-research');
        assert.strictEqual(window.ModelManager.getSelectedModelName(), 'Research Main (llama3:8b-research)');
    });
});

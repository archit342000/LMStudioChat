import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stealthCode = fs.readFileSync(path.resolve(__dirname, '../browser-stealth.js'), 'utf8');

describe('browser-stealth.js', () => {
    let window;
    let document;
    let mockFetchCalls = [];
    let mockFetchResponse = { ok: true, json: async () => ({ stealth_level: 'medium' }) };
    let mockFetchError = false;

    test('setup JSDOM environment', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <form id="stealth-form">
                <input type="radio" name="stealth-level" value="low" id="stealth-low">
                <input type="radio" name="stealth-level" value="medium" id="stealth-medium">
                <input type="radio" name="stealth-level" value="high" id="stealth-high">
            </form>
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

        // Inject script
        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = stealthCode;
        window.document.body.appendChild(scriptEl);
    });

    test('verifies structure and exports', () => {
        assert.ok(window.BrowserStealth);
        assert.strictEqual(typeof window.BrowserStealth.init, 'function');
        assert.strictEqual(typeof window.BrowserStealth.setupListeners, 'function');
        assert.strictEqual(typeof window.BrowserStealth.updateBrowserStealth, 'function');
        assert.strictEqual(typeof window.BrowserStealth.initBrowserStealth, 'function');
    });

    test('initializes and binds listeners', async () => {
        mockFetchCalls = [];
        mockFetchError = false;
        mockFetchResponse = {
            ok: true,
            json: async () => ({ stealth_level: 'low' })
        };

        window.BrowserStealth.init();

        assert.strictEqual(window.BrowserStealth.stealthRadios.length, 3);
        
        // Wait for asynchronous initBrowserStealth call during init()
        await new Promise(resolve => setTimeout(resolve, 10));

        // Check if init fetched correctly
        assert.ok(mockFetchCalls.some(call => call.url === '/api/tools/config/browser'));
        assert.strictEqual(document.getElementById('stealth-low').checked, true);
        assert.strictEqual(document.getElementById('stealth-medium').checked, false);
    });

    test('updates checked attribute dynamically when config fetched', async () => {
        mockFetchCalls = [];
        mockFetchError = false;
        mockFetchResponse = {
            ok: true,
            json: async () => ({ stealth_level: 'high' })
        };

        await window.BrowserStealth.initBrowserStealth();

        assert.strictEqual(document.getElementById('stealth-high').checked, true);
        assert.strictEqual(document.getElementById('stealth-low').checked, false);
    });

    test('triggers PATCH fetch call on radio change', async () => {
        mockFetchCalls = [];
        mockFetchError = false;
        mockFetchResponse = {
            ok: true,
            json: async () => ({ success: true })
        };

        const lowRadio = document.getElementById('stealth-low');
        lowRadio.checked = true;
        lowRadio.dispatchEvent(new window.Event('change'));

        // Wait for updateBrowserStealth execution
        await new Promise(resolve => setTimeout(resolve, 10));

        const patchCall = mockFetchCalls.find(call => call.options && call.options.method === 'PATCH');
        assert.ok(patchCall);
        assert.strictEqual(patchCall.url, '/api/tools/config/browser');
        
        const payload = JSON.parse(patchCall.options.body);
        assert.strictEqual(payload.stealth_level, 'low');
    });

    test('handles API errors gracefully', async () => {
        mockFetchCalls = [];
        mockFetchError = true; // Make fetch throw network error

        // Should handle without throwing exception
        await assert.doesNotReject(async () => {
            await window.BrowserStealth.updateBrowserStealth('medium');
            await window.BrowserStealth.initBrowserStealth();
        });

        // Set response not ok
        mockFetchError = false;
        mockFetchResponse = {
            ok: false,
            status: 500
        };

        await assert.doesNotReject(async () => {
            await window.BrowserStealth.updateBrowserStealth('high');
        });
    });
});

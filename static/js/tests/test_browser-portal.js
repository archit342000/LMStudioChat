import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const portalCode = fs.readFileSync(path.resolve(__dirname, '../browser-portal.js'), 'utf8');

describe('browser-portal.js', () => {
    let window;
    let document;
    let mockFetchCalls = [];
    let mockFetchResponse = { ok: true, json: async () => ({ success: true }) };
    let mockFetchError = false;

    test('setup JSDOM environment', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <button id="open-browser-portal"></button>
            <button id="close-browser-portal"></button>
            <button id="portal-retry-btn"></button>
            <div id="browser-portal-modal" class="modal-backdrop">
                <div class="modal-content">
                    <p id="portal-status-text">Initializing...</p>
                    <div id="portal-loading-overlay" style="display: none;"></div>
                    <div id="portal-error-overlay" class="hidden"></div>
                    <div id="portal-error-message"></div>
                    <div id="portal-iframe"></div>
                </div>
            </div>
        </body></html>`, { runScripts: "dangerously" });
        
        window = dom.window;
        document = window.document;
        window.requestAnimationFrame = (cb) => cb();
        let activeTimeouts = [];
        window.setTimeout = (cb, ms) => {
            activeTimeouts.push({ cb, ms });
            return activeTimeouts.length;
        };
        window.triggerTimeout = (ms) => {
            const found = activeTimeouts.find(t => t.ms === ms);
            if (found) {
                found.cb();
                activeTimeouts = activeTimeouts.filter(t => t !== found);
            }
        };
        window.clearActiveTimeouts = () => {
            activeTimeouts = [];
        };
        
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
        scriptEl.textContent = portalCode;
        window.document.body.appendChild(scriptEl);
    });

    test('verifies structure and API exports', () => {
        assert.ok(window.BrowserPortal);
        assert.strictEqual(typeof window.BrowserPortal.init, 'function');
        assert.strictEqual(typeof window.BrowserPortal.open, 'function');
        assert.strictEqual(typeof window.BrowserPortal.close, 'function');
    });

    test('initializes elements and event listeners', () => {
        window.BrowserPortal.init({
            showAlert: async () => {}
        });

        assert.strictEqual(window.BrowserPortal.elements.openPortalBtn, document.getElementById("open-browser-portal"));
        assert.strictEqual(window.BrowserPortal.elements.closePortalBtn, document.getElementById("close-browser-portal"));
        assert.strictEqual(window.BrowserPortal.elements.portalModal, document.getElementById("browser-portal-modal"));
    });

    test('successful connection lifecycle', async () => {
        mockFetchCalls = [];
        mockFetchError = false;
        mockFetchResponse = {
            ok: true,
            json: async () => ({ success: true })
        };

        const modal = document.getElementById("browser-portal-modal");
        const openBtn = document.getElementById("open-browser-portal");
        const loadingOverlay = document.getElementById("portal-loading-overlay");
        const errorOverlay = document.getElementById("portal-error-overlay");
        const iframe = document.getElementById("portal-iframe");
        const statusText = document.getElementById("portal-status-text");

        // Trigger open
        openBtn.click();

        assert.ok(modal.classList.contains("open"));
        assert.strictEqual(loadingOverlay.style.display, "flex");
        assert.ok(errorOverlay.classList.contains("hidden"));
        assert.strictEqual(statusText.textContent, "Initializing browser session...");

        // Verify full-screen inline !important styles applied to modal-content wrapper
        const wrapper = modal.querySelector('.modal-content');
        assert.ok(wrapper, 'modal-content wrapper should exist');
        assert.strictEqual(wrapper.style.getPropertyValue('width'), '100%');
        assert.strictEqual(wrapper.style.getPropertyPriority('width'), 'important');
        assert.strictEqual(wrapper.style.getPropertyValue('height'), '100%');
        assert.strictEqual(wrapper.style.getPropertyPriority('height'), 'important');
        assert.strictEqual(wrapper.style.getPropertyValue('max-width'), '100%');
        assert.strictEqual(wrapper.style.getPropertyPriority('max-width'), 'important');
        assert.strictEqual(wrapper.style.getPropertyValue('max-height'), '100%');
        assert.strictEqual(wrapper.style.getPropertyPriority('max-height'), 'important');
        assert.strictEqual(wrapper.style.getPropertyValue('border-radius'), '0px');
        assert.strictEqual(wrapper.style.getPropertyPriority('border-radius'), 'important');
        // JSDOM expands 'border' shorthand; check border-style as the key property
        assert.strictEqual(wrapper.style.getPropertyValue('border-style'), 'none');
        assert.strictEqual(wrapper.style.getPropertyPriority('border-style'), 'important');
        assert.strictEqual(wrapper.style.getPropertyValue('margin'), '0px');
        assert.strictEqual(wrapper.style.getPropertyPriority('margin'), 'important');

        // Allow promises to resolve
        await new Promise(resolve => process.nextTick(resolve));

        assert.strictEqual(mockFetchCalls.length, 1);
        assert.strictEqual(mockFetchCalls[0].url, "/api/tools/portal/init");
        assert.strictEqual(mockFetchCalls[0].options.method, "POST");

        assert.strictEqual(statusText.textContent, "Connecting to display...");
        assert.ok(iframe.src.includes("/api/tools/portal/vnc/vnc.html"));

        // Trigger iframe onload
        iframe.onload();

        assert.strictEqual(loadingOverlay.style.display, "none");
        assert.strictEqual(statusText.textContent, "Connected — interactive live view.");
    });

    test('connection failure lifecycle (server returning 500)', async () => {
        mockFetchCalls = [];
        mockFetchError = false;
        mockFetchResponse = {
            ok: false,
            status: 500,
            json: async () => ({ error: "Internal Server Error" })
        };

        const retryBtn = document.getElementById("portal-retry-btn");
        const loadingOverlay = document.getElementById("portal-loading-overlay");
        const errorOverlay = document.getElementById("portal-error-overlay");
        const errorMessage = document.getElementById("portal-error-message");
        const statusText = document.getElementById("portal-status-text");

        retryBtn.click();

        assert.strictEqual(loadingOverlay.style.display, "flex");
        assert.ok(errorOverlay.classList.contains("hidden"));

        await new Promise(resolve => process.nextTick(resolve));

        assert.strictEqual(mockFetchCalls.length, 1);
        assert.strictEqual(loadingOverlay.style.display, "none");
        assert.ok(!errorOverlay.classList.contains("hidden"));
        assert.strictEqual(errorMessage.textContent, "Internal Server Error");
        assert.strictEqual(statusText.textContent, "Connection failed.");
    });

    test('connection failure lifecycle (network throw)', async () => {
        mockFetchCalls = [];
        mockFetchError = true;

        const retryBtn = document.getElementById("portal-retry-btn");
        const loadingOverlay = document.getElementById("portal-loading-overlay");
        const errorOverlay = document.getElementById("portal-error-overlay");
        const errorMessage = document.getElementById("portal-error-message");
        const statusText = document.getElementById("portal-status-text");

        retryBtn.click();

        assert.strictEqual(loadingOverlay.style.display, "flex");
        assert.ok(errorOverlay.classList.contains("hidden"));

        await new Promise(resolve => process.nextTick(resolve));

        assert.strictEqual(mockFetchCalls.length, 1);
        assert.strictEqual(loadingOverlay.style.display, "none");
        assert.ok(!errorOverlay.classList.contains("hidden"));
        assert.strictEqual(errorMessage.textContent, "Network Error");
        assert.strictEqual(statusText.textContent, "Connection failed.");
    });

    test('close modal disconnects session', () => {
        const modal = document.getElementById("browser-portal-modal");
        const closeBtn = document.getElementById("close-browser-portal");
        const iframe = document.getElementById("portal-iframe");
        const statusText = document.getElementById("portal-status-text");

        modal.classList.add("open");
        iframe.src = "http://something";

        closeBtn.click();

        assert.ok(!modal.classList.contains("open"));
        assert.strictEqual(iframe.src, "");
        assert.strictEqual(statusText.textContent, "Disconnected.");

        // Verify full-screen inline styles are removed on close so translateY
        // on closed modal-content cannot cause invisible overflow on iOS.
        const wrapper = modal.querySelector('.modal-content');
        assert.ok(wrapper, 'modal-content wrapper should exist');
        assert.strictEqual(wrapper.style.getPropertyValue('width'), '');
        assert.strictEqual(wrapper.style.getPropertyValue('height'), '');
        assert.strictEqual(wrapper.style.getPropertyValue('max-height'), '');
        assert.strictEqual(wrapper.style.getPropertyValue('border-radius'), '');
        assert.strictEqual(wrapper.style.getPropertyValue('margin'), '');
    });

    test('timeout fallback hides spinner and updates status', async () => {
        window.clearActiveTimeouts();
        mockFetchCalls = [];
        mockFetchError = false;
        mockFetchResponse = {
            ok: true,
            json: async () => ({ success: true })
        };

        const openBtn = document.getElementById("open-browser-portal");
        const loadingOverlay = document.getElementById("portal-loading-overlay");
        const statusText = document.getElementById("portal-status-text");

        openBtn.click();
        await new Promise(resolve => process.nextTick(resolve));

        assert.strictEqual(loadingOverlay.style.display, "flex");
        assert.strictEqual(statusText.textContent, "Connecting to display...");

        // Trigger the 15-second timeout fallback
        window.triggerTimeout(15000);

        assert.strictEqual(loadingOverlay.style.display, "none");
        assert.strictEqual(statusText.textContent, "Connected (stream may still be loading).");
    });
});

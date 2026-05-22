import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticPath = path.resolve(__dirname, '../');

const loadFile = (relPath) => fs.readFileSync(path.resolve(staticPath, relPath), 'utf8');

describe('script.js', () => {
    test('initializes without error', async () => {
        return new Promise((resolve, reject) => {
            const virtualConsole = new VirtualConsole();
            
            // Listen for JSDOM errors
            virtualConsole.on("jsdomError", (error) => {
                reject(new Error(`JSDOM Error: ${error.message}\n${error.stack}`));
            });

            // Listen for console.error
            virtualConsole.on("error", (...args) => {
                const errorStr = args.map(a => a ? a.toString() : '').join(' ');
                // Ignore network failure logs from fetch mocks
                if (errorStr.includes('Failed to fetch')) return;
                if (errorStr.includes('Model config fetch error')) return;
                reject(new Error(`Console Error: ${errorStr}`));
            });

            // Strip ALL script tags to avoid JSDOM attempting to fetch/execute them and throwing reference errors
            const htmlContent = loadFile('index.html').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            const dom = new JSDOM(htmlContent, { 
                runScripts: "dangerously",
                url: "http://localhost/",
                virtualConsole 
            });
            const window = dom.window;
            
            // Mock canvas for bg-animation
            window.HTMLCanvasElement.prototype.getContext = function () {
                return { scale: () => {}, clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {} };
            };
            window.requestAnimationFrame = () => {};
            window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
            
            // Catch unhandled errors
            window.onerror = function(msg, url, lineNo, columnNo, error) {
                reject(new Error(`Window Error: ${msg}\n${error?.stack}`));
                return false;
            };

            // Catch unhandled promise rejections
            window.addEventListener('unhandledrejection', function(event) {
                reject(new Error(`Unhandled Rejection: ${event.reason}`));
            });

            window.fetch = async (url) => ({
                ok: true,
                json: async () => {
                    if (url && url.includes('/file_systems')) return { file_systems: [], success: true };
                    return [];
                }
            });
            
            window.URL = {
                createObjectURL: () => '',
                revokeObjectURL: () => {}
            };
            
            const injectScript = (code) => {
                const scriptEl = window.document.createElement("script");
                scriptEl.textContent = code;
                window.document.body.appendChild(scriptEl);
            };

            try {
                // Load dependencies
                injectScript(loadFile('js/utils.js'));
                injectScript(loadFile('js/constants.js'));
                injectScript(loadFile('js/context-menu.js'));
                injectScript(loadFile('js/persona-manager.js'));
                injectScript(loadFile('js/agent-config.js'));
                injectScript(loadFile('js/preferences-manager.js'));
                injectScript(loadFile('js/model-manager.js'));
                injectScript(loadFile('js/bg-animation.js'));
                injectScript(loadFile('js/icons.js'));
                injectScript(loadFile('js/agent-renderers.js'));
                injectScript(loadFile('js/modals.js'));
                injectScript(loadFile('js/toast.js'));
                injectScript(loadFile('js/clarification-popover.js'));
                injectScript(loadFile('js/file-system-ui.js'));
                injectScript(loadFile('js/version-manager.js'));
                injectScript(loadFile('js/settings-manager.js'));
                injectScript(loadFile('js/workspace-manager.js'));
                injectScript(loadFile('js/editor-manager.js'));
                injectScript(loadFile('js/attachment-manager.js'));
                injectScript(loadFile('js/image-modal.js'));
                injectScript(loadFile('js/markdown-renderer.js'));
                injectScript(loadFile('js/file-explorer-modal.js'));
                injectScript(loadFile('js/browser-portal.js'));
                injectScript(loadFile('js/browser-stealth.js'));
                injectScript(loadFile('js/telemetry-chart.js'));
                injectScript(loadFile('js/scroll-manager.js'));
                injectScript(loadFile('js/message-manager.js'));
                
                // Mock EditorManager loadCodeMirror for testing since we lack esbuild bundle
                window.EditorManager.loadCodeMirror = async () => {
                    window.EditorManager._cmView = class MockEditor {
                        constructor({parent}) { this.parent = parent; }
                        dispatch() {}
                        static updateListener = { of: () => ({}) };
                    };
                    window.EditorManager._cmState = { create: () => ({}), readOnly: { of: () => ({}) } };
                    window.EditorManager._cmThemeCompartment = { of: () => ({}), reconfigure: () => ({}) };
                    window.EditorManager._cmLanguageCompartment = { of: () => ({}), reconfigure: () => ({}) };
                    window.EditorManager._cmReadOnlyCompartment = { of: () => ({}), reconfigure: () => ({}) };
                    window.EditorManager._cmStyleCompartment = { of: () => ({}), reconfigure: () => ({}) };
                };

                // Load main script
                injectScript(loadFile('script.js'));
                
                // Trigger DOMContentLoaded
                const event = new window.Event('DOMContentLoaded');
                window.document.dispatchEvent(event);
                
                // Wait a tick to allow promises to settle
                setTimeout(() => {
                    resolve();
                }, 50);
                
            } catch (err) {
                reject(err);
            }
        });
    });
});

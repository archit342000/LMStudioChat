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
                injectScript(loadFile('js/skills-manager.js'));
                injectScript(loadFile('js/slash-autocomplete.js'));
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

    test('workspace view and file sidebar state', async () => {
        return new Promise((resolve, reject) => {
            const virtualConsole = new VirtualConsole();
            virtualConsole.on("jsdomError", (error) => reject(error));
            virtualConsole.on("error", (...args) => {
                const errorStr = args.map(a => a ? a.toString() : '').join(' ');
                if (errorStr.includes('Failed to fetch')) return;
                if (errorStr.includes('Model config fetch error')) return;
                reject(new Error(`Console Error: ${errorStr}`));
            });

            const htmlContent = loadFile('index.html').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            const dom = new JSDOM(htmlContent, { 
                runScripts: "dangerously",
                url: "http://localhost/",
                virtualConsole 
            });
            const window = dom.window;
            
            // Mock canvas and required window helpers
            window.HTMLCanvasElement.prototype.getContext = () => ({
                scale: () => {}, clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}
            });
            window.requestAnimationFrame = () => {};
            window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
            
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

            // Load dependencies
            injectScript(loadFile('js/utils.js'));
            injectScript(loadFile('js/constants.js'));
            injectScript(loadFile('js/context-menu.js'));
            injectScript(loadFile('js/persona-manager.js'));
            injectScript(loadFile('js/agent-config.js'));
            injectScript(loadFile('js/preferences-manager.js'));
            injectScript(loadFile('js/skills-manager.js'));
            injectScript(loadFile('js/slash-autocomplete.js'));
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
            
            window.EditorManager.loadCodeMirror = async () => {};

            // Load main script
            injectScript(loadFile('script.js'));
            
            // Trigger DOMContentLoaded
            const event = new window.Event('DOMContentLoaded');
            window.document.dispatchEvent(event);
            
            setTimeout(() => {
                try {
                    // Navigate to a workspace page
                    window.history.pushState({ workspaceId: "test-workspace" }, "", "/workspace/test-workspace");
                    const popstateEvent = new window.Event('popstate');
                    window.dispatchEvent(popstateEvent);

                    // Wait a moment for loadWorkspace and popstate handling to finish
                    setTimeout(() => {
                        try {
                            const rightSidebar = window.document.getElementById("right-sidebar");
                            const navFilesBtn = window.document.getElementById("nav-files-btn");

                            // Assertions:
                            // 1. Right sidebar should not toggle itself open on opening the workspace page (should remain collapsed)
                            assert.ok(rightSidebar.classList.contains("collapsed"), "Right sidebar should remain collapsed on opening workspace page");

                            // 2. The files toggle button (nav-files-btn) should be enabled on workspace page irrespective of workspace contents
                            assert.ok(!navFilesBtn.classList.contains("disabled"), "nav-files-btn should not have disabled class");
                            assert.strictEqual(navFilesBtn.style.opacity, "1", "nav-files-btn style opacity should be 1");
                            assert.strictEqual(navFilesBtn.style.pointerEvents, "auto", "nav-files-btn style pointerEvents should be auto");

                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    }, 50);
                } catch (err) {
                    reject(err);
                }
            }, 100);
        });
    });

    test('workspace click behaviors: chevron vs folder header', async () => {
        return new Promise((resolve, reject) => {
            const virtualConsole = new VirtualConsole();
            virtualConsole.on("jsdomError", (error) => reject(error));
            virtualConsole.on("error", (...args) => {
                const errorStr = args.map(a => a ? a.toString() : '').join(' ');
                if (errorStr.includes('Failed to fetch')) return;
                if (errorStr.includes('Model config fetch error')) return;
                reject(new Error(`Console Error: ${errorStr}`));
            });

            const htmlContent = loadFile('index.html').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            const dom = new JSDOM(htmlContent, { 
                runScripts: "dangerously",
                url: "http://localhost/",
                virtualConsole 
            });
            const window = dom.window;
            
            // Mock canvas and required window helpers
            window.HTMLCanvasElement.prototype.getContext = () => ({
                scale: () => {}, clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}
            });
            window.requestAnimationFrame = () => {};
            window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
            
            window.fetch = async (url) => {
                if (url && url.includes('/workspaces')) {
                    return {
                        ok: true,
                        json: async () => [{ id: 'test-ws-id', name: 'Test Workspace Name' }]
                    };
                }
                if (url && url.includes('/file_systems')) {
                    return { ok: true, json: async () => ({ file_systems: [], success: true }) };
                }
                // Mock return empty chats array
                return {
                    ok: true,
                    json: async () => []
                };
            };
            
            window.URL = {
                createObjectURL: () => '',
                revokeObjectURL: () => {}
            };
            
            const injectScript = (code) => {
                const scriptEl = window.document.createElement("script");
                scriptEl.textContent = code;
                window.document.body.appendChild(scriptEl);
            };

            // Load dependencies
            injectScript(loadFile('js/utils.js'));
            injectScript(loadFile('js/constants.js'));
            injectScript(loadFile('js/context-menu.js'));
            injectScript(loadFile('js/persona-manager.js'));
            injectScript(loadFile('js/agent-config.js'));
            injectScript(loadFile('js/preferences-manager.js'));
            injectScript(loadFile('js/skills-manager.js'));
            injectScript(loadFile('js/slash-autocomplete.js'));
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
            
            window.EditorManager.loadCodeMirror = async () => {};

            // Load main script
            injectScript(loadFile('script.js'));
            
            // Trigger DOMContentLoaded
            const event = new window.Event('DOMContentLoaded');
            window.document.dispatchEvent(event);
            
            setTimeout(() => {
                try {
                    // Let's verify that the workspace is rendered in the sidebar
                    const folderList = window.document.getElementById("folder-list");
                    const folderItems = folderList.getElementsByClassName("folder-item");
                    
                    assert.strictEqual(folderItems.length, 1, "Should render exactly one workspace folder item");
                    
                    const folderItem = folderItems[0];
                    const folderHeader = folderItem.querySelector(".folder-header");
                    const chevronWrapper = folderItem.querySelector(".folder-chevron-wrapper");
                    const workspaceId = folderItem.getAttribute("data-workspace-id");
                    
                    assert.strictEqual(workspaceId, "test-ws-id", "Workspace ID should match mocked data");
                    
                    // Verify initial expansion state
                    let workspaces = window.WorkspaceManager.getChatWorkspaces();
                    let ws = workspaces.find(w => w.name === workspaceId);
                    assert.strictEqual(ws.expanded, true, "Initially workspace should be expanded");

                    // 1. Click chevron to collapse the workspace.
                    // This should toggle expansion state, but NOT trigger loading the workspace page.
                    let pushStateCalled = false;
                    const originalPushState = window.history.pushState;
                    window.history.pushState = (...args) => {
                        pushStateCalled = true;
                        originalPushState.apply(window.history, args);
                    };
                    
                    chevronWrapper.click();
                    
                    workspaces = window.WorkspaceManager.getChatWorkspaces();
                    ws = workspaces.find(w => w.name === workspaceId);
                    assert.strictEqual(ws.expanded, false, "Clicking chevronWrapper should toggle expansion (expanded: false)");
                    assert.strictEqual(pushStateCalled, false, "Clicking chevronWrapper should not trigger loadWorkspace");

                    // 2. Click folderHeader itself.
                    // This should load the workspace (pushState) but NOT expand the workspace list in the sidebar.
                    folderHeader.click();
                    
                    workspaces = window.WorkspaceManager.getChatWorkspaces();
                    ws = workspaces.find(w => w.name === workspaceId);
                    assert.strictEqual(ws.expanded, false, "Clicking folderHeader should not toggle or change expansion");
                    assert.strictEqual(pushStateCalled, true, "Clicking folderHeader should trigger loadWorkspace");
                    
                    // Clean up/restore
                    window.history.pushState = originalPushState;
                    resolve();
                } catch (err) {
                    reject(err);
                }
            }, 150);
        });
    });

    test('right sidebar toggle collapses and expands', async () => {
        return new Promise((resolve, reject) => {
            const virtualConsole = new VirtualConsole();
            virtualConsole.on("jsdomError", (error) => reject(error));
            virtualConsole.on("log", (...args) => console.log("JSDOM LOG:", ...args));
            virtualConsole.on("error", (...args) => {
                const errorStr = args.map(a => a ? a.toString() : '').join(' ');
                if (errorStr.includes('Failed to fetch')) return;
                if (errorStr.includes('Model config fetch error')) return;
                reject(new Error(`Console Error: ${errorStr}`));
            });

            const htmlContent = loadFile('index.html').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            const dom = new JSDOM(htmlContent, { 
                runScripts: "dangerously",
                url: "http://localhost/",
                virtualConsole 
            });
            const window = dom.window;
            
            // Mock canvas and required window helpers
            window.HTMLCanvasElement.prototype.getContext = () => ({
                scale: () => {}, clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}
            });
            window.requestAnimationFrame = () => {};
            window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
            
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

            // Load dependencies
            injectScript(loadFile('js/utils.js'));
            injectScript(loadFile('js/constants.js'));
            injectScript(loadFile('js/context-menu.js'));
            injectScript(loadFile('js/persona-manager.js'));
            injectScript(loadFile('js/agent-config.js'));
            injectScript(loadFile('js/preferences-manager.js'));
            injectScript(loadFile('js/skills-manager.js'));
            injectScript(loadFile('js/slash-autocomplete.js'));
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
            
            window.EditorManager.loadCodeMirror = async () => {};

            // Load main script
            injectScript(loadFile('script.js'));
            
            // DOMContentLoaded is already triggered by JSDOM after scripts are injected
            
            setTimeout(() => {
                try {
                    // Navigate to a workspace page to enable the files button
                    window.history.pushState({ workspaceId: "test-workspace" }, "", "/workspace/test-workspace");
                    const popstateEvent = new window.Event('popstate');
                    window.dispatchEvent(popstateEvent);

                    setTimeout(() => {
                        try {
                            const rightSidebar = window.document.getElementById("right-sidebar");
                            const navFilesBtn = window.document.getElementById("nav-files-btn");
                            const rightSidebarClose = window.document.getElementById("right-sidebar-close");

                            // Initially right sidebar is collapsed
                            assert.ok(rightSidebar.classList.contains("collapsed"), "Initially collapsed");

                            // 1. Click navFilesBtn to open right sidebar (should remove collapsed)
                            navFilesBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

                            assert.ok(!rightSidebar.classList.contains("collapsed"), "Clicking navFilesBtn should expand the right sidebar");

                            // 2. Click rightSidebarClose to collapse the right sidebar (should add collapsed)
                            rightSidebarClose.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
                            assert.ok(rightSidebar.classList.contains("collapsed"), "Clicking close should collapse the right sidebar");

                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    }, 50);
                } catch (err) {
                    reject(err);
                }
            }, 100);
        });
    });

    test('file sidebar new-file-button structure and styling', async () => {
        return new Promise((resolve, reject) => {
            const virtualConsole = new VirtualConsole();
            virtualConsole.on("jsdomError", (error) => reject(error));
            virtualConsole.on("error", (...args) => {
                const errorStr = args.map(a => a ? a.toString() : '').join(' ');
                if (errorStr.includes('Failed to fetch')) return;
                if (errorStr.includes('Model config fetch error')) return;
                reject(new Error(`Console Error: ${errorStr}`));
            });

            const htmlContent = loadFile('index.html').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            const dom = new JSDOM(htmlContent, { 
                runScripts: "dangerously",
                url: "http://localhost/",
                virtualConsole 
            });
            const window = dom.window;

            // Assertions for "New File" button relocation and styling:
            const rightSidebar = window.document.getElementById("right-sidebar");
            assert.ok(rightSidebar, "Right sidebar element should exist");

            // 1. "New File" button should be in the sidebar-header
            const newFileBtn = window.document.getElementById("new-file-system-btn");
            assert.ok(newFileBtn, "New file button should exist");

            const headerActions = rightSidebar.querySelector(".sidebar-header-actions");
            assert.ok(headerActions, "Right sidebar header actions container should exist");
            assert.ok(headerActions.contains(newFileBtn), "New file button should be a child of sidebar header actions");

            // 2. Styling check: It should have the sidebar-icon-btn class, not btn-primary
            assert.ok(newFileBtn.classList.contains("sidebar-icon-btn"), "New file button should have sidebar-icon-btn class");
            assert.ok(!newFileBtn.classList.contains("btn-primary"), "New file button should not have btn-primary class");

            // 3. Footer check: The right sidebar should not contain a sidebar-footer container
            const footer = rightSidebar.querySelector(".sidebar-footer");
            assert.strictEqual(footer, null, "Right sidebar should not have a sidebar-footer container");

            resolve();
        });
    });

    test('chat textarea auto-resize and scroll restoration', async () => {
        return new Promise((resolve, reject) => {
            const virtualConsole = new VirtualConsole();
            virtualConsole.on("jsdomError", (error) => reject(error));
            virtualConsole.on("error", (...args) => {
                const errorStr = args.map(a => a ? a.toString() : '').join(' ');
                if (errorStr.includes('Failed to fetch')) return;
                if (errorStr.includes('Model config fetch error')) return;
                reject(new Error(`Console Error: ${errorStr}`));
            });

            const htmlContent = loadFile('index.html').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            const dom = new JSDOM(htmlContent, { 
                runScripts: "dangerously",
                url: "http://localhost/",
                virtualConsole 
            });
            const window = dom.window;
            
            // Mock canvas and required window helpers
            window.HTMLCanvasElement.prototype.getContext = () => ({
                scale: () => {}, clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}
            });
            window.requestAnimationFrame = () => {};
            window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
            
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

            // Load dependencies
            injectScript(loadFile('js/utils.js'));
            injectScript(loadFile('js/constants.js'));
            injectScript(loadFile('js/context-menu.js'));
            injectScript(loadFile('js/persona-manager.js'));
            injectScript(loadFile('js/agent-config.js'));
            injectScript(loadFile('js/preferences-manager.js'));
            injectScript(loadFile('js/skills-manager.js'));
            injectScript(loadFile('js/slash-autocomplete.js'));
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
            window.EditorManager.loadCodeMirror = async () => {};

            // Load main script
            injectScript(loadFile('script.js'));
            
            // Trigger DOMContentLoaded
            const event = new window.Event('DOMContentLoaded');
            window.document.dispatchEvent(event);
            
            setTimeout(() => {
                try {
                    const textArea = window.document.getElementById("chat-textarea");
                    assert.ok(textArea, "Textarea should exist");

                    // Mock scrollHeight
                    Object.defineProperty(textArea, 'scrollHeight', {
                        configurable: true,
                        get: () => 150
                    });

                    // Mock syncBackdrop call tracking
                    let syncCalled = false;
                    if (window.SlashAutocomplete) {
                        window.SlashAutocomplete.syncBackdrop = () => {
                            syncCalled = true;
                        };
                    }

                    // Set scroll position
                    textArea.scrollTop = 42;

                    // Trigger input event
                    const inputEvent = new window.Event('input', { bubbles: true });
                    textArea.dispatchEvent(inputEvent);

                    // Check that the height was adjusted and scrollTop was preserved
                    assert.strictEqual(textArea.style.height, "150px", "Textarea height should match scrollHeight");
                    assert.strictEqual(textArea.scrollTop, 42, "Textarea scrollTop should be preserved");
                    assert.ok(syncCalled, "syncBackdrop should be called to update backdrop layout");

                    // Mock scrollHeight to exceed maxHeight (200px fallback)
                    Object.defineProperty(textArea, 'scrollHeight', {
                        configurable: true,
                        get: () => 250
                    });

                    // Trigger input event again
                    textArea.dispatchEvent(inputEvent);

                    // Check that height is capped at 200px
                    assert.strictEqual(textArea.style.height, "200px", "Textarea height should be capped at maxHeight");

                    resolve();
                } catch (err) {
                    reject(err);
                }
            }, 100);
        });
    });

    test('chat textarea touchmove event should not be prevented on iOS', async () => {
        return new Promise((resolve, reject) => {
            const virtualConsole = new VirtualConsole();
            virtualConsole.on("jsdomError", (error) => reject(error));
            virtualConsole.on("error", (...args) => {
                const errorStr = args.map(a => a ? a.toString() : '').join(' ');
                if (errorStr.includes('Failed to fetch')) return;
                if (errorStr.includes('Model config fetch error')) return;
                reject(new Error(`Console Error: ${errorStr}`));
            });

            const htmlContent = loadFile('index.html').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            const dom = new JSDOM(htmlContent, { 
                runScripts: "dangerously",
                url: "http://localhost/",
                virtualConsole 
            });
            const window = dom.window;
            
            // Mock canvas and required window helpers
            window.HTMLCanvasElement.prototype.getContext = () => ({
                scale: () => {}, clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}
            });
            window.requestAnimationFrame = () => {};
            window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
            
            // Set UserAgent to mock iPad / iOS
            Object.defineProperty(window.navigator, 'userAgent', {
                get: () => 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
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

            // Load dependencies
            injectScript(loadFile('js/utils.js'));
            injectScript(loadFile('js/constants.js'));
            injectScript(loadFile('js/context-menu.js'));
            injectScript(loadFile('js/persona-manager.js'));
            injectScript(loadFile('js/agent-config.js'));
            injectScript(loadFile('js/preferences-manager.js'));
            injectScript(loadFile('js/skills-manager.js'));
            injectScript(loadFile('js/slash-autocomplete.js'));
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
            
            // Mock EditorManager loadCodeMirror for testing
            window.EditorManager.loadCodeMirror = async () => {};

            // Load main script
            injectScript(loadFile('script.js'));
            
            // Trigger DOMContentLoaded which calls initScrollManager()
            const event = new window.Event('DOMContentLoaded');
            window.document.dispatchEvent(event);
            
            setTimeout(() => {
                try {
                    const textArea = window.document.getElementById("chat-textarea");
                    assert.ok(textArea, "Textarea should exist");

                    // Create a touchmove event that is cancelable
                    const touchmoveEvent = new window.Event('touchmove', { bubbles: true, cancelable: true });
                    
                    // Dispatch the event directly on the textarea
                    textArea.dispatchEvent(touchmoveEvent);

                    // Verify that the event is NOT defaultPrevented
                    assert.strictEqual(touchmoveEvent.defaultPrevented, false, "touchmove on #chat-textarea should not be prevented");

                    resolve();
                } catch (err) {
                    reject(err);
                }
            }, 100);
        });
    });
});

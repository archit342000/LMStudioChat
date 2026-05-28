import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const utilsCode = fs.readFileSync(path.resolve(__dirname, '../utils.js'), 'utf8');
const scrollManagerCode = fs.readFileSync(path.resolve(__dirname, '../scroll-manager.js'), 'utf8');

describe('scroll-manager.js', () => {
    let window;

    test('setup JSDOM and scripts', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body class="some-class">
            <div id="messages" style="height: 500px; overflow-y: auto;">
                <div style="height: 1000px;">Chat History</div>
            </div>
            <div id="chat-input-area" style="transform: none;"></div>
        </body></html>`, { runScripts: "dangerously" });
        window = dom.window;

        // Mock window.visualViewport
        window.visualViewport = {
            height: 500,
            addEventListener: (event, cb) => {
                window.visualViewport[`on${event}`] = cb;
            },
            removeEventListener: () => {}
        };

        // Stub Date.now to avoid throttling issues (return times with 1000ms steps)
        let mockTime = 10000;
        window.Date.now = () => {
            mockTime += 1000;
            return mockTime;
        };

        // Load scripts
        const loadScript = (code) => {
            const scriptEl = window.document.createElement("script");
            scriptEl.textContent = code;
            window.document.body.appendChild(scriptEl);
        };

        loadScript(utilsCode);
        loadScript(scrollManagerCode);

        // Simple mock of requestAnimationFrame
        window.requestAnimationFrame = (cb) => cb();
    });

    test('setScrollLock - lock and unlock', () => {
        const setScrollLock = window.eval('setScrollLock');
        const body = window.document.body;

        // 1. Lock scroll
        setScrollLock(true);
        assert.ok(body.classList.contains('no-scroll'));
        assert.strictEqual(body.style.top, '0px'); // since window.scrollY is 0 in JSDOM

        // 2. Unlock scroll with no other overlays open
        setScrollLock(false);
        assert.strictEqual(body.classList.contains('no-scroll'), false);
        assert.strictEqual(body.style.top, '');

        // 3. Unlock scroll with a modal open should remain locked
        setScrollLock(true);
        const modal = window.document.createElement('div');
        modal.className = 'modal-backdrop open';
        window.document.body.appendChild(modal);

        setScrollLock(false);
        assert.ok(body.classList.contains('no-scroll')); // Remains locked because modal is open

        // Clean up modal
        window.document.body.removeChild(modal);
        setScrollLock(false);
        assert.strictEqual(body.classList.contains('no-scroll'), false);
    });

    test('scrollToBottom - smart scroll detection', () => {
        const scrollToBottom = window.eval('scrollToBottom');
        const messages = window.document.getElementById('messages');

        let scrolled = false;
        messages.scrollTo = (options) => {
            scrolled = true;
            messages.scrollTop = options.top;
        };

        // Stub dimensions
        Object.defineProperties(messages, {
            scrollHeight: { value: 1000, configurable: true },
            clientHeight: { value: 500, configurable: true }
        });

        // 1. User scrolled way up (messages.scrollTop = 0)
        messages.scrollTop = 0;
        scrolled = false;
        scrollToBottom('auto', false);
        assert.strictEqual(scrolled, false); // No autoscroll because user is reading upper history

        // 2. User is near bottom (messages.scrollTop = 450, clientHeight = 500, total = 950 <= 1000 - 60)
        messages.scrollTop = 450;
        scrolled = false;
        scrollToBottom('auto', false);
        assert.strictEqual(scrolled, true); // Autoscrolls because user is near bottom

        // 3. Forced autoscroll works even if user has scrolled up
        messages.scrollTop = 0;
        scrolled = false;
        scrollToBottom('auto', true);
        assert.strictEqual(scrolled, true); // Forced autoscroll works
    });

    test('initScrollManager & syncViewport - Touch/iPad viewport alignment', () => {
        const initScrollManager = window.eval('initScrollManager');
        const chatInputArea = window.document.getElementById('chat-input-area');

        // Setup mock touchscreen properties
        window.innerWidth = 820; // iPad Portrait size
        window.innerHeight = 1024;
        
        Object.defineProperty(window.navigator, 'maxTouchPoints', {
            value: 5,
            configurable: true
        });
        window.ontouchstart = () => {};

        // Run scroll manager setup
        initScrollManager();

        // Simulate virtual keyboard popup (reduces visual viewport height)
        window.visualViewport.height = 700; // Keyboard takes 324px
        
        // Trigger visual viewport resize event callback
        window.visualViewport.onresize();

        // Input container should be translated upward to avoid getting hidden
        assert.strictEqual(chatInputArea.style.transform, 'translateY(-324px)');

        // Simulate virtual keyboard close
        window.visualViewport.height = 1024;
        window.visualViewport.onresize();
        assert.strictEqual(chatInputArea.style.transform, 'translateY(0)');
    });

    test('initScrollManager - ignores desktop screen viewport resize', () => {
        const chatInputArea = window.document.getElementById('chat-input-area');

        // Setup non-touch desktop environment
        window.innerWidth = 1280; // Desktop screen width
        window.innerHeight = 800;
        
        Object.defineProperty(window.navigator, 'maxTouchPoints', {
            value: 0,
            configurable: true
        });
        delete window.ontouchstart;

        // Trigger resize
        window.visualViewport.height = 600;
        window.visualViewport.onresize();

        // Should not apply translateY since it's a desktop browser width and non-touch screen
        assert.strictEqual(chatInputArea.style.transform, '');
    });

    test('touchmove overscroll prevention on iOS/iPad allows workspace-view and clarification popover scrolling', () => {
        // Setup JSDOM in iOS mode
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <div id="messages"></div>
            <div id="workspace-view">
                <div id="child"></div>
            </div>
            <div class="clarification-popover">
                <div id="popover-child"></div>
            </div>
            <div id="other-blocked-element"></div>
            <div id="chat-input-area"></div>
        </body></html>`, { 
            runScripts: "dangerously",
            url: "http://localhost/"
        });
        const win = dom.window;

        // Mock navigator properties to trick scroll-manager into detecting iOS/iPad
        Object.defineProperty(win.navigator, 'userAgent', {
            value: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            configurable: true
        });

        // Load utils & scroll-manager
        const loadScript = (code) => {
            const scriptEl = win.document.createElement("script");
            scriptEl.textContent = code;
            win.document.body.appendChild(scriptEl);
        };
        loadScript(utilsCode);
        loadScript(scrollManagerCode);

        // Run scroll manager setup
        const initScrollManager = win.eval('initScrollManager');
        initScrollManager();

        // Get the elements
        const workspaceView = win.document.getElementById('workspace-view');
        const child = win.document.getElementById('child');
        const otherEl = win.document.getElementById('other-blocked-element');
        const popover = win.document.querySelector('.clarification-popover');
        const popoverChild = win.document.getElementById('popover-child');

        // We will dispatch a touchmove event and check if preventDefault was called.
        // On workspace-view, clarification-popover or their children, preventDefault should NOT be called.
        // On other-blocked-element, preventDefault SHOULD be called.

        const dispatchTouchMove = (element) => {
            let preventDefaultCalled = false;
            const event = new win.TouchEvent('touchmove', {
                bubbles: true,
                cancelable: true
            });
            event.preventDefault = () => {
                preventDefaultCalled = true;
            };
            element.dispatchEvent(event);
            return preventDefaultCalled;
        };

        // Touch on child inside workspace-view -> Should NOT preventDefault (allowed to scroll)
        assert.strictEqual(dispatchTouchMove(child), false);

        // Touch on workspace-view itself -> Should NOT preventDefault (allowed to scroll)
        assert.strictEqual(dispatchTouchMove(workspaceView), false);

        // Touch on child inside clarification-popover -> Should NOT preventDefault (allowed to scroll)
        assert.strictEqual(dispatchTouchMove(popoverChild), false);

        // Touch on clarification-popover itself -> Should NOT preventDefault (allowed to scroll)
        assert.strictEqual(dispatchTouchMove(popover), false);

        // Touch on other blocked element -> SHOULD preventDefault (scrolling blocked)
        assert.strictEqual(dispatchTouchMove(otherEl), true);
    });
});

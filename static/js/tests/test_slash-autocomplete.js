import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const autocompleteCode = fs.readFileSync(path.resolve(__dirname, '../slash-autocomplete.js'), 'utf8');

describe('slash-autocomplete.js', () => {
    let window;
    let document;
    let textarea;
    let dropdown;

    test('setup mock DOM and load script', () => {
        const dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div class="input-container">
                    <div id="slash-commands-autocomplete" class="hidden"></div>
                    <textarea id="chat-textarea"></textarea>
                </div>
            </body>
            </html>
        `, { runScripts: "dangerously" });
        
        window = dom.window;
        document = window.document;

        // Mock SkillsManager
        window.SkillsManager = {
            skills: [
                { id: '1', name: 'git-helper', description: 'Git helper description', instructions: 'git instructions' },
                { id: '2', name: 'python-debug', description: 'Python debugger helper', instructions: 'python instructions' }
            ]
        };

        // Inject script
        const scriptEl = document.createElement("script");
        scriptEl.textContent = autocompleteCode;
        document.body.appendChild(scriptEl);

        textarea = document.getElementById("chat-textarea");
        dropdown = document.getElementById("slash-commands-autocomplete");

        window.SlashAutocomplete.init();
    });

    test('SlashAutocomplete is registered on window', () => {
        assert.ok(window.SlashAutocomplete);
    });

    test('shows autocomplete list when typing / as first character', () => {
        textarea.value = "/";
        
        // Trigger input event
        const inputEvent = new window.Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        // Check if open
        assert.strictEqual(window.SlashAutocomplete.isOpen, true);
        assert.strictEqual(dropdown.classList.contains("hidden"), false);

        // Should render 4 items: /help, /skills, /git-helper, /python-debug
        const items = dropdown.querySelectorAll(".slash-autocomplete-item");
        assert.strictEqual(items.length, 4);
        
        // First item should be /help
        assert.strictEqual(items[0].querySelector(".command-trigger").textContent, "/help");
        // Third item should be /git-helper
        assert.strictEqual(items[2].querySelector(".command-trigger").textContent, "/git-helper");
    });

    test('filters list based on typed query', () => {
        textarea.value = "/git";
        
        const inputEvent = new window.Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        assert.strictEqual(window.SlashAutocomplete.isOpen, true);
        
        const items = dropdown.querySelectorAll(".slash-autocomplete-item");
        // Should only match /git-helper
        assert.strictEqual(items.length, 1);
        assert.strictEqual(items[0].querySelector(".command-trigger").textContent, "/git-helper");
    });

    test('closes when typing space', () => {
        textarea.value = "/git-helper ";
        
        const inputEvent = new window.Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        assert.strictEqual(window.SlashAutocomplete.isOpen, false);
        assert.strictEqual(dropdown.classList.contains("hidden"), true);
    });

    test('closes when no matching commands found', () => {
        textarea.value = "/xyz";
        
        const inputEvent = new window.Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        assert.strictEqual(window.SlashAutocomplete.isOpen, false);
        assert.strictEqual(dropdown.classList.contains("hidden"), true);
    });

    test('keyboard navigation ArrowDown and ArrowUp', () => {
        textarea.value = "/";
        
        const inputEvent = new window.Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        assert.strictEqual(window.SlashAutocomplete.activeIndex, 0);

        // Press ArrowDown
        const arrowDownEvent = new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
        textarea.dispatchEvent(arrowDownEvent);
        assert.strictEqual(window.SlashAutocomplete.activeIndex, 1);

        // Press ArrowDown again
        textarea.dispatchEvent(arrowDownEvent);
        assert.strictEqual(window.SlashAutocomplete.activeIndex, 2);

        // Press ArrowUp
        const arrowUpEvent = new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
        textarea.dispatchEvent(arrowUpEvent);
        assert.strictEqual(window.SlashAutocomplete.activeIndex, 1);
    });

    test('selects item on Enter', () => {
        textarea.value = "/";
        
        const inputEvent = new window.Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        // Navigate to /skills (index 1)
        const arrowDownEvent = new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
        textarea.dispatchEvent(arrowDownEvent);
        assert.strictEqual(window.SlashAutocomplete.activeIndex, 1);

        // Press Enter
        const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        textarea.dispatchEvent(enterEvent);

        // Value should be skills plus space
        assert.strictEqual(textarea.value, "/skills ");
        // Autocomplete should be closed
        assert.strictEqual(window.SlashAutocomplete.isOpen, false);
    });

    test('selects item on Tab', () => {
        textarea.value = "/";
        
        const inputEvent = new window.Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        // Navigate to /skills (index 1)
        const arrowDownEvent = new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
        textarea.dispatchEvent(arrowDownEvent);
        assert.strictEqual(window.SlashAutocomplete.activeIndex, 1);

        // Press Tab
        const tabEvent = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
        textarea.dispatchEvent(tabEvent);

        // Value should be skills plus space
        assert.strictEqual(textarea.value, "/skills ");
        // Autocomplete should be closed
        assert.strictEqual(window.SlashAutocomplete.isOpen, false);
    });

    test('closes on Escape', () => {
        textarea.value = "/";
        
        const inputEvent = new window.Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        assert.strictEqual(window.SlashAutocomplete.isOpen, true);

        // Press Escape
        const escEvent = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        textarea.dispatchEvent(escEvent);

        assert.strictEqual(window.SlashAutocomplete.isOpen, false);
    });

    test('initializes backdrop wrapper and element', () => {
        const wrapper = document.querySelector('.chat-textarea-wrapper');
        const backdrop = document.getElementById('chat-textarea-backdrop');
        assert.ok(wrapper, 'chat-textarea-wrapper should exist');
        assert.ok(backdrop, 'chat-textarea-backdrop should exist');
        assert.strictEqual(textarea.parentNode, wrapper, 'textarea should be child of wrapper');
        assert.strictEqual(backdrop.parentNode, wrapper, 'backdrop should be child of wrapper');
    });

    test('highlights skill trigger in textarea backdrop', () => {
        textarea.value = '/git-helper status';
        // Trigger input event to sync
        const inputEvent = new window.Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        const backdrop = document.getElementById('chat-textarea-backdrop');
        const highlight = backdrop.querySelector('.skill-highlight-input');
        assert.ok(highlight, 'Should find skill-highlight-input');
        assert.strictEqual(highlight.textContent, '/git-helper');
    });

    test('highlights multiple known skills anywhere in textarea', () => {
        textarea.value = 'Checkout /skills or ask /help';
        const inputEvent = new window.Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        const backdrop = document.getElementById('chat-textarea-backdrop');
        const highlights = backdrop.querySelectorAll('.skill-highlight-input');
        assert.strictEqual(highlights.length, 2, 'Should find two highlighted commands');
        assert.strictEqual(highlights[0].textContent, '/skills');
        assert.strictEqual(highlights[1].textContent, '/help');
    });

    test('updates backdrop on programmatic value change', () => {
        textarea.value = '/git-helper programmatic';
        const backdrop = document.getElementById('chat-textarea-backdrop');
        const highlight = backdrop.querySelector('.skill-highlight-input');
        assert.ok(highlight, 'Should find skill-highlight-input after programmatic set');
        assert.strictEqual(highlight.textContent, '/git-helper');
    });

    test('syncs scroll offset on scroll event', () => {
        textarea.scrollTop = 42;
        textarea.scrollLeft = 24;
        const scrollEvent = new window.Event('scroll', { bubbles: true });
        textarea.dispatchEvent(scrollEvent);

        const backdrop = document.getElementById('chat-textarea-backdrop');
        assert.strictEqual(backdrop.scrollTop, 42, 'Backdrop scrollTop should sync');
        assert.strictEqual(backdrop.scrollLeft, 24, 'Backdrop scrollLeft should sync');
    });
});

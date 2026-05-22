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
});

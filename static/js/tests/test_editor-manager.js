import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const editorManagerCode = fs.readFileSync(path.resolve(__dirname, '../editor-manager.js'), 'utf8');

describe('editor-manager.js', () => {
    let window;
    let document;

    test('setup', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <div id="file-system-codemirror-container"></div>
            <div id="file-system-preview-container"></div>
        </body></html>`, { runScripts: "dangerously" });
        
        window = dom.window;
        document = window.document;
        
        window.formatMarkdown = (text) => text;

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = editorManagerCode;
        window.document.body.appendChild(scriptEl);
    });

    test('EditorManager initializes and attaches to DOM', async () => {
        assert.ok(window.EditorManager);

        // We mock the loadCodeMirror function since we don't have the esbuild bundle in the node test env
        window.EditorManager.loadCodeMirror = async () => {
            window.EditorManager._cmView = class MockEditor {
                constructor({parent}) {
                    this.parent = parent;
                    this.state = { doc: { length: 12, toString: () => "test content" } };
                    this.dispatchedEffects = [];
                }
                dispatch(transaction) {
                    this.dispatched = transaction;
                    if (transaction.effects) {
                        this.dispatchedEffects.push(transaction.effects);
                    }
                }
                static updateListener = { of: () => ({}) };
            };
            window.EditorManager._cmState = {
                create: () => ({}),
                readOnly: { of: (val) => `readOnly:${val}` }
            };
            window.EditorManager._cmThemeCompartment = { of: () => ({}), reconfigure: (val) => `theme:${val}` };
            window.EditorManager._cmLanguageCompartment = { of: () => ({}), reconfigure: (val) => `lang:${val}` };
            window.EditorManager._cmReadOnlyCompartment = { of: () => ({}), reconfigure: (val) => `readOnlyComp:${val}` };
            window.EditorManager._cmStyleCompartment = { of: () => ({}), reconfigure: (val) => `style:${val}` };
            window.EditorManager._cmOneDarkTheme = "oneDarkThemeMock";
        };

        let content = "test content";
        
        await window.EditorManager.init({
            getContent: () => content,
            setContent: (c) => { content = c; },
            getFileId: () => "file-123"
        });

        assert.ok(window.fileSystemEditor);
        assert.strictEqual(window.fileSystemEditor.parent.id, "file-system-codemirror-container");
    });

    test('setEditorContent dispatches changes to editor', () => {
        window.EditorManager.setEditorContent("new content");
        assert.ok(window.fileSystemEditor.dispatched);
        assert.strictEqual(window.fileSystemEditor.dispatched.changes.insert, "new content");
    });

    test('updateTheme dispatches theme reconfiguration', () => {
        window.fileSystemEditor.dispatchedEffects = [];
        window.EditorManager.updateTheme(true);
        assert.deepStrictEqual(window.fileSystemEditor.dispatchedEffects, ["theme:oneDarkThemeMock"]);
    });

    test('setReadOnly dispatches readOnly reconfiguration', () => {
        window.fileSystemEditor.dispatchedEffects = [];
        window.EditorManager.setReadOnly(true);
        assert.deepStrictEqual(window.fileSystemEditor.dispatchedEffects, ["readOnlyComp:readOnly:true"]);
    });

    test('setLanguage dispatches language reconfiguration', async () => {
        window.fileSystemEditor.dispatchedEffects = [];
        window.EditorManager._cmMarkdown = (opts) => `markdownMode`;
        await window.EditorManager.setLanguage(".md");
        assert.deepStrictEqual(window.fileSystemEditor.dispatchedEffects, ["style:", "lang:markdownMode"]);
    });

    test('renderPreview outputs markdown', () => {
        window.EditorManager.renderPreview("# Hello", "markdown");
        const container = document.getElementById("file-system-preview-container");
        assert.ok(container.innerHTML.includes("# Hello"));
    });

    test('renderPreview outputs HTML iframe safely', () => {
        window.EditorManager.renderPreview("<h1>Hello HTML</h1>", "html");
        const container = document.getElementById("file-system-preview-container");
        const iframe = container.querySelector('iframe');
        assert.ok(iframe);
    });
});

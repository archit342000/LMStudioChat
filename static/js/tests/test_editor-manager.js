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
                }
                static updateListener = { of: () => ({}) };
            };
            window.EditorManager._cmState = {
                create: () => ({}),
                readOnly: { of: () => ({}) }
            };
            window.EditorManager._cmThemeCompartment = { of: () => ({}), reconfigure: () => ({}) };
            window.EditorManager._cmLanguageCompartment = { of: () => ({}), reconfigure: () => ({}) };
            window.EditorManager._cmReadOnlyCompartment = { of: () => ({}), reconfigure: () => ({}) };
            window.EditorManager._cmStyleCompartment = { of: () => ({}), reconfigure: () => ({}) };
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

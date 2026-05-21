import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const constantsPath = path.resolve(__dirname, '../constants.js');
const constantsCode = fs.readFileSync(constantsPath, 'utf8');

describe('constants.js', () => {
    let window;

    test('setup', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { runScripts: "dangerously" });
        window = dom.window;

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = constantsCode;
        window.document.body.appendChild(scriptEl);
    });

    test('API_BASE and API_MODULES are defined', () => {
        assert.strictEqual(window.eval('API_BASE'), '/api');
        const modules = window.eval('API_MODULES');
        assert.ok(modules);
        assert.strictEqual(modules.CHATS, '/api/chats');
        assert.strictEqual(modules.LOGS, '/api/logs');
    });

    test('TOOL_DISPLAY_CONFIG is defined and contains tools', () => {
        const config = window.eval('TOOL_DISPLAY_CONFIG');
        assert.ok(config);
        assert.ok(config.grep_search);
        assert.strictEqual(config.grep_search.name, 'Search Code');
        assert.ok(config.grep_search.icon.includes('<svg'));
        
        // Check another tool
        assert.ok(config.write_file);
        assert.strictEqual(config.write_file.name, 'Save File');
    });
});

import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsPath = path.resolve(__dirname, '../icons.js');
const iconsCode = fs.readFileSync(iconsPath, 'utf8');

describe('icons.js', () => {
    let dom;
    let window;
    
    test('setup', () => {
        dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { runScripts: "dangerously" });
        window = dom.window;

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = iconsCode;
        window.document.body.appendChild(scriptEl);
    });

    test('getAgentIcon - research', () => {
        const getAgentIcon = window.getAgentIcon;
        const icon = getAgentIcon('research');
        assert.ok(icon.includes('<svg'));
        assert.ok(icon.includes('circle cx="11"')); // specific to research icon
    });

    test('getAgentIcon - file_system_agent', () => {
        const getAgentIcon = window.getAgentIcon;
        const icon = getAgentIcon('file_system_agent');
        assert.ok(icon.includes('<svg'));
        assert.ok(icon.includes('m12 3-1.912')); // specific to file system icon
    });

    test('getAgentIcon - default', () => {
        const getAgentIcon = window.getAgentIcon;
        const icon = getAgentIcon('unknown_agent');
        assert.ok(icon.includes('<svg'));
        assert.ok(icon.includes('M12 8V4H8')); // specific to default icon
    });
    
    test('getAgentIcon - handles null/undefined', () => {
        const getAgentIcon = window.getAgentIcon;
        const icon = getAgentIcon(null);
        assert.ok(icon.includes('<svg'));
        assert.ok(icon.includes('M12 8V4H8')); // defaults
    });

    test('getWorkspaceIconSvg - returns valid svg', () => {
        const getWorkspaceIconSvg = window.getWorkspaceIconSvg;
        const icon = getWorkspaceIconSvg('code');
        assert.ok(icon.includes('<svg'));
        assert.ok(icon.includes('polyline points="16 18')); // specific to code paths
    });

    test('getWorkspaceIconHtml - returns SVG for workspace icon in registry', () => {
        const getWorkspaceIconHtml = window.getWorkspaceIconHtml;
        const iconHtml = getWorkspaceIconHtml('code');
        assert.ok(iconHtml.includes('<svg'));
    });

    test('getWorkspaceIconHtml - returns text span fallback for legacy/emojis', () => {
        const getWorkspaceIconHtml = window.getWorkspaceIconHtml;
        const iconHtml = getWorkspaceIconHtml('💼');
        assert.ok(iconHtml.includes('<span'));
        assert.ok(iconHtml.includes('💼'));
    });

    test('getWorkspaceIconHtml - returns default grid SVG if empty/null', () => {
        const getWorkspaceIconHtml = window.getWorkspaceIconHtml;
        const iconHtml = getWorkspaceIconHtml(null);
        assert.ok(iconHtml.includes('<svg'));
        assert.ok(iconHtml.includes('rect x="3"')); // grid
    });
});

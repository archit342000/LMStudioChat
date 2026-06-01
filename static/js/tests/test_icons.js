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

        const coffeeIcon = getWorkspaceIconSvg('coffee');
        assert.ok(coffeeIcon.includes('<svg'));
        assert.ok(coffeeIcon.includes('M2 8h16v9')); // specific to coffee paths

        const gitIcon = getWorkspaceIconSvg('git-branch');
        assert.ok(gitIcon.includes('<svg'));
        assert.ok(gitIcon.includes('circle cx="18"')); // git-branch path

        const activityIcon = getWorkspaceIconSvg('activity');
        assert.ok(activityIcon.includes('<svg'));
        assert.ok(activityIcon.includes('polyline points="22 12')); // activity path

        const playIcon = getWorkspaceIconSvg('play');
        assert.ok(playIcon.includes('<svg'));
        assert.ok(playIcon.includes('points="5 3 19 12 5 21 5 3"')); // play polygon path

        const cartIcon = getWorkspaceIconSvg('shopping-cart');
        assert.ok(cartIcon.includes('<svg'));
        assert.ok(cartIcon.includes('circle cx="9" cy="21"')); // shopping-cart circle path

        const moonIcon = getWorkspaceIconSvg('moon');
        assert.ok(moonIcon.includes('<svg'));
        assert.ok(moonIcon.includes('M21 12.79A9 9')); // moon path

        const wifiIcon = getWorkspaceIconSvg('wifi');
        assert.ok(wifiIcon.includes('<svg'));
        assert.ok(wifiIcon.includes('line x1="12" y1="20"')); // wifi line path

        const umbrellaIcon = getWorkspaceIconSvg('umbrella');
        assert.ok(umbrellaIcon.includes('<svg'));
        assert.ok(umbrellaIcon.includes('M23 12a11.02')); // umbrella path

        const fileIcon = getWorkspaceIconSvg('file');
        assert.ok(fileIcon.includes('<svg'));
        assert.ok(fileIcon.includes('M13 2H6a2')); // file path

        const smileIcon = getWorkspaceIconSvg('smile');
        assert.ok(smileIcon.includes('<svg'));
        assert.ok(smileIcon.includes('M8 14s1.5 2')); // smile path

        const ghostIcon = getWorkspaceIconSvg('ghost');
        assert.ok(ghostIcon.includes('<svg'));
        assert.ok(ghostIcon.includes('M9 10h.01')); // ghost path (lowercase/uppercase normalization checks)

        const sparklesIcon = getWorkspaceIconSvg('sparkles');
        assert.ok(sparklesIcon.includes('<svg'));
        assert.ok(sparklesIcon.includes('m12 3-1.912')); // sparkles path

        const pizzaIcon = getWorkspaceIconSvg('pizza');
        assert.ok(pizzaIcon.includes('<svg'));
        assert.ok(pizzaIcon.includes('M15 11h.01')); // pizza path

        const dumbbellIcon = getWorkspaceIconSvg('dumbbell');
        assert.ok(dumbbellIcon.includes('<svg'));
        assert.ok(dumbbellIcon.includes('rect x="6" y="10"')); // dumbbell bar path

        const utensilsIcon = getWorkspaceIconSvg('utensils');
        assert.ok(utensilsIcon.includes('<svg'));
        assert.ok(utensilsIcon.includes('M3 2v7')); // utensils path

        const treePineIcon = getWorkspaceIconSvg('tree-pine');
        assert.ok(treePineIcon.includes('<svg'));
        assert.ok(treePineIcon.includes('m12 19 8-6')); // tree-pine path
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

import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bgPath = path.resolve(__dirname, '../bg-animation.js');
const bgCode = fs.readFileSync(bgPath, 'utf8');

describe('bg-animation.js', () => {
    test('initializes without error', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body><canvas id="bg-stars"></canvas></body></html>`, { runScripts: "dangerously" });
        const window = dom.window;
        
        window.HTMLCanvasElement.prototype.getContext = function () {
            return {
                scale: () => {},
                clearRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {}
            };
        };
        
        window.requestAnimationFrame = () => {};

        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = bgCode;
        window.document.body.appendChild(scriptEl);
        
        const event = new window.Event('DOMContentLoaded');
        window.document.dispatchEvent(event);
        
        assert.ok(true);
    });
});

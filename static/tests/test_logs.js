import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticPath = path.resolve(__dirname, '../');

const loadFile = (relPath) => fs.readFileSync(path.resolve(staticPath, relPath), 'utf8');

const getWindow = () => {
    const htmlContent = loadFile('logs.html');
    const dom = new JSDOM(htmlContent, { 
        runScripts: "dangerously",
        url: "http://localhost/",
        beforeParse(window) {
            window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
            window.fetch = () => new Promise(() => {});
        }
    });
    return dom.window;
};

describe('logs.html', () => {
    test('cleanLogString truncates base64 data url', () => {
        const window = getWindow();
        const cleanLogString = window.cleanLogString;
        assert.ok(cleanLogString, "cleanLogString should be defined");

        const dataUrlStr = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC80lEQVR4nO2YTUgUURSAv8cZnUzMTMrKTDOUKDGICCpKCsIIoigIokiKIEIiKIIoCIKoCIoiCIoiiIiIiCIoioiIiCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqKiKgg/q/gD8dZ6E1s1n1gAAAABJRU5ErkJggg==";
        const cleaned = cleanLogString(dataUrlStr);
        assert.ok(cleaned.includes('[TRUNCATED BASE64 (Length:'));
        assert.ok(cleaned.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAA'));
    });

    test('cleanLogString truncates raw base64 string', () => {
        const window = getWindow();
        const cleanLogString = window.cleanLogString;
        const rawBase64 = "iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC80lEQVR4nO2YTUgUURSAv8cZnUzMTMrKTDOUKDGICCpKCsIIoigIokiKIEIiKIIoCIKoCIoiCIoiiIiIiCIoioiIiCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqKiKgg";
        const cleaned = cleanLogString(rawBase64);
        assert.ok(cleaned.includes('[TRUNCATED BASE64 (Length:'));
        assert.ok(cleaned.startsWith('iVBORw0KGgoAAAANSUhEUgAAADIAAA'));
    });

    test('cleanLogString does not truncate short strings', () => {
        const window = getWindow();
        const cleanLogString = window.cleanLogString;
        const shortStr = "This is a short string of letters, numbers, etc.";
        const cleaned = cleanLogString(shortStr);
        assert.strictEqual(cleaned, shortStr);
    });

    test('escapeHtml applies cleanLogString and escapes html', () => {
        const window = getWindow();
        const escapeHtml = window.escapeHtml;
        assert.ok(escapeHtml, "escapeHtml should be defined");

        const raw = '<div>Some standard div data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC80lEQVR4nO2YTUgUURSAv8cZnUzMTMrKTDOUKDGICCpKCsIIoigIokiKIEIiKIIoCIKoCIoiCIoiiIiIiCIoioiIiCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqiKMqKqCiiKCKioiiKoiiKiIiiKIqKiKgg/q/gD8dZ6E1s1n1gAAAABJRU5ErkJggg== and another part</div>';
        const escapedAndCleaned = escapeHtml(raw);
        assert.ok(escapedAndCleaned.includes('&lt;div&gt;'));
        assert.ok(escapedAndCleaned.includes('[TRUNCATED BASE64 (Length:'));
    });
});

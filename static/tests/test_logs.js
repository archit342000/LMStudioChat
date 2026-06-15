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

    test('renderDualPane and toggleLlmOutput for LLM logs', () => {
        const window = getWindow();
        const document = window.document;

        // Mock window.hljs
        window.hljs = { highlightElement: () => {} };

        const renderDualPane = window.renderDualPane;
        assert.ok(renderDualPane, "renderDualPane should be defined");

        const toggleLlmOutput = window.toggleLlmOutput;
        assert.ok(toggleLlmOutput, "toggleLlmOutput should be defined");

        // Set up test data
        const title = "Nemotron";
        const time = "12:00:00";
        const duration = 1.5;
        const mode = "stream";
        const req = { model: "nemotron" };
        const res = "[Reasoning]\nThinking...\n[Content]\nClean output";
        const timings = { prompt_n: 10 };
        const toolCalls = [{"name": "tool1"}];

        // Render dual pane for category 'llm'
        renderDualPane(title, time, duration, mode, req, res, timings, toolCalls, "llm", "Clean output", {"raw": "data"});

        // Verify segmented control and buttons are rendered
        const segmentedControl = document.querySelector('.segmented-control');
        assert.ok(segmentedControl, "Segmented control should be rendered for LLM calls");

        const parsedBtn = document.querySelector('.control-btn[data-type="parsed"]');
        const rawBtn = document.querySelector('.control-btn[data-type="raw"]');
        assert.ok(parsedBtn, "Parsed button should exist");
        assert.ok(rawBtn, "Raw button should exist");

        // Verify tool-calls-container is rendered and visible initially
        const tcContainer = document.getElementById('tool-calls-container');
        assert.ok(tcContainer, "Tool calls container should be rendered");
        assert.strictEqual(tcContainer.style.display, "", "Should be visible initially");

        // Verify initial view is Parsed (Clean output)
        const resCode = document.getElementById('res-code');
        assert.strictEqual(resCode.textContent, "Clean output");
        assert.ok(parsedBtn.classList.contains('active'), "Parsed button should be active initially");

        // Toggle to raw
        toggleLlmOutput("raw");
        assert.ok(rawBtn.classList.contains('active'), "Raw button should be active");
        assert.ok(!parsedBtn.classList.contains('active'), "Parsed button should not be active");
        assert.strictEqual(tcContainer.style.display, "none", "Tool calls container should be hidden in Raw view");

        // Raw output should be JSON representation of {"raw": "data"}
        const rawJson = JSON.parse(resCode.textContent);
        assert.deepStrictEqual(rawJson, {"raw": "data"});

        // Toggle back to parsed
        toggleLlmOutput("parsed");
        assert.strictEqual(resCode.textContent, "Clean output");
        assert.ok(parsedBtn.classList.contains('active'), "Parsed button should be active again");
        assert.strictEqual(tcContainer.style.display, "", "Tool calls container should be visible in Parsed view again");
    });
});

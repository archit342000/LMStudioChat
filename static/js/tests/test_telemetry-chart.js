import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const telemetryCode = fs.readFileSync(path.resolve(__dirname, '../telemetry-chart.js'), 'utf8');

describe('telemetry-chart.js', () => {
    let window;
    let document;
    let mockFetchCalls = [];
    let mockFetchResponse = null;
    let mockFetchError = false;
    let systemSettingsClosed = false;

    // Canvas mock stubs
    let canvasWidth = 400;
    let canvasHeight = 200;
    let canvasCalls = [];

    test('setup JSDOM environment', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <button id="sys-test-model-speed"></button>
            <div id="test-model-speed-modal" class="modal-backdrop" style="display: none;"></div>
            <button id="close-test-model-speed"></button>
            <button id="run-model-speed-test"></button>
            <select id="test-speed-model-select"></select>
            <input id="test-speed-context-slider" type="range" min="512" max="32768" value="2048" />
            <span id="test-speed-context-val">2048</span>
            <div id="telemetry-dashboard-modal" class="modal-backdrop" style="display: none;"></div>
            <button id="close-telemetry-dashboard"></button>
            <span id="telemetry-model-name"></span>
            <canvas id="telemetry-chart"></canvas>
            <span id="test-speed-status"></span>
            <span id="test-speed-tokens-gen"></span>
            <span id="test-speed-ttft"></span>
            <span id="test-speed-prefill-tps"></span>
            <span id="test-speed-current-tps"></span>
            <button id="stop-model-speed-test" style="display: none;"></button>
        </body></html>`, { runScripts: "dangerously" });

        window = dom.window;
        document = window.document;

        // Mock window devicePixelRatio
        window.devicePixelRatio = 2;

        // Mock showToast globally
        window.showToast = (msg, type) => {
            window.lastToast = { msg, type };
        };

        // Mock Canvas getContext
        const mockContext2d = {
            scale: (x, y) => canvasCalls.push({ name: 'scale', args: [x, y] }),
            clearRect: (x, y, w, h) => canvasCalls.push({ name: 'clearRect', args: [x, y, w, h] }),
            beginPath: () => canvasCalls.push({ name: 'beginPath', args: [] }),
            moveTo: (x, y) => canvasCalls.push({ name: 'moveTo', args: [x, y] }),
            lineTo: (x, y) => canvasCalls.push({ name: 'lineTo', args: [x, y] }),
            stroke: () => canvasCalls.push({ name: 'stroke', args: [] }),
            fill: () => canvasCalls.push({ name: 'fill', args: [] }),
            arc: (x, y, r, sa, ea) => canvasCalls.push({ name: 'arc', args: [x, y, r, sa, ea] }),
            fillText: (text, x, y) => canvasCalls.push({ name: 'fillText', args: [text, x, y] }),
            createLinearGradient: (x1, y1, x2, y2) => {
                canvasCalls.push({ name: 'createLinearGradient', args: [x1, y1, x2, y2] });
                return {
                    addColorStop: (offset, color) => canvasCalls.push({ name: 'addColorStop', args: [offset, color] })
                };
            },
            lineWidth: 1,
            font: '',
            fillStyle: '',
            strokeStyle: '',
            textAlign: '',
            textBaseline: '',
            shadowBlur: 0,
            shadowColor: '',
            lineCap: '',
            lineJoin: ''
        };

        const canvasEl = document.getElementById('telemetry-chart');
        canvasEl.getBoundingClientRect = () => ({
            width: canvasWidth,
            height: canvasHeight,
            top: 0,
            left: 0,
            bottom: canvasHeight,
            right: canvasWidth
        });
        canvasEl.getContext = (type) => {
            if (type === '2d') return mockContext2d;
            return null;
        };

        // Mock fetch
        window.fetch = async (url, options) => {
            mockFetchCalls.push({ url, options });
            if (mockFetchError) {
                throw new Error("Network Error");
            }
            return mockFetchResponse;
        };

        // Inject script
        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = telemetryCode;
        window.document.body.appendChild(scriptEl);
    });

    test('verifies structure and API exports', () => {
        assert.ok(window.TelemetryChart);
        assert.strictEqual(typeof window.TelemetryChart.init, 'function');
        assert.strictEqual(typeof window.TelemetryChart.setupListeners, 'function');
        assert.strictEqual(typeof window.TelemetryChart.fetchModelsForDropdown, 'function');
        assert.strictEqual(typeof window.TelemetryChart.drawTelemetryChart, 'function');
        assert.strictEqual(typeof window.TelemetryChart.runModelSpeedTest, 'function');
        assert.strictEqual(typeof window.TelemetryChart.stopModelSpeedTest, 'function');
    });

    test('initializes elements, config, and click listeners', async () => {
        systemSettingsClosed = false;
        mockFetchCalls = [];
        mockFetchResponse = {
            ok: true,
            json: async () => ({
                research: { m1: 'llama-research-model' },
                general: { m2: 'llama-general-model' }
            })
        };

        window.TelemetryChart.init({
            closeSystemSettings: () => { systemSettingsClosed = true; }
        });

        // Trigger sysTestModelSpeedBtn click
        const btn = document.getElementById('sys-test-model-speed');
        const modal = document.getElementById('test-model-speed-modal');
        btn.click();

        assert.strictEqual(systemSettingsClosed, true);
        assert.strictEqual(modal.style.display, 'flex');

        // Wait for async fetchModelsForDropdown
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.ok(mockFetchCalls.some(c => c.url === '/api/models/config'));
        const select = document.getElementById('test-speed-model-select');
        assert.strictEqual(select.options.length, 2);
        assert.strictEqual(select.options[0].value, 'llama-research-model');
        assert.strictEqual(select.options[1].value, 'llama-general-model');
    });

    test('updates context slider text on input', () => {
        const slider = document.getElementById('test-speed-context-slider');
        const valText = document.getElementById('test-speed-context-val');

        slider.value = 4096;
        slider.dispatchEvent(new window.Event('input', { bubbles: true }));

        assert.strictEqual(valText.textContent, '4096');
    });

    test('closes model speed test modal correctly', () => {
        const modal = document.getElementById('test-model-speed-modal');
        modal.classList.add('open');
        modal.style.display = 'flex';

        const closeBtn = document.getElementById('close-test-model-speed');
        closeBtn.click();

        assert.ok(!modal.classList.contains('open'));
    });

    test('closes telemetry dashboard modal correctly', () => {
        const modal = document.getElementById('telemetry-dashboard-modal');
        modal.classList.add('open');
        modal.style.display = 'flex';

        const closeBtn = document.getElementById('close-telemetry-dashboard');
        closeBtn.click();

        assert.ok(!modal.classList.contains('open'));
    });

    test('drawing chart executes canvas 2D context drawing commands', () => {
        canvasCalls = [];
        window.TelemetryChart.telemetryDataPoints = [
            { tokens: 100, tps: 15 },
            { tokens: 200, tps: 25 },
            { tokens: 300, tps: 20 }
        ];

        window.TelemetryChart.drawTelemetryChart();

        // Canvas element should have high-DPI width and height set
        const canvasEl = document.getElementById('telemetry-chart');
        assert.strictEqual(canvasEl.width, canvasWidth * window.devicePixelRatio);
        assert.strictEqual(canvasEl.height, canvasHeight * window.devicePixelRatio);

        // Verify canvas scale and draw commands are dispatched
        assert.ok(canvasCalls.some(c => c.name === 'scale'));
        assert.ok(canvasCalls.some(c => c.name === 'clearRect'));
        assert.ok(canvasCalls.some(c => c.name === 'beginPath'));
        assert.ok(canvasCalls.some(c => c.name === 'lineTo'));
        assert.ok(canvasCalls.some(c => c.name === 'stroke'));
        assert.ok(canvasCalls.some(c => c.name === 'fill'));
        assert.ok(canvasCalls.some(c => c.name === 'arc'));
    });

    test('runs speed test and processes custom streaming SSE responses', async () => {
        mockFetchCalls = [];
        window.lastToast = null;

        // Populate dropdown and select model
        const select = document.getElementById('test-speed-model-select');
        select.value = 'llama-research-model';

        // Prepare chunk data
        const streamChunks = [
            'data: {"test_status": "Starting Turn 1"}\n',
            'data: {"choices": [{"delta": {"content": "Hello"}}]}\n',
            'data: {"timings": {"prompt_ms": 100.0, "prompt_n": 10, "predicted_ms": 500.0, "predicted_n": 20}, "usage": {"total_tokens": 30}}\n',
            'data: [DONE]\n'
        ];

        let chunkIdx = 0;
        const reader = {
            read: async () => {
                if (chunkIdx >= streamChunks.length) {
                    return { done: true, value: undefined };
                }
                const chunk = streamChunks[chunkIdx++];
                return { done: false, value: new TextEncoder().encode(chunk) };
            }
        };

        mockFetchResponse = {
            ok: true,
            body: {
                getReader: () => reader
            }
        };

        const statusText = document.getElementById('test-speed-status');
        const ttftText = document.getElementById('test-speed-ttft');
        const prefillTpsText = document.getElementById('test-speed-prefill-tps');
        const currentTpsText = document.getElementById('test-speed-current-tps');
        const tokensGenText = document.getElementById('test-speed-tokens-gen');

        await window.TelemetryChart.runModelSpeedTest();

        // Check fetch payload
        assert.strictEqual(mockFetchCalls.length, 1);
        assert.strictEqual(mockFetchCalls[0].url, '/api/models/test-speed');
        const payload = JSON.parse(mockFetchCalls[0].options.body);
        assert.strictEqual(payload.model, 'llama-research-model');

        // Check computed SSE telemetry diagnostics
        assert.strictEqual(statusText.textContent, 'Completed');
        assert.strictEqual(ttftText.textContent, '100'); // prompt_ms
        assert.strictEqual(prefillTpsText.textContent, '100.00'); // 10 / (100ms / 1000)
        assert.strictEqual(currentTpsText.textContent, '40.00'); // 20 / (500ms / 1000)
        assert.strictEqual(tokensGenText.textContent, '30'); // usage.total_tokens

        // Check data point pushed to charting array
        assert.strictEqual(window.TelemetryChart.telemetryDataPoints.length, 1);
        assert.strictEqual(window.TelemetryChart.telemetryDataPoints[0].tokens, 30);
        assert.strictEqual(window.TelemetryChart.telemetryDataPoints[0].tps, 40);
    });

    test('handles speed test API error gracefully', async () => {
        mockFetchCalls = [];
        mockFetchResponse = {
            ok: false,
            json: async () => ({ error: "Model load timeout" })
        };

        const statusText = document.getElementById('test-speed-status');
        const currentTpsText = document.getElementById('test-speed-current-tps');

        await window.TelemetryChart.runModelSpeedTest();

        assert.strictEqual(statusText.textContent, 'Failed');
        assert.strictEqual(statusText.style.color, 'var(--color-rose-500)');
        assert.strictEqual(currentTpsText.textContent, 'Model load timeout');
    });

    test('aborts speed test and handles AbortError correctly', async () => {
        mockFetchCalls = [];
        const select = document.getElementById('test-speed-model-select');
        select.value = 'llama-research-model';

        const stopBtn = document.getElementById('stop-model-speed-test');
        const statusText = document.getElementById('test-speed-status');

        let originalFetch = window.fetch;

        let signal;
        window.fetch = async (url, options) => {
            mockFetchCalls.push({ url, options });
            signal = options.signal;
            
            if (signal && signal.aborted) {
                const err = new Error('The user aborted a request.');
                err.name = 'AbortError';
                throw err;
            }

            return new Promise((resolve, reject) => {
                const onAbort = () => {
                    const err = new Error('The user aborted a request.');
                    err.name = 'AbortError';
                    reject(err);
                };
                if (signal) {
                    signal.addEventListener('abort', onAbort);
                }
                setTimeout(() => {
                    if (signal) {
                        signal.removeEventListener('abort', onAbort);
                    }
                    resolve({
                        ok: true,
                        body: {
                            getReader: () => ({
                                read: async () => {
                                    if (signal && signal.aborted) {
                                        const err = new Error('The user aborted a request.');
                                        err.name = 'AbortError';
                                        throw err;
                                    }
                                    return { done: true, value: undefined };
                                }
                            })
                        }
                    });
                }, 50);
            });
        };

        const runPromise = window.TelemetryChart.runModelSpeedTest();

        // Verify the stop button is visible
        assert.strictEqual(stopBtn.style.display, 'block');
        assert.ok(window.TelemetryChart.testAbortController);

        // Click the stop button
        stopBtn.click();

        try {
            await runPromise;
        } catch (e) {
            // expected to throw or catch internally
        }

        // Verify status text changed to "Stopped"
        assert.strictEqual(statusText.textContent, 'Stopped');
        assert.strictEqual(statusText.style.color, 'var(--color-amber)');
        // Verify stop button is hidden and controller is null
        assert.strictEqual(stopBtn.style.display, 'none');
        assert.strictEqual(window.TelemetryChart.testAbortController, null);

        // Restore fetch
        window.fetch = originalFetch;
    });
});

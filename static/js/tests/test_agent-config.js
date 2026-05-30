import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const agentConfigCode = fs.readFileSync(path.resolve(__dirname, '../agent-config.js'), 'utf8');
const utilsCode = fs.readFileSync(path.resolve(__dirname, '../utils.js'), 'utf8');

describe('agent-config.js', () => {
    let window;
    let document;
    let mockFetchCalls = [];
    let mockFetchResponse = { 
        ok: true, 
        json: async () => ({
            document_agent: { thinking_profile: 'medium', max_tokens: 1000, thinking_budget: 500 },
            browsing_agent: { thinking_profile: 'low', max_tokens: 2000, thinking_budget: 1000 }
        }) 
    };
    let mockFetchError = false;
    let mockAlertCalls = [];

    const mockAlertFn = async (title, message) => {
        mockAlertCalls.push({ title, message });
    };

    test('setup JSDOM environment', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body>
            <button class="agent-config-btn" data-agent="document_agent">Doc Config</button>
            <button class="agent-config-btn" data-agent="browsing_agent">Browsing Config</button>

            <div id="agent-config-modal" style="display:none;">
                <span id="close-agent-config">Close</span>
                <h3 id="agent-config-title"></h3>
                
                <div id="agent-thinking-profile-selector">
                    <button class="profile-btn" data-profile="low">Low</button>
                    <button class="profile-btn" data-profile="medium">Medium</button>
                    <button class="profile-btn" data-profile="high">High</button>
                </div>

                <input type="range" id="agent-max-tokens-slider" min="0" max="8192">
                <span id="agent-max-tokens-val">0</span>

                <input type="range" id="agent-thinking-budget-slider" min="0" max="4096">
                <span id="agent-thinking-budget-val">0</span>

                <button id="save-agent-config">Save</button>
            </div>
        </body></html>`, { runScripts: "dangerously" });

        window = dom.window;
        document = window.document;

        // Mock fetch
        window.fetch = async (url, options) => {
            mockFetchCalls.push({ url, options });
            if (mockFetchError) {
                throw new Error("Network Error");
            }
            return mockFetchResponse;
        };

        // Inject utils script first
        const utilsScriptEl = window.document.createElement("script");
        utilsScriptEl.textContent = utilsCode;
        window.document.body.appendChild(utilsScriptEl);

        // Inject script
        const scriptEl = window.document.createElement("script");
        scriptEl.textContent = agentConfigCode;
        window.document.body.appendChild(scriptEl);
    });

    test('verifies structure and exports', () => {
        assert.ok(window.AgentConfig);
        assert.strictEqual(typeof window.AgentConfig.init, 'function');
        assert.strictEqual(typeof window.AgentConfig.fetchAgentsConfig, 'function');
        assert.strictEqual(typeof window.AgentConfig.openAgentConfig, 'function');
        assert.strictEqual(typeof window.AgentConfig.closeAgentConfig, 'function');
        assert.strictEqual(typeof window.AgentConfig.saveAgentConfig, 'function');
        assert.strictEqual(typeof window.AgentConfig.getAgentsConfig, 'function');
        assert.strictEqual(typeof window.AgentConfig.getCurrentEditingAgent, 'function');
    });

    test('initialization pulls config and registers events', async () => {
        mockFetchCalls = [];
        mockFetchError = false;
        mockAlertCalls = [];

        window.AgentConfig.init({
            showAlert: mockAlertFn
        });

        // Wait for async startup fetch
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.ok(mockFetchCalls.some(call => call.url === '/api/tools/config/agents'));
        const config = window.AgentConfig.getAgentsConfig();
        assert.ok(config.document_agent);
        assert.strictEqual(config.document_agent.thinking_profile, 'medium');
        assert.strictEqual(config.browsing_agent.thinking_profile, 'low');
    });

    test('opening config populates DOM correctly', () => {
        const modal = document.getElementById("agent-config-modal");
        assert.strictEqual(modal.style.display, 'none');

        window.AgentConfig.openAgentConfig('document_agent');

        assert.strictEqual(window.AgentConfig.getCurrentEditingAgent(), 'document_agent');
        assert.strictEqual(document.getElementById("agent-config-title").textContent, 'Document Agent');
        assert.strictEqual(document.getElementById("agent-max-tokens-slider").value, '1000');
        assert.strictEqual(document.getElementById("agent-max-tokens-val").textContent, '1000');
        assert.strictEqual(document.getElementById("agent-thinking-budget-slider").value, '500');
        assert.strictEqual(document.getElementById("agent-thinking-budget-val").textContent, '500');

        const activeBtn = document.querySelector("#agent-thinking-profile-selector .profile-btn.active");
        assert.ok(activeBtn);
        assert.strictEqual(activeBtn.dataset.profile, 'medium');
    });

    test('interacting with config elements updates state', () => {
        // Test thinking profile selection
        const lowBtn = document.querySelector("#agent-thinking-profile-selector .profile-btn[data-profile='low']");
        lowBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

        assert.strictEqual(window.AgentConfig.getAgentsConfig().document_agent.thinking_profile, 'low');
        const activeBtn = document.querySelector("#agent-thinking-profile-selector .profile-btn.active");
        assert.strictEqual(activeBtn.dataset.profile, 'low');

        // Test max tokens slider input
        const maxSlider = document.getElementById("agent-max-tokens-slider");
        maxSlider.value = '1500';
        maxSlider.dispatchEvent(new window.Event('input'));

        assert.strictEqual(window.AgentConfig.getAgentsConfig().document_agent.max_tokens, 1500);
        assert.strictEqual(document.getElementById("agent-max-tokens-val").textContent, '1500');

        // Test thinking budget slider input
        const budgetSlider = document.getElementById("agent-thinking-budget-slider");
        budgetSlider.value = '600';
        budgetSlider.dispatchEvent(new window.Event('input'));

        assert.strictEqual(window.AgentConfig.getAgentsConfig().document_agent.thinking_budget, 600);
        assert.strictEqual(document.getElementById("agent-thinking-budget-val").textContent, '600');
    });

    test('saveAgentConfig sends PATCH request', async () => {
        mockFetchCalls = [];
        mockFetchError = false;
        mockAlertCalls = [];
        mockFetchResponse = {
            ok: true,
            json: async () => ({ success: true })
        };

        await window.AgentConfig.saveAgentConfig();

        const patchCall = mockFetchCalls.find(call => call.options && call.options.method === 'PATCH');
        assert.ok(patchCall);
        assert.strictEqual(patchCall.url, '/api/tools/config/agents/document_agent');
        
        const payload = JSON.parse(patchCall.options.body);
        assert.strictEqual(payload.thinking_profile, 'low');
        assert.strictEqual(payload.max_tokens, 1500);
        assert.strictEqual(payload.thinking_budget, 600);

        // Verify alert called
        assert.strictEqual(mockAlertCalls.length, 1);
        assert.strictEqual(mockAlertCalls[0].title, 'Success');
    });

    test('closeAgentConfig cleans up modal state', async () => {
        const modal = document.getElementById("agent-config-modal");
        window.AgentConfig.closeAgentConfig();

        // Wait for modal transitions and setTimeout
        await new Promise(resolve => setTimeout(resolve, 310));
        assert.strictEqual(modal.style.display, 'none');
    });

    test('handles errors gracefully during save', async () => {
        mockFetchCalls = [];
        mockFetchError = true;
        mockAlertCalls = [];

        window.AgentConfig.openAgentConfig('browsing_agent');
        await window.AgentConfig.saveAgentConfig();

        assert.strictEqual(mockAlertCalls.length, 1);
        assert.strictEqual(mockAlertCalls[0].title, 'Error');
    });

    test('agent config badges click-to-edit flow updates sliders and agentConfig state', async () => {
        window.AgentConfig.openAgentConfig('browsing_agent');

        const maxTokensVal = document.getElementById('agent-max-tokens-val');
        const maxTokensSlider = document.getElementById('agent-max-tokens-slider');

        assert.ok(maxTokensVal);
        assert.ok(maxTokensSlider);

        // Click the badge to trigger inline editing input
        maxTokensVal.click();

        // Find the created input element
        const input = maxTokensVal.querySelector('input');
        assert.ok(input, 'Input element should be created inside the badge');
        assert.strictEqual(input.value, '2000');

        // Change input value
        input.value = '3500';
        
        // Dispatch Enter key down
        const keydownEvent = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        input.dispatchEvent(keydownEvent);

        // Verify the slider is updated and the badge has restored its text content
        assert.strictEqual(maxTokensSlider.value, '3500');
        assert.strictEqual(maxTokensVal.textContent, '3500');
        assert.strictEqual(window.AgentConfig.getAgentsConfig().browsing_agent.max_tokens, 3500);
    });
});

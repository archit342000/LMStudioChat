import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const utilsCode = fs.readFileSync(path.resolve(__dirname, '../utils.js'), 'utf8');
const constantsCode = fs.readFileSync(path.resolve(__dirname, '../constants.js'), 'utf8');
const iconsCode = fs.readFileSync(path.resolve(__dirname, '../icons.js'), 'utf8');
const renderersCode = fs.readFileSync(path.resolve(__dirname, '../agent-renderers.js'), 'utf8');

describe('agent-renderers.js', () => {
    let window;

    test('setup', () => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { runScripts: "dangerously" });
        window = dom.window;

        // Mock marked for formatMarkdown (in utils)
        window.marked = { parse: (text) => text };

        const loadScript = (code) => {
            const scriptEl = window.document.createElement("script");
            scriptEl.textContent = code;
            window.document.body.appendChild(scriptEl);
        };

        loadScript(utilsCode);
        loadScript(constantsCode);
        loadScript(iconsCode);
        loadScript(renderersCode);
    });

    test('sortActivitiesChronologically', () => {
        const sortActivitiesChronologically = window.eval('sortActivitiesChronologically');
        const activities = [{ timestamp: 20 }, { timestamp: 10 }, { timestamp: 30 }];
        const sorted = sortActivitiesChronologically(activities);
        assert.strictEqual(sorted[0].timestamp, 10);
        assert.strictEqual(sorted[2].timestamp, 30);
    });


    test('renderTaskListCard', () => {
        const renderTaskListCard = window.eval('renderTaskListCard');
        const tasks = [{ status: "DONE", description: "Task 1" }];
        const html = renderTaskListCard(tasks);
        assert.ok(html.includes('Task 1'));
        assert.ok(html.includes('line-through'));
    });

    test('_renderSubAgentActivityItemHtml - thinking', () => {
        const renderActivity = window.eval('_renderSubAgentActivityItemHtml');
        const html = renderActivity({ type: 'thinking', content: 'reasoning content' });
        assert.ok(html.includes('reasoning content'));
        assert.ok(html.includes('thinking-item'));
    });

    test('_renderSubAgentActivityItemHtml - tool_call', () => {
        const renderActivity = window.eval('_renderSubAgentActivityItemHtml');
        const html = renderActivity({ 
            type: 'tool_call', 
            content: JSON.stringify({ function: { name: 'grep_search', arguments: {} } }) 
        });
        assert.ok(html.includes('Search Code'));
        assert.ok(html.includes('tool-call-activity'));
    });

    test('_renderSubAgentSectionForTurn', () => {
        const _renderSubAgentSectionForTurn = window.eval('_renderSubAgentSectionForTurn');
        const html = _renderSubAgentSectionForTurn({ agent_name: 'research', messages: [{ role: 'assistant', content: 'hello' }] });
        assert.ok(html.includes('Research Agent'));
        assert.ok(html.includes('hello'));
    });

    test('_renderSubAgentActivityFeed', () => {
        const _renderSubAgentActivityFeed = window.eval('_renderSubAgentActivityFeed');
        const messages = [{
            role: 'assistant',
            content: 'sub-agent text content',
            tool_calls: JSON.stringify([{ function: { name: 'run_command', arguments: { command: 'ls' } } }])
        }];
        const html = _renderSubAgentActivityFeed(messages);
        assert.ok(html.includes('sub-agent text content'));
        assert.ok(html.includes('TOOL CALL: run_command'));
    });

    test('_buildActivityFeedContent with multiple agents', () => {
        const _buildActivityFeedContent = window.eval('_buildActivityFeedContent');
        const activities = [
            { timestamp: 10, agentName: 'research', type: 'thinking', content: 'Hmm' },
            { timestamp: 20, agentName: 'assistant', type: 'content', content: 'Hi' }
        ];
        const html = _buildActivityFeedContent(activities);
        assert.ok(html.includes('Research Agent')); // First agent grouping
        assert.ok(html.includes('Hmm'));
        assert.ok(html.includes('Assistant Response')); // Inline main assistant
        assert.ok(html.includes('Hi'));
    });

    test('initAgentRenderers and getSharedAgentCard', () => {
        const initAgentRenderers = window.eval('initAgentRenderers');
        const getSharedAgentCard = window.eval('getSharedAgentCard');

        // Setup DOM elements
        const activityFeed = window.document.createElement('div');
        activityFeed.dataset.history = '[]';
        const modalBody = window.document.createElement('div');
        modalBody.setAttribute('id', 'thought-modal-content-area');
        window.document.body.appendChild(modalBody);

        let modalSource = null;
        initAgentRenderers({
            getActiveThoughtModalSource: () => modalSource,
            getActiveClarificationIds: () => [],
            addActiveClarificationId: () => {},
            removeActiveClarificationId: () => {},
            getCurrentChatId: () => 'chat-123',
            showConfirm: () => Promise.resolve(true)
        });

        // 1. Assistant activities return feed itself
        const res1 = getSharedAgentCard(activityFeed, 'assistant');
        assert.strictEqual(res1, activityFeed);

        // 2. Creating subagent container card
        const card1 = getSharedAgentCard(activityFeed, 'research');
        assert.ok(card1);
        assert.strictEqual(card1.dataset.agentName, 'research');
        assert.ok(card1.classList.contains('sub-agent-container'));

        // 3. Chronology reuse card
        const card2 = getSharedAgentCard(activityFeed, 'research');
        assert.strictEqual(card1, card2);

        // 4. Different agent creates new card
        const card3 = getSharedAgentCard(activityFeed, 'file_system_agent');
        assert.notStrictEqual(card1, card3);
        assert.strictEqual(card3.dataset.agentName, 'file_system_agent');

        // 5. Active thoughts modal cloning
        modalSource = activityFeed;
        const card4 = getSharedAgentCard(activityFeed, 'research');
        assert.ok(modalBody.querySelector('.sub-agent-container[data-agent-name="research"]'));

        // Clean up
        window.document.body.removeChild(modalBody);
    });

    test('appendSubAgentActivity - accumulate and discrete', () => {
        const initAgentRenderers = window.eval('initAgentRenderers');
        const appendSubAgentActivity = window.eval('appendSubAgentActivity');

        const activityFeed = window.document.createElement('div');
        activityFeed.dataset.history = '[]';
        const modalBody = window.document.createElement('div');
        modalBody.setAttribute('id', 'thought-modal-content-area');
        window.document.body.appendChild(modalBody);

        let modalSource = activityFeed;
        let activeClarifications = [];
        let showPopOverCalled = false;
        let popOverQuestion = null;

        initAgentRenderers({
            getActiveThoughtModalSource: () => modalSource,
            getActiveClarificationIds: () => activeClarifications,
            addActiveClarificationId: (id) => activeClarifications.push(id),
            removeActiveClarificationId: (id) => {
                activeClarifications = activeClarifications.filter(c => c !== id);
            },
            getCurrentChatId: () => 'chat-123',
            showConfirm: () => Promise.resolve(true)
        });

        window.showClarificationPopOver = (q, opts, id, callbacks) => {
            showPopOverCalled = true;
            popOverQuestion = q;
            callbacks.onSuccess(id);
        };

        // 1. Accumulate streaming mode
        const item1 = appendSubAgentActivity(activityFeed, 'research', 'thinking', 'Starting task', null, true);
        assert.ok(item1);
        assert.strictEqual(item1.dataset.role, 'thinking');
        assert.strictEqual(item1.dataset.streaming, 'true');

        // Append more text
        appendSubAgentActivity(activityFeed, 'research', 'thinking', '... planning...', null, true);
        const textWrapper = item1.querySelector('.activity-content');
        assert.strictEqual(textWrapper.dataset.raw, 'Starting task... planning...');

        // 2. Type change seals the open item and creates a new one
        const item2 = appendSubAgentActivity(activityFeed, 'research', 'tool_call', '{"function": {"name": "run_command"}}', null, true);
        assert.notStrictEqual(item1, item2);
        assert.strictEqual(item1.dataset.streaming, undefined); // sealed
        assert.strictEqual(item2.dataset.role, 'tool_call');
        assert.strictEqual(item2.dataset.streaming, 'true');

        // 3. Discrete mode seals open items and creates completed ones
        const item3 = appendSubAgentActivity(activityFeed, 'research', 'thinking', 'Done thinking', null, false);
        assert.strictEqual(item2.dataset.streaming, undefined); // sealed
        assert.strictEqual(item3.dataset.streaming, undefined); // discrete has no streaming attribute

        // 4. Request clarification popover trigger
        const clarificationJson = JSON.stringify({
            id: 'clarify-1',
            function: {
                name: 'request_clarification',
                arguments: JSON.stringify({ question: 'Do you want coffee?', options: ['Yes', 'No'] })
            }
        });

        // Test tool call interception in streaming mode
        appendSubAgentActivity(activityFeed, 'research', 'tool_call', clarificationJson, null, false, true);
        assert.strictEqual(showPopOverCalled, true);
        assert.strictEqual(popOverQuestion, 'Do you want coffee?');

        // Clean up
        window.document.body.removeChild(modalBody);
        delete window.showClarificationPopOver;
    });

});

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

    test('renderToolArguments', () => {
        const renderToolArguments = window.eval('renderToolArguments');
        const html = renderToolArguments({ "key": "value" });
        assert.ok(html.includes('value'));
        assert.ok(html.includes('tool-args'));
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

    test('renderActivityFeed wrapper', () => {
        const renderActivityFeed = window.eval('renderActivityFeed');
        const html = renderActivityFeed([{ timestamp: 10, type: 'thinking', content: 'test', agentName: 'Assistant' }]);
        assert.ok(html.includes('<div class="activity-feed">'));
        assert.ok(html.includes('test'));
    });
});

/**
 * Luminous Chat — Agent Renderers
 * Extracted from script.js
 */

function sortActivitiesChronologically(activities) {
    return activities.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }



function renderTaskListCard(tasks) {
    let html =
      '<div class="task-list-card" style="background: var(--surface-secondary); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: 12px; margin-top: 8px; font-family: var(--font-body);">';
    html +=
      '<div style="font-weight: 600; font-size: 0.9em; color: var(--content-primary); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Task Checklist</div>';
    html +=
      '<ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">';

    tasks.forEach((task) => {
      let icon = "";
      let opacity = "1";
      let textDecoration = "none";
      if (task.status === "DONE") {
        icon =
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        opacity = "0.6";
        textDecoration = "line-through";
      } else if (task.status === "DROPPED") {
        icon =
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-rose)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        opacity = "0.5";
        textDecoration = "line-through";
      } else if (task.status === "BLOCKED") {
        icon =
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-amber)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        opacity = "0.8";
      } else {
        icon =
          '<div style="width: 13px; height: 13px; border: 2px solid var(--content-muted); border-radius: 3px; margin-top: 1px;"></div>';
      }

      html += `<li style="display: flex; flex-direction: column; opacity: ${opacity};">
                <div style="display: flex; gap: 8px; align-items: flex-start;">
                    <div style="flex-shrink: 0; margin-top: 2px;">${icon}</div>
                    <div style="flex-grow: 1;">
                        <div style="font-weight: 500; font-size: 0.85em; text-decoration: ${textDecoration}; line-height: 1.4; color: var(--content-primary);">${escapeHtml(task.description)}</div>
                        ${task.notes ? `<div style="font-size: 0.75em; color: var(--content-muted); margin-top: 4px; border-left: 2px solid var(--glass-border); padding-left: 6px;">${escapeHtml(task.notes)}</div>` : ""}
                    </div>
                </div>
            </li>`;
    });

    html += "</ul></div>";
    return html;
  }

function parseExecutionResult(text) {
    if (typeof text !== "string") return null;
    
    const langMatch = text.match(/\*\*Language:\*\*\s*([a-zA-Z0-9+#]+)/i);
    const exitCodeMatch = text.match(/\*\*Exit Code:\*\*\s*(-?\d+)/i);
    const timeMatch = text.match(/\*\*Time:\*\*\s*(\d+ms)/i);
    const fileMatch = text.match(/\*\*File:\*\*\s*([^\s|]+)/i);
    const timedOut = text.includes("TIMED OUT");
    
    let stdout = "";
    let stderr = "";
    
    const stdoutRegex = /\*\*stdout:\*\*\s*\n```[^\n]*\n([\s\S]*?)\n```/i;
    const stderrRegex = /\*\*stderr:\*\*\s*\n```[^\n]*\n([\s\S]*?)\n```/i;
    
    const stdoutMatch = text.match(stdoutRegex);
    if (stdoutMatch) {
      stdout = stdoutMatch[1];
    }
    const stderrMatch = text.match(stderrRegex);
    if (stderrMatch) {
      stderr = stderrMatch[1];
    }
    
    if (langMatch || exitCodeMatch) {
      return {
        language: langMatch ? langMatch[1] : "",
        exitCode: exitCodeMatch ? parseInt(exitCodeMatch[1]) : 0,
        time: timeMatch ? timeMatch[1] : "",
        file: fileMatch ? fileMatch[1] : "",
        timedOut,
        stdout,
        stderr
      };
    }
    return null;
}
window.parseExecutionResult = parseExecutionResult;


// Accordion Toggle Event Listener for Code Execution view source block
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".accordion-trigger");
    if (trigger) {
      const accordion = trigger.closest(".code-execution-accordion");
      if (accordion) {
        const content = accordion.querySelector(".accordion-content");
        const svg = trigger.querySelector("svg");
        if (content) {
          const isHidden = content.classList.contains("hidden");
          content.classList.toggle("hidden");
          if (svg) {
            svg.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
          }
        }
      }
    }
  });
}

function _renderSubAgentActivityItemHtml(activity) {
    const type = activity.type || "thinking";
    const content = activity.content || "";
    const timestamp = activity.timestamp || Date.now();

    const chevronSvg = `<div class="thought-chevron" style="margin-left: auto;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;

    if (type === "thinking") {
      return `
                <div class="activity-item thinking-item collapsed" data-role="thinking" data-timestamp="${timestamp}">
                    <div class="activity-header">
                        <div class="activity-type">Reasoning</div>
                        ${chevronSvg}
                    </div>
                    <div class="activity-content sub-agent-thinking" data-raw="${escapeHtml(content)}">${escapeHtml(content)}</div>
                </div>
            `;
    } else if (type === "content") {
      return `
                <div class="activity-item content-item collapsed" data-role="content" data-timestamp="${timestamp}">
                    <div class="activity-header">
                        <span class="activity-type">Assistant Response</span>
                        ${chevronSvg}
                    </div>
                    <div class="activity-content sub-agent-response" data-raw="${escapeHtml(content)}">${escapeHtml(content)}</div>
                </div>
            `;
    }

    let typeLabel, typeClass, contentHtml;

    if (type === "tool_call") {
      typeClass = "tool-call-activity";
      let toolName = "Unknown Tool";
      let args = {};
      try {
        const parsed =
          typeof content === "string" ? JSON.parse(content) : content;
        toolName = parsed.function?.name || "Unknown Tool";
        args = parsed.function?.arguments || {};
        if (typeof args === "string") {
          try {
            args = JSON.parse(args);
          } catch (e) {}
        }
      } catch (e) {}

      if (toolName === "run_code" || toolName === "run_file") {
        typeLabel = toolName === "run_code" ? "Run Code" : "Run File";
        const isCode = toolName === "run_code";
        const displayLang = isCode ? (args.language || "code") : "file";
        const mainLabel = isCode ? `Run Code (${displayLang})` : `Run File: ${args.path || ""}`;
        
        let codeContent = "";
        if (isCode) {
          codeContent = args.code || "";
        } else {
          codeContent = `// Path: ${args.path || ""}\n// Args: ${JSON.stringify(args.args || [])}\n// Stdin: ${args.stdin || ""}`;
        }
        
        contentHtml = `
          <div class="code-execution-accordion">
            <div class="accordion-trigger">
              <span>View Source Code</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transition: transform 0.2s ease;"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="accordion-content hidden">
              <pre><code class="language-${displayLang}">${escapeHtml(codeContent)}</code></pre>
            </div>
          </div>
        `;
        
        const config = TOOL_DISPLAY_CONFIG[toolName] || {
          name: typeLabel,
          icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
        };
        
        return `
          <div class="activity-item tool-call-item collapsed ${typeClass} code-execution-call" data-role="tool_call" data-timestamp="${timestamp}">
              <div class="activity-header">
                  <div class="activity-type">${config.icon} <span>Call: ${escapeHtml(mainLabel)}</span></div>
                  ${chevronSvg}
              </div>
              <div class="activity-content tool-call-content">${contentHtml}</div>
          </div>
        `;
      }

      const config = TOOL_DISPLAY_CONFIG[toolName] || {
        name: toolName,
        icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
      };
      typeLabel = config.name;
      contentHtml = `<code class="font-mono">${escapeHtml(JSON.stringify(args, null, 2))}</code>`;

      return `
                <div class="activity-item tool-call-item collapsed ${typeClass}" data-role="tool_call" data-timestamp="${timestamp}">
                    <div class="activity-header">
                        <div class="activity-type">${config.icon} <span>Call: ${escapeHtml(typeLabel)}</span></div>
                        ${chevronSvg}
                    </div>
                    <div class="activity-content tool-call-content">${contentHtml}</div>
                </div>
            `;
    } else if (type === "tool_result") {
      typeLabel = "Result";
      typeClass = "tool-result-activity";
      
      const parsedExec = parseExecutionResult(content);
      if (parsedExec) {
        const isZero = parsedExec.exitCode === 0;
        const statusIcon = isZero 
          ? `<svg class="status-success" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-emerald)" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`
          : `<svg class="status-failed" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-rose)" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        
        let outputHtml = "";
        if (parsedExec.stdout) {
          outputHtml += `<div class="terminal-stdout"><span class="terminal-label">STDOUT:</span>${escapeHtml(parsedExec.stdout)}</div>`;
        }
        if (parsedExec.stderr) {
          outputHtml += `<div class="terminal-stderr"><span class="terminal-label">STDERR:</span>${escapeHtml(parsedExec.stderr)}</div>`;
        }
        if (!parsedExec.stdout && !parsedExec.stderr) {
          outputHtml += `<div class="terminal-empty">No output</div>`;
        }

        const headerTitle = parsedExec.file ? `File: ${parsedExec.file}` : `Language: ${parsedExec.language}`;

        contentHtml = `
          <div class="terminal-window">
            <div class="terminal-header">
              <div class="terminal-dots">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
              </div>
              <div class="terminal-title">${escapeHtml(headerTitle)}</div>
              <div class="terminal-status">
                ${statusIcon}
                <span class="exit-code">Exit: ${parsedExec.exitCode}</span>
              </div>
            </div>
            <div class="terminal-body font-mono">
              ${outputHtml}
            </div>
            <div class="terminal-footer">
              <span>Time: ${parsedExec.time || 'N/A'}</span>
              ${parsedExec.timedOut ? '<span class="timeout-badge">TIMED OUT</span>' : ''}
            </div>
          </div>
        `;

        return `
          <div class="activity-item tool-result-item collapsed ${typeClass} code-execution-result" data-role="tool_result" data-timestamp="${timestamp}">
              <div class="activity-header">
                  <div class="activity-type">Execution Result: ${escapeHtml(parsedExec.file ? 'File' : parsedExec.language)}</div>
                  ${chevronSvg}
              </div>
              <div class="activity-content tool-result-content">${contentHtml}</div>
          </div>
        `;
      }

      let isTaskTool = false;
      try {
        const parsed =
          typeof content === "string" ? JSON.parse(content) : content;
        const targetObj = parsed.output ?? parsed;
        if (
          Array.isArray(targetObj) &&
          targetObj.length > 0 &&
          typeof targetObj[0] === "object" &&
          targetObj[0].hasOwnProperty("status") &&
          targetObj[0].hasOwnProperty("description")
        ) {
          isTaskTool = true;
          contentHtml = renderTaskListCard(targetObj);
          typeLabel = "Task List";
        } else {
          contentHtml = `<code class="font-mono">${escapeHtml(JSON.stringify(targetObj, null, 2))}</code>`;
        }
      } catch (e) {
        contentHtml = escapeHtml(content);
      }

      return `
                <div class="activity-item tool-result-item collapsed ${typeClass}" data-role="tool_result" data-timestamp="${timestamp}">
                    <div class="activity-header">
                        <div class="activity-type">Tool Result: ${typeLabel}</div>
                        ${chevronSvg}
                    </div>
                    <div class="activity-content tool-result-content" ${isTaskTool ? 'style="padding-top: 0;"' : ""}>${contentHtml}</div>
                </div>
            `;
    } else if (type === "event") {
      return `
                <div class="activity-item event-divider" data-role="event" data-timestamp="${timestamp}" style="display: flex; align-items: center; justify-content: center; margin: 1.5rem 0; gap: 1rem;">
                    <div style="flex: 1; height: 1px; background-color: var(--border-subtle, var(--border-subtle));"></div>
                    <span class="event-text" style="color: var(--content-muted); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;" data-raw="${escapeHtml(content)}">${escapeHtml(content)}</span>
                    <div style="flex: 1; height: 1px; background-color: var(--border-subtle, var(--border-subtle));"></div>
                </div>
            `;
    } else {
      typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      typeClass = "generic-activity";
      contentHtml = `<div style="white-space: pre-wrap; font-family: var(--font-mono, monospace); font-size: 0.85em;">${escapeHtml(content)}</div>`;
    }

    return `
            <div class="activity-item ${typeClass} collapsed" data-timestamp="${timestamp}">
                <div class="activity-header">
                    <span class="activity-type">${typeLabel}</span>
                </div>
                <div class="activity-content">${contentHtml}</div>
            </div>
        `;
  }

function _buildActivityFeedContent(activities) {
    if (!activities || activities.length === 0) return "";

    const sorted = sortActivitiesChronologically([...activities]);
    let finalHtml = "";
    let currentAgentName = null;
    let currentItemsHtml = "";

    const renderSubAgentCard = (name, items) => {
      if (!items) return "";
      const key = name.toLowerCase();
      let label = name.replace(/_/g, " ");
      if (key === "research") label = "Research Agent";
      if (key === "file_system_agent") label = "FileSystem Agent";

      return `
                <div class="activity-item sub-agent-container collapsed" data-agent-name="${key}">
                    <div class="activity-header">
                        <div class="sub-agent-icon-wrapper" style="margin-right: 6px; display: flex; align-items: center; justify-content: center; color: var(--content-muted);">${getAgentIcon(key)}</div>
                        <div class="activity-type" style="margin-right: auto;">${label}</div>
                        <div class="thought-chevron" style="margin-left: auto;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                    </div>
                    <div class="activity-content sub-agent-activity-feed" style="margin-left: 0; border-left: none;">${items}</div>
                </div>
            `;
    };

    for (const activity of sorted) {
      // Determine agent name for this activity
      let agentName =
        activity.agentName ||
        activity.agent_name ||
        (activity.parent_type !== "main" ? activity.parent_type : "Assistant");
      if (agentName === "Thinking") agentName = "Assistant";

      const normalized = agentName.toLowerCase();
      if (currentAgentName !== null && normalized !== currentAgentName.toLowerCase()) {
        // Agent switched — if previous was sub-agent, close its card
        if (currentAgentName.toLowerCase() !== "assistant" && currentAgentName.toLowerCase() !== "assistant_active") {
          finalHtml += renderSubAgentCard(currentAgentName, currentItemsHtml);
        } else {
          finalHtml += currentItemsHtml;
        }
        currentItemsHtml = "";
      }

      currentAgentName = agentName;
      currentItemsHtml += _renderSubAgentActivityItemHtml(activity);
    }

    // Flush final items
    if (currentAgentName !== null) {
      if (currentAgentName.toLowerCase() !== "assistant" && currentAgentName.toLowerCase() !== "assistant_active") {
        finalHtml += renderSubAgentCard(currentAgentName, currentItemsHtml);
      } else {
        finalHtml += currentItemsHtml;
      }
    }

    return finalHtml;
  }



function _renderSubAgentSectionForTurn(subAgent) {
    const agentName = subAgent.agent_name || subAgent.agent || "Sub-Agent";
    const messages = subAgent.messages || [];
    const activityCount = messages.length;

    let label = agentName.replace(/_/g, " ");
    if (agentName.toLowerCase() === "research") label = "Research Agent";
    if (agentName.toLowerCase() === "file_system_agent") label = "FileSystem Agent";

    return `
            <div class="activity-item sub-agent-container collapsed" data-agent-name="${escapeHtml(agentName)}">
                <div class="activity-header">
                    <div class="sub-agent-icon-wrapper" style="margin-right: 6px; display: flex; align-items: center; justify-content: center; color: var(--content-muted);">${getAgentIcon(agentName)}</div>
                    <div class="activity-type" style="margin-right: auto;">${escapeHtml(label)}</div>
                    <span class="sub-agent-badge" style="margin-right: 12px; font-size: 0.7rem; opacity: 0.6;">${activityCount} ${activityCount === 1 ? "activity" : "activities"}</span>
                    <div class="thought-chevron"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                </div>
                <div class="activity-content sub-agent-activity-feed" style="margin-left: 0; border-left: none;">
                    ${_renderSubAgentActivityFeed(messages)}
                </div>
            </div>
        `;
  }

function _renderSubAgentActivityFeed(messages) {
    if (!messages || messages.length === 0) return "";

    let html = "";

    for (const msg of messages) {
      // Re-use activity-item pattern for internal sub-agent sections
      const roleLabel =
        msg.role === "user"
          ? "User"
          : msg.role === "assistant"
            ? "Assistant"
            : msg.role;
      const contentHtml = msg.content ? formatMarkdown(msg.content) : "";
      const timestamp = msg.timestamp || Date.now();

      // Reconstruct tool-calls if present in the message
      let toolsHtml = "";
      if (msg.tool_calls) {
        try {
          const tools =
            typeof msg.tool_calls === "string"
              ? JSON.parse(msg.tool_calls)
              : msg.tool_calls;
          if (Array.isArray(tools)) {
            for (const tool of tools) {
              const toolName = tool.function?.name || "tool";
              const args = tool.function?.arguments || "{}";
              toolsHtml += `
                                <div class="sub-agent-tool-call" style="margin-top: 8px; padding-left: 4px; border-left: none;">
                                    <div style="font-size: 0.65rem; font-weight: 700; color: var(--content-muted); margin-bottom: 4px;">TOOL CALL: ${escapeHtml(toolName)}</div>
                                    <code style="font-size: 0.75rem; display: block; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 4px;">${escapeHtml(typeof args === "string" ? args : JSON.stringify(args))}</code>
                                </div>
                            `;
            }
          }
        } catch (e) {
          console.error("Failed to parse sub-agent tools", e);
        }
      }

      html += `
                <div class="sub-agent-activity-item activity-item" data-timestamp="${timestamp}">
                    <div class="sub-agent-activity-header activity-header">
                        <span class="activity-type">${escapeHtml(roleLabel)}</span>
                        <span class="activity-meta" style="font-size: 0.6rem; opacity: 0.6; margin-left: 8px;">${new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                    <div class="sub-agent-activity-content activity-content">
                        ${contentHtml}
                        ${toolsHtml}
                    </div>
                </div>
            `;
    }

    return html;
  }

let deps = {
  getActiveThoughtModalSource: () => null,
  getActiveClarificationIds: () => [],
  addActiveClarificationId: () => {},
  removeActiveClarificationId: () => {},
  getCurrentChatId: () => null,
  showConfirm: () => Promise.resolve(false)
};

function initAgentRenderers(dependencies) {
  Object.assign(deps, dependencies);
}

function getSharedAgentCard(activityFeed, rawAgentName, attemptId = null) {
  if (!activityFeed) return null;
  const agentName = String(rawAgentName || "Agent").toLowerCase();

  // CHRONOLOGY FIX: For main Assistant activities, we append directly to the activityFeed (no card)
  if (agentName === "assistant" || agentName === "main" || agentName === "assistant_active") {
    return activityFeed;
  }

  // CHRONOLOGY FIX: Check if the LAST card in the feed matches this agent.
  // If not, we MUST create a new card to preserve the Assistant -> Agent -> Assistant flow.
  let card = activityFeed.lastElementChild;
  if (
    !card ||
    !card.classList.contains("sub-agent-container") ||
    card.dataset.agentName !== agentName
  ) {
    let label = rawAgentName.replace(/_/g, " ");
    if (agentName === "research") label = "Research Agent";
    if (agentName === "file_system_agent") label = "File System Agent";
    if (agentName === "assistant" || agentName === "main")
      label = "Assistant";

    const html = `
              <div class="activity-item sub-agent-container collapsed" data-agent-name="${agentName}">
                  <div class="activity-header">
                      <div class="sub-agent-icon-wrapper" style="margin-right: 6px; display: flex; align-items: center; justify-content: center; color: var(--content-muted);">${getAgentIcon(agentName)}</div>
                      <div class="activity-type" style="margin-right: auto;">${label}</div>
                      <div class="thought-chevron" style="margin-left: auto;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                  </div>
                  <div class="activity-content sub-agent-activity-feed" style="margin-left: 0; border-left: none;"></div>
              </div>
          `;
    activityFeed.insertAdjacentHTML("beforeend", html);
    card = activityFeed.lastElementChild;

    // SYNC TO MODAL
    if (deps.getActiveThoughtModalSource() === activityFeed) {
      const modalBody = document.getElementById("thought-modal-content-area");
      if (modalBody) {
        const clone = card.cloneNode(true);
        clone.classList.add("collapsed");
        clone.classList.remove("expanded");
        modalBody.appendChild(clone);
      }
    }

    if (attemptId) card.dataset.attemptId = attemptId;      
    // Wire up click-to-toggle for the new sub-agent container
    const hdr = card.querySelector(".activity-header");
    if (hdr) {
      hdr.addEventListener("click", (e) => {
        e.stopPropagation();
        const isCollapsed = card.classList.toggle("collapsed");
        card.classList.toggle("expanded", !isCollapsed);
      });
    }
  }
  return card;
}

function appendSubAgentActivity(
  activityFeed,
  rawAgentName,
  activityType,
  content,
  timestamp,
  accumulate,
  isLive = false,
  attemptId = null
) {
  const targetContainer = getSharedAgentCard(activityFeed, rawAgentName, attemptId);
  if (!targetContainer) return null;

  // If targetContainer is the activityFeed itself, it's a naked stream item.
  // Otherwise, it's a sub-agent card and we need its .sub-agent-activity-feed.
  const contentArea =
    targetContainer === activityFeed
      ? activityFeed
      : targetContainer.querySelector(".sub-agent-activity-feed");
  if (!contentArea) return null;

  if (accumulate) {
    // Seal any streaming items whose type DIFFERS from the incoming type.
    // This is what enforces chronological order: thinking→output→thinking
    // instead of merging all thinking chunks into a single monster block.
    let currentItem = null;
    contentArea
      .querySelectorAll(":scope > .activity-item[data-streaming]")
      .forEach((item) => {
        if (item.dataset.role === activityType) {
          currentItem = item; // same type — reuse (still streaming)
        } else {
          // Different type started — seal it
          delete item.dataset.streaming;
        }
      });

    if (!currentItem) {
      // No open accumulator of this type — create one
      const html = _renderSubAgentActivityItemHtml({
        type: activityType,
        content: "",
        timestamp: timestamp || Date.now(),
      });
      contentArea.insertAdjacentHTML("beforeend", html);
      currentItem = contentArea.lastElementChild;

      // SYNC TO MODAL (Creation)
      if (deps.getActiveThoughtModalSource() === activityFeed) {
        const modalBody = document.getElementById("thought-modal-content-area");
        if (modalBody) {
          // We need to find where to append this in the modal.
          // If contentArea is the main feed, append to root.
          // If contentArea is a sub-agent's feed, we need to find that agent's feed in the modal.
          if (contentArea === activityFeed) {
            const clone = currentItem.cloneNode(true);
            clone.classList.add("collapsed");
            clone.classList.remove("expanded");
            modalBody.appendChild(clone);
          } else {
            // Nested item - find parent container in modal
            const parentAgent = contentArea.closest(".sub-agent-container");
            if (parentAgent) {
              const agentName = parentAgent.dataset.agentName;
              const modalParentAgent = modalBody.querySelector(`.sub-agent-container[data-agent-name="${agentName}"]`);
              if (modalParentAgent) {
                const modalContentArea = modalParentAgent.querySelector(".sub-agent-activity-feed");
                if (modalContentArea) {
                  const clone = currentItem.cloneNode(true);
                  clone.classList.add("collapsed");
                  clone.classList.remove("expanded");
                  modalContentArea.appendChild(clone);
                }
              }
            }
          }
        }
      }

      if (currentItem) {
        currentItem.dataset.role = activityType;
        currentItem.dataset.streaming = "true";
        if (attemptId) currentItem.dataset.attemptId = attemptId;
        // Wire up click-to-toggle so the header chevron works
        const hdr = currentItem.querySelector(".activity-header");
        if (hdr) {
          hdr.addEventListener("click", (e) => {
            e.stopPropagation();
            const isCollapsed = currentItem.classList.toggle("collapsed");
            currentItem.classList.toggle("expanded", !isCollapsed);
          });
        }
      }
    }

    if (currentItem) {
      const textWrapper = currentItem.querySelector(".activity-content, .event-text");
      if (textWrapper) {
        const raw = (textWrapper.dataset.raw || "") + (content || "");
        textWrapper.dataset.raw = raw;
        textWrapper.innerHTML = escapeHtml(raw);

        // SYNC TO MODAL (Text Update)
        if (deps.getActiveThoughtModalSource() === activityFeed) {
          const modalBody = document.getElementById("thought-modal-content-area");
          if (modalBody) {
            // We need to find this item in the modal.
            // It should have the same timestamp and role.
            const timestamp = currentItem.dataset.timestamp;
            const modalItem = modalBody.querySelector(`.activity-item[data-timestamp="${timestamp}"][data-role="${activityType}"]`);
            if (modalItem) {
              const modalTextWrapper = modalItem.querySelector(".activity-content, .event-text");
              if (modalTextWrapper) {
                modalTextWrapper.innerHTML = escapeHtml(raw);
              }
            }
          }
        }

        // Trigger clarification pop-over if this is a request_clarification tool call
        if (activityType === "tool_call") {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.function?.name === "request_clarification") {
              const activeClarificationIds = deps.getActiveClarificationIds();
              // Check if this ID is in the active list (from backend or live stream)
              if (isLive || activeClarificationIds.includes(parsed.id)) {
                const args =
                  typeof parsed.function.arguments === "string"
                    ? JSON.parse(parsed.function.arguments)
                    : parsed.function.arguments;
                window.showClarificationPopOver(
                  args.question,
                  args.options,
                  parsed.id,
                  {
                    chatId: deps.getCurrentChatId(),
                    onSuccess: (id) => {
                      deps.removeActiveClarificationId(id);
                    },
                    showNotification: window.showAlert,
                    showConfirm: deps.showConfirm
                  }
                );
                // Ensure it's in the list for re-renders during this session
                if (!activeClarificationIds.includes(parsed.id)) {
                  deps.addActiveClarificationId(parsed.id);
                }
              }
            }
          } catch (e) {}
        }
      }

      // Update history dataset for persistence
      const history = JSON.parse(activityFeed.dataset.history || "[]");
      const lastIdx = history.length - 1;
      if (
        lastIdx >= 0 &&
        history[lastIdx].agentName === rawAgentName &&
        history[lastIdx].type === activityType &&
        history[lastIdx].accumulate
      ) {
        history[lastIdx].content = (history[lastIdx].content || "") + content;
      } else {
        history.push({
          agentName: rawAgentName,
          type: activityType,
          content: content,
          timestamp: timestamp || Date.now(),
          accumulate: true,
        });
      }
      activityFeed.dataset.history = JSON.stringify(history);
    }
    return currentItem;
  } else {
    // Discrete mode: seal any open streaming items, then insert a complete item
    contentArea
      .querySelectorAll(".activity-item[data-streaming]")
      .forEach((item) => {
        delete item.dataset.streaming;
      });
    const html = _renderSubAgentActivityItemHtml({
      type: activityType,
      content: content || "",
      timestamp: timestamp || Date.now(),
    });
    contentArea.insertAdjacentHTML("beforeend", html);
    const newItem = contentArea.lastElementChild;

    // SYNC TO MODAL (Discrete Creation)
    if (deps.getActiveThoughtModalSource() === activityFeed) {
      const modalBody = document.getElementById("thought-modal-content-area");
      if (modalBody) {
        if (contentArea === activityFeed) {
          const clone = newItem.cloneNode(true);
          clone.classList.add("collapsed");
          clone.classList.remove("expanded");
          modalBody.appendChild(clone);
        } else {
          // Nested item - find parent container in modal
          const parentAgent = contentArea.closest(".sub-agent-container");
          if (parentAgent) {
            const agentName = parentAgent.dataset.agentName;
            const modalParentAgent = modalBody.querySelector(`.sub-agent-container[data-agent-name="${agentName}"]`);
            if (modalParentAgent) {
              const modalContentArea = modalParentAgent.querySelector(".sub-agent-activity-feed");
              if (modalContentArea) {
                const clone = newItem.cloneNode(true);
                clone.classList.add("collapsed");
                clone.classList.remove("expanded");
                modalContentArea.appendChild(clone);
              }
            }
          }
        }
      }
    }

    if (newItem) {
      newItem.dataset.role = activityType;
      if (attemptId) newItem.dataset.attemptId = attemptId;
      // Wire up click-to-toggle
      const hdr = newItem.querySelector(".activity-header");
      if (hdr) {
        hdr.addEventListener("click", (e) => {
          e.stopPropagation();
          const isCollapsed = newItem.classList.toggle("collapsed");
          newItem.classList.toggle("expanded", !isCollapsed);
        });
      }

      // Trigger clarification pop-over for discrete tool calls
      if (activityType === "tool_call") {
        try {
          const parsed = JSON.parse(content);
          if (parsed.function?.name === "request_clarification") {
            const activeClarificationIds = deps.getActiveClarificationIds();
            if (isLive || activeClarificationIds.includes(parsed.id)) {
              const args =
                typeof parsed.function.arguments === "string"
                  ? JSON.parse(parsed.function.arguments)
                  : parsed.function.arguments;
              window.showClarificationPopOver(
                args.question,
                args.options,
                parsed.id,
                {
                  chatId: deps.getCurrentChatId(),
                  onSuccess: (id) => {
                    deps.removeActiveClarificationId(id);
                  },
                  showNotification: window.showAlert,
                  showConfirm: deps.showConfirm
                }
              );
              if (!activeClarificationIds.includes(parsed.id)) {
                deps.addActiveClarificationId(parsed.id);
              }
            }
          }
        } catch (e) {}
      }
    }

    // Update history dataset for persistence (discrete item)
    const history = JSON.parse(activityFeed.dataset.history || "[]");
    history.push({
      agentName: rawAgentName,
      type: activityType,
      content: content,
      timestamp: timestamp || Date.now(),
      accumulate: false,
    });
    activityFeed.dataset.history = JSON.stringify(history);

    return newItem;
  }
}

window.initAgentRenderers = initAgentRenderers;
window.getSharedAgentCard = getSharedAgentCard;
window.appendSubAgentActivity = appendSubAgentActivity;
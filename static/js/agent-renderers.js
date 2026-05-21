/**
 * Luminous Chat — Agent Renderers
 * Extracted from script.js
 */

function sortActivitiesChronologically(activities) {
    return activities.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

function renderToolArguments(args) {
    if (!args || Object.keys(args).length === 0) return "";

    let html = '<div class="tool-args">';
    for (const [key, value] of Object.entries(args)) {
      let displayValue = value;
      if (typeof value === "object") {
        displayValue = JSON.stringify(value);
      }
      const isLong = String(displayValue).length > 60;
      const truncatedValue = isLong
        ? String(displayValue).substring(0, 57) + "..."
        : displayValue;

      html += `
                <div class="arg-badge" title="${escapeHtml(String(displayValue))}">
                    <span class="arg-key">${escapeHtml(key)}:</span>
                    <span class="arg-value">${escapeHtml(String(truncatedValue))}</span>
                </div>
            `;
    }
    html += "</div>";
    return html;
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
      const isAssistant =
        normalized === "assistant" || normalized === "assistant_active";

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

function renderActivityFeed(activities) {
    if (!activities || activities.length === 0) return "";
    return `<div class="activity-feed">${_buildActivityFeedContent(activities)}</div>`;
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
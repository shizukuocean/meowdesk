"use strict";

async function runAgentConnectMvpScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "agent-connect-mvp") {
    const smokeAgentCommand = JSON.stringify(process.env.MEOWDESK_RENDERER_SMOKE_AGENT_COMMAND || process.execPath);
    const smokeAgentCwd = JSON.stringify(defaultWorkspaceDirectory());
    return win.webContents.executeJavaScript(`
      (async () => {
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const waitFor = (selector, timeout = 8000) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            const element = document.querySelector(selector);
            if (element) {
              resolve(element);
              return;
            }
            if (Date.now() - startedAt > timeout) {
              reject(new Error("Timed out waiting for " + selector));
              return;
            }
            setTimeout(tick, 50);
          };
          tick();
        });
        const waitForText = (selector, text, timeout = 8000) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            const element = document.querySelector(selector);
            if (element && element.textContent.includes(text)) {
              resolve(element);
              return;
            }
            if (Date.now() - startedAt > timeout) {
              reject(new Error("Timed out waiting for " + selector + " to include " + text + ". Last text: " + (element?.textContent || "")));
              return;
            }
            setTimeout(tick, 50);
          };
          tick();
        });
        const waitForMissing = (selector, timeout = 8000) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            const element = document.querySelector(selector);
            if (!element) {
              resolve(true);
              return;
            }
            if (Date.now() - startedAt > timeout) {
              reject(new Error("Timed out waiting for " + selector + " to disappear."));
              return;
            }
            setTimeout(tick, 50);
          };
          tick();
        });
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(140);
          return element;
        };
        const setNativeValue = (element, value) => {
          const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
          if (descriptor?.set) {
            descriptor.set.call(element, value);
          } else {
            element.value = value;
          }
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const setField = async (selector, value) => {
          const element = await waitFor(selector);
          setNativeValue(element, value);
          await delay(80);
          return element;
        };
        const smokeAgentCommand = ${smokeAgentCommand};
        const smokeAgentCwd = ${smokeAgentCwd};

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('[data-next-route="access"]');
        await waitFor('[data-r2-access-route]');
        await waitFor('[data-r2-access-menu-item="workspace"][data-r2-access-menu-active="true"]');
        await waitFor('[data-r2-agent-connect]');
        const setupPath = await waitFor('[data-r2-agent-setup-path]');
        if (
          !setupPath.textContent.includes("选模板") ||
          !setupPath.textContent.includes("测试连接") ||
          !setupPath.textContent.includes("保存双落点") ||
          !setupPath.textContent.includes("工作区") ||
          !setupPath.textContent.includes("工坊") ||
          !setupPath.textContent.includes("少切窗") ||
          !setupPath.textContent.includes("组件/功能页")
        ) {
          throw new Error("Agent Center setup path should expose workspace/workshop dual landing semantics: " + setupPath.textContent);
        }
        const defaultCodexTest = await window.workbench.testToolCommand({ command: "codex", args: [], cwd: "." });
        const defaultCodexOutput = String(defaultCodexTest?.output || "").split(String.fromCharCode(92)).join("/").toLowerCase();
        if (defaultCodexOutput.includes("/program files/windowsapps/openai.codex_") && defaultCodexTest?.ok === true) {
          throw new Error("Codex packaged app resource must not pass as an installed CLI: " + JSON.stringify(defaultCodexTest));
        }
        if (
          defaultCodexOutput.includes("/program files/windowsapps/openai.codex_") &&
          !/Windows 应用执行别名|桌面应用包|不等于可接入的 Agent CLI|不是.*CLI|内部资源/.test(String(defaultCodexTest?.message || ""))
        ) {
          throw new Error("Codex packaged app resource should explain that it is not a CLI: " + JSON.stringify(defaultCodexTest));
        }
        for (const presetId of ${JSON.stringify(process.platform === "win32" ? ["claude", "codex", "hermes-wsl", "custom"] : ["claude", "codex", "hermes", "custom"])}) {
          await waitFor('[data-r2-agent-preset="' + presetId + '"]');
        }
        const presetElements = [...document.querySelectorAll('[data-r2-agent-preset]')];
        const forbiddenPreset = presetElements.find((element) => {
          const text = [
            element.getAttribute("data-r2-agent-preset") || "",
            element.textContent || ""
          ].join(" ").toLowerCase();
          return text.includes("powershell") || /\\bterminal\\b/.test(text) || /\\bshell\\b/.test(text);
        });
        if (forbiddenPreset) {
          throw new Error("Agent preset list should not show Terminal or PowerShell as normal user templates: " + forbiddenPreset.textContent);
        }

        await click('[data-r2-agent-preset="codex"]');
        await setField('[data-r2-agent-draft-name]', "Smoke Codex Agent");
        await setField('[data-r2-agent-draft-kind]', "codex");
        await setField('[data-r2-agent-draft-command]', smokeAgentCommand);
        await setField('[data-r2-agent-draft-cwd]', smokeAgentCwd);
        await setField('[data-r2-agent-draft-args]', "");
        const saveBeforeTest = await waitFor('[data-r2-agent-save-draft]');
        if (!saveBeforeTest.disabled) {
          throw new Error("Save Agent should stay disabled until the current command has passed test.");
        }
        await click('[data-r2-agent-test-draft]');
        await waitForText('[data-r2-agent-connect-status]', "测试通过", 8000);
        const saveAfterTest = await waitFor('[data-r2-agent-save-draft]');
        if (saveAfterTest.disabled) {
          throw new Error("Save Agent should be enabled after current command passes test.");
        }
        await click('[data-r2-agent-save-draft]');
        const savedStatus = await waitForText('[data-r2-agent-connect-status]', "已接入", 8000);
        if (
          !savedStatus.textContent.includes("工作区") ||
          !savedStatus.textContent.includes("工坊") ||
          !savedStatus.textContent.includes("少切窗") ||
          !savedStatus.textContent.includes("作品")
        ) {
          throw new Error("Saved Agent status should point to workspace usage and workshop development: " + savedStatus.textContent);
        }
        const agentList = await waitFor('[data-r2-access-tool-list]', 8000);
        if (
          !agentList.textContent.includes("工作区和工坊的 Agent 选择") ||
          !agentList.textContent.includes("少切窗") ||
          !agentList.textContent.includes("作品制作")
        ) {
          throw new Error("Agent Center should describe saved Agents as shared workspace/workshop entries with different usage goals: " + agentList.textContent);
        }
        const accessTool = await waitFor('[data-r2-access-tool="codex"]', 8000);
        if (!accessTool.textContent.includes("Smoke Codex Agent")) {
          throw new Error("Saved Agent did not appear in Agent Center: " + accessTool.textContent);
        }
        const openWorkspaceButton = await waitFor('[data-r2-agent-open-workspace]', 8000);
        if (openWorkspaceButton.disabled) {
          throw new Error("Agent Center open-workspace CTA should be enabled after saving an Agent.");
        }
        const openStudioButton = await waitFor('[data-r2-agent-open-studio]', 8000);
        if (openStudioButton.disabled) {
          throw new Error("Agent Center open-studio CTA should be enabled after saving an Agent.");
        }
        const listOpenWorkspaceButton = await waitFor('[data-r2-agent-list-open-workspace]', 8000);
        if (listOpenWorkspaceButton.disabled) {
          throw new Error("Agent list open-workspace CTA should be enabled when an Agent exists.");
        }
        const listOpenStudioButton = await waitFor('[data-r2-agent-list-open-studio]', 8000);
        if (listOpenStudioButton.disabled) {
          throw new Error("Agent list open-studio CTA should be enabled when an Agent exists.");
        }
        const config = await window.workbench.getConfig();
        const tools = Array.isArray(config?.tools) ? config.tools : [];
        const savedTool = tools.find((tool) => tool && tool.id === "codex");
        if (!savedTool || savedTool.toolKind !== "codex" || savedTool.command !== smokeAgentCommand) {
          throw new Error("Saved Agent did not round-trip through getConfig: " + JSON.stringify(savedTool));
        }

        await click('[data-r2-agent-open-workspace]');
        const workspace = await waitFor('[data-r2-workspace-route]');
        const workspaceToolbar = await waitFor('[data-r2-workspace-toolbar]');
        const workspaceSlotPicker = await waitFor('[data-r2-workspace-slot-picker]');
        const workspaceSidebarManager = await waitFor('[data-r2-workspace-sidebar-manager-button]');
        const workspaceSidebarToggle = await waitFor('[data-r2-workspace-sidebar-toggle]');
        if (!workspaceToolbar.contains(workspaceSlotPicker)) {
          throw new Error("Workspace slot picker should live in the top toolbar.");
        }
        for (const [name, button] of [["manager", workspaceSidebarManager], ["toggle", workspaceSidebarToggle]]) {
          if (!workspaceToolbar.contains(button)) {
            throw new Error("Workspace right-sidebar button should live in the top toolbar: " + name);
          }
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) <= 0.01 ||
            rect.width < 34 ||
            rect.height < 34
          ) {
            throw new Error("Workspace right-sidebar top button should stay visible and use the VS icon-button size: " + JSON.stringify({
              name,
              rect: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                left: Math.round(rect.left),
                top: Math.round(rect.top)
              },
              style: { display: style.display, visibility: style.visibility, opacity: style.opacity }
            }));
          }
        }
        if (document.querySelector('[data-r2-workspace-refresh]')) {
          throw new Error("Workspace should not render the retired refresh button.");
        }
        if (
          !workspace.textContent.includes("少切窗") ||
          !workspace.textContent.includes("CLI Agent") ||
          workspace.textContent.includes("按旧 Meowdesk")
        ) {
          throw new Error("Workspace route should present as the daily low-window-switching Agent environment: " + workspace.textContent);
        }
        await click('[data-r2-workspace-configure-pane="blank-1"]');
        const workspaceConfigDialog = await waitFor('[data-r2-workspace-config-dialog]');
        if (
          !workspaceConfigDialog.textContent.includes("少切窗") ||
          !workspaceConfigDialog.textContent.includes("作品")
        ) {
          throw new Error("Workspace config dialog should distinguish workspace usage from workshop component development: " + workspaceConfigDialog.textContent);
        }
        const workspaceChoice = await waitFor('[data-r2-workspace-config-tool="codex"]');
        if (!workspaceChoice.textContent.includes("Smoke Codex Agent")) {
          throw new Error("Workspace config dialog did not show saved Agent: " + workspaceChoice.textContent);
        }

        await click('[data-next-route="studio"]');
        await waitFor('[data-studio-agent-panel][data-studio-agent-stage-current="workstation"]');
        await click('[data-studio-agent-add]');
        await waitFor('[data-studio-agent-picker-dialog]');
        const pickerCliNote = await waitFor('[data-studio-agent-choice-note="cli"]');
        if (!pickerCliNote.textContent.includes("工位终端")) {
          throw new Error("Studio picker should explain CLI Agent terminal startup: " + pickerCliNote.textContent);
        }
        const desktopPickerResidue = [
          '[data-studio-agent-choice-note="desktop"]',
          '[data-studio-agent-choice-type="desktop"]',
          '[data-studio-agent-choice="claude-desktop"]',
          '[data-studio-desktop-launch]'
        ].flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => ({
          selector,
          text: (element.textContent || "").trim().slice(0, 120)
        })));
        if (desktopPickerResidue.length) {
          throw new Error("Studio picker should not expose the removed desktop Agent placeholder path: " + JSON.stringify(desktopPickerResidue));
        }
        const studioChoices = [...document.querySelectorAll('[data-studio-agent-choice]')];
        const forbiddenStudioChoice = studioChoices.find((element) => {
          const text = [
            element.getAttribute("data-studio-agent-choice") || "",
            element.textContent || ""
          ].join(" ").toLowerCase();
          return text.includes("powershell") || /\\bterminal\\b/.test(text) || /\\bshell\\b/.test(text);
        });
        if (forbiddenStudioChoice) {
          throw new Error("Studio Agent picker should not show terminal-like tools: " + forbiddenStudioChoice.textContent);
        }
        const studioChoice = await waitFor('[data-studio-agent-choice="codex"]');
        if (!studioChoice.textContent.includes("Smoke Codex Agent")) {
          throw new Error("Studio Agent picker did not show saved Agent name: " + studioChoice.textContent);
        }
        await click('[data-studio-agent-choice="codex"]');
        await waitFor('[data-studio-agent-panel][data-studio-agent-selected="codex"]');

        await click('[data-next-route="access"]');
        await waitFor('[data-r2-access-tool="codex"]');
        await click('[data-r2-access-delete-tool="codex"]');
        await waitForText('[data-r2-agent-connect-status]', "已从 Meowdesk 移除", 8000);
        await waitForMissing('[data-r2-access-tool="codex"]', 8000);
        const configAfterDelete = await window.workbench.getConfig();
        const toolsAfterDelete = Array.isArray(configAfterDelete?.tools) ? configAfterDelete.tools : [];
        if (toolsAfterDelete.some((tool) => tool && tool.id === "codex")) {
          throw new Error("Deleted Agent still exists in getConfig: " + JSON.stringify(toolsAfterDelete));
        }
        const remainingAgentTools = toolsAfterDelete.filter((tool) => {
          const text = [
            tool?.toolKind || tool?.kind || "",
            tool?.id || "",
            tool?.name || "",
            tool?.command || ""
          ].join(" ").toLowerCase();
          return !text.includes("terminal") && !text.includes("powershell") && !text.includes("shell");
        });
        if (!remainingAgentTools.length) {
          const emptyState = await waitFor('[data-r2-agent-empty-state]', 8000);
          if (
            !emptyState.textContent.includes("桌面端 Agent") ||
            !emptyState.textContent.includes("工坊外部接力") ||
            !emptyState.textContent.includes("不会嵌入工作区")
          ) {
            throw new Error("Agent Center empty state should offer desktop Agent fallback: " + emptyState.textContent);
          }
          const emptyOpenStudioButton = await waitFor('[data-r2-agent-empty-open-studio]', 8000);
          if (emptyOpenStudioButton.disabled) {
            throw new Error("Agent Center empty-state studio CTA should stay enabled.");
          }
        }

        return {
          scenario: "agent-connect-mvp",
          presetCount: presetElements.length,
          savedAgent: savedTool.name,
          deletedAgent: true,
          emptyStateAction: Boolean(document.querySelector('[data-r2-agent-empty-open-studio]')),
          studioChoice: studioChoice.textContent,
          workspaceChoice: workspaceChoice.textContent
        };
      })()
    `, true);
  }
}

const agentAccessSmokeScenarios = Object.freeze({
  "agent-connect-mvp": runAgentConnectMvpScenario,
});

module.exports = {
  agentAccessSmokeScenarios
};

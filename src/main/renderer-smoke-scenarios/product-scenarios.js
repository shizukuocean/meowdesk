"use strict";

async function runR1FunctionsScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "r1-functions") {
    return win.webContents.executeJavaScript(`
      (async () => {
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const waitFor = (selector, timeout = 5000) => new Promise((resolve, reject) => {
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
        const waitForText = (selector, text, timeout = 5000) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            const elements = [...document.querySelectorAll(selector)];
            const element = elements.find((item) => (item.textContent || "").includes(text));
            if (element) {
              resolve(element);
              return;
            }
            if (Date.now() - startedAt > timeout) {
              reject(new Error("Timed out waiting for text " + text + " in " + selector));
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
          await delay(160);
          return element;
        };
        const navigateRoute = async (id) => {
          const navButton = document.querySelector('[data-next-route="' + id + '"]');
          if (navButton) {
            navButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
            navButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
            navButton.click();
            await delay(160);
            return;
          }
          const nextHash = "#" + id;
          if (window.location.hash !== nextHash) {
            window.location.hash = nextHash;
          } else {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          }
          await delay(180);
        };
        const setNativeValue = (element, value) => {
          const prototype = element instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : element instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
          descriptor.set.call(element, value);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const storageValue = (payload) => payload && typeof payload === "object" && "value" in payload ? payload.value : payload;
        const today = (() => {
          const date = new Date();
          return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
        })();

        if (!window.workbench) {
          throw new Error("window.workbench is missing.");
        }

        await navigateRoute("tasks");
        await waitFor('[data-phase-six-route="tasks"]');
        await waitFor('[data-top-nav] [data-r15-task-new]');
        if (document.querySelector('[data-r1-task-title]')) {
          throw new Error("Task create form should not live in the task center side panel before opening the dialog.");
        }
        await click('[data-r15-task-new]');
        await waitFor('[data-r15-task-dialog="create"]');
        setNativeValue(await waitFor('[data-r1-task-title]'), "Smoke R1 Task");
        setNativeValue(await waitFor('[data-r1-task-detail]'), "Created by R1 smoke.");
        setNativeValue(await waitFor('[data-r1-task-date]'), today);
        setNativeValue(await waitFor('[data-r1-task-time]'), "09:30");
        setNativeValue(await waitFor('[data-r1-task-priority]'), "high");
        const createButton = await waitFor('[data-r1-task-create]');
        if (createButton.disabled) throw new Error("R1 task create button stayed disabled.");
        createButton.click();
        const taskItem = await waitForText('[data-r1-task-item]', "Smoke R1 Task");
        const taskId = taskItem.getAttribute("data-r1-task-item");
        let tasksPayload = storageValue(await window.workbench.readStorage("tasks"));
        let smokeTask = Array.isArray(tasksPayload) ? tasksPayload.find((task) => task.title === "Smoke R1 Task") : null;
        if (!smokeTask || smokeTask.status !== "todo" || smokeTask.scheduledTime !== "09:30") {
          throw new Error("Created task was not persisted correctly: " + JSON.stringify(smokeTask));
        }
        await click('[data-r1-task-status-toggle="' + taskId + '"]');
        await waitFor('[data-r1-task-status-value="' + taskId + '"]');
        tasksPayload = storageValue(await window.workbench.readStorage("tasks"));
        smokeTask = Array.isArray(tasksPayload) ? tasksPayload.find((task) => task.id === taskId) : null;
        if (!smokeTask || smokeTask.status !== "doing") {
          throw new Error("Task status was not persisted after toggle: " + JSON.stringify(smokeTask));
        }

        await click('[data-next-route="lobby"]');
        await click('[data-lobby-section-tab="profile"]');
        await click('[data-lobby-profile-edit]');
        await waitFor('[data-phase-six-route="profile"]');
        const seededAvatar = await waitFor('[data-r1-profile-avatar] img');
        if (!seededAvatar.getAttribute("src")?.startsWith("data:image/")) {
          throw new Error("Seeded profile avatar was not rendered.");
        }
        await waitFor('[data-r1-profile-title-chip="round-table-1"]');
        await click('[data-r1-profile-title-chip="round-table-1"]');
        await waitForText('[data-r1-profile-status]', "称号已更新");
        const developerIdInput = await waitFor('[data-r1-profile-developer-id]');
        if (!developerIdInput.disabled || developerIdInput.value !== "1") {
          throw new Error("Developer ID should be registration-locked and read-only: " + developerIdInput.outerHTML);
        }
        const levelInput = await waitFor('[data-r1-profile-level]');
        if (!levelInput.disabled || levelInput.value !== "3") {
          throw new Error("Profile level should be read-only display: " + levelInput.outerHTML);
        }
        if (document.querySelector('[data-r1-profile-title]')) {
          throw new Error("Profile must not expose a custom title input.");
        }
        const titleCurrent = await waitFor('[data-r1-profile-title-current]');
        if (!titleCurrent.textContent.includes("圆桌骑士1/150")) {
          throw new Error("Profile current title display did not reflect unlocked title selection: " + titleCurrent.textContent);
        }
        setNativeValue(await waitFor('[data-r1-profile-display-name]'), "Smoke Developer");
        setNativeValue(await waitFor('[data-r1-profile-bio]'), "R1 profile write.");
        await click('[data-r1-profile-save]');
        await waitForText('[data-r1-profile-status]', "已保存");
        const profilePayload = storageValue(await window.workbench.readStorage("profile"));
        if (!profilePayload || profilePayload.displayName !== "Smoke Developer" || profilePayload.developerId !== "1" || profilePayload.title !== "开发者 / 圆桌骑士1/150") {
          throw new Error("Profile was not persisted correctly: " + JSON.stringify(profilePayload));
        }
        if (!profilePayload.avatarDataUrl?.startsWith("data:image/") || !profilePayload.wornTitleIds?.includes("round-table-1")) {
          throw new Error("Profile avatar/title state was not preserved: " + JSON.stringify(profilePayload));
        }
        await click('[data-next-route="lobby"]');
        await click('[data-lobby-section-tab="profile"]');
        const lobbyProfile = await waitFor('[data-lobby-profile-page]');
        if (!lobbyProfile.textContent.includes("Smoke Developer") || !lobbyProfile.textContent.includes("圆桌骑士1/150")) {
          throw new Error("Lobby did not render the persisted profile page: " + lobbyProfile.textContent);
        }
        if (lobbyProfile.querySelector('[data-lobby-profile-showcase-slot]') || lobbyProfile.textContent.includes("主页展示位")) {
          throw new Error("Lobby profile page should not render the removed showcase placeholder.");
        }
        await waitFor('[data-lobby-profile-edit]');

        await navigateRoute("plugins");
        await waitFor('[data-phase-six-route="plugins"]');
        await click('[data-r1-plugin-select="smoke-sidebar-widget"]');
        const detail = await waitFor('[data-r1-plugin-detail-id="smoke-sidebar-widget"]');
        if (!detail.textContent.includes("meodesk-sidebar-widget") || !detail.textContent.includes("index.html")) {
          throw new Error("Plugin detail panel did not expose runtime and entry: " + detail.textContent);
        }
        const disabledPluginActions = [...detail.querySelectorAll("button")]
          .map((button) => button.textContent.trim())
          .filter((label) => ["安装", "查看主页", "更新测试", "刷新", "关闭"].includes(label));
        if (disabledPluginActions.length) {
          throw new Error("Plugin detail must not expose disabled placeholder actions without a real owner: " + JSON.stringify(disabledPluginActions));
        }
        await waitFor('[data-r2-plugin-sidebar-preview="smoke-sidebar-widget"]');
        await waitFor('[data-r2-plugin-sidebar-preview-frame="smoke-sidebar-widget"]');

        return {
          scenario: "r1-functions",
          taskId,
          taskStatus: smokeTask.status,
          profileName: profilePayload.displayName,
          pluginId: detail.getAttribute("data-r1-plugin-detail-id")
        };
      })()
    `, true);
  }

}

async function runR15R2aFunctionsScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "r15-r2a-functions") {
    return win.webContents.executeJavaScript(`
      (async () => {
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const waitFor = (selector, timeout = 6000) => new Promise((resolve, reject) => {
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
        const waitForText = (selector, text, timeout = 6000) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            const elements = [...document.querySelectorAll(selector)];
            const element = elements.find((item) => (item.textContent || "").includes(text));
            if (element) {
              resolve(element);
              return;
            }
            if (Date.now() - startedAt > timeout) {
              reject(new Error("Timed out waiting for text " + text + " in " + selector));
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
          await delay(180);
          return element;
        };
        const navigateRoute = async (id) => {
          const navButton = document.querySelector('[data-next-route="' + id + '"]');
          if (navButton) {
            navButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
            navButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
            navButton.click();
            await delay(180);
            return;
          }
          const nextHash = "#" + id;
          if (window.location.hash !== nextHash) {
            window.location.hash = nextHash;
          } else {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          }
          await delay(220);
        };
        const storageValue = (payload) => payload && typeof payload === "object" && "value" in payload ? payload.value : payload;

        if (!window.workbench) {
          throw new Error("window.workbench is missing.");
        }
        for (const method of ["saveWorkflowDraft", "deleteWorkflowDraft", "dispatchWorkflowTask"]) {
          if (typeof window.workbench[method] === "function") {
            window.workbench[method] = () => {
              throw new Error("R1.5 workflow preview must not call window.workbench." + method);
            };
          }
        }

        await navigateRoute("tasks");
        const taskSurface = await waitFor('[data-r15-task-center]');
        if (taskSurface.scrollWidth > taskSurface.clientWidth + 1) {
          throw new Error("Task center has horizontal overflow: " + taskSurface.scrollWidth + " > " + taskSurface.clientWidth);
        }
        await waitFor('[data-top-nav] [data-r15-task-new]');
        if (document.querySelector('[data-r1-task-title], [data-r1-task-editor], [data-r1-task-today]')) {
          throw new Error("Task center should render only the board in the route body; create/edit/today panels must open from top-nav dialog.");
        }
        await waitFor('[data-r15-task-tab="ai"]');
        await waitFor('[data-r15-task-tab="mine"]');
        await waitFor('[data-r15-task-tab="today"]');
        await waitFor('[data-r15-task-tab="calendar"]');
        await waitFor('[data-r15-task-tab="week"]');
        await waitFor('[data-r15-task-tab="matrix"]');
        await waitFor('[data-r15-task-tab="habits"]');
        await waitFor('[data-r15-task-status-section="inbox"]');
        await waitFor('[data-r15-task-status-section="todo"]');
        await waitFor('[data-r15-task-status-section="doing"]');
        await waitFor('[data-r15-task-status-section="blocked"]');
        await waitFor('[data-r15-task-status-section="done"]');
        await waitFor('[data-r15-task-tag="agent"]');
        await waitForText('[data-r15-task-card]', "Smoke AI 待确认任务");
        await waitFor('[data-r15-task-source-icon="smoke-ai-inbox"]');
        await click('[data-r15-task-tab="mine"]');
        await waitFor('[data-r15-task-tag="personal"]');
        await waitForText('[data-r15-task-card]', "Smoke 我的进行中任务");
        await click('[data-r15-task-tab="calendar"]');
        await waitFor('[data-r15-task-calendar]');
        await waitFor('[data-r15-task-calendar-day]');
        await click('[data-r15-task-tab="week"]');
        await waitFor('[data-r15-task-week-view]');
        await waitFor('[data-r15-task-week-day]');
        await click('[data-r15-task-tab="today"]');
        await waitFor('[data-r15-task-day-schedule]');
        await waitForText('[data-r15-task-day-schedule]', "Smoke 我的进行中任务");
        await click('[data-r15-task-tab="matrix"]');
        await waitFor('[data-r15-task-matrix]');
        await waitFor('[data-r15-task-matrix-bucket="important-urgent"]');
        await click('[data-r15-task-tab="habits"]');
        await waitFor('[data-r15-task-habits]');
        const taskTabs = [...document.querySelectorAll("[data-r15-task-tab]")].map((item) => item.getAttribute("data-r15-task-tab"));

        if (document.querySelector('[data-next-route="workflow"]')) {
          throw new Error("Workflow route should stay archived outside MVP navigation.");
        }
        await navigateRoute("workflow");
        await delay(220);
        if (document.querySelector('[data-phase-six-route="workflow"], [data-r15-workflow-shell]')) {
          throw new Error("Workflow route should not mount in the MVP main baseline.");
        }
        await click('[data-next-route="studio"]');
        await click('[data-studio-inspector-panel-tab="runtime"]');
        const contract = await waitFor('[data-r2a-sidebar-iframe-host-contract]');
        const host = await waitFor('[data-r2a-sidebar-iframe-host="smoke-sidebar-widget"]');
        if (contract.querySelector("iframe")) {
          throw new Error("R2A host contract must not mount iframe in next renderer.");
        }
        if (contract.getAttribute("data-r2a-sidebar-iframe-mount") !== "contract-only") {
          throw new Error("R2A iframe mount boundary mismatch.");
        }
        if (contract.getAttribute("data-r2a-sidebar-iframe-message-bridge") !== "disabled") {
          throw new Error("R2A message bridge must stay disabled.");
        }
        if (host.getAttribute("data-r2a-sidebar-iframe-lifecycle") !== "not-mounted") {
          throw new Error("R2A iframe host lifecycle mismatch.");
        }

        await click('[data-next-route="workspace"]');
        const workspace = await waitFor('[data-r2-workspace-route]');
        if (workspace.getAttribute("data-r2-workspace-old-shape") !== "workspace-side-column") {
          throw new Error("Workspace route did not preserve old side-column shape marker.");
        }
        const panes = await waitFor('[data-r2-workspace-panes]');
        const sidebar = await waitFor('[data-r2-workspace-sidebar]');
        for (const count of [1, 2, 3, 4, 5, 6]) {
          await waitFor('[data-r2-workspace-slot-button="' + count + '"]');
        }
        await click('[data-r2-workspace-slot-button="3"]');
        await waitFor('[data-r2-workspace-slot-button="3"][data-r2-workspace-slot-active="true"]');
        if (panes.getAttribute("data-r2-workspace-pane-count") !== "3") {
          throw new Error("Workspace slot picker did not restore the old 3-window layout: " + panes.outerHTML);
        }
        await waitFor('[data-r2-workspace-frame]');
        await waitFor('[data-r2-workspace-side-column]');
        await waitFor('[data-r2-workspace-sidebar-manager]');
        const sidebarResizer = await waitFor('[data-r2-workspace-sidebar-resizer]');
        const boardResizer = await waitFor('[data-r2-workspace-board-resizer]');
        await waitFor('[data-r2-workspace-sidebar-toggle]');
        if (document.querySelector('[data-r2-workspace-sidebar-widgets]')) {
          throw new Error("Workspace should not enable workshop sidebar widgets by default.");
        }
        await click('[data-r2-workspace-sidebar-manager-button]');
        await waitFor('[data-r2-workspace-sidebar-manager-menu]');
        await waitFor('[data-r2-workspace-sidebar-widget-toggle="smoke-sidebar-widget"]');
        await click('[data-r2-workspace-sidebar-widget-toggle="smoke-sidebar-widget"]');
        const widgetZone = await waitFor('[data-r2-workspace-sidebar-widgets]');
        const widgetHost = await waitFor('[data-r2-workspace-widget-host="smoke-sidebar-widget"]');
        const widgetResizer = await waitFor('[data-r2-workspace-widget-resizer="smoke-sidebar-widget"]');
        await waitFor('[data-r2-workspace-widget-frame="smoke-sidebar-widget"][data-r2-workspace-widget-frame-mode="iframe-host"]');
        await waitFor('[data-r2-workspace-widget-iframe="smoke-sidebar-widget"]');
        await click('[data-r2-workspace-sidebar-manager-button]');
        const runtimePaneId = "blank-2";
        const blankConfigure = await waitFor('[data-r2-workspace-configure-pane="' + runtimePaneId + '"]');
        if (blankConfigure.disabled) {
          throw new Error("Workspace blank pane plus should open the old configure dialog instead of being disabled.");
        }
        await click('[data-r2-workspace-configure-pane="' + runtimePaneId + '"]');
        await waitFor('[data-r2-workspace-config-dialog]');
        await waitFor('[data-r2-workspace-config-tool="browser-preview"]');
        await waitFor('[data-r2-workspace-config-tool="smoke-terminal"]');
        await click('[data-r2-workspace-config-tool="smoke-terminal"]');
        await waitFor('[data-r2-workspace-pane="' + runtimePaneId + '"][data-r2-workspace-pane-configured="true"][data-r2-workspace-pane-kind="terminal"]');
        const configuredStart = await waitFor('[data-r2-terminal-start-panel="' + runtimePaneId + '"] [data-r2-terminal-start="' + runtimePaneId + '"]');
        if (configuredStart.disabled) {
          throw new Error("Configured workspace pane should become a launchable Agent/terminal pane.");
        }
        const petDock = await waitFor('[data-r2-workspace-pet-dock]');
        const petField = await waitFor('[data-r2-workspace-pet-field]');
        const petSprite = await waitFor('[data-r2-workspace-pet-sprite]');
        await waitFor('[data-r2-workspace-pet-quick-bar]');
        await waitFor('[data-r2-workspace-pet-status]');
        const petPanel = await waitFor('.meowdesk-workspace-pet');
        const petResizer = await waitFor('[data-r2-workspace-pet-resizer]');
        if (petDock.textContent.includes("Meowdesk dock")) {
          throw new Error("Workspace pet dock regressed to the placeholder label instead of the restored pet field.");
        }
        await delay(260);
        if (!document.querySelector('[data-r2-workspace-widget-host="smoke-sidebar-widget"] iframe')) {
          throw new Error("Workspace sidebar widget host did not mount the R2 iframe runtime.");
        }
        const workspaceRect = workspace.getBoundingClientRect();
        const sidebarRect = sidebar.getBoundingClientRect();
        const panesRect = panes.getBoundingClientRect();
        const widgetRect = widgetHost.getBoundingClientRect();
        if (sidebarRect.width < 260 || sidebarRect.width > 360) {
          throw new Error("Workspace sidebar width is not close to old Meowdesk side column: " + Math.round(sidebarRect.width));
        }
        const sidebarOverflowY = getComputedStyle(sidebar).overflowY;
        if (sidebarOverflowY !== "hidden") {
          throw new Error("Workspace right sidebar should not expose its own vertical scrollbar: " + sidebarOverflowY);
        }
        if (sidebar.scrollHeight > sidebar.clientHeight + 1) {
          throw new Error("Workspace right sidebar should fit visible modules after default auto-sizing: " + JSON.stringify({
            clientHeight: sidebar.clientHeight,
            scrollHeight: sidebar.scrollHeight
          }));
        }
        const taskBoard = await waitFor('[data-r2-workspace-task-board]');
        const taskBoardViewport = taskBoard.parentElement?.getBoundingClientRect();
        const debugRect = (rect) => rect ? {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        } : null;
        const clippedTaskRows = taskBoardViewport ? [...taskBoard.children].filter((row) => {
          const rect = row.getBoundingClientRect();
          return rect.bottom > taskBoardViewport.bottom + 1 || rect.top < taskBoardViewport.top - 1;
        }).length : 0;
        if (clippedTaskRows) {
          throw new Error("Workspace priority board rows should fit without being clipped: " + JSON.stringify({
            clippedTaskRows,
            viewport: debugRect(taskBoardViewport),
            board: debugRect(taskBoard.getBoundingClientRect()),
            children: [...taskBoard.children].map((row) => ({
              attr: row.getAttribute("data-r2-workspace-task-summary")
                || row.getAttribute("data-r2-workspace-task-list")
                || row.getAttribute("data-r2-workspace-task-status")
                || row.tagName,
              rect: debugRect(row.getBoundingClientRect())
            }))
          }));
        }
        await waitFor('[data-r2-workspace-task-card="smoke-ai-inbox"]');
        const workspaceTaskBoardActiveCount = Number(taskBoard.getAttribute("data-r2-workspace-task-active-count") || 0);
        if (workspaceTaskBoardActiveCount < 3) {
          throw new Error("Workspace priority board should read the same task storage as task center: " + workspaceTaskBoardActiveCount);
        }
        await click('[data-r2-workspace-task-action-id="smoke-ai-inbox"][data-r2-workspace-task-action="accept"]');
        await waitFor('[data-r2-workspace-task-card="smoke-ai-inbox"][data-r2-workspace-task-card-status="todo"]');
        const workspaceTaskPayload = storageValue(await window.workbench.readStorage("tasks"));
        const linkedWorkspaceTask = Array.isArray(workspaceTaskPayload) ? workspaceTaskPayload.find((task) => task.id === "smoke-ai-inbox") : null;
        if (!linkedWorkspaceTask || linkedWorkspaceTask.status !== "todo") {
          throw new Error("Workspace priority board action did not persist back to task center storage: " + JSON.stringify(linkedWorkspaceTask));
        }
        const petDockRect = petDock.getBoundingClientRect();
        const petDockViewport = petDock.parentElement?.getBoundingClientRect();
        if (petDockViewport && (petDockRect.bottom > petDockViewport.bottom + 1 || petDockRect.top < petDockViewport.top - 1)) {
          throw new Error("Workspace pet dock should fit inside its panel body: " + JSON.stringify({
            dock: {
              top: Math.round(petDockRect.top),
              bottom: Math.round(petDockRect.bottom),
              height: Math.round(petDockRect.height)
            },
            viewport: {
              top: Math.round(petDockViewport.top),
              bottom: Math.round(petDockViewport.bottom),
              height: Math.round(petDockViewport.height)
            }
          }));
        }
        const clippedPetDockItems = [...petDock.children].filter((item) => {
          const rect = item.getBoundingClientRect();
          return rect.bottom > petDockRect.bottom + 1 || rect.top < petDockRect.top - 1;
        }).length;
        if (clippedPetDockItems) {
          throw new Error("Workspace pet dock content should fit without being clipped: " + clippedPetDockItems);
        }
        const petFieldRect = petField.getBoundingClientRect();
        const petSpriteRect = petSprite.getBoundingClientRect();
        if (petFieldRect.height < 40 || petSpriteRect.width < 28 || petSpriteRect.height < 28) {
          throw new Error("Workspace pet field should expose a visible pet sprite: " + JSON.stringify({
            field: {
              top: Math.round(petFieldRect.top),
              height: Math.round(petFieldRect.height)
            },
            sprite: {
              top: Math.round(petSpriteRect.top),
              height: Math.round(petSpriteRect.height)
            }
          }));
        }
        if (!petSprite.getAttribute("data-r2-workspace-pet-package")) {
          throw new Error("Workspace pet sprite should be backed by a real pet package.");
        }
        const petCanvas = petSprite.querySelector("canvas");
        if (!petCanvas || petCanvas.width <= 0 || petCanvas.height <= 0) {
          throw new Error("Workspace pet sprite should draw the legacy spritesheet on canvas.");
        }
        if (document.querySelector(".meowdesk-workspace-pet-badge")) {
          throw new Error("Workspace pet sprite should not render the compressed badge under the pet.");
        }
        const petFieldGroundLine = getComputedStyle(petField, "::before");
        if (petFieldGroundLine.display !== "none") {
          throw new Error("Workspace pet field should not leave a stray line under the pet: " + petFieldGroundLine.display);
        }
        const dispatchPointer = (target, type, props) => {
          const EventCtor = window.PointerEvent || window.MouseEvent;
          const isUp = type === "pointerup" || type === "mouseup";
          target.dispatchEvent(new EventCtor(type, {
            bubbles: true,
            cancelable: true,
            pointerId: props.pointerId || 1,
            button: 0,
            buttons: isUp ? 0 : 1,
            clientX: props.clientX || 0,
            clientY: props.clientY || 0
          }));
        };
        const petDragStartRect = petSprite.getBoundingClientRect();
        dispatchPointer(petSprite, "pointerdown", {
          pointerId: 6,
          clientX: petDragStartRect.left + Math.min(18, petDragStartRect.width / 2),
          clientY: petDragStartRect.top + Math.min(18, petDragStartRect.height / 2)
        });
        await delay(60);
        if (!petSprite.classList.contains("is-dragging") || petSprite.getAttribute("data-r2-workspace-pet-interaction") !== "jump") {
          throw new Error("Workspace pet drag should start with jump animation state: " + JSON.stringify({
            dragging: petSprite.classList.contains("is-dragging"),
            interaction: petSprite.getAttribute("data-r2-workspace-pet-interaction")
          }));
        }
        const dragCanvas = petSprite.querySelector(".meowdesk-workspace-pet-canvas");
        const dragAnimationName = dragCanvas ? getComputedStyle(dragCanvas).animationName : "";
        if (!dragAnimationName.includes("workspace-pet-drag-hop")) {
          throw new Error("Workspace pet drag should visibly run the drag-hop animation: " + dragAnimationName);
        }
        if (petSprite.textContent.includes("跳跃")) {
          throw new Error("Workspace pet drag should animate without showing a jump text bubble.");
        }
        dispatchPointer(petSprite, "pointermove", {
          pointerId: 6,
          clientX: petDragStartRect.left + Math.min(18, petDragStartRect.width / 2) + 42,
          clientY: petDragStartRect.top + Math.min(18, petDragStartRect.height / 2) + 18
        });
        dispatchPointer(petSprite, "pointerup", {
          pointerId: 6,
          clientX: petDragStartRect.left + Math.min(18, petDragStartRect.width / 2) + 42,
          clientY: petDragStartRect.top + Math.min(18, petDragStartRect.height / 2) + 18
        });
        await delay(80);
        const petDragEndRect = petSprite.getBoundingClientRect();
        if (
          petSprite.getAttribute("data-r2-workspace-pet-manual-position") !== "true" ||
          Math.abs(petDragEndRect.left - petDragStartRect.left) < 20 ||
          Math.abs(petDragEndRect.top - petDragStartRect.top) < 8
        ) {
          throw new Error("Workspace pet sprite should inherit old free drag behavior: " + JSON.stringify({
            before: { left: Math.round(petDragStartRect.left), top: Math.round(petDragStartRect.top) },
            after: { left: Math.round(petDragEndRect.left), top: Math.round(petDragEndRect.top) },
            manual: petSprite.getAttribute("data-r2-workspace-pet-manual-position"),
            dataX: petSprite.getAttribute("data-r2-workspace-pet-x"),
            dataY: petSprite.getAttribute("data-r2-workspace-pet-y"),
            styleX: petSprite.style.getPropertyValue("--r2-workspace-pet-x"),
            styleY: petSprite.style.getPropertyValue("--r2-workspace-pet-y"),
            className: petSprite.className,
            outerHTML: petSprite.outerHTML.slice(0, 500)
          }));
        }
        const beforeSidebarWidth = sidebar.getBoundingClientRect().width;
        const resizeX = sidebarResizer.getBoundingClientRect().left + 6;
        const sidebarDelta = beforeSidebarWidth > 480 ? 96 : -96;
        window.dispatchEvent(new CustomEvent("meowdesk:workspace-resize", {
          detail: { target: "sidebar", deltaX: -sidebarDelta }
        }));
        await delay(80);
        const afterSidebarWidth = sidebar.getBoundingClientRect().width;
        if (Math.abs(afterSidebarWidth - beforeSidebarWidth) <= 56) {
          const currentSidebarResizer = document.querySelector('[data-r2-workspace-sidebar-resizer]');
          const workspaceStyle = getComputedStyle(workspace);
          throw new Error("Workspace sidebar width resizer did not inherit the old draggable sizing behavior: " + JSON.stringify({
            before: Math.round(beforeSidebarWidth),
            after: Math.round(afterSidebarWidth),
            dataWidth: workspace.getAttribute("data-r2-workspace-sidebar-width"),
            inlineWidth: workspace.style.getPropertyValue("--r2-workspace-sidebar-width"),
            computedWidth: workspaceStyle.getPropertyValue("--r2-workspace-sidebar-width"),
            gridTemplateColumns: workspaceStyle.gridTemplateColumns,
            connected: sidebarResizer.isConnected,
            sameNode: sidebarResizer === currentSidebarResizer,
            currentConnected: Boolean(currentSidebarResizer?.isConnected),
            rect: debugRect(sidebarResizer.getBoundingClientRect()),
            currentRect: debugRect(currentSidebarResizer?.getBoundingClientRect?.())
          }));
        }
        const beforeBoardHeight = (await waitFor('.meowdesk-workspace-board')).getBoundingClientRect().height;
        const resizeY = boardResizer.getBoundingClientRect().top + 4;
        const boardDelta = beforeBoardHeight > 300 ? -42 : 42;
        window.dispatchEvent(new CustomEvent("meowdesk:workspace-resize", {
          detail: { target: "board", deltaY: boardDelta }
        }));
        await delay(80);
        const afterBoardHeight = (await waitFor('.meowdesk-workspace-board')).getBoundingClientRect().height;
        if (Math.abs(afterBoardHeight - beforeBoardHeight) <= 20) {
          throw new Error("Workspace board resizer did not restore old side-column height dragging: " + JSON.stringify({
            before: Math.round(beforeBoardHeight),
            after: Math.round(afterBoardHeight)
          }));
        }
        const beforeWidgetHeight = widgetHost.getBoundingClientRect().height;
        const widgetResizeY = widgetResizer.getBoundingClientRect().top + 4;
        dispatchPointer(widgetResizer, "pointerdown", { pointerId: 9, clientX: 1400, clientY: widgetResizeY });
        dispatchPointer(widgetResizer, "pointermove", { pointerId: 9, clientX: 1400, clientY: widgetResizeY + 44 });
        dispatchPointer(widgetResizer, "pointerup", { pointerId: 9, clientX: 1400, clientY: widgetResizeY + 44 });
        await delay(80);
        const afterWidgetHeight = widgetHost.getBoundingClientRect().height;
        if (Math.abs(afterWidgetHeight - beforeWidgetHeight) <= 20) {
          throw new Error("Workspace sidebar widget did not keep old independent height resizing: " + JSON.stringify({
            before: Math.round(beforeWidgetHeight),
            after: Math.round(afterWidgetHeight)
          }));
        }
        const beforePetHeight = petPanel.getBoundingClientRect().height;
        const petResizeY = petResizer.getBoundingClientRect().top + 4;
        window.dispatchEvent(new CustomEvent("meowdesk:workspace-resize", {
          detail: { target: "pet", deltaY: 36 }
        }));
        await delay(80);
        const afterPetHeight = petPanel.getBoundingClientRect().height;
        if (Math.abs(afterPetHeight - beforePetHeight) <= 16) {
          throw new Error("Workspace pet dock did not keep old independent height resizing: " + JSON.stringify({
            before: Math.round(beforePetHeight),
            after: Math.round(afterPetHeight)
          }));
        }
        if (panesRect.width <= sidebarRect.width * 1.6) {
          throw new Error("Workspace main panes no longer dominate the desktop: " + JSON.stringify({
            panes: Math.round(panesRect.width),
            sidebar: Math.round(sidebarRect.width)
          }));
        }
        const workspacePaneItems = [...document.querySelectorAll("[data-r2-workspace-pane]")];
        if (workspacePaneItems.length !== 3) {
          throw new Error("Workspace 3-window layout should render 1 main + 2 secondary panes: " + workspacePaneItems.length);
        }
        const dragPaneOnto = async (fromId, toId) => {
          const dragHandle = await waitFor('[data-r2-workspace-pane-drag="' + fromId + '"]');
          const dropTarget = await waitFor('[data-r2-workspace-pane="' + toId + '"]');
          if (typeof DataTransfer === "function" && typeof DragEvent === "function") {
            const dataTransfer = new DataTransfer();
            dragHandle.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
            dropTarget.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
            dropTarget.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
            dragHandle.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer }));
          } else {
            dragHandle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
          }
          await delay(140);
        };
        const originalFirstPaneId = workspacePaneItems[0].getAttribute("data-r2-workspace-pane");
        await dragPaneOnto(runtimePaneId, originalFirstPaneId);
        await waitFor('[data-r2-workspace-pane="' + runtimePaneId + '"][data-r2-workspace-pane-order-index="0"]');
        await dragPaneOnto(runtimePaneId, originalFirstPaneId);
        await waitFor('[data-r2-workspace-pane="' + runtimePaneId + '"][data-r2-workspace-pane-order-index="1"]');
        const terminalStartPanel = await waitFor('[data-r2-terminal-start-panel="' + runtimePaneId + '"]');
        const terminalStart = await waitFor('[data-r2-terminal-start-panel="' + runtimePaneId + '"] [data-r2-terminal-start="' + runtimePaneId + '"]');
        if (terminalStart.disabled) {
          throw new Error("R2 terminal center start button should be enabled for the seeded terminal.");
        }
        const idleTerminalHost = await waitFor('[data-r2-terminal-host="' + runtimePaneId + '"]');
        const idleHostStyle = getComputedStyle(idleTerminalHost);
        if (idleHostStyle.opacity !== "0" || idleHostStyle.pointerEvents !== "none") {
          throw new Error("R2 idle terminal host should stay visually hidden behind the center start panel: " + JSON.stringify({
            opacity: idleHostStyle.opacity,
            pointerEvents: idleHostStyle.pointerEvents
          }));
        }
        const startRect = terminalStart.getBoundingClientRect();
        const startCenterElement = document.elementFromPoint(startRect.left + startRect.width / 2, startRect.top + startRect.height / 2);
        if (!terminalStart.contains(startCenterElement)) {
          throw new Error("R2 terminal center start button is visually occluded: " + terminalStartPanel.outerHTML.slice(0, 260));
        }
        await waitFor('[data-r2-workspace-pane-hide="' + runtimePaneId + '"]');
        await waitFor('[data-r2-workspace-pane-close="' + runtimePaneId + '"]');
        await click('[data-r2-terminal-start="' + runtimePaneId + '"]');
        const terminalRuntime = await waitFor('[data-r2-terminal-runtime="' + runtimePaneId + '"][data-r2-terminal-runtime-status="running"]', 8000);
        const terminalHost = await waitFor('[data-r2-terminal-host="' + runtimePaneId + '"]');
        const activePetSprite = await waitFor('[data-r2-workspace-pet-sprite="' + runtimePaneId + '"][data-r2-workspace-pet-sprite-status="active"]', 8000);
        await delay(260);
        if (!terminalRuntime.getAttribute("data-r2-terminal-output-sample").includes("MEOWDESK_R2_TERMINAL_OK")) {
          throw new Error("R2 terminal runtime did not receive stdout from old IPC: " + terminalRuntime.getAttribute("data-r2-terminal-output-sample"));
        }
        await delay(360);
        const terminalCols = Number(terminalHost.getAttribute("data-r2-terminal-cols") || 0);
        const terminalRows = Number(terminalHost.getAttribute("data-r2-terminal-rows") || 0);
        const terminalOutputSample = terminalRuntime.getAttribute("data-r2-terminal-output-sample") || "";
        const cleanTerminalOutputSample = terminalOutputSample.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
        const terminalStartupSize = cleanTerminalOutputSample.match(/MEOWDESK_R2_TERMINAL_OK\\s+cols=(\\d+)\\s+rows=(\\d+)/);
        if (!terminalStartupSize) {
          throw new Error("R2 terminal smoke should report PTY startup dimensions: " + terminalOutputSample);
        }
        const startupCols = Number(terminalStartupSize[1] || 0);
        const startupRows = Number(terminalStartupSize[2] || 0);
        if (Math.abs(startupCols - terminalCols) > 2 || Math.abs(startupRows - terminalRows) > 2) {
          throw new Error("R2 terminal PTY should start with the fitted xterm dimensions instead of a stale fixed size: " + JSON.stringify({
            startupCols,
            startupRows,
            cols: terminalCols,
            rows: terminalRows
          }));
        }
        const terminalHostRect = terminalHost.getBoundingClientRect();
        const expectedTerminalCols = Math.max(20, Math.floor(terminalHostRect.width / 10));
        const expectedTerminalRows = Math.max(8, Math.floor(terminalHostRect.height / 22));
        if (terminalCols < expectedTerminalCols || terminalRows < expectedTerminalRows) {
          throw new Error("R2 terminal should fit its visible pane immediately after startup: " + JSON.stringify({
            cols: terminalCols,
            rows: terminalRows,
            expectedCols: expectedTerminalCols,
            expectedRows: expectedTerminalRows,
            host: {
              width: Math.round(terminalHostRect.width),
              height: Math.round(terminalHostRect.height)
            }
          }));
        }
        const petMotionSamples = [];
        const movingPetStartedAt = Date.now();
        while (Date.now() - movingPetStartedAt < 1200) {
          const rect = activePetSprite.getBoundingClientRect();
          petMotionSamples.push({
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            motion: activePetSprite.getAttribute("data-r2-workspace-pet-motion"),
            facing: activePetSprite.getAttribute("data-r2-workspace-pet-facing"),
            frameDx: Number(activePetSprite.getAttribute("data-r2-workspace-pet-frame-dx") || 0)
          });
          await delay(120);
        }
        const petLeftValues = petMotionSamples.map((sample) => sample.left);
        const petMovedDistance = Math.max(...petLeftValues) - Math.min(...petLeftValues);
        const petMovingFrames = petMotionSamples.filter((sample) => sample.motion === "moving" && Math.abs(sample.frameDx) > 0.1).length;
        if (petMovedDistance < 8 || petMovingFrames < 2) {
          throw new Error("Workspace active pet should move like the old actor loop: " + JSON.stringify({
            movedDistance: petMovedDistance,
            movingFrames: petMovingFrames,
            samples: petMotionSamples
          }));
        }
        const bounceFacingBefore = activePetSprite.getAttribute("data-r2-workspace-pet-facing") || "right";
        const bounceFieldRect = petField.getBoundingClientRect();
        const bounceSpriteRect = activePetSprite.getBoundingClientRect();
        const bounceOffsetX = Math.min(18, bounceSpriteRect.width / 2);
        const bounceOffsetY = Math.min(18, bounceSpriteRect.height / 2);
        const bounceTargetX = bounceFacingBefore === "left"
          ? 0
          : Math.max(0, bounceFieldRect.width - bounceSpriteRect.width);
        const bounceTargetY = Math.max(0, Math.min(
          Math.max(0, bounceFieldRect.height - bounceSpriteRect.height),
          bounceSpriteRect.top - bounceFieldRect.top
        ));
        dispatchPointer(activePetSprite, "pointerdown", {
          pointerId: 12,
          clientX: bounceSpriteRect.left + bounceOffsetX,
          clientY: bounceSpriteRect.top + bounceOffsetY
        });
        dispatchPointer(activePetSprite, "pointermove", {
          pointerId: 12,
          clientX: bounceFieldRect.left + bounceTargetX + bounceOffsetX,
          clientY: bounceFieldRect.top + bounceTargetY + bounceOffsetY
        });
        dispatchPointer(activePetSprite, "pointerup", {
          pointerId: 12,
          clientX: bounceFieldRect.left + bounceTargetX + bounceOffsetX,
          clientY: bounceFieldRect.top + bounceTargetY + bounceOffsetY
        });
        const bounceExpectedFacing = bounceFacingBefore === "left" ? "right" : "left";
        const bounceStartedAt = Date.now();
        while (activePetSprite.getAttribute("data-r2-workspace-pet-facing") !== bounceExpectedFacing) {
          if (Date.now() - bounceStartedAt > 1800) {
            throw new Error("Workspace active pet should turn around when it hits the field edge: " + JSON.stringify({
              beforeFacing: bounceFacingBefore,
              expectedFacing: bounceExpectedFacing,
              actualFacing: activePetSprite.getAttribute("data-r2-workspace-pet-facing"),
              x: activePetSprite.getAttribute("data-r2-workspace-pet-x"),
              fieldWidth: Math.round(bounceFieldRect.width)
            }));
          }
          await delay(50);
        }
        const petClickRect = activePetSprite.getBoundingClientRect();
        dispatchPointer(activePetSprite, "pointerdown", {
          pointerId: 11,
          clientX: petClickRect.left + Math.min(18, petClickRect.width / 2),
          clientY: petClickRect.top + Math.min(18, petClickRect.height / 2)
        });
        dispatchPointer(activePetSprite, "pointerup", {
          pointerId: 11,
          clientX: petClickRect.left + Math.min(18, petClickRect.width / 2),
          clientY: petClickRect.top + Math.min(18, petClickRect.height / 2)
        });
        await waitFor('[data-r2-workspace-pet-sprite="' + runtimePaneId + '"][data-r2-workspace-pet-interaction="jump"]', 1200);
        if (!activePetSprite.classList.contains("is-jumping")) {
          throw new Error("Workspace pet click should keep the jump animation state.");
        }
        if (activePetSprite.textContent.includes("跳跃")) {
          throw new Error("Workspace pet click should animate without showing a jump text bubble.");
        }
        await delay(1200);
        if (terminalRuntime.getAttribute("data-r2-terminal-runtime-status") === "starting") {
          throw new Error("R2 terminal runtime stayed in starting after stdout.");
        }
        const firstPaneRect = workspacePaneItems[0].getBoundingClientRect();
        const secondPaneRect = workspacePaneItems[1].getBoundingClientRect();
        if (firstPaneRect.height < secondPaneRect.height * 1.55) {
          throw new Error("Workspace 3-window layout lost the old main-pane span: " + JSON.stringify({
            first: Math.round(firstPaneRect.height),
            second: Math.round(secondPaneRect.height)
          }));
        }
        const maximizeTargetId = workspacePaneItems[1].getAttribute("data-r2-workspace-pane");
        await click('[data-r2-workspace-pane-maximize="' + maximizeTargetId + '"]');
        await waitFor('[data-r2-workspace-pane="' + maximizeTargetId + '"][data-r2-workspace-pane-maximized="true"]');
        const visiblePaneItems = [...document.querySelectorAll("[data-r2-workspace-pane]")]
          .filter((pane) => pane.getClientRects().length && pane.getBoundingClientRect().width > 10 && pane.getBoundingClientRect().height > 10);
        if (visiblePaneItems.length !== 1 || visiblePaneItems[0].getAttribute("data-r2-workspace-pane") !== maximizeTargetId) {
          throw new Error("Workspace pane maximize should leave exactly one visible work window: " + JSON.stringify(visiblePaneItems.map((pane) => pane.getAttribute("data-r2-workspace-pane"))));
        }
        if (workspace.getAttribute("data-r2-workspace-maximized-pane") !== maximizeTargetId) {
          throw new Error("Workspace did not expose maximized pane marker: " + workspace.outerHTML.slice(0, 260));
        }
        await click('[data-r2-workspace-pane-maximize="' + maximizeTargetId + '"]');
        await delay(80);
        if (workspace.getAttribute("data-r2-workspace-maximized-pane")) {
          throw new Error("Workspace pane maximize button did not restore the multi-window layout.");
        }
        await click('[data-r2-workspace-pane-hide="' + runtimePaneId + '"]');
        await waitFor('[data-r2-workspace-pane-restore="' + runtimePaneId + '"]');
        if (document.querySelector('[data-r2-workspace-pane="' + runtimePaneId + '"]')) {
          throw new Error("Workspace hidden pane should be removed from the main grid DOM instead of kept as a hidden terminal owner.");
        }
        await click('[data-r2-workspace-pane-restore="' + runtimePaneId + '"]');
        await delay(80);
        if (!document.querySelector('[data-r2-workspace-pane="' + runtimePaneId + '"]')) {
          throw new Error("Workspace pane hide tray did not restore the hidden pane.");
        }
        if (widgetRect.height < 180) {
          throw new Error("Workspace sidebar widget card lost old minimum height: " + Math.round(widgetRect.height));
        }
        if (widgetZone.getAttribute("data-r2-workspace-sidebar-widget-count") === "0") {
          throw new Error("Workspace sidebar widget zone did not pick up seeded sidebar widget.");
        }
        await click('[data-r2-workspace-sidebar-manager-button]');
        await waitFor('[data-r2-workspace-sidebar-manager-menu]');
        await waitFor('[data-r2-workspace-sidebar-builtin="board"]');
        await waitFor('[data-r2-workspace-sidebar-manager-widget="smoke-sidebar-widget"]');
        await click('[data-r2-workspace-sidebar-toggle]');
        await delay(80);
        if (!workspace.classList.contains("is-sidebar-collapsed")) {
          throw new Error("Workspace sidebar collapse tab did not collapse the side column.");
        }
        await click('[data-r2-workspace-sidebar-toggle]');
        await delay(80);
        if (workspace.classList.contains("is-sidebar-collapsed")) {
          throw new Error("Workspace sidebar collapse tab did not reopen the side column.");
        }
        await click('[data-r2-workspace-widget-close="smoke-sidebar-widget"]');
        await delay(100);
        if (document.querySelector('[data-r2-workspace-widget-host="smoke-sidebar-widget"]')) {
          throw new Error("Workspace sidebar widget close should remove the widget card instead of leaving a blank slot.");
        }
        if (document.querySelector('[data-r2-workspace-sidebar-widgets]')) {
          throw new Error("Workspace sidebar widget zone should collapse when no widgets remain.");
        }
        const assertSurfaceCloseHoverTrigger = async (selector, label) => {
          const dialog = await waitFor(selector);
          const warning = await waitFor(selector + ' .vs-surface-close-warning');
          const content = await waitFor(selector + ' .vs-surface-close-content');
          if (
            dialog.getAttribute("data-meow-warning-owner") !== "meowdesk-warning-dialog" ||
            dialog.getAttribute("data-meow-warning-family") !== "flip-confirm-card" ||
            !warning.hasAttribute("data-meow-warning-icon") ||
            !content.hasAttribute("data-meow-warning-content")
          ) {
            throw new Error(label + " close dialog should use the shared warning dialog owner/family: " + JSON.stringify({
              owner: dialog.getAttribute("data-meow-warning-owner") || "",
              family: dialog.getAttribute("data-meow-warning-family") || "",
              variant: dialog.getAttribute("data-meow-warning-variant") || "",
              hasIcon: warning.hasAttribute("data-meow-warning-icon"),
              hasContent: content.hasAttribute("data-meow-warning-content")
            }));
          }
          await delay(120);
          const initialWarningStyle = getComputedStyle(warning);
          const initialContentStyle = getComputedStyle(content);
          const warningRect = warning.getBoundingClientRect();
          if (
            dialog.getAttribute("data-vs-surface-close-expanded") === "true" ||
            initialWarningStyle.display === "none" ||
            warningRect.width <= 8 ||
            warningRect.height <= 8 ||
            Number(initialWarningStyle.opacity || "0") < 0.7 ||
            initialContentStyle.pointerEvents !== "none" ||
            Number(initialContentStyle.opacity || "1") > 0.2
          ) {
            throw new Error(label + " close dialog should start collapsed before hover/focus: " + JSON.stringify({
              dataset: { ...dialog.dataset },
              warning: { display: initialWarningStyle.display, opacity: initialWarningStyle.opacity, width: Math.round(warningRect.width), height: Math.round(warningRect.height) },
              content: { opacity: initialContentStyle.opacity, pointerEvents: initialContentStyle.pointerEvents, transform: initialContentStyle.transform }
            }));
          }
          dialog.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
          dialog.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
          const startedAt = Date.now();
          while (Date.now() - startedAt < 1800) {
            const style = getComputedStyle(content);
            if (dialog.getAttribute("data-vs-surface-close-expanded") === "true" && Number(style.opacity || "0") >= 0.8 && style.pointerEvents !== "none") {
              return;
            }
            await delay(50);
          }
          throw new Error(label + " close dialog did not expand on hover/focus: " + JSON.stringify({
            dataset: { ...dialog.dataset },
            content: { opacity: getComputedStyle(content).opacity, pointerEvents: getComputedStyle(content).pointerEvents, transform: getComputedStyle(content).transform }
          }));
        };
        await click('[data-r2-workspace-pane-close="' + runtimePaneId + '"]');
        await waitFor('[data-r2-workspace-close-dialog]');
        await assertSurfaceCloseHoverTrigger('[data-r2-workspace-close-dialog]', "Workspace pane");
        await click('[data-r2-workspace-pane-close-confirm="' + runtimePaneId + '"]');
        await delay(100);
        if (document.querySelector('[data-r2-workspace-pane="' + runtimePaneId + '"]')) {
          throw new Error("Workspace configured pane close should remove that visible slot instead of leaving a blank placeholder.");
        }
        if (panes.getAttribute("data-r2-workspace-pane-count") !== "2") {
          throw new Error("Workspace configured pane close should reduce the visible pane count: " + panes.getAttribute("data-r2-workspace-pane-count"));
        }
        await waitFor('[data-r2-workspace-slot-button="2"][data-r2-workspace-slot-active="true"]');
        if (document.querySelector('[data-r2-workspace-slot-button="3"][data-r2-workspace-slot-active="true"]')) {
          throw new Error("Workspace top slot picker should follow the reduced pane count after close.");
        }
        if (document.querySelector('[data-r2-terminal-runtime="' + runtimePaneId + '"]')) {
          throw new Error("Workspace configured pane close should unmount the terminal runtime.");
        }
        await click('[data-next-route="access"]');
        await waitFor('[data-r2-access-route]');
        await waitFor('[data-r2-access-menu]');
        await waitFor('[data-r2-access-menu-item="workspace"][data-r2-access-menu-active="true"]');
        await delay(260);
        const assertSettingsCardOwner = (selector, expected, label) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error("Missing Settings card owner target: " + selector);
          const decorated = element.classList.contains("vs-interactive-card");
          if (decorated !== expected) {
            throw new Error("Settings visual owner mismatch for " + label + ": " + JSON.stringify({
              selector,
              expectedInteractiveCard: expected,
              actualInteractiveCard: decorated,
              className: element.className
            }));
          }
        };
        assertSettingsCardOwner('[data-r2-access-menu-item="workspace"]', false, "settings menu item");
        assertSettingsCardOwner('[data-r2-agent-connect]', false, "agent connect form");
        assertSettingsCardOwner('[data-r2-agent-preset="claude"]', true, "agent preset object card");
        if (document.querySelector('[data-r2-access-menu-item="agent"]') || document.querySelector('[data-r2-access-section="agent"]')) {
          throw new Error("Settings should not keep a separate Access Agent section; tool control belongs under workspace configuration.");
        }
        await waitFor('[data-r2-access-tool-list]');
        await waitFor('[data-r2-access-advanced-tools]');
        if (document.querySelector('[data-r2-access-tool="smoke-terminal"]')) {
          throw new Error("Terminal tools should stay out of the normal Agent list.");
        }
        await waitFor('[data-r2-access-advanced-test-tool="smoke-terminal"]');
        await click('[data-r2-access-advanced-test-tool="smoke-terminal"]');
        await waitForText('[data-r2-access-test-result="smoke-terminal"]', "命令可运行", 5000);
        assertSettingsCardOwner('[data-r2-access-advanced-tool="smoke-terminal"]', true, "advanced tool object card");
        if (document.querySelector('[data-r2-pet-settings]')) {
          throw new Error("Pet settings should not render inside the workspace configuration section.");
        }
        await click('[data-r2-access-menu-item="appearance"]');
        await waitFor('[data-r2-access-section="appearance"]');
        await waitFor('[data-r2-access-theme-picker]');
        await delay(180);
        assertSettingsCardOwner('[data-r2-access-theme-option="dark"]', true, "theme option object card");
        await click('[data-r2-access-theme-option="dark"]');
        await waitFor('[data-meowdesk-theme="dark"]');
        await click('[data-r2-access-theme-option="light"]');
        await waitFor('[data-meowdesk-theme="light"]');
        await click('[data-r2-access-menu-item="workspace"]');
        await waitFor('[data-r2-access-section="workspace"]');
        await click('[data-r2-access-menu-item="advanced"]');
        await waitFor('[data-r2-access-section="advanced"]');
        const storageOpen = await waitFor('[data-r2-access-storage-open="home"]');
        if (storageOpen.disabled || !storageOpen.getAttribute("data-r2-access-storage-open-target")) {
          throw new Error("Settings advanced section should expose an enabled Meowdesk Home opener with a target path.");
        }
        await click('[data-r2-access-menu-item="obsidian"]');
        await waitFor('[data-r2-access-section="obsidian"]');
        const obsidianReader = await waitFor('[data-r2-access-obsidian-open-reader]');
        const obsidianDownload = await waitFor('[data-r2-access-obsidian-download]');
        if (obsidianDownload.getAttribute("data-r2-access-obsidian-download") !== "https://obsidian.md/download") {
          throw new Error("Settings Obsidian download button should keep the expected external target.");
        }
        obsidianReader.click();
        await delay(180);
        await waitFor('[data-r2-obsidian-route]');
        await click('[data-next-route="access"]');
        await click('[data-r2-access-menu-item="obsidian"]');
        await waitFor('[data-r2-access-section="obsidian"]');
        await click('[data-r2-access-menu-item="pets"]');
        await waitFor('[data-r2-pet-settings]');
        const petdex = await waitFor('[data-r2-pet-open-petdex]');
        if (petdex.getAttribute("data-r2-pet-open-petdex") !== "https://petdex-hazel.vercel.app/zh") {
          throw new Error("Settings pet section should keep the Petdex external target.");
        }
        await waitFor('[data-r2-pet-item="terminal"]');
        await delay(180);
        assertSettingsCardOwner('[data-r2-pet-item="terminal"]', true, "pet object card");
        await waitFor('[data-r2-pet-scale="terminal"]');
        const petFolder = await waitFor('[data-r2-pet-open-folder]');
        if (petFolder.disabled || !petFolder.getAttribute("data-r2-pet-open-folder-target")) {
          throw new Error("Settings pet section should expose an enabled local pet folder opener.");
        }
        await click('[data-r2-pet-refresh]');
        await waitForText('[data-r2-pet-settings-status]', "已读取", 5000);
        await click('[data-r2-pet-scale-step="terminal"][data-r2-pet-delta="0.1"]');
        await delay(240);
        const petScalesPayload = await window.workbench.readStorage("petScales");
        const petScales = petScalesPayload && typeof petScalesPayload === "object" && "value" in petScalesPayload ? petScalesPayload.value : petScalesPayload;
        if (!petScales || Math.round(Number(petScales.terminal) * 100) !== 110) {
          throw new Error("Settings pet scale control did not persist to old petScales storage: " + JSON.stringify(petScales));
        }
        await click('[data-r2-pet-direction-toggle="terminal"]');
        await delay(240);
        const petDirectionsPayload = await window.workbench.readStorage("petDirectionFixes");
        const petDirections = petDirectionsPayload && typeof petDirectionsPayload === "object" && "value" in petDirectionsPayload ? petDirectionsPayload.value : petDirectionsPayload;
        if (!petDirections || Number(petDirections.terminal) !== -1) {
          throw new Error("Settings pet direction control did not persist to old petDirectionFixes storage: " + JSON.stringify(petDirections));
        }
        await waitFor('[data-r15-theme-picker]');
        await click('[data-r15-theme-option="light"]');
        await waitFor('[data-meowdesk-theme="light"]');

        return {
          scenario: "r15-r2a-functions",
          taskTabs,
          iframeHost: host.getAttribute("data-r2a-sidebar-iframe-host")
        };
      })()
    `, true);
  }

}

async function runR3ProductSurfacesScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "r3-product-surfaces") {
    return win.webContents.executeJavaScript(`
      (async () => {
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const waitFor = (selector, timeout = 10000) => new Promise((resolve, reject) => {
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
        const waitForText = (selector, text, timeout = 10000) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            const element = document.querySelector(selector);
            if (element && element.textContent.includes(text)) {
              resolve(element);
              return;
            }
            if (Date.now() - startedAt > timeout) {
              reject(new Error("Timed out waiting for " + selector + " to include " + text));
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
          await delay(180);
          return element;
        };
        const navigateRoute = async (id) => {
          const navButton = document.querySelector('[data-next-route="' + id + '"]');
          if (navButton) {
            navButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
            navButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
            navButton.click();
            await delay(180);
            return;
          }
          const nextHash = "#" + id;
          if (window.location.hash !== nextHash) {
            window.location.hash = nextHash;
          } else {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          }
          await delay(220);
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        await navigateRoute("conversations");
        await waitFor('[data-r3-conversations-route]');
        const conversationItem = await waitFor('[data-r2-conversation-item="r3-local"]');
        await waitForText('[data-r3-conversation-messages="r3-local"]', "R3 对话正文已从本地 conversation JSON 读取。");
        const conversationTop = await waitFor('[data-r3-conversations-top-actions]');
        if (!conversationTop.textContent.includes("1 条")) {
          throw new Error("R3 conversation top actions did not read local count: " + conversationTop.textContent);
        }

        await navigateRoute("obsidian");
        const obsidianRoute = await waitFor('[data-r3-obsidian-route]');
        const obsidianFolder = await waitFor('[data-r3-obsidian-folder="Meowdesk"]');
        const obsidianFolderToggle = await waitFor('[data-r3-obsidian-folder="Meowdesk"] [data-r3-obsidian-folder-toggle]');
        const obsidianFileList = obsidianFolder?.querySelector('[data-r3-obsidian-file-list-collapsed]');
        if (obsidianFolder?.getAttribute("data-r3-obsidian-folder-collapsed") !== "true"
          || obsidianFileList?.getAttribute("data-r3-obsidian-file-list-collapsed") !== "true"
          || obsidianFileList?.querySelector('[data-r3-obsidian-file]')) {
          throw new Error("R3 Obsidian parent folders should be collapsed by default.");
        }
        obsidianFolderToggle.click();
        await delay(180);
        if (obsidianFolder?.getAttribute("data-r3-obsidian-folder-collapsed") !== "false"
          || obsidianFileList?.getAttribute("data-r3-obsidian-file-list-collapsed") !== "false") {
          throw new Error("R3 Obsidian parent folder should expand on first click.");
        }
        if (!obsidianFileList?.querySelector('[data-r3-obsidian-file]')) {
          throw new Error("R3 Obsidian expanded parent folder should render its own files.");
        }
        await waitFor('[data-r3-obsidian-note="当前上下文.md"]');
        await waitForText('[data-r3-obsidian-markdown]', "R3 Obsidian smoke fixture");
        await waitFor('.meowdesk-obsidian-h1');
        await waitFor('.meowdesk-obsidian-list');
        const wikiLink = await waitFor('[data-r3-obsidian-wiki-link]');
        wikiLink.click();
        await delay(220);
        await waitForText('[data-r3-obsidian-note]', "R3 记录");
        await waitForText('[data-r3-obsidian-markdown]', "Obsidian reader should render markdown blocks.");
        await waitFor('.meowdesk-obsidian-quote');
        const obsidianTopActions = await waitFor('[data-r3-obsidian-top-actions]');
        if (obsidianTopActions.textContent.includes("vault ready")) {
          throw new Error("R3 Obsidian top actions should not keep the redundant vault ready badge.");
        }
        if (document.querySelector('.meowdesk-obsidian-context-panel')) {
          throw new Error("R3 Obsidian should not keep the low-value right info panel.");
        }
        obsidianFolderToggle.click();
        await delay(180);
        const foldedFolder = document.querySelector('[data-r3-obsidian-folder="Meowdesk"]');
        const foldedList = foldedFolder?.querySelector('[data-r3-obsidian-file-list-collapsed]');
        const foldedListTransition = foldedList ? getComputedStyle(foldedList).transitionDuration : "";
        if (foldedFolder?.getAttribute("data-r3-obsidian-folder-collapsed") !== "true"
          || foldedList?.getAttribute("data-r3-obsidian-file-list-collapsed") !== "true"
          || foldedListTransition === "0s") {
          throw new Error("R3 Obsidian parent folder should collapse its children.");
        }
        obsidianFolderToggle.click();
        await delay(180);
        if (foldedFolder?.getAttribute("data-r3-obsidian-folder-collapsed") !== "false"
          || foldedList?.getAttribute("data-r3-obsidian-file-list-collapsed") !== "false"
          || !foldedList?.querySelector('[data-r3-obsidian-file]')) {
          throw new Error("R3 Obsidian parent folder should expand its children.");
        }
        if (foldedFolder?.getAttribute("data-r3-obsidian-folder-collapsed") === "true") {
          obsidianFolderToggle.click();
          await delay(280);
        }
        const obsidianOverflow = (() => {
          const note = document.querySelector('.meowdesk-obsidian-note-panel');
          return {
            routeClientWidth: obsidianRoute.clientWidth,
            routeScrollWidth: obsidianRoute.scrollWidth,
            noteClientWidth: note?.clientWidth || 0,
            noteScrollWidth: note?.scrollWidth || 0,
            bodyClientWidth: document.body.clientWidth,
            bodyScrollWidth: document.body.scrollWidth
          };
        })();
        if (obsidianOverflow.routeScrollWidth > obsidianOverflow.routeClientWidth + 1
          || obsidianOverflow.bodyScrollWidth > obsidianOverflow.bodyClientWidth + 1) {
          throw new Error("R3 Obsidian horizontal overflow: " + JSON.stringify(obsidianOverflow));
        }

        return {
          scenario: "r3-product-surfaces",
          conversation: conversationItem.textContent,
          obsidian: document.querySelector('[data-r3-obsidian-note]')?.getAttribute("data-r3-obsidian-note") || "",
          obsidianOverflow
        };
      })()
    `, true);
  }

}

async function runRightSidebarOwnerAcceptanceScenario(win, dependencies = {}, scenario) {
  if (scenario === "right-sidebar-owner-acceptance" || scenario === "visual-recovery-seventh-batch") {
    return win.webContents.executeJavaScript(`
      (async () => {
        const scenarioName = ${JSON.stringify(scenario)};
        const isVisualRecoverySeventhBatch = scenarioName === "visual-recovery-seventh-batch";
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(180);
          return element;
        };
        const navigateRoute = async (id) => {
          const navButton = document.querySelector('[data-next-route="' + id + '"]');
          if (navButton) {
            navButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
            navButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
            navButton.click();
          } else {
            const nextHash = "#" + id;
            if (window.location.hash !== nextHash) window.location.hash = nextHash;
            else window.dispatchEvent(new HashChangeEvent("hashchange"));
          }
          await delay(260);
        };
        const rectDebug = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        };
        const parsePx = (value) => {
          const parsed = Number.parseFloat(String(value || "0"));
          return Number.isFinite(parsed) ? parsed : 0;
        };
        const ownerSnapshot = (owner) => {
          const style = getComputedStyle(owner);
          return {
            page: owner.getAttribute("data-workspace-right-sidebar-page"),
            owner: owner.getAttribute("data-meow-right-sidebar-owner"),
            family: owner.getAttribute("data-meow-right-sidebar-family"),
            motionOwner: owner.getAttribute("data-meow-right-sidebar-motion-owner"),
            collapsed: owner.getAttribute("data-workspace-right-sidebar-collapsed"),
            className: String(owner.className || ""),
            rect: rectDebug(owner),
            computed: {
              width: style.width,
              maxWidth: style.maxWidth,
              flexBasis: style.flexBasis,
              opacity: style.opacity,
              visibility: style.visibility,
              display: style.display,
              pointerEvents: style.pointerEvents,
              overflowX: style.overflowX,
              overflowY: style.overflowY
            }
          };
        };
        const assertNoHorizontalOverflow = (element, label) => {
          if (!element) throw new Error(label + " missing overflow target.");
          const overflow = {
            clientWidth: Math.round(element.clientWidth || 0),
            scrollWidth: Math.round(element.scrollWidth || 0),
            rect: rectDebug(element)
          };
          if (overflow.scrollWidth > overflow.clientWidth + 2) {
            throw new Error(label + " should not introduce horizontal overflow: " + JSON.stringify(overflow));
          }
          return overflow;
        };
        const assertNoBodyHorizontalOverflow = (label) => {
          const overflow = {
            innerWidth: window.innerWidth,
            bodyClientWidth: document.body.clientWidth,
            bodyScrollWidth: document.body.scrollWidth,
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth
          };
          if (
            overflow.bodyScrollWidth > overflow.bodyClientWidth + 2 ||
            overflow.documentScrollWidth > overflow.documentClientWidth + 2
          ) {
            throw new Error(label + " route should not create document-level horizontal overflow: " + JSON.stringify(overflow));
          }
          return overflow;
        };
        const assertOwnerOpenVisual = (owner, label, minWidth = 280) => {
          const snapshot = ownerSnapshot(owner);
          const width = parsePx(snapshot.computed.width);
          const flexBasis = parsePx(snapshot.computed.flexBasis);
          if (
            snapshot.rect.width < minWidth ||
            width < minWidth ||
            flexBasis < minWidth ||
            snapshot.rect.height < 220 ||
            snapshot.computed.opacity !== "1" ||
            snapshot.computed.visibility !== "visible" ||
            snapshot.computed.pointerEvents === "none" ||
            snapshot.computed.display === "none"
          ) {
            throw new Error(label + " shared owner should be visibly open and usable: " + JSON.stringify(snapshot));
          }
          assertNoHorizontalOverflow(owner, label + " owner");
          return snapshot;
        };
        const assertOwnerCollapsedVisual = (snapshot, label) => {
          if (
            snapshot.rect.width > 8 ||
            parsePx(snapshot.computed.width) > 8 ||
            parsePx(snapshot.computed.maxWidth) > 8 ||
            parsePx(snapshot.computed.flexBasis) > 8 ||
            snapshot.computed.opacity !== "0" ||
            snapshot.computed.visibility !== "hidden" ||
            snapshot.computed.pointerEvents !== "none"
          ) {
            throw new Error(label + " shared owner should collapse without leaving a visible gutter: " + JSON.stringify(snapshot));
          }
        };
        const assertHeaderFamily = (root, label) => {
          const headers = [...root.querySelectorAll(".meowdesk-panel-header")];
          const header = headers.find((item) => {
            const rect = item.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }) || headers[0];
          if (!header) throw new Error(label + " should expose a shared panel header inside the owner.");
          const rect = header.getBoundingClientRect();
          const style = getComputedStyle(header);
          const headerDebug = {
            rect: rectDebug(header),
            computedHeight: style.height,
            minHeight: style.minHeight,
            maxHeight: style.maxHeight,
            overflow: style.overflow
          };
          if (
            rect.height < 40 ||
            rect.height > 48 ||
            parsePx(style.minHeight) < 40 ||
            parsePx(style.maxHeight) > 48 ||
            style.overflow !== "hidden"
          ) {
            throw new Error(label + " should keep the compact 44px panel-header family: " + JSON.stringify(headerDebug));
          }
          return headerDebug;
        };
        const assertScrollableInterior = (root, selector, label) => {
          const element = root.querySelector(selector);
          if (!element) throw new Error(label + " missing expected internal scroll/clip surface: " + selector);
          const style = getComputedStyle(element);
          const overflow = {
            selector,
            rect: rectDebug(element),
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            clientHeight: Math.round(element.clientHeight || 0),
            scrollHeight: Math.round(element.scrollHeight || 0)
          };
          if (overflow.overflowX === "visible" || overflow.overflowY === "visible") {
            throw new Error(label + " internal content should own its scroll/clip instead of leaking out: " + JSON.stringify(overflow));
          }
          return overflow;
        };
        const assertMainDoesNotOverlapOwner = (main, owner, label) => {
          if (!main || !owner) throw new Error(label + " missing main/owner layout target.");
          const mainRect = main.getBoundingClientRect();
          const ownerRect = owner.getBoundingClientRect();
          const overlap = mainRect.right > ownerRect.left + 2 && ownerRect.width > 8;
          const layout = {
            main: rectDebug(main),
            owner: rectDebug(owner)
          };
          if (overlap) {
            throw new Error(label + " right sidebar should not overlap the main work surface: " + JSON.stringify(layout));
          }
          return layout;
        };
        const assertNoVsLiveResidue = (label) => {
          const root = document.documentElement;
          const residue = {
            vsVisual: root.dataset.vsVisual || "",
            hasLiveClass: root.classList.contains("vs-live-app-mode"),
            visualStageCount: document.querySelectorAll("[data-vs-visual-stage]").length,
            visualBadgeCount: document.querySelectorAll(".vs-visual-badge").length,
            surfaceCloseDialogCount: document.querySelectorAll("[data-vs-surface-close-dialog]").length,
            liveRightSidebarMatch: Boolean(document.querySelector("html.vs-live-app-mode [data-workspace-right-sidebar-owner]"))
          };
          if (
            residue.vsVisual !== "css-compat-only" ||
            residue.hasLiveClass ||
            residue.visualStageCount ||
            residue.visualBadgeCount ||
            residue.surfaceCloseDialogCount ||
            residue.liveRightSidebarMatch
          ) {
            throw new Error(label + " should not revive VS live visual/runtime residue: " + JSON.stringify(residue));
          }
          return residue;
        };
        const assertSharedOwner = (surface, page, label) => {
          const owners = [...surface.querySelectorAll("[data-workspace-right-sidebar-owner]")];
          if (owners.length !== 1) {
            throw new Error(label + " must expose exactly one shared right-sidebar owner: " + owners.length);
          }
          const owner = owners[0];
          const snapshot = ownerSnapshot(owner);
          if (
            snapshot.page !== page ||
            snapshot.owner !== "workspace" ||
            snapshot.family !== "workspace" ||
            snapshot.motionOwner !== "workspace"
          ) {
            throw new Error(label + " owner must use the workspace owner/family/motion contract: " + JSON.stringify(snapshot));
          }
          return { owner, snapshot };
        };
        const visualEvidence = {};

        await navigateRoute("workspace");
        const workspaceSurface = await waitFor('[data-r2-workspace-route]');
        const workspaceOwner = assertSharedOwner(workspaceSurface, "workspace", "Workspace").owner;
        const workspaceOpenSnapshot = ownerSnapshot(workspaceOwner);
        if (isVisualRecoverySeventhBatch) {
          visualEvidence.workspace = {
            owner: assertOwnerOpenVisual(workspaceOwner, "Workspace", 280),
            header: assertHeaderFamily(workspaceOwner, "Workspace"),
            interior: assertScrollableInterior(workspaceOwner, ".meowdesk-workspace-board .meowdesk-panel-body", "Workspace"),
            layout: assertMainDoesNotOverlapOwner(await waitFor('[data-r2-workspace-frame]'), workspaceOwner, "Workspace"),
            overflow: assertNoBodyHorizontalOverflow("Workspace")
          };
        }
        await click('[data-r2-workspace-sidebar-toggle]');
        await waitFor('[data-r2-workspace-sidebar][data-workspace-right-sidebar-collapsed="true"]');
        await delay(80);
        const workspaceCollapsedSnapshot = ownerSnapshot(workspaceOwner);
        if (isVisualRecoverySeventhBatch) {
          assertOwnerCollapsedVisual(workspaceCollapsedSnapshot, "Workspace");
        } else if (workspaceCollapsedSnapshot.rect.width > 8) {
          throw new Error("Workspace shared owner did not collapse to zero width: " + JSON.stringify(workspaceCollapsedSnapshot));
        }
        await click('[data-r2-workspace-sidebar-toggle]');
        await waitFor('[data-r2-workspace-sidebar][data-workspace-right-sidebar-collapsed="false"]');
        await delay(80);

        await navigateRoute("studio");
        const studioSurface = await waitFor('[data-route-keepalive="studio"][data-route-keepalive-active="true"]');
        await waitFor('[data-studio-right-sidebar-owner][data-workspace-right-sidebar-collapsed="false"]');
        const studioOwner = assertSharedOwner(studioSurface, "studio", "Studio").owner;
        const studioOpenSnapshot = ownerSnapshot(studioOwner);
        if (isVisualRecoverySeventhBatch) {
          visualEvidence.studio = {
            owner: assertOwnerOpenVisual(studioOwner, "Studio", 320),
            header: assertHeaderFamily(studioOwner, "Studio"),
            interior: assertScrollableInterior(studioOwner, "[data-studio-inspector-content]", "Studio"),
            layout: assertMainDoesNotOverlapOwner(await waitFor('[data-studio-agent-panel]'), studioOwner, "Studio"),
            overflow: assertNoBodyHorizontalOverflow("Studio")
          };
        }
        await click('[data-studio-inspector-toggle]');
        await waitFor('[data-studio-right-sidebar-owner][data-workspace-right-sidebar-collapsed="true"]');
        await delay(80);
        const studioCollapsedSnapshot = ownerSnapshot(studioOwner);
        if (isVisualRecoverySeventhBatch) {
          assertOwnerCollapsedVisual(studioCollapsedSnapshot, "Studio");
        } else if (studioCollapsedSnapshot.rect.width > 8) {
          throw new Error("Studio shared owner did not collapse to zero width: " + JSON.stringify(studioCollapsedSnapshot));
        }
        await click('[data-studio-inspector-toggle]');
        await waitFor('[data-studio-right-sidebar-owner][data-workspace-right-sidebar-collapsed="false"]');
        await delay(80);

        if (document.querySelector('[data-next-route="workflow"], [data-phase-six-route="workflow"], [data-r15-workflow-shell]')) {
          throw new Error("Workflow must stay archived outside the MVP shared owner baseline.");
        }
        return {
          scenario: scenarioName,
          timestamp: new Date().toISOString(),
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            htmlClass: document.documentElement.className
          },
          workspace: {
            open: workspaceOpenSnapshot,
            collapsed: workspaceCollapsedSnapshot
          },
          studio: {
            open: studioOpenSnapshot,
            collapsed: studioCollapsedSnapshot
          },
          visualEvidence
        };
      })()
    `, true);
  }
}

const productSmokeScenarios = Object.freeze({
  "r1-functions": runR1FunctionsScenario,
  "r15-r2a-functions": runR15R2aFunctionsScenario,
  "r3-product-surfaces": runR3ProductSurfacesScenario,
  "right-sidebar-owner-acceptance": runRightSidebarOwnerAcceptanceScenario,
  "visual-recovery-seventh-batch": runRightSidebarOwnerAcceptanceScenario,
});

module.exports = {
  productSmokeScenarios
};

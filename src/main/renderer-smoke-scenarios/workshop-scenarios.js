"use strict";

async function runWorkshopRealDataScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workshop-real-data") {
    return win.webContents.executeJavaScript(`
      (async () => {
        const scenarioName = ${JSON.stringify(scenario)};
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
          await delay(120);
          return element;
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        if (document.querySelector("[data-lobby-welcome], [data-lobby-login-start], [data-lobby-auth-form]")) {
          throw new Error("Workshop smoke must not rely on the removed lobby welcome/login branch.");
        }
        await click('[data-lobby-section-tab="plugins"]');
        await waitFor('[data-lobby-plugin-subpage="sidebar"]');
        const sidebarCount = await waitFor('[data-lobby-plugin-count="sidebar"]');
        if (!sidebarCount.textContent.includes("1")) {
          throw new Error("Lobby sidebar count did not read seeded extension: " + sidebarCount.textContent);
        }
        const waitForMissing = (selector, timeout = 5000) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            if (!document.querySelector(selector)) {
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

        await click('[data-next-route="studio"]');
        await click('[data-studio-inspector-panel-tab="projects"]');
        const count = await waitFor('[data-studio-real-project-count]');
        if (count.getAttribute("data-studio-real-project-count") !== "1") {
          throw new Error("Studio real project count mismatch: " + count.getAttribute("data-studio-real-project-count"));
        }
        const project = await waitFor('[data-studio-real-project-item="Smoke 真实右侧栏"]');
        const visibleProjects = [...document.querySelectorAll('[data-studio-real-project-item="Smoke 真实右侧栏"]')]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
          });
        const projectMenuFailures = visibleProjects.map((element) => {
          const projectTrigger = element.querySelector(':scope > [data-card-action-menu] [data-card-action-menu-trigger]');
          const projectRect = element.getBoundingClientRect();
          const triggerRect = projectTrigger?.getBoundingClientRect();
          const iconRect = projectTrigger?.querySelector("svg")?.getBoundingClientRect();
          if (!projectTrigger || !triggerRect || !iconRect) {
            return { reason: "missing-trigger", html: element.outerHTML.slice(0, 500) };
          }
          const menuRoot = projectTrigger.parentElement;
          const menuStyle = menuRoot ? getComputedStyle(menuRoot) : null;
          const expectedSize = Number.parseFloat(menuStyle?.getPropertyValue("--meowdesk-card-action-menu-size") || "") || 32;
          const expectedInset = Number.parseFloat(menuStyle?.getPropertyValue("--meowdesk-card-action-menu-inset") || "") || 10;
          const topInset = triggerRect.top - projectRect.top;
          const rightInset = projectRect.right - triggerRect.right;
          const triggerCenter = {
            x: triggerRect.left + triggerRect.width / 2,
            y: triggerRect.top + triggerRect.height / 2
          };
          const iconCenter = {
            x: iconRect.left + iconRect.width / 2,
            y: iconRect.top + iconRect.height / 2
          };
          const failed =
            !menuRoot?.classList.contains("meowdesk-studio-project-card-action-menu") ||
            Math.abs(triggerRect.width - expectedSize) > 1 ||
            Math.abs(triggerRect.height - expectedSize) > 1 ||
            Math.abs(topInset - expectedInset) > 2 ||
            Math.abs(rightInset - expectedInset) > 2 ||
            Math.abs(triggerCenter.x - iconCenter.x) > 1.5 ||
            Math.abs(triggerCenter.y - iconCenter.y) > 1.5;
          return failed ? {
            project: { left: projectRect.left, top: projectRect.top, right: projectRect.right, width: projectRect.width, height: projectRect.height },
            trigger: { left: triggerRect.left, top: triggerRect.top, right: triggerRect.right, width: triggerRect.width, height: triggerRect.height, topInset, rightInset, expectedSize, expectedInset },
            icon: { left: iconRect.left, top: iconRect.top, width: iconRect.width, height: iconRect.height },
            className: menuRoot?.className || ""
          } : null;
        }).filter(Boolean);
        if (projectMenuFailures.length) {
          throw new Error("Every visible Studio project-card dropdown trigger should sit centered in the card corner: " + JSON.stringify(projectMenuFailures));
        }
        return {
          scenario: "workshop-real-data",
          lobbySidebarCount: sidebarCount.textContent,
          studioRealCount: count.getAttribute("data-studio-real-project-count"),
          projectText: project.textContent
        };
      })()
    `, true);
  }
}

async function runWorkshopMarkReadyScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workshop-mark-ready") {
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(180);
          return element;
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('[data-next-route="studio"]');
        await click('[data-studio-inspector-panel-tab="projects"]');
        await waitFor('[data-studio-real-project-item="Smoke 真实右侧栏"]');
        await click('[data-studio-mark-ready="smoke-sidebar-widget"]');
        await waitFor('[data-studio-operation-status]');
        const state = await waitFor('[data-studio-project-state="smoke-sidebar-widget"]');
        if (!state.textContent.includes("ready")) {
          throw new Error("Studio state did not update to ready: " + state.textContent);
        }
        const agentInfo = await window.workbench.getAgentInterfaceInfo({ includeNativeHistory: false, forceRefresh: true });
        const extension = (agentInfo.workshopExtensions || []).find((item) => item.id === "smoke-sidebar-widget");
        if (!extension || extension.status !== "ready") {
          throw new Error("Manifest status was not marked ready: " + JSON.stringify(extension));
        }
        return {
          scenario: "workshop-mark-ready",
          status: extension.status,
          version: extension.version,
          text: state.textContent
        };
      })()
    `, true);
  }
}

async function runWorkshopProjectDetailScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workshop-project-detail") {
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
              reject(new Error("Timed out waiting for " + selector + " to include " + text));
              return;
            }
            setTimeout(tick, 50);
          };
          tick();
        });
        const waitForMissing = (selector, timeout = 8000) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            if (!document.querySelector(selector)) {
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
          await delay(180);
          return element;
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('[data-next-route="studio"]');
        await click('[data-studio-inspector-panel-tab="projects"]');
        await waitFor('[data-studio-real-project-item="Smoke 真实右侧栏"]');
        await click('[data-studio-select-project="smoke-sidebar-widget"]');
        await waitFor('[data-studio-inspector][data-studio-inspector-active="detail"]');

        await waitFor('[data-studio-project-detail-id="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-readiness="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-readiness-item="manifest"][data-studio-project-readiness-state="ready"]');
        await waitFor('[data-studio-project-readiness-item="entry"][data-studio-project-readiness-state="ready"]');
        if (document.querySelector('[data-studio-project-readiness-count], [data-studio-project-publish-status-count]')) {
          throw new Error("Studio detail should remove readiness/publish count badges from the right sidebar cards.");
        }
        await waitForMissing('[data-studio-project-preview-contract="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-preview="smoke-sidebar-widget"][data-studio-project-preview-state="loadable"]');
        await waitFor('[data-studio-project-preview-frame="smoke-sidebar-widget"][data-studio-project-preview-kind="sidebar-widget"]');
        await waitFor('[data-studio-project-preview-iframe="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-action-bar="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-continue-agent="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-open-folder="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-publish-status-card="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-open-publish="smoke-sidebar-widget"]');
        await click('[data-studio-project-action-bar="smoke-sidebar-widget"] [data-card-action-menu-trigger]');
        const openMenu = await waitFor('[data-studio-project-action-bar="smoke-sidebar-widget"] [data-card-action-menu-open="true"] [data-card-action-menu-content]');
        const trigger = await waitFor('[data-studio-project-action-bar="smoke-sidebar-widget"] [data-card-action-menu-trigger]');
        const triggerRect = trigger.getBoundingClientRect();
        const triggerIconRect = trigger.querySelector("svg")?.getBoundingClientRect();
        const menuStyle = getComputedStyle(openMenu);
        const triggerCenter = {
          x: triggerRect.left + triggerRect.width / 2,
          y: triggerRect.top + triggerRect.height / 2
        };
        const iconCenter = triggerIconRect ? {
          x: triggerIconRect.left + triggerIconRect.width / 2,
          y: triggerIconRect.top + triggerIconRect.height / 2
        } : null;
        if (!triggerIconRect || Math.abs(triggerCenter.x - iconCenter.x) > 1.5 || Math.abs(triggerCenter.y - iconCenter.y) > 1.5) {
          throw new Error("Studio dropdown trigger icon should be centered inside the square button: " + JSON.stringify({
            trigger: { left: triggerRect.left, top: triggerRect.top, width: triggerRect.width, height: triggerRect.height },
            icon: triggerIconRect ? { left: triggerIconRect.left, top: triggerIconRect.top, width: triggerIconRect.width, height: triggerIconRect.height } : null
          }));
        }
        if (openMenu.getAttribute("data-card-action-menu-content") === null || !openMenu.closest('[data-card-action-menu-open="true"]')) {
          throw new Error("Studio dropdown menu should be owned by the open React CardActionMenu.");
        }
        if (Number(menuStyle.zIndex) < 100) {
          throw new Error("Studio dropdown menu should stack above the card content: " + JSON.stringify({
            zIndex: menuStyle.zIndex
          }));
        }
        const menuItems = [...openMenu.querySelectorAll('[data-card-action-menu-item="true"]')];
        if (menuItems.length < 2) {
          throw new Error("Studio dropdown menu should expose actionable menu items.");
        }
        await click('[data-studio-page-tab="manage"]');
        await waitFor('[data-studio-workshop-management]');
        await waitFor('[data-studio-project-publish-entry="smoke-sidebar-widget"]');
        await click('[data-studio-project-publish-entry="smoke-sidebar-widget"]');
        await waitFor('[data-studio-workshop-publish-page]');
        await waitFor('[data-studio-project-publish-page="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-publish-draft="smoke-sidebar-widget"]');
        await click('[data-studio-project-publish-save="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-publish-draft-saved="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-publish-check="manifest"][data-studio-project-publish-check-state="ready"]');
        await waitFor('[data-studio-project-publish-check="entry"][data-studio-project-publish-check-state="ready"]');
        await waitFor('[data-studio-project-publish-check="type"][data-studio-project-publish-check-state="ready"]');
        await waitFor('[data-studio-project-publish-check="preview"][data-studio-project-publish-check-state="ready"]');
        await click('[data-studio-project-publish-test="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-publish-record="smoke-sidebar-widget"]');
        await click('[data-studio-project-install-test="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-install-test-record="smoke-sidebar-widget"]');
        await click('[data-studio-page-tab="make"]');
        await waitFor('[data-studio-inspector][data-studio-inspector-active="detail"]');
        const currentDetail = await waitFor('[data-studio-project-detail-id="smoke-sidebar-widget"]');
        const enableSidebar = await waitFor('[data-studio-project-enable-sidebar="smoke-sidebar-widget"][data-studio-project-enable-sidebar-state="disabled"]');
        if (enableSidebar.disabled) {
          throw new Error("Studio detail sidebar enable action should be available for a loadable sidebar widget.");
        }
        const revisionBeforeEnable = Number(document.querySelector('[data-studio-route]')?.getAttribute("data-studio-project-state-revision") || "0");
        await click('[data-studio-project-enable-sidebar="smoke-sidebar-widget"]');
        await waitFor('[data-studio-route][data-studio-project-state-revision="' + (revisionBeforeEnable + 1) + '"]');
        await waitFor('[data-studio-project-enable-sidebar="smoke-sidebar-widget"][data-studio-project-enable-sidebar-state="enabled"]');
        await waitFor('[data-studio-project-detail-export-meow="smoke-sidebar-widget"]');
        const detailName = await waitFor('[data-studio-project-detail-name]');
        if (!detailName.textContent.includes("Smoke 真实右侧栏")) {
          throw new Error("Project detail name mismatch: " + detailName.textContent);
        }
        if (!currentDetail.textContent.includes("smoke-sidebar-widget") || !currentDetail.textContent.includes("index.html")) {
          throw new Error("Project detail did not include expected id/path: " + currentDetail.textContent);
        }
        const draftStatus = await waitForText('[data-studio-project-detail-status]', "draft");
        const beforeText = draftStatus.textContent;
        await click('[data-studio-project-detail-mark-ready="smoke-sidebar-widget"]');
        const readyStatus = await waitForText('[data-studio-project-detail-status]', "ready");
        await click('[data-next-route="workspace"]');
        await waitFor('[data-r2-workspace-sidebar-widgets]');
        await waitFor('[data-r2-workspace-widget-host="smoke-sidebar-widget"]');
        await waitFor('[data-r2-workspace-widget-frame="smoke-sidebar-widget"][data-r2-workspace-widget-frame-mode="iframe-host"]');
        await waitFor('[data-r2-workspace-widget-iframe="smoke-sidebar-widget"]');
        await click('[data-next-route="studio"]');
        await click('[data-studio-page-tab="manage"]');
        await click('[data-studio-project-bucket="published"]');
        await waitFor('[data-studio-project-publish-entry="smoke-sidebar-widget"]');
        await click('[data-studio-project-publish-entry="smoke-sidebar-widget"]');
        await waitFor('[data-studio-workshop-publish-page]');
        const publishRecord = await waitFor('[data-studio-project-publish-record="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-install-test-record="smoke-sidebar-widget"]');
        publishRecord.scrollIntoView({ block: "center", inline: "nearest" });
        await delay(260);
        return {
          scenario: "workshop-project-detail",
          name: detailName.textContent,
          before: beforeText,
          after: readyStatus.textContent,
          workspaceEnabled: true
        };
      })()
    `, true);
  }
}

async function runWorkshopVersionHistoryScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workshop-version-history") {
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(180);
          return element;
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('[data-next-route="studio"]');
        await click('[data-studio-inspector-panel-tab="projects"]');
        await waitFor('[data-studio-real-project-item="Smoke 真实右侧栏"]');
        await click('[data-studio-select-project="smoke-sidebar-widget"]');
        await waitFor('[data-studio-inspector][data-studio-inspector-active="detail"]');

        const list = await waitFor('[data-studio-project-version-list]');
        const current = await waitFor('[data-studio-project-version-item="current"]');
        const snapshot = await waitFor('[data-studio-project-version-item="0.0.5"]');
        if (!current.textContent.includes("current") || !current.textContent.includes("v0.1.0")) {
          throw new Error("Current version row mismatch: " + current.textContent);
        }
        if (!snapshot.textContent.includes("v0.0.5") || !snapshot.textContent.includes("旧版本快照")) {
          throw new Error("Snapshot version row mismatch: " + snapshot.textContent);
        }
        return {
          scenario: "workshop-version-history",
          count: list.querySelectorAll("[data-studio-project-version-item]").length,
          current: current.textContent,
          snapshot: snapshot.textContent
        };
      })()
    `, true);
  }
}

async function runWorkshopInvalidManifestScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workshop-invalid-manifest") {
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(180);
          return element;
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('[data-next-route="studio"]');
        await click('[data-studio-inspector-panel-tab="projects"]');
        const project = await waitFor('[data-studio-real-project-item="broken-sidebar-widget"]');
        const state = await waitFor('[data-studio-project-state="broken-sidebar-widget"]');
        if (!state.textContent.includes("error")) {
          throw new Error("Broken manifest project did not render error state: " + state.textContent);
        }
        if (document.querySelector('[data-studio-mark-ready="broken-sidebar-widget"]')) {
          throw new Error("Broken manifest project should not expose mark-ready.");
        }
        await click('[data-studio-select-project="broken-sidebar-widget"]');
        await waitFor('[data-studio-inspector][data-studio-inspector-active="detail"]');
        const detailError = await waitFor('[data-studio-project-detail-error]');
        if (!detailError.textContent.includes("JSON") && !detailError.textContent.includes("清单读取失败")) {
          throw new Error("Detail error did not include manifest parse failure: " + detailError.textContent);
        }
        return {
          scenario: "workshop-invalid-manifest",
          state: state.textContent,
          projectText: project.textContent,
          error: detailError.textContent
        };
      })()
    `, true);
  }
}

async function runWorkshopCreateProjectScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workshop-create-project") {
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(160);
          return element;
        };
        const waitForText = async (selector, text, timeout = 8000) => {
          const startedAt = Date.now();
          while (Date.now() - startedAt <= timeout) {
            const element = await waitFor(selector, timeout);
            if (element.textContent.includes(text)) return element;
            await delay(80);
          }
          throw new Error("Timed out waiting for text " + text + " in " + selector);
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('[data-next-route="studio"]');
        await click('[data-studio-inspector-panel-tab="projects"]');
        await click('[data-studio-new-draft]');
        await click('[data-studio-draft-type="sidebar-widget"]');
        const input = await waitFor('[data-studio-draft-name]');
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        valueSetter.call(input, "Smoke 真实工程");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await delay(120);
        const submit = await waitFor('[data-studio-create-real-project]');
        if (submit.disabled) throw new Error("Create real project button stayed disabled.");
        submit.click();
        const created = await waitFor('[data-studio-real-project-item="Smoke 真实工程"]');
        const status = await waitFor('[data-studio-operation-status]');
        if (!status.textContent.includes("已创建")) {
          throw new Error("Create operation status mismatch: " + status.textContent);
        }
        const agentInfo = await window.workbench.getAgentInterfaceInfo({ includeNativeHistory: false, forceRefresh: true });
        const extension = (agentInfo.workshopExtensions || []).find((item) => item.name === "Smoke 真实工程");
        if (!extension?.entryPath || !extension.entryPath.includes("index.html")) {
          throw new Error("Created workshop project should include a real starter entryPath.");
        }
        if (extension.type !== "sidebar-widget" || extension.target !== "workspace-sidebar") {
          throw new Error("Created workshop project did not preserve the selected sidebar-widget type: " + JSON.stringify(extension));
        }
        await click('[data-studio-new-draft]');
        await click('[data-studio-draft-type="feature-page"]');
        const featureInput = await waitFor('[data-studio-draft-name]');
        valueSetter.call(featureInput, "Smoke Feature Page");
        featureInput.dispatchEvent(new Event("input", { bubbles: true }));
        await delay(120);
        const featureSubmit = await waitFor('[data-studio-create-real-project]');
        if (featureSubmit.disabled) throw new Error("Create feature page project button stayed disabled.");
        featureSubmit.click();
        await waitFor('[data-studio-real-project-item="Smoke Feature Page"]');
        const featureInfo = await window.workbench.getAgentInterfaceInfo({ includeNativeHistory: false, forceRefresh: true });
        const feature = (featureInfo.workshopExtensions || []).find((item) => item.name === "Smoke Feature Page");
        if (!feature?.entryPath || !feature.entryPath.includes("index.html")) {
          throw new Error("Created feature page should include a real starter entryPath.");
        }
        if (feature.id !== "smoke-feature-page" || feature.type !== "feature-page" || feature.target !== "main-nav") {
          throw new Error("Created feature page did not preserve feature-page/main-nav contract: " + JSON.stringify(feature));
        }
        await click('[data-studio-select-project="smoke-feature-page"]');
        await waitFor('[data-studio-project-detail-id="smoke-feature-page"]');
        await waitFor('[data-studio-project-preview="smoke-feature-page"][data-studio-project-preview-state="loadable"]');
        await waitFor('[data-studio-project-preview-frame="smoke-feature-page"][data-studio-project-preview-kind="feature-page"]');
        await waitFor('[data-studio-project-preview-iframe="smoke-feature-page"]');
        await click('[data-studio-project-detail-mark-ready="smoke-feature-page"]');
        await waitForText('[data-studio-project-detail-status]', "ready");
        await click('[data-studio-project-detail-export-meow="smoke-feature-page"]');
        await click('[data-studio-inspector-panel-tab="projects"]');
        const featureExportStatus = await waitFor('[data-studio-operation-status]');
        if (!featureExportStatus.textContent.includes("Smoke Feature Page")) {
          throw new Error("Feature page export status did not mention the feature page: " + featureExportStatus.textContent);
        }
        if (!String(featureExportStatus.getAttribute("data-studio-last-package-path") || "").includes(".meow")) {
          throw new Error("Feature page export status did not expose a .meow path.");
        }
        await click('[data-studio-inspector-panel-tab="detail"]');
        await waitFor('[data-studio-project-detail-id="smoke-feature-page"]');
        const enableFeaturePage = await waitFor('[data-studio-project-enable-feature-page="smoke-feature-page"][data-studio-project-enable-feature-page-state="disabled"]');
        if (enableFeaturePage.disabled) {
          throw new Error("Studio detail feature page enable action should be available for a loadable feature page.");
        }
        await click('[data-studio-project-enable-feature-page="smoke-feature-page"]');
        await waitFor('[data-studio-project-enable-feature-page="smoke-feature-page"][data-studio-project-enable-feature-page-state="enabled"]');
        window.location.hash = "feature:smoke-feature-page";
        await waitFor('[data-r2-feature-page-route="smoke-feature-page"]');
        await waitFor('[data-r2-feature-page-iframe="smoke-feature-page"]');
        return {
          scenario: "workshop-create-project",
          created: true,
          text: created.textContent,
          status: status.textContent,
          type: extension.type,
          target: extension.target,
          entryPath: extension.entryPath,
          featureId: feature.id,
          featureRoute: "feature:smoke-feature-page"
        };
      })()
    `, true);
  }
}

async function runWorkshopExportMeowScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workshop-export-meow") {
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(180);
          return element;
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('[data-next-route="studio"]');
        await click('[data-studio-inspector-panel-tab="projects"]');
        await waitFor('[data-studio-real-project-item="Smoke 真实右侧栏"]');
        await click('[data-studio-export-meow="smoke-sidebar-widget"]');
        const status = await waitFor('[data-studio-operation-status]');
        const packagePath = status.getAttribute("data-studio-last-package-path") || "";
        if (!status.textContent.includes(".meow") || !packagePath.endsWith(".meow")) {
          throw new Error("Export status did not include .meow package path: " + status.textContent + " / " + packagePath);
        }
        return {
          scenario: "workshop-export-meow",
          packagePath,
          status: status.textContent
        };
      })()
    `, true);
  }
}

async function runWorkshopImportMeowScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workshop-import-meow") {
    const packagePath = process.env.MEOWDESK_RENDERER_SMOKE_IMPORT_PACKAGE || "";
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(180);
          return element;
        };

        const packagePath = ${JSON.stringify(packagePath)};
        if (!packagePath) throw new Error("Missing smoke .meow package path.");
        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('[data-next-route="studio"]');
        await waitFor('[data-studio-route]');
        await click('[data-studio-inspector-panel-tab="projects"]');
        window.dispatchEvent(new CustomEvent("meowdesk:studio-import", { detail: { packagePath } }));
        await waitFor('[data-studio-operation-status]');
        await new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            const status = document.querySelector('[data-studio-operation-status]')?.textContent || "";
            if (status.includes("已安装")) {
              resolve();
              return;
            }
            if (status.includes("安装失败") || Date.now() - startedAt > 10000) {
              reject(new Error("Import status did not complete: " + status));
              return;
            }
            setTimeout(tick, 50);
          };
          tick();
        });
        const imported = await waitFor('[data-studio-real-project-item="Smoke 导入右侧栏"]');
        return {
          scenario: "workshop-import-meow",
          text: imported.textContent
        };
      })()
    `, true);
  }
}

const workshopSmokeScenarios = Object.freeze({
  "workshop-real-data": runWorkshopRealDataScenario,
  "workshop-mark-ready": runWorkshopMarkReadyScenario,
  "workshop-project-detail": runWorkshopProjectDetailScenario,
  "workshop-version-history": runWorkshopVersionHistoryScenario,
  "workshop-invalid-manifest": runWorkshopInvalidManifestScenario,
  "workshop-create-project": runWorkshopCreateProjectScenario,
  "workshop-export-meow": runWorkshopExportMeowScenario,
  "workshop-import-meow": runWorkshopImportMeowScenario,
});

module.exports = {
  workshopSmokeScenarios
};

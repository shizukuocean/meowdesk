"use strict";

async function runWorkspaceTopControlsScenario(win, dependencies = {}, scenario) {
  if (scenario === "workspace-top-controls") {
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(160);
          return element;
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
        const isStrongBlue = (colorText) => {
          const match = String(colorText || "").match(/rgba?\(([^)]+)\)/i);
          if (!match) return false;
          const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
          const [red, green, blue, alpha = 1] = parts;
          return alpha > 0.45 && blue > 180 && green > 90 && red < 80;
        };
        const assertToolbarButton = (toolbar, button, name) => {
          if (!toolbar.contains(button)) {
            throw new Error("Workspace top control should be owned by the top toolbar: " + name);
          }
          if (button.closest("[data-r2-workspace-sidebar-manager-menu]")) {
            throw new Error("Workspace top control should not only exist inside the manager popover: " + name);
          }
          const rect = button.getBoundingClientRect();
          const toolbarRect = toolbar.getBoundingClientRect();
          const style = getComputedStyle(button);
          const classes = String(button.className || "");
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) <= 0.01 ||
            style.pointerEvents === "none" ||
            rect.width < 36 ||
            rect.width > 42 ||
            rect.height < 36 ||
            rect.height > 42 ||
            rect.left < toolbarRect.left - 2 ||
            rect.right > toolbarRect.right + 2 ||
            rect.top < toolbarRect.top - 2 ||
            rect.bottom > toolbarRect.bottom + 2 ||
            !classes.includes("meowdesk-top-nav-icon-button")
          ) {
            throw new Error("Workspace top control should stay in the shared top-bar icon family: " + JSON.stringify({
              name,
              button: rectDebug(button),
              toolbar: rectDebug(toolbar),
              className: classes,
              style: {
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                pointerEvents: style.pointerEvents
              }
            }));
          }
        };

        await click('[data-next-route="workspace"]');
        const workspace = await waitFor('[data-r2-workspace-route]');
        const titleCluster = await waitFor('[data-top-nav-title-cluster]');
        const title = await waitFor('[data-top-nav-title][data-top-nav-title-visual="meowdesk-scan"]');
        const titleBase = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-base');
        const titleScanText = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-scan-text');
        const titleScanBar = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-scan-bar');
        const titleClusterStyle = getComputedStyle(titleCluster);
        const titleStyle = getComputedStyle(title);
        const titleBaseStyle = getComputedStyle(titleBase);
        const titleScanTextStyle = getComputedStyle(titleScanText);
        const titleScanBarStyle = getComputedStyle(titleScanBar);
        const titleRect = title.getBoundingClientRect();
        const titleScanBarRect = titleScanBar.getBoundingClientRect();
        if (
          titleClusterStyle.overflowX === "hidden" ||
          titleBase.textContent.trim() !== "工作区" ||
          titleBaseStyle.color !== "rgb(255, 255, 255)" ||
          Number.parseFloat(titleStyle.fontSize) < 28 ||
          Number.parseFloat(titleStyle.fontWeight) < 800 ||
          Math.round(titleScanBarRect.width) < 5 ||
          titleScanBarRect.left >= titleRect.left - 4 ||
          titleScanTextStyle.transform !== "none" ||
          String(titleScanTextStyle.clipPath || "").includes("none") ||
          !String(titleScanBarStyle.backgroundColor || "").includes("55, 255, 139")
        ) {
          throw new Error("Workspace TopNav title should keep the A-approved white energy title with a visible green scan bar: " + JSON.stringify({
            clusterOverflowX: titleClusterStyle.overflowX,
            titleText: titleBase.textContent.trim(),
            title: rectDebug(title),
            scanBar: rectDebug(titleScanBar),
            titleColor: titleBaseStyle.color,
            titleFontSize: titleStyle.fontSize,
            titleFontWeight: titleStyle.fontWeight,
            scanTextClipPath: titleScanTextStyle.clipPath,
            scanTextTransform: titleScanTextStyle.transform,
            scanBarBackground: titleScanBarStyle.backgroundColor
          }));
        }
        const sidebarRoutes = [...document.querySelectorAll('.meowdesk-sidebar [data-next-route][data-meow-action-family="workspace-action-surface"]')];
        const inactiveBlueRoutes = sidebarRoutes
          .filter((route) => route.getAttribute("aria-current") !== "page")
          .map((route) => {
            const style = getComputedStyle(route);
            return {
              route: route.getAttribute("data-next-route"),
              backgroundColor: style.backgroundColor,
              borderTopColor: style.borderTopColor,
              boxShadow: style.boxShadow,
              rect: rectDebug(route)
            };
          })
          .filter((item) => isStrongBlue(item.backgroundColor) || isStrongBlue(item.borderTopColor));
        if (inactiveBlueRoutes.length) {
          throw new Error("Inactive sidebar action surfaces should stay quiet until hover/focus/drop: " + JSON.stringify(inactiveBlueRoutes));
        }
        const toolbar = await waitFor('[data-r2-workspace-toolbar]');
        const slotPicker = await waitFor('[data-r2-workspace-slot-picker]');
        const manager = await waitFor('[data-r2-workspace-sidebar-manager-button]');
        const toggle = await waitFor('[data-r2-workspace-sidebar-toggle]');
        const sidebar = await waitFor('[data-r2-workspace-sidebar]');
        const sidebarManager = await waitFor('[data-r2-workspace-sidebar-manager]');
        if (!toolbar.contains(slotPicker)) {
          throw new Error("Workspace slot picker should live in the top toolbar.");
        }
        assertToolbarButton(toolbar, manager, "manager");
        assertToolbarButton(toolbar, toggle, "toggle");
        if (document.querySelector('[data-r2-workspace-refresh], [data-r2-workspace-update], [data-next-sidebar-update-reserved]')) {
          throw new Error("Workspace top toolbar must not render retired refresh/update buttons.");
        }
        const managerRect = manager.getBoundingClientRect();
        const toggleRect = toggle.getBoundingClientRect();
        if (managerRect.right > toggleRect.left - 2 && toggleRect.right > managerRect.left + 2 && managerRect.bottom > toggleRect.top + 2 && toggleRect.bottom > managerRect.top + 2) {
          throw new Error("Workspace right-sidebar manager and collapse buttons should not overlap: " + JSON.stringify({
            manager: rectDebug(manager),
            toggle: rectDebug(toggle)
          }));
        }
        await click('[data-r2-workspace-sidebar-manager-button]');
        const menu = await waitFor('[data-r2-workspace-sidebar-manager-menu]');
        const menuRect = menu.getBoundingClientRect();
        const managerGroupRect = sidebarManager.getBoundingClientRect();
        if (menuRect.right > window.innerWidth + 2 || menuRect.left < -2 || menuRect.top < managerGroupRect.bottom - 1) {
          throw new Error("Workspace sidebar manager menu should open below the toolbar controls without leaving the viewport: " + JSON.stringify({
            menu: rectDebug(menu),
            managerGroup: rectDebug(sidebarManager),
            viewport: { width: window.innerWidth, height: window.innerHeight }
          }));
        }
        await click('[data-r2-workspace-sidebar-toggle]');
        await delay(120);
        if (!workspace.classList.contains("is-sidebar-collapsed") || toggle.getAttribute("data-r2-workspace-sidebar-collapsed") !== "true") {
          throw new Error("Workspace sidebar collapse button should update the React-owned workspace state.");
        }
        if (sidebar.getBoundingClientRect().width > 4) {
          throw new Error("Workspace right sidebar should collapse out of layout instead of leaving a blank gap: " + JSON.stringify({
            sidebar: rectDebug(sidebar)
          }));
        }
        await click('[data-r2-workspace-sidebar-toggle]');
        await delay(120);
        if (workspace.classList.contains("is-sidebar-collapsed") || toggle.getAttribute("data-r2-workspace-sidebar-collapsed") !== "false") {
          throw new Error("Workspace sidebar collapse button should reopen the React-owned workspace state.");
        }
        if (sidebar.getBoundingClientRect().width < 220) {
          throw new Error("Workspace right sidebar should reopen with usable width: " + JSON.stringify({
            sidebar: rectDebug(sidebar)
          }));
        }
        await delay(1200);
        return {
          scenario: "workspace-top-controls",
          toolbar: rectDebug(toolbar),
          manager: rectDebug(manager),
          toggle: rectDebug(toggle),
          sidebar: rectDebug(sidebar)
        };
      })()
    `, true);
  }
}

async function runR2WorkspaceIdleVisualScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "r2-workspace-idle-visual") {
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(180);
          return element;
        };
        const roundRect = (rect) => ({
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });

        await click('[data-next-route="workspace"]');
        const workspace = await waitFor('[data-r2-workspace-route]');
        if (
          !workspace.textContent.includes("少切窗") ||
          !workspace.textContent.includes("CLI Agent") ||
          workspace.textContent.includes("按旧 Meowdesk")
        ) {
          throw new Error("Workspace idle copy should describe the low-window-switching Agent workspace, not legacy restoration copy: " + workspace.textContent);
        }
        const panes = await waitFor('[data-r2-workspace-panes]');
        const sidebar = await waitFor('[data-r2-workspace-sidebar]');
        if (document.querySelector('[data-r2-workspace-sidebar-widgets]')) {
          throw new Error("Workspace should default to built-in board and pet only, without auto-opening workshop sidebar widgets.");
        }
        await waitFor('[data-r2-workspace-slot-button="1"][data-r2-workspace-slot-active="true"]');
        if (panes.getAttribute("data-r2-workspace-pane-count") !== "1") {
          throw new Error("Workspace should default to one pending configuration pane: " + panes.outerHTML);
        }
        const blankConfigure = await waitFor('[data-r2-workspace-configure-pane="blank-1"]');
        if (blankConfigure.disabled) {
          throw new Error("Workspace default blank pane plus should open the configure dialog.");
        }
        await click('[data-r2-workspace-configure-pane="blank-1"]');
        const configDialog = await waitFor('[data-r2-workspace-config-dialog]');
        if (
          !configDialog.textContent.includes("少切窗") ||
          !configDialog.textContent.includes("作品")
        ) {
          throw new Error("Workspace config dialog should keep workspace usage and workshop development distinct: " + configDialog.textContent);
        }
        await waitFor('[data-r2-workspace-config-tool="smoke-terminal"]');
        await click('[data-r2-workspace-config-tool="smoke-terminal"]');
        const terminalPane = await waitFor('[data-r2-workspace-pane="blank-1"][data-r2-workspace-pane-configured="true"][data-r2-workspace-pane-kind="terminal"]');
        void terminalPane;
        await click('[data-r2-workspace-pane-hide="blank-1"]');
        const hiddenTray = await waitFor('[data-r2-workspace-hidden-tray]');
        const restoreButton = await waitFor('[data-r2-workspace-pane-restore="blank-1"]');
        if (document.querySelector('[data-r2-workspace-pane="blank-1"]')) {
          throw new Error("Hidden workspace pane should leave the main grid DOM instead of remaining as a hidden xterm owner.");
        }
        const hiddenTrayRect = hiddenTray.getBoundingClientRect();
        const panesAfterHide = await waitFor('[data-r2-workspace-panes]');
        const panesAfterHideRect = panesAfterHide.getBoundingClientRect();
        if (hiddenTrayRect.bottom > panesAfterHideRect.top + 2) {
          throw new Error("Hidden workspace pane tray should sit above the pane grid, not overlap pane headers: " + JSON.stringify({
            tray: roundRect(hiddenTrayRect),
            panes: roundRect(panesAfterHideRect)
          }));
        }
        restoreButton.click();
        await delay(180);
        await waitFor('[data-r2-workspace-pane="blank-1"][data-r2-workspace-pane-configured="true"][data-r2-workspace-pane-kind="terminal"]');
        const petDock = await waitFor('[data-r2-workspace-pet-dock]');
        const petField = await waitFor('[data-r2-workspace-pet-field]');
        const petSprite = await waitFor('[data-r2-workspace-pet-sprite]');
        await waitFor('[data-r2-workspace-pet-quick-bar]');
        await waitFor('[data-r2-workspace-pet-status]');
        if (petDock.textContent.includes("Meowdesk dock")) {
          throw new Error("Workspace pet dock should restore the old visible pet field, not the placeholder label.");
        }
        await delay(260);
        if (sidebar.scrollHeight > sidebar.clientHeight + 1) {
          throw new Error("Workspace right sidebar should fit its visible modules without vertical clipping: " + JSON.stringify({
            clientHeight: sidebar.clientHeight,
            scrollHeight: sidebar.scrollHeight
          }));
        }
        const taskBoard = await waitFor('[data-r2-workspace-task-board]');
        const taskBoardViewport = taskBoard.parentElement?.getBoundingClientRect();
        const clippedTaskRows = taskBoardViewport ? [...taskBoard.children].filter((row) => {
          const rect = row.getBoundingClientRect();
          return rect.bottom > taskBoardViewport.bottom + 1 || rect.top < taskBoardViewport.top - 1;
        }).length : 0;
        if (clippedTaskRows) {
          throw new Error("Workspace priority board rows should fit without being clipped: " + clippedTaskRows);
        }
        const petDockRect = petDock.getBoundingClientRect();
        const petDockViewport = petDock.parentElement?.getBoundingClientRect();
        if (petDockViewport && (petDockRect.bottom > petDockViewport.bottom + 1 || petDockRect.top < petDockViewport.top - 1)) {
          throw new Error("Workspace pet dock should fit inside its panel body: " + JSON.stringify({
            dock: roundRect(petDockRect),
            viewport: roundRect(petDockViewport)
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
            field: roundRect(petFieldRect),
            sprite: roundRect(petSpriteRect)
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

        const terminalStartPanel = await waitFor('[data-r2-terminal-start-panel="blank-1"]');
        const terminalStart = await waitFor('[data-r2-terminal-start-panel="blank-1"] [data-r2-terminal-start="blank-1"]');
        const idleTerminalHost = await waitFor('[data-r2-terminal-host="blank-1"]');
        const idleHostStyle = getComputedStyle(idleTerminalHost);
        if (idleHostStyle.opacity !== "0" || idleHostStyle.pointerEvents !== "none") {
          throw new Error("Workspace idle xterm host should be hidden behind the center start panel: " + JSON.stringify({
            opacity: idleHostStyle.opacity,
            pointerEvents: idleHostStyle.pointerEvents
          }));
        }
        const startRect = terminalStart.getBoundingClientRect();
        if (startRect.width < 50 || startRect.height < 50) {
          throw new Error("Workspace center start button looks clipped: " + JSON.stringify(roundRect(startRect)));
        }
        const startCenterElement = document.elementFromPoint(startRect.left + startRect.width / 2, startRect.top + startRect.height / 2);
        if (!terminalStart.contains(startCenterElement)) {
          throw new Error("Workspace center start button is visually occluded by another element.");
        }
        const panelRect = terminalStartPanel.getBoundingClientRect();
        const paneRect = terminalPane.getBoundingClientRect();
        if (
          panelRect.width < paneRect.width - 12 ||
          panelRect.height < paneRect.height - 52
        ) {
          throw new Error("Workspace start panel no longer covers the idle runtime surface: " + JSON.stringify({
            panel: roundRect(panelRect),
            pane: roundRect(paneRect)
          }));
        }
        await delay(260);
        return {
          scenario: "r2-workspace-idle-visual",
          paneCount: panes.getAttribute("data-r2-workspace-pane-count"),
          workspace: roundRect(workspace.getBoundingClientRect()),
          startButton: roundRect(startRect),
          startPanel: roundRect(panelRect),
          idleHostOpacity: idleHostStyle.opacity,
          idleHostPointerEvents: idleHostStyle.pointerEvents
        };
      })()
    `, true);
  }

}

async function runVisualRecoverySecondBatchScenario(win, dependencies = {}, scenario) {
  if (scenario === "visual-recovery-second-batch") {
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
        const click = async (selector, wait = 160) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(wait);
          return element;
        };
        const focusVisualCard = async (element) => {
          if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
          element.focus({ preventScroll: true });
          await delay(120);
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
        const hasAnimation = (name, expected) => {
          const animation = String(name || "");
          return animation.split(",").map((item) => item.trim()).includes(expected);
        };
        const hasGlow = (value) => {
          const text = String(value || "").toLowerCase();
          return text.includes("255 255 255") || text.includes("255, 255, 255") || text.includes("0 140 255") || text.includes("0, 140, 255");
        };
        const opacityValue = (value) => {
          const parsed = Number.parseFloat(value);
          return Number.isFinite(parsed) ? parsed : 0;
        };
        const waitForRailMotion = async (label, timeout = 1600) => {
          const startedAt = Date.now();
          let lastDebug = null;
          while (Date.now() - startedAt <= timeout) {
            const rail = document.querySelector('[data-top-nav-running-surfaces] [data-product-shell-top-surface-rail]');
            if (rail) {
              const style = getComputedStyle(rail);
              lastDebug = {
                motion: rail.getAttribute("data-top-nav-surface-motion"),
                transform: style.transform,
                rect: rectDebug(rail)
              };
              if (lastDebug.motion === "magnet" && style.transform !== "none") {
                return { rail, sample: lastDebug };
              }
            }
            await delay(25);
          }
          throw new Error(label + " should move the real top-surface rail through Meowdesk-owned magnet motion: " + JSON.stringify(lastDebug));
        };
        const assertRailClearsTitle = async (titleElement, railElement, label) => {
          await delay(1500);
          const titleRect = titleElement.getBoundingClientRect();
          const railRect = railElement.getBoundingClientRect();
          const gap = railRect.left - titleRect.right;
          if (gap < 4) {
            throw new Error(label + " should settle without overlapping the title: " + JSON.stringify({
              title: rectDebug(titleElement),
              rail: rectDebug(railElement),
              gap: Math.round(gap * 100) / 100,
              motion: railElement.getAttribute("data-top-nav-surface-motion"),
              transform: getComputedStyle(railElement).transform
            }));
          }
          return { title: rectDebug(titleElement), rail: rectDebug(railElement), gap: Math.round(gap * 100) / 100 };
        };

        await click('[data-next-route="workspace"]');
        const title = await waitFor('[data-top-nav-title][data-top-nav-title-visual="meowdesk-scan"]');
        const titleBase = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-base');
        const scanText = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-scan-text');
        const scanBar = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-scan-bar');
        const titleStyle = getComputedStyle(title);
        const scanTextStyle = getComputedStyle(scanText);
        const scanBarStyle = getComputedStyle(scanBar);
        const runningSurfaces = await waitFor('[data-top-nav-running-surfaces]');
        const railMotion = await waitForRailMotion("TopNav route title change");
        if (
          titleBase.textContent.trim() !== "工作区" ||
          scanText.textContent.trim() !== "工作区" ||
          scanText.getAttribute("aria-hidden") !== "true" ||
          titleStyle.position !== "relative" ||
          !hasAnimation(scanTextStyle.animationName, "meowdesk-title-scan-reveal") ||
          !hasAnimation(scanBarStyle.animationName, "meowdesk-title-scan-bar") ||
          scanTextStyle.transform !== "none" ||
          String(scanTextStyle.clipPath || "").includes("none") ||
          !String(scanBarStyle.boxShadow || "").includes("55") ||
          runningSurfaces.getAttribute("data-top-nav-surface-push") !== "true"
        ) {
          throw new Error("TopNav clipped title scan and measured rail push should be owned by Meowdesk React/CSS, not VS DOM mutation: " + JSON.stringify({
            titleText: title.textContent.trim(),
            titleBase: titleBase.textContent.trim(),
            scanText: scanText.textContent.trim(),
            scanTextAriaHidden: scanText.getAttribute("aria-hidden"),
            titlePosition: titleStyle.position,
            scanTextAnimation: scanTextStyle.animationName,
            scanTextClipPath: scanTextStyle.clipPath,
            scanTextTransform: scanTextStyle.transform,
            scanBarAnimation: scanBarStyle.animationName,
            scanBarShadow: scanBarStyle.boxShadow,
            runningSurfacePush: runningSurfaces.getAttribute("data-top-nav-surface-push"),
            railMotion: railMotion.sample,
            titleRect: rectDebug(title)
          }));
        }
        const railSettlement = await assertRailClearsTitle(title, railMotion.rail, "TopNav route title rail motion");
        if (document.querySelector('[data-top-nav-title] .vs-energy-title, [data-top-nav-title] .vs-title-scan-bar, [data-top-nav-title] .hover-text')) {
          throw new Error("TopNav scan should not revive VS energy title DOM.");
        }

        await click('[data-r2-workspace-slot-button="1"]', 220);
        await waitFor('[data-r2-workspace-panes][data-r2-workspace-pane-count="1"]');
        await click('[data-r2-workspace-slot-button="2"]', 220);
        const newPane = await waitFor('[data-r2-workspace-pane="blank-2"][data-r2-workspace-pane-new="true"]');
        const newPaneStyle = getComputedStyle(newPane);
        const newPaneAnimation = newPaneStyle.animationName;
        if (!hasAnimation(newPaneStyle.animationName, "meowdesk-workspace-pane-enter")) {
          throw new Error("Workspace added pane should play the Meowdesk pane-enter family: " + JSON.stringify({
            animationName: newPaneStyle.animationName,
            rect: rectDebug(newPane)
          }));
        }

        await click('[data-r2-workspace-configure-pane="blank-2"]');
        await waitFor('[data-r2-workspace-config-dialog]');
        await waitFor('[data-r2-workspace-config-tool="smoke-terminal"]');
        await click('[data-r2-workspace-config-tool="smoke-terminal"]', 220);
        const configuredPane = await waitFor('[data-r2-workspace-pane="blank-2"][data-r2-workspace-pane-configured-pulse="true"][data-r2-workspace-pane-kind="terminal"]');
        const configuredPaneStyle = getComputedStyle(configuredPane);
        const configuredPaneAnimation = configuredPaneStyle.animationName;
        const configuredBefore = getComputedStyle(configuredPane, "::before");
        const configuredAfter = getComputedStyle(configuredPane, "::after");
        const configuredBeforeAnimation = configuredBefore.animationName;
        const configuredAfterAnimation = configuredAfter.animationName;
        if (
          !hasAnimation(configuredPaneAnimation, "meowdesk-workspace-pane-configured") ||
          !hasAnimation(configuredBeforeAnimation, "meowdesk-card-breath") ||
          !hasAnimation(configuredAfterAnimation, "meowdesk-card-inner-breath") ||
          !hasGlow(configuredBefore.boxShadow) ||
          !hasGlow(configuredAfter.boxShadow)
        ) {
          throw new Error("Configured workspace pane should pulse through the shared card glow family: " + JSON.stringify({
            paneAnimation: configuredPaneStyle.animationName,
            beforeAnimation: configuredBefore.animationName,
            afterAnimation: configuredAfter.animationName,
            beforeShadow: configuredBefore.boxShadow,
            afterShadow: configuredAfter.boxShadow,
            rect: rectDebug(configuredPane)
          }));
        }

        const taskCard = await waitFor('[data-r2-workspace-task-card], [data-r2-workspace-task-empty]');
        const idleCardBefore = getComputedStyle(taskCard, "::before");
        const idleCardAfter = getComputedStyle(taskCard, "::after");
        await focusVisualCard(taskCard);
        const cardBefore = getComputedStyle(taskCard, "::before");
        const cardAfter = getComputedStyle(taskCard, "::after");
        const cardBeforeAnimation = cardBefore.animationName;
        const cardAfterAnimation = cardAfter.animationName;
        const idleBeforeOpacity = opacityValue(idleCardBefore.opacity);
        const idleAfterOpacity = opacityValue(idleCardAfter.opacity);
        const hoverBeforeOpacity = opacityValue(cardBefore.opacity);
        const hoverAfterOpacity = opacityValue(cardAfter.opacity);
        if (
          !hasAnimation(cardBeforeAnimation, "meowdesk-card-ambient-breath") ||
          !hasAnimation(cardAfterAnimation, "meowdesk-card-ambient-inner-breath") ||
          hoverBeforeOpacity + 0.01 < idleBeforeOpacity ||
          hoverAfterOpacity + 0.01 < idleAfterOpacity ||
          !hasGlow(cardBefore.boxShadow) ||
          !hasGlow(cardAfter.boxShadow)
        ) {
          throw new Error("Workspace task card hover should keep a continuous ambient breathing timeline without dimming first: " + JSON.stringify({
            beforeAnimation: cardBefore.animationName,
            afterAnimation: cardAfter.animationName,
            idleBeforeAnimation: idleCardBefore.animationName,
            idleAfterAnimation: idleCardAfter.animationName,
            idleBeforeOpacity,
            idleAfterOpacity,
            hoverBeforeOpacity,
            hoverAfterOpacity,
            beforeShadow: cardBefore.boxShadow,
            afterShadow: cardAfter.boxShadow,
            rect: rectDebug(taskCard)
          }));
        }

        return {
          scenario: "visual-recovery-second-batch",
          titleScan: {
            scanTextAnimation: scanTextStyle.animationName,
            scanBarAnimation: scanBarStyle.animationName,
            railMotion: railMotion.sample,
            railSettlement
          },
          paneMotion: {
            newPaneAnimation,
            configuredPaneAnimation,
            configuredBeforeAnimation,
            configuredAfterAnimation
          },
          cardGlow: {
            beforeAnimation: cardBeforeAnimation,
            afterAnimation: cardAfterAnimation
          }
        };
      })()
    `, true);
  }
}

async function runWorkspaceRouteKeepaliveScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workspace-route-keepalive") {
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
        const waitForRuntimeOutput = (runtime, text, timeout = 8000) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            const sample = runtime.getAttribute("data-r2-terminal-output-sample") || "";
            if (sample.includes(text)) {
              resolve(sample);
              return;
            }
            if (Date.now() - startedAt > timeout) {
              reject(new Error("Timed out waiting for runtime output " + text + ": " + sample));
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
        const rectDebug = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom)
          };
        };
        const assertWorkspacePaneFit = async (count) => {
          await click('[data-r2-workspace-slot-button="' + count + '"]');
          const grid = await waitFor('[data-r2-workspace-panes][data-r2-workspace-pane-count="' + count + '"]');
          const runningPane = await waitFor('[data-r2-workspace-pane="blank-1"][data-r2-workspace-pane-configured="true"][data-r2-workspace-pane-kind="terminal"]');
          const runtime = await waitFor('[data-r2-terminal-runtime="blank-1"][data-r2-terminal-runtime-status="running"]', 8000);
          const host = await waitFor('[data-r2-terminal-host="blank-1"]', 8000);
          await delay(260);
          const gridRect = grid.getBoundingClientRect();
          const paneRect = runningPane.getBoundingClientRect();
          const hostRect = host.getBoundingClientRect();
          const shell = await waitFor('[data-route-shell]');
          const gridStyle = getComputedStyle(grid);
          const gridOverflowLeaks = grid.scrollWidth - grid.clientWidth > 2 && !["hidden", "clip"].includes(gridStyle.overflowX);
          const overflow = {
            count,
            documentScrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            shellScrollWidth: shell.scrollWidth,
            shellClientWidth: shell.clientWidth,
            gridScrollWidth: grid.scrollWidth,
            gridClientWidth: grid.clientWidth,
            gridOverflowLeaks,
            gridStyle: {
              overflowX: gridStyle.overflowX,
              gridTemplateColumns: gridStyle.gridTemplateColumns,
              columnGap: gridStyle.columnGap
            },
            grid: rectDebug(grid),
            runningPane: rectDebug(runningPane),
            host: rectDebug(host),
            panes: [...grid.querySelectorAll('[data-r2-workspace-pane]')].map((pane) => {
              const style = getComputedStyle(pane);
              return {
                id: pane.getAttribute("data-r2-workspace-pane"),
                rect: rectDebug(pane),
                scrollWidth: pane.scrollWidth,
                clientWidth: pane.clientWidth,
                transform: style.transform,
                animationName: style.animationName,
                boxShadow: style.boxShadow
              };
            })
          };
          if (document.documentElement.scrollWidth - window.innerWidth > 2 || shell.scrollWidth - shell.clientWidth > 2 || gridOverflowLeaks) {
            throw new Error("Workspace slot layout should not overflow horizontally after switching pane count: " + JSON.stringify(overflow));
          }
          if (paneRect.width < 150 || paneRect.height < 180 || hostRect.width < 120 || hostRect.height < 110) {
            throw new Error("Running workspace CLI pane should keep a usable xterm host after switching pane count: " + JSON.stringify(overflow));
          }
          if (paneRect.left < gridRect.left - 1 || paneRect.right > gridRect.right + 1 || paneRect.top < gridRect.top - 1 || paneRect.bottom > gridRect.bottom + 1) {
            throw new Error("Running workspace CLI pane should stay inside the pane grid after switching pane count: " + JSON.stringify(overflow));
          }
          return overflow;
        };

        await click('[data-next-route="workspace"]');
        await waitFor('[data-route-keepalive="workspace"][data-route-keepalive-active="true"]');
        await click('[data-r2-workspace-configure-pane="blank-1"]');
        await waitFor('[data-r2-workspace-config-dialog]');
        await waitFor('[data-r2-workspace-config-tool="smoke-terminal"]');
        await click('[data-r2-workspace-config-tool="smoke-terminal"]');
        await waitFor('[data-r2-workspace-pane="blank-1"][data-r2-workspace-pane-configured="true"][data-r2-workspace-pane-kind="terminal"]');
        await click('[data-r2-terminal-start="blank-1"]');
        const runtimeBefore = await waitFor('[data-r2-terminal-runtime="blank-1"][data-r2-terminal-runtime-status="running"]', 8000);
        const outputBefore = await waitForRuntimeOutput(runtimeBefore, "MEOWDESK_R2_TERMINAL_OK", 8000);
        const slotFitChecks = [];
        for (const count of [2, 3, 5, 6]) {
          slotFitChecks.push(await assertWorkspacePaneFit(count));
        }

        await click('[data-next-route="studio"]');
        await waitFor('[data-studio-route]');
        const hiddenRuntime = await waitFor('[data-route-keepalive="workspace"][data-route-keepalive-active="false"] [data-r2-terminal-runtime="blank-1"][data-r2-terminal-runtime-status="running"]', 4000);
        const outputWhileHidden = hiddenRuntime.getAttribute("data-r2-terminal-output-sample") || "";
        if (!outputWhileHidden.includes("MEOWDESK_R2_TERMINAL_OK")) {
          throw new Error("Workspace runtime lost output while route was hidden: " + outputWhileHidden);
        }

        await click('[data-next-route="workspace"]');
        const runtimeAfter = await waitFor('[data-route-keepalive="workspace"][data-route-keepalive-active="true"] [data-r2-terminal-runtime="blank-1"][data-r2-terminal-runtime-status="running"]', 4000);
        const outputAfter = runtimeAfter.getAttribute("data-r2-terminal-output-sample") || "";
        if (!outputAfter.includes("MEOWDESK_R2_TERMINAL_OK")) {
          throw new Error("Workspace runtime output disappeared after route restore: " + outputAfter);
        }

        return {
          scenario: "workspace-route-keepalive",
          statusBefore: runtimeBefore.getAttribute("data-r2-terminal-runtime-status"),
          statusAfter: runtimeAfter.getAttribute("data-r2-terminal-runtime-status"),
          slotFitChecks,
          outputBefore,
          outputAfter
        };
      })()
    `, true);
  }

}

async function runWorkspaceOutputRendererScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workspace-output-renderer" || scenario === "workspace-output-renderer-claude-startup" || scenario === "workspace-output-renderer-claude-chat") {
    return win.webContents.executeJavaScript(`
      (async () => {
        const isClaudeStartupScenario = ${JSON.stringify(scenario === "workspace-output-renderer-claude-startup")};
        const isClaudeChatScenario = ${JSON.stringify(scenario === "workspace-output-renderer-claude-chat")};
        const expectedProfile = isClaudeStartupScenario || isClaudeChatScenario ? "claude" : "hermes";
        const expectedTerminalText = isClaudeStartupScenario ? "ClaudeCode" : isClaudeChatScenario ? "Tests 16 passed" : "MEOWDESK_RENDERED";
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
        const assertRendererBodyFits = () => {
          const body = document.querySelector('[data-r2-output-renderer-content]');
          if (!body) throw new Error("Output renderer body is missing.");
          const overflow = Math.ceil(body.scrollWidth - body.clientWidth);
          if (overflow > 3) {
            const offenders = [...body.querySelectorAll("*")]
              .map((element) => ({
                tag: element.tagName.toLowerCase(),
                className: String(element.className || "").slice(0, 96),
                text: String(element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120),
                scrollWidth: Math.ceil(element.scrollWidth || 0),
                clientWidth: Math.ceil(element.clientWidth || 0),
                rectWidth: Math.ceil(element.getBoundingClientRect().width || 0)
              }))
              .filter((item) => item.scrollWidth > item.clientWidth + 3 || item.rectWidth > body.clientWidth + 3)
              .sort((a, b) => Math.max(b.scrollWidth, b.rectWidth) - Math.max(a.scrollWidth, a.rectWidth))
              .slice(0, 8);
            throw new Error("Output renderer body overflows horizontally by " + overflow + "px: " + JSON.stringify(offenders));
          }
        };
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(160);
          return element;
        };
        const setControlValue = (element, value) => {
          const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (setter) {
            setter.call(element, value);
          } else {
            element.value = value;
          }
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const launchFamilySnapshot = (root, expectedVariant) => {
          const family = root.querySelector('[data-meow-launch-family="agent-work-surface"][data-meow-launch-variant="' + expectedVariant + '"]');
          const icon = family?.querySelector(".meowdesk-launch-empty-state-icon");
          const title = family?.querySelector(".meowdesk-launch-empty-state-title");
          const meta = family?.querySelector(".meowdesk-launch-empty-state-meta");
          const primary = family?.querySelector(".meowdesk-launch-empty-state-primary .meowdesk-workspace-launch-button, .meowdesk-launch-empty-state-primary .meowdesk-output-renderer-bind-action");
          const secondary = family?.querySelector(".meowdesk-launch-empty-state-secondary");
          if (!family || !icon || !title || !meta || !primary) {
            throw new Error("Launch empty state must use shared owner/anatomy for " + expectedVariant + ": " + JSON.stringify({
              hasFamily: Boolean(family),
              hasIcon: Boolean(icon),
              hasTitle: Boolean(title),
              hasMeta: Boolean(meta),
              hasPrimary: Boolean(primary),
              hasSecondary: Boolean(secondary),
              text: root.textContent
            }));
          }
          const iconStyle = getComputedStyle(icon);
          const titleStrong = title.querySelector("strong");
          const titleStyle = titleStrong ? getComputedStyle(titleStrong) : null;
          const metaStyle = getComputedStyle(meta);
          const primaryStyle = getComputedStyle(primary);
          const iconRect = icon.getBoundingClientRect();
          const titleRect = title.getBoundingClientRect();
          const metaRect = meta.getBoundingClientRect();
          const primaryRect = primary.getBoundingClientRect();
          const primaryOverflowX = Math.ceil(primary.scrollWidth - primary.clientWidth);
          const primaryOverflowY = Math.ceil(primary.scrollHeight - primary.clientHeight);
          const primaryText = String(primary.textContent || "").replace(/\s+/g, " ").trim();
          const metaVisibility = {
            display: metaStyle.display,
            visibility: metaStyle.visibility,
            opacity: metaStyle.opacity,
            width: Math.round(metaRect.width),
            height: Math.round(metaRect.height),
            text: meta.textContent.trim(),
            ariaHidden: meta.getAttribute("aria-hidden"),
            className: String(meta.className || ""),
            vsTitleSubcopy: meta.classList.contains("vs-title-subcopy"),
            vsTechnicalCopyHidden: meta.classList.contains("vs-technical-copy-hidden")
          };
          if (
            metaStyle.display === "none" ||
            metaStyle.visibility === "hidden" ||
            Number(metaStyle.opacity) === 0 ||
            metaRect.width <= 0 ||
            metaRect.height <= 0 ||
            meta.getAttribute("aria-hidden") === "true" ||
            meta.classList.contains("vs-title-subcopy") ||
            meta.classList.contains("vs-technical-copy-hidden")
          ) {
            throw new Error("Launch empty state meta slot must be visible for " + expectedVariant + ": " + JSON.stringify(metaVisibility));
          }
          const nestedIconTiles = [...icon.children].filter((child) => {
            const childRect = child.getBoundingClientRect();
            const childStyle = getComputedStyle(child);
            const hasChrome =
              childStyle.backgroundColor !== "rgba(0, 0, 0, 0)" ||
              childStyle.borderTopWidth !== "0px" ||
              childStyle.boxShadow !== "none";
            return childRect.width >= 44 && childRect.height >= 44 && hasChrome;
          });
          if (nestedIconTiles.length) {
            throw new Error("Launch empty state icon slot must not wrap a second icon tile for " + expectedVariant + ": " + JSON.stringify({
              slot: {
                width: Math.round(iconRect.width),
                height: Math.round(iconRect.height),
                chrome: icon.getAttribute("data-meow-launch-icon-chrome") || "",
                backgroundColor: iconStyle.backgroundColor,
                borderTopWidth: iconStyle.borderTopWidth,
                boxShadow: iconStyle.boxShadow
              },
              nested: nestedIconTiles.map((child) => {
                const childRect = child.getBoundingClientRect();
                const childStyle = getComputedStyle(child);
                return {
                  tag: child.tagName,
                  className: String(child.className || ""),
                  width: Math.round(childRect.width),
                  height: Math.round(childRect.height),
                  backgroundColor: childStyle.backgroundColor,
                  borderTopWidth: childStyle.borderTopWidth,
                  borderRadius: childStyle.borderRadius,
                  boxShadow: childStyle.boxShadow
                };
              })
            }));
          }
          return {
            variant: expectedVariant,
            familyClass: family.className,
            icon: {
              width: Math.round(iconRect.width),
              height: Math.round(iconRect.height),
              borderRadius: iconStyle.borderRadius,
              backgroundColor: iconStyle.backgroundColor,
              borderTopColor: iconStyle.borderTopColor,
              chrome: icon.getAttribute("data-meow-launch-icon-chrome") || ""
            },
            title: {
              width: Math.round(titleRect.width),
              height: Math.round(titleRect.height),
              fontSize: titleStyle?.fontSize || "",
              fontWeight: titleStyle?.fontWeight || "",
              color: titleStyle?.color || ""
            },
            meta: {
              ...metaVisibility,
              fontSize: metaStyle.fontSize,
              fontWeight: metaStyle.fontWeight,
              color: metaStyle.color
            },
            primary: {
              width: Math.round(primaryRect.width),
              height: Math.round(primaryRect.height),
              borderRadius: primaryStyle.borderRadius,
              borderTopColor: primaryStyle.borderTopColor,
              backgroundColor: primaryStyle.backgroundColor,
              display: primaryStyle.display,
              alignItems: primaryStyle.alignItems,
              justifyContent: primaryStyle.justifyContent,
              whiteSpace: primaryStyle.whiteSpace,
              lineHeight: primaryStyle.lineHeight,
              overflowX: primaryOverflowX,
              overflowY: primaryOverflowY,
              text: primaryText
            }
          };
        };
        const assertLaunchFamilyCompatible = (left, right, label) => {
          const mismatch = {
            left,
            right
          };
          if (
            left.icon.width !== right.icon.width ||
            left.icon.height !== right.icon.height ||
            left.icon.borderRadius !== right.icon.borderRadius ||
            left.icon.backgroundColor !== right.icon.backgroundColor ||
            left.icon.borderTopColor !== right.icon.borderTopColor ||
            left.title.fontSize !== right.title.fontSize ||
            left.title.fontWeight !== right.title.fontWeight ||
            left.title.color !== right.title.color ||
            left.meta.fontSize !== right.meta.fontSize ||
            left.meta.fontWeight !== right.meta.fontWeight ||
            left.meta.color !== right.meta.color ||
            left.primary.height !== right.primary.height ||
            left.primary.borderRadius !== right.primary.borderRadius ||
            left.primary.borderTopColor !== right.primary.borderTopColor ||
            left.primary.backgroundColor !== right.primary.backgroundColor ||
            left.primary.display !== right.primary.display ||
            left.primary.alignItems !== right.primary.alignItems ||
            left.primary.justifyContent !== right.primary.justifyContent
          ) {
            throw new Error("Launch empty states must share one owner/family token set (" + label + "): " + JSON.stringify(mismatch));
          }
        };

        await click('[data-next-route="workspace"]');
        await click('[data-r2-workspace-slot-button="2"]');
        await waitFor('[data-r2-workspace-panes][data-r2-workspace-pane-count="2"]');
        await click('[data-r2-workspace-configure-pane="blank-1"]');
        await waitFor('[data-r2-workspace-config-dialog]');
        await click('[data-r2-workspace-config-tool="smoke-render-source"]');
        await waitFor('[data-r2-workspace-pane="blank-1"][data-r2-workspace-pane-kind="agent"]');
        const agentLaunchButton = await waitFor('[data-r2-terminal-start="blank-1"]', 8000);
        const agentLaunchGroup = await waitFor('[data-r2-terminal-start-panel="blank-1"]', 8000);
        const launchGroupStyle = getComputedStyle(agentLaunchGroup);
        const launchGroupRect = agentLaunchGroup.getBoundingClientRect();
        const comparableLaunchGroup = {
          left: Math.round(launchGroupRect.left),
          top: Math.round(launchGroupRect.top),
          width: Math.round(launchGroupRect.width),
          height: Math.round(launchGroupRect.height),
          centerY: Math.round(launchGroupRect.top + launchGroupRect.height / 2),
          display: launchGroupStyle.display,
          placeItems: launchGroupStyle.placeItems,
          padding: launchGroupStyle.padding,
          borderRadius: launchGroupStyle.borderRadius
        };
        const launchStyle = getComputedStyle(agentLaunchButton);
        const launchRect = agentLaunchButton.getBoundingClientRect();
        const launchIconRect = agentLaunchButton.querySelector("svg")?.getBoundingClientRect();
        const launchCenter = {
          x: launchRect.left + launchRect.width / 2,
          y: launchRect.top + launchRect.height / 2
        };
        const comparableLaunchStyles = {
          width: Math.round(launchRect.width),
          height: Math.round(launchRect.height),
          borderRadius: launchStyle.borderRadius,
          borderTopWidth: launchStyle.borderTopWidth,
          borderTopColor: launchStyle.borderTopColor,
          backgroundColor: launchStyle.backgroundColor
        };
        const agentLaunchFamily = launchFamilySnapshot(agentLaunchGroup, "workspace-agent");
        if (
          !agentLaunchButton.classList.contains("meowdesk-workspace-launch-button") ||
          !launchIconRect ||
          launchRect.height < 36 ||
          launchRect.width < 120 ||
          !launchStyle.display.includes("flex") ||
          launchStyle.alignItems !== "center" ||
          launchStyle.justifyContent !== "center"
        ) {
          throw new Error("Workspace Agent start panel must follow the workshop launch family before runtime starts: " + JSON.stringify({
            launchClass: agentLaunchButton.className,
            launch: comparableLaunchStyles,
            layout: { display: launchStyle.display, alignItems: launchStyle.alignItems, justifyContent: launchStyle.justifyContent },
            launchFamily: agentLaunchFamily,
            launchIcon: launchIconRect ? { left: launchIconRect.left, top: launchIconRect.top, width: launchIconRect.width, height: launchIconRect.height } : null
          }));
        }
        agentLaunchButton.click();
        await delay(160);
        const terminalRuntime = await waitFor('[data-r2-terminal-runtime="blank-1"][data-r2-terminal-runtime-status="running"]', 8000);
        await waitForText('[data-r2-terminal-runtime="blank-1"]', expectedTerminalText, 8000);
        const sample = terminalRuntime.getAttribute("data-r2-terminal-output-sample") || "";
        if (!isClaudeStartupScenario && !isClaudeChatScenario && !sample.includes("MEOWDESK_RENDERED")) {
          throw new Error("Smoke CLI output did not reach the raw terminal sample: " + sample);
        }
        if (terminalRuntime.getAttribute("data-r2-terminal-source-capture") !== "idle") {
          throw new Error("Terminal source capture should stay idle before a Meow Viewer binds to it.");
        }

        await click('[data-r2-workspace-configure-pane="blank-2"]');
        await waitFor('[data-r2-workspace-config-dialog]');
        await click('[data-r2-workspace-config-tool="output-renderer"]');
        await waitFor('[data-r2-output-renderer][data-r2-output-renderer-source=""][data-r2-output-renderer-profile="other"]', 8000);
        if (document.querySelector('[data-r2-output-renderer-bind-select]')) {
          throw new Error("Output renderer bind empty state must not expose the old dropdown select.");
        }
        const bindBox = await waitFor('[data-r2-output-renderer-empty="no-source"]', 8000);
        const bindAction = await waitFor('[data-r2-output-renderer-bind-button][data-r2-output-renderer-bind-target="blank-1"]', 8000);
        const bindLaunchFamily = launchFamilySnapshot(bindBox, "meow-viewer-bind");
        assertLaunchFamilyCompatible(agentLaunchFamily, bindLaunchFamily, "workspace-agent vs meow-viewer-bind");
        if (!bindBox.textContent.includes("绑定 CLI")) {
          throw new Error("Output renderer bind action should keep the launch-style label: " + bindBox.textContent);
        }
        const bindBoxRect = bindBox.getBoundingClientRect();
        const bindBoxStyle = getComputedStyle(bindBox);
        const bindActionRect = bindAction.getBoundingClientRect();
        const bindActionStyle = getComputedStyle(bindAction);
        const bindBoxCenter = {
          x: bindBoxRect.left + bindBoxRect.width / 2,
          y: bindBoxRect.top + bindBoxRect.height / 2
        };
        const bindActionCenter = {
          x: bindActionRect.left + bindActionRect.width / 2,
          y: bindActionRect.top + bindActionRect.height / 2
        };
        if (
          bindActionRect.height < 36 ||
          bindActionRect.width < 92 ||
          Math.abs(bindBoxCenter.x - bindActionCenter.x) > 3 ||
          bindActionStyle.whiteSpace !== "nowrap" ||
          Math.ceil(bindAction.scrollWidth - bindAction.clientWidth) > 3 ||
          Math.ceil(bindAction.scrollHeight - bindAction.clientHeight) > 3
        ) {
          throw new Error("Output renderer bind action should stay a horizontal text button, not collapse into an icon tile: " + JSON.stringify({
            box: { left: bindBoxRect.left, top: bindBoxRect.top, width: bindBoxRect.width, height: bindBoxRect.height },
            action: { left: bindActionRect.left, top: bindActionRect.top, width: bindActionRect.width, height: bindActionRect.height },
            style: {
              display: bindActionStyle.display,
              alignItems: bindActionStyle.alignItems,
              justifyContent: bindActionStyle.justifyContent,
              whiteSpace: bindActionStyle.whiteSpace,
              scrollWidth: bindAction.scrollWidth,
              clientWidth: bindAction.clientWidth,
              scrollHeight: bindAction.scrollHeight,
              clientHeight: bindAction.clientHeight,
              text: bindAction.textContent
            }
          }));
        }
        const groupFamilyMismatch = {
          launch: comparableLaunchGroup,
          bind: {
            left: Math.round(bindBoxRect.left),
            top: Math.round(bindBoxRect.top),
            width: Math.round(bindBoxRect.width),
            height: Math.round(bindBoxRect.height),
            centerY: Math.round(bindBoxRect.top + bindBoxRect.height / 2),
            display: bindBoxStyle.display,
            placeItems: bindBoxStyle.placeItems,
            padding: bindBoxStyle.padding,
            borderRadius: bindBoxStyle.borderRadius
          },
          buttonCenterDeltaY: Math.round(Math.abs((launchRect.top + launchRect.height / 2) - (bindActionRect.top + bindActionRect.height / 2)))
        };
        if (
          Math.abs(launchGroupRect.height - bindBoxRect.height) > 4 ||
          Math.abs((launchGroupRect.top + launchGroupRect.height / 2) - (bindBoxRect.top + bindBoxRect.height / 2)) > 4 ||
          Math.abs((launchRect.top + launchRect.height / 2) - (bindActionRect.top + bindActionRect.height / 2)) > 4 ||
          comparableLaunchGroup.display !== bindBoxStyle.display ||
          comparableLaunchGroup.placeItems !== bindBoxStyle.placeItems ||
          comparableLaunchGroup.borderRadius !== bindBoxStyle.borderRadius
        ) {
          throw new Error("Workspace Agent launch group and Meow Viewer bind group should share one outer-container family: " + JSON.stringify(groupFamilyMismatch));
        }
        const bindIconRect = bindAction.querySelector("svg")?.getBoundingClientRect();
        const bindStyle = getComputedStyle(bindAction);
        const comparableBindStyles = {
          width: Math.round(bindActionRect.width),
          height: Math.round(bindActionRect.height),
          borderRadius: bindStyle.borderRadius,
          borderTopWidth: bindStyle.borderTopWidth,
          borderTopColor: bindStyle.borderTopColor,
          backgroundColor: bindStyle.backgroundColor
        };
        if (
          !bindAction.classList.contains("meowdesk-workspace-launch-button") ||
          comparableLaunchStyles.height !== comparableBindStyles.height ||
          comparableLaunchStyles.borderRadius !== comparableBindStyles.borderRadius ||
          comparableLaunchStyles.borderTopColor !== comparableBindStyles.borderTopColor ||
          comparableLaunchStyles.backgroundColor !== comparableBindStyles.backgroundColor ||
          !bindIconRect ||
          !bindStyle.display.includes("flex") ||
          bindStyle.alignItems !== "center" ||
          bindStyle.justifyContent !== "center"
        ) {
          throw new Error("Workspace Agent start and Meow Viewer bind buttons must share one launch-button family: " + JSON.stringify({
            launchClass: "meowdesk-workspace-launch-button",
            bindClass: bindAction.className,
            launch: comparableLaunchStyles,
            bind: comparableBindStyles,
            bindLayout: { display: bindStyle.display, alignItems: bindStyle.alignItems, justifyContent: bindStyle.justifyContent },
            bindIcon: bindIconRect ? { left: bindIconRect.left, top: bindIconRect.top, width: bindIconRect.width, height: bindIconRect.height } : null
          }));
        }
        bindAction.click();
        await delay(180);
        const renderer = await waitFor('[data-r2-output-renderer][data-r2-output-renderer-source="blank-1"][data-r2-output-renderer-profile="' + expectedProfile + '"]', 8000);
        await waitFor('[data-r2-terminal-runtime="blank-1"][data-r2-terminal-source-capture="active"]', 8000);
        const commandToggle = await waitFor('[data-r2-output-renderer-command-toggle]', 8000);
        commandToggle.click();
        const commandHelp = await waitFor('[data-r2-output-renderer-command="/help"]', 8000);
        if (!commandHelp.textContent.includes("/help")) {
          throw new Error("Output renderer command menu should expose slash commands for the bound Agent: " + commandHelp.textContent);
        }
        document.querySelector('[data-r2-output-renderer-content]')?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        await waitForMissing('[data-r2-output-renderer-command-menu]', 8000);
        if (isClaudeStartupScenario) {
          const startup = await waitFor('[data-r2-output-renderer-startup="claude"]', 8000);
          const content = document.querySelector('[data-r2-output-renderer-content]');
          const contentText = content?.textContent || "";
          if (!startup.textContent.includes("Claude Code 已启动")) {
            throw new Error("Claude startup should render as a compact startup card: " + startup.textContent);
          }
          if (/模型\s*T\s*Opus/i.test(startup.textContent) || /模型[^目]*[·|]\s*目录/.test(startup.textContent) || !startup.textContent.includes("Opus4.7")) {
            throw new Error("Claude startup model should be extracted without TUI prefix residue: " + startup.textContent);
          }
          if (contentText.includes("Welcome back") || contentText.includes("Welcomeback") || contentText.includes("API Usage Billing") || contentText.includes("APIUsageBilling") || contentText.includes("for shortcuts") || contentText.includes("Tipsforgetting") || contentText.includes("Claude Code v") || contentText.includes("ClaudeCodev") || contentText.includes("□ □ □") || contentText.includes("█▀█") || contentText.includes("▀▀▀") || contentText.includes("T┬")) {
            throw new Error("Claude startup TUI should stay out of page view: " + contentText);
          }
          if (document.querySelector('[data-r2-output-renderer-message="assistant"]')) {
            throw new Error("Claude startup should not render startup glyph residue as an assistant message: " + contentText);
          }
          assertRendererBodyFits();
          return {
            scenario: "workspace-output-renderer-claude-startup",
            source: renderer.getAttribute("data-r2-output-renderer-source"),
            profile: renderer.getAttribute("data-r2-output-renderer-profile"),
            status: renderer.getAttribute("data-r2-output-renderer-status"),
            startup: startup.getAttribute("data-r2-output-renderer-startup")
          };
        }
        const rendererInput = await waitFor('[data-r2-output-renderer-input]', 8000);
        setControlValue(rendererInput, "草稿不应该提前进入渲染流");
        await delay(140);
        const draftContentText = document.querySelector('[data-r2-output-renderer-content]')?.textContent || "";
        if (draftContentText.includes("草稿不应该提前进入渲染流")) {
          throw new Error("Output renderer should not render unsent input draft: " + draftContentText);
        }
        const rendererPrompt = isClaudeChatScenario ? "再输出一个随意表格" : "从 Meow Viewer 发送一条消息";
        setControlValue(rendererInput, rendererPrompt);
        await delay(120);
        await click('[data-r2-output-renderer-send]');
        await waitForText('[data-r2-output-renderer-content]', rendererPrompt, 8000);
        if (isClaudeChatScenario) {
          try {
            await waitForText('[data-r2-terminal-runtime="blank-1"]', rendererPrompt, 3000);
          } catch (error) {
            // Narrow xterm DOM snapshots can drop the echoed prompt; the following Claude response and permission action still prove delivery.
          }
          await waitForText('[data-r2-output-renderer-content]', "交互发送验证", 8000);
        } else {
          await waitForText('[data-r2-terminal-runtime="blank-1"]', rendererPrompt, 8000);
          await waitForText('[data-r2-output-renderer-content]', "交互发送验证", 8000);
        }
          if (isClaudeChatScenario) {
            const content = await waitForText('[data-r2-output-renderer-content]', "你好！有什么可以帮你的？", 8000);
            await waitForText('[data-r2-output-renderer-content]', "用户认证模块重构", 8000);
            await waitForText('[data-r2-output-renderer-content]', "API 改动", 8000);
            await waitForText('[data-r2-output-renderer-content]', "正文和标题交替", 8000);
            await waitForText('[data-r2-output-renderer-content]', "标题、正文、表格和工具状态需要有清楚层级", 8000);
            await waitFor('[data-r2-output-renderer-callout="结论"]', 8000);
            await waitForText('[data-r2-output-renderer-content]', "正文和标题交替", 8000);
            const inferredHeading = [...document.querySelectorAll('[data-r2-output-renderer-heading="inferred"]')]
              .find((item) => (item.textContent || "").includes("正文和标题交替"));
            if (!inferredHeading) {
              const headings = [...document.querySelectorAll('[data-r2-output-renderer-heading="inferred"]')].map((item) => item.textContent).join(" / ");
              throw new Error("Claude plain short section titles should render as inferred headings: " + headings);
            }
            const statusStrip = document.querySelector('[data-r2-output-renderer-status-strip]');
            if (statusStrip && (statusStrip.textContent.includes("The user") || statusStrip.textContent.includes("generate some interesting"))) {
              throw new Error("Claude status strip should not show raw thought text: " + statusStrip.textContent);
            }
            const userMessage = await waitFor('[data-r2-output-renderer-message="user"]', 8000);
            const assistantMessage = await waitFor('[data-r2-output-renderer-message="assistant"]', 8000);
            const claudeAgentHeader = await waitFor('[data-r2-output-renderer-message-agent="claude"]', 8000);
            if (!claudeAgentHeader.textContent.includes("Claude 已回复")) {
              throw new Error("Completed Claude replies should show Meowni on the assistant message header: " + claudeAgentHeader.textContent);
            }
            const lingeringClaudePending = document.querySelector('[data-r2-output-renderer-activity-pending="claude"]');
            if (lingeringClaudePending) {
              throw new Error("Completed Claude replies should not leave a running Meowni pending state: " + lingeringClaudePending.textContent);
            }
            const themeRoot = document.querySelector("[data-meowdesk-theme]");
            if (themeRoot) {
              const previousTheme = themeRoot.getAttribute("data-meowdesk-theme") || "";
              themeRoot.setAttribute("data-meowdesk-theme", "light");
              await delay(80);
              const userParagraph = userMessage.querySelector(".meowdesk-output-renderer-paragraph") || userMessage;
              const userTextColor = getComputedStyle(userParagraph).color;
              const userTextColorNumbers = (userTextColor.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);
              const userTextIsLight = userTextColorNumbers.length === 3
                && userTextColorNumbers[0] >= 235
                && userTextColorNumbers[1] >= 240
                && userTextColorNumbers[2] >= 245;
              if (!userTextIsLight) {
                throw new Error("Light theme user bubble text should stay light on blue bubble: " + userTextColor);
              }
              themeRoot.setAttribute("data-meowdesk-theme", previousTheme || "dark");
            }
            const continuedUserMessage = [...document.querySelectorAll('[data-r2-output-renderer-message="user"]')]
              .find((item) => (item.textContent || "").includes("表格、diff") && (item.textContent || "").includes("、代码块、markdown文本"));
            if (!continuedUserMessage) {
              const users = [...document.querySelectorAll('[data-r2-output-renderer-message="user"]')].map((item) => item.textContent).join(" / ");
              throw new Error("Claude wrapped user prompt should stay in one user message: " + users);
            }
            const leakedPromptContinuation = [...document.querySelectorAll('[data-r2-output-renderer-message="assistant"]')]
              .find((item) => (item.textContent || "").includes("、代码块、markdown文本"));
            if (leakedPromptContinuation) {
              throw new Error("Claude wrapped prompt continuation leaked into assistant output: " + leakedPromptContinuation.textContent);
            }
            const floatingAssistantCopy = document.querySelector('[data-r2-output-renderer-copy="assistant-message"]');
            if (floatingAssistantCopy) {
              throw new Error("Assistant message should not show a floating copy button over the Meowni reply status header.");
            }
            const bottomReplyCopy = await waitFor('[data-r2-output-renderer-copy="assistant-message-bottom"]', 8000);
            bottomReplyCopy.click();
            await delay(120);
            const copiedBottomReply = await window.workbench.readClipboardText();
            if (!copiedBottomReply.includes("你好") && !copiedBottomReply.includes("原生 markdown") && !copiedBottomReply.includes("短回复")) {
              throw new Error("Bottom assistant reply copy should write the whole reply text to clipboard: " + copiedBottomReply);
            }
            try {
              await waitFor('[data-r2-output-renderer-table]', 8000);
          } catch (error) {
            const raw = document.querySelector('[data-r2-output-renderer-raw] pre')?.textContent || "";
            throw new Error((error?.message || error) + ". Renderer body: " + content.innerHTML + ". Raw: " + JSON.stringify(raw));
            }
            const tableCopy = await waitFor('[data-r2-output-renderer-copy="table"]', 8000);
            tableCopy.click();
            await delay(120);
            const copiedTable = await window.workbench.readClipboardText();
            if (!copiedTable.includes("|") || !copiedTable.includes("---") || (!copiedTable.includes("Claude markdown fence") && !copiedTable.includes("src/renderer"))) {
              throw new Error("Native table copy should write Markdown table text to clipboard: " + copiedTable);
            }
            const markdownFencePreview = await waitFor('[data-r2-output-renderer-markdown-preview="table"]', 8000);
            if (!markdownFencePreview.textContent.includes("Claude markdown fence") || !markdownFencePreview.textContent.includes("原生表格")) {
              throw new Error("Claude markdown fenced pipe tables should render as a native table preview: " + markdownFencePreview.textContent);
            }
            const markdownFenceCodeLeak = [...document.querySelectorAll('[data-r2-output-renderer-code="markdown"], [data-r2-output-renderer-code="md"]')]
              .find((item) => (item.textContent || "").includes("Claude markdown fence"));
            if (markdownFenceCodeLeak) {
              throw new Error("Claude markdown fenced pipe table should not stay as a MARKDOWN code block: " + markdownFenceCodeLeak.textContent);
            }
            const longTablePathCell = [...document.querySelectorAll('[data-r2-output-renderer-table] td')]
              .find((item) => (item.textContent || "").includes("src/renderer/ui/legacy-panel.js"));
            if (!longTablePathCell) {
              throw new Error("Claude long markdown table should render its path cell: " + content.innerHTML);
            }
            const longTablePathCellRect = longTablePathCell.getBoundingClientRect();
            if (longTablePathCellRect.width < 140 || longTablePathCellRect.height > 72) {
              throw new Error("Long table path cells should keep a readable width instead of breaking into a vertical stack: " + JSON.stringify({
                width: Math.round(longTablePathCellRect.width),
                height: Math.round(longTablePathCellRect.height),
                text: longTablePathCell.textContent
              }));
            }
            const boxTableRow = [...document.querySelectorAll('[data-r2-output-renderer-table] tbody tr')]
              .find((item) => (item.textContent || "").includes("src/renderer/main.js"));
            const boxTableCells = boxTableRow ? [...boxTableRow.querySelectorAll("td")].map((item) => (item.textContent || "").trim()) : [];
            if (
              boxTableCells.length < 6 ||
              !boxTableCells[1]?.includes("src/renderer/main.js") ||
              boxTableCells[2] !== "单文件过大" ||
              boxTableCells[3] !== "P0" ||
              boxTableCells[4] !== "进行中" ||
              boxTableCells[5] !== "核心重构项"
            ) {
              throw new Error("Terminal box-drawn long tables should render as an aligned native table row: " + JSON.stringify(boxTableCells) + " / " + content.innerHTML);
            }
            const contentText = content.textContent || "";
            for (const forbidden of ["The user just said", "The user wants", "The user is asking", "So they just want", "various markdown formatting", "output some random things", "generate some interesting demo content", "用户想要一个更长的表格", "真实的数据让表格看起来更有意义", "Bootstrapping", "Renderer smoke should hide", "Reading 1 file", "read 1 file", "esc to interrupt", "APIUsageBilling", "for shortcuts", "E:\\\\Meowdesk", "ClaudeCodev", "Read(", "Write(", "Create file", "Do you want to", "Yes, allow", "| --- |", "| 0 |", "Cooked for", "Churned for", "Thought for"]) {
              if (contentText.includes(forbidden)) {
                throw new Error("Claude chat renderer leaked terminal/thinking noise: " + forbidden + " in " + contentText);
              }
            }
            const statusStripText = statusStrip?.textContent || "";
            if (statusStripText.includes("generate some interesting") || statusStripText.includes("the project is about")) {
              throw new Error("Claude status strip should not classify raw thought as model/context state: " + statusStrip.textContent);
            }
            const readTool = await waitFor('[data-r2-output-renderer-tool="read"]', 8000);
            if (!readTool.textContent.includes("读取") || !readTool.textContent.includes("src/main.js")) {
              throw new Error("Claude read status should render as a colored tool block: " + readTool.textContent);
            }
            let editTool = null;
            try {
              editTool = await waitFor('[data-r2-output-renderer-tool="edit"]', 8000);
            } catch (error) {
              const tools = [...document.querySelectorAll('[data-r2-output-renderer-tool]')].map((item) => item.textContent).join(" / ");
              throw new Error((error?.message || error) + ". Rendered tools: " + tools + ". Renderer body: " + content.textContent);
            }
            if (!editTool.textContent.includes("修改") || !editTool.textContent.includes("renderer_test.md")) {
              throw new Error("Claude edit status should render as a colored tool block: " + editTool.textContent);
            }
            const diffBlock = await waitFor('[data-r2-output-renderer-diff]', 8000);
            if (!diffBlock.textContent.includes("-旧行") || !diffBlock.textContent.includes("+新行")) {
              throw new Error("Claude edit preview should render as diff lines: " + diffBlock.textContent);
            }
            const diffCopy = diffBlock.querySelector('[data-r2-output-renderer-copy="diff"]');
            if (!diffCopy) {
              throw new Error("Diff blocks should keep their own copy button.");
            }
            diffCopy.click();
            await delay(120);
            const copiedDiff = await window.workbench.readClipboardText();
            if (!copiedDiff.includes("-旧行") || !copiedDiff.includes("+新行")) {
              throw new Error("Diff copy button should write raw diff text to clipboard: " + copiedDiff);
            }
            if (!diffBlock.querySelector('[data-r2-output-renderer-diff-line="remove"]') || !diffBlock.querySelector('[data-r2-output-renderer-diff-line="add"]')) {
              throw new Error("Claude diff block should mark add/remove lines for color styling.");
            }
            const falseDiff = [...document.querySelectorAll('[data-r2-output-renderer-diff]')].find((item) => (item.textContent || "").includes("普通优点列表") || (item.textContent || "").includes("普通风险列表"));
            if (falseDiff) {
              throw new Error("Claude prose +/- lines should not be rendered as a diff block: " + falseDiff.textContent);
            }
            await waitForText('[data-r2-output-renderer-content]', "fetchDataWithRetry", 8000);
            const richDiff = [...document.querySelectorAll('[data-r2-output-renderer-diff]')]
              .find((item) => (item.textContent || "").includes("src/meowviewer/core.ts"));
            if (!richDiff || !richDiff.textContent.includes("async render") || !richDiff.textContent.includes("this.parseData(data)") || !richDiff.textContent.includes("// 实现略")) {
              throw new Error("Unfenced Claude diff should keep context/comment lines in the same diff block: " + (richDiff?.textContent || content.innerHTML));
            }
            const commentHeading = [...document.querySelectorAll('[data-r2-output-renderer-heading]')]
              .find((item) => /^\\/\\//.test((item.textContent || "").trim()));
            if (commentHeading) {
              throw new Error("Code comments should not be promoted to markdown headings: " + commentHeading.textContent);
            }
            const codeBlocksText = [...document.querySelectorAll('[data-r2-output-renderer-code]')]
              .map((item) => item.textContent || "")
              .join("\\n");
            if (!codeBlocksText.includes("// 深度可选类型") || !codeBlocksText.includes("type DeepPartial") || !codeBlocksText.includes("type NodeConfig") || !codeBlocksText.includes("map_err(|_| SchedulerError::LockPoisoned)") || !codeBlocksText.includes("// 核心循环") || !codeBlocksText.includes("this.#items.size")) {
              throw new Error("TypeScript comments and quote code should stay inside code blocks: " + codeBlocksText);
            }
            const tsBlock = [...document.querySelectorAll('[data-r2-output-renderer-code="ts"], [data-r2-output-renderer-code="typescript"]')]
              .find((item) => (item.textContent || "").includes("type NodeConfig") && (item.textContent || "").includes("| { type: 'condition'"));
            if (!tsBlock) {
              throw new Error("TypeScript union lines with pipes should stay in a TypeScript code block: " + content.innerHTML);
            }
            const rustBlock = [...document.querySelectorAll('[data-r2-output-renderer-code="rust"], [data-r2-output-renderer-code="rs"]')]
              .find((item) => (item.textContent || "").includes("map_err(|_| SchedulerError::LockPoisoned)"));
            if (!rustBlock) {
              throw new Error("Rust closure pipes should stay in a Rust code block instead of table/CSS fragments: " + content.innerHTML);
            }
            const leakedCodeText = [...document.querySelectorAll('[data-r2-output-renderer-paragraph], [data-r2-output-renderer-heading]')]
              .find((item) => /type:\\s*'action'|map_err\\(\\|_\\||SchedulerError::|if\\s*\\(tasks\\.iter\\(\\)\\.any/.test((item.textContent || "").trim()));
            if (leakedCodeText) {
              throw new Error("Claude code lines should not leak into paragraphs/headings outside code blocks: " + leakedCodeText.textContent);
            }
            const sqlBlock = [...document.querySelectorAll('[data-r2-output-renderer-code="sql"]')]
              .find((item) => (item.textContent || "").includes("SELECT module_name, status, priority") && (item.textContent || "").includes("ORDER BY priority DESC;"));
            if (!sqlBlock) {
              throw new Error("Bare SQL language labels should keep SELECT/FROM/WHERE/ORDER BY inside one SQL code block: " + content.innerHTML);
            }
            const sqlHeading = [...document.querySelectorAll('[data-r2-output-renderer-heading]')]
              .find((item) => /^(?:SQL|SELECT|FROM|WHERE|ORDER BY)\\b/i.test((item.textContent || "").trim()));
            if (sqlHeading) {
              throw new Error("SQL code lines should not be promoted to markdown headings: " + sqlHeading.textContent);
            }
            const falseCssPipeBlock = [...document.querySelectorAll('[data-r2-output-renderer-code="css"]')]
              .find((item) => /type NodeConfig|map_err|SchedulerError/.test(item.textContent || ""));
            if (falseCssPipeBlock) {
              throw new Error("Pipe-heavy code should not be mislabeled as CSS: " + falseCssPipeBlock.textContent);
            }
            const jsBlock = [...document.querySelectorAll('[data-r2-output-renderer-code="javascript"], [data-r2-output-renderer-code="js"]')]
              .find((item) => (item.textContent || "").includes("VirtualScroll") && (item.textContent || "").includes("this.#items.size"));
            if (!jsBlock) {
              throw new Error("JavaScript private-field code should stay in one JS code block instead of Python/plain text: " + content.innerHTML);
            }
            if ([...document.querySelectorAll('[data-r2-output-renderer-code="python"]')]
              .some((item) => (item.textContent || "").includes("VirtualScroll") || (item.textContent || "").includes("this.#items.size"))) {
              throw new Error("JavaScript private-field code should not be labeled as Python.");
            }
            let hr = null;
            try {
              hr = await waitFor('[data-r2-output-renderer-hr]', 8000);
            } catch (error) {
              const renderedText = content.textContent || "";
              const renderedHtml = content.innerHTML || "";
              const codeBlockSummary = [...document.querySelectorAll('[data-r2-output-renderer-code]')]
                .map((item, codeIndex) => {
                  const codeText = item.textContent || "";
                  const lang = item.getAttribute("data-r2-output-renderer-code") || "";
                  return "#" + codeIndex + ":" + lang + ":" + codeText.slice(Math.max(0, codeText.length - 900));
                })
                .join(" || ");
              const textStart = Math.max(0, renderedText.indexOf("VirtualScroll") - 600);
              const htmlStart = Math.max(0, renderedHtml.indexOf("VirtualScroll") - 1200);
              throw new Error(
                (error?.message || error)
                + ". Markdown horizontal rule should render as a divider. Text near JS block: "
                + renderedText.slice(textStart, textStart + 1800)
                + ". Code block summary: "
                + codeBlockSummary
                + ". HTML near JS block: "
                + renderedHtml.slice(htmlStart, htmlStart + 2400)
              );
            }
            if (!hr) {
              throw new Error("Markdown horizontal rule should render as a divider.");
            }
            const startedOrderedList = [...document.querySelectorAll('[data-r2-output-renderer-list="ordered"]')]
              .find((item) => item.getAttribute("start") === "3" || item.textContent.includes("JavaScript 虚拟滚动"));
            if (!startedOrderedList) {
              throw new Error("Numbered markdown sections should preserve their original numbering: " + content.innerHTML);
            }
            const shellBlock = [...document.querySelectorAll('[data-r2-output-renderer-code="shell"]')]
              .find((item) => (item.textContent || "").includes("meowviewer@1.0.0 test") && (item.textContent || "").includes("vitest run"));
            if (!shellBlock) {
              throw new Error("Shell output should render as a shell code block: " + content.innerHTML);
            }
            const shellUserBubble = [...document.querySelectorAll('[data-r2-output-renderer-message="user"]')]
              .find((item) => (item.textContent || "").includes("meowviewer@1.0.0 test") || (item.textContent || "").includes("vitest run"));
            if (shellUserBubble) {
              throw new Error("Shell output lines starting with > should not render as user messages: " + shellUserBubble.textContent);
            }
            const permissionCard = await waitFor('[data-r2-output-renderer-permission]', 8000);
            const permissionText = permissionCard.textContent || "";
            if (!permissionText.includes("权限询问") || !permissionText.includes("允许一次") || !permissionText.includes("本次会话允许") || !permissionText.includes("拒绝")) {
              throw new Error("Claude permission prompt should render as a framed choice card: " + permissionText);
          }
          await click('[data-r2-output-renderer-permission-choice="1"]');
          await waitForText('[data-r2-terminal-runtime="blank-1"]', "MEODESK_PERMISSION_CHOICE_RECEIVED:1", 8000);
          if (document.querySelectorAll('[data-r2-output-renderer-message="user"]').length < 2) {
            throw new Error("Claude chat renderer should keep user turns visually separated.");
          }
          if (document.querySelectorAll('[data-r2-output-renderer-message="assistant"]').length < 2) {
            throw new Error("Claude chat renderer should keep assistant turns separated after user prompts and diffs.");
          }
          const finalStatusStrip = document.querySelector('[data-r2-output-renderer-status-strip]');
          const finalThinkingStatus = finalStatusStrip
            ? [...finalStatusStrip.querySelectorAll('[data-r2-output-renderer-status-item="thinking"]')]
              .find((item) => (item.textContent || "").includes("思考"))
            : null;
          if (finalThinkingStatus) {
            throw new Error("Completed Claude replies should not leave a flickering thinking status strip item: " + finalThinkingStatus.textContent);
          }
          const leakedThinkingBlock = document.querySelector('[data-r2-output-renderer-thinking]');
          if (leakedThinkingBlock) {
            throw new Error("Completed Claude activity should not render as a conversation thinking card: " + leakedThinkingBlock.textContent);
          }
          assertRendererBodyFits();
          return {
            scenario: "workspace-output-renderer-claude-chat",
            source: renderer.getAttribute("data-r2-output-renderer-source"),
            profile: renderer.getAttribute("data-r2-output-renderer-profile"),
            status: renderer.getAttribute("data-r2-output-renderer-status"),
            user: userMessage.textContent,
            assistant: assistantMessage.textContent,
            tables: document.querySelectorAll('[data-r2-output-renderer-table]').length
          };
        }
        const content = await waitForText('[data-r2-output-renderer-content]', "MEOWDESK_RENDERED", 8000);
        await waitForText('[data-r2-output-renderer-content]', "Hermes 主", 8000);
        await waitForText('[data-r2-output-renderer-content]', "财务日报", 8000);
        await waitForText('[data-r2-output-renderer-content]', "加粗重点", 8000);
        await waitForText('[data-r2-output-renderer-content]', "text-transform: uppercase", 8000);
        await waitForText('[data-r2-output-renderer-content]', "Hello Meow", 8000);
        await waitForText('[data-r2-output-renderer-content]', "calc_daily_report", 8000);
        await waitForText('[data-r2-output-renderer-content]', "现金流", 8000);
        await waitForText('[data-r2-output-renderer-content]', "表格后这句话必须继续渲染", 8000);
        await waitFor('[data-r2-output-renderer-heading="1"]');
        await waitFor('[data-r2-output-renderer-heading="2"]');
        await waitFor('[data-r2-output-renderer-heading="3"]');
        await waitFor('[data-r2-output-renderer-callout="结论"]');
        const h1 = document.querySelector('[data-r2-output-renderer-heading="1"]');
        const h2 = document.querySelector('[data-r2-output-renderer-heading="2"]');
        const h3 = document.querySelector('[data-r2-output-renderer-heading="3"]');
        const h1Size = Number.parseFloat(getComputedStyle(h1).fontSize || "0");
        const h2Size = Number.parseFloat(getComputedStyle(h2).fontSize || "0");
        const h3Size = Number.parseFloat(getComputedStyle(h3).fontSize || "0");
        if (!(h1Size > h2Size && h2Size > h3Size)) {
          throw new Error("Markdown H1-H3 heading levels should be visually distinct like a note reader: " + JSON.stringify({ h1Size, h2Size, h3Size }));
        }
        const boldNode = [...content.querySelectorAll("strong")].find((item) => item.textContent.includes("加粗重点"));
        const emNode = [...content.querySelectorAll("em")].find((item) => item.textContent.includes("斜体补充"));
        if (!boldNode || !emNode) {
          throw new Error("Hermes markdown emphasis should render as strong/em nodes: " + content.innerHTML);
        }
        const checklistText = [...content.querySelectorAll(".meowdesk-output-renderer-check p")]
          .find((item) => (item.textContent || "").includes("跑每日"));
        if (!checklistText || checklistText.getBoundingClientRect().width < 48) {
          throw new Error("Hermes checklist text should not collapse into a vertical stack: " + content.innerHTML);
        }
        const checklistInlineText = checklistText.querySelector("span");
        if (checklistInlineText && checklistInlineText.getBoundingClientRect().width <= 20) {
          throw new Error("Hermes checklist inline text should not inherit checkbox icon sizing: " + content.innerHTML);
        }
        let statusStrip = null;
        try {
          statusStrip = await waitFor('[data-r2-output-renderer-status-strip]', 8000);
        } catch (error) {
          const raw = document.querySelector('[data-r2-output-renderer-raw] pre')?.textContent || "";
          throw new Error((error?.message || error)
            + ". Renderer attrs: "
            + JSON.stringify({
              source: renderer.getAttribute("data-r2-output-renderer-source"),
              profile: renderer.getAttribute("data-r2-output-renderer-profile"),
              status: renderer.getAttribute("data-r2-output-renderer-status"),
              events: renderer.getAttribute("data-r2-output-renderer-events"),
              sourceEvents: renderer.getAttribute("data-r2-output-renderer-source-events"),
              statusPreview: renderer.getAttribute("data-r2-output-renderer-status-preview")
            })
            + ". Terminal status preview: " + (terminalRuntime.getAttribute("data-r2-terminal-status-preview") || "").slice(0, 800)
            + ". Body: " + (content.textContent || "").slice(0, 800)
            + ". Raw: " + raw.slice(0, 800));
        }
        if (!statusStrip.textContent.includes("模型") || !statusStrip.textContent.includes("deepseek-v4-flash") || !statusStrip.textContent.includes("上下文")) {
          throw new Error("Hermes model/context state should render in the compact status strip: " + statusStrip.textContent);
        }
        const hermesAgentHeader = await waitFor('[data-r2-output-renderer-message-agent="hermes"]', 8000);
        if (!hermesAgentHeader.textContent.includes("Hermes 已回复")) {
          throw new Error("Completed Hermes replies should show Meowni on the assistant message header: " + hermesAgentHeader.textContent);
        }
        const lingeringHermesPending = document.querySelector('[data-r2-output-renderer-activity-pending="hermes"]');
        if (lingeringHermesPending) {
          throw new Error("Completed Hermes replies should not leave a running Meowni pending state: " + lingeringHermesPending.textContent);
        }
        const lingeringHermesThinkingStatus = [...statusStrip.querySelectorAll('[data-r2-output-renderer-status-item="thinking"]')]
          .find((item) => (item.textContent || "").includes("思考") || (item.textContent || "").includes("阶段"));
        if (lingeringHermesThinkingStatus) {
          throw new Error("Completed Hermes replies should not leave a flickering thinking status strip item: " + lingeringHermesThinkingStatus.textContent);
        }
        const hermesThinking = document.querySelector('[data-r2-output-renderer-thinking]');
        if (hermesThinking) {
          throw new Error("Hermes reasoning should not render as a flickering conversation thinking card: " + hermesThinking.textContent);
        }
        assertRendererBodyFits();
        try {
          await waitFor('[data-r2-output-renderer-code="js"]');
          await waitFor('[data-r2-output-renderer-code="python"]');
        } catch (error) {
          const raw = document.querySelector('[data-r2-output-renderer-raw] pre')?.textContent || "";
          throw new Error((error?.message || error) + ". Renderer body: " + content.innerHTML + ". Raw: " + JSON.stringify(raw));
        }
        const inferredTsFence = [...document.querySelectorAll('[data-r2-output-renderer-code="ts"], [data-r2-output-renderer-code="typescript"]')]
          .find((item) => (item.textContent || "").includes("SmokeViewerSession") && (item.textContent || "").includes("smokeSession"));
        if (!inferredTsFence) {
          throw new Error("Unlabelled TypeScript fenced code should infer a TypeScript code block: " + content.innerHTML);
        }
        const textTsFence = [...document.querySelectorAll('[data-r2-output-renderer-code="text"]')]
          .find((item) => (item.textContent || "").includes("SmokeViewerSession"));
        if (textTsFence) {
          throw new Error("Unlabelled TypeScript fenced code should not render as TEXT: " + textTsFence.textContent);
        }
        const autoCodeBlock = await waitFor('[data-r2-output-renderer-code="css"], [data-r2-output-renderer-code="html"]', 8000);
        if (!autoCodeBlock.textContent.includes("text-transform") && !autoCodeBlock.textContent.includes("Hello Meow")) {
          throw new Error("Bare code snippets should render as framed code blocks: " + autoCodeBlock.textContent);
        }
        const codeCopy = await waitFor('[data-r2-output-renderer-copy="code"]', 8000);
        codeCopy.click();
        await delay(120);
        const copiedText = await window.workbench.readClipboardText();
        if (!copiedText.includes("console.log") && !copiedText.includes("text-transform") && !copiedText.includes("Hello Meow")) {
          throw new Error("Code copy button should write code text to the clipboard: " + copiedText);
        }
        try {
          await waitFor('[data-r2-output-renderer-table]');
        } catch (error) {
          const raw = document.querySelector('[data-r2-output-renderer-raw] pre')?.textContent || "";
          throw new Error((error?.message || error) + ". Renderer body: " + content.innerHTML + ". Raw: " + JSON.stringify(raw));
        }
        const treeBlock = [...document.querySelectorAll('[data-r2-output-renderer-code="tree"]')]
          .find((item) => (item.textContent || "").includes("E:\\\\self-archive") && (item.textContent || "").includes("SKILL.md"));
        if (!treeBlock) {
          throw new Error("Terminal directory tree should render as a preserved tree/code block: " + content.innerHTML);
        }
        const pythonBlock = [...document.querySelectorAll('[data-r2-output-renderer-code="python"]')]
          .find((item) => (item.textContent || "").includes("if __name__") && (item.textContent || "").includes("017811 当前基线"));
        if (!pythonBlock) {
          throw new Error("Hermes Python code should keep the __main__ block and comment inside the same code block: " + content.innerHTML);
        }
        if (!pythonBlock.textContent.includes('print(greet("Shizuku", "很棒"))') || !pythonBlock.textContent.includes('print("当前状态地图：", status)')) {
          throw new Error("Hermes Python function calls with Chinese string arguments should stay inside the Python code block: " + content.innerHTML);
        }
        const leakedPythonCall = [...document.querySelectorAll('[data-r2-output-renderer-paragraph], [data-r2-output-renderer-heading]')]
          .find((item) => /^print\\(/.test((item.textContent || "").trim()));
        if (leakedPythonCall) {
          throw new Error("Hermes Python function calls should not leak outside code blocks: " + leakedPythonCall.textContent);
        }
        const pythonCallHeading = [...document.querySelectorAll('[data-r2-output-renderer-heading]')]
          .find((item) => /^print\\(/.test((item.textContent || "").trim()));
        if (pythonCallHeading) {
          throw new Error("Python function call lines should not be promoted to markdown headings: " + pythonCallHeading.textContent);
        }
        const hermesSqlBlock = [...document.querySelectorAll('[data-r2-output-renderer-code="sql"]')]
          .find((item) => (item.textContent || "").includes("WITH monthly_revenue") && (item.textContent || "").includes("ORDER BY month DESC;"));
        if (!hermesSqlBlock) {
          throw new Error("Hermes SQL after reasoning/status markers should render as a SQL code block: " + content.innerHTML);
        }
        if ((hermesSqlBlock.textContent || "").includes("VIP1") || (hermesSqlBlock.textContent || "").includes("¥2,980")) {
          throw new Error("Hermes table rows should not be swallowed into the preceding SQL code block: " + hermesSqlBlock.textContent);
        }
        const hermesCteSqlBlocks = [...document.querySelectorAll('[data-r2-output-renderer-code="sql"]')]
          .filter((item) => /org_chain|dept_stats|rank_in_level|MVSQLONECARD/.test(item.textContent || ""));
        if (hermesCteSqlBlocks.length !== 1) {
          throw new Error("Hermes CTE SQL should render as one SQL code block, not fragmented cards: " + hermesCteSqlBlocks.map((item) => (item.textContent || "").slice(0, 220)).join(" || ") + " / " + content.innerHTML);
        }
        const hermesCteSqlText = hermesCteSqlBlocks[0]?.textContent || "";
        for (const requiredSqlPart of ["WITH RECURSIVE", "org_chain AS", "FROM employees e", "UNION ALL", "-- MVSQLONECARD", "dept_stats AS", "LEFT JOIN org_chain", "RANK", "ORDER BY oc.level"]) {
          if (!hermesCteSqlText.includes(requiredSqlPart)) {
            throw new Error("Hermes CTE SQL one-card block is missing " + requiredSqlPart + ": " + hermesCteSqlText);
          }
        }
        const vipTable = [...document.querySelectorAll('[data-r2-output-renderer-table]')]
          .find((item) => (item.textContent || "").includes("VIP1") && (item.textContent || "").includes("¥2,980"));
        if (!vipTable) {
          throw new Error("Hermes Markdown table after bare SQL should render as a native table: " + content.innerHTML);
        }
        const vipTableCopy = vipTable.querySelector('[data-r2-output-renderer-copy="table"]');
        if (!vipTableCopy) {
          throw new Error("Hermes native table blocks should keep a table copy button: " + vipTable.textContent);
        }
        vipTableCopy.click();
        await delay(120);
        const copiedVipTable = await window.workbench.readClipboardText();
        if (!copiedVipTable.includes("| VIP1 |") || !copiedVipTable.includes("¥2,980")) {
          throw new Error("Hermes table copy should write Markdown table text to clipboard: " + copiedVipTable);
        }
        if (content.textContent.includes("The user asked for SQL output directly")) {
          throw new Error("Hermes hidden reasoning text should not leak into rendered content: " + content.textContent);
        }
        const hermesDiffBlock = [...document.querySelectorAll('[data-r2-output-renderer-diff]')]
          .find((item) => (item.textContent || "").includes("--- a/src/app.py") && (item.textContent || "").includes('return f"Hi there, {name}!"'));
        if (!hermesDiffBlock) {
          throw new Error("Hermes bare diff language labels should render the following diff as one diff block: " + content.innerHTML);
        }
        const hermesDiffCopy = hermesDiffBlock.querySelector('[data-r2-output-renderer-copy="diff"]');
        if (!hermesDiffCopy) {
          throw new Error("Hermes diff blocks should keep a diff copy button.");
        }
        const leakedDiffLabel = [...document.querySelectorAll('[data-r2-output-renderer-paragraph], [data-r2-output-renderer-heading]')]
          .find((item) => (item.textContent || "").trim().toLowerCase() === "diff");
        if (leakedDiffLabel) {
          throw new Error("Hermes bare diff language label should not leak as paragraph text before the diff block: " + content.innerHTML);
        }
        for (const forbidden of ["Welcome to Hermes Agent", "Hermes Agent - AI Agent Framework", "deepseek-v4-flash", "Reasoning", "quickly scanned", "read /mnt", "toolsets:", "/help for commands", "msg=interrupt", "/queue", "Ctrl+C cancel", "saturate your keys", "jupyter-live-kernel", "native-mcp", "software-development", "提示复图"]) {
          if (content.textContent.includes(forbidden)) {
            throw new Error("Output renderer should hide Hermes startup/status noise from page view: " + forbidden + " in " + content.textContent);
          }
        }
        if (content.textContent.includes("Welcome to Hermes Agent") || content.textContent.includes("deepseek-v4-flash")) {
          throw new Error("Output renderer should hide Hermes startup/status noise from page view: " + content.textContent);
        }
        if (!content.textContent.includes("src/main.js") || !content.textContent.includes("Hermes 主") || !content.textContent.includes("财务日报")) {
          throw new Error("Output renderer did not preserve markdown content and path tokens: " + content.textContent);
        }
        const body = document.querySelector('[data-r2-output-renderer-content]');
        if (!body) throw new Error("Output renderer body disappeared before scroll lock check.");
        body.scrollTop = 0;
        body.dispatchEvent(new Event("scroll"));
        const scrollTopBeforeDelayedOutput = body.scrollTop;
        await waitForText('[data-r2-output-renderer-content]', "这行到达时不应该强制置底", 10000);
        await delay(160);
        if (body.scrollHeight > body.clientHeight + 24 && body.scrollTop > scrollTopBeforeDelayedOutput + 8) {
          throw new Error("Output renderer should not force-scroll while the user is reading older output: " + JSON.stringify({
            before: scrollTopBeforeDelayedOutput,
            after: body.scrollTop,
            clientHeight: body.clientHeight,
            scrollHeight: body.scrollHeight
          }));
        }
        return {
          scenario: "workspace-output-renderer",
          source: renderer.getAttribute("data-r2-output-renderer-source"),
          profile: renderer.getAttribute("data-r2-output-renderer-profile"),
          status: renderer.getAttribute("data-r2-output-renderer-status"),
          codeBlocks: document.querySelectorAll('[data-r2-output-renderer-code]').length,
          tables: document.querySelectorAll('[data-r2-output-renderer-table]').length
        };
      })()
    `, true);
  }

}

async function runOwnershipIsolationScenario(win, dependencies = {}, scenario) {
  if (scenario === "workspace-studio-ownership-isolation") {
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
        const setText = async (selector, text) => {
          const element = await waitFor(selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
          if (setter) setter.call(element, text);
          else element.value = text;
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          await delay(80);
          return element;
        };
        const scopedText = (selector) => document.querySelector(selector)?.textContent || "";
        const requireAttr = (element, name) => {
          const value = element.getAttribute(name) || "";
          if (!value) throw new Error("Missing " + name + " on " + element.outerHTML.slice(0, 500));
          return value;
        };

        await click('[data-next-route="workspace"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
        await click('[data-r2-workspace-slot-button="2"]');
        await waitFor('[data-r2-workspace-panes][data-r2-workspace-pane-count="2"]');
        await click('[data-r2-workspace-configure-pane="blank-1"]');
        await waitFor('[data-r2-workspace-config-dialog]');
        await click('[data-r2-workspace-config-tool="smoke-render-source"]');
        await waitFor('[data-r2-workspace-pane="blank-1"][data-r2-workspace-pane-kind="agent"]');
        await click('[data-r2-terminal-start="blank-1"]');
        const workspaceRuntime = await waitFor('[data-r2-terminal-runtime="blank-1"][data-r2-terminal-runtime-status="running"]', 8000);
        await waitForText('[data-r2-terminal-runtime="blank-1"]', "MEOWDESK_RENDERED", 8000);

        await click('[data-r2-workspace-configure-pane="blank-2"]');
        await waitFor('[data-r2-workspace-config-dialog]');
        await click('[data-r2-workspace-config-tool="output-renderer"]');
        const bindButton = await waitFor('[data-r2-output-renderer-bind-button][data-r2-output-renderer-bind-target="blank-1"]', 8000);
        bindButton.click();
        const workspaceRenderer = await waitFor('[data-r2-output-renderer][data-r2-output-renderer-source="blank-1"]', 8000);
        await waitFor('[data-r2-terminal-runtime="blank-1"][data-r2-terminal-source-capture="active"]', 8000);

        const workspaceRuntimeSession = requireAttr(workspaceRuntime, "data-session-id");
        const workspaceRuntimeSurface = requireAttr(workspaceRuntime, "data-surface-id");
        const workspaceRuntimeAgent = requireAttr(workspaceRuntime, "data-agent-id");
        const workspaceRuntimeSource = requireAttr(workspaceRuntime, "data-source-id");
        const workspaceRendererSession = requireAttr(workspaceRenderer, "data-r2-output-renderer-session-id");
        const workspaceRendererSurface = requireAttr(workspaceRenderer, "data-r2-output-renderer-surface-id");
        const workspaceRendererSource = requireAttr(workspaceRenderer, "data-r2-output-renderer-source-id");
        if (workspaceRuntimeSession !== workspaceRendererSession || workspaceRuntimeSurface !== workspaceRendererSurface || workspaceRuntimeSource !== workspaceRendererSource) {
          throw new Error("Workspace Viewer ownership does not match bound runtime: " + JSON.stringify({
            runtime: { session: workspaceRuntimeSession, surface: workspaceRuntimeSurface, source: workspaceRuntimeSource },
            renderer: { session: workspaceRendererSession, surface: workspaceRendererSurface, source: workspaceRendererSource }
          }));
        }

        await click('[data-next-route="studio"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:studio"]');
        await waitFor('[data-route-keepalive="workspace"][data-route-keepalive-active="false"] [data-r2-terminal-runtime="blank-1"][data-r2-terminal-runtime-status="running"]', 4000);
        await waitFor('[data-studio-route]');
        await click('[data-studio-agent-add]');
        await waitFor('[data-studio-agent-picker-dialog]');
        await waitFor('[data-studio-agent-choice="smoke-render-source"]');
        await click('[data-studio-agent-choice="smoke-render-source"]');
        await click('[data-studio-agent-start]');
        const studioRuntime = await waitFor('[data-studio-agent-terminal-runtime][data-studio-agent-terminal-status="running"]', 8000);
        await waitForText('[data-studio-agent-terminal-runtime]', "MEOWDESK_RENDERED", 8000);

        const studioSession = requireAttr(studioRuntime, "data-session-id");
        const studioSurface = requireAttr(studioRuntime, "data-surface-id");
        const studioAgent = requireAttr(studioRuntime, "data-agent-id");
        if (studioSession === workspaceRuntimeSession || studioSurface === workspaceRuntimeSurface) {
          throw new Error("Workspace and Studio runtimes must not share ownership ids: " + JSON.stringify({
            workspace: { session: workspaceRuntimeSession, surface: workspaceRuntimeSurface },
            studio: { session: studioSession, surface: studioSurface }
          }));
        }
        if (studioAgent !== workspaceRuntimeAgent) {
          throw new Error("Ownership isolation smoke must exercise the same agent id on two surfaces: " + JSON.stringify({
            workspaceAgent: workspaceRuntimeAgent,
            studioAgent
          }));
        }

        const hiddenWorkspaceRenderer = await waitFor('[data-route-keepalive="workspace"][data-route-keepalive-active="false"] [data-r2-output-renderer][data-r2-output-renderer-source="blank-1"]', 4000);
        if (hiddenWorkspaceRenderer.getAttribute("data-r2-output-renderer-session-id") !== workspaceRuntimeSession) {
          throw new Error("Hidden Workspace Viewer rebound to a different session while Studio was active.");
        }
        await click('[data-studio-agent-meow-viewer-toggle][data-studio-agent-control-owner="header"]');
        const studioViewer = await waitFor('[data-studio-meow-viewer-overlay][data-studio-meow-viewer-status="running"]', 8000);
        const studioViewerTextBefore = studioViewer.textContent || "";
        if (!studioViewerTextBefore.includes("MEOWDESK_RENDERED")) {
          throw new Error("Studio Viewer did not bind to the running same-agent studio runtime: " + studioViewerTextBefore);
        }

        const workspaceOnly = "WORKSPACE_ONLY_REPLY_4101";
        const studioOnly = "STUDIO_ONLY_REPLY_9207";
        await setText('[data-route-keepalive="workspace"][data-route-keepalive-active="false"] [data-r2-output-renderer-input]', workspaceOnly);
        await click('[data-route-keepalive="workspace"][data-route-keepalive-active="false"] [data-r2-output-renderer-send]');
        await waitForText('[data-route-keepalive="workspace"][data-route-keepalive-active="false"] [data-r2-output-renderer-content]', workspaceOnly, 8000);

        await setText('[data-studio-meow-viewer-input]', studioOnly);
        await click('[data-studio-meow-viewer-send]');
        await waitForText('[data-studio-meow-viewer-body]', studioOnly, 8000);
        await delay(700);

        const workspaceText = scopedText('[data-route-keepalive="workspace"][data-route-keepalive-active="false"] [data-r2-output-renderer-content]');
        const studioText = scopedText('[data-studio-meow-viewer-body]');
        if (!workspaceText.includes(workspaceOnly) || workspaceText.includes(studioOnly)) {
          throw new Error("Workspace Viewer leaked or lost same-agent scoped output: " + JSON.stringify({
            hasWorkspaceOnly: workspaceText.includes(workspaceOnly),
            hasStudioOnly: workspaceText.includes(studioOnly),
            workspaceText: workspaceText.slice(-800)
          }));
        }
        if (!studioText.includes(studioOnly) || studioText.includes(workspaceOnly)) {
          throw new Error("Studio Viewer leaked or lost same-agent scoped output: " + JSON.stringify({
            hasStudioOnly: studioText.includes(studioOnly),
            hasWorkspaceOnly: studioText.includes(workspaceOnly),
            studioText: studioText.slice(-800)
          }));
        }

        return {
          scenario: "workspace-studio-ownership-isolation",
          workspaceSession: workspaceRuntimeSession,
          workspaceSurface: workspaceRuntimeSurface,
          studioSession,
          studioSurface,
          sharedAgent: studioAgent,
          sameAgentScopedViewer: true
        };
      })()
    `, true);
  }
}

const workspaceSmokeScenarios = Object.freeze({
  "workspace-top-controls": runWorkspaceTopControlsScenario,
  "r2-workspace-idle-visual": runR2WorkspaceIdleVisualScenario,
  "visual-recovery-second-batch": runVisualRecoverySecondBatchScenario,
  "workspace-route-keepalive": runWorkspaceRouteKeepaliveScenario,
  "workspace-output-renderer": runWorkspaceOutputRendererScenario,
  "workspace-output-renderer-claude-startup": runWorkspaceOutputRendererScenario,
  "workspace-output-renderer-claude-chat": runWorkspaceOutputRendererScenario,
  "workspace-studio-ownership-isolation": runOwnershipIsolationScenario,
});

module.exports = {
  workspaceSmokeScenarios
};

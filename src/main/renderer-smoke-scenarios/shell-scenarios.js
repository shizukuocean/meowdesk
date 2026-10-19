"use strict";

const fs = require("fs");
const path = require("path");

async function runWorkbenchBridgeScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "workbench-bridge") {
    return win.webContents.executeJavaScript(`
      (async () => {
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
        if (!window.workbench) {
          throw new Error("window.workbench is missing.");
        }
        for (const method of ["getStorageInfo", "getAgentInterfaceInfo"]) {
          if (typeof window.workbench[method] !== "function") {
            throw new Error("window.workbench." + method + " is missing.");
          }
        }
        const status = await waitFor('[data-workbench-bridge-status="ready"]');
        const summary = document.querySelector('[data-workbench-bridge-summary]');
        const summaryText = summary?.textContent || "";
        if (!summaryText.includes("作品")) {
          throw new Error("Workbench summary text is incomplete: " + summaryText);
        }
        return {
          scenario: "workbench-bridge",
          status: status.getAttribute("data-workbench-bridge-status"),
          summaryText
        };
      })()
    `, true);
  }
}

async function runCompactLayoutScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "compact-layout") {
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(120);
          return element;
        };

        await click('[data-next-route="studio"]');
        await delay(350);
        const shell = await waitFor('[data-route-shell]');
        const overflow = {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          documentScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          shellClientWidth: shell.clientWidth,
          shellScrollWidth: shell.scrollWidth
        };
        const documentOverflow = overflow.documentScrollWidth - overflow.innerWidth > 2;
        const shellOverflow = overflow.shellScrollWidth - overflow.shellClientWidth > 2;
        if (documentOverflow || shellOverflow) {
          throw new Error("Compact layout has horizontal overflow: " + JSON.stringify(overflow));
        }
        return {
          scenario: "compact-layout",
          route: document.querySelector('[data-next-route][aria-current="page"]')?.getAttribute("data-next-route"),
          overflow
        };
      })()
    `, true);
  }
}

async function runNextRouteHashScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "next-route-hash") {
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
        const activeRoute = () => document.querySelector('[data-next-route][aria-current="page"]')?.getAttribute("data-next-route");

        window.location.hash = "#studio";
        await delay(200);
        const studioRoute = await waitFor('[data-next-route="studio"][aria-current="page"]');
        if (!studioRoute || activeRoute() !== "studio") {
          throw new Error("Studio hash route did not become active.");
        }

        window.location.hash = "#lobby";
        await delay(200);
        const lobbyRoute = await waitFor('[data-next-route="lobby"][aria-current="page"]');
        if (!lobbyRoute || activeRoute() !== "lobby") {
          throw new Error("Lobby hash route did not become active.");
        }

        return {
          scenario: "next-route-hash",
          route: activeRoute(),
          hash: window.location.hash
        };
      })()
    `, true);
  }
}

async function runPhaseSixRouteReachabilityScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "phase-six-route-reachability") {
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
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(160);
          return element;
        };
        const dragRouteTo = async (sourceSelector, targetSelector, routeId) => {
          const source = await waitFor(sourceSelector);
          const dataTransfer = new DataTransfer();
          dataTransfer.effectAllowed = "move";
          source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
          if (!dataTransfer.getData("application/x-meowdesk-product-shell-route")) {
            dataTransfer.setData("application/x-meowdesk-product-shell-route", routeId);
            dataTransfer.setData("text/plain", routeId);
          }
          const target = await waitFor(targetSelector);
          target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer }));
          target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
          target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
          source.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer }));
          await delay(220);
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
        const assertSurfaceHeaderHeight = async (selector, label) => {
          const expectedHeaderHeight = 44;
          const header = await waitFor(selector);
          const deadline = Date.now() + 1600;
          let rect = header.getBoundingClientRect();
          let style = getComputedStyle(header);
          while (
            Date.now() < deadline &&
            (rect.width <= 1 || rect.height <= 1 || Math.abs(rect.height - expectedHeaderHeight) > 1.5)
          ) {
            await delay(80);
            rect = header.getBoundingClientRect();
            style = getComputedStyle(header);
          }
          const minHeight = Number.parseFloat(style.minHeight || "0");
          const maxHeight = Number.parseFloat(style.maxHeight || "0");
          const height = Number.parseFloat(style.height || "0");
          if (
            rect.width <= 1 ||
            Math.abs(rect.height - expectedHeaderHeight) > 1.5 ||
            Math.abs(height - expectedHeaderHeight) > 1.5 ||
            Math.abs(minHeight - expectedHeaderHeight) > 1.5 ||
            (Number.isFinite(maxHeight) && maxHeight > 0 && Math.abs(maxHeight - expectedHeaderHeight) > 1.5)
          ) {
            throw new Error("Surface header should use the shared compact 44px panel-header family: " + JSON.stringify({
              label,
              selector,
              rect: rectDebug(header),
              style: {
                display: style.display,
                height: style.height,
                minHeight: style.minHeight,
                maxHeight: style.maxHeight,
                alignItems: style.alignItems,
                overflow: style.overflow
              },
              className: String(header.className || ""),
              dataset: { ...header.dataset }
            }));
          }
          return { label, rect: rectDebug(header), height: style.height };
        };
        const assertTopSurfaceRailSlot = async () => {
          const nav = await waitFor('[data-top-nav]');
          const titleCluster = await waitFor('[data-top-nav-title-cluster]');
          const titleNode = await waitFor('[data-top-nav-title]');
          const runningSlot = await waitFor('[data-top-nav-running-surfaces]');
          const actions = await waitFor('[data-top-nav-actions]');
          const rail = await waitFor('[data-top-nav-running-surfaces] [data-meow-top-surface-rail]');
          await delay(180);
          if (!rail.hasAttribute("data-product-shell-top-surface-rail")) {
            throw new Error("Top surface rail must be rendered by ProductShell/TopNav, not recreated by the VS overlay.");
          }
          if (
            rail.hasAttribute("data-vs-top-surface-rail") ||
            rail.querySelector("[data-vs-top-surface-tag], [data-vs-top-surface-main], [data-vs-top-surface-close], .vs-top-surface-tag, .vs-top-surface-main, .vs-top-surface-close")
          ) {
            throw new Error("Top surface live DOM should use Meowdesk/ProductShell owner markers, not VS top-surface markers: " + rail.outerHTML.slice(0, 1200));
          }
          const tags = [...rail.querySelectorAll('[data-meow-top-surface-tag]')];
          if (!tags.length) {
            throw new Error("Top surface rail should expose running tags next to the route title.");
          }
          const brokenNativeTags = tags
            .map((tag) => ({
              route: tag.getAttribute("data-meow-top-surface-route") || "",
              label: tag.getAttribute("data-meow-top-surface-label") || "",
              labelText: tag.querySelector(".meowdesk-top-surface-label")?.textContent?.trim() || "",
              mainAriaLabel: tag.querySelector("[data-meow-top-surface-main]")?.getAttribute("aria-label") || "",
              hasLabelNode: Boolean(tag.querySelector(".meowdesk-top-surface-label")),
              hasMain: Boolean(tag.querySelector("[data-meow-top-surface-main]"))
            }))
            .filter((tag) => !tag.label || !tag.hasLabelNode || !tag.hasMain || tag.labelText !== tag.label || tag.mainAriaLabel !== tag.label);
          if (brokenNativeTags.length) {
            throw new Error("Top surface tags must keep native React label contracts, not icon-only overlay shells: " + JSON.stringify(brokenNativeTags));
          }
          const nonInteractiveTags = tags.map((tag) => {
            const main = tag.querySelector("[data-meow-top-surface-main]");
            const close = tag.querySelector("[data-product-shell-top-surface-close]");
            return {
              route: tag.getAttribute("data-meow-top-surface-route") || "",
              tagPointerEvents: getComputedStyle(tag).pointerEvents,
              mainPointerEvents: main ? getComputedStyle(main).pointerEvents : "",
              tagRect: rectDebug(tag),
              mainRect: main ? rectDebug(main) : null,
              closeRect: close ? rectDebug(close) : null
            };
          }).filter((item) => (
            item.tagPointerEvents === "none" ||
            item.mainPointerEvents === "none" ||
            item.tagRect.width < 30 ||
            item.tagRect.height < 30 ||
            !item.mainRect ||
            item.mainRect.width < 30 ||
            item.mainRect.height < 30
          ));
          if (nonInteractiveTags.length) {
            throw new Error("Top surface tags must remain clickable React controls inside the title-adjacent running slot: " + JSON.stringify(nonInteractiveTags));
          }
          if (!runningSlot.contains(rail) || actions.contains(rail)) {
            throw new Error("Top surface rail should be owned by the running slot, not the right action group: " + JSON.stringify({
              runningContainsRail: runningSlot.contains(rail),
              actionsContainsRail: actions.contains(rail)
            }));
          }
          const firstTagRect = tags[0].getBoundingClientRect();
          const titleRect = titleNode.getBoundingClientRect();
          const actionsRect = actions.getBoundingClientRect();
          const runningRect = runningSlot.getBoundingClientRect();
          const navRect = nav.getBoundingClientRect();
          const titleGap = runningRect.left - titleRect.right;
          if (titleGap < 4 || titleGap > 28 || firstTagRect.right > actionsRect.left - 8) {
            throw new Error("Running top surface rail should sit directly after the current route title without overlapping top-right actions: " + JSON.stringify({
              nav: rectDebug(nav),
              titleCluster: rectDebug(titleCluster),
              title: rectDebug(titleNode),
              runningSlot: rectDebug(runningSlot),
              actions: rectDebug(actions),
              firstTag: rectDebug(tags[0]),
              titleGap: Math.round(titleGap),
              tagRoutes: tags.map((tag) => tag.getAttribute("data-meow-top-surface-route"))
            }));
          }
        };
        const assertTopSurfaceCloseContract = async () => {
          const rail = await waitFor('[data-top-nav-running-surfaces] [data-product-shell-top-surface-rail]');
          const workspaceTag = await waitFor('[data-product-shell-top-surface-tag="workspace"]');
          const studioTag = await waitFor('[data-product-shell-top-surface-tag="studio"]');
          const surfaceTags = [workspaceTag, studioTag];
          const closableViolations = surfaceTags.map((tag) => ({
            route: tag.getAttribute("data-product-shell-top-surface-tag") || "",
            closable: tag.getAttribute("data-product-shell-top-surface-closable") || "",
            closeMode: tag.getAttribute("data-product-shell-top-surface-close-mode") || "",
            hasReactClose: Boolean(tag.querySelector("[data-product-shell-top-surface-close]")),
            hasVsClose: Boolean(tag.querySelector("[data-vs-top-surface-close], .vs-top-surface-close")),
            hasVsTag: tag.matches("[data-vs-top-surface-tag], .vs-top-surface-tag"),
            hasMeowTag: tag.matches("[data-meow-top-surface-tag], .meowdesk-top-surface-tag"),
            text: tag.textContent.trim()
          })).filter((item) => item.closable !== "true" || item.closeMode !== "detach-only" || !item.hasReactClose || item.hasVsClose || item.hasVsTag || !item.hasMeowTag);
          if (closableViolations.length) {
            throw new Error("Workspace/Studio top surface tags must expose the governed close affordance under ProductShell owner: " + JSON.stringify(closableViolations));
          }
          workspaceTag.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
          await delay(120);
          if (!rail.querySelector('[data-product-shell-top-surface-tag="workspace"]')) {
            throw new Error("Hovering a closable workspace tag must not remove the React-owned top tag.");
          }
          if (document.querySelector('[data-vs-surface-close-dialog]')) {
            throw new Error("Top surface hover must not open the legacy VS close dialog.");
          }
        };
        const assertNoLiveTransitionResidue = async (routeId) => {
          await delay(80);
          const residue = document.querySelector([
            ".vs-auxiliary-panel-ghost",
            ".vs-internal-switch-reveal",
            ".vs-picker-dialog-mouse",
            ".vs-card-actions-collapsed",
            ".vs-card-action-trigger",
            ".vs-card-action-bar"
          ].join(","));
          if (residue) {
            throw new Error("Live renderer should not create VS-only ghost/reveal/picker/card-action structural residue: " + JSON.stringify({
              route: routeId,
              className: residue.className,
              tagName: residue.tagName,
              dataset: { ...residue.dataset }
            }));
          }
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
        const activeRouteId = (id) => {
          const activeNav = document.querySelector('[data-next-route][aria-current="page"]')?.getAttribute("data-next-route");
          return activeNav || window.location.hash.replace(/^#\\/?/, "") || id;
        };
        const routeChecks = [
          { id: "lobby", surface: "[data-lobby-route]" },
          { id: "workspace", surface: "[data-r2-workspace-route]" },
          { id: "studio", surface: "[data-studio-route]" },
          { id: "plugins", surface: "[data-phase-six-route='plugins']", handoff: "[data-legacy-handoff='sidebar-iframe']" },
          { id: "tasks", surface: "[data-phase-six-route='tasks']", handoff: "[data-legacy-handoff='task-center']" },
          { id: "conversations", surface: "[data-r2-conversations-route]" },
          { id: "obsidian", surface: "[data-r2-obsidian-route]" },
          { id: "profile", surface: "[data-phase-six-route='profile']", handoff: "[data-legacy-handoff='profile']" },
          { id: "access", surface: "[data-r2-access-route]" }
        ];
        const assertVsLegacyCssOnly = () => {
          const root = document.documentElement;
          const snapshot = {
            vsVisual: root.dataset.vsVisual || "",
            vsLiveAppMode: root.dataset.vsLiveAppMode || "",
            hasLiveClass: root.classList.contains("vs-live-app-mode"),
            hasCssCompatClass: root.classList.contains("vs-legacy-css-compat"),
            badgeCount: document.querySelectorAll(".vs-visual-badge").length,
            visualStageCount: document.querySelectorAll("[data-vs-visual-stage]").length,
            generatedCloseDialogCount: document.querySelectorAll("[data-vs-surface-close-dialog]").length
          };
          if (
            snapshot.vsVisual !== "css-compat-only" ||
            snapshot.vsLiveAppMode ||
            snapshot.hasLiveClass ||
            !snapshot.hasCssCompatClass ||
            snapshot.badgeCount ||
            snapshot.visualStageCount ||
            snapshot.generatedCloseDialogCount
          ) {
            throw new Error("Default renderer must keep VS as CSS compatibility only, without loading the legacy DOM/state mutator: " + JSON.stringify(snapshot));
          }
          return snapshot;
        };
        const assertAccessSectionsReachable = async () => {
          const sections = ["appearance", "workspace", "pets", "obsidian", "advanced"];
          const visitedSections = [];
          for (const section of sections) {
            await click('[data-r2-access-menu-item="' + section + '"]');
            const panel = await waitFor('[data-r2-access-section="' + section + '"]');
            const activeMenu = await waitFor('[data-r2-access-menu-item="' + section + '"][data-r2-access-menu-active="true"]');
            const panelRect = panel.getBoundingClientRect();
            const panelStyle = getComputedStyle(panel);
            if (
              panelStyle.display === "none" ||
              panelStyle.visibility === "hidden" ||
              panelRect.width < 80 ||
              panelRect.height < 80 ||
              !activeMenu
            ) {
              throw new Error("Access settings section did not open visibly: " + JSON.stringify({
                section,
                rect: rectDebug(panel),
                style: { display: panelStyle.display, visibility: panelStyle.visibility }
              }));
            }
            visitedSections.push(section);
          }
          return visitedSections;
        };
        const assertLegacySettingsDeepLinks = async () => {
          const legacyLinks = [
            ["#settings", "workspace"],
            ["#settings/tools", "workspace"],
            ["#settings/appearance", "appearance"],
            ["#settings/pets", "pets"],
            ["#settings/obsidian", "obsidian"],
            ["#settings/advanced", "advanced"],
            ["#access/tools", "workspace"]
          ];
          const visitedLegacyLinks = [];
          for (const [hash, section] of legacyLinks) {
            window.location.hash = hash;
            window.dispatchEvent(new HashChangeEvent("hashchange"));
            await waitFor("[data-r2-access-route]");
            await waitFor('[data-r2-access-section="' + section + '"]');
            await waitFor('[data-r2-access-menu-item="' + section + '"][data-r2-access-menu-active="true"]');
            const active = activeRouteId("access");
            if (active !== "access") {
              throw new Error("Legacy settings deep link should resolve to access route: " + JSON.stringify({ hash, section, active }));
            }
            visitedLegacyLinks.push(hash + "=>" + section);
          }
          return visitedLegacyLinks;
        };
        const sidebarToggle = document.querySelector("[data-next-sidebar-toggle]");
        if (sidebarToggle) {
          throw new Error("Main sidebar collapse toggle should not render as a stray title-adjacent button.");
        }
        const titleCluster = await waitFor("[data-top-nav-title-cluster]");
        const titleClusterChevronToggles = [...titleCluster.querySelectorAll("button, a, [role='button']")]
          .map((control) => ({
            label: (control.getAttribute("aria-label") || control.textContent || "").replace(/\\s+/g, " ").trim(),
            className: String(control.className || ""),
            dataset: { ...control.dataset }
          }))
          .filter((control) => ["«", "»", "‹", "›"].includes(control.label));
        if (titleClusterChevronToggles.length) {
          throw new Error("Top title cluster must not contain a stray sidebar chevron button; side-panel toggles belong in top actions: " + JSON.stringify(titleClusterChevronToggles));
        }
        if (document.querySelector("[data-top-nav] [data-vs-top-side-panel-proxy], [data-top-nav] [data-vs-top-side-panel-proxy-host]")) {
          throw new Error("Top side-panel collapse must use native React top actions, not a VS proxy button.");
        }
        const reservedUpdate = document.querySelector("[data-next-sidebar-update-reserved]");
        if (reservedUpdate) {
          throw new Error("Reserved update button should not be rendered in the top header or sidebar.");
        }
        const productShell = await waitFor('[data-product-shell][data-product-shell-owner="product-shell"][data-product-shell-source-owner="open-surface-registry"]');
        if (!productShell.closest("aside")) {
          throw new Error("Product Shell controls should live in the left sidebar.");
        }
        if (document.querySelector("[data-top-nav-surface-controls]")) {
          throw new Error("Top nav should not reserve Product Shell surface controls.");
        }
        await waitFor('[data-meow-tabs][data-meow-tabs-owner="product-shell"]');
        const meowBoxTrigger = await waitFor('[data-meow-box-trigger]');
        if (!meowBoxTrigger.closest("aside")) {
          throw new Error("Meow Box trigger should live in the left sidebar.");
        }
        for (const id of ["lobby", "workspace", "studio"]) {
          await waitFor('aside nav [data-next-route="' + id + '"]');
        }
        for (const id of ["tasks", "conversations", "obsidian"]) {
          if (document.querySelector('aside nav [data-next-route="' + id + '"]')) {
            throw new Error("Non-core route should default to Meow Box instead of sidebar nav: " + id);
          }
        }
        if (!productShell.getAttribute("data-product-shell-open-count")) {
          throw new Error("Product Shell should project the open surface count.");
        }
        const idlePinZone = document.querySelector('[data-product-shell-sidebar-pin-zone]');
        if (idlePinZone) {
          const pinZoneStyle = getComputedStyle(idlePinZone);
          const pinZoneRect = idlePinZone.getBoundingClientRect();
          if (pinZoneRect.width > 1 && pinZoneRect.height > 1 && Number(pinZoneStyle.opacity || 0) > 0.01) {
            throw new Error("Sidebar pin drop zone must not render as a resting sidebar button: " + JSON.stringify({
              opacity: pinZoneStyle.opacity,
              borderTopColor: pinZoneStyle.borderTopColor,
              backgroundColor: pinZoneStyle.backgroundColor,
              boxShadow: pinZoneStyle.boxShadow,
              rect: rectDebug(idlePinZone)
            }));
          }
        }
        // Core routes are navigated via the main sidebar nav, not the Meow Box.
        // The box holds only box-only functions; core/pinned must not duplicate in.
        await click('aside nav [data-next-route="workspace"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
        await waitFor('[data-meow-tab-route="workspace"][data-meow-tab-active="true"]');
        await assertNoLiveTransitionResidue("workspace");
        await click('aside nav [data-next-route="studio"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:studio"]');
        await waitFor('[data-meow-tab-route="studio"][data-meow-tab-active="true"]');
        await assertNoLiveTransitionResidue("studio");
        const vsLegacyMode = assertVsLegacyCssOnly();
        await assertTopSurfaceRailSlot();
        await assertTopSurfaceCloseContract();
        meowBoxTrigger.click();
        await delay(120);
        await waitFor('[data-meow-box-menu][data-meow-box-owner="product-shell"]');
        if (document.querySelector('[data-meow-box-launch="workspace"]') || document.querySelector('[data-meow-box-launch="studio"]')) {
          throw new Error("Core routes must not appear as Meow Box launch items.");
        }
        await waitFor('[data-meow-box-launch="tasks"]');
        await click('[data-meow-box-create]');
        await waitFor('[data-meow-box-switch="box-2"]');
        await dragRouteTo('[data-meow-box-launch="obsidian"]', '[data-meow-box-switch="box-2"]', "obsidian");
        await waitFor('[data-meow-box-active-id="box-2"] [data-meow-box-launch="obsidian"][data-meow-box-launch-box="box-2"]');
        if (document.querySelector('[data-meow-box-active-id="box-2"] [data-meow-box-launch="tasks"]')) {
          throw new Error("Moving a route into a user Box should not move unrelated default Box items.");
        }
        const boxSwitchDebug = [...document.querySelectorAll('[data-meow-box-switch]')].map((item) => ({
          id: item.getAttribute("data-meow-box-switch"),
          text: item.textContent.trim(),
          active: item.getAttribute("data-meow-box-switch-active") || ""
        }));
        if (!boxSwitchDebug.some((item) => item.id === "default")) {
          throw new Error("Meow Box switcher lost the default Box after moving an item: " + JSON.stringify({
            switches: boxSwitchDebug,
            menuText: document.querySelector('[data-meow-box-menu]')?.textContent?.trim?.() || "",
            menuHtml: document.querySelector('[data-meow-box-menu]')?.outerHTML?.slice?.(0, 1200) || ""
          }));
        }
        await click('[data-meow-box-switch="default"]');
        if (document.querySelector('[data-meow-box-active-id="default"] [data-meow-box-launch="obsidian"]')) {
          throw new Error("Route moved into a user Box must leave the default Meow Box.");
        }
        await dragRouteTo('[data-meow-box-launch="tasks"]', '[data-product-shell-sidebar-pin-zone]', "tasks");
        await waitFor('[data-product-shell-sidebar-pinned-item="tasks"]');
        if (document.querySelector('[data-meow-box-active-id="default"] [data-meow-box-launch="tasks"]')) {
          throw new Error("Route pinned to sidebar must leave the default Meow Box.");
        }
        await dragRouteTo('[data-product-shell-sidebar-pinned-item="tasks"]', '[data-meow-box-trigger]', "tasks");
        await waitFor('[data-meow-box-active-id="default"] [data-meow-box-launch="tasks"][data-meow-box-launch-box="default"]');
        if (document.querySelector('[data-product-shell-sidebar-pinned-item="tasks"]')) {
          throw new Error("Dragging a pinned route back to Meow Box should remove it from the sidebar.");
        }
        await click('[data-meow-box-launch="tasks"]');
        await waitFor("[data-phase-six-route='tasks']");
        if (document.querySelector('[data-meow-tab-route="tasks"]')) {
          throw new Error("Ephemeral task route should not create a Meow Tab.");
        }
        if (document.querySelector("[data-next-sidebar-toggle]")) {
          throw new Error("Main sidebar should stay icon-only without rendering the removed stray collapse toggle.");
        }
        if (document.querySelector("[data-top-nav] [data-vs-top-side-panel-proxy], [data-top-nav] [data-vs-top-side-panel-proxy-host]")) {
          throw new Error("VS side-panel proxy button should not return during route navigation.");
        }
        for (const selector of ['aside nav [data-next-route="lobby"]', '[data-meow-box-trigger]', '[data-r15-theme-sidebar-toggle]', '[data-next-sidebar-settings]']) {
          const entry = await waitFor(selector);
          const rect = entry.getBoundingClientRect();
          if (rect.width < 30 || rect.height < 30) {
            throw new Error("Icon-only main sidebar entry should remain visible: " + selector);
          }
        }
        const visited = [];
        const surfaceHeaders = [];
        let accessSections = [];
        let legacySettingsLinks = [];
        const verifiedHandoffs = [];
        for (const route of routeChecks) {
          await navigateRoute(route.id);
          await waitFor(route.surface);
          await assertNoLiveTransitionResidue(route.id);
          if (route.handoff) {
            const handoff = await waitFor(route.handoff);
            verifiedHandoffs.push(handoff.getAttribute("data-legacy-handoff"));
          }
          const active = activeRouteId(route.id);
          if (active !== route.id) {
            throw new Error("Route did not become active: " + JSON.stringify({ expected: route.id, active }));
          }
          if (route.id === "access") {
            accessSections = await assertAccessSectionsReachable();
            legacySettingsLinks = await assertLegacySettingsDeepLinks();
            surfaceHeaders.push(await assertSurfaceHeaderHeight('[data-r2-access-route] .meowdesk-panel-header', "access-panel"));
          }
          if (route.id === "workspace") {
            surfaceHeaders.push(await assertSurfaceHeaderHeight('[data-r2-workspace-sidebar] .meowdesk-panel-header', "workspace-side-panel"));
          }
          const shell = await waitFor("[data-route-shell]");
          const overflow = {
            route: route.id,
            innerWidth: window.innerWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            shellClientWidth: shell.clientWidth,
            shellScrollWidth: shell.scrollWidth
          };
          if (overflow.documentScrollWidth - overflow.innerWidth > 2 || overflow.shellScrollWidth - overflow.shellClientWidth > 2) {
            throw new Error("Phase six route has horizontal overflow: " + JSON.stringify(overflow));
          }
          visited.push(route.id);
        }
        return {
          scenario: "phase-six-route-reachability",
          defaultRendererRoute: document.querySelector('[data-next-route][aria-current="page"]')?.getAttribute("data-next-route"),
          visited,
          accessSections,
          legacySettingsLinks,
          surfaceHeaders,
          handoffs: verifiedHandoffs,
          vsLegacyMode
        };
      })()
    `, true);
  }
}

async function runTopSurfaceCloseVisualScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "top-surface-close-visual") {
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
        const clickElement = async (element) => {
          element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: "mouse" }));
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
          await delay(160);
        };
        const click = async (selector) => {
          const element = await waitFor(selector);
          await clickElement(element);
          return element;
        };
        const forceHover = async (element) => {
          element.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
          element.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false, cancelable: true, pointerId: 1, pointerType: "mouse" }));
          element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
          element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
          await delay(180);
        };
        const forceLeave = async (element, relatedTarget = document.body) => {
          element.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", relatedTarget }));
          element.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false, cancelable: true, pointerId: 1, pointerType: "mouse", relatedTarget }));
          element.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, cancelable: true, relatedTarget }));
          element.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false, cancelable: true, relatedTarget }));
          await delay(180);
        };
        const styleSnapshot = (element) => {
          const style = getComputedStyle(element);
          return {
            display: style.display,
            opacity: Number.parseFloat(style.opacity || "0"),
            visibility: style.visibility,
            pointerEvents: style.pointerEvents,
            transform: style.transform,
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            borderColor: style.borderColor,
            boxShadow: style.boxShadow
          };
        };
        const hasDangerRed = (value) => /(?:255,\\s*68,\\s*68|234,\\s*83,\\s*83|234,\\s*60,\\s*64|255,\\s*68,\\s*72)/.test(String(value || ""));
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
        const matchingRuleDebug = (element, pattern, limit = 12) => {
          const matches = [];
          for (const sheet of [...document.styleSheets]) {
            let rules = [];
            try {
              rules = [...(sheet.cssRules || [])];
            } catch {
              continue;
            }
            for (const rule of rules) {
              if (!rule.selectorText || !pattern.test(rule.selectorText)) continue;
              try {
                if (element.matches(rule.selectorText)) {
                  matches.push({
                    selector: rule.selectorText,
                    opacity: rule.style?.getPropertyValue("opacity") || "",
                    opacityPriority: rule.style?.getPropertyPriority("opacity") || "",
                    transform: rule.style?.getPropertyValue("transform") || "",
                    transformPriority: rule.style?.getPropertyPriority("transform") || "",
                    pointerEvents: rule.style?.getPropertyValue("pointer-events") || "",
                    cssText: rule.cssText.slice(0, 340)
                  });
                }
              } catch {}
            }
          }
          return matches.slice(-limit);
        };

        await click('aside nav [data-next-route="workspace"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
        await click('aside nav [data-next-route="studio"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:studio"]');
        await click('aside nav [data-next-route="workspace"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
        const rail = await waitFor('[data-top-nav-running-surfaces] [data-product-shell-top-surface-rail]');
        const inspectSurfaceTag = async (routeId) => {
          const tag = await waitFor('[data-product-shell-top-surface-tag="' + routeId + '"]');
          const main = tag.querySelector('[data-meow-top-surface-main]');
          if (!main) {
            throw new Error("Top surface tag is missing its route switch control: " + routeId);
          }
          await forceHover(tag);
          tag.setAttribute("data-meow-top-surface-hover", "true");
          main.focus();
          await delay(180);
          const close = tag.querySelector('[data-product-shell-top-surface-close], [data-vs-top-surface-close], .vs-top-surface-close');
          close?.focus();
          if (close) {
            void close.offsetWidth;
          }
          await delay(520);
          const closeStyle = close ? styleSnapshot(close) : null;
          const closeRect = close ? rectDebug(close) : null;
          const closeRules = close ? matchingRuleDebug(close, /top-surface-close/) : [];
          const closeVisibleRuleMatched = closeRules.some((rule) => (
            rule.opacity === "1" &&
            rule.opacityPriority === "important" &&
            rule.transform === "scale(1)" &&
            rule.transformPriority === "important"
          ));
          return {
            routeId,
            rect: rectDebug(tag),
            main: rectDebug(main),
            closable: tag.getAttribute("data-product-shell-top-surface-closable") || "",
            closeMode: tag.getAttribute("data-product-shell-top-surface-close-mode") || "",
            closePresent: Boolean(close),
            closeUsable: Boolean(close && closeStyle.display !== "none" && closeStyle.visibility !== "hidden" && (closeStyle.opacity >= 0.8 || closeVisibleRuleMatched) && closeRect.width >= 10 && closeRect.height >= 10 && closeStyle.pointerEvents !== "none"),
            hoverAttr: tag.getAttribute("data-meow-top-surface-hover") || "",
            dangerAttr: tag.getAttribute("data-meow-top-surface-danger") || "",
            closeMatchesVisibleContract: close ? close.matches('[data-meow-top-surface-close].meowdesk-top-surface-close:not(.vs-top-surface-close)') : false,
            hasMeowOwner: tag.matches("[data-meow-top-surface-tag].meowdesk-top-surface-tag") && Boolean(tag.querySelector("[data-meow-top-surface-main].meowdesk-top-surface-main")),
            hasVsOwner: tag.matches("[data-vs-top-surface-tag], .vs-top-surface-tag") || Boolean(tag.querySelector("[data-vs-top-surface-main], .vs-top-surface-main")),
            closeRect,
            closeStyle,
            text: tag.textContent.trim()
          };
        };
        const inspected = [
          await inspectSurfaceTag("workspace"),
          await inspectSurfaceTag("studio")
        ];
        const violations = inspected.filter((item) => item.closable !== "true" || item.closeMode !== "detach-only" || !item.closePresent || !item.closeUsable || !item.hasMeowOwner || item.hasVsOwner);
        if (violations.length) {
          throw new Error("Top surface close contract regressed; Workspace/Studio must expose the governed close control: " + JSON.stringify(violations));
        }
        if (document.querySelector('[data-vs-surface-close-dialog]')) {
          throw new Error("Top surface tags must not open the legacy VS close confirmation during hover/focus.");
        }
        if (!rail.querySelector('[data-product-shell-top-surface-tag="workspace"]') || !rail.querySelector('[data-product-shell-top-surface-tag="studio"]')) {
          throw new Error("Top surface tags must remain mounted after hover/focus.");
        }
        const idleStudioClose = await waitFor('[data-product-shell-top-surface-tag="studio"] [data-product-shell-top-surface-close]');
        await clickElement(idleStudioClose);
        const idleCloseDialog = await waitFor('[data-meow-surface-close-dialog][data-product-shell-surface-close-dialog]');
        const idleClosePanel = await waitFor('[data-meow-surface-close-panel][data-meow-warning-variant="top-surface-close"]');
        if (
          idleCloseDialog.getAttribute("data-meow-warning-owner") !== "meowdesk-warning-dialog" ||
          idleCloseDialog.getAttribute("data-meow-warning-family") !== "flip-confirm-card" ||
          idleClosePanel.getAttribute("data-meow-warning-owner") !== "meowdesk-warning-dialog" ||
          idleClosePanel.getAttribute("data-meow-warning-family") !== "flip-confirm-card"
        ) {
          throw new Error("Idle top surface close should open the shared warning dialog owner/family: " + JSON.stringify({
            dialogOwner: idleCloseDialog.getAttribute("data-meow-warning-owner") || "",
            dialogFamily: idleCloseDialog.getAttribute("data-meow-warning-family") || "",
            panelOwner: idleClosePanel.getAttribute("data-meow-warning-owner") || "",
            panelFamily: idleClosePanel.getAttribute("data-meow-warning-family") || ""
          }));
        }
        await clickElement(await waitFor('.meowdesk-surface-close-cancel'));
        await delay(180);
        if (document.querySelector('[data-meow-surface-close-dialog]') || !rail.querySelector('[data-product-shell-top-surface-tag="studio"]')) {
          throw new Error("Cancelling idle top surface close should dismiss the warning dialog without removing the tag.");
        }

        document.documentElement.classList.add("meowdesk-renderer-smoke");
        window.dispatchEvent(new CustomEvent("meowdesk:renderer-smoke-agent-runtimes", {
          detail: {
            owner: "renderer-smoke",
            runtimes: [{
              id: "runtime:workspace-close-smoke",
              runtimeId: "runtime:workspace-close-smoke",
              runtimeKey: "workspace-close-smoke",
              sessionId: "workspace-close-smoke",
              sessionKey: "workspace-close-smoke",
              surfaceId: "surface:workspace-pane:agent-left",
              conversationId: "conversation:workspace-close-smoke",
              agentId: "agent:smoke",
              sourceId: "source:workspace-close-smoke",
              projectId: "project:smoke",
              toolId: "smoke-agent",
              owner: "agent-runtime-manager",
              status: "running",
              attachStatus: "reattachable",
              startedAt: Date.now()
            }]
          }
        }));
        let runtimeWorkspaceTag = await waitFor('[data-product-shell-top-surface-tag="workspace"][data-product-shell-top-surface-closable="true"]');
        const runtimeClose = await waitFor('[data-product-shell-top-surface-tag="workspace"] [data-product-shell-top-surface-close]');
        await forceHover(runtimeClose);
        runtimeClose.focus();
        await new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            const tag = document.querySelector('[data-product-shell-top-surface-tag="workspace"]');
            const hint = document.querySelector('[data-meow-top-surface-floating-hint="close"][data-meow-top-surface-hint-route="workspace"]');
            if (tag?.getAttribute("data-meow-top-surface-danger") === "true" && hint?.getAttribute("data-meow-top-surface-hint-visible") === "true") {
              resolve();
              return;
            }
            if (Date.now() - startedAt > 1200) {
              reject(new Error("Timed out waiting for runtime close hint state: " + JSON.stringify({
                tagDanger: tag?.getAttribute("data-meow-top-surface-danger") || "",
                hintVisible: hint?.getAttribute("data-meow-top-surface-hint-visible") || "",
                tagHtml: tag?.outerHTML?.slice(0, 1000) || "",
                hintHtml: hint?.outerHTML?.slice(0, 700) || ""
              })));
              return;
            }
            setTimeout(tick, 40);
          };
          tick();
        });
        runtimeWorkspaceTag = document.querySelector('[data-product-shell-top-surface-tag="workspace"][data-product-shell-top-surface-closable="true"]') || runtimeWorkspaceTag;
        const closeHint = document.querySelector('[data-meow-top-surface-floating-hint="close"][data-meow-top-surface-hint-route="workspace"]');
        const dangerState = runtimeWorkspaceTag.getAttribute("data-meow-top-surface-danger") || "";
        let runtimeCloseStyle = styleSnapshot(runtimeClose);
        let runtimeCloseRect = rectDebug(runtimeClose);
        let runtimeCloseRules = matchingRuleDebug(runtimeClose, /top-surface-close/);
        let runtimeCloseVisibleRuleMatched = runtimeCloseRules.some((rule) => (
          rule.opacity === "1" &&
          rule.opacityPriority === "important" &&
          rule.transform === "scale(1)" &&
          rule.transformPriority === "important"
        ));
        const runtimeMain = runtimeWorkspaceTag.querySelector('[data-meow-top-surface-main]');
        let runtimeMainStyle = runtimeMain ? styleSnapshot(runtimeMain) : null;
        let runtimeMainDangerVisual = runtimeMainStyle ? {
          fill: hasDangerRed([runtimeMainStyle.backgroundColor, runtimeMainStyle.backgroundImage].join(" ")),
          frame: hasDangerRed(runtimeMainStyle.borderColor),
          glow: hasDangerRed(runtimeMainStyle.boxShadow)
        } : null;
        if (closeHint) {
          await new Promise((resolve, reject) => {
            const startedAt = Date.now();
            const tick = () => {
              const visibleStyle = styleSnapshot(closeHint);
              if (visibleStyle.opacity >= 0.8 && visibleStyle.visibility === "visible") {
                resolve();
                return;
              }
              if (Date.now() - startedAt > 1200) {
                reject(new Error("Timed out waiting for runtime close hint computed visibility: " + JSON.stringify({
                  style: visibleStyle,
                  attrStyle: closeHint.getAttribute("style") || "",
                  visible: closeHint.getAttribute("data-meow-top-surface-hint-visible") || "",
                  matchingRules: (() => {
                    const matches = [];
                    for (const sheet of [...document.styleSheets]) {
                      let rules = [];
                      try {
                        rules = [...(sheet.cssRules || [])];
                      } catch {
                        continue;
                      }
                      for (const rule of rules) {
                        if (!rule.selectorText || !/top-surface-hint|top-nav/.test(rule.selectorText)) continue;
                        try {
                          if (closeHint.matches(rule.selectorText)) {
                            matches.push({
                              selector: rule.selectorText,
                              opacity: rule.style?.getPropertyValue("opacity") || "",
                              opacityPriority: rule.style?.getPropertyPriority("opacity") || "",
                              visibility: rule.style?.getPropertyValue("visibility") || "",
                              visibilityPriority: rule.style?.getPropertyPriority("visibility") || "",
                              display: rule.style?.getPropertyValue("display") || "",
                              displayPriority: rule.style?.getPropertyPriority("display") || "",
                              transform: rule.style?.getPropertyValue("transform") || "",
                              transformPriority: rule.style?.getPropertyPriority("transform") || "",
                              cssText: rule.cssText.slice(0, 360)
                            });
                          }
                        } catch {}
                      }
                    }
                    return matches.slice(-16);
                  })(),
                  ancestors: (() => {
                    const chain = [];
                    let node = closeHint;
                    while (node && chain.length < 8) {
                      const style = getComputedStyle(node);
                      chain.push({
                        tag: node.tagName,
                        className: node.className || "",
                        dataTag: node.getAttribute?.("data-meow-top-surface-tag") || node.getAttribute?.("data-product-shell-top-surface-tag") || "",
                        visibility: style.visibility,
                        opacity: style.opacity,
                        display: style.display,
                        attrStyle: node.getAttribute?.("style") || ""
                      });
                      node = node.parentElement;
                    }
                    return chain;
                  })(),
                  html: closeHint.outerHTML.slice(0, 700)
                })));
                return;
              }
              setTimeout(tick, 40);
            };
            tick();
          });
        }
        await delay(540);
        runtimeCloseStyle = styleSnapshot(runtimeClose);
        runtimeCloseRect = rectDebug(runtimeClose);
        runtimeCloseRules = matchingRuleDebug(runtimeClose, /top-surface-close/);
        runtimeCloseVisibleRuleMatched = runtimeCloseRules.some((rule) => (
          rule.opacity === "1" &&
          rule.opacityPriority === "important" &&
          rule.transform === "scale(1)" &&
          rule.transformPriority === "important"
        ));
        runtimeMainStyle = runtimeMain ? styleSnapshot(runtimeMain) : null;
        runtimeMainDangerVisual = runtimeMainStyle ? {
          fill: hasDangerRed([runtimeMainStyle.backgroundColor, runtimeMainStyle.backgroundImage].join(" ")),
          frame: hasDangerRed(runtimeMainStyle.borderColor),
          glow: hasDangerRed(runtimeMainStyle.boxShadow)
        } : null;
        const closeHintStyle = closeHint ? styleSnapshot(closeHint) : null;
        const closeHintDebug = closeHint ? {
          className: closeHint.className,
          visible: closeHint.getAttribute("data-meow-top-surface-hint-visible") || "",
          route: closeHint.getAttribute("data-meow-top-surface-hint-route") || "",
          suppressed: closeHint.getAttribute("data-meow-top-surface-hint-suppressed") || "",
          matchesVisible: closeHint.matches('.meowdesk-top-surface-floating-hint[data-meow-top-surface-hint-visible="true"]'),
          matchingRules: (() => {
            const matches = [];
            for (const sheet of [...document.styleSheets]) {
              let rules = [];
              try {
                rules = [...(sheet.cssRules || [])];
              } catch {
                continue;
              }
              for (const rule of rules) {
                if (!rule.selectorText || !/top-surface-hint/.test(rule.selectorText)) continue;
                try {
                  if (closeHint.matches(rule.selectorText)) {
                    matches.push({
                      selector: rule.selectorText,
                      cssText: rule.cssText.slice(0, 260)
                    });
                  }
                } catch {}
              }
            }
            return matches.slice(-8);
          })(),
          html: closeHint.outerHTML.slice(0, 500)
        } : null;
        if (dangerState !== "true") {
          throw new Error("Runtime top surface close hover should arm the Meowdesk danger state.");
        }
        if (
          runtimeCloseStyle.display === "none" ||
          runtimeCloseStyle.visibility === "hidden" ||
          (runtimeCloseStyle.opacity < 0.8 && !runtimeCloseVisibleRuleMatched) ||
          runtimeCloseStyle.pointerEvents === "none" ||
          runtimeCloseRect.width < 10 ||
          runtimeCloseRect.height < 10 ||
          !runtimeMainDangerVisual?.fill ||
          !runtimeMainDangerVisual?.frame ||
          !runtimeMainDangerVisual?.glow
        ) {
          throw new Error("Runtime top surface close should show the red X and red danger tint: " + JSON.stringify({
            closeStyle: runtimeCloseStyle,
            closeRect: runtimeCloseRect,
            mainStyle: runtimeMainStyle,
            mainDangerVisual: runtimeMainDangerVisual,
            mainRules: runtimeMain ? matchingRuleDebug(runtimeMain, /top-surface-main|top-surface-tag/) : [],
            closeRules: runtimeCloseRules
          }));
        }
        if (!closeHint || closeHintStyle.opacity < 0.8 || closeHintStyle.visibility !== "visible") {
          throw new Error("Runtime top surface close hover should show the Meowdesk hint panel: " + JSON.stringify({
            style: closeHintStyle,
            debug: closeHintDebug
          }));
        }
        await clickElement(runtimeClose);
        const closeDialog = await waitFor('[data-meow-surface-close-dialog][data-product-shell-surface-close-dialog]');
        const closePanel = await waitFor('[data-meow-surface-close-panel]');
        if (
          closeDialog.getAttribute("data-meow-warning-owner") !== "meowdesk-warning-dialog" ||
          closeDialog.getAttribute("data-meow-warning-family") !== "flip-confirm-card" ||
          closePanel.getAttribute("data-meow-warning-owner") !== "meowdesk-warning-dialog" ||
          closePanel.getAttribute("data-meow-warning-family") !== "flip-confirm-card" ||
          closePanel.getAttribute("data-meow-warning-variant") !== "top-surface-close"
        ) {
          throw new Error("Top surface close dialog must use the shared warning dialog owner/family: " + JSON.stringify({
            dialogOwner: closeDialog.getAttribute("data-meow-warning-owner") || "",
            dialogFamily: closeDialog.getAttribute("data-meow-warning-family") || "",
            panelOwner: closePanel.getAttribute("data-meow-warning-owner") || "",
            panelFamily: closePanel.getAttribute("data-meow-warning-family") || "",
            panelVariant: closePanel.getAttribute("data-meow-warning-variant") || ""
          }));
        }
        if (document.querySelector('[data-vs-surface-close-dialog]')) {
          throw new Error("Runtime top surface close must use the governed Meowdesk dialog, not the legacy VS dialog.");
        }
        const closeDialogRect = closeDialog.getBoundingClientRect();
        if (
          closeDialog.parentElement !== document.body ||
          closeDialogRect.width < window.innerWidth * 0.8 ||
          closeDialogRect.height < window.innerHeight * 0.8
        ) {
          throw new Error("Top surface close dialog must be a body-level modal overlay, not clipped by the top rail: " + JSON.stringify({
            parentTag: closeDialog.parentElement?.tagName || "",
            dialog: rectDebug(closeDialog),
            viewport: { width: window.innerWidth, height: window.innerHeight }
          }));
        }
        const collapsedContent = closePanel.querySelector('.meowdesk-surface-close-content');
        const collapsedWarning = closePanel.querySelector('.meowdesk-surface-close-warning');
        const collapsedStyles = {
          panelExpanded: closePanel.getAttribute("data-meow-surface-close-expanded") || "",
          content: collapsedContent ? styleSnapshot(collapsedContent) : null,
          warning: collapsedWarning ? styleSnapshot(collapsedWarning) : null
        };
        if (collapsedStyles.panelExpanded !== "false" || !collapsedStyles.content || collapsedStyles.content.opacity > 0.2 || !collapsedStyles.warning || collapsedStyles.warning.opacity < 0.8) {
          throw new Error("Top surface close dialog should start as a warning hover panel: " + JSON.stringify(collapsedStyles));
        }
        await forceHover(closePanel);
        await delay(520);
        const expandedPanel = document.querySelector('[data-meow-surface-close-panel]') || closePanel;
        const expandedContentNode = expandedPanel.querySelector('.meowdesk-surface-close-content');
        const expandedWarningNode = expandedPanel.querySelector('.meowdesk-surface-close-warning');
        const expandedStyles = {
          panelExpanded: expandedPanel.getAttribute("data-meow-surface-close-expanded") || "",
          content: expandedContentNode ? styleSnapshot(expandedContentNode) : null,
          warning: expandedWarningNode ? styleSnapshot(expandedWarningNode) : null,
          contentAttrStyle: expandedContentNode?.getAttribute("style") || "",
          warningAttrStyle: expandedWarningNode?.getAttribute("style") || "",
          contentConnected: Boolean(expandedContentNode?.isConnected),
          warningConnected: Boolean(expandedWarningNode?.isConnected)
        };
        if (expandedStyles.panelExpanded !== "true" || !expandedStyles.content || expandedStyles.content.opacity < 0.8 || expandedStyles.content.pointerEvents === "none" || !expandedStyles.warning || expandedStyles.warning.opacity > 0.35) {
          throw new Error("Top surface close dialog should expand its confirmation content on hover/focus: " + JSON.stringify(expandedStyles));
        }
        await forceLeave(expandedPanel, closeDialog);
        await delay(420);
        const returnedPanel = document.querySelector('[data-meow-surface-close-panel]') || expandedPanel;
        const returnedContentNode = returnedPanel.querySelector('.meowdesk-surface-close-content');
        const returnedWarningNode = returnedPanel.querySelector('.meowdesk-surface-close-warning');
        const returnedStyles = {
          panelExpanded: returnedPanel.getAttribute("data-meow-surface-close-expanded") || "",
          content: returnedContentNode ? styleSnapshot(returnedContentNode) : null,
          warning: returnedWarningNode ? styleSnapshot(returnedWarningNode) : null,
          contentAttrStyle: returnedContentNode?.getAttribute("style") || "",
          warningAttrStyle: returnedWarningNode?.getAttribute("style") || ""
        };
        if (returnedStyles.panelExpanded !== "false" || !returnedStyles.content || returnedStyles.content.opacity > 0.2 || !returnedStyles.warning || returnedStyles.warning.opacity < 0.8) {
          throw new Error("Top surface close dialog should return to the warning layer after pointer leave: " + JSON.stringify(returnedStyles));
        }

        return {
          scenario: "top-surface-close-contract",
          rail: rectDebug(rail),
          inspected,
          runtimeClose: {
            tag: rectDebug(runtimeWorkspaceTag),
            close: rectDebug(runtimeClose),
            closeHint: closeHintStyle,
            dialog: rectDebug(closeDialog),
            collapsed: collapsedStyles,
            expanded: expandedStyles,
            returned: returnedStyles
          },
          legacyDialogPresent: Boolean(document.querySelector('[data-vs-surface-close-dialog]'))
        };
      })()
    `, true);
  }
}

async function runDataOwnershipHomeBackedScenario(win, dependencies = {}, scenario) {
  if (scenario === "data-ownership-home-backed") {
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
        const waitForStorageField = async (homeKey, fieldKey, predicate, timeout = 8000) => {
          const startedAt = Date.now();
          let latest = null;
          while (Date.now() - startedAt <= timeout) {
            const result = await window.workbench.readStorage(homeKey);
            latest = result?.value ?? null;
            if (latest && predicate(latest[fieldKey], latest)) {
              return { homeKey, fieldKey, value: latest[fieldKey], record: latest };
            }
            await delay(80);
          }
          throw new Error("Timed out waiting for Home storage field: " + JSON.stringify({ homeKey, fieldKey, latest }));
        };
        const waitForStorageValue = async (homeKey, predicate, timeout = 8000) => {
          const startedAt = Date.now();
          let latest = null;
          while (Date.now() - startedAt <= timeout) {
            const result = await window.workbench.readStorage(homeKey);
            latest = result?.value ?? null;
            if (predicate(latest)) {
              return { homeKey, value: latest };
            }
            await delay(80);
          }
          throw new Error("Timed out waiting for Home storage value: " + JSON.stringify({ homeKey, latest }));
        };
        const click = async (selector) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: "mouse" }));
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(180);
          return element;
        };
        const clickCardAction = async (ownerSelector, actionSelector) => {
          await click(ownerSelector + ' [data-card-action-menu-trigger]');
          await waitFor(ownerSelector + ' [data-card-action-menu-open="true"] [data-card-action-menu-content]');
          return click(ownerSelector + ' ' + actionSelector);
        };
        const dragRouteTo = async (sourceSelector, targetSelector, routeId) => {
          const source = await waitFor(sourceSelector);
          const dataTransfer = new DataTransfer();
          dataTransfer.effectAllowed = "move";
          source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
          if (!dataTransfer.getData("application/x-meowdesk-product-shell-route")) {
            dataTransfer.setData("application/x-meowdesk-product-shell-route", routeId);
            dataTransfer.setData("text/plain", routeId);
          }
          const target = await waitFor(targetSelector);
          target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer }));
          target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
          target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
          source.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer }));
          await delay(260);
        };

        if (!window.workbench?.readStorage) {
          throw new Error("data ownership smoke requires window.workbench.readStorage.");
        }

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('[data-r15-theme-sidebar-toggle]');
        await waitFor('[data-meowdesk-theme="light"]');
        const themeStorage = await waitForStorageValue("theme", (value) => value === "light");

        await click('aside nav [data-next-route="workspace"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
        await click('[data-r2-workspace-slot-button="2"]');
        const workspaceShellStorage = await waitForStorageField("workspaceShell", "meowdesk.workspace.slotCount.v3", (value) => Number(value) === 2);

        const meowBoxTrigger = await waitFor('[data-meow-box-trigger]');
        meowBoxTrigger.click();
        await delay(160);
        await waitFor('[data-meow-box-menu][data-meow-box-owner="product-shell"]');
        await click('[data-meow-box-create]');
        await waitFor('[data-meow-box-switch="box-2"]');
        await waitForStorageField("productShell", "meowdesk.productShell.boxes.v1", (value) => Array.isArray(value) && value.some((box) => box?.id === "box-2"));
        await click('[data-meow-box-switch="default"]');
        await dragRouteTo('[data-meow-box-launch="tasks"]', '[data-product-shell-sidebar-pin-zone]', "tasks");
        await waitFor('[data-product-shell-sidebar-pinned-item="tasks"]');
        const productShellStorage = await waitForStorageField("productShell", "meowdesk.productShell.sidebarPins.v1", (value) => Array.isArray(value) && value.includes("tasks"));

        await click('aside nav [data-next-route="studio"]');
        await waitFor('[data-studio-route]');
        await click('[data-studio-inspector-panel-tab="projects"]');
        await waitFor('[data-studio-real-project-item="Smoke 真实右侧栏"]');
        await click('[data-studio-select-project="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-detail-id="smoke-sidebar-widget"]');
        await clickCardAction('[data-studio-project-action-bar="smoke-sidebar-widget"]', '[data-studio-project-enable-sidebar="smoke-sidebar-widget"][data-studio-project-enable-sidebar-state="disabled"]');
        const workspaceExtensionsStorage = await waitForStorageField("workspaceExtensions", "meowdesk.workspace.enabledSidebarWidgets.v2", (value) => Array.isArray(value) && value.includes("smoke-sidebar-widget"));

        await click('[data-studio-page-tab="manage"]');
        await click('[data-studio-project-bucket="published"]');
        await waitFor('[data-studio-project-publish-entry="smoke-sidebar-widget"]');
        await click('[data-studio-project-publish-entry="smoke-sidebar-widget"]');
        await waitFor('[data-studio-workshop-publish-page]');
        await waitFor('[data-studio-project-publish-draft="smoke-sidebar-widget"]');
        await click('[data-studio-project-publish-save="smoke-sidebar-widget"]');
        await waitFor('[data-studio-project-publish-draft-saved="smoke-sidebar-widget"]');
        const studioPublishStorage = await waitForStorageField("studioPublish", "meowdesk.studio.projectPublishDrafts.v1", (value) => value && typeof value === "object" && Boolean(value["smoke-sidebar-widget"]));

        await click('[data-studio-page-tab="manage"]');
        await click('[data-studio-project-bucket="published"]');
        await waitFor('[data-studio-real-project-item="Smoke 真实右侧栏"]');
        await clickCardAction('[data-studio-project-item="Smoke 真实右侧栏"]', '[data-studio-remove-project="smoke-sidebar-widget"]');
        await waitFor('[data-studio-remove-project-dialog]');
        await click('[data-studio-remove-project-confirm]');
        const studioStateStorage = await waitForStorageField("studioState", "meowdesk.studio.removedWorkshopProjects.v1", (value) => Array.isArray(value) && value.includes("smoke-sidebar-widget"));

        return {
          scenario: "data-ownership-home-backed",
          theme: themeStorage.value,
          workspaceSlotCount: workspaceShellStorage.value,
          sidebarPins: productShellStorage.value,
          enabledSidebarWidgets: workspaceExtensionsStorage.value,
          publishDraftIds: Object.keys(studioPublishStorage.value || {}),
          removedProjectIds: studioStateStorage.value
        };
      })()
    `, true);
  }
}

async function runVisualRecoveryFirstBatchScenario(win, dependencies = {}, scenario) {
  if (scenario === "visual-recovery-first-batch") {
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
        const visibleRect = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
        };
        const parseColor = (value) => {
          const text = String(value || "").trim();
          const srgbMatch = text.match(/^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)$/);
          if (srgbMatch) {
            return {
              r: Number(srgbMatch[1]) * 255,
              g: Number(srgbMatch[2]) * 255,
              b: Number(srgbMatch[3]) * 255,
              a: Number.isFinite(Number(srgbMatch[4])) ? Number(srgbMatch[4]) : 1
            };
          }
          const match = text.match(/rgba?\\(([^)]+)\\)/);
          if (!match) return null;
          const parts = match[1].replace("/", " ").split(/[\\s,]+/).filter(Boolean).map((part) => Number.parseFloat(part.trim()));
          if (parts.length < 3 || parts.some((part, index) => index < 3 && !Number.isFinite(part))) return null;
          return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
        };
        const luminance = (color) => {
          const linear = [color.r, color.g, color.b].map((value) => {
            const channel = Math.max(0, Math.min(255, value)) / 255;
            return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
        };
        const contrastRatio = (foreground, background) => {
          const fg = parseColor(foreground);
          const bg = parseColor(background);
          if (!fg || !bg || bg.a < 0.75) return 0;
          const lighter = Math.max(luminance(fg), luminance(bg));
          const darker = Math.min(luminance(fg), luminance(bg));
          return (lighter + 0.05) / (darker + 0.05);
        };
        const hasVisibleBlue = (value) => {
          const text = String(value || "").toLowerCase();
          return text.includes("0 140 255") || text.includes("0, 140, 255") || text.includes("rgb(0 140 255") || text.includes("rgb(0, 140, 255)");
        };
        const assertReadableOnOwnBackground = (element, label, minimum = 3) => {
          const style = getComputedStyle(element);
          const ratio = contrastRatio(style.color, style.backgroundColor);
          if (ratio < minimum) {
            throw new Error(label + " text contrast is too weak: " + JSON.stringify({
              ratio,
              color: style.color,
              backgroundColor: style.backgroundColor,
              rect: rectDebug(element),
              text: (element.textContent || "").trim().slice(0, 120)
            }));
          }
          return { ratio: Math.round(ratio * 100) / 100, color: style.color, backgroundColor: style.backgroundColor };
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('aside nav [data-next-route="workspace"]');
        const topActions = await waitFor('[data-top-nav-actions]');
        const topActionRect = rectDebug(topActions);
        const topControls = [...topActions.querySelectorAll('button, a, [role="button"]')].filter(visibleRect);
        const crampedControls = topControls
          .map((control) => ({ rect: rectDebug(control), text: (control.textContent || "").replace(/\\s+/g, " ").trim() }))
          .filter((item) => item.rect.height > 44 || (item.text.length > 1 && item.rect.width < 42));
        if (topActionRect.height > 44 || crampedControls.length) {
          throw new Error("TopNav actions should stay in a horizontal compact row: " + JSON.stringify({ topActionRect, crampedControls }));
        }

        const activeSidebarRoute = await waitFor('aside .meowdesk-sidebar-route[data-next-route="workspace"][aria-current="page"]');
        const activeStyle = getComputedStyle(activeSidebarRoute);
        const activeBeforeStyle = getComputedStyle(activeSidebarRoute, "::before");
        const activeAfterStyle = getComputedStyle(activeSidebarRoute, "::after");
        const activeSidebarGlow = {
          boxShadow: activeStyle.boxShadow,
          edgeLight: activeBeforeStyle.backgroundColor,
          pulse: activeAfterStyle.animationName
        };
        const activeGlowLooksBlue = hasVisibleBlue(activeSidebarGlow.boxShadow) || hasVisibleBlue(activeSidebarGlow.edgeLight);
        if (activeSidebarGlow.boxShadow === "none" || !activeGlowLooksBlue || activeAfterStyle.content === "none") {
          throw new Error("Active sidebar route should expose blue glow and edge light: " + JSON.stringify({
            className: String(activeSidebarRoute.className || ""),
            matchesOwner: activeSidebarRoute.matches(".meowdesk-sidebar-route[aria-current='page']"),
            boxShadow: activeSidebarGlow.boxShadow,
            beforeBackground: activeSidebarGlow.edgeLight,
            afterContent: activeAfterStyle.content,
            afterAnimation: activeSidebarGlow.pulse,
            activeGlowLooksBlue
          }));
        }

        const meowBoxTrigger = await click('[data-meow-box-trigger]');
        const meowBoxMenu = await waitFor('[data-meow-box-menu][data-meow-box-owner="product-shell"]');
        const tasksLaunch = await waitFor('[data-meow-box-launch="tasks"]');
        const workflowLaunch = await waitFor('[data-meow-box-launch="obsidian"]');
        const menuRect = rectDebug(meowBoxMenu);
        const menuStyle = getComputedStyle(meowBoxMenu);
        const menuBackground = menuStyle.backgroundColor;
        const tasksReadable = assertReadableOnOwnBackground(tasksLaunch, "Meow Box launch");
        if (!visibleRect(meowBoxMenu) || menuRect.width < 260 || menuStyle.pointerEvents === "none" || !meowBoxMenu.textContent.includes("任务")) {
          throw new Error("Meow Box menu should be visible, readable, and contain box-only tools: " + JSON.stringify({
            menuRect,
            display: menuStyle.display,
            visibility: menuStyle.visibility,
            opacity: menuStyle.opacity,
            pointerEvents: menuStyle.pointerEvents,
            text: meowBoxMenu.textContent.trim()
          }));
        }
        if (meowBoxTrigger.getAttribute("data-meow-box-open") !== "true") {
          throw new Error("Meow Box trigger should expose open state while the menu is visible.");
        }

        const dataTransfer = new DataTransfer();
        dataTransfer.effectAllowed = "move";
        workflowLaunch.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
        if (!dataTransfer.getData("application/x-meowdesk-product-shell-route")) {
          dataTransfer.setData("application/x-meowdesk-product-shell-route", "obsidian");
          dataTransfer.setData("text/plain", "obsidian");
        }
        const pinZone = await waitFor('[data-product-shell-sidebar-pin-zone]');
        pinZone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer }));
        pinZone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
        await delay(360);
        const pinZoneStyle = getComputedStyle(pinZone);
        const pinZoneDropActive = pinZone.getAttribute("data-product-shell-sidebar-pin-zone-active") === "true";
        const pinZoneDragFeedback = {
          opacity: pinZoneStyle.opacity,
          boxShadow: pinZoneStyle.boxShadow
        };
        const pinZoneGlowLooksBlue = hasVisibleBlue(pinZoneDragFeedback.boxShadow) || hasVisibleBlue(pinZoneStyle.borderColor);
        if (!pinZoneDropActive || Number(pinZoneDragFeedback.opacity || 0) < 0.9 || pinZoneDragFeedback.boxShadow === "none" || !pinZoneGlowLooksBlue) {
          const matchedOpacityRules = Array.from(document.styleSheets).flatMap((sheet) => {
            let rules = [];
            try {
              rules = Array.from(sheet.cssRules || []);
            } catch {
              return [];
            }
            return rules
              .filter((rule) => rule?.selectorText && rule.style && typeof rule.style.opacity === "string" && rule.style.opacity)
              .filter((rule) => {
                try {
                  return pinZone.matches(rule.selectorText);
                } catch {
                  return false;
                }
              })
              .map((rule) => ({
                selector: rule.selectorText,
                opacity: rule.style.opacity,
                priority: rule.style.getPropertyPriority("opacity")
              }));
          });
          throw new Error("Sidebar pin drop zone should glow while dragging a box-only tool: " + JSON.stringify({
            className: String(pinZone.className || ""),
            pinZoneDropActive,
            styleAttr: pinZone.getAttribute("style") || "",
            opacity: pinZoneDragFeedback.opacity,
            boxShadow: pinZoneDragFeedback.boxShadow,
            borderColor: pinZoneStyle.borderColor,
            pinZoneGlowLooksBlue,
            transitionProperty: pinZoneStyle.transitionProperty,
            transitionDuration: pinZoneStyle.transitionDuration,
            animations: pinZone.getAnimations().map((animation) => ({
              currentTime: animation.currentTime,
              playState: animation.playState,
              effectTarget: animation.effect?.target?.getAttribute?.("data-product-shell-sidebar-pin-zone") !== null
                ? "pin-zone"
                : animation.effect?.target?.tagName || ""
            })),
            matchedOpacityRules,
            rect: rectDebug(pinZone)
          }));
        }
        workflowLaunch.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer }));
        await delay(120);

        await click('aside nav [data-next-route="studio"]');
        await waitFor('[data-studio-agent-panel][data-studio-agent-stage-current="workstation"]');
        const addOrChange = document.querySelector('[data-studio-agent-add]') || document.querySelector('[data-studio-agent-change]');
        if (!addOrChange) throw new Error("Studio Agent add/change button is missing.");
        addOrChange.click();
        await delay(180);
        const dialog = await waitFor('[data-studio-agent-picker-dialog]');
        const choice = await waitFor('[data-studio-agent-choice="smoke-picker-agent"]');
        const dialogStyle = getComputedStyle(dialog);
        const choiceStyle = getComputedStyle(choice);
        const dialogReadable = assertReadableOnOwnBackground(dialog, "Studio picker dialog", 3);
        const choiceReadable = assertReadableOnOwnBackground(choice, "Studio picker choice", 3);
        if (!visibleRect(dialog) || dialogStyle.pointerEvents === "none" || !dialog.textContent.includes("选择工坊 Agent") || !dialog.textContent.includes("Smoke Picker Agent")) {
          throw new Error("Studio picker dialog should stay visible and readable with native content: " + JSON.stringify({
            dialogRect: rectDebug(dialog),
            display: dialogStyle.display,
            visibility: dialogStyle.visibility,
            opacity: dialogStyle.opacity,
            pointerEvents: dialogStyle.pointerEvents,
            text: dialog.textContent.trim()
          }));
        }
        if (choiceStyle.opacity && Number(choiceStyle.opacity) < 0.8) {
          throw new Error("Studio picker choice should not look disabled: " + JSON.stringify({
            opacity: choiceStyle.opacity,
            rect: rectDebug(choice),
            text: choice.textContent.trim()
          }));
        }

        return {
          scenario: "visual-recovery-first-batch",
          topActionRect,
          topControlCount: topControls.length,
          activeSidebarGlow,
          meowBox: {
            menuRect,
            menuBackground,
            tasksReadable,
            pinZoneOpacity: pinZoneDragFeedback.opacity,
            pinZoneBoxShadow: pinZoneDragFeedback.boxShadow
          },
          studioPicker: {
            dialogRect: rectDebug(dialog),
            dialogReadable,
            choiceReadable,
            choiceOpacity: choiceStyle.opacity
          }
        };
      })()
    `, true);
  }
}

async function runVisualRecoveryThirdBatchScenario(win, dependencies = {}, scenario) {
  if (scenario === "visual-recovery-third-batch") {
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
        const click = async (selector, wait = 180) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(wait);
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
        const visibleRect = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
        };
        const parseColor = (value) => {
          const text = String(value || "").trim();
          const srgbMatch = text.match(/^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)$/);
          if (srgbMatch) {
            return {
              r: Number(srgbMatch[1]) * 255,
              g: Number(srgbMatch[2]) * 255,
              b: Number(srgbMatch[3]) * 255,
              a: Number.isFinite(Number(srgbMatch[4])) ? Number(srgbMatch[4]) : 1
            };
          }
          const match = text.match(/rgba?\\(([^)]+)\\)/);
          if (!match) return null;
          const parts = match[1].replace("/", " ").split(/[\\s,]+/).filter(Boolean).map((part) => Number.parseFloat(part.trim()));
          if (parts.length < 3 || parts.some((part, index) => index < 3 && !Number.isFinite(part))) return null;
          return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
        };
        const luminance = (color) => {
          const linear = [color.r, color.g, color.b].map((value) => {
            const channel = Math.max(0, Math.min(255, value)) / 255;
            return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
        };
        const contrastRatio = (foreground, background) => {
          const fg = parseColor(foreground);
          const bg = parseColor(background);
          if (!fg || !bg || bg.a < 0.75) return 0;
          const lighter = Math.max(luminance(fg), luminance(bg));
          const darker = Math.min(luminance(fg), luminance(bg));
          return (lighter + 0.05) / (darker + 0.05);
        };
        const assertReadableOnOwnBackground = (element, label, minimum = 3) => {
          const style = getComputedStyle(element);
          const ratio = contrastRatio(style.color, style.backgroundColor);
          if (ratio < minimum) {
            throw new Error(label + " text contrast is too weak: " + JSON.stringify({
              ratio,
              color: style.color,
              backgroundColor: style.backgroundColor,
              rect: rectDebug(element),
              text: (element.textContent || "").trim().slice(0, 120)
            }));
          }
          return { ratio: Math.round(ratio * 100) / 100, color: style.color, backgroundColor: style.backgroundColor };
        };
        const assertMeowPicker = (dialog, expectedDialog, label) => {
          const style = getComputedStyle(dialog);
          const snapshot = {
            className: String(dialog.className || ""),
            meowDialog: dialog.getAttribute("data-meow-picker-dialog"),
            family: dialog.getAttribute("data-meow-picker-family"),
            live: dialog.getAttribute("data-meow-picker-live"),
            vsLive: dialog.getAttribute("data-vs-picker-live"),
            rect: rectDebug(dialog),
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            pointerEvents: style.pointerEvents
          };
          if (
            !dialog.classList.contains("meowdesk-picker-dialog") ||
            dialog.classList.contains("vs-picker-card-dialog") ||
            snapshot.meowDialog !== expectedDialog ||
            snapshot.family !== "agent-tool-picker" ||
            snapshot.live !== "native-content" ||
            snapshot.vsLive ||
            !visibleRect(dialog) ||
            style.pointerEvents === "none"
          ) {
            throw new Error(label + " should be owned by the Meowdesk picker family, not the VS picker compatibility selector: " + JSON.stringify(snapshot));
          }
          return {
            ...snapshot,
            readable: assertReadableOnOwnBackground(dialog, label)
          };
        };

        await waitFor('[data-workbench-bridge-status="ready"]');

        await click('aside nav [data-next-route="workspace"]');
        const workspaceOwner = await waitFor('[data-r2-workspace-route] [data-workspace-right-sidebar-owner]');
        const workspaceOwnerStyle = getComputedStyle(workspaceOwner);
        const rightSidebar = {
          page: workspaceOwner.getAttribute("data-workspace-right-sidebar-page"),
          owner: workspaceOwner.getAttribute("data-meow-right-sidebar-owner"),
          family: workspaceOwner.getAttribute("data-meow-right-sidebar-family"),
          motionOwner: workspaceOwner.getAttribute("data-meow-right-sidebar-motion-owner"),
          className: String(workspaceOwner.className || ""),
          rect: rectDebug(workspaceOwner),
          width: workspaceOwnerStyle.width,
          display: workspaceOwnerStyle.display,
          opacity: workspaceOwnerStyle.opacity
        };
        if (
          document.querySelectorAll('[data-r2-workspace-route] [data-workspace-right-sidebar-owner]').length !== 1 ||
          rightSidebar.owner !== "workspace" ||
          rightSidebar.family !== "workspace" ||
          rightSidebar.motionOwner !== "workspace" ||
          !workspaceOwner.classList.contains("meowdesk-workspace-right-sidebar-owner") ||
          Number.parseFloat(rightSidebar.width) < 280
        ) {
          throw new Error("Workspace right sidebar should stay on the shared Meowdesk owner/family: " + JSON.stringify(rightSidebar));
        }
        const hasVisibleBlue = (value) => {
          const text = String(value || "").toLowerCase();
          return text.includes("0 140 255") || text.includes("0, 140, 255") || text.includes("rgb(0 140 255") || text.includes("rgb(0, 140, 255)");
        };

        await click('[data-meow-box-trigger]');
        const meowBoxTrigger = await waitFor('[data-meow-box-trigger][data-meow-box-open="true"]');
        const meowBoxMenu = await waitFor('[data-meow-box-menu][data-meow-box-ready="true"][data-meow-box-family="product-shell-meow-box"]');
        const pinAction = await waitFor('[data-meow-box-pin="obsidian"]');
        const workflowLaunch = await waitFor('[data-meow-box-launch="obsidian"]');
        if (
          meowBoxTrigger.hasAttribute("data-vs-box-drop-active") ||
          meowBoxMenu.hasAttribute("data-vs-meow-box-ready") ||
          pinAction.classList.contains("vs-meow-box-mini-action") ||
          !pinAction.classList.contains("meowdesk-meow-box-mini-action")
        ) {
          throw new Error("Meow Box should expose Meowdesk box/drop owner markers without live VS owner markers: " + JSON.stringify({
            trigger: meowBoxTrigger.outerHTML.slice(0, 360),
            menu: meowBoxMenu.outerHTML.slice(0, 360),
            pinClass: String(pinAction.className || "")
          }));
        }
        const boxDataTransfer = new DataTransfer();
        boxDataTransfer.effectAllowed = "move";
        workflowLaunch.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: boxDataTransfer }));
        if (!boxDataTransfer.getData("application/x-meowdesk-product-shell-route")) {
          boxDataTransfer.setData("application/x-meowdesk-product-shell-route", "obsidian");
          boxDataTransfer.setData("text/plain", "obsidian");
        }
        meowBoxTrigger.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: boxDataTransfer }));
        meowBoxTrigger.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: boxDataTransfer }));
        await delay(180);
        if (meowBoxTrigger.getAttribute("data-meow-box-drop-active") !== "true" || meowBoxTrigger.hasAttribute("data-vs-box-drop-active")) {
          throw new Error("Meow Box drop feedback should use data-meow-box-drop-active, not data-vs-box-drop-active: " + meowBoxTrigger.outerHTML.slice(0, 360));
        }
        const triggerStyle = getComputedStyle(meowBoxTrigger);
        const boxDrop = {
          dropActive: meowBoxTrigger.getAttribute("data-meow-box-drop-active"),
          boxShadow: triggerStyle.boxShadow,
          borderColor: triggerStyle.borderColor,
          menuRect: rectDebug(meowBoxMenu),
          launchReadable: assertReadableOnOwnBackground(workflowLaunch, "Meow Box launch")
        };
        if (boxDrop.boxShadow === "none" || !hasVisibleBlue(boxDrop.boxShadow + " " + boxDrop.borderColor)) {
          const matchedRules = Array.from(document.styleSheets).flatMap((sheet) => {
            let rules = [];
            try {
              rules = Array.from(sheet.cssRules || []);
            } catch {
              return [];
            }
            return rules
              .filter((rule) => rule?.selectorText && rule.style && (rule.style.boxShadow || rule.style.borderColor || rule.style.background))
              .filter((rule) => {
                try {
                  return meowBoxTrigger.matches(rule.selectorText);
                } catch {
                  return false;
                }
              })
              .map((rule) => ({
                selector: rule.selectorText,
                borderColor: rule.style.borderColor,
                background: rule.style.background,
                boxShadow: rule.style.boxShadow,
                boxShadowPriority: rule.style.getPropertyPriority("box-shadow"),
                borderPriority: rule.style.getPropertyPriority("border-color")
              }));
          });
          throw new Error("Meow Box drop feedback should retain visible glow under the Meowdesk owner: " + JSON.stringify({
            ...boxDrop,
            triggerOuter: meowBoxTrigger.outerHTML.slice(0, 520),
            productShellAncestor: Boolean(meowBoxTrigger.closest("[data-product-shell]")),
            nextSidebarAncestor: Boolean(meowBoxTrigger.closest("[data-next-sidebar-product-shell]")),
            matchedRules
          }));
        }
        workflowLaunch.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: boxDataTransfer }));
        await delay(120);

        await click('[data-r2-workspace-configure-pane="blank-1"]');
        const workspacePickerDialog = await waitFor('[data-r2-workspace-config-dialog]');
        const workspaceTool = await waitFor('[data-r2-workspace-config-tool="smoke-picker-agent"]');
        const workspacePicker = assertMeowPicker(workspacePickerDialog, "workspace-config", "Workspace config picker");
        const workspaceToolReadable = assertReadableOnOwnBackground(workspaceTool, "Workspace config tool");
        const workspaceToolStyle = getComputedStyle(workspaceTool);
        if (!workspacePickerDialog.textContent.includes("配置工作窗") || !workspacePickerDialog.textContent.includes("Smoke Picker Agent") || Number(workspaceToolStyle.opacity || 1) < 0.8) {
          throw new Error("Workspace config picker should show real selectable tools: " + JSON.stringify({
            text: workspacePickerDialog.textContent.trim().slice(0, 360),
            toolOpacity: workspaceToolStyle.opacity,
            workspaceToolReadable
          }));
        }
        const workspaceClose = workspacePickerDialog.querySelector('[data-dialog-close]');
        workspaceClose?.click();
        await delay(160);

        await click('aside nav [data-next-route="studio"]');
        await waitFor('[data-studio-agent-panel][data-studio-agent-stage-current="workstation"]');
        const addOrChange = document.querySelector('[data-studio-agent-add]') || document.querySelector('[data-studio-agent-change]');
        if (!addOrChange) throw new Error("Studio Agent add/change button is missing.");
        addOrChange.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
        addOrChange.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
        addOrChange.click();
        await delay(180);
        const studioPickerDialog = await waitFor('[data-studio-agent-picker-dialog]');
        const studioChoice = await waitFor('[data-studio-agent-choice="smoke-picker-agent"]');
        const studioPicker = assertMeowPicker(studioPickerDialog, "studio-agent", "Studio Agent picker");
        const studioChoiceReadable = assertReadableOnOwnBackground(studioChoice, "Studio Agent picker choice");
        if (!studioPickerDialog.textContent.includes("选择工坊 Agent") || !studioPickerDialog.textContent.includes("Smoke Picker Agent")) {
          throw new Error("Studio Agent picker should show real seeded CLI Agent content: " + studioPickerDialog.textContent.trim());
        }
        if (document.querySelector(".vs-picker-dialog-mouse")) {
          throw new Error("Picker recovery should not revive the old mouse-follow VS picker shell.");
        }

        return {
          scenario: "visual-recovery-third-batch",
          rightSidebar,
          meowBox: boxDrop,
          workspacePicker: {
            dialog: workspacePicker,
            toolReadable: workspaceToolReadable
          },
          studioPicker: {
            dialog: studioPicker,
            choiceReadable: studioChoiceReadable
          }
        };
      })()
    `, true);
  }
}

async function runVisualRecoveryFourthBatchScenario(win, dependencies = {}, scenario) {
  if (scenario === "visual-recovery-fourth-batch") {
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
        const click = async (selector, wait = 180) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(wait);
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
        const visibleRect = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
        };
        const hasGreenGlow = (value) => {
          const text = String(value || "").toLowerCase();
          return text.includes("55 255 139") || text.includes("55, 255, 139") || text.includes("rgb(55 255 139") || text.includes("rgb(55, 255, 139)");
        };
        const assertMeowTopSurface = async () => {
          const rail = await waitFor('[data-top-nav-running-surfaces] [data-meow-top-surface-rail][data-product-shell-top-surface-rail]');
          await delay(180);
          if (
            rail.classList.contains("vs-top-surface-rail") ||
            rail.hasAttribute("data-vs-top-surface-rail") ||
            rail.querySelector("[data-vs-top-surface-tag], [data-vs-top-surface-main], [data-vs-top-surface-close], .vs-top-surface-tag, .vs-top-surface-main, .vs-top-surface-close")
          ) {
            throw new Error("Top surface tag recovery should not expose live VS top-surface owner markers: " + rail.outerHTML.slice(0, 1200));
          }
          const railStyle = getComputedStyle(rail);
          const tags = [...rail.querySelectorAll("[data-meow-top-surface-tag]")];
          if (tags.length < 2) {
            throw new Error("Top surface rail should expose Workspace and Studio Meowdesk tags: " + rail.outerHTML.slice(0, 1200));
          }
          const inspected = tags.map((tag) => {
            const main = tag.querySelector("[data-meow-top-surface-main]");
            const label = tag.querySelector(".meowdesk-top-surface-label");
            const style = getComputedStyle(tag);
            const mainStyle = main ? getComputedStyle(main) : null;
            const mainRect = main ? rectDebug(main) : null;
            return {
              route: tag.getAttribute("data-meow-top-surface-route") || "",
              productRoute: tag.getAttribute("data-product-shell-top-surface-tag") || "",
              label: tag.getAttribute("data-meow-top-surface-label") || "",
              labelText: label?.textContent?.trim() || "",
              closable: tag.getAttribute("data-product-shell-top-surface-closable") || "",
              closeMode: tag.getAttribute("data-product-shell-top-surface-close-mode") || "",
              tagClass: String(tag.className || ""),
              tagRect: rectDebug(tag),
              tagDisplay: style.display,
              mainClass: String(main?.className || ""),
              mainRect,
              mainDisplay: mainStyle?.display || "",
              mainVisibility: mainStyle?.visibility || "",
              mainPointerEvents: mainStyle?.pointerEvents || "",
              mainBoxShadow: mainStyle?.boxShadow || "",
              closePresent: Boolean(tag.querySelector("[data-product-shell-top-surface-close], [data-vs-top-surface-close], .vs-top-surface-close")),
              visible: main ? visibleRect(main) : false
            };
          });
          const violations = inspected.filter((item) => (
            !item.route ||
            item.route !== item.productRoute ||
            !item.label ||
            item.labelText !== item.label ||
            item.closable !== "true" ||
            item.closeMode !== "detach-only" ||
            !item.tagClass.includes("meowdesk-top-surface-tag") ||
            !item.mainClass.includes("meowdesk-top-surface-main") ||
            !item.mainRect ||
            item.mainRect.width < 30 ||
            item.mainRect.height < 30 ||
            item.mainPointerEvents === "none" ||
            !item.closePresent ||
            !item.visible
          ));
          if (violations.length) {
            throw new Error("Top surface tags should be clickable Meowdesk/ProductShell controls with close affordance for surface routes: " + JSON.stringify(violations));
          }
          const activeMain = rail.querySelector('[data-meow-top-surface-main][data-meow-tab-active="true"]') || rail.querySelector('[data-meow-top-surface-main][aria-current="page"]');
          const activeStyle = activeMain ? getComputedStyle(activeMain) : null;
          if (!activeMain || !activeStyle || !hasGreenGlow(activeStyle.boxShadow)) {
            throw new Error("Active top surface tag should keep the restored green glow under Meowdesk owner: " + JSON.stringify({
              activeMain: activeMain ? activeMain.outerHTML.slice(0, 360) : "",
              boxShadow: activeStyle?.boxShadow || "",
              inspected
            }));
          }
          return {
            rail: {
              rect: rectDebug(rail),
              display: railStyle.display,
              family: rail.getAttribute("data-meow-top-surface-family") || ""
            },
            inspected,
            activeGlow: activeStyle.boxShadow
          };
        };

        await click('aside nav [data-next-route="workspace"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
        await click('aside nav [data-next-route="studio"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:studio"]');
        const studioSurface = await assertMeowTopSurface();
        await click('aside nav [data-next-route="workspace"]');
        await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
        const workspaceSurface = await assertMeowTopSurface();

        return {
          scenario: "visual-recovery-fourth-batch",
          studioSurface,
          workspaceSurface,
          vsLegacyMode: {
            vsVisual: document.documentElement.dataset.vsVisual || "",
            hasLiveClass: document.documentElement.classList.contains("vs-live-app-mode")
          }
        };
      })()
    `, true);
  }
}

async function runVisualRecoveryFifthBatchScenario(win, dependencies = {}, scenario) {
  if (scenario === "visual-recovery-fifth-batch") {
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
        const click = async (selector, wait = 180) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(wait);
          return element;
        };
        const visibleRect = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
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
        const activeRouteId = () => document.querySelector('[data-next-route][aria-current="page"]')?.getAttribute("data-next-route") || window.location.hash.replace(/^#\\/?/, "");
        const assertNoVsLiveResidue = (label) => {
          const residue = document.querySelector([
            ".vs-picker-dialog-mouse",
            "[data-vs-picker-live]",
            "[data-vs-meow-box-ready]",
            "[data-vs-box-drop-active]",
            "[data-vs-top-surface-tag]",
            ".vs-top-surface-tag"
          ].join(","));
          if (residue) {
            throw new Error(label + " should stay on Meowdesk owners without live VS residue: " + JSON.stringify({
              tagName: residue.tagName,
              className: String(residue.className || ""),
              dataset: { ...residue.dataset },
              html: residue.outerHTML.slice(0, 520)
            }));
          }
        };
        const routeSurfaceSelector = {
          tasks: "[data-phase-six-route='tasks']",
          conversations: "[data-r2-conversations-route]",
          obsidian: "[data-r2-obsidian-route]"
        };
        const launchRouteFromBox = async (routeId) => {
          await click('[data-meow-box-trigger]');
          const menu = await waitFor('[data-meow-box-menu][data-meow-box-owner="product-shell"][data-meow-box-family="product-shell-meow-box"]');
          const launch = await waitFor('[data-meow-box-launch="' + routeId + '"][data-meow-box-launch-box="default"]');
          if (!visibleRect(menu) || !visibleRect(launch) || launch.disabled) {
            throw new Error("Meow Box launch item is not visibly usable: " + JSON.stringify({
              routeId,
              menu: rectDebug(menu),
              launch: rectDebug(launch),
              disabled: launch.disabled,
              text: launch.textContent.trim()
            }));
          }
          await click('[data-meow-box-launch="' + routeId + '"]', 240);
          await waitFor(routeSurfaceSelector[routeId]);
          if (activeRouteId() !== routeId) {
            throw new Error("Meow Box launch did not activate route: " + JSON.stringify({ routeId, activeRoute: activeRouteId() }));
          }
          if (document.querySelector('[data-meow-box-menu]')) {
            throw new Error("Meow Box should close after launching an ephemeral route: " + routeId);
          }
          if (document.querySelector('[data-meow-tab-route="' + routeId + '"]')) {
            throw new Error("Ephemeral Meow Box route should not create a running Meow Tab: " + routeId);
          }
          assertNoVsLiveResidue("Meow Box route launch " + routeId);
          return routeId;
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('aside nav [data-next-route="workspace"]');
        await waitFor('[data-r2-workspace-route]');

        await click('[data-meow-box-trigger]');
        const menu = await waitFor('[data-meow-box-menu][data-meow-box-ready="true"][data-meow-box-family="product-shell-meow-box"]');
        const defaultLaunchRoutes = [...menu.querySelectorAll('[data-meow-box-launch]')].map((item) => item.getAttribute("data-meow-box-launch")).filter(Boolean);
        const requiredBoxRoutes = ["tasks", "conversations", "obsidian"];
        const missingRoutes = requiredBoxRoutes.filter((routeId) => !defaultLaunchRoutes.includes(routeId));
        const forbiddenRoutes = ["lobby", "workspace", "studio", "access"].filter((routeId) => defaultLaunchRoutes.includes(routeId));
        if (missingRoutes.length || forbiddenRoutes.length) {
          throw new Error("Meow Box default route matrix is wrong: " + JSON.stringify({ defaultLaunchRoutes, missingRoutes, forbiddenRoutes }));
        }
        assertNoVsLiveResidue("Meow Box route matrix");
        await click('[data-meow-box-trigger]');

        const launchedRoutes = [];
        for (const routeId of requiredBoxRoutes) {
          launchedRoutes.push(await launchRouteFromBox(routeId));
        }

        await click('[data-next-sidebar-settings]');
        await waitFor('[data-r2-access-route]');
        await waitFor('[data-r2-access-section="workspace"]');
        if (activeRouteId() !== "access") {
          throw new Error("Access settings footer entry did not activate the access route: " + activeRouteId());
        }
        const accessRouteAfterSettings = activeRouteId();

        await click('aside nav [data-next-route="workspace"]');
        await waitFor('[data-r2-workspace-route]');
        await click('[data-r2-workspace-slot-button="2"]', 260);
        await waitFor('[data-r2-workspace-pane="blank-1"]');
        await click('[data-r2-workspace-configure-pane="blank-1"]');
        const workspaceDialog = await waitFor('[data-r2-workspace-config-dialog][data-meow-picker-dialog="workspace-config"][data-meow-picker-family="agent-tool-picker"]');
        const workspaceTool = await waitFor('[data-r2-workspace-config-tool="smoke-picker-agent"][data-r2-workspace-config-tool-kind="agent"]');
        if (!visibleRect(workspaceDialog) || !visibleRect(workspaceTool)) {
          throw new Error("Workspace config picker choice should be visibly selectable: " + JSON.stringify({
            dialog: rectDebug(workspaceDialog),
            tool: rectDebug(workspaceTool),
            text: workspaceDialog.textContent.trim().slice(0, 360)
          }));
        }
        await click('[data-r2-workspace-config-tool="smoke-picker-agent"]', 260);
        const configuredPane = await waitFor('[data-r2-workspace-pane="blank-1"][data-r2-workspace-pane-configured="true"][data-r2-workspace-pane-kind="agent"]');
        await waitFor('[data-r2-terminal-start-panel-kind="agent"]');
        if (document.querySelector('[data-r2-workspace-config-dialog]')) {
          throw new Error("Workspace config picker should close after a tool is selected.");
        }
        const workspaceStartButton = configuredPane.querySelector('[data-r2-terminal-start]');
        if (!workspaceStartButton || workspaceStartButton.disabled) {
          throw new Error("Configured Workspace agent pane should expose an enabled start button: " + configuredPane.outerHTML.slice(0, 1200));
        }
        assertNoVsLiveResidue("Workspace config selection");

        await click('aside nav [data-next-route="studio"]');
        await waitFor('[data-studio-agent-panel][data-studio-agent-stage-current="workstation"]');
        const addOrChange = document.querySelector('[data-studio-agent-add]') || document.querySelector('[data-studio-agent-change]');
        if (!addOrChange) throw new Error("Studio Agent add/change button is missing.");
        addOrChange.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
        addOrChange.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
        addOrChange.click();
        await delay(180);
        const studioDialog = await waitFor('[data-studio-agent-picker-dialog][data-meow-picker-dialog="studio-agent"][data-meow-picker-family="agent-tool-picker"]');
        const studioChoice = await waitFor('[data-studio-agent-choice="smoke-picker-agent"]');
        if (!visibleRect(studioDialog) || !visibleRect(studioChoice)) {
          throw new Error("Studio Agent picker choice should be visibly selectable: " + JSON.stringify({
            dialog: rectDebug(studioDialog),
            choice: rectDebug(studioChoice),
            text: studioDialog.textContent.trim().slice(0, 360)
          }));
        }
        await click('[data-studio-agent-choice="smoke-picker-agent"]', 260);
        const selectedStudioPanel = await waitFor('[data-studio-agent-panel][data-studio-agent-selected="smoke-picker-agent"]');
        if (document.querySelector('[data-studio-agent-picker-dialog]')) {
          throw new Error("Studio Agent picker should close after an Agent is selected.");
        }
        const studioStartButton = await waitFor('[data-studio-agent-start]');
        if (studioStartButton.disabled) {
          throw new Error("Selected Studio Agent should expose an enabled start button.");
        }
        assertNoVsLiveResidue("Studio Agent selection");

        return {
          scenario: "visual-recovery-fifth-batch",
          boxRoutes: defaultLaunchRoutes,
          launchedRoutes,
          accessRouteAfterSettings,
          finalRoute: activeRouteId(),
          workspacePicker: {
            paneKind: configuredPane.getAttribute("data-r2-workspace-pane-kind"),
            configured: configuredPane.getAttribute("data-r2-workspace-pane-configured"),
            startEnabled: !workspaceStartButton.disabled
          },
          studioPicker: {
            selected: selectedStudioPanel.getAttribute("data-studio-agent-selected"),
            startEnabled: !studioStartButton.disabled
          },
          vsLegacyMode: {
            vsVisual: document.documentElement.dataset.vsVisual || "",
            hasLiveClass: document.documentElement.classList.contains("vs-live-app-mode")
          }
        };
      })()
    `, true);
  }
}

async function runVisualRecoverySixthBatchScenario(win, dependencies = {}, scenario) {
  if (scenario === "visual-recovery-sixth-batch") {
    return win.webContents.executeJavaScript(`
      (async () => {
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
        const waitForCondition = (label, predicate, timeout = 9000) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          let latest;
          const tick = async () => {
            try {
              latest = await predicate();
              if (latest) {
                resolve(latest);
                return;
              }
            } catch (error) {
              latest = error && error.message ? error.message : String(error);
            }
            if (Date.now() - startedAt > timeout) {
              reject(new Error("Timed out waiting for " + label + ": " + JSON.stringify(latest)));
              return;
            }
            setTimeout(() => void tick(), 60);
          };
          void tick();
        });
        const click = async (selector, wait = 180) => {
          const element = await waitFor(selector);
          element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
          element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
          element.click();
          await delay(wait);
          return element;
        };
        const dragRouteTo = async (sourceSelector, targetSelector, routeId, wait = 280) => {
          const source = await waitFor(sourceSelector);
          const dataTransfer = new DataTransfer();
          dataTransfer.effectAllowed = "move";
          source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
          if (!dataTransfer.getData("application/x-meowdesk-product-shell-route")) {
            dataTransfer.setData("application/x-meowdesk-product-shell-route", routeId);
            dataTransfer.setData("text/plain", routeId);
          }
          const target = await waitFor(targetSelector);
          target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer }));
          target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
          target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
          source.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer }));
          await delay(wait);
        };
        const rectDebug = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        };
        const activeRouteId = () => document.querySelector('[data-next-route][aria-current="page"]')?.getAttribute("data-next-route") || window.location.hash.replace(/^#\\/?/, "");
        const openMeowBox = async () => {
          const trigger = await waitFor('[data-meow-box-trigger][data-meow-box-owner="product-shell"][data-meow-box-family="product-shell-meow-box"]');
          if (trigger.getAttribute("data-meow-box-open") !== "true") {
            trigger.click();
            await delay(180);
          }
          return waitFor('[data-meow-box-menu][data-meow-box-owner="product-shell"][data-meow-box-family="product-shell-meow-box"][data-meow-box-ready="true"]');
        };
        const switchBox = async (boxId) => {
          const menu = await openMeowBox();
          const current = menu.getAttribute("data-meow-box-active-id");
          if (current !== boxId) {
            await click('[data-meow-box-switch="' + boxId + '"]', 180);
          }
          return waitFor('[data-meow-box-menu][data-meow-box-active-id="' + boxId + '"]');
        };
        const boxRoutes = (boxId) => {
          const box = document.querySelector('[data-meow-box-active-id="' + boxId + '"] [data-meow-box-id="' + boxId + '"]');
          return [...(box?.querySelectorAll('[data-meow-box-launch]') || [])].map((item) => item.getAttribute("data-meow-box-launch")).filter(Boolean);
        };
        const waitForStorageField = async (homeKey, fieldKey, predicate) => {
          if (!window.workbench?.readStorage) return { value: undefined, skipped: true };
          let latest;
          const value = await waitForCondition("Home storage " + homeKey + "." + fieldKey, async () => {
            const result = await window.workbench.readStorage(homeKey);
            const record = result?.value && typeof result.value === "object" ? result.value : null;
            latest = record ? record[fieldKey] : undefined;
            return predicate(latest) ? latest : false;
          }, 9000);
          return { value, skipped: false };
        };
        const assertNoVsLiveResidue = (label) => {
          const residue = document.querySelector([
            ".vs-picker-dialog-mouse",
            "[data-vs-picker-live]",
            "[data-vs-meow-box-ready]",
            "[data-vs-box-drop-active]",
            "[data-vs-top-surface-tag]",
            ".vs-top-surface-tag",
            ".vs-live-app-mode"
          ].join(","));
          if (residue) {
            throw new Error(label + " should not expose live VS owner residue: " + JSON.stringify({
              tagName: residue.tagName,
              className: String(residue.className || ""),
              dataset: { ...residue.dataset },
              html: residue.outerHTML.slice(0, 520)
            }));
          }
        };
        const clickCardAction = async (ownerSelector, actionSelector) => {
          await click(ownerSelector + ' [data-card-action-menu-trigger]', 140);
          await waitFor(ownerSelector + ' [data-card-action-menu-open="true"] [data-card-action-menu-content]');
          return click(ownerSelector + ' ' + actionSelector, 260);
        };

        await waitFor('[data-workbench-bridge-status="ready"]');
        await click('aside nav [data-next-route="studio"]');
        await waitFor('[data-studio-route]');
        await click('[data-studio-page-tab="manage"]');
        await waitFor('[data-studio-workshop-management]');
        await click('[data-studio-project-bucket="published"]');
        await waitFor('[data-studio-real-project-item="Smoke 真实功能页"]');
        await click('[data-studio-select-project="smoke-feature-page"]');
        await waitFor('[data-studio-project-detail-id="smoke-feature-page"]');
        await clickCardAction(
          '[data-studio-project-action-bar="smoke-feature-page"]',
          '[data-studio-project-enable-feature-page="smoke-feature-page"][data-studio-project-enable-feature-page-state="disabled"]'
        );
        await waitFor('[data-studio-project-enable-feature-page="smoke-feature-page"][data-studio-project-enable-feature-page-state="enabled"]');
        const featureStorage = await waitForStorageField(
          "workspaceExtensions",
          "meowdesk.workspace.enabledFeaturePages.v1",
          (value) => Array.isArray(value) && value.includes("smoke-feature-page")
        );

        await click('aside nav [data-next-route="workspace"]');
        await waitFor('[data-r2-workspace-route]');
        await openMeowBox();
        await waitFor('[data-meow-box-launch="feature:smoke-feature-page"][data-meow-box-launch-box="default"]');
        await click('[data-meow-box-launch="feature:smoke-feature-page"]', 300);
        const featureRoute = await waitFor('[data-r2-feature-page-route="smoke-feature-page"]');
        const featureFrame = await waitFor('[data-r2-feature-page-iframe="smoke-feature-page"]');
        const featureRouteId = activeRouteId();
        if (featureRouteId !== "feature:smoke-feature-page") {
          throw new Error("Feature page route did not activate through Meow Box: " + featureRouteId);
        }
        if (featureFrame.getAttribute("sandbox") !== "allow-scripts allow-forms") {
          throw new Error("Feature page iframe sandbox drifted: " + featureFrame.getAttribute("sandbox"));
        }
        if (document.querySelector('[data-meow-tab-route="feature:smoke-feature-page"]')) {
          throw new Error("Feature page route is box-only/ephemeral and must not create a running Meow Tab.");
        }
        if (document.querySelector('aside nav [data-next-route="feature:smoke-feature-page"]')) {
          throw new Error("Feature page should stay outside core sidebar nav until explicitly pinned.");
        }

        await openMeowBox();
        await click('[data-meow-box-create]');
        await waitFor('[data-meow-box-switch="box-2"]');
        await click('[data-meow-box-create]');
        await waitFor('[data-meow-box-switch="box-3"]');

        await switchBox("default");
        await dragRouteTo('[data-meow-box-launch="obsidian"]', '[data-meow-box-switch="box-2"]', "obsidian");
        await waitFor('[data-meow-box-active-id="box-2"] [data-meow-box-launch="obsidian"][data-meow-box-launch-box="box-2"]');
        const box2AfterObsidian = boxRoutes("box-2");
        if (!box2AfterObsidian.includes("obsidian") || box2AfterObsidian.includes("tasks")) {
          throw new Error("Box 2 should contain only the moved Obsidian route at this step: " + JSON.stringify(box2AfterObsidian));
        }
        await switchBox("default");
        if (document.querySelector('[data-meow-box-active-id="default"] [data-meow-box-launch="obsidian"]')) {
          throw new Error("Obsidian should leave the default Box after moving to Box 2.");
        }
        await dragRouteTo('[data-meow-box-launch="conversations"]', '[data-meow-box-switch="box-3"]', "conversations");
        await waitFor('[data-meow-box-active-id="box-3"] [data-meow-box-launch="conversations"][data-meow-box-launch-box="box-3"]');
        const box3AfterConversations = boxRoutes("box-3");
        if (!box3AfterConversations.includes("conversations") || box3AfterConversations.includes("obsidian")) {
          throw new Error("Box 3 should isolate Conversations from Obsidian: " + JSON.stringify(box3AfterConversations));
        }

        await switchBox("box-2");
        await click('[data-meow-box-delete="box-2"]', 260);
        await waitForCondition("Box 2 deleted", () => !document.querySelector('[data-meow-box-switch="box-2"]'));
        await switchBox("default");
        await waitFor('[data-meow-box-active-id="default"] [data-meow-box-launch="obsidian"][data-meow-box-launch-box="default"]');
        if (document.querySelector('[data-meow-box-active-id="default"] [data-meow-box-launch="conversations"]')) {
          throw new Error("Deleting Box 2 should not pull Box 3 conversations back to default.");
        }
        await switchBox("box-3");
        await waitFor('[data-meow-box-active-id="box-3"] [data-meow-box-launch="conversations"][data-meow-box-launch-box="box-3"]');
        const box3AfterDelete = boxRoutes("box-3");

        await switchBox("default");
        await dragRouteTo('[data-meow-box-launch="obsidian"]', '[data-product-shell-sidebar-pin-zone]', "obsidian");
        await waitFor('[data-product-shell-sidebar-pinned-item="obsidian"]');
        if (document.querySelector('[data-meow-box-active-id="default"] [data-meow-box-launch="obsidian"]')) {
          throw new Error("Pinned Obsidian should leave the default Box.");
        }
        const pinsStorage = await waitForStorageField(
          "productShell",
          "meowdesk.productShell.sidebarPins.v1",
          (value) => Array.isArray(value) && value.includes("obsidian")
        );
        await dragRouteTo('[data-product-shell-sidebar-pinned-item="obsidian"]', '[data-meow-box-trigger]', "obsidian");
        await waitFor('[data-meow-box-active-id="default"] [data-meow-box-launch="obsidian"][data-meow-box-launch-box="default"]');
        if (document.querySelector('[data-product-shell-sidebar-pinned-item="obsidian"]')) {
          throw new Error("Dragging pinned Obsidian back to Meow Box should remove it from the sidebar.");
        }
        await waitForStorageField(
          "productShell",
          "meowdesk.productShell.sidebarPins.v1",
          (value) => Array.isArray(value) && !value.includes("obsidian")
        );
        const boxesStorage = await waitForStorageField(
          "productShell",
          "meowdesk.productShell.boxes.v1",
          (value) => Array.isArray(value) && !value.some((box) => box?.id === "box-2") && value.some((box) => box?.id === "box-3" && Array.isArray(box.itemRouteIds) && box.itemRouteIds.includes("conversations"))
        );
        assertNoVsLiveResidue("visual recovery sixth batch");

        return {
          scenario: "visual-recovery-sixth-batch",
          featurePage: {
            route: featureRoute.getAttribute("data-r2-feature-page-route"),
            frame: featureFrame.getAttribute("data-r2-feature-page-iframe"),
            sandbox: featureFrame.getAttribute("sandbox"),
            storage: featureStorage.value
          },
          boxMatrix: {
            box2AfterObsidian,
            box3AfterConversations,
            defaultAfterDelete: boxRoutes("default"),
            box3AfterDelete,
            pinsBeforeReturn: pinsStorage.value,
            boxesStorage: boxesStorage.value
          },
          owners: {
            vsVisual: document.documentElement.dataset.vsVisual || "",
            hasLiveClass: document.documentElement.classList.contains("vs-live-app-mode"),
            meowBoxOwner: document.querySelector('[data-meow-box-menu]')?.getAttribute("data-meow-box-owner") || ""
          },
          rects: {
            featureFrame: rectDebug(featureFrame)
          }
        };
      })()
    `, true);
  }
}

async function runVisualRecoveryEighthBatchScenario(win, dependencies = {}, scenario) {
  if (scenario !== "visual-recovery-eighth-batch") return undefined;

  const pageEval = (source) => win.webContents.executeJavaScript(`(async () => {${source}})()`, true);
  const moveMouse = async (rect) => {
    await win.webContents.sendInputEvent({
      type: "mouseMove",
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
      movementX: 0,
      movementY: 0
    });
    await new Promise((resolve) => setTimeout(resolve, 140));
  };
  let debuggerAttached = false;
  const debuggerCommand = async (method, params = {}) => {
    if (!debuggerAttached) {
      try {
        win.webContents.debugger.attach("1.3");
      } catch (error) {
        if (!String(error?.message || error).includes("already attached")) {
          throw error;
        }
      }
      debuggerAttached = true;
      await win.webContents.debugger.sendCommand("DOM.enable");
      await win.webContents.debugger.sendCommand("CSS.enable");
    }
    return win.webContents.debugger.sendCommand(method, params);
  };
  const forceHover = async (selector) => {
    const { root } = await debuggerCommand("DOM.getDocument", { depth: 1 });
    const { nodeId } = await debuggerCommand("DOM.querySelector", {
      nodeId: root.nodeId,
      selector
    });
    if (!nodeId) {
      throw new Error("Unable to force hover; selector not found: " + selector);
    }
    await debuggerCommand("CSS.forcePseudoState", {
      nodeId,
      forcedPseudoClasses: ["hover"]
    });
    await new Promise((resolve) => setTimeout(resolve, 560));
    return nodeId;
  };

  const setup = await pageEval(`
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
    const click = async (selector, wait = 180) => {
      const element = await waitFor(selector);
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      element.click();
      await delay(wait);
      return element;
    };
    const rectDebug = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };
    const parseColor = (value) => {
      const text = String(value || "").trim();
      const srgbMatch = text.match(/^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)$/);
      if (srgbMatch) {
        return {
          r: Number(srgbMatch[1]) * 255,
          g: Number(srgbMatch[2]) * 255,
          b: Number(srgbMatch[3]) * 255,
          a: Number.isFinite(Number(srgbMatch[4])) ? Number(srgbMatch[4]) : 1
        };
      }
      const match = text.match(/rgba?\\(([^)]+)\\)/);
      if (!match) return null;
      const parts = match[1].replace("/", " ").split(/[\\s,]+/).filter(Boolean).map((part) => Number.parseFloat(part.trim()));
      if (parts.length < 3 || parts.some((part, index) => index < 3 && !Number.isFinite(part))) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
    };
    const alphaOf = (value) => parseColor(value)?.a ?? 1;
    const visibleRect = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
    };
    const assertNoVsLiveResidue = (label) => {
      const residue = document.querySelector([
        ".vs-picker-dialog-mouse",
        "[data-vs-picker-live]",
        "[data-vs-meow-box-ready]",
        "[data-vs-box-drop-active]",
        "[data-vs-top-surface-tag]",
        ".vs-top-surface-tag",
        ".vs-live-app-mode"
      ].join(","));
      if (residue) {
        throw new Error(label + " should not expose live VS owner residue: " + JSON.stringify({
          tagName: residue.tagName,
          className: String(residue.className || ""),
          dataset: { ...residue.dataset },
          html: residue.outerHTML.slice(0, 520)
        }));
      }
    };

    await waitFor('[data-workbench-bridge-status="ready"]');
    await click('aside nav [data-next-route="studio"]');
    await waitFor('[data-studio-route]');
    await click('aside nav [data-next-route="workspace"]');
    await waitFor('[data-r2-workspace-route]');
    await click('aside nav [data-next-route="studio"]');
    await waitFor('[data-studio-route]');
    await click('aside nav [data-next-route="workspace"]');
    await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');

    const meowBoxTrigger = await waitFor('[data-meow-box-trigger][data-meow-box-owner="product-shell"][data-meow-box-family="product-shell-meow-box"]');
    const triggerRectBeforeOpen = rectDebug(meowBoxTrigger);
    await click('[data-meow-box-trigger]', 180);
    const meowBoxMenu = await waitFor('[data-meow-box-menu][data-meow-box-owner="product-shell"][data-meow-box-family="product-shell-meow-box"][data-meow-box-ready="true"]');
    const workflowLaunch = await waitFor('[data-meow-box-launch="obsidian"][data-meow-box-launch-draggable="true"]');
    const workflowPin = await waitFor('[data-meow-box-pin="obsidian"]');
    const defaultSwitch = await waitFor('[data-meow-box-switch="default"][data-meow-box-switch-active="true"]');
    await click('[data-meow-box-create]', 180);
    const box2Switch = await waitFor('[data-meow-box-switch="box-2"]');
    const selectedBox = await waitFor('[data-meow-box-id="default"]');
    const restingPinZone = document.querySelector('[data-product-shell-sidebar-pin-zone]');
    if (restingPinZone) {
      throw new Error("Sidebar pin zone should not appear as a resting action button before a route drag starts.");
    }
    const inactiveStudioTag = await waitFor('[data-meow-top-surface-tag][data-meow-top-surface-route="studio"] [data-meow-top-surface-main]');
    const activeWorkspaceTag = await waitFor('[data-meow-top-surface-tag][data-meow-top-surface-route="workspace"] [data-meow-top-surface-main][data-meow-tab-active="true"]');
    const card = await waitFor('[data-r2-workspace-task-card], [data-r2-workspace-task-empty]');

    const menuStyle = getComputedStyle(meowBoxMenu);
    const menuRect = rectDebug(meowBoxMenu);
    if (
      !visibleRect(meowBoxMenu) ||
      menuRect.width < 260 ||
      alphaOf(menuStyle.backgroundColor) < 0.94 ||
      meowBoxMenu.getAttribute("data-meow-box-menu-state") !== "open" ||
      meowBoxMenu.getAttribute("data-meow-box-ready") !== "true"
    ) {
      throw new Error("Meow Box menu should stay solid, readable, and owned by product-shell-meow-box: " + JSON.stringify({
        menuRect,
        backgroundColor: menuStyle.backgroundColor,
        backgroundImage: menuStyle.backgroundImage,
        opacity: menuStyle.opacity,
        pointerEvents: menuStyle.pointerEvents,
        owner: meowBoxMenu.getAttribute("data-meow-box-owner"),
        family: meowBoxMenu.getAttribute("data-meow-box-family"),
        state: meowBoxMenu.getAttribute("data-meow-box-menu-state"),
        ready: meowBoxMenu.getAttribute("data-meow-box-ready")
      }));
    }
    assertNoVsLiveResidue("visual recovery eighth setup");

    return {
      triggerRectBeforeOpen,
      hoverTargets: {
        trigger: rectDebug(meowBoxTrigger),
        studioTag: rectDebug(inactiveStudioTag),
        workflowLaunch: rectDebug(workflowLaunch),
        workflowPin: rectDebug(workflowPin),
        box2Switch: rectDebug(box2Switch),
        card: rectDebug(card)
      },
      menu: {
        rect: menuRect,
        backgroundColor: menuStyle.backgroundColor,
        boxShadow: menuStyle.boxShadow
      },
      dropTargets: {
        box2Switch: rectDebug(box2Switch),
        selectedBox: rectDebug(selectedBox)
      },
      activeWorkspaceTag: {
        rect: rectDebug(activeWorkspaceTag),
        boxShadow: getComputedStyle(activeWorkspaceTag).boxShadow
      }
    };
  `);

  await moveMouse({ left: 1, top: 1, width: 1, height: 1 });
  await moveMouse(setup.hoverTargets.trigger);
  await forceHover('[data-meow-box-trigger]');
  const triggerHover = await pageEval(`
    const trigger = document.querySelector('[data-meow-box-trigger]');
    const style = getComputedStyle(trigger);
    const before = getComputedStyle(trigger, "::before");
    const hasBlue = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("0 140 255") || text.includes("0, 140, 255") || text.includes("rgb(0 140 255") || text.includes("rgb(0, 140, 255)");
    };
    const matchedRules = Array.from(document.styleSheets).flatMap((sheet) => {
      let rules = [];
      try {
        rules = Array.from(sheet.cssRules || []);
      } catch {
        return [];
      }
      return rules
        .filter((rule) => rule?.selectorText && rule.style && (rule.style.boxShadow || rule.style.borderColor || rule.style.background))
        .filter((rule) => {
          try {
            return trigger.matches(rule.selectorText);
          } catch {
            return false;
          }
        })
        .map((rule) => ({
          selector: rule.selectorText,
          borderColor: rule.style.borderColor,
          background: rule.style.background,
          boxShadow: rule.style.boxShadow,
          boxShadowPriority: rule.style.getPropertyPriority("box-shadow"),
          borderPriority: rule.style.getPropertyPriority("border-color")
        }));
    });
    const rect = trigger.getBoundingClientRect();
    if (
      trigger.getAttribute("data-meow-box-open") !== "true" ||
      style.boxShadow === "none" ||
      !hasBlue(style.boxShadow + " " + style.borderColor) ||
      Number(before.opacity || 0) < 0.85 ||
      Math.round(rect.width) !== ${setup.triggerRectBeforeOpen.width} ||
      Math.round(rect.height) !== ${setup.triggerRectBeforeOpen.height}
    ) {
      throw new Error("Meow Box trigger hover/open state should keep blue glow without resizing: " + JSON.stringify({
        open: trigger.getAttribute("data-meow-box-open"),
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        beforeOpacity: before.opacity,
        rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
        beforeOpenRect: ${JSON.stringify(setup.triggerRectBeforeOpen)},
        matchedRules,
        className: String(trigger.className || ""),
        dataset: { ...trigger.dataset }
      }));
    }
    return {
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      beforeOpacity: before.opacity,
      rect: { width: Math.round(rect.width), height: Math.round(rect.height) }
    };
  `);

  await moveMouse(setup.hoverTargets.studioTag);
  await forceHover('[data-meow-top-surface-tag][data-meow-top-surface-route="studio"] [data-meow-top-surface-main]');
  const topSurfaceHover = await pageEval(`
    const tag = document.querySelector('[data-meow-top-surface-tag][data-meow-top-surface-route="studio"]');
    const main = tag?.querySelector('[data-meow-top-surface-main]');
    const activeMain = document.querySelector('[data-meow-top-surface-main][data-meow-tab-active="true"]');
    if (main) {
      main.style.transition = "none";
      main.offsetHeight;
    }
    const style = main ? getComputedStyle(main) : null;
    const activeStyle = activeMain ? getComputedStyle(activeMain) : null;
    const rect = main?.getBoundingClientRect();
    const hasGreen = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("55 255 139") || text.includes("55, 255, 139") || text.includes("rgb(55 255 139") || text.includes("rgb(55, 255, 139)");
    };
    const alphaOf = (value) => {
      const text = String(value || "").trim();
      const srgbMatch = text.match(/^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)$/);
      if (srgbMatch) return Number.isFinite(Number(srgbMatch[4])) ? Number(srgbMatch[4]) : 1;
      const match = text.match(/rgba?\\(([^)]+)\\)/);
      if (!match) return text === "transparent" ? 0 : 1;
      const parts = match[1].replace("/", " ").split(/[\\s,]+/).filter(Boolean).map((part) => Number.parseFloat(part.trim()));
      return Number.isFinite(parts[3]) ? parts[3] : 1;
    };
    const matchedRules = main ? Array.from(document.styleSheets).flatMap((sheet) => {
      let rules = [];
      try {
        rules = Array.from(sheet.cssRules || []);
      } catch {
        return [];
      }
      return rules
        .filter((rule) => rule?.selectorText && rule.style && (rule.style.boxShadow || rule.style.borderColor || rule.style.background))
        .filter((rule) => {
          try {
            return main.matches(rule.selectorText);
          } catch {
            return false;
          }
        })
        .map((rule) => ({
          selector: rule.selectorText,
          borderColor: rule.style.borderColor,
          background: rule.style.background,
          boxShadow: rule.style.boxShadow,
          boxShadowPriority: rule.style.getPropertyPriority("box-shadow"),
          borderPriority: rule.style.getPropertyPriority("border-color")
        }));
    }) : [];
    const hoverFillAlpha = style ? alphaOf(style.backgroundColor) : 0;
    const activeFillAlpha = activeStyle ? alphaOf(activeStyle.backgroundColor) : 0;
    if (
      !tag ||
      !main ||
      !activeMain ||
      tag.getAttribute("data-product-shell-top-surface-closable") !== "true" ||
      tag.getAttribute("data-product-shell-top-surface-close-mode") !== "detach-only" ||
      !tag.querySelector('[data-meow-top-surface-close], [data-product-shell-top-surface-close]') ||
      tag.querySelector('[data-vs-top-surface-close], .vs-top-surface-close') ||
      Math.round(rect.width) !== 38 ||
      Math.round(rect.height) !== 38 ||
      !style ||
      !hasGreen(style.boxShadow + " " + style.borderColor) ||
      !hasGreen(activeStyle.boxShadow + " " + activeStyle.borderColor) ||
      hoverFillAlpha >= activeFillAlpha - 0.32 ||
      hoverFillAlpha > 0.36 ||
      activeFillAlpha < 0.62
    ) {
      throw new Error("Inactive top surface tag hover should recover green glow without becoming the active solid tag: " + JSON.stringify({
        tagOuter: tag?.outerHTML?.slice(0, 520) || "",
        rect: rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null,
        backgroundColor: style?.backgroundColor || "",
        boxShadow: style?.boxShadow || "",
        borderColor: style?.borderColor || "",
        activeBackgroundColor: activeStyle?.backgroundColor || "",
        activeBoxShadow: activeStyle?.boxShadow || "",
        activeBorderColor: activeStyle?.borderColor || "",
        hoverFillAlpha,
        activeFillAlpha,
        closable: tag?.getAttribute("data-product-shell-top-surface-closable") || "",
        closeMode: tag?.getAttribute("data-product-shell-top-surface-close-mode") || "",
        closePresent: Boolean(tag?.querySelector('[data-meow-top-surface-close], [data-vs-top-surface-close], .vs-top-surface-close')),
        matchedRules
      }));
    }
    return {
      rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      hoverFillAlpha,
      activeBackgroundColor: activeStyle.backgroundColor,
      activeFillAlpha
    };
  `);

  await moveMouse(setup.hoverTargets.workflowLaunch);
  await forceHover('[data-meow-box-launch="obsidian"]');
  const launchHover = await pageEval(`
    const launch = document.querySelector('[data-meow-box-launch="obsidian"]');
    const style = getComputedStyle(launch);
    const hasPrimaryGlow = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("90% 60%") || text.includes("0 140 255") || text.includes("0, 140, 255") || text.includes("96 165 250") || text.includes("96, 165, 250") || text.includes("rgb");
    };
    if (
      !launch.classList.contains("meowdesk-meow-box-launch") ||
      launch.getAttribute("data-meow-box-launch-draggable") !== "true" ||
      style.boxShadow === "none" ||
      !hasPrimaryGlow(style.boxShadow + " " + style.borderColor)
    ) {
      throw new Error("Meow Box launch hover should expose the shared item glow and remain draggable: " + JSON.stringify({
        className: String(launch.className || ""),
        draggable: launch.getAttribute("data-meow-box-launch-draggable"),
        borderColor: style.borderColor,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow
      }));
    }
    return {
      draggable: launch.getAttribute("data-meow-box-launch-draggable"),
      borderColor: style.borderColor,
      boxShadow: style.boxShadow
    };
  `);

  await moveMouse(setup.hoverTargets.workflowPin);
  await forceHover('[data-meow-box-pin="obsidian"]');
  const pinHover = await pageEval(`
    const pin = document.querySelector('[data-meow-box-pin="obsidian"]');
    const style = getComputedStyle(pin);
    if (
      !pin.classList.contains("meowdesk-meow-box-mini-action") ||
      style.boxShadow === "none" ||
      style.borderColor === "rgba(0, 0, 0, 0)" ||
      style.borderColor === "transparent"
    ) {
      throw new Error("Meow Box pin hover should use the same mini-action glow family: " + JSON.stringify({
        className: String(pin.className || ""),
        borderColor: style.borderColor,
        boxShadow: style.boxShadow
      }));
    }
    return { borderColor: style.borderColor, boxShadow: style.boxShadow };
  `);

  const cardIdle = await pageEval(`
    const card = document.querySelector('[data-r2-workspace-task-card], [data-r2-workspace-task-empty], [data-r2-workspace-pane]');
    const before = getComputedStyle(card, "::before");
    const after = getComputedStyle(card, "::after");
    const opacityValue = (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      beforeAnimation: before.animationName,
      afterAnimation: after.animationName,
      beforeOpacity: opacityValue(before.opacity),
      afterOpacity: opacityValue(after.opacity),
      beforeShadow: before.boxShadow,
      afterShadow: after.boxShadow
    };
  `);
  await moveMouse(setup.hoverTargets.card);
  await forceHover('[data-r2-workspace-task-card], [data-r2-workspace-task-empty]');
  const cardHover = await pageEval(`
    const card = document.querySelector('[data-r2-workspace-task-card], [data-r2-workspace-task-empty]');
    const before = getComputedStyle(card, "::before");
    const after = getComputedStyle(card, "::after");
    const hasAnimation = (name, expected) => String(name || "").split(",").map((item) => item.trim()).includes(expected);
    const hasGlow = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("255, 255, 255") || text.includes("255 255 255") || text.includes("rgba");
    };
    const opacityValue = (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const beforeOpacity = opacityValue(before.opacity);
    const afterOpacity = opacityValue(after.opacity);
    if (
      !hasAnimation(before.animationName, "meowdesk-card-ambient-breath") ||
      !hasAnimation(after.animationName, "meowdesk-card-ambient-inner-breath") ||
      beforeOpacity + 0.01 < ${JSON.stringify(cardIdle.beforeOpacity)} ||
      afterOpacity + 0.01 < ${JSON.stringify(cardIdle.afterOpacity)} ||
      !hasGlow(before.boxShadow) ||
      !hasGlow(after.boxShadow)
    ) {
      throw new Error("Shared card/workspace surface hover should keep a continuous ambient breathing timeline without dimming first: " + JSON.stringify({
        selector: card.getAttribute("data-r2-workspace-task-card") ? "task-card" : card.getAttribute("data-r2-workspace-task-empty") ? "task-empty" : "workspace-pane",
        idle: ${JSON.stringify(cardIdle)},
        beforeAnimation: before.animationName,
        afterAnimation: after.animationName,
        beforeOpacity,
        afterOpacity,
        beforeShadow: before.boxShadow,
        afterShadow: after.boxShadow
      }));
    }
    return {
      beforeAnimation: before.animationName,
      afterAnimation: after.animationName,
      idle: ${JSON.stringify(cardIdle)},
      beforeOpacity,
      afterOpacity
    };
  `);

  const dropFeedback = await pageEval(`
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
    const hasBlue = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("0 140 255") || text.includes("0, 140, 255") || text.includes("rgb(0 140 255") || text.includes("rgb(0, 140, 255)");
    };
    const dragOverTarget = async (source, target, routeId) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.effectAllowed = "move";
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
      if (!dataTransfer.getData("application/x-meowdesk-product-shell-route")) {
        dataTransfer.setData("application/x-meowdesk-product-shell-route", routeId);
        dataTransfer.setData("text/plain", routeId);
      }
      target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      await delay(180);
      return dataTransfer;
    };
    const dragOverSelector = async (source, targetSelector, routeId) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.effectAllowed = "move";
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
      if (!dataTransfer.getData("application/x-meowdesk-product-shell-route")) {
        dataTransfer.setData("application/x-meowdesk-product-shell-route", routeId);
        dataTransfer.setData("text/plain", routeId);
      }
      const target = await waitFor(targetSelector);
      target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      await delay(180);
      return { dataTransfer, target };
    };
    const assertDropGlow = (element, attr, label) => {
      const style = getComputedStyle(element);
      if (element.getAttribute(attr) !== "true" || style.boxShadow === "none" || !hasBlue(style.boxShadow + " " + style.borderColor)) {
        throw new Error(label + " should expose blue drop-active glow while dragging: " + JSON.stringify({
          attr,
          attrValue: element.getAttribute(attr),
          className: String(element.className || ""),
          borderColor: style.borderColor,
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          dataset: { ...element.dataset }
        }));
      }
      return {
        borderColor: style.borderColor,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        attrValue: element.getAttribute(attr)
      };
    };

    const workflowLaunch = await waitFor('[data-meow-box-launch="obsidian"]');
    const box2Switch = await waitFor('[data-meow-box-switch="box-2"]');
    const selectedBox = await waitFor('[data-meow-box-id="default"]');
    const trigger = await waitFor('[data-meow-box-trigger]');

    let transfer = await dragOverTarget(workflowLaunch, box2Switch, "obsidian");
    const box2 = assertDropGlow(box2Switch, "data-meow-box-drop-active", "Meow Box switch");
    workflowLaunch.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await delay(120);

    transfer = await dragOverTarget(workflowLaunch, selectedBox, "obsidian");
    const boxBody = assertDropGlow(selectedBox, "data-meow-box-drop-active", "Meow Box body");
    workflowLaunch.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await delay(120);

    const sidebarDrag = await dragOverSelector(workflowLaunch, '[data-product-shell-sidebar-pin-zone]', "obsidian");
    const sidebar = assertDropGlow(sidebarDrag.target, "data-product-shell-sidebar-pin-zone-active", "Sidebar pin zone");
    workflowLaunch.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: sidebarDrag.dataTransfer }));
    await delay(120);

    transfer = await dragOverTarget(workflowLaunch, trigger, "obsidian");
    const triggerDrop = assertDropGlow(trigger, "data-meow-box-drop-active", "Meow Box trigger");
    workflowLaunch.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: transfer }));

    return { box2, boxBody, sidebar, triggerDrop };
  `);

  const finalOwnerCheck = await pageEval(`
    const residue = document.querySelector([
      ".vs-picker-dialog-mouse",
      "[data-vs-picker-live]",
      "[data-vs-meow-box-ready]",
      "[data-vs-box-drop-active]",
      "[data-vs-top-surface-tag]",
      ".vs-top-surface-tag",
      ".vs-live-app-mode"
    ].join(","));
    if (residue) {
      throw new Error("visual recovery eighth batch should not revive live VS residue: " + residue.outerHTML.slice(0, 520));
    }
    return {
      vsVisual: document.documentElement.dataset.vsVisual || "",
      hasLiveClass: document.documentElement.classList.contains("vs-live-app-mode"),
      meowBoxOwner: document.querySelector('[data-meow-box-menu]')?.getAttribute("data-meow-box-owner") || "",
      meowBoxFamily: document.querySelector('[data-meow-box-menu]')?.getAttribute("data-meow-box-family") || "",
      topSurfaceFamily: document.querySelector('[data-meow-top-surface-rail]')?.getAttribute("data-meow-top-surface-family") || ""
    };
  `);

  return {
    scenario: "visual-recovery-eighth-batch",
    setup,
    hover: {
      trigger: triggerHover,
      topSurface: topSurfaceHover,
      launch: launchHover,
      pin: pinHover,
      card: cardHover
    },
    dropFeedback,
    owners: finalOwnerCheck
  };
}

async function runVisualRecoveryNinthBatchScenario(win, dependencies = {}, scenario) {
  if (scenario !== "visual-recovery-ninth-batch") return undefined;

  const pageEval = (source) => win.webContents.executeJavaScript(`(async () => {${source}})()`, true);
  let debuggerAttached = false;
  const debuggerCommand = async (method, params = {}) => {
    if (!debuggerAttached) {
      try {
        win.webContents.debugger.attach("1.3");
      } catch (error) {
        if (!String(error?.message || error).includes("already attached")) {
          throw error;
        }
      }
      debuggerAttached = true;
      await win.webContents.debugger.sendCommand("DOM.enable");
      await win.webContents.debugger.sendCommand("CSS.enable");
    }
    return win.webContents.debugger.sendCommand(method, params);
  };
  const forceHover = async (selector) => {
    const { root } = await debuggerCommand("DOM.getDocument", { depth: 1 });
    const { nodeId } = await debuggerCommand("DOM.querySelector", {
      nodeId: root.nodeId,
      selector
    });
    if (!nodeId) {
      throw new Error("Unable to force hover; selector not found: " + selector);
    }
    await debuggerCommand("CSS.forcePseudoState", {
      nodeId,
      forcedPseudoClasses: ["hover"]
    });
    await new Promise((resolve) => setTimeout(resolve, 420));
    return nodeId;
  };

  const workspaceEvidence = await pageEval(`
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
    const click = async (selector, wait = 180) => {
      const element = await waitFor(selector);
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      element.click();
      await delay(wait);
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
    const numberFromCss = (value) => {
      const parsed = Number.parseFloat(String(value || "0"));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const isTransparent = (value) => {
      const text = String(value || "").replace(/\s+/g, " ").toLowerCase();
      return !text || text === "transparent" || text === "rgba(0, 0, 0, 0)" || text === "rgba(0 0 0 / 0)" || text === "rgb(0 0 0 / 0)";
    };
    const hasAnimation = (name, expected) => String(name || "").split(",").map((item) => item.trim()).includes(expected);
    const hasBlue = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("0 140 255") || text.includes("0, 140, 255") || text.includes("rgb(0 140 255") || text.includes("rgb(0, 140, 255)") || text.includes("96 165 250") || text.includes("96, 165, 250");
    };
    const hasGreen = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("55 255 139") || text.includes("55, 255, 139") || text.includes("rgb(55 255 139") || text.includes("rgb(55, 255, 139)");
    };
    const waitForTopRailMotion = async (titleElement, label, timeout = 1600) => {
      const startedAt = Date.now();
      let lastDebug = null;
      while (Date.now() - startedAt <= timeout) {
        const rail = document.querySelector('[data-top-nav-running-surfaces] [data-product-shell-top-surface-rail]');
        if (rail) {
          const style = getComputedStyle(rail);
          lastDebug = {
            motion: rail.getAttribute("data-top-nav-surface-motion"),
            transform: style.transform,
            rail: rectDebug(rail),
            title: rectDebug(titleElement)
          };
          if (lastDebug.motion === "magnet" && style.transform !== "none") return { rail, sample: lastDebug };
        }
        await delay(25);
      }
      throw new Error(label + " should animate the real top-surface rail with Meowdesk-owned magnet motion: " + JSON.stringify(lastDebug));
    };
    const assertTopRailSettlesAfterTitle = async (titleElement, rail, label) => {
      await delay(1500);
      const titleRect = titleElement.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const gap = railRect.left - titleRect.right;
      if (gap < 4) {
        throw new Error(label + " should settle without overlapping the title: " + JSON.stringify({
          title: rectDebug(titleElement),
          rail: rectDebug(rail),
          gap: Math.round(gap * 100) / 100,
          motion: rail.getAttribute("data-top-nav-surface-motion"),
          transform: getComputedStyle(rail).transform
        }));
      }
      return { title: rectDebug(titleElement), rail: rectDebug(rail), gap: Math.round(gap * 100) / 100 };
    };
    const waitForBlueActionSurface = async (element, label) => {
      const deadline = Date.now() + 1200;
      let snapshot = null;
      while (Date.now() < deadline) {
        const style = getComputedStyle(element);
        const before = getComputedStyle(element, "::before");
        const after = getComputedStyle(element, "::after");
        snapshot = {
          label,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          boxShadow: style.boxShadow,
          beforeBackground: before.backgroundColor,
          beforeBoxShadow: before.boxShadow,
          afterContent: after.content,
          afterAnimation: after.animationName
        };
        if (
          !isTransparent(snapshot.backgroundColor) &&
          hasBlue(snapshot.backgroundColor + " " + snapshot.borderColor) &&
          hasBlue(snapshot.boxShadow + " " + snapshot.beforeBackground) &&
          snapshot.boxShadow !== "none" &&
          snapshot.afterContent !== "none" &&
          snapshot.afterAnimation !== "none"
        ) {
          return snapshot;
        }
        await delay(60);
      }
      throw new Error(label + " did not settle into blue action-surface glow: " + JSON.stringify(snapshot));
    };
    const visibleRect = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
    };
    const assertNoVsResidue = (label) => {
      const residue = document.querySelector([
        ".vs-energy-title",
        ".vs-title-scan-bar",
        ".hover-text",
        ".vs-picker-dialog-mouse",
        "[data-vs-picker-live]",
        "[data-vs-meow-box-ready]",
        "[data-vs-box-drop-active]",
        "[data-vs-top-surface-tag]",
        ".vs-top-surface-tag",
        ".vs-live-app-mode",
        "[data-vs-visual-stage]",
        ".vs-visual-badge",
        "[data-vs-surface-close-dialog]"
      ].join(","));
      if (residue) {
        throw new Error(label + " should not expose live VS residue: " + JSON.stringify({
          tagName: residue.tagName,
          className: String(residue.className || ""),
          dataset: { ...residue.dataset },
          html: residue.outerHTML.slice(0, 520)
        }));
      }
    };

    await waitFor('[data-workbench-bridge-status="ready"]');
    await click('aside nav [data-next-route="workspace"]');
    await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
    await click('aside nav [data-next-route="studio"]');
    await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:studio"]');
    await click('aside nav [data-next-route="workspace"]');
    await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
    await waitFor('[data-r2-workspace-route]');

    const title = await waitFor('[data-top-nav-title][data-top-nav-title-visual="meowdesk-scan"]');
    const scanText = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-scan-text');
    const scanBar = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-scan-bar');
    const runningSurfaces = await waitFor('[data-top-nav-running-surfaces]');
    const titleStyle = getComputedStyle(title);
    const scanTextStyle = getComputedStyle(scanText);
    const scanBarStyle = getComputedStyle(scanBar);
    const railMotion = await waitForTopRailMotion(title, "Visual recovery ninth TopNav");
    if (
      titleStyle.position !== "relative" ||
      !hasAnimation(scanTextStyle.animationName, "meowdesk-title-scan-reveal") ||
      !hasAnimation(scanBarStyle.animationName, "meowdesk-title-scan-bar") ||
      runningSurfaces.getAttribute("data-top-nav-surface-push") !== "true" ||
      scanTextStyle.transform !== "none" ||
      String(scanTextStyle.clipPath || "").includes("none") ||
      !hasGreen(scanBarStyle.boxShadow + " " + scanTextStyle.textShadow)
    ) {
      throw new Error("Visual recovery ledger expects Meowdesk-owned clipped title scan and measured top surface push: " + JSON.stringify({
        titlePosition: titleStyle.position,
        scanTextAnimation: scanTextStyle.animationName,
        scanTextClipPath: scanTextStyle.clipPath,
        scanTextTransform: scanTextStyle.transform,
        scanBarAnimation: scanBarStyle.animationName,
        scanBarShadow: scanBarStyle.boxShadow,
        runningSurfacePush: runningSurfaces.getAttribute("data-top-nav-surface-push"),
        railMotion: railMotion.sample,
        titleText: title.textContent.trim(),
        titleRect: rectDebug(title)
      }));
    }
    const railSettlement = await assertTopRailSettlesAfterTitle(title, railMotion.rail, "Visual recovery ninth TopNav");

    const activeSidebar = await waitFor('aside .meowdesk-sidebar-route[data-next-route="workspace"][aria-current="page"]');
    const activeSidebarGlow = await waitForBlueActionSurface(activeSidebar, "Visual recovery ledger active sidebar");

    const trigger = await click('[data-meow-box-trigger]', 180);
    const menu = await waitFor('[data-meow-box-menu][data-meow-box-owner="product-shell"][data-meow-box-family="product-shell-meow-box"][data-meow-box-ready="true"]');
    const workflowLaunch = await waitFor('[data-meow-box-launch="obsidian"][data-meow-box-launch-draggable="true"]');
    const menuStyle = getComputedStyle(menu);
    if (
      trigger.getAttribute("data-meow-box-open") !== "true" ||
      !visibleRect(menu) ||
      menuStyle.pointerEvents === "none" ||
      Number(menuStyle.opacity || 1) < 0.9 ||
      workflowLaunch.getAttribute("data-meow-box-launch") !== "obsidian"
    ) {
      throw new Error("Visual recovery ledger expects Meow Box to be open, solid, and box-owned: " + JSON.stringify({
        triggerOpen: trigger.getAttribute("data-meow-box-open"),
        menuRect: rectDebug(menu),
        backgroundColor: menuStyle.backgroundColor,
        opacity: menuStyle.opacity,
        pointerEvents: menuStyle.pointerEvents,
        workflowLaunch: workflowLaunch.getAttribute("data-meow-box-launch"),
        text: menu.textContent.trim()
      }));
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.effectAllowed = "move";
    workflowLaunch.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
    if (!dataTransfer.getData("application/x-meowdesk-product-shell-route")) {
      dataTransfer.setData("application/x-meowdesk-product-shell-route", "obsidian");
      dataTransfer.setData("text/plain", "obsidian");
    }
    const pinZone = await waitFor('[data-product-shell-sidebar-pin-zone]');
    pinZone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer }));
    pinZone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
    await delay(220);
    const pinZoneStyle = getComputedStyle(pinZone);
    if (
      pinZone.getAttribute("data-product-shell-sidebar-pin-zone-active") !== "true" ||
      pinZoneStyle.boxShadow === "none" ||
      !hasBlue(pinZoneStyle.boxShadow + " " + pinZoneStyle.borderColor)
    ) {
      throw new Error("Visual recovery ledger expects sidebar pin zone drop glow: " + JSON.stringify({
        active: pinZone.getAttribute("data-product-shell-sidebar-pin-zone-active"),
        boxShadow: pinZoneStyle.boxShadow,
        borderColor: pinZoneStyle.borderColor,
        opacity: pinZoneStyle.opacity
      }));
    }
    workflowLaunch.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer }));
    await delay(100);

    await click('[data-r2-workspace-slot-button="1"]', 180);
    await waitFor('[data-r2-workspace-panes][data-r2-workspace-pane-count="1"]');
    await click('[data-r2-workspace-slot-button="2"]', 220);
    const newPane = await waitFor('[data-r2-workspace-pane="blank-2"][data-r2-workspace-pane-new="true"]');
    const newPaneStyle = getComputedStyle(newPane);
    if (!hasAnimation(newPaneStyle.animationName, "meowdesk-workspace-pane-enter")) {
      throw new Error("Visual recovery ledger expects Workspace added pane enter motion: " + JSON.stringify({
        animationName: newPaneStyle.animationName,
        rect: rectDebug(newPane)
      }));
    }

    await click('[data-r2-workspace-configure-pane="blank-2"]', 180);
    await waitFor('[data-r2-workspace-config-dialog]');
    await waitFor('[data-r2-workspace-config-tool="smoke-terminal"]');
    await click('[data-r2-workspace-config-tool="smoke-terminal"]', 240);
    const configuredPane = await waitFor('[data-r2-workspace-pane="blank-2"][data-r2-workspace-pane-configured-pulse="true"][data-r2-workspace-pane-kind="terminal"]');
    const configuredPaneStyle = getComputedStyle(configuredPane);
    const configuredBefore = getComputedStyle(configuredPane, "::before");
    const configuredAfter = getComputedStyle(configuredPane, "::after");
    if (
      !hasAnimation(configuredPaneStyle.animationName, "meowdesk-workspace-pane-configured") ||
      !hasAnimation(configuredBefore.animationName, "meowdesk-card-breath") ||
      !hasAnimation(configuredAfter.animationName, "meowdesk-card-inner-breath") ||
      configuredBefore.boxShadow === "none" ||
      configuredAfter.boxShadow === "none"
    ) {
      throw new Error("Visual recovery ledger expects configured pane pulse and shared card breath: " + JSON.stringify({
        paneAnimation: configuredPaneStyle.animationName,
        beforeAnimation: configuredBefore.animationName,
        afterAnimation: configuredAfter.animationName,
        beforeShadow: configuredBefore.boxShadow,
        afterShadow: configuredAfter.boxShadow,
        rect: rectDebug(configuredPane)
      }));
    }

    const studioTagMain = await waitFor('[data-meow-top-surface-tag][data-meow-top-surface-route="studio"] [data-meow-top-surface-main]');
    const studioTag = studioTagMain.closest('[data-meow-top-surface-tag]');
    if (
      !studioTag ||
      studioTag.getAttribute("data-product-shell-top-surface-closable") !== "true" ||
      studioTag.getAttribute("data-product-shell-top-surface-close-mode") !== "detach-only" ||
      !studioTag.querySelector('[data-meow-top-surface-close], [data-product-shell-top-surface-close]') ||
      studioTag.querySelector('[data-vs-top-surface-close], .vs-top-surface-close') ||
      rectDebug(studioTagMain).width !== 38 ||
      rectDebug(studioTagMain).height !== 38
    ) {
      throw new Error("Visual recovery ledger expects Workspace/Studio top tags to be 38x38 and closable under Meowdesk owner: " + JSON.stringify({
        tagHtml: studioTag?.outerHTML?.slice(0, 520) || "",
        rect: studioTagMain ? rectDebug(studioTagMain) : null
      }));
    }

    const workspaceOwner = await waitFor('[data-r2-workspace-route] [data-workspace-right-sidebar-owner]');
    if (
      document.querySelectorAll('[data-r2-workspace-route] [data-workspace-right-sidebar-owner]').length !== 1 ||
      workspaceOwner.getAttribute("data-meow-right-sidebar-owner") !== "workspace" ||
      workspaceOwner.getAttribute("data-meow-right-sidebar-family") !== "workspace" ||
      workspaceOwner.getAttribute("data-meow-right-sidebar-motion-owner") !== "workspace"
    ) {
      throw new Error("Visual recovery ledger expects Workspace right sidebar to use shared owner/family: " + JSON.stringify({
        ownerCount: document.querySelectorAll('[data-r2-workspace-route] [data-workspace-right-sidebar-owner]').length,
        owner: workspaceOwner.getAttribute("data-meow-right-sidebar-owner"),
        family: workspaceOwner.getAttribute("data-meow-right-sidebar-family"),
        motionOwner: workspaceOwner.getAttribute("data-meow-right-sidebar-motion-owner")
      }));
    }

    assertNoVsResidue("visual recovery ninth workspace ledger");
    return {
      titleScan: {
        scanTextAnimation: scanTextStyle.animationName,
        scanBarAnimation: scanBarStyle.animationName,
        railMotion: railMotion.sample,
        railSettlement
      },
      sidebar: {
        boxShadow: activeSidebarGlow.boxShadow,
        beforeBackground: activeSidebarGlow.beforeBackground,
        pulse: activeSidebarGlow.afterAnimation
      },
      meowBox: {
        menuRect: rectDebug(menu),
        menuBackground: menuStyle.backgroundColor,
        pinZoneBoxShadow: pinZoneStyle.boxShadow
      },
      workspaceMotion: {
        newPaneAnimation: newPaneStyle.animationName,
        configuredPaneAnimation: configuredPaneStyle.animationName,
        breathBefore: configuredBefore.animationName,
        breathAfter: configuredAfter.animationName
      },
      topSurface: {
        studioTagRect: rectDebug(studioTagMain),
        family: document.querySelector('[data-meow-top-surface-rail]')?.getAttribute("data-meow-top-surface-family") || ""
      },
      workspaceRightSidebar: {
        owner: workspaceOwner.getAttribute("data-meow-right-sidebar-owner"),
        family: workspaceOwner.getAttribute("data-meow-right-sidebar-family"),
        motionOwner: workspaceOwner.getAttribute("data-meow-right-sidebar-motion-owner"),
        rect: rectDebug(workspaceOwner)
      }
    };
  `);

  await forceHover('[data-meow-box-trigger]');
  const triggerHover = await pageEval(`
    const trigger = document.querySelector('[data-meow-box-trigger]');
    const style = getComputedStyle(trigger);
    const before = getComputedStyle(trigger, "::before");
    const hasBlue = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("0 140 255") || text.includes("0, 140, 255") || text.includes("rgb(0 140 255") || text.includes("rgb(0, 140, 255)");
    };
    const isTransparent = (value) => {
      const text = String(value || "").replace(/\\s+/g, " ").toLowerCase();
      return !text || text === "transparent" || text === "rgba(0, 0, 0, 0)" || text === "rgba(0 0 0 / 0)" || text === "rgb(0 0 0 / 0)";
    };
    const rect = trigger.getBoundingClientRect();
    if (
      trigger.getAttribute("data-meow-box-owner") !== "product-shell" ||
      trigger.getAttribute("data-meow-box-family") !== "product-shell-meow-box" ||
      trigger.getAttribute("data-meow-action-family") !== "workspace-action-surface" ||
      trigger.getAttribute("data-meow-action-owner") !== "product-shell" ||
      style.boxShadow === "none" ||
      isTransparent(style.backgroundColor) ||
      !hasBlue(style.boxShadow + " " + style.borderColor + " " + style.backgroundColor) ||
      Math.round(rect.width) !== 38 ||
      Math.round(rect.height) !== 38
    ) {
      throw new Error("Visual recovery ledger expects Meow Box trigger to keep ProductShell behavior while sharing the pure-blue sidebar action family: " + JSON.stringify({
        owner: trigger.getAttribute("data-meow-box-owner"),
        family: trigger.getAttribute("data-meow-box-family"),
        actionOwner: trigger.getAttribute("data-meow-action-owner"),
        actionFamily: trigger.getAttribute("data-meow-action-family"),
        rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
        borderColor: style.borderColor,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        beforeOpacity: before.opacity
      }));
    }
    return {
      rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      beforeOpacity: before.opacity
    };
  `);

  await forceHover('[data-meow-top-surface-tag][data-meow-top-surface-route="studio"] [data-meow-top-surface-main]');
  const topTagHover = await pageEval(`
    const main = document.querySelector('[data-meow-top-surface-tag][data-meow-top-surface-route="studio"] [data-meow-top-surface-main]');
    const activeMain = document.querySelector('[data-meow-top-surface-main][data-meow-tab-active="true"]');
    main.style.transition = "none";
    main.offsetHeight;
    const style = getComputedStyle(main);
    const activeStyle = activeMain ? getComputedStyle(activeMain) : null;
    const hasGreen = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("55 255 139") || text.includes("55, 255, 139") || text.includes("rgb(55 255 139") || text.includes("rgb(55, 255, 139)");
    };
    const alphaOf = (value) => {
      const text = String(value || "").trim();
      const srgbMatch = text.match(/^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)$/);
      if (srgbMatch) return Number.isFinite(Number(srgbMatch[4])) ? Number(srgbMatch[4]) : 1;
      const match = text.match(/rgba?\\(([^)]+)\\)/);
      if (!match) return text === "transparent" ? 0 : 1;
      const parts = match[1].replace("/", " ").split(/[\\s,]+/).filter(Boolean).map((part) => Number.parseFloat(part.trim()));
      return Number.isFinite(parts[3]) ? parts[3] : 1;
    };
    const hoverFillAlpha = alphaOf(style.backgroundColor);
    const activeFillAlpha = activeStyle ? alphaOf(activeStyle.backgroundColor) : 0;
    if (
      !activeMain ||
      style.boxShadow === "none" ||
      !hasGreen(style.boxShadow + " " + style.borderColor) ||
      !hasGreen(activeStyle.boxShadow + " " + activeStyle.borderColor) ||
      hoverFillAlpha >= activeFillAlpha - 0.32 ||
      hoverFillAlpha > 0.36 ||
      activeFillAlpha < 0.62
    ) {
      throw new Error("Visual recovery ledger expects inactive top tag hover to stay a green glow, not the active solid fill: " + JSON.stringify({
        borderColor: style.borderColor,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        activeBorderColor: activeStyle?.borderColor || "",
        activeBackgroundColor: activeStyle?.backgroundColor || "",
        activeBoxShadow: activeStyle?.boxShadow || "",
        hoverFillAlpha,
        activeFillAlpha
      }));
    }
    return {
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      hoverFillAlpha,
      activeBackgroundColor: activeStyle.backgroundColor,
      activeFillAlpha
    };
  `);

  const routeOwners = await pageEval(`
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
    const click = async (selector, wait = 200) => {
      const element = await waitFor(selector);
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      element.click();
      await delay(wait);
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
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };
    const readOwner = (routeSelector, page) => {
      const surface = document.querySelector(routeSelector);
      const owners = [...(surface?.querySelectorAll("[data-workspace-right-sidebar-owner]") || [])];
      if (owners.length !== 1) {
        throw new Error(page + " should expose exactly one shared right sidebar owner: " + owners.length);
      }
      const owner = owners[0];
      if (
        owner.getAttribute("data-meow-right-sidebar-owner") !== "workspace" ||
        owner.getAttribute("data-meow-right-sidebar-family") !== "workspace" ||
        owner.getAttribute("data-meow-right-sidebar-motion-owner") !== "workspace"
      ) {
        throw new Error(page + " right sidebar owner/family should remain workspace: " + JSON.stringify({
          owner: owner.getAttribute("data-meow-right-sidebar-owner"),
          family: owner.getAttribute("data-meow-right-sidebar-family"),
          motionOwner: owner.getAttribute("data-meow-right-sidebar-motion-owner"),
          className: String(owner.className || "")
        }));
      }
      return {
        owner: owner.getAttribute("data-meow-right-sidebar-owner"),
        family: owner.getAttribute("data-meow-right-sidebar-family"),
        motionOwner: owner.getAttribute("data-meow-right-sidebar-motion-owner"),
        collapsed: owner.getAttribute("data-workspace-right-sidebar-collapsed"),
        rect: rectDebug(owner)
      };
    };

    await navigateRoute("studio");
    await waitFor('[data-studio-route]');
    const studio = readOwner('[data-studio-route]', "Studio");

    const residue = document.querySelector([
      ".vs-energy-title",
      ".vs-title-scan-bar",
      ".hover-text",
      ".vs-picker-dialog-mouse",
      "[data-vs-picker-live]",
      "[data-vs-meow-box-ready]",
      "[data-vs-box-drop-active]",
      "[data-vs-top-surface-tag]",
      ".vs-top-surface-tag",
      ".vs-live-app-mode",
      "[data-vs-visual-stage]",
      ".vs-visual-badge",
      "[data-vs-surface-close-dialog]"
    ].join(","));
    if (residue) {
      throw new Error("Visual recovery ninth ledger should not revive live VS residue: " + residue.outerHTML.slice(0, 520));
    }

    return {
      studio,
      vsVisual: document.documentElement.dataset.vsVisual || "",
      hasLiveClass: document.documentElement.classList.contains("vs-live-app-mode")
    };
  `);

  return {
    scenario: "visual-recovery-ninth-batch",
    workspace: workspaceEvidence,
    hover: {
      trigger: triggerHover,
      topTag: topTagHover
    },
    routeOwners
  };
}

async function runVisualRecoveryTenthBatchScenario(win, dependencies = {}, scenario) {
  if (scenario !== "visual-recovery-tenth-batch") return undefined;

  const evidenceDir = path.join(process.cwd(), "tmp", "real-window-acceptance", "2026-06-19-visual-recovery-tenth-batch");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageEval = (source) => win.webContents.executeJavaScript(`(async () => {${source}})()`, true);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const screenshots = [];
  const screenshotByName = new Map();
  const sampleImageRect = (image, rect = {}, step = 8) => {
    const size = image.getSize();
    const bitmap = image.toBitmap();
    const left = Math.max(0, Math.min(size.width - 1, Math.floor(rect.left || 0)));
    const top = Math.max(0, Math.min(size.height - 1, Math.floor(rect.top || 0)));
    const right = Math.max(left + 1, Math.min(size.width, Math.ceil(rect.right ?? (left + (rect.width || 1)))));
    const bottom = Math.max(top + 1, Math.min(size.height, Math.ceil(rect.bottom ?? (top + (rect.height || 1)))));
    let samples = 0;
    let brightSamples = 0;
    let blueSamples = 0;
    let greenSamples = 0;
    let redSamples = 0;
    let alphaSamples = 0;
    for (let y = top; y < bottom; y += step) {
      for (let x = left; x < right; x += step) {
        const index = (y * size.width + x) * 4;
        const r = bitmap[index] || 0;
        const g = bitmap[index + 1] || 0;
        const b = bitmap[index + 2] || 0;
        const a = bitmap[index + 3] || 0;
        samples += 1;
        if (a > 16) alphaSamples += 1;
        if (r + g + b > 140) brightSamples += 1;
        if (b > 90 && g > 55 && b > r + 20) blueSamples += 1;
        if (g > 110 && g > r + 30 && g > b + 20) greenSamples += 1;
        if (r > 120 && r > g + 25 && r > b + 25) redSamples += 1;
      }
    }
    return {
      rect: { left, top, right, bottom, width: right - left, height: bottom - top },
      samples,
      brightSamples,
      brightRatio: samples ? Number((brightSamples / samples).toFixed(3)) : 0,
      blueSamples,
      blueRatio: samples ? Number((blueSamples / samples).toFixed(3)) : 0,
      greenSamples,
      greenRatio: samples ? Number((greenSamples / samples).toFixed(3)) : 0,
      redSamples,
      redRatio: samples ? Number((redSamples / samples).toFixed(3)) : 0,
      alphaSamples
    };
  };
  let debuggerAttached = false;
  const debuggerCommand = async (method, params = {}) => {
    if (!debuggerAttached) {
      try {
        win.webContents.debugger.attach("1.3");
      } catch (error) {
        if (!String(error?.message || error).includes("already attached")) {
          throw error;
        }
      }
      debuggerAttached = true;
      await win.webContents.debugger.sendCommand("DOM.enable");
      await win.webContents.debugger.sendCommand("CSS.enable");
    }
    return win.webContents.debugger.sendCommand(method, params);
  };
  const forceHover = async (selector) => {
    const { root } = await debuggerCommand("DOM.getDocument", { depth: 1 });
    const { nodeId } = await debuggerCommand("DOM.querySelector", {
      nodeId: root.nodeId,
      selector
    });
    if (!nodeId) {
      throw new Error("Unable to force hover; selector not found: " + selector);
    }
    await debuggerCommand("CSS.forcePseudoState", {
      nodeId,
      forcedPseudoClasses: ["hover"]
    });
    await delay(420);
    return nodeId;
  };
  const captureEvidence = async (name, label, options = {}) => {
    await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
    `);
    await delay(180);
    if (options.beforeCaptureWait) {
      await delay(options.beforeCaptureWait);
    }
    await win.webContents.capturePage();
    await delay(260);
    await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
    `);
    await delay(180);
    const image = await win.webContents.capturePage();
    const filePath = path.join(evidenceDir, `${name}.png`);
    fs.writeFileSync(filePath, image.toPNG());
    const screenshot = {
      name,
      label,
      path: filePath,
      size: image.getSize()
    };
    screenshots.push(screenshot);
    screenshotByName.set(name, { image, screenshot });
    return filePath;
  };
  const clearHover = async (selector) => {
    if (!debuggerAttached) return;
    const { root } = await debuggerCommand("DOM.getDocument", { depth: 1 });
    const { nodeId } = await debuggerCommand("DOM.querySelector", {
      nodeId: root.nodeId,
      selector
    });
    if (nodeId) {
      await debuggerCommand("CSS.forcePseudoState", {
        nodeId,
        forcedPseudoClasses: []
      });
    }
  };

  const workspaceOverview = await pageEval(`
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
    const click = async (selector, wait = 200) => {
      const element = await waitFor(selector);
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      element.click();
      await delay(wait);
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
    const numberFromCss = (value) => {
      const parsed = Number.parseFloat(String(value || "0"));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const hasAnimation = (name, expected) => String(name || "").split(",").map((item) => item.trim()).includes(expected);
    const hasBlue = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("0 140 255") || text.includes("0, 140, 255") || text.includes("rgb(0 140 255") || text.includes("rgb(0, 140, 255)") || text.includes("96 165 250") || text.includes("96, 165, 250");
    };
    const isTransparent = (value) => {
      const text = String(value || "").replace(/\\s+/g, " ").toLowerCase();
      return !text || text === "transparent" || text === "rgba(0, 0, 0, 0)" || text === "rgba(0 0 0 / 0)" || text === "rgb(0 0 0 / 0)";
    };
    const hasGreen = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("55 255 139") || text.includes("55, 255, 139") || text.includes("rgb(55 255 139") || text.includes("rgb(55, 255, 139)");
    };
    const waitForTopRailMotion = async (titleElement, label, timeout = 1600) => {
      const startedAt = Date.now();
      let lastDebug = null;
      while (Date.now() - startedAt <= timeout) {
        const rail = document.querySelector('[data-top-nav-running-surfaces] [data-product-shell-top-surface-rail]');
        if (rail) {
          const style = getComputedStyle(rail);
          lastDebug = {
            motion: rail.getAttribute("data-top-nav-surface-motion"),
            transform: style.transform,
            rail: rectDebug(rail),
            title: rectDebug(titleElement)
          };
          if (lastDebug.motion === "magnet" && style.transform !== "none") return { rail, sample: lastDebug };
        }
        await delay(25);
      }
      throw new Error(label + " should animate the real top-surface rail with Meowdesk-owned magnet motion: " + JSON.stringify(lastDebug));
    };
    const assertTopRailSettlesAfterTitle = async (titleElement, rail, label) => {
      await delay(1500);
      const titleRect = titleElement.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const gap = railRect.left - titleRect.right;
      if (gap < 4) {
        throw new Error(label + " should settle without overlapping the title: " + JSON.stringify({
          title: rectDebug(titleElement),
          rail: rectDebug(rail),
          gap: Math.round(gap * 100) / 100,
          motion: rail.getAttribute("data-top-nav-surface-motion"),
          transform: getComputedStyle(rail).transform
        }));
      }
      return { title: rectDebug(titleElement), rail: rectDebug(rail), gap: Math.round(gap * 100) / 100 };
    };
    const waitForActionSurfaceReady = async (element, label) => {
      const collectMatchedVisualRules = () => Array.from(document.styleSheets).flatMap((sheet) => {
        let rules = [];
        try {
          rules = Array.from(sheet.cssRules || []);
        } catch {
          return [];
        }
        return rules
          .filter((rule) => rule?.selectorText && rule.style && (
            rule.style.background ||
            rule.style.backgroundColor ||
            rule.style.border ||
            rule.style.borderColor ||
            rule.style.boxShadow ||
            rule.style.transition
          ))
          .filter((rule) => {
            try {
              return element.matches(rule.selectorText);
            } catch {
              return false;
            }
          })
          .map((rule) => ({
            selector: rule.selectorText,
            background: rule.style.background,
            backgroundPriority: rule.style.getPropertyPriority("background"),
            backgroundColor: rule.style.backgroundColor,
            backgroundColorPriority: rule.style.getPropertyPriority("background-color"),
            border: rule.style.border,
            borderPriority: rule.style.getPropertyPriority("border"),
            borderColor: rule.style.borderColor,
            borderColorPriority: rule.style.getPropertyPriority("border-color"),
            boxShadow: rule.style.boxShadow,
            boxShadowPriority: rule.style.getPropertyPriority("box-shadow"),
            transition: rule.style.transition,
            transitionPriority: rule.style.getPropertyPriority("transition")
          }));
      });
      const deadline = Date.now() + 1200;
      let snapshot = null;
      while (Date.now() < deadline) {
        const style = getComputedStyle(element);
        const before = getComputedStyle(element, "::before");
        const after = getComputedStyle(element, "::after");
        snapshot = {
          label,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          boxShadow: style.boxShadow,
          beforeBackground: before.backgroundColor,
          beforeBoxShadow: before.boxShadow,
          afterAnimation: after.animationName
        };
        if (
          !isTransparent(snapshot.backgroundColor) &&
          hasBlue(snapshot.backgroundColor + " " + snapshot.borderColor) &&
          hasBlue(snapshot.boxShadow + " " + snapshot.beforeBackground) &&
          snapshot.boxShadow !== "none" &&
          snapshot.afterAnimation !== "none"
        ) {
          return { style, before, after, snapshot };
        }
        await delay(60);
      }
      throw new Error("Action surface did not settle into the shared blue visual family: " + JSON.stringify({
        ...snapshot,
        className: String(element.className || ""),
        matchedVisualRules: collectMatchedVisualRules()
      }));
    };
    const assertNoVsResidue = (label) => {
      const residue = document.querySelector([
        ".vs-energy-title",
        ".vs-title-scan-bar",
        ".hover-text",
        ".vs-picker-dialog-mouse",
        "[data-vs-picker-live]",
        "[data-vs-meow-box-ready]",
        "[data-vs-box-drop-active]",
        "[data-vs-top-surface-tag]",
        ".vs-top-surface-tag",
        ".vs-live-app-mode",
        "[data-vs-visual-stage]",
        ".vs-visual-badge",
        "[data-vs-surface-close-dialog]"
      ].join(","));
      if (residue) {
        throw new Error(label + " should not expose live VS residue: " + residue.outerHTML.slice(0, 520));
      }
    };

    await waitFor('[data-workbench-bridge-status="ready"]');
    await click('aside nav [data-next-route="workspace"]');
    await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
    await click('aside nav [data-next-route="studio"]');
    await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:studio"]');
    await click('aside nav [data-next-route="workspace"]');
    await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
    await waitFor('[data-r2-workspace-route]');

    const title = await waitFor('[data-top-nav-title][data-top-nav-title-visual="meowdesk-scan"]');
    const scanText = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-scan-text');
    const scanBar = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-scan-bar');
    const runningSurfaces = await waitFor('[data-top-nav-running-surfaces]');
    const scanTextStyle = getComputedStyle(scanText);
    const scanBarStyle = getComputedStyle(scanBar);
    const railMotion = await waitForTopRailMotion(title, "Visual recovery tenth TopNav");
    if (
      !hasAnimation(scanTextStyle.animationName, "meowdesk-title-scan-reveal") ||
      !hasAnimation(scanBarStyle.animationName, "meowdesk-title-scan-bar") ||
      scanTextStyle.transform !== "none" ||
      String(scanTextStyle.clipPath || "").includes("none") ||
      runningSurfaces.getAttribute("data-top-nav-surface-push") !== "true" ||
      !hasGreen(scanBarStyle.boxShadow + " " + scanTextStyle.textShadow)
    ) {
      throw new Error("Tenth batch expects clipped scan bar and measured top surface push to be visible for acceptance screenshots: " + JSON.stringify({
        scanTextAnimation: scanTextStyle.animationName,
        scanTextClipPath: scanTextStyle.clipPath,
        scanTextTransform: scanTextStyle.transform,
        scanBarAnimation: scanBarStyle.animationName,
        scanShadow: scanBarStyle.boxShadow,
        runningSurfacePush: runningSurfaces.getAttribute("data-top-nav-surface-push"),
        railMotion: railMotion.sample
      }));
    }
    const railSettlement = await assertTopRailSettlesAfterTitle(title, railMotion.rail, "Visual recovery tenth TopNav");

    const activeSidebar = await waitFor('aside .meowdesk-sidebar-route[data-next-route="workspace"][aria-current="page"]');
    const activeReady = await waitForActionSurfaceReady(activeSidebar, "Workspace active sidebar route");
    const activeStyle = activeReady.style;
    const activeBefore = activeReady.before;
    const activeAfter = activeReady.after;
    const topAction = await waitFor('[data-meow-action-source="right-sidebar-toggle"][data-meow-action-family="workspace-action-surface"][data-meow-action-state="primary"]');
    const topReady = await waitForActionSurfaceReady(topAction, "Workspace top-right sidebar toggle");
    const topActionStyle = topReady.style;
    const activeRect = rectDebug(activeSidebar);
    const topActionRect = rectDebug(topAction);
    const collectMatchedVisualRules = (element) => Array.from(document.styleSheets).flatMap((sheet) => {
      let rules = [];
      try {
        rules = Array.from(sheet.cssRules || []);
      } catch {
        return [];
      }
      return rules
        .filter((rule) => rule?.selectorText && rule.style && (
          rule.style.background ||
          rule.style.backgroundColor ||
          rule.style.border ||
          rule.style.borderColor ||
          rule.style.boxShadow
        ))
        .filter((rule) => {
          try {
            return element.matches(rule.selectorText);
          } catch {
            return false;
          }
        })
        .map((rule) => ({
          selector: rule.selectorText,
          background: rule.style.background,
          backgroundPriority: rule.style.getPropertyPriority("background"),
          backgroundColor: rule.style.backgroundColor,
          backgroundColorPriority: rule.style.getPropertyPriority("background-color"),
          border: rule.style.border,
          borderPriority: rule.style.getPropertyPriority("border"),
          borderColor: rule.style.borderColor,
          borderColorPriority: rule.style.getPropertyPriority("border-color"),
          boxShadow: rule.style.boxShadow,
          boxShadowPriority: rule.style.getPropertyPriority("box-shadow")
        }));
    });
    const actionSurface = {
      sidebarOwner: activeSidebar.getAttribute("data-meow-action-owner"),
      sidebarFamily: activeSidebar.getAttribute("data-meow-action-family"),
      sidebarState: activeSidebar.getAttribute("data-meow-action-state"),
      sidebarSource: activeSidebar.getAttribute("data-meow-action-source"),
      sidebarRadius: numberFromCss(activeStyle.borderTopLeftRadius),
      sidebarBorderColor: activeStyle.borderColor,
      sidebarBackground: activeStyle.backgroundColor,
      sidebarBackgroundImage: activeStyle.backgroundImage,
      sidebarBoxShadow: activeStyle.boxShadow,
      sidebarBeforeBackground: activeBefore.backgroundColor,
      sidebarBeforeBoxShadow: activeBefore.boxShadow,
      sidebarRect: activeRect,
      topOwner: topAction.getAttribute("data-meow-action-owner"),
      topFamily: topAction.getAttribute("data-meow-action-family"),
      topState: topAction.getAttribute("data-meow-action-state"),
      topSource: topAction.getAttribute("data-meow-action-source"),
      topRadius: numberFromCss(topActionStyle.borderTopLeftRadius),
      topBorderColor: topActionStyle.borderColor,
      topBackground: topActionStyle.backgroundColor,
      topBackgroundImage: topActionStyle.backgroundImage,
      topBoxShadow: topActionStyle.boxShadow,
      topRect: topActionRect
    };
    if (!hasBlue(activeStyle.boxShadow + " " + activeBefore.backgroundColor) || activeAfter.animationName === "none") {
      throw new Error("Tenth batch expects active sidebar blue glow and pulse for acceptance screenshots: " + JSON.stringify({
        boxShadow: activeStyle.boxShadow,
        beforeBackground: activeBefore.backgroundColor,
        afterAnimation: activeAfter.animationName
      }));
    }
    if (
      actionSurface.sidebarOwner !== "workspace" ||
      actionSurface.sidebarFamily !== "workspace-action-surface" ||
      actionSurface.sidebarState !== "primary" ||
      actionSurface.topOwner !== "workspace" ||
      actionSurface.topFamily !== "workspace-action-surface" ||
      actionSurface.topState !== "primary" ||
      Math.abs(actionSurface.sidebarRadius - actionSurface.topRadius) > 0.5 ||
      Math.abs(activeRect.width - topActionRect.width) > 1.5 ||
      Math.abs(activeRect.height - topActionRect.height) > 1.5 ||
      Math.abs(actionSurface.sidebarRadius - 6) > 0.5 ||
      isTransparent(actionSurface.sidebarBackground) ||
      isTransparent(actionSurface.topBackground) ||
      !hasBlue(actionSurface.sidebarBackground + " " + actionSurface.sidebarBorderColor + " " + actionSurface.sidebarBoxShadow) ||
      !hasBlue(actionSurface.topBackground + " " + actionSurface.topBorderColor + " " + actionSurface.topBoxShadow) ||
      actionSurface.sidebarBoxShadow === "none" ||
      actionSurface.topBoxShadow === "none"
    ) {
      throw new Error("Active sidebar route and top-right toggle should share the same workspace action-surface family instead of split visual owners: " + JSON.stringify({
        ...actionSurface,
        sidebarClassName: String(activeSidebar.className || ""),
        topClassName: String(topAction.className || ""),
        sidebarMatchedVisualRules: collectMatchedVisualRules(activeSidebar),
        topMatchedVisualRules: collectMatchedVisualRules(topAction)
      }));
    }

    const sidebarFamilySelectors = [
      ['aside .meowdesk-sidebar-route[data-next-route="workspace"][aria-current="page"]', "Workspace active route", "workspace"]
    ];
    const sidebarActionFamily = [];
    for (const [selector, label, owner] of sidebarFamilySelectors) {
      const element = await waitFor(selector);
      const ready = await waitForActionSurfaceReady(element, label);
      const rect = rectDebug(element);
      const radius = numberFromCss(ready.style.borderTopLeftRadius);
      const evidence = {
        label,
        owner: element.getAttribute("data-meow-action-owner"),
        family: element.getAttribute("data-meow-action-family"),
        source: element.getAttribute("data-meow-action-source"),
        rect,
        radius,
        backgroundColor: ready.style.backgroundColor,
        borderColor: ready.style.borderColor,
        boxShadow: ready.style.boxShadow,
        className: String(element.className || "")
      };
      if (
        evidence.owner !== owner ||
        evidence.family !== "workspace-action-surface" ||
        Math.abs(rect.width - activeRect.width) > 1.5 ||
        Math.abs(rect.height - activeRect.height) > 1.5 ||
        Math.abs(radius - actionSurface.sidebarRadius) > 0.5 ||
        Math.abs(radius - 6) > 0.5 ||
        isTransparent(evidence.backgroundColor) ||
        !hasBlue(evidence.backgroundColor + " " + evidence.borderColor + " " + evidence.boxShadow) ||
        evidence.boxShadow === "none"
      ) {
        throw new Error("Collapsed left sidebar action should share the pure-blue workspace action-surface family: " + JSON.stringify({
          ...evidence,
          activeRect,
          activeRadius: actionSurface.sidebarRadius,
          matchedVisualRules: collectMatchedVisualRules(element)
        }));
      }
      sidebarActionFamily.push(evidence);
    }
    const meowBoxRestingTrigger = await waitFor('[data-meow-box-trigger][data-meow-action-family="workspace-action-surface"]');
    const meowBoxRestingStyle = getComputedStyle(meowBoxRestingTrigger);
    const meowBoxRestingRect = rectDebug(meowBoxRestingTrigger);
    const meowBoxRestingRadius = numberFromCss(meowBoxRestingStyle.borderTopLeftRadius);
    const meowBoxRestingVisual = {
      label: "Meow Box resting trigger",
      owner: meowBoxRestingTrigger.getAttribute("data-meow-action-owner"),
      family: meowBoxRestingTrigger.getAttribute("data-meow-action-family"),
      source: meowBoxRestingTrigger.getAttribute("data-meow-action-source"),
      open: meowBoxRestingTrigger.getAttribute("data-meow-box-open"),
      dropActive: meowBoxRestingTrigger.getAttribute("data-meow-box-drop-active"),
      rect: meowBoxRestingRect,
      radius: meowBoxRestingRadius,
      backgroundColor: meowBoxRestingStyle.backgroundColor,
      borderColor: meowBoxRestingStyle.borderColor,
      boxShadow: meowBoxRestingStyle.boxShadow,
      className: String(meowBoxRestingTrigger.className || "")
    };
    if (
      meowBoxRestingVisual.owner !== "product-shell" ||
      meowBoxRestingVisual.family !== "workspace-action-surface" ||
      Math.abs(meowBoxRestingRect.width - activeRect.width) > 1.5 ||
      Math.abs(meowBoxRestingRect.height - activeRect.height) > 1.5 ||
      meowBoxRestingRadius < 6 ||
      meowBoxRestingRadius > 8 ||
      !isTransparent(meowBoxRestingVisual.open) ||
      !isTransparent(meowBoxRestingVisual.dropActive) ||
      hasBlue(meowBoxRestingVisual.backgroundColor + " " + meowBoxRestingVisual.boxShadow)
    ) {
      throw new Error("Meow Box collapsed trigger should stay quiet at rest; blue belongs to hover/open/drop states: " + JSON.stringify({
        ...meowBoxRestingVisual,
        activeRect,
        activeRadius: actionSurface.sidebarRadius,
        matchedVisualRules: collectMatchedVisualRules(meowBoxRestingTrigger)
      }));
    }
    sidebarActionFamily.push(meowBoxRestingVisual);
    if (document.querySelector('[data-product-shell-sidebar-pin-zone]')) {
      throw new Error("ProductShell pin zone should not render as a resting workspace-action-surface button in acceptance screenshots.");
    }

    await click('[data-r2-workspace-slot-button="1"]', 180);
    await waitFor('[data-r2-workspace-panes][data-r2-workspace-pane-count="1"]');
    const workspaceEmptyRoot = await waitFor('[data-r2-workspace-pane="blank-1"] [data-meow-launch-family="agent-work-surface"][data-meow-launch-variant="workspace-agent"]');
    const workspaceEmptyIcon = workspaceEmptyRoot.querySelector('[data-meow-launch-icon-chrome="action"]');
    const workspaceEmptyTitle = workspaceEmptyRoot.querySelector(".meowdesk-launch-empty-state-title strong");
    const workspaceEmptyMeta = workspaceEmptyRoot.querySelector(".meowdesk-launch-empty-state-meta");
    const workspaceConfigureActions = [...workspaceEmptyRoot.querySelectorAll('[data-r2-workspace-configure-pane]')];
    const workspacePrimaryActions = [...workspaceEmptyRoot.querySelectorAll('[data-meow-launch-action="primary"]')];
    const workspaceAction = workspacePrimaryActions[0];
    const workspaceActionStyle = workspaceAction ? getComputedStyle(workspaceAction) : null;
    const workspaceTitleStyle = workspaceEmptyTitle ? getComputedStyle(workspaceEmptyTitle) : null;
    const workspaceMetaStyle = workspaceEmptyMeta ? getComputedStyle(workspaceEmptyMeta) : null;
    const workspaceEmptyState = {
      family: workspaceEmptyRoot.getAttribute("data-meow-launch-family"),
      variant: workspaceEmptyRoot.getAttribute("data-meow-launch-variant"),
      iconChrome: workspaceEmptyIcon?.getAttribute("data-meow-launch-icon-chrome") || "",
      configureActionCount: workspaceConfigureActions.length,
      primaryActionCount: workspacePrimaryActions.length,
      actionRect: workspaceAction ? rectDebug(workspaceAction) : null,
      actionRadius: workspaceActionStyle ? numberFromCss(workspaceActionStyle.borderTopLeftRadius) : 0,
      actionBackground: workspaceActionStyle?.backgroundColor || "",
      actionBorderColor: workspaceActionStyle?.borderColor || "",
      actionBoxShadow: workspaceActionStyle?.boxShadow || "",
      actionIconRect: workspaceAction?.querySelector("svg") ? rectDebug(workspaceAction.querySelector("svg")) : null,
      titleText: workspaceEmptyTitle?.textContent?.trim() || "",
      titleFontSize: workspaceTitleStyle?.fontSize || "",
      titleFontWeight: workspaceTitleStyle?.fontWeight || "",
      metaFontSize: workspaceMetaStyle?.fontSize || "",
      metaFontWeight: workspaceMetaStyle?.fontWeight || ""
    };
    if (
      !workspaceEmptyIcon ||
      workspaceEmptyState.configureActionCount !== 1 ||
      workspaceEmptyState.primaryActionCount !== 1 ||
      workspaceEmptyState.actionRadius !== 12 ||
      workspaceEmptyState.actionRect?.width !== 56 ||
      workspaceEmptyState.actionRect?.height !== 56 ||
      workspaceEmptyState.actionIconRect?.width !== 24 ||
      workspaceEmptyState.actionIconRect?.height !== 24 ||
      isTransparent(workspaceEmptyState.actionBackground) ||
      workspaceEmptyState.actionBoxShadow === "none" ||
      workspaceEmptyState.titleFontSize !== "14px" ||
      Number.parseInt(workspaceEmptyState.titleFontWeight, 10) < 650 ||
      workspaceEmptyState.metaFontSize !== "12px" ||
      Number.parseInt(workspaceEmptyState.metaFontWeight, 10) < 550
    ) {
      throw new Error("Workspace blank pane should use the shared agent-work-surface empty-state family with one 56px/12px action button: " + JSON.stringify(workspaceEmptyState));
    }
    await click('[data-r2-workspace-slot-button="2"]', 220);
    const newPane = await waitFor('[data-r2-workspace-pane="blank-2"][data-r2-workspace-pane-new="true"]');
    const newPaneStyle = getComputedStyle(newPane);
    if (!hasAnimation(newPaneStyle.animationName, "meowdesk-workspace-pane-enter")) {
      throw new Error("Tenth batch expects added Workspace pane enter motion: " + newPaneStyle.animationName);
    }
    await click('[data-r2-workspace-configure-pane="blank-2"]', 180);
    await waitFor('[data-r2-workspace-config-dialog]');
    await waitFor('[data-r2-workspace-config-tool="smoke-terminal"]');
    await click('[data-r2-workspace-config-tool="smoke-terminal"]', 240);
    const configuredPane = await waitFor('[data-r2-workspace-pane="blank-2"][data-r2-workspace-pane-configured-pulse="true"][data-r2-workspace-pane-kind="terminal"]');
    const configuredPaneStyle = getComputedStyle(configuredPane);
    const configuredBefore = getComputedStyle(configuredPane, "::before");
    const configuredAfter = getComputedStyle(configuredPane, "::after");
    if (
      !hasAnimation(configuredPaneStyle.animationName, "meowdesk-workspace-pane-configured") ||
      !hasAnimation(configuredBefore.animationName, "meowdesk-card-breath") ||
      !hasAnimation(configuredAfter.animationName, "meowdesk-card-inner-breath")
    ) {
      throw new Error("Tenth batch expects configured pane pulse and card breath family: " + JSON.stringify({
        paneAnimation: configuredPaneStyle.animationName,
        beforeAnimation: configuredBefore.animationName,
        afterAnimation: configuredAfter.animationName
      }));
    }

    const paneToolIcons = [...document.querySelectorAll('[data-r2-workspace-pane] .meowdesk-workspace-pane-tool-icon')].slice(0, 2);
    const paneToolIconFamily = paneToolIcons.map((icon, index) => {
      const style = getComputedStyle(icon);
      const glyph = icon.querySelector("svg");
      return {
        index,
        pane: icon.closest("[data-r2-workspace-pane]")?.getAttribute("data-r2-workspace-pane") || "",
        kind: icon.closest("[data-r2-workspace-pane]")?.getAttribute("data-r2-workspace-pane-kind") || "",
        rect: rectDebug(icon),
        radius: numberFromCss(style.borderTopLeftRadius),
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        glyphTag: glyph?.tagName || "",
        glyphRect: glyph ? rectDebug(glyph) : null
      };
    });
    if (
      paneToolIconFamily.length < 2 ||
      paneToolIconFamily.some((item) =>
        item.glyphTag.toLowerCase() !== "svg" ||
        item.rect.width !== paneToolIconFamily[0].rect.width ||
        item.rect.height !== paneToolIconFamily[0].rect.height ||
        Math.abs(item.radius - paneToolIconFamily[0].radius) > 0.5 ||
        !hasBlue(item.backgroundColor + " " + item.borderColor + " " + item.boxShadow)
      )
    ) {
      throw new Error("Workspace pane title icons should share one chrome family and avoid nested asset-button shells: " + JSON.stringify(paneToolIconFamily));
    }

    const workspaceOwner = await waitFor('[data-r2-workspace-route] [data-workspace-right-sidebar-owner]');
    const studioTagMain = await waitFor('[data-meow-top-surface-tag][data-meow-top-surface-route="studio"] [data-meow-top-surface-main]');
    assertNoVsResidue("visual recovery tenth workspace overview");
    return {
      titleText: title.textContent.trim(),
      scanTextAnimation: scanTextStyle.animationName,
      scanBarAnimation: scanBarStyle.animationName,
      railMotion: railMotion.sample,
      railSettlement,
      actionSurface,
      sidebarActionFamily,
      workspaceEmptyState,
      activeSidebarGlow: activeStyle.boxShadow,
      activeSidebarPulse: activeAfter.animationName,
      newPaneAnimation: newPaneStyle.animationName,
      configuredPaneAnimation: configuredPaneStyle.animationName,
      cardBreath: {
        before: configuredBefore.animationName,
        after: configuredAfter.animationName
      },
      paneToolIconFamily,
      workspaceOwner: {
        owner: workspaceOwner.getAttribute("data-meow-right-sidebar-owner"),
        family: workspaceOwner.getAttribute("data-meow-right-sidebar-family"),
        motionOwner: workspaceOwner.getAttribute("data-meow-right-sidebar-motion-owner"),
        rect: rectDebug(workspaceOwner)
      },
      studioTagRect: rectDebug(studioTagMain)
    };
  `);

  await captureEvidence("01-workspace-scan-sidebar-pane-breath", "Workspace scanning title, active sidebar glow, pane motion and card breath");

  const boxDrop = await pageEval(`
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
    const click = async (selector, wait = 180) => {
      const element = await waitFor(selector);
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      element.click();
      await delay(wait);
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
    const hasBlue = (value) => {
      const text = String(value || "").toLowerCase();
      return text.includes("0 140 255") || text.includes("0, 140, 255") || text.includes("rgb(0 140 255") || text.includes("rgb(0, 140, 255)") || text.includes("96 165 250") || text.includes("96, 165, 250");
    };
    const trigger = await click('[data-meow-box-trigger]', 180);
    const menu = await waitFor('[data-meow-box-menu][data-meow-box-owner="product-shell"][data-meow-box-family="product-shell-meow-box"][data-meow-box-ready="true"]');
    const workflowLaunch = await waitFor('[data-meow-box-launch="obsidian"][data-meow-box-launch-draggable="true"]');
    const dataTransfer = new DataTransfer();
    dataTransfer.effectAllowed = "move";
    workflowLaunch.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
    if (!dataTransfer.getData("application/x-meowdesk-product-shell-route")) {
      dataTransfer.setData("application/x-meowdesk-product-shell-route", "obsidian");
      dataTransfer.setData("text/plain", "obsidian");
    }
    const pinZone = await waitFor('[data-product-shell-sidebar-pin-zone]');
    pinZone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer }));
    pinZone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
    await delay(220);
    const pinZoneStyle = getComputedStyle(pinZone);
    const menuStyle = getComputedStyle(menu);
    if (trigger.getAttribute("data-meow-box-open") !== "true" || !hasBlue(pinZoneStyle.boxShadow + " " + pinZoneStyle.borderColor)) {
      throw new Error("Tenth batch expects open Meow Box and sidebar pin drop glow: " + JSON.stringify({
        triggerOpen: trigger.getAttribute("data-meow-box-open"),
        pinZoneActive: pinZone.getAttribute("data-product-shell-sidebar-pin-zone-active"),
        pinZoneBoxShadow: pinZoneStyle.boxShadow,
        pinZoneBorderColor: pinZoneStyle.borderColor
      }));
    }
    return {
      triggerRect: rectDebug(trigger),
      menuRect: rectDebug(menu),
      pinZoneRect: rectDebug(pinZone),
      menuBackground: menuStyle.backgroundColor,
      pinZoneActive: pinZone.getAttribute("data-product-shell-sidebar-pin-zone-active"),
      pinZoneBoxShadow: pinZoneStyle.boxShadow
    };
  `);
  await forceHover('[data-meow-box-trigger]');
  const boxHover = await pageEval(`
    const trigger = document.querySelector('[data-meow-box-trigger]');
    const style = getComputedStyle(trigger);
    const before = getComputedStyle(trigger, "::before");
    return {
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      beforeOpacity: before.opacity
    };
  `);
  await captureEvidence("02-meow-box-open-hover-drop", "Meow Box open menu, trigger hover glow and sidebar drop glow");
  await clearHover('[data-meow-box-trigger]');
  await pageEval(`
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const pinZone = document.querySelector('[data-product-shell-sidebar-pin-zone]');
    const workflowLaunch = document.querySelector('[data-meow-box-launch="obsidian"]');
    const dataTransfer = new DataTransfer();
    dataTransfer.effectAllowed = "move";
    pinZone?.dispatchEvent(new DragEvent("dragleave", { bubbles: true, cancelable: true, dataTransfer }));
    workflowLaunch?.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer }));
    const trigger = document.querySelector('[data-meow-box-trigger][data-meow-box-open="true"]');
    if (trigger) {
      trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      trigger.click();
    }
    await delay(220);
    if (document.querySelector('[data-meow-box-menu]')) {
      throw new Error("Tenth batch should close Meow Box before capturing isolated top tag hover evidence.");
    }
    return true;
  `);

  await forceHover('[data-meow-top-surface-tag][data-meow-top-surface-route="studio"] [data-meow-top-surface-main]');
  const topTagHover = await pageEval(`
    const main = document.querySelector('[data-meow-top-surface-tag][data-meow-top-surface-route="studio"] [data-meow-top-surface-main]');
    const activeMain = document.querySelector('[data-meow-top-surface-main][data-meow-tab-active="true"]');
    main.style.transition = "none";
    main.offsetHeight;
    const style = getComputedStyle(main);
    const activeStyle = activeMain ? getComputedStyle(activeMain) : null;
    const alphaOf = (value) => {
      const text = String(value || "").trim();
      const srgbMatch = text.match(/^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)$/);
      if (srgbMatch) return Number.isFinite(Number(srgbMatch[4])) ? Number(srgbMatch[4]) : 1;
      const match = text.match(/rgba?\\(([^)]+)\\)/);
      if (!match) return text === "transparent" ? 0 : 1;
      const parts = match[1].replace("/", " ").split(/[\\s,]+/).filter(Boolean).map((part) => Number.parseFloat(part.trim()));
      return Number.isFinite(parts[3]) ? parts[3] : 1;
    };
    const hoverFillAlpha = alphaOf(style.backgroundColor);
    const activeFillAlpha = activeStyle ? alphaOf(activeStyle.backgroundColor) : 0;
    if (!activeMain || hoverFillAlpha >= activeFillAlpha - 0.32 || hoverFillAlpha > 0.36 || activeFillAlpha < 0.62) {
      throw new Error("Tenth batch top tag hover should remain a weaker green hover state than the active tag: " + JSON.stringify({
        hoverBackgroundColor: style.backgroundColor,
        activeBackgroundColor: activeStyle?.backgroundColor || "",
        hoverFillAlpha,
        activeFillAlpha
      }));
    }
    return {
      borderColor: style.borderColor,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      hoverFillAlpha,
      activeBackgroundColor: activeStyle.backgroundColor,
      activeFillAlpha,
      rect: (() => {
        const rect = main.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })()
    };
  `);
  await captureEvidence("03-top-tag-inactive-hover", "Inactive Studio top tag hover green glow");
  await clearHover('[data-meow-top-surface-tag][data-meow-top-surface-route="studio"] [data-meow-top-surface-main]');

  const studioOwner = await pageEval(`
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
    const waitForPageState = (predicate, label, timeout = 9000) => new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const tick = () => {
        try {
          const value = predicate();
          if (value) {
            resolve(value);
            return;
          }
        } catch {
          // Keep polling until the route commit is visible to the renderer.
        }
        if (Date.now() - startedAt > timeout) {
          reject(new Error("Timed out waiting for " + label));
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    });
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const click = async (selector, wait = 220) => {
      const element = await waitFor(selector);
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      element.click();
      await delay(wait);
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
    const numberFromCss = (value) => {
      const parsed = Number.parseFloat(String(value || "0"));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const isTransparent = (value) => {
      const text = String(value || "").replace(/\s+/g, " ").toLowerCase();
      return !text || text === "transparent" || text === "rgba(0, 0, 0, 0)" || text === "rgba(0 0 0 / 0)" || text === "rgb(0 0 0 / 0)";
    };
    await click('aside nav [data-next-route="studio"]');
    await waitForPageState(() => {
      const registry = document.querySelector('[data-open-surface-registry="true"]');
      const title = document.querySelector('[data-top-nav-title]');
      const keepalive = document.querySelector('[data-route-keepalive="studio"][data-route-keepalive-active="true"]');
      const route = keepalive?.querySelector('[data-studio-route]');
      if (
        registry?.getAttribute("data-open-surface-active") !== "surface:route:studio" ||
        !String(title?.textContent || "").includes("工坊") ||
        !isVisible(keepalive) ||
        !isVisible(route)
      ) {
        return null;
      }
      return route;
    }, "visible Studio route");
    const owner = await waitForPageState(() => {
      const owner = document.querySelector('[data-route-keepalive="studio"][data-route-keepalive-active="true"] [data-studio-route] [data-workspace-right-sidebar-owner]');
      return isVisible(owner) ? owner : null;
    }, "visible Studio shared right-sidebar owner");
    if (
      owner.getAttribute("data-meow-right-sidebar-owner") !== "workspace" ||
      owner.getAttribute("data-meow-right-sidebar-family") !== "workspace" ||
      owner.getAttribute("data-meow-right-sidebar-motion-owner") !== "workspace"
    ) {
      throw new Error("Tenth batch expects Studio shared workspace right-sidebar owner: " + owner.outerHTML.slice(0, 520));
    }
    const studioEmptyRoot = await waitForPageState(() => {
      const root = document.querySelector('[data-studio-agent-standby-mode="empty"] [data-meow-launch-family="agent-work-surface"][data-meow-launch-variant="studio-agent"]');
      return isVisible(root) ? root : null;
    }, "visible Studio agent empty-state family");
    const studioEmptyIcon = studioEmptyRoot.querySelector('[data-meow-launch-icon-chrome="action"]');
    const studioEmptyTitle = studioEmptyRoot.querySelector(".meowdesk-launch-empty-state-title strong");
    const studioEmptyMeta = studioEmptyRoot.querySelector(".meowdesk-launch-empty-state-meta");
    const studioAddActions = [...studioEmptyRoot.querySelectorAll('[data-studio-agent-add]')];
    const studioPrimaryActions = [...studioEmptyRoot.querySelectorAll('[data-meow-launch-action="primary"]')];
    const studioAction = studioPrimaryActions[0];
    const studioActionStyle = studioAction ? getComputedStyle(studioAction) : null;
    const studioTitleStyle = studioEmptyTitle ? getComputedStyle(studioEmptyTitle) : null;
    const studioMetaStyle = studioEmptyMeta ? getComputedStyle(studioEmptyMeta) : null;
    const studioEmptyState = {
      family: studioEmptyRoot.getAttribute("data-meow-launch-family"),
      variant: studioEmptyRoot.getAttribute("data-meow-launch-variant"),
      iconChrome: studioEmptyIcon?.getAttribute("data-meow-launch-icon-chrome") || "",
      addActionCount: studioAddActions.length,
      primaryActionCount: studioPrimaryActions.length,
      actionRect: studioAction ? rectDebug(studioAction) : null,
      actionRadius: studioActionStyle ? numberFromCss(studioActionStyle.borderTopLeftRadius) : 0,
      actionBackground: studioActionStyle?.backgroundColor || "",
      actionBorderColor: studioActionStyle?.borderColor || "",
      actionBoxShadow: studioActionStyle?.boxShadow || "",
      actionIconRect: studioAction?.querySelector("svg") ? rectDebug(studioAction.querySelector("svg")) : null,
      titleText: studioEmptyTitle?.textContent?.trim() || "",
      titleFontSize: studioTitleStyle?.fontSize || "",
      titleFontWeight: studioTitleStyle?.fontWeight || "",
      metaFontSize: studioMetaStyle?.fontSize || "",
      metaFontWeight: studioMetaStyle?.fontWeight || ""
    };
    if (
      !studioEmptyIcon ||
      studioEmptyState.addActionCount !== 1 ||
      studioEmptyState.primaryActionCount !== 1 ||
      studioEmptyState.actionRadius !== 12 ||
      studioEmptyState.actionRect?.width !== 56 ||
      studioEmptyState.actionRect?.height !== 56 ||
      studioEmptyState.actionIconRect?.width !== 24 ||
      studioEmptyState.actionIconRect?.height !== 24 ||
      isTransparent(studioEmptyState.actionBackground) ||
      studioEmptyState.actionBoxShadow === "none" ||
      studioEmptyState.titleFontSize !== "14px" ||
      Number.parseInt(studioEmptyState.titleFontWeight, 10) < 650 ||
      studioEmptyState.metaFontSize !== "12px" ||
      Number.parseInt(studioEmptyState.metaFontWeight, 10) < 550
    ) {
      throw new Error("Studio empty Agent workstation should use the same agent-work-surface empty-state family with one 56px/12px action button: " + JSON.stringify(studioEmptyState));
    }
    return {
      owner: owner.getAttribute("data-meow-right-sidebar-owner"),
      family: owner.getAttribute("data-meow-right-sidebar-family"),
      motionOwner: owner.getAttribute("data-meow-right-sidebar-motion-owner"),
      rect: rectDebug(owner),
      emptyState: studioEmptyState
    };
  `);
  await captureEvidence("04-studio-shared-right-sidebar", "Studio shared right sidebar owner", { warmupCapture: true });

  const boxScreenshot = screenshotByName.get("02-meow-box-open-hover-drop");
  const topTagScreenshot = screenshotByName.get("03-top-tag-inactive-hover");
  const topTagRailSampleRect = topTagHover?.rect
    ? {
        left: Math.max(0, topTagHover.rect.left - 24),
        top: Math.max(0, topTagHover.rect.top - 14),
        right: topTagHover.rect.left + topTagHover.rect.width + 24,
        bottom: topTagHover.rect.top + topTagHover.rect.height + 14
      }
    : null;
  const screenshotPixelChecks = {
    boxMenuRect: boxScreenshot ? sampleImageRect(boxScreenshot.image, boxDrop.menuRect, 10) : null,
    boxPinZoneRect: boxScreenshot ? sampleImageRect(boxScreenshot.image, boxDrop.pinZoneRect, 4) : null,
    topTagFormerMenuRect: topTagScreenshot ? sampleImageRect(topTagScreenshot.image, boxDrop.menuRect, 10) : null,
    topTagRect: topTagScreenshot ? sampleImageRect(topTagScreenshot.image, topTagHover.rect, 4) : null,
    topTagRailRect: topTagScreenshot && topTagRailSampleRect ? sampleImageRect(topTagScreenshot.image, topTagRailSampleRect, 4) : null
  };
  if (!screenshotPixelChecks.boxMenuRect || screenshotPixelChecks.boxMenuRect.brightRatio < 0.12) {
    throw new Error("Tenth batch Meow Box screenshot should visibly contain the open menu: " + JSON.stringify(screenshotPixelChecks.boxMenuRect));
  }
  if (!screenshotPixelChecks.boxPinZoneRect || screenshotPixelChecks.boxPinZoneRect.brightRatio < 0.1) {
    throw new Error("Tenth batch Meow Box screenshot should visibly contain the active sidebar pin drop target; blue color is guarded by computed style: " + JSON.stringify(screenshotPixelChecks.boxPinZoneRect));
  }
  if (!screenshotPixelChecks.topTagFormerMenuRect || screenshotPixelChecks.topTagFormerMenuRect.brightRatio > 0.08 || screenshotPixelChecks.topTagFormerMenuRect.blueRatio > 0.01) {
    throw new Error("Tenth batch top tag screenshot should not retain the previous Meow Box menu in the former menu rectangle: " + JSON.stringify(screenshotPixelChecks.topTagFormerMenuRect));
  }
  if (!screenshotPixelChecks.topTagRailRect || screenshotPixelChecks.topTagRailRect.greenRatio < 0.08) {
    throw new Error("Tenth batch top tag screenshot should visibly contain green hover glow in the top surface rail; exact tag rect can move during push animation: " + JSON.stringify(screenshotPixelChecks.topTagRailRect));
  }

  if (debuggerAttached) {
    try {
      win.webContents.debugger.detach();
    } catch {
      // Best-effort cleanup for smoke-only DevTools hover control.
    }
  }

  const manifest = {
    scenario: "visual-recovery-tenth-batch",
    createdAt: new Date().toISOString(),
    purpose: "Manual visual acceptance evidence pack for the recovered Meowdesk visual baseline. This does not replace Shizuku final visual approval.",
    screenshots,
    evidence: {
      workspaceOverview,
      boxDrop,
      boxHover,
      topTagHover,
      studioOwner,
      screenshotPixelChecks,
      vsLegacyMode: await pageEval(`
        return {
          vsVisual: document.documentElement.dataset.vsVisual || "",
          hasLiveClass: document.documentElement.classList.contains("vs-live-app-mode"),
          visualStageCount: document.querySelectorAll("[data-vs-visual-stage]").length,
          visualBadgeCount: document.querySelectorAll(".vs-visual-badge").length
        };
      `)
    }
  };
  const manifestPath = path.join(evidenceDir, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    scenario: "visual-recovery-tenth-batch",
    evidenceDir,
    manifestPath,
    screenshots,
    evidence: manifest.evidence
  };
}

async function runVisualRecoveryEleventhBatchScenario(win, dependencies = {}, scenario) {
  if (scenario !== "visual-recovery-eleventh-batch") return undefined;

  return win.webContents.executeJavaScript(`
    (async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
      const click = async (selector, wait = 220) => {
        const element = await waitFor(selector);
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
        element.click();
        await delay(wait);
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
      const overlaps = (first, second) => !(
        first.right <= second.left ||
        second.right <= first.left ||
        first.bottom <= second.top ||
        second.bottom <= first.top
      );
      const isVisibleColor = (value) => {
        const text = String(value || "").toLowerCase().replace(/\\s+/g, "");
        return text !== "transparent" && !text.includes("rgba(0,0,0,0)");
      };

      await waitFor('[data-workbench-bridge-status="ready"]');
      await click('aside nav [data-next-route="workspace"]');
      await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
      await click('aside nav [data-next-route="studio"]');
      await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:studio"]');
      await click('aside nav [data-next-route="workspace"]');
      await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');

      const titleCopy = await waitFor('[data-top-nav-title-copy]');
      const subtitle = document.querySelector('[data-top-nav-subtitle]');
      if (subtitle) {
        throw new Error("TopNav should render only the feature page name; subtitle copy must not be visible in the title cluster: " + JSON.stringify({
          subtitle: subtitle.textContent.trim(),
          rect: rectDebug(subtitle)
        }));
      }
      const runningSurfaces = await waitFor('[data-top-nav-running-surfaces]');
      const topTags = [...runningSurfaces.querySelectorAll('[data-meow-top-surface-main]')];
      if (topTags.length < 2) {
        throw new Error("Eleventh batch expects Workspace and Studio top surface tags to be visible.");
      }

      const titleCopyRect = titleCopy.getBoundingClientRect();
      const tagDebug = topTags.map(rectDebug);
      const titleOverlapTags = topTags.map((tag) => tag.getBoundingClientRect()).filter((rect) => overlaps(titleCopyRect, rect));
      if (titleOverlapTags.length > 0) {
        throw new Error("TopNav title should not overlap top surface tags after subtitle removal: " + JSON.stringify({
          titleCopy: rectDebug(titleCopy),
          tags: tagDebug,
          overlapTags: titleOverlapTags.map((rect) => ({
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }))
        }));
      }

      const meowBoxTrigger = await waitFor('[data-meow-box-trigger]');
      const triggerIcon = meowBoxTrigger.querySelector('svg');
      if (!triggerIcon) {
        throw new Error("Meow Box trigger must keep its icon mounted in collapsed sidebar mode.");
      }
      const iconRect = rectDebug(triggerIcon);
      const iconStyle = getComputedStyle(triggerIcon);
      if (iconRect.width < 14 || iconRect.height < 14 || !isVisibleColor(iconStyle.color) || iconStyle.opacity === "0") {
        throw new Error("Meow Box trigger icon must remain visibly sized and colored: " + JSON.stringify({
          trigger: rectDebug(meowBoxTrigger),
          icon: iconRect,
          color: iconStyle.color,
          opacity: iconStyle.opacity
        }));
      }
      const workspaceSidebarRoute = await waitFor('aside .meowdesk-sidebar-route[data-next-route="workspace"]');
      const workspaceRect = workspaceSidebarRoute.getBoundingClientRect();
      const triggerRect = meowBoxTrigger.getBoundingClientRect();
      const centerDelta = Math.abs((workspaceRect.left + workspaceRect.width / 2) - (triggerRect.left + triggerRect.width / 2));
      if (centerDelta > 1.5 || Math.abs(triggerRect.width - workspaceRect.width) > 1.5 || Math.abs(triggerRect.height - workspaceRect.height) > 1.5) {
        throw new Error("Meow Box trigger should align with the collapsed sidebar action column instead of drifting sideways: " + JSON.stringify({
          workspaceRoute: rectDebug(workspaceSidebarRoute),
          meowBoxTrigger: rectDebug(meowBoxTrigger),
          centerDelta
        }));
      }
      if (document.querySelector('[data-product-shell-sidebar-pin-zone]')) {
        throw new Error("Sidebar pin zone should stay hidden until a route is dragged; it must not look like a resting sidebar action.");
      }

      const residue = document.querySelector([
        ".vs-energy-title",
        ".vs-title-scan-bar",
        ".hover-text",
        ".vs-picker-dialog-mouse",
        "[data-vs-picker-live]",
        "[data-vs-meow-box-ready]",
        "[data-vs-box-drop-active]",
        "[data-vs-top-surface-tag]",
        ".vs-top-surface-tag",
        ".vs-live-app-mode",
        "[data-vs-visual-stage]",
        ".vs-visual-badge",
        "[data-vs-surface-close-dialog]"
      ].join(","));
      if (residue) {
        throw new Error("Eleventh batch should not expose live VS residue: " + residue.outerHTML.slice(0, 520));
      }

      return {
        scenario: "visual-recovery-eleventh-batch",
        subtitleVisible: false,
        titleCopy: rectDebug(titleCopy),
        tags: tagDebug,
        meowBoxTrigger: rectDebug(meowBoxTrigger),
        meowBoxIcon: iconRect,
        meowBoxAlignment: {
          workspaceRoute: rectDebug(workspaceSidebarRoute),
          centerDelta: Math.round(centerDelta * 100) / 100
        },
        vsLegacyMode: {
          vsVisual: document.documentElement.dataset.vsVisual || "",
          hasLiveClass: document.documentElement.classList.contains("vs-live-app-mode"),
          visualStageCount: document.querySelectorAll("[data-vs-visual-stage]").length,
          visualBadgeCount: document.querySelectorAll(".vs-visual-badge").length
        }
      };
    })()
  `, true);
}

async function runVisualRecoveryThirteenthBatchScenario(win, dependencies = {}, scenario) {
  if (scenario !== "visual-recovery-thirteenth-batch") return undefined;

  return win.webContents.executeJavaScript(`
    (async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const nextPaint = () => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
      const click = async (selector, wait = 120) => {
        const element = await waitFor(selector);
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
        element.click();
        await delay(wait);
        return element;
      };
      const hasAnimation = (name, expected) => String(name || "").split(",").map((item) => item.trim()).includes(expected);
      const readStyleSample = (element, pseudo = null) => {
        const style = getComputedStyle(element, pseudo);
        return {
          performanceNow: Math.round(performance.now()),
          timelineTime: Math.round(document.timeline?.currentTime || 0),
          animations: pseudo ? [] : element.getAnimations().map((animation) => ({
            name: animation.animationName || "",
            currentTime: animation.currentTime == null ? null : Math.round(animation.currentTime),
            playState: animation.playState || "",
            effectTargetClass: String(animation.effect?.target?.className || "")
          })),
          display: style.display,
          visibility: style.visibility,
          position: style.position,
          animationName: style.animationName,
          animationPlayState: style.animationPlayState,
          animationDuration: style.animationDuration,
          animationDelay: style.animationDelay,
          opacity: style.opacity,
          width: style.width,
          transform: style.transform,
          left: style.left,
          clipPath: style.clipPath,
          boxShadow: style.boxShadow
        };
      };
      const assertStyleChanges = async (element, pseudo, label, fields, waits = [620, 620]) => {
        const samples = [readStyleSample(element, pseudo)];
        for (const wait of waits) {
          await delay(wait);
          samples.push(readStyleSample(element, pseudo));
        }
        const changedFields = fields.filter((field) => new Set(samples.map((sample) => sample[field])).size > 1);
        if (!changedFields.length) {
          throw new Error(label + " should change over time, not just declare animation-name: " + JSON.stringify({ pseudo, fields, samples }));
        }
        return { samples, changedFields };
      };
      const readTimelineSample = (animation, element, pseudo = null) => {
        const style = getComputedStyle(element, pseudo);
        return {
          animationName: animation.animationName || "",
          currentTime: animation.currentTime == null ? null : Math.round(animation.currentTime),
          playState: animation.playState || "",
          display: style.display,
          visibility: style.visibility,
          position: style.position,
          opacity: style.opacity,
          width: style.width,
          transform: style.transform,
          left: style.left,
          clipPath: style.clipPath,
          boxShadow: style.boxShadow
        };
      };
      const findAnimation = (target, pseudo, expectedName) => {
        const animations = target.getAnimations({ subtree: true });
        const animation = animations.find((candidate) => {
          const effectTarget = candidate.effect?.target;
          const effectPseudo = candidate.effect?.pseudoElement || null;
          return candidate.animationName === expectedName &&
            effectTarget === target &&
            (!pseudo || effectPseudo === pseudo);
        });
        return { animation, animations };
      };
      const assertAnimationTimelineChanges = async (target, pseudo, label, expectedName, fields, offsets = [0, 0.32, 0.56, 0.82]) => {
        const { animation, animations } = findAnimation(target, pseudo, expectedName);
        if (!animation) {
          throw new Error(label + " should expose a Web Animations timeline for " + expectedName + ": " + JSON.stringify(animations.map((candidate) => ({
            name: candidate.animationName || "",
            playState: candidate.playState || "",
            effectPseudo: candidate.effect?.pseudoElement || "",
            effectTargetClass: String(candidate.effect?.target?.className || "")
          }))));
        }
        const timing = animation.effect?.getTiming?.() || {};
        const duration = Number(timing.duration) || 1000;
        animation.pause();
        const samples = [];
        for (const offset of offsets) {
          animation.currentTime = Math.max(0, Math.min(duration, duration * offset));
          void target.offsetWidth;
          samples.push(readTimelineSample(animation, target, pseudo));
        }
        animation.cancel();
        const changedFields = fields.filter((field) => new Set(samples.map((sample) => sample[field])).size > 1);
        if (!changedFields.length) {
          throw new Error(label + " should change across its Meowdesk animation timeline: " + JSON.stringify({ expectedName, pseudo, fields, duration, samples }));
        }
        return { samples, changedFields, sampleMode: "web-animations-timeline", expectedName, duration };
      };
      const waitForAnimation = async (target, pseudo, expectedName, label, timeout = 9000) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt <= timeout) {
          const { animation } = findAnimation(target, pseudo, expectedName);
          const style = getComputedStyle(target, pseudo);
          if (animation && hasAnimation(style.animationName, expectedName)) return animation;
          await delay(50);
        }
        throw new Error(label + " should expose animation " + expectedName + " within " + timeout + "ms");
      };
      const waitForAnyAnimation = async (target, pseudo, expectedNames, label, timeout = 9000) => {
        const startedAt = Date.now();
        let lastDebug = null;
        while (Date.now() - startedAt <= timeout) {
          const style = getComputedStyle(target, pseudo);
          const computedNames = String(style.animationName || "").split(",").map((item) => item.trim());
          const { animations } = findAnimation(target, pseudo, expectedNames[0]);
          lastDebug = {
            pseudo,
            expectedNames,
            computedAnimation: style.animationName,
            computedOpacity: style.opacity,
            computedBoxShadow: style.boxShadow,
            dataset: { ...target.dataset },
            matchesHover: target.matches(":hover"),
            matchesFocusWithin: target.matches(":focus-within"),
            outerHTML: target.outerHTML.slice(0, 900),
            animations: animations.map((candidate) => ({
              name: candidate.animationName || "",
              playState: candidate.playState || "",
              effectPseudo: candidate.effect?.pseudoElement || "",
              effectTargetClass: String(candidate.effect?.target?.className || "")
            }))
          };
          for (const expectedName of expectedNames) {
            const { animation } = findAnimation(target, pseudo, expectedName);
            if (animation && computedNames.includes(expectedName)) return expectedName;
          }
          await delay(50);
        }
        throw new Error(label + " should expose one of " + expectedNames.join(", ") + " within " + timeout + "ms: " + JSON.stringify(lastDebug));
      };
      const assertNoVsResidue = (label) => {
        const residue = document.querySelector([
          ".vs-energy-title",
          ".vs-title-scan-bar",
          ".hover-text",
          ".vs-picker-dialog-mouse",
          "[data-vs-picker-live]",
          "[data-vs-meow-box-ready]",
          "[data-vs-box-drop-active]",
          "[data-vs-top-surface-tag]",
          ".vs-top-surface-tag",
          ".vs-live-app-mode",
          "[data-vs-visual-stage]",
          ".vs-visual-badge",
          "[data-vs-surface-close-dialog]"
        ].join(","));
        if (residue) {
          throw new Error(label + " should not expose live VS residue: " + residue.outerHTML.slice(0, 520));
        }
      };
      const waitForPageState = (predicate, label, timeout = 9000) => new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const tick = () => {
          try {
            const value = predicate();
            if (value) {
              resolve(value);
              return;
            }
          } catch {
            // Keep polling until the route commit is visible.
          }
          if (Date.now() - startedAt > timeout) {
            reject(new Error("Timed out waiting for " + label));
            return;
          }
          setTimeout(tick, 16);
        };
        tick();
      });
      const waitForTopRailMotion = async (titleElement, label, timeout = 1600) => {
        const readRect = (element) => {
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
        const startedAt = Date.now();
        let lastDebug = null;
        while (Date.now() - startedAt <= timeout) {
          const rail = document.querySelector('[data-top-nav-running-surfaces] [data-product-shell-top-surface-rail]');
          if (rail) {
            const style = getComputedStyle(rail);
            lastDebug = {
              motion: rail.getAttribute("data-top-nav-surface-motion"),
              transform: style.transform,
              rail: readRect(rail),
              title: readRect(titleElement)
            };
            if (lastDebug.motion === "magnet" && style.transform !== "none") return { rail, sample: lastDebug };
          }
          await delay(25);
        }
        throw new Error(label + " should animate the real top-surface rail with Meowdesk-owned magnet motion: " + JSON.stringify(lastDebug));
      };
      const assertTopRailSettlesAfterTitle = async (titleElement, rail, label) => {
        const readRect = (element) => {
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
        await delay(1500);
        const titleRect = titleElement.getBoundingClientRect();
        const railRect = rail.getBoundingClientRect();
        const gap = railRect.left - titleRect.right;
        if (gap < 4) {
          throw new Error(label + " should settle without overlapping the title: " + JSON.stringify({
            title: readRect(titleElement),
            rail: readRect(rail),
            gap: Math.round(gap * 100) / 100,
            motion: rail.getAttribute("data-top-nav-surface-motion"),
            transform: getComputedStyle(rail).transform
          }));
        }
        return { title: readRect(titleElement), rail: readRect(rail), gap: Math.round(gap * 100) / 100 };
      };
      const sampleTitleMotionAfterRouteChange = async (routeId, titleText, label) => {
        await click('aside nav [data-next-route="' + routeId + '"]', 0);
        const title = await waitForPageState(() => {
          const registry = document.querySelector('[data-open-surface-registry="true"]');
          const title = document.querySelector('[data-top-nav-title]');
          return registry?.getAttribute("data-open-surface-active") === "surface:route:" + routeId &&
            String(title?.textContent || "").includes(titleText)
            ? title
            : null;
        }, label + " route title");
        const scanText = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-scan-text');
        const scanBar = await waitFor('[data-top-nav-title] .meowdesk-top-nav-title-scan-bar');
        const runningSurfaces = await waitFor('[data-top-nav-running-surfaces]');
        const scanTextStyle = readStyleSample(scanText);
        const scanBarStyle = readStyleSample(scanBar);
        const railMotion = await waitForTopRailMotion(title, label + " top surface rail");
        if (
          !hasAnimation(scanTextStyle.animationName, "meowdesk-title-scan-reveal") ||
          !hasAnimation(scanBarStyle.animationName, "meowdesk-title-scan-bar") ||
          scanTextStyle.transform !== "none" ||
          String(scanTextStyle.clipPath || "").includes("none") ||
          runningSurfaces.getAttribute("data-top-nav-surface-push") !== "true"
        ) {
          throw new Error(label + " should declare Meowdesk-owned clipped title scan and measured rail magnet motion: " + JSON.stringify({
            scanText: scanTextStyle,
            scanBar: scanBarStyle,
            runningSurfacePush: runningSurfaces.getAttribute("data-top-nav-surface-push"),
            railMotion: railMotion.sample
          }));
        }
        const railSettlement = await assertTopRailSettlesAfterTitle(title, railMotion.rail, label + " top surface rail");
        return {
          scanText: await assertAnimationTimelineChanges(scanText, null, label + " scan text clipped reveal", "meowdesk-title-scan-reveal", ["opacity", "clipPath"]),
          scanBar: await assertAnimationTimelineChanges(scanBar, null, label + " scan bar sweep", "meowdesk-title-scan-bar", ["left", "boxShadow"]),
          railMotion: railMotion.sample,
          railSettlement
        };
      };

      await waitFor('[data-workbench-bridge-status="ready"]');
      await click('aside nav [data-next-route="workspace"]', 60);
      await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');
      const titleScanMotion = {
        studio: await sampleTitleMotionAfterRouteChange("studio", "工坊", "Studio"),
        workspace: await sampleTitleMotionAfterRouteChange("workspace", "工作区", "Workspace")
      };
      await waitFor('[data-r2-workspace-route]');

      const activeSidebar = await waitFor('aside .meowdesk-sidebar-route[data-next-route="workspace"][aria-current="page"]');
      const activeSidebarStyle = readStyleSample(activeSidebar, "::after");
      if (!hasAnimation(activeSidebarStyle.animationName, "meowdesk-sidebar-active-pulse")) {
        throw new Error("Active sidebar glow should keep its pulse animation on the Meowdesk owner: " + JSON.stringify(activeSidebarStyle));
      }
      const sidebarPulse = await assertAnimationTimelineChanges(
        activeSidebar,
        "::after",
        "Active sidebar blue glow",
        "meowdesk-sidebar-active-pulse",
        ["opacity", "transform"],
        [0, 0.5, 1]
      );

      await click('[data-r2-workspace-slot-button="1"]', 80);
      await waitFor('[data-r2-workspace-panes][data-r2-workspace-pane-count="1"]');
      await click('[data-r2-workspace-slot-button="2"]', 40);
      const newPane = await waitFor('[data-r2-workspace-pane="blank-2"][data-r2-workspace-pane-new="true"]');
      const newPaneMotion = await assertAnimationTimelineChanges(newPane, null, "Workspace new pane enter", "meowdesk-workspace-pane-enter", ["opacity", "transform"], [0, 0.45, 1]);

      await click('[data-r2-workspace-configure-pane="blank-2"]', 80);
      await waitFor('[data-r2-workspace-config-dialog]');
      await waitFor('[data-r2-workspace-config-tool="smoke-terminal"]');
      await click('[data-r2-workspace-config-tool="smoke-terminal"]', 40);
      const configuredPane = await waitFor('[data-r2-workspace-pane="blank-2"][data-r2-workspace-pane-configured-pulse="true"][data-r2-workspace-pane-kind="terminal"]');
      const configuredPaneMotion = await assertAnimationTimelineChanges(configuredPane, null, "Workspace configured pane pulse", "meowdesk-workspace-pane-configured", ["transform", "boxShadow"], [0, 0.5, 1]);
      const configuredPulseCardBreath = {
        before: await assertAnimationTimelineChanges(configuredPane, "::before", "Configured pane pulse outer card breath", "meowdesk-card-breath", ["opacity", "boxShadow"], [0, 0.42, 0.76, 1]),
        after: await assertAnimationTimelineChanges(configuredPane, "::after", "Configured pane pulse inner card breath", "meowdesk-card-inner-breath", ["opacity", "boxShadow"], [0, 0.42, 0.76, 1])
      };
      await waitForPageState(
        () => configuredPane.getAttribute("data-r2-workspace-pane-configured-pulse") !== "true" ? configuredPane : null,
        "Configured pane pulse handoff"
      );
      const ambientBeforeName = await waitForAnyAnimation(
        configuredPane,
        "::before",
        ["meowdesk-card-ambient-breath", "meowdesk-card-breath"],
        "Configured pane post-pulse outer card breath"
      );
      const ambientAfterName = await waitForAnyAnimation(
        configuredPane,
        "::after",
        ["meowdesk-card-ambient-inner-breath", "meowdesk-card-inner-breath"],
        "Configured pane post-pulse inner card breath"
      );
      const configuredAmbientCardBreath = {
        before: await assertAnimationTimelineChanges(configuredPane, "::before", "Configured pane post-pulse outer card breath", ambientBeforeName, ["opacity", "boxShadow"], [0, 0.46, 0.78, 1]),
        after: await assertAnimationTimelineChanges(configuredPane, "::after", "Configured pane post-pulse inner card breath", ambientAfterName, ["opacity", "boxShadow"], [0, 0.46, 0.78, 1])
      };

      assertNoVsResidue("visual recovery thirteenth motion ledger");
      return {
        scenario: "visual-recovery-thirteenth-batch",
        titleScanMotion,
        sidebarPulse,
        workspaceMotion: {
          newPaneMotion,
          configuredPaneMotion,
          configuredPulseCardBreath,
          configuredAmbientCardBreath
        },
        vsLegacyMode: {
          vsVisual: document.documentElement.dataset.vsVisual || "",
          hasLiveClass: document.documentElement.classList.contains("vs-live-app-mode"),
          visualStageCount: document.querySelectorAll("[data-vs-visual-stage]").length,
          visualBadgeCount: document.querySelectorAll(".vs-visual-badge").length
        }
      };
    })()
  `, true);
}

async function runVisualRecoveryFourteenthBatchScenario(win, dependencies = {}, scenario) {
  if (scenario !== "visual-recovery-fourteenth-batch") return undefined;

  return win.webContents.executeJavaScript(`
    (async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
      const click = async (selector, wait = 220) => {
        const element = await waitFor(selector);
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
        element.click();
        await delay(wait);
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
      const styleDebug = (element) => {
        const style = getComputedStyle(element);
        return {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          color: style.color,
          stroke: style.stroke,
          fill: style.fill,
          borderColor: style.borderColor,
          boxShadow: style.boxShadow
        };
      };
      const visibleRect = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
      };
      const parseColor = (value) => {
        const text = String(value || "").trim();
        if (!text || text === "transparent") return null;
        const srgbMatch = text.match(/^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)$/);
        if (srgbMatch) {
          return {
            r: Number(srgbMatch[1]) * 255,
            g: Number(srgbMatch[2]) * 255,
            b: Number(srgbMatch[3]) * 255,
            a: Number.isFinite(Number(srgbMatch[4])) ? Number(srgbMatch[4]) : 1
          };
        }
        const match = text.match(/rgba?\\(([^)]+)\\)/);
        if (!match) return null;
        const parts = match[1].replace("/", " ").split(/[\\s,]+/).filter(Boolean).map((part) => Number.parseFloat(part.trim()));
        if (parts.length < 3 || parts.some((part, index) => index < 3 && !Number.isFinite(part))) return null;
        return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
      };
      const visiblePaint = (element) => {
        const style = getComputedStyle(element);
        const color = parseColor(style.color);
        const stroke = parseColor(style.stroke);
        const fill = parseColor(style.fill);
        return Boolean(
          (color && color.a > 0.2) ||
          (stroke && stroke.a > 0.2) ||
          (fill && fill.a > 0.2)
        );
      };
      const hasBlue = (value) => {
        const text = String(value || "").toLowerCase();
        return text.includes("0 140 255") || text.includes("0, 140, 255") || text.includes("rgb(0 140 255") || text.includes("rgb(0, 140, 255)");
      };
      const assertIconVisible = (icon, label, minSize = 14) => {
        const rect = rectDebug(icon);
        if (!visibleRect(icon) || rect.width < minSize || rect.height < minSize || !visiblePaint(icon)) {
          throw new Error(label + " should keep a visible icon, not an empty glow shell: " + JSON.stringify({
            rect,
            style: styleDebug(icon),
            outerHTML: icon.outerHTML.slice(0, 520)
          }));
        }
        return {
          rect,
          style: styleDebug(icon)
        };
      };

      await waitFor('[data-workbench-bridge-status="ready"]');
      await click('aside nav [data-next-route="workspace"]');
      await waitFor('[data-open-surface-registry="true"][data-open-surface-active="surface:route:workspace"]');

      const trigger = await waitFor('[data-meow-box-trigger][data-meow-box-owner="product-shell"][data-meow-box-family="product-shell-meow-box"]');
      const triggerIcon = trigger.querySelector('svg');
      if (!triggerIcon) {
        throw new Error("Fourteenth batch expects Meow Box trigger to keep its Boxes icon mounted.");
      }
      const triggerIconEvidence = assertIconVisible(triggerIcon, "Meow Box trigger icon");

      await click('[data-meow-box-trigger]', 180);
      const menu = await waitFor('[data-meow-box-menu][data-meow-box-ready="true"]');
      const workflowLaunch = await waitFor('[data-meow-box-launch="obsidian"][data-meow-box-launch-draggable="true"]');
      const dataTransfer = new DataTransfer();
      dataTransfer.effectAllowed = "move";
      dataTransfer.setData("application/x-meowdesk-product-shell-route", "obsidian");
      dataTransfer.setData("text/plain", "obsidian");
      workflowLaunch.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
      const pinZone = await waitFor('[data-product-shell-sidebar-pin-zone]');
      const pinIcon = await waitFor('[data-product-shell-sidebar-pin-zone-icon]');
      pinZone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer }));
      pinZone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      await delay(180);

      const pinZoneStyle = getComputedStyle(pinZone);
      const pinIconEvidence = assertIconVisible(pinIcon, "Sidebar pin zone icon");
      if (
        pinZone.getAttribute("data-product-shell-sidebar-pin-zone-active") !== "true" ||
        pinZoneStyle.boxShadow === "none" ||
        !hasBlue(pinZoneStyle.boxShadow + " " + pinZoneStyle.borderColor)
      ) {
        throw new Error("Sidebar pin zone should show active blue drop feedback with a visible icon: " + JSON.stringify({
          active: pinZone.getAttribute("data-product-shell-sidebar-pin-zone-active"),
          pinZone: rectDebug(pinZone),
          pinZoneStyle: styleDebug(pinZone),
          pinIcon: pinIconEvidence
        }));
      }

      const residue = document.querySelector([
        ".vs-energy-title",
        ".vs-title-scan-bar",
        ".hover-text",
        ".vs-picker-dialog-mouse",
        "[data-vs-picker-live]",
        "[data-vs-meow-box-ready]",
        "[data-vs-box-drop-active]",
        "[data-vs-top-surface-tag]",
        ".vs-top-surface-tag",
        ".vs-live-app-mode",
        "[data-vs-visual-stage]",
        ".vs-visual-badge",
        "[data-vs-surface-close-dialog]"
      ].join(","));
      if (residue) {
        throw new Error("Fourteenth batch should not expose live VS residue: " + residue.outerHTML.slice(0, 520));
      }

      return {
        scenario: "visual-recovery-fourteenth-batch",
        meowBoxTrigger: {
          rect: rectDebug(trigger),
          icon: triggerIconEvidence,
          open: trigger.getAttribute("data-meow-box-open"),
          owner: trigger.getAttribute("data-meow-box-owner"),
          family: trigger.getAttribute("data-meow-box-family")
        },
        meowBoxMenu: {
          rect: rectDebug(menu),
          ready: menu.getAttribute("data-meow-box-ready"),
          owner: menu.getAttribute("data-meow-box-owner"),
          family: menu.getAttribute("data-meow-box-family")
        },
        sidebarPinZone: {
          rect: rectDebug(pinZone),
          active: pinZone.getAttribute("data-product-shell-sidebar-pin-zone-active"),
          style: styleDebug(pinZone),
          icon: pinIconEvidence
        },
        vsLegacyMode: {
          vsVisual: document.documentElement.dataset.vsVisual || "",
          hasLiveClass: document.documentElement.classList.contains("vs-live-app-mode"),
          visualStageCount: document.querySelectorAll("[data-vs-visual-stage]").length,
          visualBadgeCount: document.querySelectorAll(".vs-visual-badge").length
        }
      };
    })()
  `, true);
}

async function runVisualRecoveryFifteenthBatchScenario(win, dependencies = {}, scenario) {
  if (scenario !== "visual-recovery-fifteenth-batch") return undefined;

  return win.webContents.executeJavaScript(`
    (async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = (selector, timeout = 9000) => new Promise((resolve, reject) => {
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
      const waitForPageState = (predicate, label, timeout = 9000) => new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const tick = () => {
          try {
            const value = predicate();
            if (value) {
              resolve(value);
              return;
            }
          } catch {
            // Keep polling until route state is committed.
          }
          if (Date.now() - startedAt > timeout) {
            reject(new Error("Timed out waiting for " + label));
            return;
          }
          setTimeout(tick, 50);
        };
        tick();
      });
      const clickElement = async (element, wait = 160) => {
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
        element.click();
        await delay(wait);
        return element;
      };
      const click = async (selector, wait = 160) => clickElement(await waitFor(selector), wait);
      const navigateRoute = async (id) => {
        const navButton = document.querySelector('[data-next-route="' + id + '"]');
        if (navButton) {
          await clickElement(navButton, 220);
          return;
        }
        const nextHash = "#" + id;
        if (window.location.hash !== nextHash) window.location.hash = nextHash;
        else window.dispatchEvent(new HashChangeEvent("hashchange"));
        await delay(260);
      };
      const isVisible = (element) => {
        if (!element) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05 && rect.width > 1 && rect.height > 1;
      };
      const rectDebug = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      };
      const readTimelineSample = (animation, element, pseudo) => {
        const style = getComputedStyle(element, pseudo);
        return {
          animationName: animation.animationName || "",
          currentTime: animation.currentTime == null ? null : Math.round(animation.currentTime),
          playState: animation.playState || "",
          opacity: style.opacity,
          boxShadow: style.boxShadow
        };
      };
      const assertPseudoTimeline = async (element, pseudo, expectedName, label) => {
        const animations = element.getAnimations({ subtree: true });
        const animation = animations.find((candidate) => {
          const effectTarget = candidate.effect?.target;
          const effectPseudo = candidate.effect?.pseudoElement || null;
          return candidate.animationName === expectedName &&
            effectTarget === element &&
            effectPseudo === pseudo;
        });
        const computed = getComputedStyle(element, pseudo);
        if (!animation || !String(computed.animationName || "").split(",").map((item) => item.trim()).includes(expectedName)) {
          throw new Error(label + " should expose Meowdesk-owned ambient card breath timeline: " + JSON.stringify({
            expectedName,
            pseudo,
            computedAnimation: computed.animationName,
            animations: animations.map((candidate) => ({
              name: candidate.animationName || "",
              playState: candidate.playState || "",
              effectPseudo: candidate.effect?.pseudoElement || "",
              targetClass: String(candidate.effect?.target?.className || "")
            }))
          }));
        }
        const timing = animation.effect?.getTiming?.() || {};
        const duration = Number(timing.duration) || 1000;
        animation.pause();
        const samples = [];
        for (const offset of [0, 0.46, 0.78, 1]) {
          animation.currentTime = Math.max(0, Math.min(duration, duration * offset));
          void element.offsetWidth;
          samples.push(readTimelineSample(animation, element, pseudo));
        }
        animation.play();
        const changedFields = ["opacity", "boxShadow"].filter((field) => new Set(samples.map((sample) => sample[field])).size > 1);
        if (!changedFields.length) {
          throw new Error(label + " should change opacity or glow across the ambient card timeline: " + JSON.stringify({ expectedName, pseudo, duration, samples }));
        }
        return { expectedName, pseudo, duration, changedFields, samples };
      };
      const opacityValue = (value) => {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };
      const getPseudoAnimation = (element, pseudo, expectedName) => {
        return element.getAnimations({ subtree: true }).find((candidate) => {
          const effectTarget = candidate.effect?.target;
          const effectPseudo = candidate.effect?.pseudoElement || null;
          return candidate.animationName === expectedName &&
            effectTarget === element &&
            effectPseudo === pseudo;
        });
      };
      const assertHoverContinuity = async (card, label) => {
        const idleBefore = getComputedStyle(card, "::before");
        const idleAfter = getComputedStyle(card, "::after");
        const idle = {
          beforeAnimation: idleBefore.animationName,
          afterAnimation: idleAfter.animationName,
          beforeOpacity: opacityValue(idleBefore.opacity),
          afterOpacity: opacityValue(idleAfter.opacity),
          beforeShadow: idleBefore.boxShadow,
          afterShadow: idleAfter.boxShadow
        };
        if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "-1");
        card.focus({ preventScroll: true });
        card.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
        await delay(80);
        const beforeAnimation = getPseudoAnimation(card, "::before", "meowdesk-card-ambient-breath");
        const afterAnimation = getPseudoAnimation(card, "::after", "meowdesk-card-ambient-inner-breath");
        const hoverBefore = getComputedStyle(card, "::before");
        const hoverAfter = getComputedStyle(card, "::after");
        const hover = {
          beforeAnimation: hoverBefore.animationName,
          afterAnimation: hoverAfter.animationName,
          beforeOpacity: opacityValue(hoverBefore.opacity),
          afterOpacity: opacityValue(hoverAfter.opacity),
          beforeShadow: hoverBefore.boxShadow,
          afterShadow: hoverAfter.boxShadow,
          outerScale: getComputedStyle(card).getPropertyValue("--meowdesk-card-breath-opacity-scale").trim(),
          outerGlowScale: getComputedStyle(card).getPropertyValue("--meowdesk-card-breath-glow-scale").trim(),
          innerScale: getComputedStyle(card).getPropertyValue("--meowdesk-card-breath-inner-opacity-scale").trim(),
          innerGlowScale: getComputedStyle(card).getPropertyValue("--meowdesk-card-breath-inner-glow-scale").trim()
        };
        beforeAnimation?.play();
        afterAnimation?.play();
        if (
          !String(hover.beforeAnimation || "").split(",").map((item) => item.trim()).includes("meowdesk-card-ambient-breath") ||
          !String(hover.afterAnimation || "").split(",").map((item) => item.trim()).includes("meowdesk-card-ambient-inner-breath") ||
          hover.beforeOpacity <= idle.beforeOpacity + 0.03 ||
          hover.afterOpacity <= idle.afterOpacity + 0.03
        ) {
          throw new Error(label + " focus/hover entry should light only the active card with the shared ambient card glow timeline: " + JSON.stringify({ idle, hover }));
        }
        card.blur();
        return { idle, hover };
      };
      const assertAmbientCard = async (selector, label) => {
        const card = await waitForPageState(() => {
          const element = document.querySelector(selector);
          return isVisible(element) ? element : null;
        }, label + " visible card");
        const idleBefore = getComputedStyle(card, "::before");
        const idleAfter = getComputedStyle(card, "::after");
        const idle = {
          beforeAnimation: idleBefore.animationName,
          afterAnimation: idleAfter.animationName,
          beforeOpacity: opacityValue(idleBefore.opacity),
          afterOpacity: opacityValue(idleAfter.opacity)
        };
        if (
          idle.beforeOpacity > 0.02 ||
          idle.afterOpacity > 0.02 ||
          idle.beforeAnimation !== "none" ||
          idle.afterAnimation !== "none"
        ) {
          throw new Error(label + " should stay visually quiet until its own hover/focus state: " + JSON.stringify(idle));
        }
        return {
          selector,
          rect: rectDebug(card),
          idle,
          hoverContinuity: await assertHoverContinuity(card, label)
        };
      };
      const assertNoVsResidue = (label) => {
        const residue = document.querySelector([
          ".vs-energy-title",
          ".vs-title-scan-bar",
          ".hover-text",
          ".vs-picker-dialog-mouse",
          "[data-vs-picker-live]",
          "[data-vs-meow-box-ready]",
          "[data-vs-box-drop-active]",
          "[data-vs-top-surface-tag]",
          ".vs-top-surface-tag",
          ".vs-live-app-mode",
          "[data-vs-visual-stage]",
          ".vs-visual-badge",
          "[data-vs-surface-close-dialog]"
        ].join(","));
        if (residue) {
          throw new Error(label + " should not expose live VS residue: " + residue.outerHTML.slice(0, 520));
        }
      };

      await waitFor('[data-workbench-bridge-status="ready"]');

      await navigateRoute("lobby");
      await waitFor('[data-lobby-route]');
      const guideTab = document.querySelector('[data-lobby-section-tab="guide"]');
      if (guideTab) await clickElement(guideTab, 220);
      await waitForPageState(() => {
        const route = document.querySelector('[data-lobby-route][data-lobby-active-section="guide"]');
        const cards = route?.querySelectorAll('[data-lobby-guide-path-card]') || [];
        return isVisible(route) && cards.length === 3 && [...cards].every(isVisible) ? route : null;
      }, "Lobby guide shared card family");
      const lobbyGuideCards = [];
      for (const id of ["has-agent", "desktop-agent", "no-agent"]) {
        lobbyGuideCards.push(await assertAmbientCard(
          '[data-lobby-route][data-lobby-active-section="guide"] [data-lobby-guide-path-card="' + id + '"]',
          "Lobby guide " + id + " path card"
        ));
      }

      await navigateRoute("workspace");
      await waitForPageState(() => {
        const route = document.querySelector('[data-route-keepalive="workspace"][data-route-keepalive-active="true"] [data-r2-workspace-route]');
        const owner = route?.querySelector('[data-workspace-right-sidebar-owner][data-workspace-right-sidebar-collapsed="false"]');
        return isVisible(route) && isVisible(owner) ? owner : null;
      }, "Workspace right-sidebar owner");
      const workspaceCard = await assertAmbientCard(
        '[data-route-keepalive="workspace"][data-route-keepalive-active="true"] [data-workspace-right-sidebar-owner] [data-r2-workspace-task-card], [data-route-keepalive="workspace"][data-route-keepalive-active="true"] [data-workspace-right-sidebar-owner] [data-r2-workspace-task-empty]',
        "Workspace right-sidebar task card"
      );

      await navigateRoute("studio");
      await waitForPageState(() => {
        const route = document.querySelector('[data-route-keepalive="studio"][data-route-keepalive-active="true"] [data-studio-route]');
        const owner = route?.querySelector('[data-workspace-right-sidebar-owner][data-workspace-right-sidebar-collapsed="false"]');
        return isVisible(route) && isVisible(owner) ? owner : null;
      }, "Studio right-sidebar owner");
      const projectsTab = document.querySelector('[data-studio-inspector-panel-tab="projects"]');
      if (projectsTab) await clickElement(projectsTab, 180);
      const studioCard = await assertAmbientCard(
        '[data-route-keepalive="studio"][data-route-keepalive-active="true"] [data-workspace-right-sidebar-owner] [data-studio-project-item]',
        "Studio shared right-sidebar project card"
      );

      assertNoVsResidue("visual recovery fifteenth ambient card ledger");
      return {
        scenario: "visual-recovery-fifteenth-batch",
        lobbyGuideCards,
        workspaceCard,
        studioCard,
        vsLegacyMode: {
          vsVisual: document.documentElement.dataset.vsVisual || "",
          hasLiveClass: document.documentElement.classList.contains("vs-live-app-mode"),
          visualStageCount: document.querySelectorAll("[data-vs-visual-stage]").length,
          visualBadgeCount: document.querySelectorAll(".vs-visual-badge").length
        }
      };
    })()
  `, true);
}

const shellSmokeScenarios = Object.freeze({
  "workbench-bridge": runWorkbenchBridgeScenario,
  "compact-layout": runCompactLayoutScenario,
  "next-route-hash": runNextRouteHashScenario,
  "phase-six-route-reachability": runPhaseSixRouteReachabilityScenario,
  "top-surface-close-visual": runTopSurfaceCloseVisualScenario,
  "data-ownership-home-backed": runDataOwnershipHomeBackedScenario,
  "visual-recovery-first-batch": runVisualRecoveryFirstBatchScenario,
  "visual-recovery-third-batch": runVisualRecoveryThirdBatchScenario,
  "visual-recovery-fourth-batch": runVisualRecoveryFourthBatchScenario,
  "visual-recovery-fifth-batch": runVisualRecoveryFifthBatchScenario,
  "visual-recovery-sixth-batch": runVisualRecoverySixthBatchScenario,
  "visual-recovery-eighth-batch": runVisualRecoveryEighthBatchScenario,
  "visual-recovery-ninth-batch": runVisualRecoveryNinthBatchScenario,
  "visual-recovery-tenth-batch": runVisualRecoveryTenthBatchScenario,
  "visual-recovery-eleventh-batch": runVisualRecoveryEleventhBatchScenario,
  "visual-recovery-thirteenth-batch": runVisualRecoveryThirteenthBatchScenario,
  "visual-recovery-fourteenth-batch": runVisualRecoveryFourteenthBatchScenario,
  "visual-recovery-fifteenth-batch": runVisualRecoveryFifteenthBatchScenario,
});

module.exports = {
  shellSmokeScenarios
};

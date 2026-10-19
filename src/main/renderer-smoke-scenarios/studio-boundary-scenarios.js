"use strict";

async function runStudioNoDesktopPlaceholderScenario(win, dependencies = {}, scenario) {
  if (scenario === "studio-no-desktop-placeholder") {
    return win.webContents.executeJavaScript(`
      (async () => {
        const scenarioName = ${JSON.stringify(scenario)};
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
        const panel = await waitFor('[data-studio-agent-panel][data-studio-agent-stage-current="workstation"][data-studio-agent-workstation-mode="empty"]');
        await waitFor('[data-studio-agent-terminal-host]');
        if (document.querySelector('[data-studio-agent-stage-switch]')) {
          throw new Error("Studio should expose a single Agent workstation, not a desktop/terminal mode switch.");
        }
        await click('[data-studio-agent-add]');
        await waitFor('[data-studio-agent-picker-dialog]');
        const cliNote = await waitFor('[data-studio-agent-choice-note="cli"]');
        if (!cliNote.textContent.includes("工位终端")) {
          throw new Error("CLI Agent note should explain in-workstation terminal startup: " + cliNote.textContent);
        }
        const cliChoice = await waitFor('[data-studio-agent-choice="smoke-picker-agent"]');
        const forbiddenSelectors = [
          '[data-studio-agent-choice-type="desktop"]',
          '[data-studio-agent-choice="claude-desktop"]',
          '[data-studio-desktop-launch]',
          '[data-studio-desktop-launch-open]',
          '[data-studio-claude-projection]',
          '[data-studio-claude-host-frame]'
        ];
        const leftovers = forbiddenSelectors.flatMap((selector) =>
          [...document.querySelectorAll(selector)].map((element) => ({
            selector,
            text: (element.textContent || "").trim().slice(0, 120)
          }))
        );
        if (leftovers.length) {
          throw new Error("Studio must not keep the removed desktop-Agent placeholder path: " + JSON.stringify(leftovers));
        }
        await click('[data-studio-agent-choice="smoke-picker-agent"]');
        await waitFor('[data-studio-agent-panel][data-studio-agent-stage-current="workstation"][data-studio-agent-workstation-mode="cli"][data-studio-agent-selected="smoke-picker-agent"]');
        await waitFor('[data-studio-agent-meow-viewer-toggle][data-studio-agent-control-owner="header"]');
        await waitFor('[data-studio-agent-stop][data-studio-agent-control-owner="header"]');
        return {
          scenario: scenarioName,
          panelMode: panel.getAttribute("data-studio-agent-stage-current"),
          workstationMode: document.querySelector('[data-studio-agent-panel]')?.getAttribute("data-studio-agent-workstation-mode"),
          cliChoice: cliChoice.textContent.trim(),
          desktopPlaceholderCount: leftovers.length
        };
      })()
    `, true);
  }
}

async function runStudioRuntimeBoundaryScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "studio-runtime-boundary") {
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
          if (!element) return null;
          const style = getComputedStyle(element);
          return {
            display: style.display,
            position: style.position,
            overflow: style.overflow,
            width: style.width,
            minWidth: style.minWidth,
            maxWidth: style.maxWidth,
            gridTemplateColumns: style.gridTemplateColumns,
            gridColumnStart: style.gridColumnStart,
            gridColumnEnd: style.gridColumnEnd,
            gridRowStart: style.gridRowStart,
            gridRowEnd: style.gridRowEnd,
            justifySelf: style.justifySelf,
            justifyContent: style.justifyContent,
            flex: style.flex,
            flexBasis: style.flexBasis,
            marginLeft: style.marginLeft,
            transform: style.transform
          };
        };
        const elementDebug = (element) => element ? {
          tag: element.tagName,
          className: String(element.className || ""),
          attrs: [...element.attributes].reduce((acc, attr) => {
            if (/^(data-|aria-|class$)/.test(attr.name)) acc[attr.name] = attr.value;
            return acc;
          }, {}),
          rect: rectDebug(element),
          style: styleDebug(element),
          parent: element.parentElement ? {
            tag: element.parentElement.tagName,
            className: String(element.parentElement.className || ""),
            attrs: [...element.parentElement.attributes].reduce((acc, attr) => {
              if (/^(data-|aria-|class$)/.test(attr.name)) acc[attr.name] = attr.value;
              return acc;
            }, {}),
            rect: rectDebug(element.parentElement),
            style: styleDebug(element.parentElement)
          } : null,
          closestHeaderRect: element.closest("[data-studio-agent-panel-header]") ? rectDebug(element.closest("[data-studio-agent-panel-header]")) : null
        } : null;
        const studioHeaderControlsDebug = (panelHeader, headerControls, button) => ({
          panelHeader: elementDebug(panelHeader),
          headerControls: elementDebug(headerControls),
          button: elementDebug(button),
          headerCount: document.querySelectorAll("[data-studio-agent-panel-header]").length,
          controlsCount: document.querySelectorAll("[data-studio-agent-header-controls]").length
        });
        const assertStudioSurfaceHeaderHeight = async (selector, label) => {
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
            throw new Error("Studio surface header should use the shared compact 44px panel-header family: " + JSON.stringify({
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
        const isLayoutBox = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" &&
            rect.width > 1 &&
            rect.height > 1;
        };
        const captureStudioInspectorIdentity = async () => {
          const inspector = await waitFor('[data-studio-inspector][data-studio-inspector-layout="side"]');
          const panels = new Map([...inspector.querySelectorAll('[data-studio-inspector-panel]')]
            .map((panel) => [panel.getAttribute("data-studio-inspector-panel"), panel]));
          const projectPanels = new Map([...inspector.querySelectorAll('[data-studio-project-list-panel]')]
            .map((panel) => [panel.getAttribute("data-studio-project-list-panel"), panel]));
          return { inspector, panels, projectPanels };
        };
        const assertStudioInspectorIdentityStable = async (before, label) => {
          const after = await captureStudioInspectorIdentity();
          if (after.inspector !== before.inspector) {
            throw new Error("Studio inspector remounted during " + label + "; this can recreate the auxiliary-panel flash.");
          }
          const changedPanels = [];
          for (const [id, panel] of before.panels) {
            if (after.panels.get(id) !== panel) changedPanels.push(id);
          }
          const changedProjectPanels = [];
          for (const [id, panel] of before.projectPanels) {
            if (after.projectPanels.get(id) !== panel) changedProjectPanels.push(id);
          }
          if (changedPanels.length || changedProjectPanels.length) {
            throw new Error("Studio inspector force-mounted tab panels remounted during " + label + ": " + JSON.stringify({
              changedPanels,
              changedProjectPanels,
              currentPanels: [...after.panels.keys()],
              currentProjectPanels: [...after.projectPanels.keys()]
            }));
          }
          return after;
        };
        const assertStudioInspectorLayout = async (expectedPanel) => {
          const inspector = await waitFor('[data-studio-inspector][data-studio-inspector-layout="side"]');
          const nativeToggle = await waitFor('[data-top-nav] [data-studio-inspector-toggle]');
          const assertSegmentCursorBounded = async (list, label) => {
            const cursor = list?.querySelector(":scope > [data-meow-segment-cursor]");
            if (!list || !cursor) {
              throw new Error("Studio segmented control is missing its local sliding cursor: " + label);
            }
            const deadline = Date.now() + 1500;
            let listRect = list.getBoundingClientRect();
            let cursorRect = cursor.getBoundingClientRect();
            while (
              Date.now() < deadline &&
              (
                cursorRect.width < 8 ||
                cursorRect.height < 8 ||
                cursorRect.left < listRect.left - 2 ||
                cursorRect.top < listRect.top - 2 ||
                cursorRect.right > listRect.right + 2 ||
                cursorRect.bottom > listRect.bottom + 2
              )
            ) {
              await delay(80);
              listRect = list.getBoundingClientRect();
              cursorRect = cursor.getBoundingClientRect();
            }
            if (
              cursor.parentElement !== list ||
              cursorRect.width < 8 ||
              cursorRect.height < 8 ||
              cursorRect.left < listRect.left - 2 ||
              cursorRect.top < listRect.top - 2 ||
              cursorRect.right > listRect.right + 2 ||
              cursorRect.bottom > listRect.bottom + 2
            ) {
              throw new Error("Studio segmented cursor must stay bounded by its own tablist: " + JSON.stringify({
                label,
                list: rectDebug(list),
                cursor: rectDebug(cursor),
                cursorParentMatches: cursor.parentElement === list,
                listVars: {
                  meowX: list.style.getPropertyValue("--meow-segment-x"),
                  meowY: list.style.getPropertyValue("--meow-segment-y"),
                  meowWidth: list.style.getPropertyValue("--meow-segment-width"),
                  meowHeight: list.style.getPropertyValue("--meow-segment-height"),
                  ready: list.getAttribute("data-meow-segment-ready") || "",
                  vsSignature: cursor.getAttribute("data-vs-segment-signature") || ""
                },
                cursorClass: String(cursor.className || ""),
                cursorInlineStyle: cursor.getAttribute("style") || "",
                cursorComputedStyle: {
                  position: getComputedStyle(cursor).position,
                  display: getComputedStyle(cursor).display,
                  boxSizing: getComputedStyle(cursor).boxSizing,
                  width: getComputedStyle(cursor).width,
                  height: getComputedStyle(cursor).height,
                  minWidth: getComputedStyle(cursor).minWidth,
                  minHeight: getComputedStyle(cursor).minHeight,
                  maxWidth: getComputedStyle(cursor).maxWidth,
                  maxHeight: getComputedStyle(cursor).maxHeight,
                  transform: getComputedStyle(cursor).transform,
                  translate: getComputedStyle(cursor).translate,
                  scale: getComputedStyle(cursor).scale,
                  opacity: getComputedStyle(cursor).opacity,
                  visibility: getComputedStyle(cursor).visibility
                }
              }));
            }
          };
          const assertStudioSegmentFamily = async (list, label) => {
            await assertSegmentCursorBounded(list, label);
            const cursor = list?.querySelector(":scope > [data-meow-segment-cursor]");
            const active = list?.querySelector(':scope > [data-meow-segment-trigger][data-state="active"], :scope > [data-meow-segment-trigger][aria-selected="true"]');
            const style = list ? getComputedStyle(list) : null;
            const cursorStyle = cursor ? getComputedStyle(cursor) : null;
            const activeStyle = active ? getComputedStyle(active) : null;
            const listHeight = list?.getBoundingClientRect().height || 0;
            const activeHeight = active?.getBoundingClientRect().height || 0;
            if (
              !list ||
              !cursor ||
              !active ||
              list.getAttribute("data-meow-segment-owner") !== "studio-inspector" ||
              list.getAttribute("data-meow-segment-family") !== "studio-inspector-side" ||
              style.display !== "grid" ||
              listHeight < 46 ||
              activeHeight < 34 ||
              activeStyle.backgroundColor !== "rgba(0, 0, 0, 0)" ||
              cursorStyle.zIndex !== "1" ||
              !String(cursorStyle.backgroundColor || "").includes("0, 140, 255") ||
              !String(cursorStyle.borderTopColor || "").includes("0, 140, 255")
            ) {
              throw new Error("Studio auxiliary segmented control should use the governed A-reference owner/family: " + JSON.stringify({
                label,
                owner: list?.getAttribute("data-meow-segment-owner") || "",
                family: list?.getAttribute("data-meow-segment-family") || "",
                list: list ? rectDebug(list) : null,
                cursor: cursor ? rectDebug(cursor) : null,
                active: active ? rectDebug(active) : null,
                computed: {
                  display: style?.display || "",
                  minHeight: style?.minHeight || "",
                  padding: style?.padding || "",
                  borderRadius: style?.borderRadius || "",
                  backgroundColor: style?.backgroundColor || "",
                  activeHeight,
                  activeBackground: activeStyle?.backgroundColor || "",
                  cursorZIndex: cursorStyle?.zIndex || "",
                  cursorBackground: cursorStyle?.backgroundColor || "",
                  cursorBorderColor: cursorStyle?.borderTopColor || "",
                  cursorBoxShadow: cursorStyle?.boxShadow || ""
                }
              }));
            }
          };
          if (document.querySelector(".vs-studio-side-shell")) {
            throw new Error("Studio inspector must stay owned by React layout; VS side-shell overlay should not exist.");
          }
          if (document.querySelector('[data-top-nav] [data-vs-top-side-panel-proxy="studio"]')) {
            throw new Error("Studio inspector toggle must use the native top-nav button, not a VS proxy.");
          }
          if (nativeToggle.classList.contains("vs-panel-inline-collapse-hidden")) {
            throw new Error("Studio native inspector toggle must remain visible instead of being hidden behind a VS proxy.");
          }
          const familyDeadline = Date.now() + 1500;
          while (
            Date.now() < familyDeadline &&
            !String(nativeToggle.className || "").includes("meowdesk-top-nav-icon-button")
          ) {
            await delay(80);
          }
          const toggleRect = nativeToggle.getBoundingClientRect();
          const toggleStyle = getComputedStyle(nativeToggle);
          const toggleLabel = nativeToggle.querySelector("span");
          const toggleLabelVisible = Boolean(toggleLabel && isLayoutBox(toggleLabel));
          const toggleMaxWidth = toggleLabelVisible ? 168 : 42;
          if (
            toggleStyle.display === "none" ||
            toggleStyle.visibility === "hidden" ||
            Number(toggleStyle.opacity) <= 0.01 ||
            toggleRect.width < 36 ||
            toggleRect.width > toggleMaxWidth ||
            toggleRect.height < 36 ||
            toggleRect.height > 42 ||
            !String(nativeToggle.className || "").includes("meowdesk-top-nav-icon-button")
          ) {
            throw new Error("Studio native inspector toggle must stay in the shared top-bar side-panel button family: " + JSON.stringify({
              rect: rectDebug(nativeToggle),
              labelVisible: toggleLabelVisible,
              maxWidth: toggleMaxWidth,
              className: String(nativeToggle.className || ""),
              style: { display: toggleStyle.display, visibility: toggleStyle.visibility, opacity: toggleStyle.opacity }
            }));
          }
          const panels = [...inspector.querySelectorAll('[data-studio-inspector-panel]')];
          const panelIds = panels.map((item) => item.getAttribute("data-studio-inspector-panel")).sort().join("|");
          if (panelIds !== "detail|projects|runtime|types") {
            throw new Error("Studio inspector panels should stay force-mounted instead of remounting per tab: " + JSON.stringify({
              expected: "detail|projects|runtime|types",
              actual: panelIds,
              panels: panels.map((item) => ({
                id: item.getAttribute("data-studio-inspector-panel"),
                state: item.getAttribute("data-state")
              }))
            }));
          }
          const visiblePanels = panels.filter(isLayoutBox);
          if (visiblePanels.length !== 1 || visiblePanels[0].getAttribute("data-studio-inspector-panel") !== expectedPanel) {
            throw new Error("Studio inspector should keep exactly one outer panel in layout: " + JSON.stringify({
              expectedPanel,
              visiblePanels: visiblePanels.map((item) => item.getAttribute("data-studio-inspector-panel")),
              panels: panels.map((item) => ({
                id: item.getAttribute("data-studio-inspector-panel"),
                state: item.getAttribute("data-state"),
                rect: rectDebug(item),
                display: getComputedStyle(item).display
              }))
            }));
          }
          if (expectedPanel === "projects") {
            await assertStudioSegmentFamily(await waitFor('[data-studio-inspector-panel-tabs]'), "inspector-main-tabs");
            await assertStudioSegmentFamily(await waitFor('[data-studio-project-filter-tabs]'), "project-filter-tabs");
            const projectPanels = [...inspector.querySelectorAll('[data-studio-project-list-panel]')];
            const projectPanelIds = projectPanels.map((item) => item.getAttribute("data-studio-project-list-panel")).sort().join("|");
            if (projectPanelIds !== "all|ready") {
              throw new Error("Studio project list panels should stay force-mounted instead of remounting per tab: " + JSON.stringify({
                expected: "all|ready",
                actual: projectPanelIds,
                projectPanels: projectPanels.map((item) => ({
                  id: item.getAttribute("data-studio-project-list-panel"),
                  state: item.getAttribute("data-state")
                }))
              }));
            }
            const visibleProjectPanels = projectPanels.filter(isLayoutBox);
            if (visibleProjectPanels.length !== 1 || visibleProjectPanels[0].getAttribute("data-studio-project-list-panel") !== "all") {
              throw new Error("Studio project list should keep exactly one inner panel in layout: " + JSON.stringify({
                visibleProjectPanels: visibleProjectPanels.map((item) => item.getAttribute("data-studio-project-list-panel")),
                projectPanels: projectPanels.map((item) => ({
                  id: item.getAttribute("data-studio-project-list-panel"),
                  state: item.getAttribute("data-state"),
                  rect: rectDebug(item),
                  display: getComputedStyle(item).display
                }))
              }));
            }
          }
          return inspector;
        };
        let studioSurfaceHeaders = [];
        const assertStudioInspectorPersistentToggle = async (expectedPanel) => {
          const inspector = await assertStudioInspectorLayout(expectedPanel);
          const makeLayout = await waitFor('[data-studio-make-layout][data-studio-inspector-open="true"]');
          const agentPanel = await waitFor('[data-studio-agent-panel]');
          const openLayoutRect = makeLayout.getBoundingClientRect();
          const openAgentRect = agentPanel.getBoundingClientRect();
          const openInspectorRect = inspector.getBoundingClientRect();
          studioSurfaceHeaders = [
            await assertStudioSurfaceHeaderHeight('[data-studio-agent-panel-header]', "studio-agent"),
            await assertStudioSurfaceHeaderHeight('[data-studio-inspector][data-studio-inspector-layout="side"] > .meowdesk-panel-header', "studio-inspector")
          ];
          const makeLayoutDebug = () => {
            const layout = document.querySelector('[data-studio-make-layout]');
            if (!layout) return null;
            const style = getComputedStyle(layout);
            return {
              attrs: [...layout.attributes].reduce((acc, attr) => {
                if (/^(data-|class$|style$)/.test(attr.name)) acc[attr.name] = attr.value;
                return acc;
              }, {}),
              style: {
                display: style.display,
                gridTemplateColumns: style.gridTemplateColumns,
                gridAutoColumns: style.gridAutoColumns,
                gridAutoFlow: style.gridAutoFlow,
                gap: style.gap,
                columnGap: style.columnGap
              },
              children: [...layout.children].map((child) => ({
                tag: child.tagName,
                className: String(child.className || ""),
                attrs: [...child.attributes].reduce((acc, attr) => {
                  if (/^(data-|aria-|class$|style$)/.test(attr.name)) acc[attr.name] = attr.value;
                  return acc;
                }, {}),
                rect: rectDebug(child),
                style: styleDebug(child)
              }))
            };
          };
          const captureInspectorMotionFrames = async (phase, trigger) => {
            const samples = [];
            const startedAt = performance.now();
            trigger();
            for (let index = 0; index < 16; index += 1) {
              await delay(18);
              const currentInspector = document.querySelector('[data-studio-inspector][data-studio-inspector-layout="side"]');
              const currentLayout = document.querySelector('[data-studio-make-layout]');
              const currentAgentPanel = document.querySelector('[data-studio-agent-panel]');
              const currentInspectorContent = currentInspector?.querySelector('[data-studio-inspector-content]');
              const style = currentInspector ? getComputedStyle(currentInspector) : null;
              const layoutStyle = currentLayout ? getComputedStyle(currentLayout) : null;
              const contentStyle = currentInspectorContent ? getComputedStyle(currentInspectorContent) : null;
              const rect = currentInspector?.getBoundingClientRect();
              const layoutRect = currentLayout?.getBoundingClientRect();
              const agentRect = currentAgentPanel?.getBoundingClientRect();
              samples.push({
                phase,
                index,
                elapsed: Math.round(performance.now() - startedAt),
                sameInspector: currentInspector === inspector,
                open: currentInspector?.getAttribute("data-studio-inspector-open"),
                ariaHidden: currentInspector?.getAttribute("aria-hidden"),
                display: style?.display || "",
                visibility: style?.visibility || "",
                pointerEvents: style?.pointerEvents || "",
                width: Math.round(rect?.width || 0),
                height: Math.round(rect?.height || 0),
                left: Math.round(rect?.left || 0),
                contentVisibility: contentStyle?.visibility || "",
                contentPointerEvents: contentStyle?.pointerEvents || "",
                layoutOpen: currentLayout?.getAttribute("data-studio-inspector-open") || "",
                layoutClass: String(currentLayout?.className || ""),
                layoutInlineStyle: currentLayout?.getAttribute("style") || "",
                layoutMatchesCollapsed: Boolean(currentLayout?.matches?.('.meowdesk-studio-make-layout[data-studio-inspector-open="false"]')),
                layoutQueryCollapsed: document.querySelector('.meowdesk-studio-make-layout[data-studio-inspector-open="false"]') === currentLayout,
                layoutMatchesOpen: Boolean(currentLayout?.matches?.('.meowdesk-studio-make-layout[data-studio-inspector-open="true"]')),
                layoutGridTemplateColumns: layoutStyle?.gridTemplateColumns || "",
                layoutGap: layoutStyle?.gap || "",
                layoutColumnGap: layoutStyle?.columnGap || "",
                layoutWidth: Math.round(layoutRect?.width || 0),
                agentWidth: Math.round(agentRect?.width || 0),
                ghostCount: document.querySelectorAll(".vs-studio-side-shell, .vs-auxiliary-panel-ghost, .vs-internal-switch-reveal").length,
                proxyCount: document.querySelectorAll('[data-top-nav] [data-vs-top-side-panel-proxy="studio"]').length,
                cardActionCount: document.querySelectorAll("[data-studio-route] .vs-card-actions-collapsed, [data-studio-route] .vs-card-action-trigger, [data-studio-route] .vs-card-action-bar, [data-studio-route] .vs-card-action-item").length
              });
            }
            const bad = samples.filter((sample) => {
              if (!sample.sameInspector) return true;
              if (sample.ghostCount || sample.proxyCount || sample.cardActionCount) return true;
              if (phase === "closing" && sample.open === "false") {
                return sample.display === "none" ||
                  sample.visibility !== "hidden" ||
                  sample.width > 2 ||
                  sample.contentVisibility !== "hidden" ||
                  sample.contentPointerEvents !== "none";
              }
              if (phase === "opening" && sample.open === "true") {
                return sample.display === "none" ||
                  sample.visibility === "hidden" ||
                  sample.width < Math.max(280, openInspectorRect.width * 0.75) ||
                  Math.abs(sample.agentWidth - Math.round(openAgentRect.width)) > 36;
              }
              return false;
            });
            if (bad.length) {
              throw new Error("Studio inspector " + phase + " frames exposed a flash/remount/overlay path: " + JSON.stringify({
                bad,
                samples
              }));
            }
            return samples;
          };
          if (document.querySelector('[data-studio-inspector-close]')) {
            throw new Error("Studio inspector collapse should be owned by the shared top-bar side-panel button, not by an internal panel button.");
          }
          const topToggle = await waitFor('[data-top-nav] [data-studio-inspector-toggle]');
          const closingSamples = await captureInspectorMotionFrames("closing", () => topToggle.click());
          await delay(80);
          const closedInspector = await waitFor('[data-studio-inspector][data-studio-inspector-layout="side"][data-studio-inspector-open="false"]');
          const closedLayout = await waitFor('[data-studio-make-layout][data-studio-inspector-open="false"]');
          const closedAgentRect = agentPanel.getBoundingClientRect();
          const closedLayoutRect = closedLayout.getBoundingClientRect();
          if (closedInspector !== inspector) {
            throw new Error("Studio inspector should keep the same React owner when collapsed, not remount.");
          }
          const closedPanels = [...closedInspector.querySelectorAll('[data-studio-inspector-panel]')];
          const closedPanelIds = closedPanels.map((item) => item.getAttribute("data-studio-inspector-panel")).sort().join("|");
          if (closedPanelIds !== "detail|projects|runtime|types") {
            throw new Error("Collapsed Studio inspector should keep force-mounted panels for flicker-free reopen: " + closedPanelIds);
          }
          const closedStyle = getComputedStyle(closedInspector);
          const closedContent = closedInspector.querySelector('[data-studio-inspector-content]');
          const closedContentStyle = closedContent ? getComputedStyle(closedContent) : null;
          const closedRect = closedInspector.getBoundingClientRect();
          if (
            closedStyle.display === "none" ||
            closedStyle.visibility !== "hidden" ||
            closedRect.width > 2 ||
            !topToggle ||
            !closedContent ||
            closedContentStyle?.visibility !== "hidden" ||
            closedContentStyle?.pointerEvents !== "none" ||
            closedContent?.getAttribute("aria-hidden") !== "true"
          ) {
            throw new Error("Collapsed Studio inspector should keep the same React node as a zero-width hidden side panel, not a separate rail or remounted layout: " + JSON.stringify({
              rect: rectDebug(closedInspector),
              display: closedStyle.display,
              visibility: closedStyle.visibility,
              pointerEvents: closedStyle.pointerEvents,
              opacity: closedStyle.opacity,
              contentVisibility: closedContentStyle?.visibility,
              contentPointerEvents: closedContentStyle?.pointerEvents,
              contentAriaHidden: closedContent?.getAttribute("aria-hidden"),
              hasTopToggle: Boolean(topToggle)
            }));
          }
          if (
            Math.abs(closedLayoutRect.width - openLayoutRect.width) > 4 ||
            closedAgentRect.width < openAgentRect.width + Math.max(0, openInspectorRect.width - closedRect.width) * 0.75 ||
            Math.abs(closedAgentRect.left - openAgentRect.left) > 2
          ) {
            throw new Error("Closing Studio inspector should collapse to the Workspace-style hidden side-panel state instead of leaving a rail or flashing through a remounted layout: " + JSON.stringify({
              openLayout: {
                width: Math.round(openLayoutRect.width),
                left: Math.round(openLayoutRect.left),
                right: Math.round(openLayoutRect.right)
              },
              closedLayout: {
                width: Math.round(closedLayoutRect.width),
                left: Math.round(closedLayoutRect.left),
                right: Math.round(closedLayoutRect.right)
              },
              openAgent: {
                width: Math.round(openAgentRect.width),
                left: Math.round(openAgentRect.left),
                right: Math.round(openAgentRect.right)
              },
              closedAgent: {
                width: Math.round(closedAgentRect.width),
                left: Math.round(closedAgentRect.left),
                right: Math.round(closedAgentRect.right)
              },
              openInspector: {
                width: Math.round(openInspectorRect.width),
                left: Math.round(openInspectorRect.left),
                right: Math.round(openInspectorRect.right)
              },
              closedInspector: rectDebug(closedInspector),
              makeLayoutDebug: makeLayoutDebug(),
              closingSamples,
              studioSurfaceHeaders,
              openAgentWidth: Math.round(openAgentRect.width),
              closedAgentWidth: Math.round(closedAgentRect.width),
              openInspectorWidth: Math.round(openInspectorRect.width)
            }));
          }
          const openingSamples = await captureInspectorMotionFrames("opening", () => topToggle.click());
          await delay(80);
          const reopenedInspector = await assertStudioInspectorLayout(expectedPanel);
          if (reopenedInspector !== inspector) {
            throw new Error("Studio inspector reopened with a new DOM owner; this can recreate the auxiliary-panel flash.");
          }
          const reopenedAgentRect = agentPanel.getBoundingClientRect();
          if (Math.abs(reopenedAgentRect.width - openAgentRect.width) > 24 || Math.abs(reopenedAgentRect.left - openAgentRect.left) > 2) {
            throw new Error("Reopening Studio inspector should restore the original two-column geometry without a layout jump: " + JSON.stringify({
              openAgent: {
                width: Math.round(openAgentRect.width),
                left: Math.round(openAgentRect.left),
                right: Math.round(openAgentRect.right)
              },
              reopenedAgent: {
                width: Math.round(reopenedAgentRect.width),
                left: Math.round(reopenedAgentRect.left),
                right: Math.round(reopenedAgentRect.right)
              },
              openingSamples,
              studioSurfaceHeaders,
              openAgentWidth: Math.round(openAgentRect.width),
              reopenedAgentWidth: Math.round(reopenedAgentRect.width)
            }));
          }
        };
        const assertNoLiveCardActionOverlay = async (context) => {
          const residues = [...document.querySelectorAll([
            "[data-studio-route] .vs-card-actions-collapsed",
            "[data-studio-route] .vs-card-action-trigger",
            "[data-studio-route] .vs-card-action-bar",
            "[data-studio-route] .vs-card-action-item"
          ].join(","))].map((element) => ({
            context,
            tag: element.tagName,
            className: element.className,
            dataset: { ...element.dataset },
            text: (element.textContent || "").trim().slice(0, 80)
          }));
          if (residues.length) {
            throw new Error("Live Studio must not use VS card-action structural overlays; functional controls stay React-owned: " + JSON.stringify(residues));
          }
        };
        const assertStudioRunningControlsLayout = async () => {
          const panelHeader = await waitFor('[data-studio-agent-panel-header]');
          const headerControls = await waitFor('[data-studio-agent-header-controls]');
          const viewerToggle = await waitFor('[data-studio-agent-meow-viewer-toggle][data-studio-agent-control-owner="header"]');
          const stop = await waitFor('[data-studio-agent-stop][data-studio-agent-control-owner="header"]');
          const panelHeaderRect = panelHeader.getBoundingClientRect();
          const headerControlsRect = headerControls.getBoundingClientRect();
          const agentPanel = await waitFor('[data-studio-agent-panel]');
          const runtimeControls = document.querySelector('[data-studio-agent-runtime-controls]');
          const runtimeViewerToggle = document.querySelector('[data-studio-agent-meow-viewer-toggle][data-studio-agent-control-owner="runtime"]');
          const runtimeStop = document.querySelector('[data-studio-agent-stop][data-studio-agent-control-owner="runtime"]');
          await assertNoLiveCardActionOverlay("running-controls");
          if (
            agentPanel.classList.contains("vs-card-actions-collapsed") ||
            headerControls.classList.contains("vs-card-action-bar") ||
            headerControls.getAttribute("data-vs-card-action-bar") === "true" ||
            agentPanel.querySelector(":scope > .vs-card-action-trigger")
          ) {
            throw new Error("Studio Agent functional controls must not be captured by the VS card-action collapse overlay: " + JSON.stringify({
              agentPanel: elementDebug(agentPanel),
              headerControls: elementDebug(headerControls)
            }));
          }
          if (runtimeControls || runtimeViewerToggle || runtimeStop) {
            throw new Error("Studio Agent controls should have one React owner in the panel header, not a duplicated runtime toolbar: " + JSON.stringify({
              runtimeControls: runtimeControls ? rectDebug(runtimeControls) : null,
              runtimeViewer: runtimeViewerToggle ? rectDebug(runtimeViewerToggle) : null,
              runtimeStop: runtimeStop ? rectDebug(runtimeStop) : null
            }));
          }
          if (panelHeaderRect.height < 40 || getComputedStyle(panelHeader).overflow === "hidden") {
            throw new Error("Studio Agent header must reserve compact header room for Meow Viewer and stop controls, not clip them with the generic VS panel header: " + JSON.stringify({
              panelHeader: rectDebug(panelHeader),
              overflow: getComputedStyle(panelHeader).overflow
            }));
          }
          for (const [name, button] of [["viewer", viewerToggle], ["stop", stop]]) {
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              Number(style.opacity) <= 0.01 ||
              rect.width < 20 ||
              rect.height < 20 ||
              rect.left < panelHeaderRect.left - 2 ||
              rect.right > panelHeaderRect.right + 2 ||
              rect.top < panelHeaderRect.top - 2 ||
              rect.bottom > panelHeaderRect.bottom + 2 ||
              rect.left < headerControlsRect.left - 2 ||
              rect.right > headerControlsRect.right + 2 ||
              rect.top < headerControlsRect.top - 2 ||
              rect.bottom > headerControlsRect.bottom + 2
            ) {
              throw new Error("Studio running control should stay visible inside the Agent header controls: " + JSON.stringify({
                name,
                button: rectDebug(button),
                panelHeader: rectDebug(panelHeader),
                headerControls: rectDebug(headerControls),
                style: { display: style.display, visibility: style.visibility, opacity: style.opacity },
                debug: studioHeaderControlsDebug(panelHeader, headerControls, button)
              }));
            }
          }
          const makeLayout = await waitFor('[data-studio-make-layout][data-studio-inspector-open="true"]');
          const agentStage = await waitFor('[data-studio-agent-stage]');
          const terminalHost = await waitFor('[data-studio-agent-terminal-host]');
          const inspector = await waitFor('[data-studio-inspector][data-studio-inspector-layout="side"]');
          const stageRect = agentStage.getBoundingClientRect();
          const hostRect = terminalHost.getBoundingClientRect();
          const inspectorRect = inspector.getBoundingClientRect();
          const agentPanelRect = agentPanel.getBoundingClientRect();
          const inspectorWidth = Math.round(inspectorRect.width);
          const panelGap = Math.round(inspectorRect.left - agentPanelRect.right);
          const terminalRightGap = Math.round(stageRect.right - hostRect.right);
          if (inspectorWidth < 320 || inspectorWidth > 380 || panelGap < 6 || panelGap > 32 || terminalRightGap > 40) {
            throw new Error("Studio running layout should keep VS side width, compact gap, and fitted terminal host: " + JSON.stringify({
              makeLayout: rectDebug(makeLayout),
              agentPanel: rectDebug(agentPanel),
              inspector: rectDebug(inspector),
              agentStage: rectDebug(agentStage),
              terminalHost: rectDebug(terminalHost),
              inspectorWidth,
              panelGap,
              terminalRightGap
            }));
          }
        };
        const assertStudioSelectedAgentControlsLayout = async () => {
          const panelHeader = await waitFor('[data-studio-agent-panel-header]');
          const headerControls = await waitFor('[data-studio-agent-header-controls]');
          const viewerToggle = await waitFor('[data-studio-agent-meow-viewer-toggle][data-studio-agent-control-owner="header"]');
          const stop = await waitFor('[data-studio-agent-stop][data-studio-agent-control-owner="header"]');
          const agentPanel = await waitFor('[data-studio-agent-panel]');
          const runtimeControls = document.querySelector('[data-studio-agent-runtime-controls]');
          const runtimeViewerToggle = document.querySelector('[data-studio-agent-meow-viewer-toggle][data-studio-agent-control-owner="runtime"]');
          const runtimeStop = document.querySelector('[data-studio-agent-stop][data-studio-agent-control-owner="runtime"]');
          await assertNoLiveCardActionOverlay("selected-agent-controls");
          if (
            agentPanel.classList.contains("vs-card-actions-collapsed") ||
            headerControls.classList.contains("vs-card-action-bar") ||
            headerControls.getAttribute("data-vs-card-action-bar") === "true" ||
            agentPanel.querySelector(":scope > .vs-card-action-trigger")
          ) {
            throw new Error("Studio selected Agent controls must not be captured by the VS card-action collapse overlay before startup: " + JSON.stringify({
              agentPanel: elementDebug(agentPanel),
              headerControls: elementDebug(headerControls)
            }));
          }
          if (runtimeControls || runtimeViewerToggle || runtimeStop) {
            throw new Error("Studio selected Agent controls should stay single-owned by the panel header before startup: " + JSON.stringify({
              runtimeControls: runtimeControls ? rectDebug(runtimeControls) : null,
              runtimeViewer: runtimeViewerToggle ? rectDebug(runtimeViewerToggle) : null,
              runtimeStop: runtimeStop ? rectDebug(runtimeStop) : null
            }));
          }
          const panelHeaderRect = panelHeader.getBoundingClientRect();
          const headerControlsRect = headerControls.getBoundingClientRect();
          for (const [name, button, containerRect] of [
            ["viewer", viewerToggle, headerControlsRect],
            ["stop", stop, headerControlsRect]
          ]) {
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              Number(style.opacity) <= 0.01 ||
              rect.width < 20 ||
              rect.height < 20 ||
              rect.left < containerRect.left - 2 ||
              rect.right > containerRect.right + 2 ||
              rect.top < containerRect.top - 2 ||
              rect.bottom > containerRect.bottom + 2
            ) {
              throw new Error("Studio selected Agent controls must stay visible before startup, not disappear behind VS layout: " + JSON.stringify({
                name,
                button: rectDebug(button),
                panelHeader: rectDebug(panelHeader),
                headerControls: rectDebug(headerControls),
                style: { display: style.display, visibility: style.visibility, opacity: style.opacity, disabled: button.disabled }
              }));
            }
          }
          if (!stop.disabled) {
            throw new Error("Studio stop controls should be visible but disabled before the Agent starts.");
          }
        };

        await click('[data-next-route="studio"]');
        await click('[data-studio-inspector-panel-tab="runtime"]');
        const studioRoute = await waitFor('[data-studio-route]');
        const topNav = await waitFor('[data-top-nav]');
        await assertStudioInspectorLayout("runtime");
        const initialBoundary = await waitFor('[data-studio-runtime-boundary]');
        const initialTerminal = await waitFor('[data-studio-runtime-boundary-item="Terminal runtime"]');
        const initialTaskCenter = await waitFor('[data-studio-runtime-boundary-item="任务中心"]');
        if (!initialBoundary.textContent.includes("protected runtime")) {
          throw new Error("Runtime boundary did not show protected runtime status.");
        }
        let inspectorIdentity = await captureStudioInspectorIdentity();
        if (document.querySelector('[data-studio-compact-header]')) {
          throw new Error("Studio route should not render a compact header inside the work surface.");
        }
        for (const selector of [
          '[data-studio-page-tab="make"]',
          '[data-studio-page-tab="manage"]',
          '[data-studio-inspector-toggle]',
          '[data-studio-import-meow]',
          '[data-studio-new-draft]'
        ]) {
          const control = await waitFor(selector);
          if (!topNav.contains(control)) {
            throw new Error("Studio control must live in top nav: " + selector);
          }
          if (studioRoute.contains(control)) {
            throw new Error("Studio control leaked back into route surface: " + selector);
          }
        }
        const stage = await waitFor('[data-studio-agent-stage]');
        const agentPanel = await waitFor('[data-studio-agent-panel]');
        if (document.querySelector('[data-studio-top-status]')) {
          throw new Error("Studio top nav should not keep the ready/project status pills.");
        }
        await click('[data-studio-inspector-panel-tab="projects"]');
        await assertStudioInspectorLayout("projects");
        inspectorIdentity = await assertStudioInspectorIdentityStable(inspectorIdentity, "runtime->projects");
        await click('[data-studio-inspector-panel-tab="types"]');
        await assertStudioInspectorLayout("types");
        inspectorIdentity = await assertStudioInspectorIdentityStable(inspectorIdentity, "projects->types");
        await click('[data-studio-inspector-panel-tab="detail"]');
        await assertStudioInspectorLayout("detail");
        inspectorIdentity = await assertStudioInspectorIdentityStable(inspectorIdentity, "types->detail");
        await click('[data-studio-inspector-panel-tab="projects"]');
        await assertStudioInspectorLayout("projects");
        inspectorIdentity = await assertStudioInspectorIdentityStable(inspectorIdentity, "detail->projects");
        await assertStudioInspectorPersistentToggle("projects");
        inspectorIdentity = await captureStudioInspectorIdentity();
        await waitFor('[data-studio-select-project="smoke-sidebar-widget"]');
        await click('[data-studio-select-project="smoke-sidebar-widget"]');
        await waitFor('[data-studio-agent-panel][data-studio-agent-selected-project="smoke-sidebar-widget"]', 8000);
        await waitFor('[data-studio-agent-panel][data-studio-agent-selected="smoke-workshop-agent"]', 8000);
        await assertStudioSelectedAgentControlsLayout();
        const agentStart = await waitFor('[data-studio-agent-start]');
        const studioLaunchFamily = await waitFor('[data-studio-agent-standby-mode="selected"] [data-meow-launch-family="agent-work-surface"][data-meow-launch-variant="studio-agent"]');
        const studioLaunchIcon = studioLaunchFamily.querySelector(".meowdesk-launch-empty-state-icon");
        const studioLaunchTitle = studioLaunchFamily.querySelector(".meowdesk-launch-empty-state-title strong");
        const studioLaunchMeta = studioLaunchFamily.querySelector(".meowdesk-launch-empty-state-meta");
        const studioLaunchPrimary = studioLaunchFamily.querySelector(".meowdesk-launch-empty-state-primary .meowdesk-workspace-launch-button");
        const studioNestedIconTiles = studioLaunchIcon ? [...studioLaunchIcon.children].filter((child) => {
          const childRect = child.getBoundingClientRect();
          const childStyle = getComputedStyle(child);
          const hasChrome =
            childStyle.backgroundColor !== "rgba(0, 0, 0, 0)" ||
            childStyle.borderTopWidth !== "0px" ||
            childStyle.boxShadow !== "none";
          return childRect.width >= 44 && childRect.height >= 44 && hasChrome;
        }) : [];
        const studioLaunchMetaStyle = studioLaunchMeta ? getComputedStyle(studioLaunchMeta) : null;
        const studioLaunchMetaRect = studioLaunchMeta ? studioLaunchMeta.getBoundingClientRect() : null;
        const studioLaunchSnapshot = {
          familyClass: studioLaunchFamily.className,
          hasIcon: Boolean(studioLaunchIcon),
          hasTitle: Boolean(studioLaunchTitle),
          hasMeta: Boolean(studioLaunchMeta),
          hasPrimary: Boolean(studioLaunchPrimary),
          icon: studioLaunchIcon ? {
            width: Math.round(studioLaunchIcon.getBoundingClientRect().width),
            height: Math.round(studioLaunchIcon.getBoundingClientRect().height),
            borderRadius: getComputedStyle(studioLaunchIcon).borderRadius,
            backgroundColor: getComputedStyle(studioLaunchIcon).backgroundColor,
            chrome: studioLaunchIcon.getAttribute("data-meow-launch-icon-chrome") || "",
            nestedTiles: studioNestedIconTiles.map((child) => {
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
          } : null,
          title: studioLaunchTitle ? {
            fontSize: getComputedStyle(studioLaunchTitle).fontSize,
            fontWeight: getComputedStyle(studioLaunchTitle).fontWeight,
            color: getComputedStyle(studioLaunchTitle).color
          } : null,
          meta: studioLaunchMeta ? {
            display: studioLaunchMetaStyle.display,
            visibility: studioLaunchMetaStyle.visibility,
            opacity: studioLaunchMetaStyle.opacity,
            width: Math.round(studioLaunchMetaRect.width),
            height: Math.round(studioLaunchMetaRect.height),
            text: studioLaunchMeta.textContent.trim(),
            ariaHidden: studioLaunchMeta.getAttribute("aria-hidden"),
            className: String(studioLaunchMeta.className || ""),
            vsTitleSubcopy: studioLaunchMeta.classList.contains("vs-title-subcopy"),
            vsTechnicalCopyHidden: studioLaunchMeta.classList.contains("vs-technical-copy-hidden"),
            fontSize: getComputedStyle(studioLaunchMeta).fontSize,
            fontWeight: getComputedStyle(studioLaunchMeta).fontWeight,
            color: getComputedStyle(studioLaunchMeta).color
          } : null,
          primary: studioLaunchPrimary ? {
            height: Math.round(studioLaunchPrimary.getBoundingClientRect().height),
            borderRadius: getComputedStyle(studioLaunchPrimary).borderRadius,
            backgroundColor: getComputedStyle(studioLaunchPrimary).backgroundColor,
            display: getComputedStyle(studioLaunchPrimary).display,
            alignItems: getComputedStyle(studioLaunchPrimary).alignItems,
            justifyContent: getComputedStyle(studioLaunchPrimary).justifyContent
          } : null
        };
        if (
          !studioLaunchIcon ||
          !studioLaunchTitle ||
          !studioLaunchMeta ||
          !studioLaunchPrimary ||
          studioLaunchSnapshot.icon.width !== 56 ||
          studioLaunchSnapshot.icon.height !== 56 ||
          studioLaunchSnapshot.icon.borderRadius !== "12px" ||
          studioLaunchSnapshot.icon.chrome !== "tile" ||
          studioLaunchSnapshot.icon.nestedTiles.length !== 0 ||
          studioLaunchSnapshot.meta.display === "none" ||
          studioLaunchSnapshot.meta.visibility === "hidden" ||
          Number(studioLaunchSnapshot.meta.opacity) === 0 ||
          studioLaunchSnapshot.meta.width <= 0 ||
          studioLaunchSnapshot.meta.height <= 0 ||
          studioLaunchSnapshot.meta.ariaHidden === "true" ||
          studioLaunchSnapshot.meta.vsTitleSubcopy ||
          studioLaunchSnapshot.meta.vsTechnicalCopyHidden ||
          studioLaunchMeta.classList.contains("vs-technical-copy-hidden") ||
          studioLaunchSnapshot.primary.height !== 40 ||
          studioLaunchSnapshot.primary.borderRadius !== "8px" ||
          !studioLaunchSnapshot.primary.display.includes("flex") ||
          studioLaunchSnapshot.primary.alignItems !== "center" ||
          studioLaunchSnapshot.primary.justifyContent !== "center"
        ) {
          throw new Error("Studio selected Agent standby must use the shared LaunchEmptyState family: " + JSON.stringify(studioLaunchSnapshot));
        }
        if (agentStart.disabled) {
          throw new Error("Studio Agent workshop start button should be enabled when an Agent tool is configured.");
        }
        if (agentPanel.getAttribute("data-studio-agent-selected-project") !== "smoke-sidebar-widget") {
          throw new Error("Studio Agent workshop did not bind the selected workshop project.");
        }
        const inspector = await waitFor('[data-studio-inspector]');
        const shell = await waitFor('[data-route-shell]');
        const agentRect = agentPanel.getBoundingClientRect();
        const inspectorRect = inspector.getBoundingClientRect();
        const layout = {
          shellClientWidth: shell.clientWidth,
          shellScrollWidth: shell.scrollWidth,
          shellClientHeight: shell.clientHeight,
          shellScrollHeight: shell.scrollHeight,
          agentTop: Math.round(agentRect.top),
          agentBottom: Math.round(agentRect.bottom),
          inspectorTop: Math.round(inspectorRect.top),
          inspectorBottom: Math.round(inspectorRect.bottom)
        };
        if (layout.shellScrollWidth - layout.shellClientWidth > 2 || layout.shellScrollHeight - layout.shellClientHeight > 2) {
          throw new Error("Studio route surface overflowed: " + JSON.stringify(layout));
        }
        if (Math.abs(layout.agentTop - layout.inspectorTop) > 2 || Math.abs(layout.agentBottom - layout.inspectorBottom) > 2) {
          throw new Error("Studio Agent panel and inspector are not aligned: " + JSON.stringify(layout));
        }
        return {
          scenario: "studio-runtime-boundary",
          stageVisible: Boolean(stage),
          terminalStatus: initialTerminal.getAttribute("data-studio-runtime-boundary-status"),
          taskCenterStatus: initialTaskCenter.getAttribute("data-studio-runtime-boundary-status"),
          text: initialBoundary.textContent,
          studioSurfaceHeaders,
          studioLaunchSnapshot,
          layout
        };
      })()
    `, true);
  }
}

async function runStudioAuxSegmentFamilyScenario(win, dependencies = {}, scenario) {
  if (scenario !== "studio-aux-segment-family") return undefined;

  return win.webContents.executeJavaScript(`
    (async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = (selector, timeout = 7000) => new Promise((resolve, reject) => {
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
      const assertAuxSegment = async (selector, label, expectedColumns) => {
        const list = await waitFor(selector);
        const cursor = await waitFor(selector + ' > [data-meow-segment-cursor]');
        const active = list.querySelector(':scope > [data-meow-segment-trigger][data-state="active"], :scope > [data-meow-segment-trigger][aria-selected="true"]');
        await delay(120);
        const listStyle = getComputedStyle(list);
        const cursorStyle = getComputedStyle(cursor);
        const activeStyle = active ? getComputedStyle(active) : null;
        const rect = list.getBoundingClientRect();
        const cursorRect = cursor.getBoundingClientRect();
        const activeRect = active?.getBoundingClientRect?.();
        const gridColumns = listStyle.gridTemplateColumns.split(" ").filter(Boolean).length;
        if (
          list.getAttribute("data-meow-segment-owner") !== "studio-inspector" ||
          list.getAttribute("data-meow-segment-family") !== "studio-inspector-side" ||
          listStyle.display !== "grid" ||
          gridColumns !== expectedColumns ||
          rect.height < 46 ||
          !active ||
          activeRect.height < 34 ||
          activeStyle.backgroundColor !== "rgba(0, 0, 0, 0)" ||
          cursorStyle.zIndex !== "1" ||
          !String(cursorStyle.backgroundColor || "").includes("0, 140, 255") ||
          !String(cursorStyle.borderTopColor || "").includes("0, 140, 255") ||
          cursorRect.left < rect.left - 2 ||
          cursorRect.right > rect.right + 2 ||
          cursorRect.top < rect.top - 2 ||
          cursorRect.bottom > rect.bottom + 2
        ) {
          throw new Error("Studio aux segmented control should match A-reference owner/family: " + JSON.stringify({
            label,
            expectedColumns,
            owner: list.getAttribute("data-meow-segment-owner") || "",
            family: list.getAttribute("data-meow-segment-family") || "",
            list: rectDebug(list),
            cursor: rectDebug(cursor),
            active: active ? rectDebug(active) : null,
            computed: {
              display: listStyle.display,
              gridTemplateColumns: listStyle.gridTemplateColumns,
              height: listStyle.height,
              minHeight: listStyle.minHeight,
              padding: listStyle.padding,
              borderRadius: listStyle.borderRadius,
              backgroundColor: listStyle.backgroundColor,
              activeBackground: activeStyle?.backgroundColor || "",
              activeHeight: activeRect?.height || 0,
              cursorZIndex: cursorStyle.zIndex,
              cursorBackground: cursorStyle.backgroundColor,
              cursorBorderColor: cursorStyle.borderTopColor,
              cursorBoxShadow: cursorStyle.boxShadow
            }
          }));
        }
        return {
          label,
          owner: list.getAttribute("data-meow-segment-owner"),
          family: list.getAttribute("data-meow-segment-family"),
          rect: rectDebug(list),
          cursor: rectDebug(cursor),
          columns: gridColumns
        };
      };

      await click('[data-next-route="studio"]');
      await waitFor('[data-studio-inspector][data-studio-inspector-layout="side"][data-studio-inspector-open="true"]');
      await click('[data-studio-inspector-panel-tab="projects"]');
      const inspectorTabs = await assertAuxSegment('[data-studio-inspector-panel-tabs]', "inspector-main-tabs", 4);
      const projectFilter = await assertAuxSegment('[data-studio-project-filter-tabs]', "project-filter-tabs", 2);
      return {
        scenario: "studio-aux-segment-family",
        inspectorTabs,
        projectFilter
      };
    })()
  `, true);
}

async function runStudioAgentPickerVisualScenario(win, dependencies = {}, scenario) {
  if (scenario !== "studio-agent-picker-visual") return undefined;

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
      const clickFirstAvailable = async (selectors, timeout = 8000) => {
        const isActionable = (element) => {
          if (!element || element.disabled) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.pointerEvents !== "none" && Number(style.opacity) > 0.01;
        };
        const startedAt = Date.now();
        while (Date.now() - startedAt <= timeout) {
          const element = selectors
            .flatMap((selector) => [...document.querySelectorAll(selector)])
            .find(isActionable);
          if (element) {
            element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
            element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
            element.click();
            await delay(160);
            return element;
          }
          await delay(50);
        }
        throw new Error("Timed out waiting for one of " + selectors.join(", "));
      };
      const rectSnapshot = (element) => {
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
      const centerDelta = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.left + rect.width / 2 - window.innerWidth / 2),
          y: Math.round(rect.top + rect.height / 2 - window.innerHeight / 2)
        };
      };

      await click('[data-next-route="studio"]');
      await waitFor('[data-studio-agent-panel][data-studio-agent-stage-current="workstation"]');
      await clickFirstAvailable(['[data-studio-agent-add]', '[data-studio-agent-change]']);
      const dialog = await waitFor('[data-studio-agent-picker-dialog]');
      const list = await waitFor('[data-studio-agent-choice-list]');
      const closeButton = await waitFor('[data-studio-agent-picker-dialog] [data-dialog-close]');
      const cliChoice = await waitFor('[data-studio-agent-choice="smoke-picker-agent"]');
      await delay(180);

      const before = rectSnapshot(dialog);
      const beforeCenter = centerDelta(dialog);
      dialog.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
      list.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
      await delay(160);
      const after = rectSnapshot(dialog);
      const afterCenter = centerDelta(dialog);
      const dialogStyle = getComputedStyle(dialog);
      const listStyle = getComputedStyle(list);
      const closeButtonRect = rectSnapshot(closeButton);
      const text = dialog.textContent || "";

      if (
        !dialog.classList.contains("meowdesk-picker-dialog") ||
        dialog.classList.contains("vs-picker-card-dialog") ||
        dialog.getAttribute("data-meow-picker-dialog") !== "studio-agent" ||
        dialog.getAttribute("data-meow-picker-family") !== "agent-tool-picker" ||
        dialog.getAttribute("data-meow-picker-live") !== "native-content" ||
        dialog.hasAttribute("data-vs-picker-live")
      ) {
        throw new Error("Studio Agent picker should use the Meowdesk native-content visual owner, not the VS picker owner: " + dialog.outerHTML.slice(0, 480));
      }
      if (Math.abs(beforeCenter.x) > 60 || Math.abs(beforeCenter.y) > 60 || Math.abs(afterCenter.x) > 60 || Math.abs(afterCenter.y) > 60) {
        throw new Error("Studio Agent picker should stay centered: " + JSON.stringify({ before, after, beforeCenter, afterCenter, viewport: { width: window.innerWidth, height: window.innerHeight } }));
      }
      if (Math.abs(after.left - before.left) > 2 || Math.abs(after.top - before.top) > 2 || Math.abs(after.width - before.width) > 2 || Math.abs(after.height - before.height) > 2) {
        throw new Error("Studio Agent picker hover should not move or resize the dialog: " + JSON.stringify({ before, after }));
      }
      if (
        dialogStyle.display === "none" ||
        dialogStyle.visibility === "hidden" ||
        Number(dialogStyle.opacity) <= 0.05 ||
        listStyle.display === "none" ||
        listStyle.visibility === "hidden" ||
        listStyle.pointerEvents === "none" ||
        Number(listStyle.opacity) <= 0.05
      ) {
        throw new Error("Studio Agent picker should expose visible, interactive content: " + JSON.stringify({
          dialog: { rect: before, display: dialogStyle.display, visibility: dialogStyle.visibility, opacity: dialogStyle.opacity, transform: dialogStyle.transform },
          list: { rect: rectSnapshot(list), display: listStyle.display, visibility: listStyle.visibility, pointerEvents: listStyle.pointerEvents, opacity: listStyle.opacity }
        }));
      }
      if (!text.includes("选择工坊 Agent") || !text.includes("CLI Agent") || !text.includes("Smoke Picker Agent")) {
        throw new Error("Studio Agent picker should show real picker content and a seeded CLI Agent: " + text);
      }
      if (!dialog.contains(cliChoice)) {
        throw new Error("Studio Agent picker CLI choices should stay inside the centered dialog.");
      }
      const desktopLeftovers = [
        '[data-studio-agent-choice="claude-desktop"]',
        '[data-studio-agent-choice-type="desktop"]',
        '[data-studio-agent-choice-note="desktop"]'
      ].flatMap((selector) => [...dialog.querySelectorAll(selector)].map((element) => ({
        selector,
        text: (element.textContent || "").trim().slice(0, 120)
      })));
      if (desktopLeftovers.length) {
        throw new Error("Studio Agent picker must not expose the removed desktop-Agent placeholder choices: " + JSON.stringify(desktopLeftovers));
      }
      if (closeButtonRect.left < after.right - 56 || closeButtonRect.top > after.top + 24) {
        throw new Error("Studio Agent picker close button should stay in the top-right corner, not fall into content flow: " + JSON.stringify({
          dialog: after,
          closeButton: closeButtonRect,
          position: getComputedStyle(closeButton).position
        }));
      }
      if (document.querySelector(".vs-picker-dialog-mouse")) {
        throw new Error("Studio Agent picker must not use the old mouse-follow visual shell.");
      }
      closeButton.click();
      await delay(120);

      return {
        scenario: "studio-agent-picker-visual",
        before,
        after,
        beforeCenter,
        afterCenter,
        cliChoice: cliChoice.textContent.trim(),
        closeButton: closeButtonRect,
        transform: dialogStyle.transform
      };
    })()
  `, true);
}

async function runStudioTerminalBoundaryScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "studio-terminal-boundary") {
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

        if (!window.workbench) {
          throw new Error("window.workbench is missing.");
        }
        for (const method of ["startTerminal", "writeTerminal", "resizeTerminal", "killTerminal"]) {
          if (typeof window.workbench[method] === "function") {
            window.workbench[method] = () => {
              throw new Error("Terminal boundary smoke must not call window.workbench." + method);
            };
          }
        }
        const seededTerminalTool = {
          id: "smoke-terminal",
          name: "Smoke PowerShell",
          toolKind: "terminal",
          command: "powershell.exe",
          args: ["-NoLogo"],
          cwd: "."
        };
        const config = await window.workbench.getConfig();
        const tools = Array.isArray(config?.tools) ? config.tools : [];
        if (!tools.some((tool) => tool && tool.id === seededTerminalTool.id)) {
          await window.workbench.addUserTool(seededTerminalTool);
        }

        await click('[data-next-route="studio"]');
        const studioRoute = await waitFor('[data-studio-route]');
        const topNav = await waitFor('[data-top-nav]');
        if (document.querySelector('[data-studio-compact-header]')) {
          throw new Error("Studio route should not render page controls inside a compact header.");
        }
        if (studioRoute.querySelector('[data-studio-page-tab], [data-studio-inspector-toggle], [data-studio-new-draft]')) {
          throw new Error("Studio page controls must stay out of the route surface.");
        }
        for (const selector of ['[data-studio-page-tab="manage"]', '[data-studio-page-tab="make"]', '[data-studio-inspector-toggle]']) {
          const control = await waitFor(selector);
          if (!topNav.contains(control)) {
            throw new Error("Studio control must live in top nav: " + selector);
          }
        }
        await click('[data-studio-page-tab="manage"]');
        await waitFor('[data-studio-workshop-management]');
        await waitFor('[data-studio-project-bucket="published"]');
        await waitFor('[data-studio-project-bucket="in-progress"]');
        await click('[data-studio-page-tab="make"]');
        await click('[data-studio-inspector-panel-tab="runtime"]');
        const inspector = await waitFor('[data-studio-inspector]');
        const boundary = await waitFor('[data-studio-runtime-boundary]');
        const terminal = await waitFor('[data-studio-runtime-boundary-item="Terminal runtime"]');
        const mountContract = await waitFor('[data-studio-terminal-mount-contract]');
        const count = terminal.getAttribute("data-studio-terminal-session-count");
        const descriptorStatus = terminal.getAttribute("data-studio-terminal-descriptor-status");
        if (count !== "1") {
          throw new Error("Terminal session count did not read seeded descriptor: " + count);
        }
        if (descriptorStatus !== "contract") {
          throw new Error("Terminal descriptor contract status mismatch: " + descriptorStatus);
        }
        if (terminal.getAttribute("data-studio-runtime-boundary-status") !== "protected") {
          throw new Error("Terminal runtime status must stay protected: " + terminal.getAttribute("data-studio-runtime-boundary-status"));
        }
        if (!terminal.textContent.includes("Smoke PowerShell")) {
          throw new Error("Terminal descriptor name was not rendered: " + terminal.textContent);
        }
        if (!mountContract.textContent.includes("xterm mount") || !mountContract.textContent.includes("protected runtime")) {
          throw new Error("Terminal mount contract text is incomplete: " + mountContract.textContent);
        }
        return {
          scenario: "studio-terminal-boundary",
          inspectorTab: inspector.getAttribute("data-studio-inspector-active"),
          terminalStatus: terminal.getAttribute("data-studio-runtime-boundary-status"),
          terminalSessionCount: count,
          text: boundary.textContent
        };
      })()
    `, true);
  }
}

async function runStudioMeowViewerSharedCoreScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "studio-meow-viewer-shared-core") {
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
          await delay(140);
          return element;
        };
        const waitUntil = (label, predicate, timeout = 1800) => new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const tick = () => {
            try {
              if (predicate()) {
                resolve(true);
                return;
              }
            } catch {}
            if (Date.now() - startedAt > timeout) {
              reject(new Error("Timed out waiting for " + label));
              return;
            }
            setTimeout(tick, 50);
          };
          tick();
        });
        const setTextareaValue = (element, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
          if (setter) setter.call(element, value);
          else element.value = value;
          element.dispatchEvent(new Event("input", { bubbles: true }));
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
        const visibleButtonDebug = (button) => {
          const style = getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return {
            text: button.textContent.trim(),
            owner: button.getAttribute("data-studio-agent-control-owner"),
            disabled: Boolean(button.disabled),
            display: style.display,
            visibility: style.visibility,
            opacity: Number(style.opacity),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom)
          };
        };
        const assertHeaderControlsVisible = async (phase) => {
          const headerControls = await waitFor('[data-studio-agent-header-controls]');
          const viewerToggleButton = await waitFor('[data-studio-agent-meow-viewer-toggle][data-studio-agent-control-owner="header"]', 8000);
          const stopButton = await waitFor('[data-studio-agent-stop][data-studio-agent-control-owner="header"]', 8000);
          const runtimeViewerToggleButton = document.querySelector('[data-studio-agent-meow-viewer-toggle][data-studio-agent-control-owner="runtime"]');
          const runtimeStopButton = document.querySelector('[data-studio-agent-stop][data-studio-agent-control-owner="runtime"]');
          const runtimeControls = document.querySelector('[data-studio-agent-runtime-controls]');
          if (runtimeViewerToggleButton || runtimeStopButton || runtimeControls) {
            throw new Error("Studio controls should be single-owned by the Agent header during " + phase + ", not duplicated inside the runtime surface.");
          }
          const headerControlsRect = headerControls.getBoundingClientRect();
          const viewerRect = viewerToggleButton.getBoundingClientRect();
          const stopRect = stopButton.getBoundingClientRect();
          const viewerButtonDebug = visibleButtonDebug(viewerToggleButton);
          const stopButtonDebug = visibleButtonDebug(stopButton);
          for (const [name, debug] of [
            ["viewer", viewerButtonDebug],
            ["stop", stopButtonDebug]
          ]) {
            if (debug.display === "none" || debug.visibility === "hidden" || debug.opacity <= 0.01 || debug.width < 16 || debug.height < 16) {
              throw new Error("Studio Agent controls should stay visible in the Agent header during " + phase + ": " + name + " " + JSON.stringify(debug));
            }
          }
          if (!viewerButtonDebug.text.includes("Meow Viewer") || !stopButtonDebug.text.includes("关机")) {
            throw new Error("Studio Agent controls should keep complete labels during " + phase + ": " + JSON.stringify({
              viewer: viewerButtonDebug,
              stop: stopButtonDebug,
              viewport: { width: window.innerWidth, height: window.innerHeight }
            }));
          }
          const controlsOverlap = viewerRect.right > stopRect.left - 2 && stopRect.right > viewerRect.left + 2 && viewerRect.bottom > stopRect.top + 2 && stopRect.bottom > viewerRect.top + 2;
          if (
            controlsOverlap ||
            viewerRect.left < headerControlsRect.left - 2 ||
            stopRect.right > headerControlsRect.right + 2 ||
            viewerRect.top < headerControlsRect.top - 2 ||
            viewerRect.bottom > headerControlsRect.bottom + 2 ||
            stopRect.top < headerControlsRect.top - 2 ||
            stopRect.bottom > headerControlsRect.bottom + 2
          ) {
            throw new Error("Studio Agent controls should fit inside the Agent header without overlap or clipping during " + phase + ": " + JSON.stringify({
              viewer: rectDebug(viewerToggleButton),
              stop: rectDebug(stopButton),
              headerControls: rectDebug(headerControls),
              viewport: { width: window.innerWidth, height: window.innerHeight }
            }));
          }
          return {
            viewer: viewerButtonDebug,
            stop: stopButtonDebug,
            headerControls: rectDebug(headerControls)
          };
        };

        await click('[data-next-route="studio"]');
        await waitFor('[data-studio-route]');
        await click('[data-studio-agent-add]');
        await waitFor('[data-studio-agent-picker-dialog]');
        await waitFor('[data-studio-agent-choice="smoke-workshop-agent"]');
        await click('[data-studio-agent-choice="smoke-workshop-agent"]');
        await waitFor('[data-studio-agent-start]');
        let originalStartTerminal = null;
        if (window.workbench?.startTerminal) {
          originalStartTerminal = window.workbench.startTerminal.bind(window.workbench);
          window.workbench.startTerminal = async (payload) => {
            await delay(360);
            return originalStartTerminal(payload);
          };
        }
        await click('[data-studio-agent-start]');
        await waitFor('[data-studio-agent-terminal-runtime][data-studio-agent-terminal-status="starting"]', 8000);
        const startingControls = await assertHeaderControlsVisible("starting");
        if (startingControls.stop.disabled) {
          throw new Error("Studio stop button should stay visible and enabled while the Agent startup request is pending, so users can cancel a hung startup.");
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
              warning: { display: initialWarningStyle.display, opacity: initialWarningStyle.opacity, rect: rectDebug(warning) },
              content: { opacity: initialContentStyle.opacity, pointerEvents: initialContentStyle.pointerEvents, transform: initialContentStyle.transform }
            }));
          }
          dialog.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }));
          dialog.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
          await waitUntil(label + " close dialog hover expansion", () => {
            const style = getComputedStyle(content);
            return dialog.getAttribute("data-vs-surface-close-expanded") === "true" && Number(style.opacity || "0") >= 0.8 && style.pointerEvents !== "none";
          });
        };
        await click('[data-studio-agent-stop][data-studio-agent-control-owner="header"]');
        await waitFor('[data-studio-agent-stop-dialog]');
        await assertSurfaceCloseHoverTrigger('[data-studio-agent-stop-dialog]', "Studio Agent stop");
        await click('[data-studio-agent-stop-confirm]');
        await delay(720);
        const canceledRuntime = await waitFor('[data-studio-agent-terminal-runtime][data-studio-agent-terminal-status="selected"]', 8000);
        if (canceledRuntime.getAttribute("data-studio-agent-terminal-status") !== "selected") {
          throw new Error("Cancelling a pending Studio Agent startup should leave the workstation selected, not revive as running.");
        }
        if (document.querySelector('[data-studio-agent-terminal-runtime][data-studio-agent-terminal-status="running"]')) {
          throw new Error("Late terminal start must not resurrect a cancelled Studio Agent startup.");
        }
        if (originalStartTerminal) {
          window.workbench.startTerminal = originalStartTerminal;
        }
        await waitFor('[data-studio-agent-start]');
        await click('[data-studio-agent-start]');
        const runtime = await waitFor('[data-studio-agent-terminal-runtime][data-studio-agent-terminal-status="running"]', 8000);
        await waitForText('[data-studio-agent-terminal-runtime]', "Studio Viewer Smoke", 8000);
        const runningControls = await assertHeaderControlsVisible("running");
        if (runningControls.stop.disabled) {
          throw new Error("Studio stop button should be enabled once the Agent is running.");
        }

        await click('[data-studio-agent-meow-viewer-toggle][data-studio-agent-control-owner="header"]');
        const overlay = await waitFor('[data-studio-meow-viewer-overlay][data-studio-meow-viewer-status="running"]', 8000);
        const conversation = await waitFor('[data-studio-meow-viewer-overlay] [data-r2-output-renderer-conversation]');
        await waitFor('[data-studio-meow-viewer-overlay] [data-r2-output-renderer-table]');
        await waitFor('[data-studio-meow-viewer-overlay] [data-r2-output-renderer-diff]');
        const composer = await waitFor('[data-studio-meow-viewer-composer]');
        const body = await waitFor('[data-studio-meow-viewer-body]');
        const overlayRect = overlay.getBoundingClientRect();
        const composerRect = composer.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        if (Math.abs(composerRect.bottom - overlayRect.bottom) > 5 || bodyRect.bottom > composerRect.top + 2) {
          throw new Error("Studio Meow Viewer composer should stay pinned under the shared viewer body: " + JSON.stringify({
            overlayBottom: Math.round(overlayRect.bottom),
            bodyBottom: Math.round(bodyRect.bottom),
            composerTop: Math.round(composerRect.top),
            composerBottom: Math.round(composerRect.bottom)
          }));
        }

        const input = await waitFor('[data-studio-meow-viewer-input]');
        setTextareaValue(input, "studio viewer ping");
        await click('[data-studio-meow-viewer-send]');
        await waitForText('[data-studio-meow-viewer-overlay]', "Studio Echo", 8000);
        await waitForText('[data-studio-meow-viewer-overlay]', "studio viewer ping", 8000);
        const runtimeStatusBeforeStop = runtime.getAttribute("data-studio-agent-terminal-status");
        await click('[data-studio-agent-stop][data-studio-agent-control-owner="header"]');
        await waitFor('[data-studio-agent-stop-dialog]');
        await click('[data-studio-agent-stop-confirm]');
        await waitFor('[data-studio-agent-terminal-runtime][data-studio-agent-terminal-status="selected"]', 8000);

        return {
          scenario: "studio-meow-viewer-shared-core",
          runtimeStatus: runtimeStatusBeforeStop,
          profile: overlay.getAttribute("data-studio-meow-viewer-profile"),
          conversationProfile: conversation.getAttribute("data-r2-output-renderer-conversation-profile"),
          composerBottom: Math.round(composerRect.bottom),
          overlayBottom: Math.round(overlayRect.bottom),
          startupCancelStatus: canceledRuntime.getAttribute("data-studio-agent-terminal-status"),
          startingControls,
          runningControls: {
            viewer: runningControls.viewer,
            stop: runningControls.stop,
            headerControls: runningControls.headerControls
          }
        };
      })()
    `, true);
  }
}

async function runStudioCreateDraftScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario !== "studio-create-draft") {
    throw new Error(`Unknown renderer smoke scenario: ${scenario}`);
  }

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

      await click('[data-next-route="lobby"]');
      window.localStorage.setItem("meowdesk.studio.removedWorkshopProjects.v1", JSON.stringify(["smoke-sidebar-widget"]));
      window.dispatchEvent(new CustomEvent("meowdesk:studio-removed-workshop-projects-changed", { detail: { ids: ["smoke-sidebar-widget"] } }));
      await click('[data-next-route="studio"]');
      await waitFor('[data-studio-agent-panel][data-studio-agent-stage-current="workstation"]');
      await waitFor('[data-studio-agent-add]');
      await click('[data-studio-new-draft]');
      if (document.querySelector('[data-studio-draft-type="skill"]')) {
        throw new Error("Skill should not appear in the workshop project draft type picker.");
      }

      const input = await waitFor('[data-studio-draft-name]');
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      valueSetter.call(input, "Smoke 工坊草稿");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await delay(120);

      await click('[data-studio-draft-type="sidebar-widget"]');
      await click('[data-studio-draft-ready]');

      const submit = await waitFor('[data-studio-create-draft]');
      if (submit.disabled) throw new Error("Create draft button stayed disabled.");
      submit.click();
      await delay(250);

      await click('[data-studio-inspector-panel-tab="projects"]');
      const created = await waitFor('[data-studio-project-item="Smoke 工坊草稿"]');
      await click('[data-studio-page-tab="manage"]');
      await waitFor('[data-studio-workshop-management]');
      const restoreRemoved = await waitFor('[data-studio-restore-removed-projects]');
      if (!restoreRemoved.textContent.includes("1")) {
        throw new Error("Removed project restore control should show the hidden project count: " + restoreRemoved.textContent);
      }
      await click('[data-studio-restore-removed-projects]');
      if (document.querySelector('[data-studio-restore-removed-projects]')) {
        throw new Error("Removed project restore control should disappear after restore.");
      }
      await waitFor('[data-studio-project-bucket="published"]');
      await click('[data-studio-project-bucket="published"]');
      await waitFor('[data-studio-project-type-filter-button]');
      await click('[data-studio-project-type-filter-button]');
      await waitFor('[data-studio-project-type-filter-menu]');
      await waitFor('[data-studio-project-type-filter-option="feature-page"]');
      await click('[data-studio-project-type-filter-option="sidebar-widget"]');
      await waitFor('[data-studio-project-type-filter-button][data-studio-project-type-filter-value="sidebar-widget"]');
      await waitFor('[data-studio-project-item="Smoke 工坊草稿"]');
      return {
        scenario: "studio-create-draft",
        created: created.textContent.includes("Smoke 工坊草稿"),
        text: created.textContent
      };
    })()
  `, true);
}

const studioBoundarySmokeScenarios = Object.freeze({
  "studio-no-desktop-placeholder": runStudioNoDesktopPlaceholderScenario,
  "studio-runtime-boundary": runStudioRuntimeBoundaryScenario,
  "studio-aux-segment-family": runStudioAuxSegmentFamilyScenario,
  "studio-agent-picker-visual": runStudioAgentPickerVisualScenario,
  "studio-terminal-boundary": runStudioTerminalBoundaryScenario,
  "studio-meow-viewer-shared-core": runStudioMeowViewerSharedCoreScenario,
  "studio-create-draft": runStudioCreateDraftScenario,
});

module.exports = {
  studioBoundarySmokeScenarios
};

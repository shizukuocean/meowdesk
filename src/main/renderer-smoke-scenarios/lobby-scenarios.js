"use strict";

async function runLobbyPluginTabsScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "lobby-plugin-tabs") {
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
        await waitFor('[data-lobby-official]');
        await delay(260);
        const registry = await waitFor('[data-open-surface-registry]');
        const vsErrors = window.__meowdeskVsErrors || [];
        if (document.querySelector('[data-vs-visual-stage]') || registry.classList.contains("vs-has-visual-stage")) {
          throw new Error("Live lobby should render the real route directly, without a VS temporary visual stage: " + JSON.stringify({
            hasVisualStage: Boolean(document.querySelector('[data-vs-visual-stage]')),
            registryClass: registry.className
          }));
        }
        if (vsErrors.length) {
          throw new Error("VS visual errors should stay empty in live lobby: " + JSON.stringify(vsErrors));
        }
        if (document.querySelector(".vs-visual-badge")) {
          throw new Error("Live lobby should not expose the VS visual debug badge.");
        }
        if (document.documentElement.dataset.vsBootMotionPlayed === "true") {
          throw new Error("VS boot motion should not run in live app mode.");
        }
        if (document.querySelector('[data-lobby-welcome]')) {
          throw new Error("Live lobby must not render the removed welcome/login branch.");
        }
        if (document.querySelector('[data-lobby-top-login-page], [data-lobby-login-start], [data-lobby-register-start], [data-lobby-auth-form]')) {
          throw new Error("Live lobby must not expose removed login/welcome controls.");
        }
        await waitFor('[data-lobby-section-tab="plugins"]');
        await waitFor('[data-lobby-section-tab="friends"]');
        await waitFor('[data-lobby-section-tab="profile"]');
        await waitFor('[data-lobby-section-tab="guide"]');
        if (document.querySelector("[data-next-sidebar-toggle]")) {
          throw new Error("Live lobby must not render the removed stray main sidebar collapse button.");
        }
        for (const selector of ['[data-r15-theme-sidebar-toggle]', '[data-next-sidebar-settings]']) {
          const button = await waitFor(selector);
          const rect = button.getBoundingClientRect();
          if (rect.width < 30 || rect.height < 30) {
            throw new Error("Icon-only main sidebar should keep theme/settings entry visible: " + selector);
          }
        }
        const topSections = await waitFor('[data-lobby-top-sections]');
        if (!topSections.closest("header")) {
          throw new Error("Lobby section navigation should live in the top header.");
        }
        const lobbySectionOrder = [...topSections.querySelectorAll("[data-lobby-section-tab]")]
          .map((element) => element.getAttribute("data-lobby-section-tab"));
        if (lobbySectionOrder.join(",") !== "profile,guide,friends,plugins") {
          throw new Error("Lobby top section order mismatch: " + lobbySectionOrder.join(","));
        }
        const communityTab = await waitFor('[data-lobby-section-tab="plugins"]');
        const communityLabel = [
          communityTab.textContent,
          communityTab.getAttribute("aria-label"),
          communityTab.getAttribute("title")
        ].filter(Boolean).join(" ");
        if (!communityLabel.includes("社区")) {
          throw new Error("Lobby plugins entry should keep the 社区 semantic label even when VS renders it as an icon: " + communityLabel);
        }
        const officialRoute = await waitFor('[data-lobby-official]');
        if (officialRoute.querySelector("[data-lobby-section-tab]")) {
          throw new Error("Lobby content should not repeat section tabs inside the page body.");
        }
        await click('[data-lobby-section-tab="profile"]');
        await waitFor('[data-lobby-official]');
        await waitFor('[data-lobby-profile-page]');
        await click('[data-lobby-section-tab="plugins"]');
        if ([...document.querySelectorAll("[data-lobby-section-tab]")].some((element) => element.textContent.trim() === "社交广场")) {
          throw new Error("Lobby should not expose 社交广场 as a standalone feature tab.");
        }
        await click('[data-lobby-section-tab="friends"]');
        await waitFor('[data-lobby-friends-panel]');
        await click('[data-lobby-section-tab="profile"]');
        const profilePage = await waitFor('[data-lobby-profile-page]');
        const publicProfileAvatar = await waitFor('[data-lobby-profile-avatar]');
        if (publicProfileAvatar.querySelector("svg") || publicProfileAvatar.textContent.includes("更换头像")) {
          throw new Error("Lobby public profile avatar should not expose camera/change-avatar controls.");
        }
        await waitFor('[data-lobby-profile-title-strip]');
        await waitFor('[data-lobby-profile-works]');
        const profileWorkRows = [...profilePage.querySelectorAll('[data-lobby-profile-work-row]')];
        if (!profileWorkRows.length) {
          throw new Error("Lobby profile should render published-work rows for the public profile list.");
        }
        const decoratedRows = profileWorkRows.map((row) => {
          const before = getComputedStyle(row, "::before");
          const after = getComputedStyle(row, "::after");
          return {
            className: String(row.className || ""),
            interactiveCard: row.classList.contains("vs-interactive-card"),
            decorated: row.getAttribute("data-vs-card-decorated") || "",
            beforeContent: before.content,
            beforeBoxShadow: before.boxShadow,
            afterContent: after.content,
            afterBoxShadow: after.boxShadow
          };
        }).filter((row) =>
          row.interactiveCard ||
          row.decorated === "true" ||
          row.beforeContent !== "none" ||
          row.afterContent !== "none" ||
          row.beforeBoxShadow !== "none" ||
          row.afterBoxShadow !== "none"
        );
        if (decoratedRows.length) {
          throw new Error("Lobby published-work rows are list rows, not object cards; they must not receive card glow owner: " + JSON.stringify(decoratedRows));
        }
        const statTracks = profileWorkRows.map((row) => {
          const stats = row.querySelector('[data-lobby-profile-work-stats]');
          if (!stats) {
            throw new Error("Lobby profile work row should expose the aligned stats track.");
          }
          const rect = stats.getBoundingClientRect();
          const rowRect = row.getBoundingClientRect();
          const items = [...stats.children].map((item) => {
            const itemRect = item.getBoundingClientRect();
            return {
              width: Math.round(itemRect.width),
              centerY: Math.round(itemRect.top + itemRect.height / 2)
            };
          });
          return {
            row: { left: Math.round(rowRect.left), right: Math.round(rowRect.right), centerY: Math.round(rowRect.top + rowRect.height / 2) },
            stats: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), centerY: Math.round(rect.top + rect.height / 2) },
            items
          };
        });
        const misalignedStats = statTracks.filter((track) =>
          track.stats.width !== 460 ||
          Math.abs(track.row.right - track.stats.right) > 2 ||
          Math.abs(track.row.centerY - track.stats.centerY) > 2 ||
          track.items.some((item) => Math.abs(item.centerY - track.stats.centerY) > 2)
        );
        const firstStats = statTracks[0]?.stats;
        const driftingStats = firstStats
          ? statTracks.filter((track) =>
            Math.abs(track.stats.left - firstStats.left) > 2 ||
            Math.abs(track.stats.right - firstStats.right) > 2
          )
          : [];
        if (misalignedStats.length) {
          throw new Error("Lobby profile work stats should share one fixed right-aligned track: " + JSON.stringify(misalignedStats));
        }
        if (driftingStats.length) {
          throw new Error("Lobby profile work stats should not drift between rows: " + JSON.stringify({ first: firstStats, drifting: driftingStats }));
        }
        if (profilePage.querySelector('[data-lobby-profile-showcase-slot]') || profilePage.textContent.includes("主页展示位")) {
          throw new Error("Lobby profile page should not render the removed showcase placeholder.");
        }
        await click('[data-lobby-section-tab="guide"]');
        await waitFor('[data-lobby-agent-tutorial]');
        await waitFor('[data-lobby-guide-meowni]');
        const guideTip = await waitFor('[data-lobby-guide-tip]');
        if (!guideTip.textContent.includes("CLI Agent") || !guideTip.textContent.includes("外部唤起")) {
          throw new Error("Starter guide tip should distinguish CLI Agent and desktop external launch: " + guideTip.textContent);
        }
        await waitFor('[data-lobby-guide-jump="has-agent"]');
        await waitFor('[data-lobby-guide-jump="desktop-agent"]');
        await waitFor('[data-lobby-guide-jump="no-agent"]');
        const hasAgentPathCard = await waitFor('[data-lobby-guide-path-card="has-agent"]');
        if (!hasAgentPathCard.textContent.includes("CLI Agent")) {
          throw new Error("Has-agent guide path should use CLI Agent wording: " + hasAgentPathCard.textContent);
        }
        const desktopAgentPathCard = await waitFor('[data-lobby-guide-path-card="desktop-agent"]');
        if (!desktopAgentPathCard.textContent.includes("工坊外部唤起") || !desktopAgentPathCard.textContent.includes("工位内运行")) {
          throw new Error("Desktop-agent guide path should explain external launch before CLI setup: " + desktopAgentPathCard.textContent);
        }
        await waitFor('[data-lobby-guide-path-card="no-agent"]');
        const assertGuideImageLoaded = async (selector) => {
          const image = await waitFor(selector);
          const startedAt = Date.now();
          while (
            image instanceof HTMLImageElement &&
            (!image.complete || image.naturalWidth < 24 || image.naturalHeight < 24) &&
            Date.now() - startedAt < 5000
          ) {
            await delay(80);
          }
          if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth < 24 || image.naturalHeight < 24) {
            throw new Error("Starter guide image did not load: " + selector);
          }
          return image;
        };
        await assertGuideImageLoaded('[data-lobby-guide-card-asset="command"]');
        await assertGuideImageLoaded('[data-lobby-guide-card-asset="help"]');
        await assertGuideImageLoaded('[data-lobby-guide-card-asset="warning"]');
        await waitFor('[data-lobby-guide-section="has-agent"]');
        await waitFor('[data-lobby-cli-setup-guide]');
        await waitFor('[data-lobby-agent-settings-link]');
        await waitFor('[data-lobby-cli-command-tips]');
        await waitFor('[data-lobby-cli-shortcut-warning]');
        await waitFor('[data-lobby-cli-guide-step="template"]');
        await waitFor('[data-lobby-cli-guide-step="settings"]');
        await waitFor('[data-lobby-cli-guide-step="save"]');
        const cliUseStep = await waitFor('[data-lobby-cli-guide-step="use"]');
        if (
          !cliUseStep.textContent.includes("保存配置完成") ||
          !cliUseStep.textContent.includes("Meowdesk 会记住") ||
          cliUseStep.textContent.includes("工作区") ||
          cliUseStep.textContent.includes("工坊")
        ) {
          throw new Error("CLI setup final step should focus on saved configuration, not usage routing: " + cliUseStep.textContent);
        }
        await waitFor('[data-lobby-agent-settings-link]');
        if (document.querySelector('[data-lobby-agent-workspace-link]') || document.querySelector('[data-lobby-agent-studio-link]')) {
          throw new Error("CLI setup guide should focus on configuration, not usage CTAs.");
        }
        await assertGuideImageLoaded('[data-lobby-guide-asset="command"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="help"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="success"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="laptop"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="shortcut-warning"]');
        const desktopGuideSection = await waitFor('[data-lobby-guide-section="desktop-agent"]');
        if (!desktopGuideSection.textContent.includes("不会把窗口嵌入") || !desktopGuideSection.textContent.includes("保存为 CLI Agent")) {
          throw new Error("Desktop-agent section should explain non-embedded handoff and optional CLI Agent setup: " + desktopGuideSection.textContent);
        }
        await waitFor('[data-lobby-guide-section="no-agent"]');
        const desktopGuideNote = await waitFor('[data-lobby-guide-note="desktop-agent"]');
        if (!desktopGuideNote.textContent.includes("外部唤起") || !desktopGuideNote.textContent.includes("工位内运行")) {
          throw new Error("Desktop-agent note should give a soft handoff prompt: " + desktopGuideNote.textContent);
        }
        await waitFor('[data-lobby-agent-settings-link]');
        if (document.querySelector('[data-lobby-agent-workspace-link]') || document.querySelector('[data-lobby-agent-studio-link]')) {
          throw new Error("Starter guide should not route configured CLI users to workspace/studio before setup is complete.");
        }
        await waitFor('[data-lobby-desktop-agent-studio-link]');
        await waitFor('[data-lobby-no-agent-settings-link]');
        const guideSurface = await waitFor('[data-lobby-starter-center]');
        const isSectionInGuideView = (selector) => {
          const section = document.querySelector(selector);
          if (!section) return false;
          const guideRect = guideSurface.getBoundingClientRect();
          const sectionRect = section.getBoundingClientRect();
          return sectionRect.top >= guideRect.top - 4 && sectionRect.top <= guideRect.bottom - 40;
        };
        const guideScrollTop = guideSurface.scrollTop;
        await click('[data-lobby-guide-jump="desktop-agent"]');
        await delay(350);
        if (guideSurface.scrollTop <= guideScrollTop && !isSectionInGuideView('[data-lobby-guide-section="desktop-agent"]')) {
          throw new Error("Starter guide desktop-agent jump should scroll to the desktop-agent tutorial section.");
        }
        const desktopGuideScrollTop = guideSurface.scrollTop;
        await click('[data-lobby-guide-jump="no-agent"]');
        await delay(650);
        if (guideSurface.scrollTop <= desktopGuideScrollTop && !isSectionInGuideView('[data-lobby-guide-section="no-agent"]')) {
          throw new Error("Starter guide jump buttons should scroll to downstream tutorial sections.");
        }
        await click('[data-lobby-agent-settings-link]');
        await waitFor('[data-r2-access-route]');
        await waitFor('[data-r2-access-section="workspace"]');
        await waitFor('[data-r2-access-menu-item="workspace"][data-r2-access-menu-active="true"]');
        await click('[data-next-route="lobby"]');
        await click('[data-lobby-section-tab="plugins"]');
        await waitFor('[data-lobby-plugin-subpage="sidebar"]');
        if (document.querySelector('[data-lobby-plugin-tab]')) {
          throw new Error("Plugin marketplace should not render category tabs inside the main display frame.");
        }
        await waitFor('[data-lobby-plugin-market-card="smoke-sidebar-widget"][data-lobby-plugin-card-interactive="true"]');
        await click('[data-lobby-plugin-market-card="smoke-sidebar-widget"]');
        await waitFor('[data-lobby-plugin-detail-id="smoke-sidebar-widget"]');
        const pluginDetailScroller = await waitFor('[data-lobby-plugin-subpage-scroll]');
        await waitFor('[data-lobby-plugin-demo="smoke-sidebar-widget"]');
        await waitFor('[data-lobby-plugin-demo-empty="smoke-sidebar-widget"]');
        if (document.querySelector('[data-lobby-plugin-demo-frame="smoke-sidebar-widget"]')) {
          throw new Error("Lobby plugin detail should not render runtime iframe as product demo.");
        }
        await waitFor('[data-lobby-plugin-author="smoke-sidebar-widget"]');
        await waitFor('[data-lobby-plugin-version="smoke-sidebar-widget"]');
        await waitFor('[data-lobby-plugin-snapshots="smoke-sidebar-widget"]');
        if (document.querySelector('[data-lobby-plugin-update-action], [data-lobby-plugin-action-status]')) {
          throw new Error("Lobby detail must not expose the removed update/install test action. Install/update testing belongs in Settings/Studio, not the community detail surface.");
        }
        if ((document.querySelector('[data-lobby-plugin-detail-id="smoke-sidebar-widget"]')?.textContent || "").includes("更新测试")) {
          throw new Error("Lobby detail must not render the removed 更新测试 entry.");
        }
        if (pluginDetailScroller.scrollHeight > pluginDetailScroller.clientHeight + 2) {
          const beforePluginDetailScroll = pluginDetailScroller.scrollTop;
          pluginDetailScroller.scrollTop = pluginDetailScroller.scrollHeight;
          await delay(80);
          if (pluginDetailScroller.scrollTop <= beforePluginDetailScroll && pluginDetailScroller.scrollHeight > pluginDetailScroller.clientHeight + 24) {
            throw new Error("Lobby plugin detail scroller did not scroll.");
          }
        }
        await click('[data-lobby-plugin-detail-back]');
        await waitFor('[data-lobby-plugin-subpage="sidebar"]');
        await click('[data-lobby-plugin-subpage-link="skill"]');
        await delay(350);
        const skillPanel = document.querySelector('[data-lobby-plugin-featured="skill"]');
        if (!skillPanel) {
          const panels = [...document.querySelectorAll('[data-lobby-plugin-featured]')]
            .map((element) => ({
              id: element.getAttribute("data-lobby-plugin-featured"),
              text: element.textContent
            }));
          throw new Error("Skill plugin panel not found. Existing panels: " + JSON.stringify(panels));
        }
        if (!skillPanel.hasAttribute("data-lobby-plugin-market-card")) {
          throw new Error("Plugin marketplace featured item should render as a square card, got: " + skillPanel.outerHTML.slice(0, 240));
        }
        const pluginCards = [...document.querySelectorAll("[data-lobby-plugin-market-card]")];
        if (!pluginCards.length) {
          throw new Error("Plugin marketplace should expose card items.");
        }
        const topNavTitle = await waitFor('[data-top-nav-title]');
        const topNavTitleText = topNavTitle.textContent.trim();
        if (!topNavTitleText.includes("大厅") || topNavTitleText.includes("插件")) {
          throw new Error("Lobby smoke should finish on the Lobby top bar, got: " + topNavTitle.textContent.trim());
        }
        if (window.location.hash !== "#lobby") {
          throw new Error("Lobby smoke should finish on #lobby, got: " + window.location.hash);
        }
        const shell = await waitFor('[data-route-shell]');
        const route = await waitFor('[data-lobby-route]');
        const overflow = {
          innerWidth: window.innerWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          shellClientWidth: shell.clientWidth,
          shellScrollWidth: shell.scrollWidth,
          shellClientHeight: shell.clientHeight,
          shellScrollHeight: shell.scrollHeight,
          routeClientHeight: route.clientHeight,
          routeScrollHeight: route.scrollHeight
        };
        if (
          overflow.documentScrollWidth - overflow.innerWidth > 2 ||
          overflow.shellScrollWidth - overflow.shellClientWidth > 2 ||
          overflow.shellScrollHeight - overflow.shellClientHeight > 2
        ) {
          throw new Error("Lobby route surface overflowed: " + JSON.stringify(overflow));
        }
        return {
          scenario: "lobby-plugin-tabs",
          pluginCards: pluginCards.length,
          selected: skillPanel.textContent.includes("工作流上下文包"),
          text: skillPanel.textContent,
          overflow
        };
      })()
    `, true);
  }
}

async function runLobbySignedInStartupScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "lobby-signed-in-startup") {
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
            setTimeout(tick, 25);
          };
          tick();
        });
        const observedStates = [];
        const readState = () => document.querySelector('[data-lobby-auth-state]')?.getAttribute('data-lobby-auth-state') || "";
        const recordState = () => {
          const state = readState();
          if (state && observedStates[observedStates.length - 1] !== state) observedStates.push(state);
        };
        const observer = new MutationObserver(recordState);
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-lobby-auth-state"] });
        recordState();
        await waitFor('[data-lobby-route]');
        await waitFor('[data-lobby-auth-state="signed-in"]', 8000);
        await delay(80);
        recordState();
        observer.disconnect();
        const state = readState();
        if (document.querySelector('[data-lobby-welcome]') || observedStates.includes("welcome") || observedStates.includes("login") || observedStates.includes("register")) {
          throw new Error("Signed-in lobby startup must not render the welcome/auth branch while the local profile is loading: " + JSON.stringify({
            state,
            observedStates,
            hasWelcome: Boolean(document.querySelector('[data-lobby-welcome]'))
          }));
        }
        await waitFor('[data-lobby-official]');
        await waitFor('[data-lobby-section-tab="profile"]');
        const profilePage = await waitFor('[data-lobby-profile-page]');
        const profileHero = await waitFor('[data-lobby-profile-hero]');
        const profileWorks = await waitFor('[data-lobby-profile-works]');
        const profileRect = profilePage.getBoundingClientRect();
        const heroRect = profileHero.getBoundingClientRect();
        const worksRect = profileWorks.getBoundingClientRect();
        if (profileRect.width < 240 || profileRect.height < 240 || heroRect.height < 120 || worksRect.height < 80) {
          throw new Error("Signed-in lobby startup should render the official profile page before screenshot capture, not an empty shell: " + JSON.stringify({
            profile: {
              width: Math.round(profileRect.width),
              height: Math.round(profileRect.height)
            },
            hero: {
              width: Math.round(heroRect.width),
              height: Math.round(heroRect.height)
            },
            works: {
              width: Math.round(worksRect.width),
              height: Math.round(worksRect.height)
            },
            text: profilePage.textContent.slice(0, 240)
          }));
        }
        if (state !== "signed-in") {
          throw new Error("Signed-in lobby startup should settle on the official lobby: " + JSON.stringify({ state, observedStates }));
        }
        return {
          scenario: "lobby-signed-in-startup",
          state,
          observedStates,
          profileRendered: {
            profileHeight: Math.round(profileRect.height),
            heroHeight: Math.round(heroRect.height),
            worksHeight: Math.round(worksRect.height)
          }
        };
      })()
    `, true);
  }
}

async function runLobbyGuideVisualScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "lobby-guide-visual") {
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
        const rectFor = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom)
          };
        };

        await click('[data-next-route="lobby"]');
        await waitFor('[data-lobby-official]');
        await click('[data-lobby-section-tab="guide"]');
        const guide = await waitFor('[data-lobby-agent-tutorial]');
        const hero = await waitFor('[data-lobby-guide-hero]');
        const stage = await waitFor('[data-lobby-guide-stage]');
        const meowni = await waitFor('[data-lobby-guide-meowni]');
        const tip = await waitFor('[data-lobby-guide-tip]');
        const assertGuideImageLoaded = async (selector) => {
          const image = await waitFor(selector);
          const startedAt = Date.now();
          while (
            image instanceof HTMLImageElement &&
            (!image.complete || image.naturalWidth < 24 || image.naturalHeight < 24) &&
            Date.now() - startedAt < 5000
          ) {
            await delay(80);
          }
          if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth < 24 || image.naturalHeight < 24) {
            throw new Error("Starter guide image did not load: " + selector);
          }
          return image;
        };
        await assertGuideImageLoaded('[data-lobby-guide-asset="command"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="help"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="success"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="laptop"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="shortcut-warning"]');
        await waitFor('[data-lobby-guide-path-card="has-agent"]');
        await waitFor('[data-lobby-guide-path-card="desktop-agent"]');
        await waitFor('[data-lobby-guide-path-card="no-agent"]');
        await waitFor('[data-lobby-guide-section="has-agent"]');
        await waitFor('[data-lobby-cli-guide-step="template"]');
        await waitFor('[data-lobby-cli-guide-step="settings"]');
        await waitFor('[data-lobby-cli-guide-step="save"]');
        await waitFor('[data-lobby-cli-guide-step="use"]');
        await waitFor('[data-lobby-guide-section="desktop-agent"]');
        await waitFor('[data-lobby-guide-section="no-agent"]');
        await waitFor('[data-lobby-agent-settings-link]');
        if (document.querySelector('[data-lobby-agent-workspace-link]') || document.querySelector('[data-lobby-agent-studio-link]')) {
          throw new Error("Lobby CLI guide summary should only expose configuration CTA.");
        }
        await waitFor('[data-lobby-desktop-agent-studio-link]');
        await waitFor('[data-lobby-no-agent-settings-link]');
        const shell = await waitFor('[data-route-shell]');
        const route = await waitFor('[data-lobby-route]');
        const stageRect = rectFor(stage);
        const meowniRect = rectFor(meowni);
        const tipRect = rectFor(tip);
        const overlapX = Math.max(0, Math.min(meowniRect.right, tipRect.right) - Math.max(meowniRect.x, tipRect.x));
        const overlapY = Math.max(0, Math.min(meowniRect.bottom, tipRect.bottom) - Math.max(meowniRect.y, tipRect.y));
        const overlapArea = overlapX * overlapY;
        const maxAllowedOverlap = Math.round(meowniRect.width * meowniRect.height * 0.18);
        if (overlapArea > maxAllowedOverlap) {
          throw new Error("Guide tip overlaps Meowni too much: " + JSON.stringify({ meowniRect, tipRect, overlapArea, maxAllowedOverlap }));
        }
        if (
          tipRect.right > stageRect.right + 2 ||
          tipRect.bottom > stageRect.bottom + 2 ||
          meowniRect.x < stageRect.x - 2 ||
          meowniRect.bottom > stageRect.bottom + 2
        ) {
          throw new Error("Guide stage content should stay inside stage: " + JSON.stringify({ stageRect, meowniRect, tipRect }));
        }
        const overflow = {
          innerWidth: window.innerWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          shellClientWidth: shell.clientWidth,
          shellScrollWidth: shell.scrollWidth,
          routeClientWidth: route.clientWidth,
          routeScrollWidth: route.scrollWidth,
          guideClientWidth: guide.clientWidth,
          guideScrollWidth: guide.scrollWidth,
          heroClientWidth: hero.clientWidth,
          heroScrollWidth: hero.scrollWidth
        };
        if (
          overflow.documentScrollWidth - overflow.innerWidth > 2 ||
          overflow.shellScrollWidth - overflow.shellClientWidth > 2 ||
          overflow.routeScrollWidth - overflow.routeClientWidth > 2 ||
          overflow.guideScrollWidth - overflow.guideClientWidth > 2 ||
          overflow.heroScrollWidth - overflow.heroClientWidth > 2
        ) {
          throw new Error("Lobby guide visual surface overflowed: " + JSON.stringify(overflow));
        }
        return {
          scenario: "lobby-guide-visual",
          stageRect,
          meowniRect,
          tipRect,
          overlapArea,
          overflow
        };
      })()
    `, true);
  }
}

async function runLobbyGuideCliSectionScenario(win, dependencies = {}, scenario) {
  const defaultWorkspaceDirectory = typeof dependencies.defaultWorkspaceDirectory === "function"
    ? dependencies.defaultWorkspaceDirectory
    : () => process.cwd();
  if (scenario === "lobby-guide-cli-section") {
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
        const assertGuideImageLoaded = async (selector) => {
          const image = await waitFor(selector);
          const startedAt = Date.now();
          while (
            image instanceof HTMLImageElement &&
            (!image.complete || image.naturalWidth < 24 || image.naturalHeight < 24) &&
            Date.now() - startedAt < 5000
          ) {
            await delay(80);
          }
          if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth < 24 || image.naturalHeight < 24) {
            throw new Error("Starter guide image did not load: " + selector);
          }
          return image;
        };
        await waitFor('[data-lobby-auth-state]');
        const state = document.querySelector('[data-lobby-auth-state]')?.getAttribute('data-lobby-auth-state');
        if (state !== "signed-in") {
          throw new Error("Lobby guide smoke should start from the official lobby, not the removed auth branch: " + state);
        }
        await waitFor('[data-lobby-official]');
        await click('[data-lobby-section-tab="guide"]');
        const guide = await waitFor('[data-lobby-agent-tutorial]');
        const cliGuide = await waitFor('[data-lobby-cli-setup-guide]');
        cliGuide.scrollIntoView({ behavior: "auto", block: "start" });
        await delay(180);
        await waitFor('[data-lobby-agent-settings-link]');
        await waitFor('[data-lobby-cli-command-tips]');
        await waitFor('[data-lobby-cli-shortcut-warning]');
        await waitFor('[data-lobby-cli-guide-step="template"]');
        await waitFor('[data-lobby-cli-guide-step="settings"]');
        await waitFor('[data-lobby-cli-guide-step="save"]');
        await waitFor('[data-lobby-cli-guide-step="use"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="command"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="help"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="success"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="laptop"]');
        await assertGuideImageLoaded('[data-lobby-guide-asset="shortcut-warning"]');
        const shell = await waitFor('[data-route-shell]');
        const route = await waitFor('[data-lobby-route]');
        const overflow = {
          innerWidth: window.innerWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          shellClientWidth: shell.clientWidth,
          shellScrollWidth: shell.scrollWidth,
          routeClientWidth: route.clientWidth,
          routeScrollWidth: route.scrollWidth,
          guideClientWidth: guide.clientWidth,
          guideScrollWidth: guide.scrollWidth
        };
        if (
          overflow.documentScrollWidth - overflow.innerWidth > 2 ||
          overflow.shellScrollWidth - overflow.shellClientWidth > 2 ||
          overflow.routeScrollWidth - overflow.routeClientWidth > 2 ||
          overflow.guideScrollWidth - overflow.guideClientWidth > 2
        ) {
          throw new Error("Lobby CLI guide surface overflowed: " + JSON.stringify(overflow));
        }
        return {
          scenario: "lobby-guide-cli-section",
          scrollTop: guide.scrollTop,
          overflow
        };
      })()
    `, true);
  }
}

const lobbySmokeScenarios = Object.freeze({
  "lobby-plugin-tabs": runLobbyPluginTabsScenario,
  "lobby-signed-in-startup": runLobbySignedInStartupScenario,
  "lobby-guide-visual": runLobbyGuideVisualScenario,
  "lobby-guide-cli-section": runLobbyGuideCliSectionScenario,
});

module.exports = {
  lobbySmokeScenarios
};

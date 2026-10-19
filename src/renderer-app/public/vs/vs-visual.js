(function () {
  const root = document.documentElement;
  root.classList.add("vs-visual-v1");
  root.classList.add("vs-sidebar-collapsed");
  root.dataset.vsVisual = "soft-technical-workbench";
  const scriptSrc = String(document.currentScript?.getAttribute("src") || document.currentScript?.src || "").replace(/\\/g, "/");
  const liveAppMode = /(^|\/)vs\/vs-visual\.js(?:[?#]|$)/.test(scriptSrc);
  if (liveAppMode) {
    root.classList.add("vs-live-app-mode");
    root.dataset.vsLiveAppMode = "true";
  } else {
    document.title = "Meowdesk VS";
  }

  const hintCopy = new Map([
    ["lobby", ["大厅", ""]],
    ["workspace", ["工作区", ""]],
    ["studio", ["工坊", ""]],
    ["access", ["设置", ""]],
    ["make", ["制作台", ""]],
    ["manage", ["作品管理", ""]],
    ["plugins", ["插件广场", ""]],
    ["tasks", ["任务中心", ""]],
    ["workflow", ["Workflow Beta", ""]],
    ["conversations", ["对话管理", ""]],
    ["obsidian", ["Obsidian", ""]],
    ["profile", ["个人主页", ""]]
  ]);

  const actionCopy = [
    ["data-studio-import-meow", ["安装 .meow", ""]],
    ["data-studio-new-draft", ["新建作品", ""]],
    ["data-studio-inspector-toggle", ["辅助面板", ""]],
    ["data-studio-inspector-close", ["收起辅助面板", ""]],
    ["data-r2-workspace-sidebar-manager-button", ["右侧栏组件", ""]],
    ["data-r2-workspace-sidebar-toggle", ["折叠右侧栏", ""]],
    ["data-r15-workflow-top-library-toggle", ["Workflow 电池组", ""]],
    ["data-r15-workflow-top-inspector-toggle", ["Workflow 右侧栏", ""]],
    ["data-r15-task-new", ["新建任务", ""]],
    ["data-r3-conversations-top-refresh", ["刷新对话", ""]],
    ["data-r3-conversations-top-open-dir", ["目录", ""]],
    ["data-r3-obsidian-top-pick", ["选择 vault", ""]],
    ["data-r3-obsidian-top-refresh", ["刷新", ""]],
    ["data-r3-obsidian-top-open", ["打开", ""]]
  ];

  let tooltip;
  let activeTarget = null;
  const workspacePaneRects = new Map();
  let inactiveKeepaliveCleanupSignature = "";
  let hoveredTopSurfaceKey = "";
  let dangerTopSurfaceKey = "";
  let dangerTopSurfaceArmedAt = 0;
  let dangerTopSurfaceClickKey = "";
  let dangerTopSurfaceClickableUntil = 0;
  let dangerTopSurfaceReturningKey = "";
  let dangerTopSurfaceReturnStartedAt = 0;
  let dangerTopSurfaceReturnClearTimer = 0;
  let topSurfaceCloseRequestKey = "";
  let topSurfaceCloseRequestAt = 0;
  let activeMeowBoxPointerDrag = null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const meowBoxCoreRoutes = new Set(["lobby", "workspace", "studio"]);
  const virtualBoxAvailableItems = [
    { key: "tasks", label: "任务中心", icon: "▣" },
    { key: "workflow", label: "Workflow Beta", icon: "⌁" },
    { key: "conversations", label: "对话管理", icon: "□" },
    { key: "obsidian", label: "Obsidian", icon: "▤" }
  ];
  const meowBoxDragMime = "application/x-meowdesk-vs-box-item";
  const interactiveCardSelectors = [
    ".vs-object-card",
    "[data-lobby-guide-path-card]",
    "[data-lobby-cli-guide-step]",
    "[data-lobby-plugin-market-card]",
    "[data-lobby-product-intro-section]",
    "[data-r15-task-card]",
    "[data-r15-task-calendar-day]",
    "[data-r15-task-week-day]",
    "[data-r15-task-matrix-bucket]",
    "[data-r15-task-habit-item]",
    "[data-r15-task-tag]",
    "[data-r15-task-day-schedule] article",
    "[data-r15-workflow-palette-card]",
    "[data-workflow-readiness-item]",
    "[data-r2-workspace-task-card]",
    "[data-r2-workspace-config-tool]",
    "[data-r2-workspace-sidebar-widget]",
    "[data-r2-workspace-sidebar-builtin]",
    "[data-r2-workspace-sidebar-manager-widget]",
    "[data-r2-conversation-item]",
    "[data-r3-conversation-message]",
    "[data-r3-obsidian-file]",
    "[data-r1-plugin-select]",
    "[data-plugin-readiness-item]",
    "[data-r2-access-theme-option]",
    "[data-r2-agent-preset]",
    "[data-r2-access-tool]",
    "[data-r2-access-advanced-tool]",
    "[data-r2-pet-item]",
    "[data-studio-agent-choice]",
    "[data-studio-agent-selected-project]",
    "[data-studio-project-item]",
    "[data-studio-real-project-item]",
    "[data-studio-project-action-bar]",
    "[data-studio-project-publish-status-card]",
    "[data-studio-project-publish-draft]",
    "[data-studio-project-version-item]",
    "[data-studio-project-readiness]",
    "[data-studio-project-preview]",
    "[data-studio-runtime-boundary-item]",
    "[data-studio-sidebar-runtime-item]",
    "[data-studio-workflow-beta-item]"
  ];
  const iconTextMenuSelectors = [
    "[data-studio-top-page-tabs]",
    "[data-studio-top-actions]",
    "[data-lobby-top-sections]",
    "[data-r2-workspace-toolbar]",
    "[data-r15-task-top-actions]",
    "[data-r3-conversations-top-actions]",
    "[data-r3-obsidian-top-actions]"
  ];
  const topPageSwitchGroups = [
    { selector: "[data-studio-page-tab]", active: '[data-studio-page-tab-active="true"]', attr: "data-studio-page-tab" },
    { selector: "[data-lobby-section-tab]", active: '[data-lobby-section-tab][aria-pressed="true"]', attr: "data-lobby-section-tab" },
    { selector: "[data-r15-task-tab]", active: '[data-r15-task-tab-active="true"]', attr: "data-r15-task-tab" }
  ];
  const topPageSwitchSelectors = topPageSwitchGroups.map((group) => group.selector);
  const topActionIconSelectors = [
    "[data-studio-import-meow]",
    "[data-studio-new-draft]",
    "[data-studio-inspector-toggle]",
    "[data-studio-inspector-close]",
    "[data-r15-task-new]",
    "[data-r2-workspace-sidebar-manager-button]",
    "[data-r2-workspace-sidebar-toggle]",
    "[data-r15-workflow-top-library-toggle]",
    "[data-r15-workflow-top-inspector-toggle]",
    "[data-r3-conversations-top-refresh]",
    "[data-r3-conversations-top-open-dir]",
    "[data-r3-obsidian-top-pick]",
    "[data-r3-obsidian-top-refresh]",
    "[data-r3-obsidian-top-open]"
  ];
  const forcedActionHintSelectors = [
    "[data-r3-conversations-top-refresh]",
    "[data-r3-obsidian-top-refresh]"
  ];
  const routeMotionCleanupSelectors = [
    "[data-studio-agent-panel]",
    "[data-studio-agent-stage]",
    "[data-studio-agent-standby]",
    "[data-studio-inspector]",
    "[data-studio-inspector-panel]",
    ".meowdesk-workspace-shell",
    ".meowdesk-workspace-side-column",
    ".meowdesk-workspace-pane",
    ".meowdesk-workspace-widget",
  ];
  const sidePanelMotionFamily = {
    reflow: {
      gap: 16,
      duration: 0.32,
      ease: "power3.out"
    }
  };
  const resizeHandleSelectors = [
    "[data-r2-workspace-sidebar-resizer]",
    "[data-r2-workspace-board-resizer]",
    "[data-r2-workspace-pet-resizer]"
  ];
  const resizeHandleSelector = resizeHandleSelectors.join(",");
  const obviousHintSelectors = [
    "[data-r2-workspace-pane-drag]",
    "[data-r2-workspace-pane-hide]",
    "[data-r2-workspace-pane-maximize]",
    "[data-r2-workspace-pane-close]",
    "[data-r2-workspace-sidebar-toggle]",
    ...resizeHandleSelectors,
    "[data-r3-conversations-top-refresh]",
    "[data-r3-conversations-top-open-dir]",
    "[data-r3-obsidian-top-refresh]",
    "[data-r3-obsidian-top-open]"
  ];
  const obviousHintTitlePattern = /^(刷新|关闭|目录|打开|返回入口|返回登录页|返回主页|隐藏工作窗|放大工作窗|还原工作窗|展开右侧栏|折叠右侧栏|拖动调整|上一页|下一页)$/;
  let internalSwitchSignature = "";
  let internalSwitchState = null;
  let internalSwitchTimer = 0;
  let routeAnimationSignature = "";
  let workspacePaneFlipRaf = 0;
  let workspacePaneReflowToken = 0;
  let workflowSideReflowToken = 0;
  let meowBoxMenuOpen = false;
  let activeVirtualBox = null;
  let virtualBoxIdSeed = 0;
  let visualRefreshPending = false;
  let visualRefreshAfterRaf = false;
  let domObserver = null;
  let topTitleMotionState = { text: "", railLeft: null, titleWidth: 0, titleRight: null, route: "" };
  let pendingTitleTagMotion = null;
  let titleTagMagnetRetryTimer = 0;
  const cardBreathTimers = new WeakMap();
  const cardBreathTimelines = new WeakMap();
  const resizeInertiaState = new WeakMap();
  const vsVisualVersion = "v0.25.41";
  const technicalCopyExactPattern = /^(ready|draft|review|deferred|read-only|local|empty|pending|ok|wait|loadable|missing-entry|not mounted|contract-only|preview only|live runtime|protected runtime|entry pending|html|real|disabled|enabled|published|success|warning|danger)$/i;
  const technicalCopyPattern = /(protected runtime|runtime boundary|host contract|contract-only|contract|iframe runtime|iframe boundary|manifest\.entry|manifest|missing-entry|not mounted|deferred|read-only|loadable|entry pending|entry file|protocol|meodesk|sidebar-widget|feature-page|workspace-sidebar|preferred \d+px|vs 视觉验证|已索引|可加载|未生成|待写入口|入口文件|等待可加载入口|运行时|发布前检查|本机发布演练|本机发布测试|隔离安装测试|本机项目\s*[·:]|上次读取|等待本机工坊摘要|工作流草稿|已配置 agent|本机作品|conversation mirror|preview only|live runtime|reattachable)/i;

  function textOf(el) {
    if (!el) return "";
    return (el.getAttribute?.("aria-label") || el.getAttribute?.("title") || el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readTransformX(el) {
    if (!el) return 0;
    if (window.gsap) {
      const gsapX = Number(window.gsap.getProperty(el, "x"));
      if (Number.isFinite(gsapX)) return gsapX;
    }
    const transform = window.getComputedStyle(el).transform;
    if (!transform || transform === "none") return 0;
    const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
    if (matrix3d) {
      const values = matrix3d[1].split(",").map((part) => Number.parseFloat(part.trim()));
      return Number.isFinite(values[12]) ? values[12] : 0;
    }
    const matrix = transform.match(/^matrix\((.+)\)$/);
    if (matrix) {
      const values = matrix[1].split(",").map((part) => Number.parseFloat(part.trim()));
      return Number.isFinite(values[4]) ? values[4] : 0;
    }
    return 0;
  }

  function readRailLayoutLeft(rail) {
    const rect = rail?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0) return null;
    return rect.left - readTransformX(rail);
  }

  function readTitleVisualWidth(titleNode) {
    if (!titleNode) return 0;
    const base = titleNode.querySelector?.(".vs-title-base") || titleNode;
    const rectWidth = base.getBoundingClientRect?.().width || 0;
    const range = document.createRange?.();
    let rangeWidth = 0;
    if (range) {
      range.selectNodeContents(base);
      rangeWidth = range.getBoundingClientRect?.().width || 0;
      range.detach?.();
    }
    const scrollWidth = base.scrollWidth || 0;
    const textEstimate = (base.textContent || titleNode.dataset?.text || "").trim().length * 18;
    if (!base.classList?.contains?.("vs-title-base") && titleNode.querySelector?.("[data-vs-top-surface-rail]")) {
      return Math.max(rangeWidth, scrollWidth, textEstimate);
    }
    return Math.max(rectWidth, scrollWidth, rangeWidth, textEstimate);
  }

  function readTitleVisualRight(titleNode) {
    if (!titleNode) return null;
    const base = titleNode.querySelector?.(".vs-title-base") || titleNode;
    const rect = base.getBoundingClientRect?.();
    if (!rect || rect.width <= 0) return null;
    return rect.left - readTransformX(base) + readTitleVisualWidth(titleNode);
  }

  function visibleTextOf(el) {
    return (el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isSidebarChevronText(text) {
    return text === "«" || text === "»" || text === "‹" || text === "›";
  }

  function removeLegacyTitleSidebarToggles() {
    const titleCluster = document.querySelector("[data-top-nav-title-cluster]");
    if (!titleCluster) return;
    [...titleCluster.querySelectorAll("button, a, [role='button']")].forEach((control) => {
      const label = textOf(control);
      if (!isSidebarChevronText(label)) return;
      control.remove();
    });
  }

  function matchesAny(el, selectors) {
    return selectors.some((selector) => el.matches?.(selector));
  }

  function removeVisibleTextNodes(el) {
    const filter = {
      acceptNode(node) {
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest("svg, style, script, .vs-text-icon-title")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    };
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, filter);
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }
    nodes.forEach((textNode) => textNode.remove());
  }

  function removeEmptyDecorChildren(button, icon) {
    [...button.children].forEach((child) => {
      if (child.contains(icon)) return;
      if (child.matches(".vs-text-icon-title")) return;
      if (visibleTextOf(child) || child.querySelector("svg, img")) return;
      child.remove();
    });
  }

  function getTopPageSwitchGroup(button) {
    if (!button?.matches) return null;
    return topPageSwitchGroups.find((group) => button.matches(group.selector)) || null;
  }

  function getTopPageSwitchKey(button) {
    const group = getTopPageSwitchGroup(button);
    return group ? button.getAttribute(group.attr) || "" : "";
  }

  function isVisibleTextButton(el) {
    if (el.dataset.vsTopActionIcon === "true") return false;
    if (el.closest(".meowdesk-sidebar") && !el.closest("[data-meow-box-menu]") && root.classList.contains("vs-sidebar-collapsed")) return false;
    return el.matches("button, [role='button'], [role='menuitem']") && visibleTextOf(el).length >= 2;
  }

  function requiresActionHint(el) {
    return Boolean(el && matchesAny(el, forcedActionHintSelectors));
  }

  function isObviousHintControl(el) {
    if (!el || !el.matches("button, [role='button'], a")) return false;
    if (requiresActionHint(el)) return false;
    if (obviousHintSelectors.some((selector) => el.matches(selector))) return true;
    if (getTopPageSwitchGroup(el)) return false;
    if (el.closest("[data-top-nav]") && !isVisibleTextButton(el) && !el.closest(iconTextMenuSelectors.join(","))) return true;
    const label = textOf(el);
    if (!label || !obviousHintTitlePattern.test(label)) return false;
    return Boolean(
      el.closest("[data-top-nav], .meowdesk-workspace-pane-controls, .meowdesk-workspace-pane-head, .meowdesk-workspace-side-column") ||
        el.matches("[title], [aria-label]")
    );
  }

  function shouldSkipHint(el) {
    if (el.matches(`${resizeHandleSelector}, [data-studio-inspector-close]`)) return true;
    if (el.matches("[data-meow-box-trigger], [data-vs-sidebar-box='virtual']")) return true;
    if (el.matches("[aria-expanded]")) return true;
    if (el.dataset.vsForceHint === "true") return false;
    if (el.matches(".vs-card-action-trigger, .vs-meow-box-mini-action, .vs-workspace-task-open-icon, .vs-open-surface-close, .vs-open-surface-toggle")) return true;
    if (
      root.classList.contains("vs-sidebar-collapsed") &&
      el.closest("[data-next-sidebar-product-shell], .meowdesk-sidebar") &&
      !el.closest("[data-meow-box-menu]") &&
      el.matches("[data-next-route], [data-meow-box-trigger], [data-next-sidebar-settings], [data-r15-theme-sidebar-toggle], [data-meow-tab]")
    ) {
      return false;
    }
    if (el.closest("[data-next-sidebar-product-shell], .meowdesk-sidebar") && !el.closest("[data-meow-box-menu]")) return true;
    return Boolean(
      el.closest("[data-r2-workspace-slot-picker]") ||
        el.matches("[data-r2-workspace-slot-button]") ||
        el.matches("[data-r2-workspace-configure-pane], [data-studio-agent-add]") ||
        el.closest(".meowdesk-workspace-start-panel, .meowdesk-studio-agent-standby, [data-studio-agent-standby]") ||
        isObviousHintControl(el)
    );
  }

  function suppressNativeTitle(el) {
    if (!el) return;
    const title = el.getAttribute("title");
    if (title && !el.getAttribute("aria-label")) el.setAttribute("aria-label", title);
    el.removeAttribute("title");
  }

  function clearHint(el) {
    if (!el) return;
    suppressNativeTitle(el);
    delete el.dataset.vsHintTitle;
    delete el.dataset.vsHintBody;
  }

  function suppressNativeTitlesForPlainControls() {
    document.querySelectorAll([
      "[data-r2-workspace-slot-button]",
      ...resizeHandleSelectors,
      "[data-studio-inspector-close]",
      "[data-r15-task-source-icon]"
    ].join(",")).forEach(suppressNativeTitle);
  }

  function setHint(el, title, body) {
    if (!el) return;
    if (shouldSkipHint(el)) {
      clearHint(el);
      return;
    }
    if (el.dataset.vsHintTitle) {
      suppressNativeTitle(el);
      return;
    }
    if (isVisibleTextButton(el) && !el.dataset.vsForceHint) {
      clearHint(el);
      return;
    }
    suppressNativeTitle(el);
    el.dataset.vsHintTitle = title;
    el.dataset.vsHintBody = body;
  }

  function hydrateHints() {
    document.querySelectorAll("[data-next-route], [data-next-sidebar-settings]").forEach((el) => {
      const route = el.getAttribute("data-next-route");
      const copy = hintCopy.get(route);
      if (copy) setHint(el, copy[0], copy[1]);
    });

    document.querySelectorAll("[data-meow-box-launch]").forEach((el) => {
      const route = el.getAttribute("data-next-route") || el.getAttribute("data-meow-box-launch") || "";
      const copy = hintCopy.get(route);
      setHint(el, copy ? copy[0] : textOf(el) || "Meow Box", copy ? copy[1] : "");
    });

    document.querySelectorAll("[data-meow-box-trigger]").forEach((el) => {
      delete el.dataset.vsForceHint;
      el.setAttribute("aria-expanded", document.querySelector("[data-meow-box-menu]") ? "true" : "false");
      clearHint(el);
    });

    document.querySelectorAll("[data-meow-tab]").forEach((el) => {
      setHint(el, textOf(el) || "已开启页面", "");
    });

    document.querySelectorAll("[data-r15-theme-sidebar-toggle]").forEach((el) => {
      setHint(el, textOf(el) || "主题", "");
    });

    document.querySelectorAll(topPageSwitchSelectors.join(",")).forEach((el) => {
      const key = getTopPageSwitchKey(el);
      const copy = hintCopy.get(key);
      if (el.closest("[data-top-nav]")) el.dataset.vsForceHint = "true";
      setHint(el, copy ? copy[0] : textOf(el), copy ? copy[1] : "");
    });

    actionCopy.forEach(([attr, copy]) => {
      document.querySelectorAll(`[${attr}]`).forEach((el) => {
        if (!requiresActionHint(el) && isObviousHintControl(el)) {
          delete el.dataset.vsForceHint;
          clearHint(el);
          return;
        }
        el.dataset.vsForceHint = "true";
        setHint(el, copy[0], copy[1]);
      });
    });

    document.querySelectorAll("button[title], button[aria-label], [role='button'][title], [role='button'][aria-label]").forEach((el) => {
      if (shouldSkipHint(el)) {
        clearHint(el);
        return;
      }
      if (el.dataset.vsHintTitle || el.closest(".meowdesk-sidebar")) return;
      if (isVisibleTextButton(el)) return;
      const label = textOf(el);
      if (label) setHint(el, label, "");
    });

    suppressNativeTitlesForPlainControls();
  }

  function syncMeowBoxCount() {
    const box = document.querySelector("[data-meow-box]");
    if (!box) return;
    [...box.querySelectorAll("*")].forEach((el) => {
      if (el.closest("[data-meow-box-launch]")) return;
      if (el.children.length === 0 && /^\d+$/.test(visibleTextOf(el))) {
        el.remove();
      }
    });
  }

  function getMeowBoxLaunchRow(launch) {
    const menu = launch?.closest?.("[data-meow-box-menu]");
    const row = launch?.parentElement;
    if (!menu || !row || row === menu || !menu.contains(row)) return launch;
    if (row.querySelector("[data-meow-box-launch]") === launch && row.children.length <= 4) return row;
    return launch;
  }

  function pruneMeowBoxCoreLaunches() {
    const launches = [...document.querySelectorAll("[data-meow-box-launch]")];
    launches.forEach((el) => {
      const route = el.getAttribute("data-next-route") || el.getAttribute("data-meow-box-launch") || "";
      if (meowBoxCoreRoutes.has(route)) {
        const row = getMeowBoxLaunchRow(el);
        row?.remove();
      }
    });
    const visibleLaunches = [...document.querySelectorAll("[data-meow-box-launch]")]
      .filter((el) => !meowBoxCoreRoutes.has(el.getAttribute("data-next-route") || el.getAttribute("data-meow-box-launch") || ""));
    syncMeowBoxCount(visibleLaunches.length);
  }

  function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.className = "vs-meow-hint";
    tooltip.innerHTML = [
      '<div class="vs-meow-hint__kicker">Meow Hint</div>',
      '<div class="vs-meow-hint__title"></div>',
      '<div class="vs-meow-hint__body"></div>'
    ].join("");
    document.body.appendChild(tooltip);
    tooltip.dataset.vsVisible = "false";
    return tooltip;
  }

  function placeTooltip(target) {
    const tip = ensureTooltip();
    const rect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const width = tipRect.width || 258;
    const height = tipRect.height || 70;
    const sidebar = Boolean(target.closest("[data-next-sidebar-product-shell], .meowdesk-sidebar"));
    const topNav = Boolean(target.closest("[data-top-nav]"));
    let placement = sidebar ? "right" : topNav || rect.top < 96 ? "bottom" : "top";
    let x = sidebar ? rect.right + 12 : Math.round(rect.left + rect.width / 2 - width / 2);
    let y = sidebar ? Math.round(rect.top + rect.height / 2 - height / 2) : rect.bottom + 10;

    if (placement === "top") y = rect.top - height - 10;
    if (placement === "bottom" && y + height > window.innerHeight - 14) {
      placement = "top";
      y = rect.top - height - 10;
    }
    if (placement === "top" && y < 12) {
      placement = "bottom";
      y = rect.bottom + 10;
    }

    if (x + width > window.innerWidth - 14) x = window.innerWidth - width - 14;
    if (y + height > window.innerHeight - 14) y = window.innerHeight - height - 14;
    if (x < 12) x = 12;
    if (y < 12) y = 12;

    const notchLeft = Math.max(18, Math.min(width - 52, rect.left + rect.width / 2 - x - 17));
    const notchTop = Math.max(16, Math.min(height - 34, rect.top + rect.height / 2 - y - 15));
    tip.dataset.vsPlacement = placement;
    tip.style.setProperty("--vs-hint-notch-left", `${Math.round(notchLeft)}px`);
    tip.style.setProperty("--vs-hint-notch-top", `${Math.round(notchTop)}px`);
    tip.style.left = `${Math.round(x)}px`;
    tip.style.top = `${Math.round(y)}px`;
    return placement;
  }

  function getSidebarHost(sidebar) {
    return sidebar?.closest("aside") || sidebar?.parentElement || null;
  }

  function getSidebarCoreZoneHost(shell = document.querySelector("[data-next-sidebar-product-shell]")) {
    const host = getSidebarHost(shell) || shell?.closest?.(".meowdesk-sidebar, [data-vs-sidebar-host='true'], aside") || null;
    if (!host) return null;
    const coreRoutes = [...host.querySelectorAll("[data-next-route]")].filter((entry) => {
      if (entry.closest("[data-meow-box-menu], .vs-virtual-box-menu, [data-top-nav], [data-next-sidebar-product-shell]")) return false;
      return ["lobby", "workspace", "studio"].includes(entry.getAttribute("data-next-route") || "");
    });
    return coreRoutes[0]?.parentElement || host;
  }

  function getSidebarCoreRoutes(shell = document.querySelector("[data-next-sidebar-product-shell]")) {
    const coreHost = getSidebarCoreZoneHost(shell);
    if (!coreHost) return [];
    return [...coreHost.querySelectorAll("[data-next-route]")].filter((entry) => {
      if (entry.closest("[data-meow-box-menu], .vs-virtual-box-menu, [data-top-nav], [data-next-sidebar-product-shell]")) return false;
      return ["lobby", "workspace", "studio"].includes(entry.getAttribute("data-next-route") || "");
    });
  }

  function syncSidebarHost(expanded) {
    const sidebar = document.querySelector("[data-next-sidebar-product-shell]");
    const host = getSidebarHost(sidebar);
    if (!sidebar || !host) return;
    host.classList.add("vs-sidebar-host");
    host.dataset.vsSidebarHost = "true";
    host.dataset.vsSidebarExpanded = expanded ? "true" : "false";
    sidebar.dataset.vsSidebarExpanded = expanded ? "true" : "false";
  }

  function getNativeSidebarToggle() {
    if (liveAppMode) return null;
    const buttons = [...document.querySelectorAll("[data-top-nav] button, [data-product-shell] button")];
    return buttons.find((button) => {
      const label = textOf(button);
      return isSidebarChevronText(label);
    }) || null;
  }

  function syncSidebarClass() {
    root.classList.remove("vs-sidebar-expanded");
    root.classList.add("vs-sidebar-collapsed");
    syncSidebarHost(false);
  }

  function applyNativeSidebarState() {
    const toggle = getNativeSidebarToggle();
    if (!toggle) {
      syncSidebarClass();
      return;
    }

    toggle.classList.add("vs-shell-collapse-toggle");
    toggle.setAttribute("aria-hidden", "true");
    toggle.tabIndex = -1;

    const label = textOf(toggle);
    const nativeCollapsed = label === "»" || label === "›";
    syncSidebarClass();
    if (!nativeCollapsed) {
      toggle.click();
    }
  }

  function bindSidebarShell() {
    const sidebar = document.querySelector("[data-next-sidebar-product-shell]");
    const host = getSidebarHost(sidebar) || sidebar;
    if (!sidebar || !host || host.dataset.vsSidebarShellBound) return;
    host.dataset.vsSidebarShellBound = "true";
    syncSidebarHost(false);
    applyNativeSidebarState();
  }

  function makeSidebarDivider(kind) {
    const line = document.createElement("div");
    line.className = `vs-sidebar-divider vs-sidebar-divider--${kind}`;
    line.dataset.vsSidebarDivider = kind;
    line.setAttribute("aria-hidden", "true");
    return line;
  }

  function getOrCreateSidebarCoreDivider(coreHost, shell, host) {
    if (!coreHost) return null;
    const dividers = [...document.querySelectorAll("[data-vs-sidebar-divider='core']")];
    let divider = dividers.find((item) => item.parentElement === coreHost) ||
      dividers.find((item) => item.parentElement === host) ||
      dividers.find((item) => item.parentElement === shell) ||
      dividers[0] ||
      null;
    if (!divider) divider = makeSidebarDivider("core");
    dividers.forEach((item) => {
      if (item !== divider) item.remove();
    });
    return divider;
  }

  function placeSidebarCoreDivider(coreHost, divider, coreRoutes = null) {
    if (!coreHost || !divider) return;
    const pinnedEntries = [...coreHost.querySelectorAll(":scope > [data-vs-sidebar-pinned-box-entry]")];
    const routes = coreRoutes || getSidebarCoreRoutes();
    const anchor = pinnedEntries[pinnedEntries.length - 1] ||
      [...routes].reverse().find((route) => route.parentElement === coreHost) ||
      null;
    if (anchor) {
      if (divider.parentElement !== coreHost || divider.previousElementSibling !== anchor) anchor.after(divider);
    } else if (divider.parentElement !== coreHost) {
      coreHost.appendChild(divider);
    }
  }

  function createVirtualBoxButton(name) {
    const box = document.createElement("button");
    box.type = "button";
    box.className = "vs-sidebar-virtual-box vs-entry-glow-button";
    box.dataset.vsSidebarBox = "virtual";
    box.dataset.vsVirtualBoxItems = "";
    box.setAttribute("aria-label", name);
    box.setAttribute("aria-expanded", "false");
    box.textContent = "□";
    clearHint(box);
    ensureVirtualBoxId(box);
    bindVirtualBoxButton(box);
    return box;
  }

  function bindVirtualBoxButton(box) {
    if (liveAppMode) return;
    if (!box || box.dataset.vsVirtualBoxBound === "true") return;
    box.dataset.vsVirtualBoxBound = "true";
    ensureVirtualBoxId(box);
    bindVirtualBoxDropTarget(box, box);
    box.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleVirtualBoxMenu(box);
    });
  }

  function makeAddBoxButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vs-sidebar-add-box vs-entry-glow-button";
    button.dataset.vsSidebarAddBox = "true";
    button.dataset.vsForceHint = "true";
    button.title = "新建 Box";
    button.setAttribute("aria-label", "新建 Box");
    button.textContent = "+";
    setHint(button, "新建 Box", "");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const count = document.querySelectorAll("[data-vs-sidebar-box='virtual']").length + 2;
      const box = createVirtualBoxButton(`Meow Box ${count}`);
      button.before(box);
      bindHintEvents();
      if (!reduceMotion && window.gsap) {
        window.gsap.fromTo(box, { autoAlpha: 0, y: -6, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.24, ease: "power3.out" });
      }
      renderVirtualBoxMenu(box);
    });
    return button;
  }

  function closeSurfaceTab(tab) {
    const route = getSurfaceTabRoute(tab) || tab?.dataset?.vsSourceSurfaceRoute || "";
    if (tab?.closest?.("[data-product-shell-top-surface-rail]")) {
      window.dispatchEvent(new CustomEvent("meowdesk:top-surface-close-confirmed", {
        detail: {
          routeId: route,
          surfaceId: tab.dataset.vsSourceSurfaceKey || tab.dataset.vsTopSurfaceTag || "",
          label: tab.dataset.vsSourceSurfaceLabel || getSurfaceTabLabel(tab)
        }
      }));
      return;
    }
    tab.dataset.vsSurfaceClosed = "true";
    const hideClosedTab = () => {
      if (!tab.isConnected) return;
      tab.style.display = "none";
      tab.style.opacity = "0";
      tab.style.visibility = "hidden";
      tab.style.transform = "none";
    };
    if (!reduceMotion && window.gsap) {
      window.gsap.to(tab, {
        autoAlpha: 0,
        scale: 0.82,
        duration: 0.18,
        ease: "power2.out",
        onComplete: hideClosedTab
      });
    } else {
      hideClosedTab();
    }
  }

  function reopenSurfaceTab(tab) {
    if (!tab) return false;
    delete tab.dataset.vsSurfaceClosed;
    tab.style.removeProperty("display");
    tab.style.removeProperty("opacity");
    tab.style.removeProperty("visibility");
    tab.style.removeProperty("transform");
    tab.style.removeProperty("scale");
    if (window.gsap) {
      window.gsap.killTweensOf(tab);
      window.gsap.set(tab, { clearProps: "display,opacity,visibility,transform,scale" });
    }
    return true;
  }

  function reopenClosedSurfaceTabsForRoute(route) {
    if (!route) return false;
    const closedTabs = [...document.querySelectorAll("[data-meow-tab][data-vs-surface-closed]")];
    let reopened = false;
    closedTabs.forEach((tab, index) => {
      const tabRoute = getSurfaceTabRoute(tab);
      const key = getSurfaceTabKey(tab, index);
      if (tabRoute !== route && key !== route && key !== `surface:route:${route}`) return;
      reopened = reopenSurfaceTab(tab) || reopened;
    });
    return reopened;
  }

  function bindClosedSurfaceReopenTriggers() {
    if (root.dataset.vsClosedSurfaceReopenBound === "true") return;
    root.dataset.vsClosedSurfaceReopenBound = "true";
    const reopenFromEvent = (event) => {
      const trigger = event.target?.closest?.("[data-next-route], [data-meow-box-launch]");
      if (!trigger) return;
      const route = trigger.getAttribute("data-next-route") || trigger.getAttribute("data-meow-box-launch") || "";
      if (!route) return;
      if (reopenClosedSurfaceTabsForRoute(route)) {
        window.setTimeout(refresh, 0);
      }
    };
    document.addEventListener("click", reopenFromEvent, true);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      reopenFromEvent(event);
    }, true);
  }

  function bindNativeTopSurfaceCloseRequests() {
    if (root.dataset.vsNativeTopSurfaceCloseBound === "true") return;
    root.dataset.vsNativeTopSurfaceCloseBound = "true";
    const requestFromEvent = (event) => {
      const source = event.target?.closest?.("[data-product-shell-top-surface-close], [data-vs-top-surface-close]");
      const tag = source?.closest?.("[data-product-shell-top-surface-rail] [data-vs-top-surface-tag]");
      if (!tag) return;
      requestTopSurfaceClose(tag, source, event);
    };
    document.addEventListener("pointerdown", requestFromEvent, true);
    document.addEventListener("mousedown", requestFromEvent, true);
    document.addEventListener("click", requestFromEvent, true);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      requestFromEvent(event);
    }, true);
  }

  function dismissSurfaceCloseDialog() {
    const dialog = document.querySelector("[data-vs-surface-close-dialog]");
    if (!dialog) return;
    if (dialog.dataset.vsSurfaceCloseDismissing === "true") {
      dialog.remove();
      return;
    }
    dialog.dataset.vsSurfaceCloseDismissing = "true";
    if (dialog._vsCloseKeydown) {
      document.removeEventListener("keydown", dialog._vsCloseKeydown, true);
      delete dialog._vsCloseKeydown;
    }
    window.setTimeout(() => dialog.remove(), 180);
    if (!reduceMotion && window.gsap) {
      window.gsap.to(dialog, {
        autoAlpha: 0,
        duration: 0.1,
        ease: "power2.out",
        onComplete: () => dialog.remove()
      });
    } else {
      dialog.remove();
    }
  }

  function showSurfaceCloseDialog(tab, originEl = null) {
    if (!tab || !tab.isConnected || tab.dataset.vsSurfaceClosed === "true") return;
    dismissSurfaceCloseDialog();
    const surfaceLabel = tab.dataset.vsSourceSurfaceLabel || getSurfaceTabLabel(tab) || "当前页面";
    const runtimeCount = Number(tab.dataset.productShellTopSurfaceRuntimeCount || tab.getAttribute("data-product-shell-top-surface-runtime-count") || 0);
    const hasRunningRuntime = tab.dataset.productShellTopSurfaceRunningRuntime === "true"
      || tab.getAttribute("data-product-shell-top-surface-running-runtime") === "true"
      || runtimeCount > 0;

    const dialog = document.createElement("div");
    dialog.className = "vs-surface-close-dialog";
    dialog.dataset.vsSurfaceCloseDialog = "true";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "vs-surface-close-title");
    dialog.tabIndex = -1;

    const panel = document.createElement("section");
    panel.className = "vs-surface-close-panel";
    panel.tabIndex = -1;

    const warning = document.createElement("span");
    warning.className = "vs-surface-close-warning";
    warning.setAttribute("aria-hidden", "true");

    const title = document.createElement("h2");
    title.id = "vs-surface-close-title";
    title.textContent = hasRunningRuntime ? "关闭并停止 Agent？" : "关闭标签？";

    const message = document.createElement("p");
    message.textContent = hasRunningRuntime
      ? `会关闭「${surfaceLabel}」标签，并停止这个页面关联的 Agent 进程。尚未保存的输出可能会丢失。`
      : `会从顶部移除「${surfaceLabel}」标签；如果这个页面有关联 Agent，确认关闭也会停止对应进程。`;

    const actions = document.createElement("div");
    actions.className = "vs-surface-close-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "vs-surface-close-cancel";
    cancel.textContent = "取消";
    cancel.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismissSurfaceCloseDialog();
    });

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "vs-surface-close-confirm";
    confirm.textContent = hasRunningRuntime ? "确认关闭并停止" : "确认关闭";
    confirm.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismissSurfaceCloseDialog();
      closeSurfaceTab(tab);
      refresh();
    });

    actions.append(cancel, confirm);
    const content = document.createElement("div");
    content.className = "vs-surface-close-content";
    content.append(title, message, actions);
    panel.append(warning, content);
    dialog.appendChild(panel);
    document.body.appendChild(dialog);

    const setExpanded = (expanded) => {
      if (!expanded) return;
      if (panel.dataset.vsSurfaceCloseEntering === "true") {
        if (window.gsap) {
          window.gsap.killTweensOf(panel);
          window.gsap.set(panel, { clearProps: "transform,opacity,visibility" });
        }
        delete panel.dataset.vsSurfaceCloseEntering;
      }
      panel.dataset.vsSurfaceCloseExpanded = "true";
    };
    panel.addEventListener("pointerover", () => setExpanded(true));
    panel.addEventListener("mouseover", () => setExpanded(true));
    panel.addEventListener("focusin", () => setExpanded(true));
    panel.addEventListener("pointerleave", () => setExpanded(false));
    panel.addEventListener("mouseleave", () => setExpanded(false));
    panel.addEventListener("focusout", () => setExpanded(false));

    const handleKeydown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismissSurfaceCloseDialog();
    };
    dialog._vsCloseKeydown = handleKeydown;
    document.addEventListener("keydown", handleKeydown, true);

    if (!reduceMotion && window.gsap) {
      panel.dataset.vsSurfaceCloseEntering = "true";
      window.gsap.fromTo(dialog, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: "power2.out" });
      window.gsap.fromTo(panel, {
        autoAlpha: 0,
        y: 22,
        scale: 0.985
      }, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.3,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility",
        onComplete: () => {
          delete panel.dataset.vsSurfaceCloseEntering;
        }
      });
    }
    window.setTimeout(() => dialog.focus({ preventScroll: true }), 0);
  }

  function confirmCloseSurfaceTab(tab, originEl = null) {
    showSurfaceCloseDialog(tab, originEl);
  }

  function decorateOpenSurfaceTab(tab) {
    if (!tab || tab.dataset.vsOpenSurfaceBox === "true") return;
    tab.dataset.vsOpenSurfaceBox = "true";
    tab.classList.add("vs-open-surface-box");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "vs-open-surface-close";
    close.dataset.vsOpenSurfaceClose = "true";
    close.setAttribute("aria-label", "关闭当前进程");
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      confirmCloseSurfaceTab(tab, close);
    });
    tab.appendChild(close);
  }

  function getSurfaceTabText(tab) {
    if (!tab) return "";
    const parts = [];
    const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest("svg, style, script, .vs-open-surface-close, .vs-open-surface-toggle")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node = walker.nextNode();
    while (node) {
      parts.push(node.textContent);
      node = walker.nextNode();
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function getSurfaceTabLabel(tab) {
    const label = getSurfaceTabText(tab) || tab.getAttribute("aria-label") || tab.getAttribute("title") || "";
    return label.replace(/[×✕✖]\s*$/u, "").trim() || tab.getAttribute("data-meow-tab") || "功能页";
  }

  function getSurfaceTabKey(tab, index = 0) {
    return tab.getAttribute("data-meow-tab") ||
      tab.getAttribute("data-next-route") ||
      tab.getAttribute("aria-label") ||
      `surface-${index}`;
  }

  function getSurfaceTabRoute(tab) {
    const direct = tab?.getAttribute("data-next-route");
    if (direct) return direct;
    const key = tab?.getAttribute("data-meow-tab") || "";
    const routeMatch = key.match(/(?:^|:)route:([^:]+)/);
    return routeMatch ? routeMatch[1] : "";
  }

  function cloneSurfaceTabIcon(tab) {
    const ownIcon = tab?.querySelector?.("svg, img");
    if (ownIcon) return ownIcon.cloneNode(true);
    const route = getSurfaceTabRoute(tab);
    const routeButton = route ? [...document.querySelectorAll("[data-next-route]")]
      .find((button) => button.getAttribute("data-next-route") === route) : null;
    const routeIcon = routeButton?.querySelector("svg, img");
    if (routeIcon) return routeIcon.cloneNode(true);
    const label = getSurfaceTabLabel(tab);
    const labelButton = [...document.querySelectorAll("[data-next-route]")]
      .find((button) => textOf(button) === label);
    return labelButton?.querySelector("svg, img")?.cloneNode(true) || null;
  }

  function clearTopSurfaceHover() {
    const hadHover = Boolean(hoveredTopSurfaceKey);
    hoveredTopSurfaceKey = "";
    if (hadHover) {
      document.querySelectorAll("[data-vs-top-surface-hover]").forEach((tag) => {
        delete tag.dataset.vsTopSurfaceHover;
        setTopSurfaceCloseVisible(tag, false);
      });
    }
    clearTopSurfaceDanger();
  }

  function clearTopSurfaceDanger() {
    const key = dangerTopSurfaceKey || dangerTopSurfaceClickKey;
    if (!key) return;
    dangerTopSurfaceKey = "";
    dangerTopSurfaceArmedAt = 0;
    dangerTopSurfaceClickKey = "";
    dangerTopSurfaceClickableUntil = 0;
    beginTopSurfaceDangerReturn(key);
    document.querySelectorAll("[data-vs-danger-armed]").forEach((tag) => {
      disarmTopSurfaceDanger(tag);
    });
  }

  function bindTopSurfaceHoverGuard() {
    if (root.dataset.vsTopSurfaceHoverGuardBound === "true") return;
    root.dataset.vsTopSurfaceHoverGuardBound = "true";
    const syncFromPointer = (event) => {
      const tag = event.target?.closest?.("[data-vs-top-surface-tag]");
      if (tag) return;
      clearTopSurfaceHover();
    };
    document.addEventListener("pointermove", syncFromPointer, true);
    document.addEventListener("mousemove", syncFromPointer, true);
    document.addEventListener("mouseout", (event) => {
      if (!event.relatedTarget) clearTopSurfaceHover();
    }, true);
    window.addEventListener("blur", clearTopSurfaceHover);
  }

  function getTopSurfaceDangerProgress() {
    if (!dangerTopSurfaceArmedAt) return 0;
    return clampNumber((performance.now() - dangerTopSurfaceArmedAt) / 1050, 0, 1);
  }

  function easeDangerProgress(progress) {
    const value = clampNumber(progress, 0, 1);
    return value < 0.5
      ? 2 * value * value
      : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }

  function applyTopSurfaceDangerVars(tag, progress = getTopSurfaceDangerProgress()) {
    if (!tag) return;
    const eased = easeDangerProgress(progress);
    const fill = 0.34 + (1 - 0.34) * eased;
    const scale = 0.28 + (2.28 - 0.28) * eased;
    const border = clampNumber((progress - 0.24) / 0.6, 0, 1) * 0.9;
    const shadow = clampNumber((progress - 0.2) / 0.62, 0, 1);
    tag.style.setProperty("--vs-danger-fill", fill.toFixed(3));
    tag.style.setProperty("--vs-danger-scale", scale.toFixed(3));
    tag.style.setProperty("--vs-danger-border-alpha", border.toFixed(3));
    tag.style.setProperty("--vs-danger-shadow-alpha", shadow.toFixed(3));
  }

  function applyTopSurfaceDangerReturnVars(tag) {
    if (!tag || !dangerTopSurfaceReturnStartedAt) return false;
    const elapsed = performance.now() - dangerTopSurfaceReturnStartedAt;
    const progress = clampNumber(elapsed / 720, 0, 1);
    if (progress >= 1) return false;
    const collapseProgress = clampNumber(progress / 0.78, 0, 1);
    const fadeProgress = clampNumber((progress - 0.78) / 0.22, 0, 1);
    const collapseEase = easeDangerProgress(collapseProgress);
    const fadeEase = easeDangerProgress(fadeProgress);
    const fill = progress < 0.78
      ? 1 - (1 - 0.34) * collapseEase
      : 0.34 * (1 - fadeEase);
    const scale = progress < 0.78
      ? 2.28 - (2.28 - 0.28) * collapseEase
      : 0.28 - (0.28 - 0.16) * fadeEase;
    const signal = Math.max(0, 1 - collapseEase);
    tag.style.setProperty("--vs-danger-fill", fill.toFixed(3));
    tag.style.setProperty("--vs-danger-scale", scale.toFixed(3));
    tag.style.setProperty("--vs-danger-border-alpha", (0.9 * signal).toFixed(3));
    tag.style.setProperty("--vs-danger-shadow-alpha", signal.toFixed(3));
    return true;
  }

  function markTopSurfaceDangerClickable(key) {
    if (!key) return;
    dangerTopSurfaceClickKey = key;
    dangerTopSurfaceClickableUntil = performance.now() + 3600;
  }

  function clearTopSurfaceDangerClickable(key = "") {
    if (key && dangerTopSurfaceClickKey !== key) return;
    dangerTopSurfaceClickKey = "";
    dangerTopSurfaceClickableUntil = 0;
  }

  function softenTopSurfaceDangerClickable(key = "", duration = 900) {
    if (!key || dangerTopSurfaceClickKey !== key) return;
    const until = performance.now() + duration;
    dangerTopSurfaceClickableUntil = dangerTopSurfaceClickableUntil
      ? Math.min(dangerTopSurfaceClickableUntil, until)
      : until;
  }

  function beginTopSurfaceDangerReturn(key) {
    if (!key) return;
    dangerTopSurfaceReturningKey = key;
    dangerTopSurfaceReturnStartedAt = performance.now();
    window.clearTimeout(dangerTopSurfaceReturnClearTimer);
    dangerTopSurfaceReturnClearTimer = window.setTimeout(() => {
      if (dangerTopSurfaceReturningKey === key) {
        dangerTopSurfaceReturningKey = "";
        dangerTopSurfaceReturnStartedAt = 0;
      }
      document.querySelectorAll("[data-vs-top-surface-tag]").forEach((candidate) => {
        if (candidate.dataset.vsTopSurfaceTag !== key) return;
        delete candidate.dataset.vsDangerReturning;
        candidate.style.removeProperty("--vs-danger-fill");
        candidate.style.removeProperty("--vs-danger-scale");
        candidate.style.removeProperty("--vs-danger-border-alpha");
        candidate.style.removeProperty("--vs-danger-shadow-alpha");
      });
    }, 760);
  }

  function setTopSurfaceCloseVisible(tag, visible) {
    const close = tag?.querySelector?.(".vs-top-surface-close");
    if (!close) return;
    if (visible) {
      close.style.setProperty("transition", "none", "important");
      close.style.setProperty("opacity", "1", "important");
      close.style.setProperty("visibility", "visible", "important");
      close.style.setProperty("pointer-events", "auto", "important");
      close.style.setProperty("transform", "scale(1)", "important");
      return;
    }
    close.style.removeProperty("transition");
    close.style.removeProperty("opacity");
    close.style.removeProperty("visibility");
    close.style.removeProperty("pointer-events");
    close.style.removeProperty("transform");
  }

  function isTopSurfaceDangerClickable(tag) {
    if (!tag) return false;
    const key = tag.dataset.vsTopSurfaceTag || "";
    if (!key) return false;
    if (tag.dataset.vsDangerArmed === "true" || dangerTopSurfaceKey === key) return true;
    return dangerTopSurfaceClickKey === key && performance.now() <= dangerTopSurfaceClickableUntil;
  }

  function armTopSurfaceDanger(tag) {
    if (!tag) return;
    const key = tag.dataset.vsTopSurfaceTag || "";
    const now = performance.now();
    if (key) {
      if (dangerTopSurfaceKey !== key || !dangerTopSurfaceArmedAt) {
        dangerTopSurfaceArmedAt = now;
      }
      dangerTopSurfaceKey = key;
      dangerTopSurfaceReturningKey = "";
      dangerTopSurfaceReturnStartedAt = 0;
      markTopSurfaceDangerClickable(key);
    }
    const alreadyArmed = tag.dataset.vsDangerArmed === "true";
    if (alreadyArmed && tag._vsDangerAnimating === true) return;
    tag.dataset.vsDangerArmed = "true";
    setTopSurfaceCloseVisible(tag, true);
    if (reduceMotion || !window.gsap) {
      tag.style.setProperty("--vs-danger-fill", "1");
      tag.style.setProperty("--vs-danger-scale", "2.15");
      tag.style.setProperty("--vs-danger-border-alpha", "0.9");
      tag.style.setProperty("--vs-danger-shadow-alpha", "1");
      return;
    }
    tag._vsDangerAnimating = true;
    const progress = getTopSurfaceDangerProgress();
    window.gsap.killTweensOf(tag, "--vs-danger-fill,--vs-danger-scale,--vs-danger-border-alpha,--vs-danger-shadow-alpha");
    applyTopSurfaceDangerVars(tag, progress);
    const tl = window.gsap.timeline({
      defaults: { overwrite: "auto" },
      onComplete: () => {
        tag._vsDangerAnimating = false;
      }
    });
    tl.to(tag, {
      "--vs-danger-fill": 1,
      "--vs-danger-scale": 2.28,
      duration: Math.max(0.18, 1.05 * (1 - progress)),
      ease: "power2.inOut"
    }, 0)
      .to(tag, {
        "--vs-danger-border-alpha": 0.9,
        "--vs-danger-shadow-alpha": 1,
        duration: Math.max(0.16, 0.58 * (1 - progress)),
        ease: "power2.out"
      }, progress >= 0.32 ? 0 : 0.32);
  }

  function disarmTopSurfaceDanger(tag) {
    if (!tag) return;
    const key = tag.dataset.vsTopSurfaceTag || "";
    if (key && dangerTopSurfaceKey === key) {
      dangerTopSurfaceKey = "";
      dangerTopSurfaceArmedAt = 0;
    }
    if (key) beginTopSurfaceDangerReturn(key);
    delete tag.dataset.vsDangerArmed;
    if (hoveredTopSurfaceKey !== key) setTopSurfaceCloseVisible(tag, false);
    if (reduceMotion || !window.gsap) {
      tag.style.removeProperty("--vs-danger-fill");
      tag.style.removeProperty("--vs-danger-scale");
      tag.style.removeProperty("--vs-danger-border-alpha");
      tag.style.removeProperty("--vs-danger-shadow-alpha");
      return;
    }
    tag._vsDangerAnimating = false;
    window.gsap.killTweensOf(tag, "--vs-danger-fill,--vs-danger-scale,--vs-danger-border-alpha,--vs-danger-shadow-alpha");
    const tl = window.gsap.timeline({
      defaults: { overwrite: "auto" },
      onComplete: () => {
        tag.style.removeProperty("--vs-danger-fill");
        tag.style.removeProperty("--vs-danger-scale");
        tag.style.removeProperty("--vs-danger-border-alpha");
        tag.style.removeProperty("--vs-danger-shadow-alpha");
      }
    });
    tl.to(tag, {
      "--vs-danger-fill": 0.34,
      "--vs-danger-scale": 0.28,
      "--vs-danger-border-alpha": 0,
      "--vs-danger-shadow-alpha": 0,
      duration: 0.56,
      ease: "power2.inOut"
    }, 0)
      .to(tag, {
        "--vs-danger-fill": 0,
        "--vs-danger-scale": 0.16,
        duration: 0.16,
        ease: "power1.out"
      }, ">");
  }

  function findSourceSurfaceTabForTopTag(tag) {
    if (!tag) return null;
    if (tag._vsSourceTab?.isConnected) return tag._vsSourceTab;
    const key = tag.dataset.vsTopSurfaceTag || tag.dataset.vsSourceSurfaceKey || "";
    const route = tag.dataset.vsSourceSurfaceRoute || "";
    const label = tag.dataset.vsSourceSurfaceLabel ||
      tag.querySelector(".vs-top-surface-main")?.getAttribute("aria-label") ||
      "";
    const sourceTabs = [...document.querySelectorAll("[data-meow-tab]")]
      .filter((sourceTab) => !sourceTab.dataset.vsSurfaceClosed && sourceTab.closest("[data-next-sidebar-product-shell], .meowdesk-sidebar"));
    return sourceTabs.find((sourceTab, index) => sourceTab.dataset.vsTopSurfaceSourceKey === key || getSurfaceTabKey(sourceTab, index) === key) ||
      (route ? sourceTabs.find((sourceTab) => getSurfaceTabRoute(sourceTab) === route) : null) ||
      (label ? sourceTabs.find((sourceTab) => getSurfaceTabLabel(sourceTab) === label) : null) ||
      null;
  }

  function getTopSurfaceEventTag(event) {
    const target = event?.target;
    if (!target?.closest) return null;
    const direct = target.closest("[data-vs-top-surface-tag]");
    if (direct) return direct;
    const surfaceControl = target.closest(".vs-top-surface-main, .vs-top-surface-close");
    return surfaceControl?.closest?.("[data-vs-top-surface-tag]") || null;
  }

  function eventHitsTopSurfaceClose(event, tag) {
    if (!event || !tag) return false;
    if (event.target?.closest?.(".vs-top-surface-close")) return true;
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false;
    const close = tag.querySelector(".vs-top-surface-close");
    if (!close) return false;
    const rect = close.getBoundingClientRect();
    return event.clientX >= rect.left - 4 &&
      event.clientX <= rect.right + 4 &&
      event.clientY >= rect.top - 4 &&
      event.clientY <= rect.bottom + 4;
  }

  function requestTopSurfaceClose(tag, originEl = null, event = null) {
    if (!tag) return false;
    const key = tag.dataset.vsTopSurfaceTag || tag.dataset.vsSourceSurfaceKey || "";
    const nativeTopSurface = tag.closest("[data-product-shell-top-surface-rail]");
    const now = performance.now();
    const existingDialog = document.querySelector("[data-vs-surface-close-dialog]");
    if (existingDialog && key && topSurfaceCloseRequestKey === key && now - topSurfaceCloseRequestAt < 650) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      return true;
    }
    const sourceTab = nativeTopSurface ? tag : findSourceSurfaceTabForTopTag(tag);
    if (!sourceTab) {
      window.__meowdeskVsErrors = window.__meowdeskVsErrors || [];
      window.__meowdeskVsErrors.push({
        type: "top-surface-close-source-missing",
        key,
        label: tag.dataset.vsSourceSurfaceLabel || "",
        route: tag.dataset.vsSourceSurfaceRoute || ""
      });
      return false;
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    topSurfaceCloseRequestKey = key;
    topSurfaceCloseRequestAt = now;
    confirmCloseSurfaceTab(sourceTab, originEl || tag.querySelector(".vs-top-surface-close, .vs-top-surface-main") || tag);
    const dialog = document.querySelector("[data-vs-surface-close-dialog]");
    if (dialog && key) dialog.dataset.vsSurfaceCloseKey = key;
    return true;
  }

  function bindTopSurfaceDangerArmDelegation() {
    if (root.dataset.vsTopSurfaceDangerBound === "true") return;
    root.dataset.vsTopSurfaceDangerBound = "true";
    const getCloseTag = (event) => {
      const close = event.target?.closest?.(".vs-top-surface-close");
      return close?.closest?.("[data-vs-top-surface-tag]") || null;
    };
    const armFromEvent = (event) => {
      const tag = getCloseTag(event);
      if (!tag) return;
      hoveredTopSurfaceKey = tag.dataset.vsTopSurfaceTag || hoveredTopSurfaceKey;
      tag.dataset.vsTopSurfaceHover = "true";
      armTopSurfaceDanger(tag);
    };
    const disarmFromEvent = (event) => {
      const tag = getCloseTag(event);
      if (!tag) return;
      if (event.relatedTarget && tag.contains(event.relatedTarget)) return;
      disarmTopSurfaceDanger(tag);
    };
    const requestCloseFromEvent = (event) => {
      const tag = getTopSurfaceEventTag(event);
      if (!tag) return;
      const close = event.target?.closest?.(".vs-top-surface-close");
      const closeHit = close || eventHitsTopSurfaceClose(event, tag);
      const main = event.target?.closest?.("[data-vs-top-surface-tag] .vs-top-surface-main");
      if (!closeHit && (!main || !isTopSurfaceDangerClickable(tag))) return;
      requestTopSurfaceClose(tag, close || main || tag.querySelector(".vs-top-surface-close") || tag, event);
    };
    document.addEventListener("pointerdown", requestCloseFromEvent, true);
    document.addEventListener("mousedown", requestCloseFromEvent, true);
    document.addEventListener("click", requestCloseFromEvent, true);
    document.addEventListener("pointerenter", armFromEvent, true);
    document.addEventListener("pointerover", armFromEvent, true);
    document.addEventListener("mouseenter", armFromEvent, true);
    document.addEventListener("mouseover", armFromEvent, true);
    document.addEventListener("focusin", armFromEvent, true);
    document.addEventListener("pointerleave", disarmFromEvent, true);
    document.addEventListener("pointerout", disarmFromEvent, true);
    document.addEventListener("mouseleave", disarmFromEvent, true);
    document.addEventListener("mouseout", disarmFromEvent, true);
    document.addEventListener("focusout", disarmFromEvent, true);
  }

  function bindNativeTopSurfaceTagHover(tag) {
    if (!tag || tag.dataset.vsNativeTopSurfaceHoverBound === "true") return;
    tag.dataset.vsNativeTopSurfaceHoverBound = "true";
    const keyForTag = () => tag.dataset.vsTopSurfaceTag || tag.dataset.vsSourceSurfaceKey || "";
    const setHover = (event = null) => {
      const key = keyForTag();
      if (key) hoveredTopSurfaceKey = key;
      tag.dataset.vsTopSurfaceHover = "true";
      setTopSurfaceCloseVisible(tag, true);
      if (event?.target?.closest?.(".vs-top-surface-close, [data-product-shell-top-surface-close]")) {
        armTopSurfaceDanger(tag);
      }
    };
    const clearHover = (event = null) => {
      if (event?.relatedTarget && tag.contains(event.relatedTarget)) return;
      const key = keyForTag();
      if (key && hoveredTopSurfaceKey === key) hoveredTopSurfaceKey = "";
      delete tag.dataset.vsTopSurfaceHover;
      setTopSurfaceCloseVisible(tag, false);
      disarmTopSurfaceDanger(tag);
      softenTopSurfaceDangerClickable(key);
    };
    tag.addEventListener("pointerenter", setHover);
    tag.addEventListener("mouseenter", setHover);
    tag.addEventListener("mouseover", setHover);
    tag.addEventListener("focusin", setHover);
    tag.addEventListener("pointerleave", clearHover);
    tag.addEventListener("mouseleave", clearHover);
    tag.addEventListener("mouseout", clearHover);
    tag.addEventListener("focusout", clearHover);
  }

  function bindNativeTopSurfaceHoverDelegation() {
    if (root.dataset.vsNativeTopSurfaceHoverDelegationBound === "true") return;
    root.dataset.vsNativeTopSurfaceHoverDelegationBound = "true";
    const getNativeTag = (event) => event.target?.closest?.("[data-product-shell-top-surface-rail] [data-vs-top-surface-tag]");
    const setHover = (event) => {
      const tag = getNativeTag(event);
      if (!tag) return;
      const key = tag.dataset.vsTopSurfaceTag || tag.dataset.vsSourceSurfaceKey || "";
      if (key) hoveredTopSurfaceKey = key;
      tag.dataset.vsTopSurfaceHover = "true";
      setTopSurfaceCloseVisible(tag, true);
      if (event.target?.closest?.(".vs-top-surface-close, [data-product-shell-top-surface-close]")) {
        armTopSurfaceDanger(tag);
      }
    };
    const clearHover = (event) => {
      const tag = getNativeTag(event);
      if (!tag) return;
      if (event.relatedTarget && tag.contains(event.relatedTarget)) return;
      const key = tag.dataset.vsTopSurfaceTag || tag.dataset.vsSourceSurfaceKey || "";
      if (key && hoveredTopSurfaceKey === key) hoveredTopSurfaceKey = "";
      delete tag.dataset.vsTopSurfaceHover;
      setTopSurfaceCloseVisible(tag, false);
      disarmTopSurfaceDanger(tag);
      softenTopSurfaceDangerClickable(key);
    };
    document.addEventListener("pointerover", setHover, true);
    document.addEventListener("mouseover", setHover, true);
    document.addEventListener("focusin", setHover, true);
    document.addEventListener("pointerout", clearHover, true);
    document.addEventListener("mouseout", clearHover, true);
    document.addEventListener("focusout", clearHover, true);
  }

  function renderTopSurfaceTabs() {
    const nav = document.querySelector("[data-top-nav]");
    const title = getVisibleTopTitleContainer(nav);
    if (!nav || !title) return;
    const nativeRail = nav.querySelector("[data-product-shell-top-surface-rail]");
    if (nativeRail) {
      nativeRail.querySelectorAll("[data-vs-top-surface-tag]").forEach((tag) => {
        bindNativeTopSurfaceTagHover(tag);
        const key = tag.dataset.vsTopSurfaceTag || tag.dataset.vsSourceSurfaceKey || "";
        if (hoveredTopSurfaceKey === key) {
          tag.dataset.vsTopSurfaceHover = "true";
          setTopSurfaceCloseVisible(tag, true);
        } else {
          delete tag.dataset.vsTopSurfaceHover;
          if (dangerTopSurfaceKey !== key) setTopSurfaceCloseVisible(tag, false);
        }
        if (dangerTopSurfaceKey === key) {
          tag.dataset.vsDangerArmed = "true";
          setTopSurfaceCloseVisible(tag, true);
          applyTopSurfaceDangerVars(tag);
        } else if (dangerTopSurfaceReturningKey === key && applyTopSurfaceDangerReturnVars(tag)) {
          tag.dataset.vsDangerReturning = "true";
        } else {
          delete tag.dataset.vsDangerArmed;
          delete tag.dataset.vsDangerReturning;
        }
      });
      return;
    }
    const sourceTabs = [...document.querySelectorAll("[data-meow-tab]")]
      .filter((tab) => !tab.dataset.vsSurfaceClosed && tab.closest("[data-next-sidebar-product-shell], .meowdesk-sidebar"));
    let rail = nav.querySelector("[data-vs-top-surface-rail]");
    if (!sourceTabs.length) {
      hoveredTopSurfaceKey = "";
      rail?.remove();
      return;
    }
    if (!rail) {
      rail = document.createElement("div");
      rail.className = "vs-top-surface-rail";
      rail.dataset.vsTopSurfaceRail = "true";
    }
    const railHost = liveAppMode ? (nav.querySelector("[data-top-nav-running-surfaces]") || title) : title;
    if (rail.parentElement !== railHost) railHost.appendChild(rail);
    rail.replaceChildren();
    sourceTabs.forEach((tab, index) => {
      const key = getSurfaceTabKey(tab, index);
      const labelText = getSurfaceTabLabel(tab);
      const route = getSurfaceTabRoute(tab);
      tab.dataset.vsTopSurfaceSourceKey = key;
      const tag = document.createElement("div");
      tag.className = "vs-top-surface-tag";
      tag.dataset.vsTopSurfaceTag = key;
      tag.dataset.vsSourceSurfaceKey = key;
      tag.dataset.vsSourceSurfaceLabel = labelText;
      if (route) tag.dataset.vsSourceSurfaceRoute = route;
      tag._vsSourceTab = tab;
      const isActive = tab.getAttribute("data-meow-tab-active") === "true" || tab.getAttribute("aria-current") === "page";
      if (isActive) {
        tag.dataset.vsTopSurfaceActive = "true";
      }
      if (hoveredTopSurfaceKey === key) {
        tag.dataset.vsTopSurfaceHover = "true";
      }
      if (dangerTopSurfaceKey === key) {
        tag.dataset.vsDangerArmed = "true";
        applyTopSurfaceDangerVars(tag);
      } else if (dangerTopSurfaceReturningKey === key && applyTopSurfaceDangerReturnVars(tag)) {
        tag.dataset.vsDangerReturning = "true";
      }
      const main = document.createElement("button");
      main.type = "button";
      main.className = "vs-top-surface-main vs-entry-glow-button";
      main.dataset.meowTabActive = "true";
      if (isActive) {
        main.setAttribute("aria-current", "page");
      }
      const icon = cloneSurfaceTabIcon(tab);
      if (icon) {
        icon.setAttribute("aria-hidden", "true");
        main.appendChild(icon);
      } else {
        const label = document.createElement("span");
        label.className = "vs-top-surface-label";
        label.textContent = labelText;
        main.appendChild(label);
      }
      main.dataset.vsTopSurfaceMain = "true";
      main.dataset.vsSourceSurfaceKey = key;
      main.setAttribute("aria-label", labelText);
      main.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isTopSurfaceDangerClickable(tag)) {
          requestTopSurfaceClose(tag, main, event);
          return;
        }
        tab.click();
      });
      main.addEventListener("keydown", (event) => {
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        event.preventDefault();
        event.stopPropagation();
        confirmCloseSurfaceTab(tab, main);
      });

      const close = document.createElement("button");
      close.type = "button";
      close.className = "vs-top-surface-close";
      close.dataset.vsTopSurfaceClose = "true";
      close.dataset.vsSourceSurfaceKey = key;
      close.setAttribute("aria-label", `关闭 ${labelText}`);
      close.textContent = "×";
      close.addEventListener("click", (event) => {
        requestTopSurfaceClose(tag, close, event);
      });
      const armClose = () => armTopSurfaceDanger(tag);
      const disarmClose = (event) => {
        if (event?.relatedTarget && tag.contains(event.relatedTarget)) return;
        disarmTopSurfaceDanger(tag);
      };
      close.addEventListener("pointerenter", armClose);
      close.addEventListener("mouseenter", armClose);
      close.addEventListener("mouseover", armClose);
      close.addEventListener("focus", armClose);
      close.addEventListener("pointerleave", disarmClose);
      close.addEventListener("mouseleave", disarmClose);
      close.addEventListener("blur", disarmClose);
      const showClose = (event) => {
        hoveredTopSurfaceKey = key;
        tag.dataset.vsTopSurfaceHover = "true";
        const closeRect = close.getBoundingClientRect();
        const isClosePoint = event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY) &&
          event.clientX >= closeRect.left - 2 &&
          event.clientX <= closeRect.right + 2 &&
          event.clientY >= closeRect.top - 2 &&
          event.clientY <= closeRect.bottom + 2;
        if (event?.target?.closest?.(".vs-top-surface-close") || isClosePoint) {
          armTopSurfaceDanger(tag);
        }
      };
      const hideClose = (event) => {
        if (event.relatedTarget && tag.contains(event.relatedTarget)) return;
        if (hoveredTopSurfaceKey === key) hoveredTopSurfaceKey = "";
        delete tag.dataset.vsTopSurfaceHover;
        disarmTopSurfaceDanger(tag);
        softenTopSurfaceDangerClickable(key);
      };
      tag.addEventListener("mouseenter", showClose);
      tag.addEventListener("mouseover", showClose);
      tag.addEventListener("mouseleave", hideClose);
      tag.addEventListener("focusin", showClose);
      tag.addEventListener("focusout", hideClose);
      tag.append(main, close);
      rail.appendChild(tag);
      if (dangerTopSurfaceKey === key) {
        window.requestAnimationFrame(() => {
          if (tag.isConnected && dangerTopSurfaceKey === key) armTopSurfaceDanger(tag);
        });
      }
    });
  }

  function syncSidebarVisualZones() {
    const shell = document.querySelector("[data-next-sidebar-product-shell]");
    const box = document.querySelector("[data-meow-box]");
    if (!shell || !box) return;
    const host = getSidebarHost(shell) || shell;
    shell.classList.add("vs-sidebar-zoned");
    if (!liveAppMode) {
      bindSidebarPinDropTarget(shell);
      bindSidebarPinDropTarget(host);
    }

    const coreHost = getSidebarCoreZoneHost(shell) || host;
    const coreRoutes = getSidebarCoreRoutes(shell);
    const coreDivider = getOrCreateSidebarCoreDivider(coreHost, shell, host);
    let addBox = shell.querySelector("[data-vs-sidebar-add-box]");
    if (!liveAppMode && !addBox) addBox = makeAddBoxButton();
    const boxes = [...shell.querySelectorAll("[data-meow-box], [data-vs-sidebar-box='virtual']")];
    if (liveAppMode) {
      shell.querySelectorAll("[data-vs-sidebar-box='virtual'], [data-vs-sidebar-add-box]").forEach((el) => el.remove());
    } else {
      shell.querySelectorAll("[data-vs-sidebar-box='virtual']").forEach(bindVirtualBoxButton);
      bindDefaultBoxDropTarget(box);
    }
    const firstBox = boxes[0] || box;
    if (coreDivider && coreRoutes.some((route) => route.parentElement === coreHost)) {
      placeSidebarCoreDivider(coreHost, coreDivider, coreRoutes);
    } else if (coreDivider && (coreDivider.parentElement !== shell || coreDivider.nextElementSibling !== firstBox)) {
      firstBox.before(coreDivider);
    }
    const lastBox = boxes[boxes.length - 1] || box;
    if (!liveAppMode && addBox && (!shell.contains(addBox) || addBox.previousElementSibling !== lastBox)) lastBox.after(addBox);

    shell.querySelectorAll('[data-vs-sidebar-divider="box"]').forEach((divider) => divider.remove());

    const tabs = [...document.querySelectorAll("[data-meow-tab]")]
      .filter((tab) => !tab.dataset.vsSurfaceClosed && shell.contains(tab));
    tabs.forEach((tab, index) => {
      decorateOpenSurfaceTab(tab);
      tab.classList.toggle("vs-open-surface-overflow", tabs.length > 2 && index > 1);
    });
    const tabHost = tabs[0]?.parentElement;
    if (tabHost) {
      tabHost.classList.add("vs-open-surface-zone");
      tabHost.dataset.vsOpenSurfaceZone = "true";
      tabHost.dataset.vsOpenSurfaceCount = String(tabs.length);
      let toggle = tabHost.querySelector("[data-vs-open-surface-toggle]");
      if (tabs.length > 2) {
        if (!toggle) {
          toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "vs-open-surface-toggle";
          toggle.dataset.vsOpenSurfaceToggle = "true";
          toggle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            tabHost.dataset.vsOpenSurfaceExpanded = tabHost.dataset.vsOpenSurfaceExpanded === "true" ? "false" : "true";
            refresh();
          });
          tabHost.appendChild(toggle);
        }
        const expanded = tabHost.dataset.vsOpenSurfaceExpanded === "true";
        toggle.textContent = expanded ? "⌃" : `+${tabs.length - 2}`;
        toggle.setAttribute("aria-label", expanded ? "收起已开启页面" : "展开已开启页面");
      } else {
        toggle?.remove();
        delete tabHost.dataset.vsOpenSurfaceExpanded;
      }
    }
    renderTopSurfaceTabs();
    syncActiveVirtualBoxMenu();
  }

  function makeMeowBoxVisualEl(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function getVirtualBoxName(box) {
    return textOf(box) || box?.dataset?.vsVirtualBoxName || "Meow Box";
  }

  function getVirtualBoxes() {
    return [...document.querySelectorAll("[data-vs-sidebar-box='virtual']")];
  }

  function ensureVirtualBoxId(box) {
    if (!box) return "";
    if (!box.dataset.vsVirtualBoxId) {
      virtualBoxIdSeed += 1;
      box.dataset.vsVirtualBoxId = `box-${Date.now().toString(36)}-${virtualBoxIdSeed}`;
    }
    return box.dataset.vsVirtualBoxId;
  }

  function getVirtualBoxItems(box) {
    const allowed = new Set(virtualBoxAvailableItems.map((item) => item.key));
    return [...new Set(String(box?.dataset?.vsVirtualBoxItems || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => allowed.has(item)))];
  }

  function setVirtualBoxItems(box, items) {
    if (!box) return;
    const allowed = new Set(virtualBoxAvailableItems.map((item) => item.key));
    box.dataset.vsVirtualBoxItems = [...new Set(items.filter((item) => allowed.has(item)))].join(",");
  }

  function getVsPinnedBoxItems() {
    const allowed = new Set(virtualBoxAvailableItems.map((item) => item.key));
    return [...new Set(String(root.dataset.vsPinnedBoxItems || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => allowed.has(item)))];
  }

  function setVsPinnedBoxItems(items) {
    const allowed = new Set(virtualBoxAvailableItems.map((item) => item.key));
    const next = [...new Set(items.filter((item) => allowed.has(item)))];
    if (next.length) {
      root.dataset.vsPinnedBoxItems = next.join(",");
    } else {
      delete root.dataset.vsPinnedBoxItems;
    }
  }

  function addVsPinnedBoxItem(key) {
    if (!getVirtualBoxItem(key)) return false;
    setVsPinnedBoxItems([...getVsPinnedBoxItems().filter((item) => item !== key), key]);
    return true;
  }

  function removeVsPinnedBoxItem(key) {
    if (!getVirtualBoxItem(key)) return false;
    setVsPinnedBoxItems(getVsPinnedBoxItems().filter((item) => item !== key));
    return true;
  }

  function getSidebarHiddenBoxItems() {
    const allowed = new Set(virtualBoxAvailableItems.map((item) => item.key));
    return [...new Set(String(root.dataset.vsBoxSidebarHiddenKeys || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => allowed.has(item)))];
  }

  function setSidebarHiddenBoxItems(items) {
    const allowed = new Set(virtualBoxAvailableItems.map((item) => item.key));
    const next = [...new Set(items.filter((item) => allowed.has(item)))];
    if (next.length) {
      root.dataset.vsBoxSidebarHiddenKeys = next.join(",");
    } else {
      delete root.dataset.vsBoxSidebarHiddenKeys;
    }
    applySidebarHiddenBoxItems();
  }

  function isSidebarOwnedBoxItemHidden(key) {
    return getSidebarHiddenBoxItems().includes(key);
  }

  function hideSidebarOwnedBoxItem(key) {
    if (!getVirtualBoxItem(key)) return;
    setSidebarHiddenBoxItems([...getSidebarHiddenBoxItems(), key]);
  }

  function unhideSidebarOwnedBoxItem(key) {
    if (!getVirtualBoxItem(key)) return;
    setSidebarHiddenBoxItems(getSidebarHiddenBoxItems().filter((item) => item !== key));
  }

  function applySidebarHiddenBoxItems() {
    if (liveAppMode) {
      document.querySelectorAll("[data-vs-box-sidebar-hidden='true']").forEach((entry) => {
        delete entry.dataset.vsBoxSidebarHidden;
        entry.removeAttribute("aria-hidden");
        entry.removeAttribute("tabindex");
      });
      return;
    }
    const hidden = new Set(getSidebarHiddenBoxItems());
    const selector = "[data-next-sidebar-product-shell] [data-next-route], .meowdesk-sidebar [data-next-route], [data-vs-sidebar-host='true'] [data-next-route], aside [data-next-route]";
    document.querySelectorAll(selector).forEach((entry) => {
      const key = entry.getAttribute("data-next-route") || "";
      if (!getVirtualBoxItem(key) || entry.closest("[data-meow-box-menu], .vs-virtual-box-menu")) return;
      if (hidden.has(key) && entry.dataset.vsSidebarPinnedBoxEntry !== "true") {
        entry.dataset.vsBoxSidebarHidden = "true";
        entry.setAttribute("aria-hidden", "true");
        entry.tabIndex = -1;
      } else if (entry.dataset.vsBoxSidebarHidden === "true") {
        delete entry.dataset.vsBoxSidebarHidden;
        entry.removeAttribute("aria-hidden");
        entry.removeAttribute("tabindex");
      }
    });
  }

  function getVirtualBoxItem(key) {
    return virtualBoxAvailableItems.find((item) => item.key === key) || null;
  }

  function getRouteTitleText(route = getCurrentRoute(), fallbackEl = null) {
    const item = getVirtualBoxItem(route);
    return hintCopy.get(route)?.[0] || item?.label || visibleTextOf(fallbackEl) || route;
  }

  function getAssignedVirtualBox(key) {
    return getVirtualBoxes().find((box) => getVirtualBoxItems(box).includes(key)) || null;
  }

  function getUnassignedBoxItems() {
    return virtualBoxAvailableItems.filter((item) => !getAssignedVirtualBox(item.key) && !isMeowBoxItemPinnedToSidebar(item.key));
  }

  function removeVirtualBoxItemEverywhere(key, exceptBox = null) {
    getVirtualBoxes().forEach((box) => {
      if (box === exceptBox) return;
      const current = getVirtualBoxItems(box);
      if (!current.includes(key)) return;
      setVirtualBoxItems(box, current.filter((itemKey) => itemKey !== key));
    });
  }

  function removeRenderedSidebarPinnedBoxEntries(key) {
    if (!getVirtualBoxItem(key)) return;
    document.querySelectorAll(`[data-vs-sidebar-pinned-box-entry][data-next-route="${key}"]`).forEach((entry) => {
      entry.remove();
    });
  }

  function clearSidebarVisibleBoxItemState(key) {
    if (!getVirtualBoxItem(key)) return;
    document.querySelectorAll(`[data-next-route="${key}"]`).forEach((entry) => {
      if (entry.closest("[data-meow-box-menu], .vs-virtual-box-menu, [data-top-nav]")) return;
      const sidebarOwner = entry.closest("[data-next-sidebar-product-shell], .meowdesk-sidebar, [data-vs-sidebar-host='true'], aside");
      if (!sidebarOwner) return;
      if (entry.dataset.vsSidebarPinnedBoxEntry === "true") {
        entry.remove();
        return;
      }
      entry.dataset.vsBoxSidebarHidden = "true";
      entry.setAttribute("aria-hidden", "true");
      entry.tabIndex = -1;
    });
  }

  function releaseSidebarBoxOwnership(key) {
    if (!getVirtualBoxItem(key)) return false;
    removeVsPinnedBoxItem(key);
    hideSidebarOwnedBoxItem(key);
    clearSidebarVisibleBoxItemState(key);
    removeRenderedSidebarPinnedBoxEntries(key);
    applySidebarHiddenBoxItems();
    return true;
  }

  function moveVirtualBoxItemToBox(key, box) {
    if (!box || !getVirtualBoxItem(key)) return false;
    releaseSidebarBoxOwnership(key);
    removeVirtualBoxItemEverywhere(key, box);
    const next = [...getVirtualBoxItems(box).filter((itemKey) => itemKey !== key), key];
    setVirtualBoxItems(box, next);
    applySidebarHiddenBoxItems();
    removeRenderedSidebarPinnedBoxEntries(key);
    renderVsPinnedSidebarBoxItems();
    return true;
  }

  function moveVirtualBoxItemToDefault(key) {
    if (!getVirtualBoxItem(key)) return false;
    releaseSidebarBoxOwnership(key);
    removeVirtualBoxItemEverywhere(key);
    applySidebarHiddenBoxItems();
    removeRenderedSidebarPinnedBoxEntries(key);
    renderVsPinnedSidebarBoxItems();
    return true;
  }

  function readMeowBoxDragKey(event) {
    const dataTransfer = event?.dataTransfer;
    if (!dataTransfer) return "";
    return dataTransfer.getData(meowBoxDragMime) || dataTransfer.getData("text/plain") || "";
  }

  function getMeowBoxLaunchButton(key) {
    return [...document.querySelectorAll("[data-meow-box-launch]")]
      .find((launch) => launch.getAttribute("data-meow-box-launch") === key || launch.getAttribute("data-next-route") === key) || null;
  }

  function getMeowBoxPinButton(key) {
    return [...document.querySelectorAll("[data-meow-box-pin]")]
      .find((pin) => pin.getAttribute("data-meow-box-pin") === key) || null;
  }

  function hasMeowBoxSidebarRoute(key) {
    return [...document.querySelectorAll(`[data-next-sidebar-product-shell] [data-next-route="${key}"], .meowdesk-sidebar [data-next-route="${key}"], [data-vs-sidebar-host='true'] [data-next-route="${key}"], aside [data-next-route="${key}"]`)]
      .some((route) => {
        if (route.closest("[data-meow-box-menu], .vs-virtual-box-menu")) return false;
        if (route.dataset.vsSidebarPinnedBoxEntry === "true") return false;
        return isMotionVisible(route);
      });
  }

  function isMeowBoxItemPinnedToSidebar(key) {
    if (!getVirtualBoxItem(key)) return false;
    if (root.dataset.vsBoxSidebarHiddenKeys?.split(",").map((item) => item.trim()).includes(key)) return false;
    if (getVsPinnedBoxItems().includes(key)) return true;
    if (hasMeowBoxSidebarRoute(key)) return true;
    const pin = getMeowBoxPinButton(key);
    if (pin?.getAttribute("aria-checked") === "true" || pin?.dataset?.meowBoxPinActive === "true") return true;
    const launch = getMeowBoxLaunchButton(key);
    return launch?.dataset?.meowBoxLaunchPinned === "true";
  }

  function openDefaultMeowBoxMenuForPin() {
    if (document.querySelector("[data-meow-box-menu]")) return true;
    const trigger = document.querySelector("[data-meow-box-trigger]");
    if (!trigger) return false;
    clickMeowBoxControlBypassingPointerGuard(trigger);
    requestAnimationFrame(refresh);
    return true;
  }

  function openDefaultMeowBoxForDrag() {
    openDefaultMeowBoxMenuForPin();
    const menu = document.querySelector("[data-meow-box-menu]");
    if (!menu) return;
    delete menu.dataset.vsBoxDragCollapsed;
    menu.dataset.vsBoxDropPreview = "true";
    setMeowBoxDropActive(menu, true);
  }

  function setMeowBoxDropActive(el, active) {
    if (!el) return;
    el.dataset.vsBoxDropActive = active ? "true" : "false";
  }

  function clearMeowBoxDropStates() {
    document.querySelectorAll("[data-vs-box-drop-active='true']").forEach((target) => setMeowBoxDropActive(target, false));
    document.querySelectorAll("[data-vs-box-drop-preview='true']").forEach((target) => {
      delete target.dataset.vsBoxDropPreview;
    });
    document.querySelectorAll(".vs-sidebar-pin-drop-target[data-vs-box-drop-active='false']").forEach((target) => {
      delete target.dataset.vsBoxDropActive;
    });
  }

  function collapseOpenBoxMenusForDrag() {
    document.querySelectorAll("[data-meow-box-menu], .vs-virtual-box-menu").forEach((menu) => {
      menu.dataset.vsBoxDragCollapsed = "true";
    });
  }

  function restoreCollapsedBoxMenus() {
    document.querySelectorAll("[data-vs-box-drag-collapsed='true']").forEach((menu) => {
      delete menu.dataset.vsBoxDragCollapsed;
    });
  }

  function clickMeowBoxControlBypassingPointerGuard(el) {
    if (!el) return;
    root.dataset.vsBypassBoxClickGuard = "true";
    try {
      el.click();
    } finally {
      delete root.dataset.vsBypassBoxClickGuard;
    }
  }

  function closeDefaultMeowBoxMenu(preserveVirtualBox = false) {
    const menu = document.querySelector("[data-meow-box-menu]");
    if (!menu) return;
    const trigger = document.querySelector("[data-meow-box-trigger]");
    if (trigger?.getAttribute("aria-expanded") === "true") {
      if (preserveVirtualBox) root.dataset.vsSuppressVirtualBoxOutsideClose = "true";
      clickMeowBoxControlBypassingPointerGuard(trigger);
    } else {
      menu.remove();
      root.classList.remove("vs-meow-box-open");
    }
  }

  function refreshOpenBoxMenus(preferredBox = activeVirtualBox) {
    const defaultMenu = document.querySelector("[data-meow-box-menu]");
    if (defaultMenu) decorateMeowBoxMenu();
    if (preferredBox && document.body.contains(preferredBox) && document.querySelector(".vs-virtual-box-menu")) {
      renderVirtualBoxMenu(preferredBox);
    }
  }

  function suppressMeowBoxPointerClick() {
    root.dataset.vsBoxSuppressClickUntil = String(performance.now() + 420);
  }

  function shouldSuppressMeowBoxPointerClick() {
    const until = Number(root.dataset.vsBoxSuppressClickUntil || 0);
    if (!until) return false;
    if (until <= performance.now()) {
      delete root.dataset.vsBoxSuppressClickUntil;
      return false;
    }
    return true;
  }

  function bindMeowBoxPointerClickGuard() {
    if (root.dataset.vsBoxClickGuardBound === "true") return;
    root.dataset.vsBoxClickGuardBound = "true";
    document.addEventListener("click", (event) => {
      if (root.dataset.vsBypassBoxClickGuard === "true") return;
      if (!shouldSuppressMeowBoxPointerClick()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function createMeowBoxDragGhost(key) {
    const item = getVirtualBoxItem(key);
    if (!item) return null;
    const ghost = makeMeowBoxVisualEl("div", "vs-box-drag-ghost");
    ghost.dataset.vsBoxDragGhost = key;
    ghost.setAttribute("aria-hidden", "true");
    const icon = makeMeowBoxVisualEl("span", "vs-box-drag-ghost-icon", "");
    icon.dataset.vsBoxItemIcon = item.icon;
    ghost.appendChild(icon);
    ghost.appendChild(makeMeowBoxVisualEl("span", "vs-box-drag-ghost-label", item.label));
    document.body.appendChild(ghost);
    if (!reduceMotion && window.gsap) {
      window.gsap.fromTo(ghost, { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1, duration: 0.12, ease: "power2.out" });
    }
    return ghost;
  }

  function positionMeowBoxDragGhost(drag, clientX, clientY) {
    if (!drag?.ghost) return;
    const x = Math.round(clientX + 12);
    const y = Math.round(clientY + 12);
    if (window.gsap) {
      window.gsap.set(drag.ghost, { x, y });
    } else {
      drag.ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }

  function getSidebarPinDropShell(target) {
    const directShell = target?.closest?.("[data-next-sidebar-product-shell]");
    if (directShell) return directShell;
    const sidebarHost = target?.closest?.(".meowdesk-sidebar, [data-vs-sidebar-host='true'], aside");
    return sidebarHost?.querySelector?.("[data-next-sidebar-product-shell]") || null;
  }

  function getDefaultMeowBoxAnchor() {
    const trigger = document.querySelector("[data-meow-box-trigger]");
    return document.querySelector("[data-meow-box]") ||
      trigger?.closest?.("[data-meow-box]") ||
      trigger?.parentElement ||
      trigger ||
      null;
  }

  function getSidebarCoreDividerTop(shell) {
    if (!shell) return null;
    const sidebarHost = getSidebarHost(shell) || shell.closest?.(".meowdesk-sidebar, [data-vs-sidebar-host='true'], aside") || shell;
    const divider = sidebarHost.querySelector("[data-vs-sidebar-divider='core']") ||
      shell.querySelector("[data-vs-sidebar-divider='core']");
    const dividerRect = divider?.getBoundingClientRect?.();
    if (dividerRect && Number.isFinite(dividerRect.top)) return dividerRect.top;
    const anchorRect = getDefaultMeowBoxAnchor()?.getBoundingClientRect?.();
    if (anchorRect && Number.isFinite(anchorRect.top)) return anchorRect.top;
    return null;
  }

  function getSidebarCoreEntryRects(sidebarHost, shell) {
    const host = getSidebarCoreZoneHost(shell) || sidebarHost || getSidebarHost(shell) || shell;
    if (!host) return [];
    return [...host.querySelectorAll("[data-next-route]")]
      .filter((entry) => {
        if (entry.closest("[data-meow-box-menu], .vs-virtual-box-menu, [data-top-nav]")) return false;
        if (!["lobby", "workspace", "studio"].includes(entry.getAttribute("data-next-route") || "")) return false;
        const rect = entry.getBoundingClientRect();
        const style = getComputedStyle(entry);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((entry) => entry.getBoundingClientRect());
  }

  function getSidebarPinZoneBounds(shell) {
    if (!shell) return null;
    const sidebarHost = getSidebarHost(shell) || shell.closest?.("aside") || shell;
    const coreHost = getSidebarCoreZoneHost(shell) || sidebarHost;
    const hostRect = sidebarHost.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const coreDivider = coreHost.querySelector(":scope > [data-vs-sidebar-divider='core']") ||
      sidebarHost.querySelector("[data-vs-sidebar-divider='core']") ||
      shell.querySelector("[data-vs-sidebar-divider='core']");
    const boxRect = getDefaultMeowBoxAnchor()?.getBoundingClientRect();
    const dividerRect = coreDivider?.getBoundingClientRect?.();
    const coreRects = getSidebarCoreEntryRects(coreHost, shell);
    const topLimit = coreRects.length
      ? Math.max(hostRect.top, Math.min(...coreRects.map((rect) => rect.top)) - 8)
      : Math.min(hostRect.top + 96, shellRect.top);
    const dividerTop = dividerRect ? dividerRect.top : null;
    const boxTop = boxRect ? boxRect.top : null;
    const fallbackBottom = shellRect.top + Math.min(240, Math.max(90, shellRect.height * 0.45));
    const shellRight = Math.max(shellRect.right > shellRect.left ? shellRect.right : 0, hostRect.left + 88);
    const bottomLimit = Math.max(
      topLimit + 72,
      Math.min(
        ...(Number.isFinite(dividerTop) || Number.isFinite(boxTop)
          ? [dividerTop, boxTop].filter(Number.isFinite)
          : [fallbackBottom])
      )
    );
    return {
      left: Math.min(hostRect.left, shellRect.left),
      right: Math.min(window.innerWidth, shellRight + 28),
      top: topLimit,
      bottom: bottomLimit
    };
  }

  function syncSidebarPinDropIndicator(shell) {
    if (!shell) return;
    const bounds = getSidebarPinZoneBounds(shell);
    const visualTarget = getSidebarPinDropVisualTarget(shell);
    const visualRect = visualTarget?.getBoundingClientRect?.();
    if (!bounds || !visualTarget || visualRect.width <= 0 || visualRect.height <= 0) return;
    visualTarget.style.setProperty("--vs-sidebar-pin-drop-top", `${Math.max(0, Math.round(bounds.top - visualRect.top + 6))}px`);
    visualTarget.style.setProperty("--vs-sidebar-pin-drop-height", `${Math.max(38, Math.round(bounds.bottom - bounds.top - 12))}px`);
    visualTarget.style.setProperty("--vs-sidebar-pin-drop-left", `${Math.max(8, Math.round(bounds.left - visualRect.left + 8))}px`);
    visualTarget.style.setProperty("--vs-sidebar-pin-drop-right", `${Math.max(8, Math.round(visualRect.right - bounds.right + 8))}px`);
  }

  function getSidebarPinDropVisualTarget(shell) {
    if (!shell) return null;
    return getSidebarHost(shell) || shell.closest?.(".meowdesk-sidebar, [data-vs-sidebar-host='true'], aside") || shell;
  }

  function setSidebarPinDropActive(shell, active) {
    const visualTarget = getSidebarPinDropVisualTarget(shell);
    if (!visualTarget) return;
    visualTarget.classList.add("vs-sidebar-pin-drop-target");
    if (active) syncSidebarPinDropIndicator(shell);
    setMeowBoxDropActive(visualTarget, active);
  }

  function isPointInSidebarPinDropZone(shell, clientY, clientX = NaN) {
    if (!shell || !Number.isFinite(clientY)) return false;
    const bounds = getSidebarPinZoneBounds(shell);
    if (!bounds) return false;
    const withinX = !Number.isFinite(clientX) || (clientX >= bounds.left && clientX <= bounds.right);
    return withinX && clientY >= bounds.top && clientY < bounds.bottom;
  }

  function resolveSidebarPinDropAtPoint(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    const shells = [
      ...document.querySelectorAll("[data-next-sidebar-product-shell]"),
      ...document.querySelectorAll(".meowdesk-sidebar, [data-vs-sidebar-host='true'], aside")
    ];
    for (const candidate of shells) {
      const shell = candidate.matches?.("[data-next-sidebar-product-shell]")
        ? candidate
        : candidate.querySelector?.("[data-next-sidebar-product-shell]");
      if (shell && isPointInSidebarPinDropZone(shell, clientY, clientX)) return shell;
    }
    return null;
  }

  function getSidebarPinDropTargetFromPoint(target, clientY, clientX = NaN) {
    const shell = getSidebarPinDropShell(target);
    if (!shell) return null;
    return isPointInSidebarPinDropZone(shell, clientY, clientX) ? shell : null;
  }

  function resolveMeowBoxPointerDrop(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY);
    if (!target) return null;

    const sidebarTarget = getSidebarPinDropTargetFromPoint(target, clientY, clientX) || resolveSidebarPinDropAtPoint(clientX, clientY);
    if (sidebarTarget) {
      return { type: "sidebar", target: sidebarTarget };
    }

    const virtualButton = target.closest?.("[data-vs-sidebar-box='virtual']");
    if (virtualButton) {
      openVirtualBoxForDrag(virtualButton);
      return { type: "virtual", target: virtualButton, box: virtualButton };
    }

    const virtualMenu = target.closest?.(".vs-virtual-box-menu");
    if (virtualMenu && activeVirtualBox && document.body.contains(activeVirtualBox)) {
      return { type: "virtual", target: virtualMenu, box: activeVirtualBox };
    }

    const defaultMenu = target.closest?.("[data-meow-box-menu]");
    if (defaultMenu) {
      return { type: "default", target: defaultMenu };
    }

    const defaultBoxTrigger = target.closest?.("[data-meow-box-trigger], [data-meow-box]");
    if (defaultBoxTrigger) {
      openDefaultMeowBoxForDrag();
      return { type: "default", target: defaultBoxTrigger };
    }

    return null;
  }

  function updateMeowBoxPointerDropTarget(drag, clientX, clientY) {
    if (!drag) return;
    const drop = resolveMeowBoxPointerDrop(clientX, clientY);
    drag.lastClientX = clientX;
    drag.lastClientY = clientY;
    clearMeowBoxDropStates();

    if (drop?.type === "virtual" && drop.box) {
      if (drop.target?.matches?.("[data-vs-sidebar-box='virtual']")) {
        openVirtualBoxForDrag(drop.box);
        setMeowBoxDropActive(drop.target, true);
      } else {
        setMeowBoxDropActive(drop.target, true);
        drop.target.dataset.vsBoxDropPreview = "true";
      }
    } else if (drop?.type === "default") {
      setMeowBoxDropActive(drop.target, true);
    } else if (drop?.type === "sidebar") {
      const shell = drop.target?.matches?.("[data-next-sidebar-product-shell]")
        ? drop.target
        : getSidebarPinDropShell(drop.target);
      if (shell) {
        setSidebarPinDropActive(shell, true);
      }
    }

    drag.drop = drop;
  }

  function commitMeowBoxPointerDrop(drag) {
    const key = drag?.key || "";
    const drop = drag?.drop;
    if (!key || !drop || !getVirtualBoxItem(key)) return false;

    if (drop.type === "virtual" && drop.box) {
      const moved = moveVirtualBoxItemToBox(key, drop.box);
      if (!moved) return false;
      refreshOpenBoxMenus(drop.box);
      closeDefaultMeowBoxMenu(true);
      return true;
    }

    if (drop.type === "default") {
      const moved = moveVirtualBoxItemToDefault(key);
      if (moved) refreshOpenBoxMenus(null);
      return moved;
    }

    if (drop.type === "sidebar") {
      return pinMeowBoxItemToSidebar(key);
    }

    return false;
  }

  function startMeowBoxPointerDrag(drag, event) {
    if (drag.started) return;
    drag.started = true;
    activeMeowBoxPointerDrag = drag;
    drag.source.dataset.vsBoxDragging = "true";
    root.classList.add("vs-meow-box-dragging");
    suppressMeowBoxPointerClick();
    if (drag.sourceKind !== "sidebar") collapseOpenBoxMenusForDrag();
    hideHint(null, true);
    drag.ghost = createMeowBoxDragGhost(drag.key);
    positionMeowBoxDragGhost(drag, event.clientX, event.clientY);
    updateMeowBoxPointerDropTarget(drag, event.clientX, event.clientY);
  }

  function finishMeowBoxPointerDrag(drag, commit) {
    if (!drag) return;
    try {
      if (drag.source.hasPointerCapture?.(drag.pointerId)) drag.source.releasePointerCapture?.(drag.pointerId);
    } catch {
      /* Pointer capture may already be released by the browser. */
    }
    document.removeEventListener("pointermove", drag.onMove, true);
    document.removeEventListener("pointerup", drag.onUp, true);
    document.removeEventListener("pointercancel", drag.onCancel, true);

    if (drag.started) {
      if (commit) commitMeowBoxPointerDrop(drag);
      suppressMeowBoxPointerClick();
    }

    if (drag.ghost && !reduceMotion && window.gsap) {
      window.gsap.to(drag.ghost, { autoAlpha: 0, scale: 0.96, duration: 0.1, ease: "power1.out", onComplete: () => drag.ghost?.remove?.() });
    } else {
      drag.ghost?.remove?.();
    }
    delete drag.source.dataset.vsBoxDragging;
    root.classList.remove("vs-meow-box-dragging");
    restoreCollapsedBoxMenus();
    clearMeowBoxDropStates();
    if (activeMeowBoxPointerDrag === drag) activeMeowBoxPointerDrag = null;
  }

  function bindMeowBoxDragSource(el, key, sourceBox = null) {
    if (!el || !getVirtualBoxItem(key)) return;
    const sourceKind = sourceBox === "sidebar" ? "sidebar" : sourceBox ? "virtual" : "default";
    el.draggable = false;
    el.dataset.vsBoxDragKey = key;
    if (sourceKind === "sidebar") {
      el.dataset.vsBoxDragSource = "sidebar";
    } else if (sourceBox) {
      el.dataset.vsBoxDragSource = ensureVirtualBoxId(sourceBox);
    }
    if (el.dataset.vsBoxDragBound === "true") return;
    el.dataset.vsBoxDragBound = "true";
    bindMeowBoxPointerClickGuard();
    el.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target?.closest?.(".vs-meow-box-mini-action")) return;
      const drag = {
        key,
        source: el,
        sourceBox,
        sourceKind,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        started: false,
        drop: null,
        ghost: null
      };
      drag.onMove = (moveEvent) => {
        if (moveEvent.pointerId !== drag.pointerId) return;
        const dx = moveEvent.clientX - drag.startX;
        const dy = moveEvent.clientY - drag.startY;
        if (!drag.started && Math.hypot(dx, dy) < 6) return;
        startMeowBoxPointerDrag(drag, moveEvent);
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        suppressMeowBoxPointerClick();
        positionMeowBoxDragGhost(drag, moveEvent.clientX, moveEvent.clientY);
        updateMeowBoxPointerDropTarget(drag, moveEvent.clientX, moveEvent.clientY);
      };
      drag.onUp = (upEvent) => {
        if (upEvent.pointerId !== drag.pointerId) return;
        if (drag.started) {
          upEvent.preventDefault();
          upEvent.stopPropagation();
        }
        finishMeowBoxPointerDrag(drag, true);
      };
      drag.onCancel = (cancelEvent) => {
        if (cancelEvent.pointerId !== drag.pointerId) return;
        finishMeowBoxPointerDrag(drag, false);
      };
      try {
        el.setPointerCapture?.(event.pointerId);
      } catch {
        /* Synthetic smoke events may not create a browser pointer capture target. */
      }
      document.addEventListener("pointermove", drag.onMove, true);
      document.addEventListener("pointerup", drag.onUp, true);
      document.addEventListener("pointercancel", drag.onCancel, true);
    }, true);
    el.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(meowBoxDragMime, key);
      event.dataTransfer.setData("text/plain", key);
      el.dataset.vsBoxDragging = "true";
      root.classList.add("vs-meow-box-dragging");
      collapseOpenBoxMenusForDrag();
      hideHint(null, true);
    });
    el.addEventListener("dragend", () => {
      delete el.dataset.vsBoxDragging;
      root.classList.remove("vs-meow-box-dragging");
      restoreCollapsedBoxMenus();
      clearMeowBoxDropStates();
    });
  }

  function openVirtualBoxForDrag(box) {
    if (!box || !document.body.contains(box)) return;
    if (activeVirtualBox !== box || !document.querySelector(".vs-virtual-box-menu")) {
      renderVirtualBoxMenu(box);
    }
    const menu = document.querySelector(".vs-virtual-box-menu");
    if (menu) {
      delete menu.dataset.vsBoxDragCollapsed;
      menu.dataset.vsBoxDropPreview = "true";
      setMeowBoxDropActive(menu, true);
    }
  }

  function bindVirtualBoxDropTarget(target, box) {
    if (!target || !box || target.dataset.vsBoxDropBound === "true") return;
    target.dataset.vsBoxDropBound = "true";
    const isLegalVirtualDropTarget = () => Boolean(target.closest?.(".vs-virtual-box-menu"));
    target.addEventListener("dragenter", (event) => {
      const key = readMeowBoxDragKey(event);
      if (!key || !getVirtualBoxItem(key)) return;
      if (target.matches("[data-vs-sidebar-box='virtual']")) openVirtualBoxForDrag(box);
      if (!isLegalVirtualDropTarget()) return;
      event.preventDefault();
      setMeowBoxDropActive(target, true);
    });
    target.addEventListener("dragover", (event) => {
      const key = readMeowBoxDragKey(event);
      if (!key || !getVirtualBoxItem(key)) return;
      if (target.matches("[data-vs-sidebar-box='virtual']")) openVirtualBoxForDrag(box);
      if (!isLegalVirtualDropTarget()) {
        event.dataTransfer.dropEffect = "none";
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setMeowBoxDropActive(target, true);
    });
    target.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && target.contains(event.relatedTarget)) return;
      setMeowBoxDropActive(target, false);
    });
    target.addEventListener("drop", (event) => {
      const key = readMeowBoxDragKey(event);
      if (!key || !getVirtualBoxItem(key)) return;
      if (!isLegalVirtualDropTarget()) return;
      event.preventDefault();
      event.stopPropagation();
      setMeowBoxDropActive(target, false);
      delete target.dataset.vsBoxDropPreview;
      if (moveVirtualBoxItemToBox(key, box)) {
        refreshOpenBoxMenus(box);
        closeDefaultMeowBoxMenu(true);
        requestAnimationFrame(refresh);
        window.setTimeout(refresh, 120);
      }
    });
  }

  function bindDefaultBoxDropTarget(target) {
    if (!target || target.dataset.vsDefaultBoxDropBound === "true") return;
    target.dataset.vsDefaultBoxDropBound = "true";
    const isLegalDefaultDropTarget = () => Boolean(target.closest?.("[data-meow-box-menu]"));
    target.addEventListener("dragenter", (event) => {
      const key = readMeowBoxDragKey(event);
      if (!key || !getVirtualBoxItem(key)) return;
      if (!isLegalDefaultDropTarget()) return;
      event.preventDefault();
      setMeowBoxDropActive(target, true);
    });
    target.addEventListener("dragover", (event) => {
      const key = readMeowBoxDragKey(event);
      if (!key || !getVirtualBoxItem(key)) return;
      if (!isLegalDefaultDropTarget()) {
        event.dataTransfer.dropEffect = "none";
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setMeowBoxDropActive(target, true);
    });
    target.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && target.contains(event.relatedTarget)) return;
      setMeowBoxDropActive(target, false);
    });
    target.addEventListener("drop", (event) => {
      const key = readMeowBoxDragKey(event);
      if (!key || !getVirtualBoxItem(key)) return;
      if (!isLegalDefaultDropTarget()) return;
      event.preventDefault();
      event.stopPropagation();
      setMeowBoxDropActive(target, false);
      if (moveVirtualBoxItemToDefault(key)) {
        refreshOpenBoxMenus(null);
        requestAnimationFrame(refresh);
        window.setTimeout(refresh, 120);
      }
    });
  }

  function pinMeowBoxItemToSidebar(key) {
    if (!getVirtualBoxItem(key)) return false;
    unhideSidebarOwnedBoxItem(key);
    addVsPinnedBoxItem(key);
    removeVirtualBoxItemEverywhere(key);
    closeVirtualBoxMenu();
    closeDefaultMeowBoxMenu();
    renderVsPinnedSidebarBoxItems();
    refreshOpenBoxMenus(null);
    requestAnimationFrame(refresh);
    window.setTimeout(refresh, 120);
    return true;
  }

  function unpinMeowBoxItemFromSidebar(key) {
    if (!getVirtualBoxItem(key)) return false;
    removeVsPinnedBoxItem(key);
    hideSidebarOwnedBoxItem(key);
    renderVsPinnedSidebarBoxItems();
    requestAnimationFrame(refresh);
    window.setTimeout(refresh, 120);
    return true;
  }

  function bindSidebarPinDropTarget(target) {
    if (!target || target.dataset.vsSidebarPinDropBound === "true") return;
    target.dataset.vsSidebarPinDropBound = "true";
    target.addEventListener("dragenter", (event) => {
      const key = readMeowBoxDragKey(event);
      if (!key || !getVirtualBoxItem(key)) return;
      const shell = getSidebarPinDropShell(event.target) || getSidebarPinDropShell(target);
      if (!isPointInSidebarPinDropZone(shell, event.clientY, event.clientX)) return;
      event.preventDefault();
      setSidebarPinDropActive(shell, true);
    });
    target.addEventListener("dragover", (event) => {
      const key = readMeowBoxDragKey(event);
      if (!key || !getVirtualBoxItem(key)) return;
      const shell = getSidebarPinDropShell(event.target) || getSidebarPinDropShell(target);
      if (!isPointInSidebarPinDropZone(shell, event.clientY, event.clientX)) {
        event.dataTransfer.dropEffect = "none";
        if (shell) setSidebarPinDropActive(shell, false);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setSidebarPinDropActive(shell, true);
    });
    target.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && target.contains(event.relatedTarget)) return;
      const shell = getSidebarPinDropShell(event.target) || getSidebarPinDropShell(target);
      if (shell) setSidebarPinDropActive(shell, false);
    });
    target.addEventListener("drop", (event) => {
      const key = readMeowBoxDragKey(event);
      if (!key || !getVirtualBoxItem(key)) return;
      const shell = getSidebarPinDropShell(event.target) || getSidebarPinDropShell(target);
      if (!isPointInSidebarPinDropZone(shell, event.clientY, event.clientX)) return;
      event.preventDefault();
      event.stopPropagation();
      setSidebarPinDropActive(shell, false);
      pinMeowBoxItemToSidebar(key);
    });
  }

  function bindSidebarPinnedBoxDragSources() {
    if (liveAppMode) return;
    const allowed = new Set(virtualBoxAvailableItems.map((item) => item.key));
    document.querySelectorAll("[data-next-sidebar-product-shell] [data-next-route], .meowdesk-sidebar [data-next-route], [data-vs-sidebar-host='true'] [data-next-route], aside [data-next-route]").forEach((entry) => {
      const key = entry.getAttribute("data-next-route") || "";
      if (!allowed.has(key)) return;
      if (entry.closest("[data-meow-box-menu], .vs-virtual-box-menu")) return;
      if (isSidebarOwnedBoxItemHidden(key) && entry.dataset.vsSidebarPinnedBoxEntry !== "true") return;
      bindMeowBoxDragSource(entry, key, "sidebar");
    });
  }

  function renderVsPinnedSidebarBoxItems() {
    if (liveAppMode) {
      document.querySelectorAll("[data-vs-sidebar-pinned-box-entry]").forEach((entry) => entry.remove());
      return;
    }
    const anchor = getDefaultMeowBoxAnchor();
    const shell = anchor?.closest?.("[data-next-sidebar-product-shell]") || document.querySelector("[data-next-sidebar-product-shell]");
    const sidebarHost = getSidebarHost(shell) || anchor?.closest?.(".meowdesk-sidebar, [data-vs-sidebar-host='true'], aside") || anchor?.parentElement;
    const coreHost = getSidebarCoreZoneHost(shell) || sidebarHost || shell || anchor?.parentElement;
    const coreRoutes = getSidebarCoreRoutes(shell);
    if (!coreHost || !anchor) return;
    const coreDivider = getOrCreateSidebarCoreDivider(coreHost, shell, sidebarHost);
    placeSidebarCoreDivider(coreHost, coreDivider, coreRoutes);
    const wanted = getVsPinnedBoxItems();
    const keptKeys = new Set();
    document.querySelectorAll("[data-vs-sidebar-pinned-box-entry]").forEach((entry) => {
      const key = entry.getAttribute("data-next-route") || "";
      if (!wanted.includes(key) || keptKeys.has(key)) {
        entry.remove();
        return;
      }
      keptKeys.add(key);
    });
    const used = new Set();
    wanted.forEach((key) => {
      const item = getVirtualBoxItem(key);
      if (!item) return;
      document.querySelectorAll(`[data-next-sidebar-product-shell] [data-next-route="${key}"], .meowdesk-sidebar [data-next-route="${key}"], [data-vs-sidebar-host='true'] [data-next-route="${key}"], aside [data-next-route="${key}"]`).forEach((entry) => {
        if (entry.closest("[data-meow-box-menu], .vs-virtual-box-menu")) return;
        if (entry.dataset.vsSidebarPinnedBoxEntry === "true") return;
        entry.dataset.vsBoxSidebarHidden = "true";
        entry.setAttribute("aria-hidden", "true");
        entry.tabIndex = -1;
      });
      let button = [...document.querySelectorAll(`[data-vs-sidebar-pinned-box-entry][data-next-route="${key}"]`)]
        .find((entry) => !used.has(entry));
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (shouldSuppressMeowBoxPointerClick()) return;
          launchVirtualBoxItem(key);
        });
      }
      used.add(button);
      button.className = "meowdesk-sidebar-route flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground vs-entry-glow-button vs-sidebar-pinned-box-entry";
      button.dataset.nextRoute = key;
      button.dataset.vsSidebarPinnedBoxEntry = "true";
      button.setAttribute("aria-label", item.label);
      if (button.dataset.vsPinnedRenderedLabel !== item.label || button.dataset.vsPinnedRenderedIcon !== item.icon) {
        button.innerHTML = `<span class="vs-sidebar-pinned-box-icon" aria-hidden="true">${item.icon}</span><span class="vs-sidebar-pinned-box-label">${item.label}</span>`;
        button.dataset.vsPinnedRenderedLabel = item.label;
        button.dataset.vsPinnedRenderedIcon = item.icon;
      }
      setHint(button, item.label, "");
      bindMeowBoxDragSource(button, key, "sidebar");
      if (button.parentElement !== coreHost || button.nextElementSibling !== coreDivider) coreHost.insertBefore(button, coreDivider);
    });
    placeSidebarCoreDivider(coreHost, coreDivider, coreRoutes);
    bindSidebarPinnedBoxDragSources();
  }

  function closeVirtualBoxMenu() {
    document.querySelectorAll(".vs-virtual-box-menu").forEach((menu) => menu.remove());
    document.querySelectorAll("[data-vs-sidebar-box='virtual']").forEach((box) => {
      box.dataset.vsVirtualBoxActive = "false";
      box.setAttribute("aria-expanded", "false");
    });
    activeVirtualBox = null;
    root.classList.remove("vs-virtual-box-open");
  }

  function toggleVirtualBoxMenu(box) {
    if (activeVirtualBox === box && document.querySelector(".vs-virtual-box-menu")) {
      closeVirtualBoxMenu();
      return;
    }
    renderVirtualBoxMenu(box);
  }

  function launchVirtualBoxItem(key) {
    const target = [...document.querySelectorAll("[data-meow-box-launch]")]
      .find((launch) => launch.getAttribute("data-meow-box-launch") === key || launch.getAttribute("data-next-route") === key);
    if (target) {
      target.click();
    } else {
      window.location.hash = key;
    }
    closeVirtualBoxMenu();
  }

  function makeVirtualBoxItemRow(box, key) {
    const item = getVirtualBoxItem(key);
    if (!item) return null;
    const row = makeMeowBoxVisualEl("div", "vs-virtual-box-row");
    row.dataset.vsBoxItemRow = key;
    const open = makeMeowBoxVisualEl("button", "vs-virtual-box-entry");
    open.type = "button";
    open.innerHTML = `<span class="vs-virtual-box-icon" aria-hidden="true">${item.icon}</span><span class="vs-virtual-box-label">${item.label}</span>`;
    bindMeowBoxDragSource(open, key, box);
    open.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (shouldSuppressMeowBoxPointerClick()) return;
      launchVirtualBoxItem(key);
    });

    const remove = makeMeowBoxVisualEl("button", "vs-meow-box-mini-action vs-virtual-box-remove", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", "移出 Box");
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setVirtualBoxItems(box, getVirtualBoxItems(box).filter((itemKey) => itemKey !== key));
      renderVirtualBoxMenu(box);
      decorateMeowBoxMenu();
    });
    row.append(open, remove);
    return row;
  }

  function renderVirtualBoxMenu(box) {
    if (!box || !document.body.contains(box)) return;
    document.querySelectorAll(".vs-virtual-box-menu").forEach((menu) => menu.remove());
    document.querySelectorAll("[data-vs-sidebar-box='virtual']").forEach((item) => {
      item.dataset.vsVirtualBoxActive = item === box ? "true" : "false";
      item.setAttribute("aria-expanded", item === box ? "true" : "false");
    });
    activeVirtualBox = box;
    root.classList.add("vs-virtual-box-open");

    const selectedKeys = getVirtualBoxItems(box);
    const menu = makeMeowBoxVisualEl("div", "vs-virtual-box-menu vs-box-organizer-menu");
    menu.setAttribute("role", "menu");
    bindVirtualBoxDropTarget(menu, box);

    const head = makeMeowBoxVisualEl("div", "vs-virtual-box-head");
    head.appendChild(makeMeowBoxVisualEl("strong", "vs-virtual-box-title", getVirtualBoxName(box)));
    const count = makeMeowBoxVisualEl("span", "vs-meow-box-section-count", String(selectedKeys.length));
    head.appendChild(count);
    menu.appendChild(head);

    const selectedSection = makeMeowBoxVisualEl("div", "vs-virtual-box-section");
    selectedSection.dataset.vsBoxDropZone = "true";
    bindVirtualBoxDropTarget(selectedSection, box);
    if (!selectedKeys.length) {
      selectedSection.appendChild(makeMeowBoxVisualEl("div", "vs-virtual-box-empty", "空 Box"));
    } else {
      selectedKeys.forEach((key) => {
        const row = makeVirtualBoxItemRow(box, key);
        if (row) selectedSection.appendChild(row);
      });
    }
    menu.appendChild(selectedSection);

    const dissolve = makeMeowBoxVisualEl("button", "vs-virtual-box-danger", "解散 Box");
    dissolve.type = "button";
    dissolve.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextFocus = box.nextElementSibling || box.previousElementSibling;
      closeVirtualBoxMenu();
      box.remove();
      nextFocus?.focus?.();
      refresh();
    });
    menu.appendChild(dissolve);
    document.body.appendChild(menu);
    positionVirtualBoxMenu(menu, box);
    animateBoxOrganizerMenu(menu, ".vs-virtual-box-entry, .vs-virtual-box-empty, .vs-virtual-box-danger");
  }

  function positionVirtualBoxMenu(menu, box) {
    const rect = box?.getBoundingClientRect();
    if (!menu || !rect) return;
    const width = Math.min(274, Math.max(210, window.innerWidth - 112));
    const measuredHeight = menu.scrollHeight || menu.getBoundingClientRect().height || 280;
    const left = Math.max(84, Math.min(rect.right + 28, window.innerWidth - width - 12));
    const top = Math.max(76, Math.min(rect.top - 8, window.innerHeight - measuredHeight - 12));
    menu.style.setProperty("--vs-virtual-box-left", `${Math.round(left)}px`);
    menu.style.setProperty("--vs-virtual-box-top", `${Math.round(top)}px`);
  }

  function syncActiveVirtualBoxMenu() {
    if (!activeVirtualBox || !document.body.contains(activeVirtualBox)) {
      if (document.querySelector(".vs-virtual-box-menu")) closeVirtualBoxMenu();
      return;
    }
    const menu = document.querySelector(".vs-virtual-box-menu");
    if (menu) positionVirtualBoxMenu(menu, activeVirtualBox);
  }

  function bindVirtualBoxOutsideClose() {
    if (root.dataset.vsVirtualBoxOutsideBound === "true") return;
    root.dataset.vsVirtualBoxOutsideBound = "true";
    document.addEventListener("click", (event) => {
      if (!activeVirtualBox) return;
      if (root.dataset.vsSuppressVirtualBoxOutsideClose === "true") {
        delete root.dataset.vsSuppressVirtualBoxOutsideClose;
        return;
      }
      if (event.target?.closest?.(".vs-virtual-box-menu, [data-vs-sidebar-box='virtual'], [data-vs-sidebar-add-box]")) return;
      closeVirtualBoxMenu();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeVirtualBox) closeVirtualBoxMenu();
    });
  }

  function decorateMeowBoxMenu() {
    const menu = document.querySelector("[data-meow-box-menu]");
    root.classList.toggle("vs-meow-box-open", Boolean(menu));
    document.querySelectorAll("[data-meow-box-trigger]").forEach((trigger) => {
      trigger.setAttribute("aria-expanded", menu ? "true" : "false");
      clearHint(trigger);
    });
    if (!menu) return;
    menu.classList.add("vs-meow-box-menu", "vs-box-organizer-menu");
    menu.dataset.vsMeowBoxMenuVisual = "true";
    menu.closest("[data-next-sidebar-product-shell], .meowdesk-sidebar")?.classList.add("vs-meow-box-floating-host");
    menu.closest("aside")?.classList.add("vs-meow-box-floating-host");
    positionMeowBoxMenu(menu);

    decorateDefaultMeowBoxPanel(menu);
    menu.querySelectorAll(".vs-meow-box-section-head").forEach((el) => el.remove());
    menu.querySelector("[data-vs-meow-box-custom], .vs-meow-box-custom")?.remove();
    menu.dataset.vsMeowBoxReady = "true";
  }

  function decorateDefaultMeowBoxPanel(menu) {
    const activeId = menu.getAttribute("data-meow-box-active-id") || "default";
    const body = menu.querySelector(`[data-meow-box-id="${activeId}"]`) ||
      menu.querySelector("[data-meow-box-id='default']") ||
      menu.firstElementChild ||
      menu;
    const titleText = textOf(body.querySelector(":scope > div:first-child span:first-child")) ||
      body.getAttribute("data-meow-box-id") ||
      "Meow Box";
    body.classList.add("vs-meow-box-default-body");
    if (liveAppMode) {
      const launches = [...body.querySelectorAll("[data-meow-box-launch]")];
      let head = body.querySelector("[data-vs-meow-box-default-head]");
      if (!head) {
        head = document.createElement("div");
        body.prepend(head);
        head.dataset.vsMeowBoxDefaultHead = "true";
      }
      head.className = "vs-virtual-box-head vs-meow-box-default-head";
      head.replaceChildren();
      head.appendChild(makeMeowBoxVisualEl("strong", "vs-virtual-box-title", titleText));
      head.appendChild(makeMeowBoxVisualEl("span", "vs-meow-box-section-count", String(launches.length)));
      launches.forEach((launch) => {
        const row = getMeowBoxLaunchRow(launch);
        if (row) {
          row.dataset.vsMeowBoxAssignedHidden = "false";
          row.classList.remove("vs-meow-box-assigned-hidden");
          row.classList.add("vs-virtual-box-row", "vs-meow-box-default-row");
        }
        launch.classList.add("vs-virtual-box-entry", "vs-meow-box-default-entry");
        clearHint(launch);
        const pin = row?.querySelector?.("[data-meow-box-pin]");
        if (!pin) return;
        pin.classList.add("vs-meow-box-mini-action", "vs-meow-box-default-pin");
        if (!pin.getAttribute("aria-label")) pin.setAttribute("aria-label", "固定到左侧栏");
        suppressNativeTitle(pin);
      });
      body.querySelector("[data-vs-meow-box-default-empty]")?.remove();
      return;
    }
    bindDefaultBoxDropTarget(menu);
    bindDefaultBoxDropTarget(body);
    const launches = [...body.querySelectorAll("[data-meow-box-launch]")];
    let head = body.querySelector("[data-vs-meow-box-default-head]");
    if (!head) {
      const first = body.firstElementChild;
      if (first && !first.matches("[data-meow-box-item]")) {
        head = first;
      } else {
        head = document.createElement("div");
        body.prepend(head);
      }
      head.dataset.vsMeowBoxDefaultHead = "true";
    }
    head.className = "vs-virtual-box-head vs-meow-box-default-head";
    head.replaceChildren();
    head.appendChild(makeMeowBoxVisualEl("strong", "vs-virtual-box-title", titleText));
    const unassigned = getUnassignedBoxItems();
    head.appendChild(makeMeowBoxVisualEl("span", "vs-meow-box-section-count", String(unassigned.length)));

    let visibleCount = 0;
    launches.forEach((launch) => {
      const key = launch.getAttribute("data-next-route") || launch.getAttribute("data-meow-box-launch") || "";
      const row = getMeowBoxLaunchRow(launch);
      const assigned = Boolean(getAssignedVirtualBox(key)) || isMeowBoxItemPinnedToSidebar(key);
      if (row) {
        row.dataset.vsMeowBoxAssignedHidden = assigned ? "true" : "false";
        row.classList.toggle("vs-meow-box-assigned-hidden", assigned);
      }
      if (assigned) return;
      visibleCount += 1;
      row?.classList?.add("vs-virtual-box-row", "vs-meow-box-default-row");
      launch.classList.add("vs-virtual-box-entry", "vs-meow-box-default-entry");
      const item = getVirtualBoxItem(key);
      if (item && (launch.dataset.vsBoxRenderedLabel !== item.label || launch.dataset.vsBoxRenderedIcon !== item.icon)) {
        launch.innerHTML = `<span class="vs-virtual-box-icon" aria-hidden="true">${item.icon}</span><span class="vs-virtual-box-label">${item.label}</span>`;
        launch.dataset.vsBoxRenderedLabel = item.label;
        launch.dataset.vsBoxRenderedIcon = item.icon;
      }
      bindMeowBoxDragSource(launch, key);
      clearHint(launch);
      const pin = row?.querySelector?.("[data-meow-box-pin]");
      if (!pin) return;
      pin.classList.add("vs-meow-box-mini-action", "vs-meow-box-default-pin");
      if (!pin.getAttribute("aria-label")) pin.setAttribute("aria-label", "固定到左侧栏");
      suppressNativeTitle(pin);
    });

    let empty = body.querySelector("[data-vs-meow-box-default-empty]");
    if (!visibleCount) {
      if (!empty) {
        empty = makeMeowBoxVisualEl("div", "vs-virtual-box-empty vs-meow-box-default-empty", "空 Box");
        empty.dataset.vsMeowBoxDefaultEmpty = "true";
        body.appendChild(empty);
      }
    } else {
      empty?.remove();
    }
  }

  function positionMeowBoxMenu(menu) {
    const trigger = document.querySelector("[data-meow-box-trigger]");
    const sidebar = document.querySelector("[data-next-sidebar-product-shell]")?.closest("aside") ||
      document.querySelector(".vs-sidebar-host") ||
      document.querySelector("[data-next-sidebar-product-shell]");
    const triggerRect = trigger?.getBoundingClientRect();
    const sidebarRect = sidebar?.getBoundingClientRect();
    const menuWidth = Math.min(288, Math.max(180, window.innerWidth - 112));
    const leftBase = (triggerRect?.right || sidebarRect?.right || 72) + 24;
    const left = Math.max(84, Math.min(leftBase, window.innerWidth - menuWidth - 12));
    const measuredHeight = menu.scrollHeight || menu.getBoundingClientRect().height || 360;
    const menuHeight = Math.min(measuredHeight, window.innerHeight - 24);
    const topBase = triggerRect ? triggerRect.top - 2 : (sidebarRect?.top || 80);
    const top = Math.max(76, Math.min(topBase, window.innerHeight - menuHeight - 12));
    menu.style.setProperty("--vs-meow-box-left", `${Math.round(left)}px`);
    menu.style.setProperty("--vs-meow-box-top", `${Math.round(top)}px`);
  }

  function isTaskTagText(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    return /^(未分类|个人|工作流|工坊|personal|workflow|studio)$/i.test(value) || /^#[\w\u4e00-\u9fa5-]{1,24}$/.test(value);
  }

  function decorateTaskTagChips() {
    document.querySelectorAll(".vs-task-tag-chip").forEach((el) => {
      if (el.closest("[data-r15-task-card], [data-r2-workspace-task-card]") && isTaskTagText(visibleTextOf(el))) return;
      el.classList.remove("vs-task-tag-chip");
    });

    document.querySelectorAll("[data-r15-task-card], [data-r2-workspace-task-card]").forEach((card) => {
      [...card.querySelectorAll("span")].forEach((span) => {
        if (span.closest(".vs-card-action-bar, .vs-card-action-trigger")) return;
        if (!isTaskTagText(visibleTextOf(span))) return;
        span.classList.add("vs-task-tag-chip");
      });
    });
  }

  function decoratePanelHeaders() {
    const headers = new Set([
      ...document.querySelectorAll([
        ".meowdesk-panel-header",
        ".meowdesk-workspace-pane-head",
        ".meowdesk-workspace-widget-head",
        ".meowdesk-workspace-side-card > header",
        ".meowdesk-workspace-side-card > :first-child",
        "[data-r15-workflow-canvas-shell] > header",
        "[data-r15-workflow-inspector] > :first-child",
        "[data-r15-task-matrix] > header",
        "[data-r15-task-week-view] > header",
        "[data-r15-task-calendar] > header",
        "[data-r15-task-day-schedule] > header",
        "[data-r15-task-habits] > header"
      ].join(","))
    ]);
    const taskCenter = document.querySelector("[data-r15-task-center]");
    const taskCard = taskCenter?.querySelector(".meowdesk-panel");
    const taskHeader = taskCard?.querySelector(":scope > .meowdesk-panel-header") ||
      taskCenter?.querySelector(".meowdesk-panel-header");
    if (taskHeader) headers.add(taskHeader);
    headers.forEach((header) => {
      if (!header || header.closest("[data-top-nav], [data-next-sidebar-product-shell], .meowdesk-sidebar")) return;
      // A resize handle can be the first child of a side card; it is a thin drag
      // bar, not a panel header. Decorating it as a header forces flex/54px and
      // makes its green bar overlap the real header below it.
      if (header.matches(resizeHandleSelector) ||
          header.matches(".meowdesk-workspace-sidebar-resizer, .meowdesk-workspace-side-resizer, .meowdesk-workspace-pet-resizer, .meowdesk-workspace-widget-resizer")) return;
      header.classList.add("vs-panel-header-owner");
    });
  }

  function getTaskCenterActiveLabel() {
    const active = document.querySelector("[data-r15-task-tab-active='true']") ||
      document.querySelector("[data-r15-task-tab][aria-pressed='true']") ||
      document.querySelector("[data-r15-task-tab][aria-selected='true']");
    const key = active?.getAttribute?.("data-r15-task-tab") || "";
    const labels = new Map([
      ["ai", "AI任务"],
      ["mine", "我的任务"],
      ["calendar", "月视图"],
      ["week", "周视图"],
      ["today", "日程"],
      ["matrix", "四象限"],
      ["habits", "每日打卡"]
    ]);
    return labels.get(key) || visibleTextOf(active) || "我的任务";
  }

  function decorateTaskCenterLabels() {
    const center = document.querySelector("[data-r15-task-center]");
    if (!center) return;
    center.classList.add("vs-task-center-clean-labels");
    const activeLabel = getTaskCenterActiveLabel();
    const taskCard = center.querySelector(".meowdesk-panel");
    const header = taskCard?.querySelector(":scope > .meowdesk-panel-header") ||
      center.querySelector(".meowdesk-panel-header");
    if (header) {
      header.classList.add("vs-panel-header-owner", "vs-task-center-main-header");
      const taskLabelPattern = /^(任务看板|AI任务|我的任务|月视图|周视图|日程|四象限|每日打卡|任务)$/;
      const title = [...header.querySelectorAll(":scope > div div, :scope > div strong, :scope > div span, :scope > strong, :scope > span, h1, h2, h3")]
        .find((el) => el.dataset.vsTaskCenterTitle === "true" || ["任务看板", "AI任务", "我的任务", "月视图", "周视图", "日程", "四象限", "每日打卡"].includes(visibleTextOf(el)));
      if (title) {
        title.textContent = activeLabel;
        title.dataset.vsTaskCenterTitle = "true";
      }
      [...header.querySelectorAll(":scope > *:not([data-vs-task-center-title='true']), :scope > * > *:not([data-vs-task-center-title='true'])")].forEach((child) => {
        if (title && child.contains(title)) return;
        const childText = visibleTextOf(child);
        if (taskLabelPattern.test(childText) || childText === activeLabel) {
          child.classList.add("vs-task-center-duplicate-badge");
          child.setAttribute("aria-hidden", "true");
          child.hidden = true;
        }
      });
    }
    const matrixHeader = center.querySelector("[data-r15-task-matrix] > header");
    if (matrixHeader) {
      matrixHeader.classList.add("vs-task-center-matrix-inline-header");
      matrixHeader.setAttribute("aria-hidden", "true");
    }
  }

  function decorateWorkflowSingleSidebar() {
    document.querySelectorAll("[data-r15-workflow-shell]").forEach((shell) => {
      const owner = shell.querySelector("[data-r15-workflow-sidebar][data-workspace-right-sidebar-owner]");
      if (!owner) return;
      shell.classList.remove("vs-workflow-single-sidebar");
      delete shell.dataset.vsWorkflowSideView;
      delete shell.dataset.vsWorkflowSideCollapsed;
      if (window.gsap) window.gsap.killTweensOf(shell);
      shell.style.removeProperty("--vs-workflow-side-width");
      shell.style.removeProperty("--vs-workflow-side-gap");
      shell.style.removeProperty("will-change");
      owner.classList.remove("vs-workflow-side-pane");
      shell.querySelectorAll("[data-vs-workflow-side-switch]").forEach((switcher) => switcher.remove());
    });
  }

  function decoratePickerDialogs() {
    document.querySelectorAll("[data-r2-workspace-config-dialog], [data-studio-agent-picker-dialog]").forEach((dialog) => {
      dialog.classList.add("vs-picker-card-dialog");
      dialog.dataset.vsPickerLive = "native-content";
    });
  }

  function decorateBlueResidueCleanup() {
    document.querySelectorAll([
      "[data-studio-project-open-publish]",
      "[data-lobby-guide-jump]",
      "[data-lobby-desktop-agent-studio-link]",
      "[data-lobby-no-agent-settings-link]",
      "[data-lobby-agent-settings-link]"
    ].join(",")).forEach((el) => {
      el.classList.add("vs-blue-residue-clean");
    });
    document.querySelectorAll("[data-lobby-guide-stage] > [aria-hidden='true']").forEach((el) => {
      el.classList.add("vs-blue-residue-hidden");
    });
  }

  function decorateWorkspaceSidePanel() {
    const side = document.querySelector(".meowdesk-workspace-side-column");
    if (side) side.classList.add("vs-workspace-side-quiet");

    const board = document.querySelector(".meowdesk-workspace-board");
    if (!board) return;
    board.classList.add("vs-workspace-board-compact");
    const header = board.querySelector(".meowdesk-panel-header");
    const openCenter = board.querySelector("[data-r2-workspace-task-open-center]");
    if (header && openCenter && openCenter.parentElement !== header) {
      header.appendChild(openCenter);
    }
    if (openCenter) {
      openCenter.classList.add("vs-workspace-task-open-icon");
      openCenter.setAttribute("aria-label", "任务中心");
      openCenter.removeAttribute("title");
      clearHint(openCenter);
      removeVisibleTextNodes(openCenter);
    }

    if (liveAppMode) {
      board.querySelectorAll(".vs-workspace-side-copy-hidden").forEach((el) => {
        el.classList.remove("vs-workspace-side-copy-hidden");
        el.removeAttribute("aria-hidden");
      });
      return;
    }

    board.querySelectorAll("[data-r2-workspace-task-summary], [data-r2-workspace-task-status]").forEach((el) => {
      el.classList.add("vs-workspace-side-copy-hidden");
      el.setAttribute("aria-hidden", "true");
    });
  }

  function decorateInteractiveCards() {
    document.querySelectorAll("[data-lobby-profile-work-row]").forEach((el) => {
      el.classList.remove("vs-interactive-card");
      delete el.dataset.vsCardDecorated;
    });

    document.querySelectorAll([
      "[data-studio-agent-stage]",
      "[data-studio-agent-panel]",
      "[data-studio-agent-standby]",
      ".meowdesk-studio-terminal-runtime"
    ].join(",")).forEach((el) => {
      if (!isAgentWorkSurface(el) && !el.matches(".meowdesk-studio-terminal-runtime")) return;
      el.classList.remove("vs-interactive-card");
      delete el.dataset.vsCardDecorated;
    });

    document.querySelectorAll(interactiveCardSelectors.join(",")).forEach((el) => {
      if (!el) return;
      if (el.closest("[data-next-sidebar-product-shell], [data-top-nav], .vs-meow-hint")) return;
      if (el.matches("[data-lobby-profile-work-row]") || el.closest("[data-lobby-profile-work-row]")) return;
      if (el.matches("[data-r15-workflow-node-card]") || el.closest("[data-r15-workflow-node]")) return;
      if (isAgentWorkSurface(el)) return;
      el.dataset.vsCardDecorated = "true";
      el.classList.add("vs-interactive-card");
    });
  }

  function isAgentWorkSurface(el) {
    if (!el) return false;
    if (el.matches("[data-studio-agent-stage], [data-studio-agent-panel], [data-studio-agent-standby]")) return true;
    if (el.closest("[data-studio-agent-stage], [data-studio-agent-panel], [data-studio-agent-standby]")) return true;
    return false;
  }

  function decorateTopIconTextButtons() {
    const menus = document.querySelectorAll(iconTextMenuSelectors.join(","));
    menus.forEach((menu) => {
      menu.classList.add("vs-icon-text-menu");
      menu.querySelectorAll("button, a, [role='button']").forEach((button) => {
        if (button.closest("[data-next-sidebar-product-shell], .meowdesk-sidebar, [data-r2-workspace-slot-picker]")) return;
        if (!getTopPageSwitchGroup(button)) return;
        const text = visibleTextOf(button) || button.getAttribute("aria-label") || "";
        if (text.length < 2 || /^[\d\s]+$/.test(text)) return;
        normalizeTopPageEntryButton(button, text);
      });
    });
  }

  function arrangeStudioTopButtons() {
    if (liveAppMode) return;
    const actions = document.querySelector("[data-studio-top-actions]");
    const tabs = actions?.querySelector("[data-studio-top-page-tabs]");
    const make = tabs?.querySelector("[data-studio-page-tab='make']");
    const manage = tabs?.querySelector("[data-studio-page-tab='manage']");
    const inspector = actions?.querySelector("[data-studio-inspector-toggle]") ||
      tabs?.querySelector("[data-studio-inspector-toggle]");
    if (!actions || !tabs || !make || !manage || !inspector) return;
    tabs.classList.add("vs-studio-top-primary-cluster");
    inspector.classList.remove("vs-top-action-icon", "vs-text-icon-link");
    delete inspector.dataset.vsTopActionIcon;
    delete inspector.dataset.vsCollapseActionIcon;
    inspector.classList.add("vs-entry-glow-button", "vs-top-page-entry", "vs-studio-top-entry");
    inspector.setAttribute("aria-label", "辅助面板");
    inspector.removeAttribute("title");
    inspector.dataset.vsForceHint = "true";
    removeVisibleTextNodes(inspector);
    const inspectorIcon = inspector.querySelector("svg, img");
    if (inspectorIcon) removeEmptyDecorChildren(inspector, inspectorIcon);
    setHint(inspector, "辅助面板", "");
    if (inspector.parentElement !== tabs || make.nextElementSibling !== inspector) {
      tabs.insertBefore(inspector, make.nextElementSibling);
    }
    if (inspector.nextElementSibling !== manage) {
      tabs.insertBefore(manage, inspector.nextElementSibling);
    }
  }

  function getTopNavActionHost() {
    const nav = document.querySelector("[data-top-nav]");
    if (!nav) return null;
    let host = nav.querySelector(":scope > [data-vs-top-side-panel-proxy-host]");
    if (!host) {
      host = document.createElement("div");
      host.dataset.vsTopSidePanelProxyHost = "true";
      host.className = "vs-top-side-panel-proxy-host";
      nav.appendChild(host);
    }
    return host;
  }

  function ensureTopSidePanelProxy(id, label, active, clickTarget, clickAction = null) {
    const host = getTopNavActionHost();
    if (!host || !clickTarget) return null;
    let button = document.querySelector(`[data-top-nav] [data-vs-top-side-panel-proxy="${id}"]`);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.vsTopSidePanelProxy = id;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof button._vsProxyAction === "function") {
          button._vsProxyAction();
          return;
        }
        const target = button._vsProxyTarget;
        if (target && document.body.contains(target)) target.click();
      });
    }
    if (button.parentElement !== host) host.appendChild(button);
    button._vsProxyTarget = clickTarget;
    button._vsProxyAction = clickAction;
    button.classList.add("vs-entry-glow-button", "vs-top-page-entry", "vs-top-side-panel-proxy");
    button.classList.remove("vs-top-action-icon", "vs-text-icon-link");
    button.dataset.vsTopActionIcon = "true";
    button.dataset.vsCollapseActionIcon = active ? "collapse" : "expand";
    let glyph = button.querySelector(":scope > .vs-collapse-glyph");
    if (glyph && glyph.tagName !== "I") {
      glyph.remove();
      glyph = null;
    }
    if (!glyph) {
      glyph = document.createElement("i");
      glyph.className = "vs-collapse-glyph";
      glyph.setAttribute("aria-hidden", "true");
      button.appendChild(glyph);
    }
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.removeAttribute("title");
    clearHint(button);
    removeVisibleTextNodes(button);
    return button;
  }

  function syncTopSidePanelProxies() {
    if (liveAppMode) {
      document.querySelectorAll("[data-top-nav] [data-vs-top-side-panel-proxy], [data-top-nav] [data-vs-top-side-panel-proxy-host]").forEach((el) => el.remove());
      document.querySelectorAll(".vs-panel-inline-collapse-hidden").forEach((el) => {
        el.classList.remove("vs-panel-inline-collapse-hidden");
      });
      return;
    }
    const route = getCurrentRoute();
    const nav = document.querySelector("[data-top-nav]");
    if (!nav) return;
    nav.querySelectorAll("[data-vs-top-side-panel-proxy]").forEach((button) => {
      const id = button.getAttribute("data-vs-top-side-panel-proxy");
      if ((route !== "studio" && id === "studio") || (route !== "workflow" && id === "workflow")) button.remove();
    });

    if (route === "studio") {
      const toggle = document.querySelector("[data-studio-inspector-toggle]");
      const close = document.querySelector("[data-studio-inspector-close]");
      document.querySelectorAll("[data-top-nav] [data-vs-top-side-panel-proxy='studio']").forEach((button) => button.remove());
      close?.classList.remove("vs-panel-inline-collapse-hidden");
      toggle?.classList.remove("vs-panel-inline-collapse-hidden");
    }

    if (route === "workflow") {
      document.querySelectorAll("[data-top-nav] [data-vs-top-side-panel-proxy='workflow']").forEach((button) => button.remove());
    }
  }

  function clearTopTextIconResidue(button) {
    delete button.dataset.vsTextIconButton;
    delete button.dataset.vsClickCollapse;
    button.classList.remove("vs-text-icon-link");
    button.style.removeProperty("--vs-text-icon-expanded");
    button.style.removeProperty("--vs-text-icon-collapsed");
    button.style.removeProperty("--vs-text-icon-height");
    button.style.removeProperty("--vs-text-icon-size");
    button.querySelectorAll(".vs-text-icon-title, [data-vs-text-icon-title='true']").forEach((label) => label.remove());
    button.querySelectorAll(".vs-text-icon-icon").forEach((iconHost) => {
      iconHost.classList.remove("vs-text-icon-icon");
    });
  }

  function normalizeTopPageEntryButton(button, explicitText = "") {
    const labelText = (explicitText ||
      button.getAttribute("aria-label") ||
      button.querySelector(".vs-text-icon-title")?.textContent ||
      visibleTextOf(button)).replace(/\s+/g, " ").trim();
    const icon = button.querySelector("svg, img");
    if (labelText.length < 2 || /^[\d\s]+$/.test(labelText)) return false;

    button.setAttribute("aria-label", labelText);
    button.removeAttribute("title");
    clearTopTextIconResidue(button);
    removeVisibleTextNodes(button);
    if (icon) removeEmptyDecorChildren(button, icon);
    button.classList.add("vs-entry-glow-button", "vs-top-page-entry");
    button.dataset.vsForceHint = "true";
    const key = getTopPageSwitchKey(button);
    const copy = hintCopy.get(key);
    setHint(button, copy ? copy[0] : labelText, copy ? copy[1] : "");
    return true;
  }

  function decorateSharedEntryGlowButtons() {
    document.querySelectorAll([
      ".meowdesk-sidebar [data-next-route]",
      ".meowdesk-sidebar [data-meow-box-trigger]",
      ".meowdesk-sidebar [data-meow-tab]",
      ".meowdesk-sidebar [data-next-sidebar-settings]",
      ".meowdesk-sidebar [data-r15-theme-sidebar-toggle]",
      "[data-next-sidebar-product-shell] [data-next-route]",
      "[data-next-sidebar-product-shell] [data-meow-box-trigger]",
      "[data-next-sidebar-product-shell] [data-meow-tab]",
      "[data-next-sidebar-product-shell] [data-next-sidebar-settings]",
      "[data-next-sidebar-product-shell] [data-r15-theme-sidebar-toggle]"
    ].join(",")).forEach((button) => {
      button.classList.add("vs-entry-glow-button");
    });
  }

  function bindMeowBoxRefresh() {
    if (root.dataset.vsMeowBoxRefreshBound === "true") return;
    root.dataset.vsMeowBoxRefreshBound = "true";
    // Single pin authority: the React snapshot ships its own [data-meow-box-pin]
    // handler that adds the route to the sidebar WITHOUT removing it from the box
    // and WITHOUT telling VS, producing both a duplicate and an entry that lands
    // below VS's core divider. Intercept the pin click in the capture phase,
    // block React's native pin, and route through VS's ownership model so the
    // function is pinned above the divider and removed from the box (one place only).
    if (!liveAppMode) {
      document.addEventListener("click", (event) => {
        const pin = event.target?.closest?.("[data-meow-box-pin]");
        if (!pin) return;
        const key = pin.getAttribute("data-meow-box-pin") || "";
        if (!getVirtualBoxItem(key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (isMeowBoxItemPinnedToSidebar(key)) {
          unpinMeowBoxItemFromSidebar(key);
        } else {
          pinMeowBoxItemToSidebar(key);
        }
      }, true);
    }
    document.addEventListener("click", (event) => {
      if (!event.target?.closest?.("[data-meow-box-trigger], [data-meow-box-menu], [data-meow-box-launch], .vs-meow-box-mini-action")) return;
      requestAnimationFrame(refresh);
      window.setTimeout(refresh, 80);
      window.setTimeout(refresh, 220);
    }, true);
  }

  function getVisiblePageSwitchButtons(menu) {
    return [...menu.querySelectorAll(topPageSwitchSelectors.join(","))].filter((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return isMotionVisible(button) && rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function getKeepaliveRoute(el) {
    if (!el?.closest) return null;
    return el.matches?.("[data-route-keepalive]") ? el : el.closest("[data-route-keepalive]");
  }

  function isInInactiveKeepalive(el) {
    const route = getKeepaliveRoute(el);
    return route?.getAttribute("data-route-keepalive-active") === "false";
  }

  function isInActiveKeepalive(el) {
    const route = getKeepaliveRoute(el);
    return !route || route.getAttribute("data-route-keepalive-active") === "true";
  }

  function isMotionVisible(el) {
    if (!el || !isInActiveKeepalive(el)) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function clearTransientMotionStyles(el) {
    if (!el?.style) return;
    el.style.removeProperty("opacity");
    el.style.removeProperty("visibility");
    el.style.removeProperty("transform");
    el.style.removeProperty("will-change");
  }

  function cleanupInactiveKeepaliveRoutes() {
    const inactiveRoutes = [...document.querySelectorAll("[data-route-keepalive][data-route-keepalive-active='false']")];
    if (!inactiveRoutes.length) {
      inactiveKeepaliveCleanupSignature = "";
      return;
    }
    const signature = inactiveRoutes
      .map((route) => {
        const key = route.getAttribute("data-route-keepalive") || "";
        return `${key}:${route.childElementCount}`;
      })
      .join("|");
    if (signature === inactiveKeepaliveCleanupSignature) return;
    inactiveKeepaliveCleanupSignature = signature;
    inactiveRoutes.forEach((route) => {
      const motionNodes = [
        route,
        ...route.querySelectorAll(routeMotionCleanupSelectors.join(","))
      ];
      if (window.gsap) {
        window.gsap.killTweensOf(motionNodes);
      }
      motionNodes.forEach(clearTransientMotionStyles);
    });
  }

  function cleanupPageSwitchCursorResidue() {
    document.querySelectorAll(iconTextMenuSelectors.join(",")).forEach((menu) => {
      menu.classList.remove("vs-page-switch-menu");
      menu.querySelectorAll(":scope > .vs-page-switch-cursor").forEach((cursor) => {
        if (cursor._vsCursorTween) cursor._vsCursorTween.kill();
        cursor.remove();
      });
      getVisiblePageSwitchButtons(menu).forEach((button) => {
        button.classList.remove("vs-text-icon-clicked", "vs-text-icon-hovered");
        delete button.dataset.vsPageCursorBound;
      });
    });
  }

  function isSegmentActive(button) {
    return button.matches([
      ".is-active",
      '[data-state="active"]',
      '[aria-selected="true"]',
      '[aria-pressed="true"]',
      '[data-r2-workspace-slot-active="true"]',
      '[data-studio-inspector-panel-tab-active="true"]',
      '[data-studio-project-bucket-active="true"]',
      '[data-r15-workflow-side-tab-active="true"]',
      '[data-r3-conversation-agent-active="true"]'
    ].join(","));
  }

  function ensureSegmentCursor(group) {
    let cursor = group.querySelector(":scope > .meowdesk-segment-cursor, :scope > .vs-segment-cursor");
    if (!cursor) {
      cursor = document.createElement("span");
      cursor.className = "vs-segment-cursor";
      cursor.setAttribute("aria-hidden", "true");
      group.prepend(cursor);
    } else {
      cursor.classList.add("vs-segment-cursor");
    }
    return cursor;
  }

  function getVisibleSegmentButtons(group) {
    return [...group.querySelectorAll(":scope > button, :scope > [role='button'], :scope > [role='tab']")].filter((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function moveSegmentCursor(group, immediate = false, preferredButton = null) {
    if (group._vsSegmentSyncing && !immediate) return;
    group._vsSegmentSyncing = true;
    requestAnimationFrame(() => {
      group._vsSegmentSyncing = false;
    });
    const buttons = getVisibleSegmentButtons(group);
    const preferred = preferredButton && buttons.includes(preferredButton) ? preferredButton : null;
    const active = preferred || buttons.find(isSegmentActive) || buttons[0];
    if (!active) {
      const cursor = group.querySelector(":scope > .vs-segment-cursor");
      if (cursor) {
        if (cursor._vsSegmentTween) {
          cursor._vsSegmentTween.kill();
          cursor._vsSegmentTween = null;
        }
        cursor.remove();
      }
      return;
    }

    const cursor = ensureSegmentCursor(group);
    const groupRect = group.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    const rawX = Math.round(rect.left - groupRect.left);
    const rawY = Math.round(rect.top - groupRect.top);
    const width = Math.max(0, Math.min(Math.round(rect.width), Math.round(groupRect.width)));
    const height = Math.max(0, Math.min(Math.round(rect.height), Math.round(groupRect.height)));
    const vars = {
      x: Math.max(0, Math.min(rawX, Math.max(0, Math.round(groupRect.width) - width))),
      y: Math.max(0, Math.min(rawY, Math.max(0, Math.round(groupRect.height) - height))),
      width,
      height,
      autoAlpha: 1
    };
    const signature = `${buttons.indexOf(active)}:${vars.x}:${vars.y}:${vars.width}:${vars.height}`;
    const previousSignature = cursor.dataset.vsSegmentSignature || "";
    if (!immediate && cursor.dataset.vsSegmentSignature === signature) {
      cursor.style.opacity = "1";
      cursor.style.visibility = "visible";
      return;
    }
    cursor.dataset.vsSegmentSignature = signature;

    if (reduceMotion || !window.gsap || immediate) {
      if (cursor._vsSegmentTween) {
        cursor._vsSegmentTween.kill();
        cursor._vsSegmentTween = null;
      }
      group.style.setProperty("--meow-segment-x", `${vars.x}px`);
      group.style.setProperty("--meow-segment-y", `${vars.y}px`);
      group.style.setProperty("--meow-segment-width", `${vars.width}px`);
      group.style.setProperty("--meow-segment-height", `${vars.height}px`);
      group.dataset.meowSegmentReady = "true";
      Object.assign(cursor.style, {
        width: `${vars.width}px`,
        height: `${vars.height}px`,
        opacity: "1",
        visibility: "visible",
        transform: `translate3d(${vars.x}px, ${vars.y}px, 0)`
      });
      return;
    }

    if (cursor._vsSegmentTween) cursor._vsSegmentTween.kill();
    group.style.setProperty("--meow-segment-x", `${vars.x}px`);
    group.style.setProperty("--meow-segment-y", `${vars.y}px`);
    group.style.setProperty("--meow-segment-width", `${vars.width}px`);
    group.style.setProperty("--meow-segment-height", `${vars.height}px`);
    group.dataset.meowSegmentReady = "true";
    Object.assign(cursor.style, {
      opacity: "1",
      visibility: "visible"
    });
    if (!previousSignature) {
      window.gsap.set(cursor, {
        x: vars.x,
        y: vars.y,
        width: vars.width,
        height: vars.height,
        autoAlpha: 1
      });
      return;
    }
    cursor._vsSegmentTween = window.gsap.to(cursor, {
      x: vars.x,
      y: vars.y,
      width: vars.width,
      height: vars.height,
      autoAlpha: 1,
      duration: 0.24,
      ease: "power3.out",
      overwrite: "auto"
    });
  }

  const segmentedControlSelectors = [
    "[data-r2-workspace-slot-picker]",
    "[data-studio-inspector-panel-tabs]",
    "[data-studio-project-list] [role='tablist']",
    "[data-r15-workflow-side-tabs]",
    "[data-studio-management-toolbar]",
    "[data-r3-conversation-agent-tabs]"
  ];

  function syncSegmentCursors(immediate = false) {
    document.querySelectorAll(segmentedControlSelectors.join(",")).forEach((group) => {
      if (group.classList.contains("vs-segmented-control")) moveSegmentCursor(group, immediate);
    });
  }

  function scheduleSegmentCursorSync(group = null) {
    const key = group || root;
    if (key._vsSegmentSchedulePending) return;
    key._vsSegmentSchedulePending = true;
    const run = () => {
      key._vsSegmentSchedulePending = false;
      if (group && document.documentElement.contains(group)) {
        moveSegmentCursor(group);
      } else {
        syncSegmentCursors();
      }
    };
    window.requestAnimationFrame(run);
    window.setTimeout(() => {
      if (group && document.documentElement.contains(group)) moveSegmentCursor(group);
    }, 120);
    window.setTimeout(() => {
      if (group && document.documentElement.contains(group)) moveSegmentCursor(group);
    }, 280);
    window.setTimeout(() => {
      if (group && document.documentElement.contains(group)) moveSegmentCursor(group);
    }, 420);
  }

  function getSegmentButtonFromEvent(group, target) {
    const button = target?.closest?.("button, [role='button'], [role='tab']");
    if (!button || button.parentElement !== group) return null;
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return null;
    const rect = button.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return button;
  }

  function previewSegmentButton(group, button) {
    if (!group || !button) return;
    group.querySelectorAll(":scope > [data-vs-segment-preview='true']").forEach((candidate) => {
      if (candidate !== button) delete candidate.dataset.vsSegmentPreview;
    });
    button.dataset.vsSegmentPreview = "true";
    moveSegmentCursor(group, false, button);
    window.setTimeout(() => {
      if (!button.isConnected || button.parentElement !== group) return;
      delete button.dataset.vsSegmentPreview;
      moveSegmentCursor(group);
    }, 360);
  }

  function getActiveSegmentSwitchState(route) {
    const groups = [...document.querySelectorAll([
      "[data-studio-inspector-panel-tabs]",
      "[data-studio-project-list] [role='tablist']"
    ].join(","))]
      .filter((group) => group.classList.contains("vs-segmented-control") && isMotionVisible(group));
    const states = [];
    groups.forEach((group) => {
      const buttons = getVisibleSegmentButtons(group);
      const active = buttons.find(isSegmentActive);
      if (!active) return;
      const groupKey = segmentedControlSelectors.find((selector) => group.matches(selector)) ||
        group.getAttribute("data-vs-segment-key") ||
        group.getAttribute("data-studio-inspector-panel-tabs") ||
        group.getAttribute("role") ||
        "segment";
      const key = active.getAttribute("value") ||
        active.getAttribute("data-studio-inspector-panel-tab") ||
        active.getAttribute("data-studio-project-bucket") ||
        active.getAttribute("data-r15-workflow-side-tab") ||
        active.getAttribute("data-r2-workspace-slot") ||
        active.getAttribute("data-r3-conversation-agent") ||
        textOf(active);
      states.push({
        groupKey,
        route,
        key,
        index: buttons.indexOf(active)
      });
    });
    if (states.length) {
      const last = states[states.length - 1];
      return {
        signature: `${route}:segment:${states.map((state) => `${state.groupKey}:${state.key}`).join("|")}`,
        group: "studio-side-segments",
        route,
        index: last.index,
        key: last.key
      };
    }
    return null;
  }

  function isStudioSegmentControl(group) {
    return Boolean(group?.matches?.("[data-studio-inspector-panel-tabs], [data-studio-project-list] [role='tablist']"));
  }

  function isStudioSideSegmentButton(button) {
    return Boolean(button?.closest?.("[data-studio-inspector-panel-tabs], [data-studio-project-list] [role='tablist']"));
  }

  function closeStudioSideCardActionMenus() {
    document
      .querySelectorAll("[data-studio-inspector][data-studio-inspector-layout='side'] .vs-card-actions-collapsed")
      .forEach((card) => {
        card.dataset.vsActionsOpen = "false";
        card.querySelector(":scope > .vs-card-action-trigger")?.setAttribute("aria-expanded", "false");
      });
  }

  function scrubStudioSideActionGhosts() {
    document
      .querySelectorAll("[data-studio-inspector][data-studio-inspector-layout='side'] .vs-card-action-bar")
      .forEach((bar) => {
        if (window.gsap) window.gsap.killTweensOf(bar);
        bar.style.removeProperty("opacity");
        bar.style.removeProperty("visibility");
        bar.style.removeProperty("pointer-events");
        bar.style.removeProperty("transform");
        bar.style.removeProperty("will-change");
      });
  }

  function suppressStudioSideCardActionsForSwitch() {
    // Root-cause cleanup for studio side-panel segment switching: close any open
    // card action menu (real collapsed state) and kill transient tweens / clear
    // leftover inline motion residue. We must NOT hide tabpanels or action bars
    // via opacity/visibility/pointer-events — the active panel stays real and
    // measurable, and studio-side segments no longer create reveal overlays.
    closeStudioSideCardActionMenus();
    scrubStudioSideActionGhosts();
  }

  function isSegmentControlElement(el) {
    return Boolean(el?.closest?.("[data-r2-workspace-slot-picker], .vs-segmented-control"));
  }

  function clearSegmentButtonMotion(group) {
    const buttons = group.querySelectorAll(":scope > button, :scope > [role='button'], :scope > [role='tab']");
    if (window.gsap) window.gsap.killTweensOf(buttons);
    buttons.forEach((button) => {
      button.style.removeProperty("transform");
      button.style.removeProperty("translate");
      button.style.removeProperty("rotate");
      button.style.removeProperty("scale");
      button.style.removeProperty("will-change");
    });
  }

  function decorateSegmentedControls() {
    const groups = document.querySelectorAll(segmentedControlSelectors.join(","));

    groups.forEach((group) => {
      group.classList.add("vs-segmented-control");
      clearSegmentButtonMotion(group);
      if (group.dataset.vsSegmentReady !== "true") {
        moveSegmentCursor(group, true);
      } else {
        scheduleSegmentCursorSync(group);
      }
      group.dataset.vsSegmentReady = "true";
      if (group.dataset.vsSegmentBound === "true") return;
      group.dataset.vsSegmentBound = "true";
      const sync = () => scheduleSegmentCursorSync(group);
      group.addEventListener("pointerdown", (event) => {
        if (isStudioSegmentControl(group)) suppressStudioSideCardActionsForSwitch();
        previewSegmentButton(group, getSegmentButtonFromEvent(group, event.target));
      }, true);
      group.addEventListener("click", (event) => {
        if (isStudioSegmentControl(group)) suppressStudioSideCardActionsForSwitch();
        previewSegmentButton(group, getSegmentButtonFromEvent(group, event.target));
        sync(event);
      });
      group.addEventListener("pointerup", (event) => {
        if (isStudioSegmentControl(group)) suppressStudioSideCardActionsForSwitch();
        sync(event);
      });
      group.addEventListener("focusin", sync);
      group.addEventListener("keyup", sync);
    });
  }

  function bindStudioGhostSuppressionCapture() {
    if (root.dataset.vsStudioGhostCaptureBound === "true") return;
    root.dataset.vsStudioGhostCaptureBound = "true";
    const run = (event) => {
      if (!isStudioSideSegmentButton(event.target)) return;
      suppressStudioSideCardActionsForSwitch();
    };
    document.addEventListener("pointerdown", run, true);
    document.addEventListener("mousedown", run, true);
    document.addEventListener("click", run, true);
    document.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      run(event);
    }, true);
  }

  function isWorkspacePaneMotionTrigger(target) {
    return Boolean(target?.closest?.([
      "[data-r2-workspace-slot-picker]",
      "[data-r2-workspace-slot-button]",
      "[data-r2-workspace-pane-hide]",
      "[data-r2-workspace-pane-maximize]",
      "[data-r2-workspace-pane-close]",
      "[data-r2-workspace-pane-close-confirm]",
      "[data-r2-workspace-configure-pane]",
      "[data-r2-workspace-config-tool]",
      "[data-r2-workspace-pane-drag]"
    ].join(",")));
  }

  function scheduleWorkspacePaneReflow(direction = 1) {
    const firstRects = new Map(workspacePaneRects);
    workspacePaneRects.clear();
    if (!firstRects.size) return;

    workspacePaneReflowToken += 1;
    const token = workspacePaneReflowToken;
    const run = { played: false };
    const tryAnimate = () => {
      if (token !== workspacePaneReflowToken || run.played) return;
      animateWorkspacePaneReflow(direction, firstRects, run);
    };
    window.requestAnimationFrame(tryAnimate);
    window.setTimeout(tryAnimate, 70);
    window.setTimeout(tryAnimate, 160);
  }

  function bindWorkspacePaneMotionControls() {
    if (root.dataset.vsWorkspacePaneMotionBound === "true") return;
    root.dataset.vsWorkspacePaneMotionBound = "true";
    let captured = false;
    const capture = (event) => {
      if (!isWorkspacePaneMotionTrigger(event.target)) return;
      captureWorkspacePaneRects();
      captured = true;
    };
    const release = (event) => {
      if (!captured || !isWorkspacePaneMotionTrigger(event.target)) return;
      captured = false;
      scheduleWorkspacePaneReflow(1);
    };
    document.addEventListener("pointerdown", capture, true);
    document.addEventListener("keydown", (event) => {
      if (!["Enter", " ", "Delete", "Backspace", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      capture(event);
    }, true);
    document.addEventListener("click", release, true);
    document.addEventListener("keyup", release, true);
  }

  function getWorkflowSideState(shell) {
    if (!shell) return null;
    const computed = getComputedStyle(shell);
    const side = shell.querySelector("[data-r15-workflow-sidebar][data-workspace-right-sidebar-owner]");
    const sideRect = side?.getBoundingClientRect();
    const widthVar = Number.parseFloat(computed.getPropertyValue("--vs-workflow-side-width"));
    return {
      collapsed: shell.dataset.vsWorkflowSideCollapsed === "true" || side?.getAttribute("data-workspace-right-sidebar-collapsed") === "true",
      width: Number.isFinite(widthVar) && widthVar >= 0 ? widthVar : Math.max(0, sideRect?.width || 340),
      gap: Number.parseFloat(computed.columnGap) || Number.parseFloat(computed.gap) || 0
    };
  }

  function animateWorkflowSideReflow(shell, snapshot) {
    if (!shell || !snapshot || reduceMotion || !window.gsap) return;
    const side = shell.querySelector("[data-r15-workflow-sidebar][data-workspace-right-sidebar-owner]");
    const collapsed = shell.dataset.vsWorkflowSideCollapsed === "true" || side?.getAttribute("data-workspace-right-sidebar-collapsed") === "true" || shell.classList.contains("is-sidebar-collapsed");
    const toWidth = collapsed ? 0 : 340;
    const toGap = collapsed ? 0 : 12;
    const fromWidth = snapshot.width;
    const fromGap = snapshot.gap;
    if (Math.abs(fromWidth - toWidth) < 1 && Math.abs(fromGap - toGap) < 1) return;
    window.gsap.killTweensOf(shell);
    window.gsap.set(shell, {
      "--vs-workflow-side-width": `${fromWidth}px`,
      "--vs-workflow-side-gap": `${fromGap}px`,
      willChange: "grid-template-columns"
    });
    window.gsap.to(shell, {
      "--vs-workflow-side-width": `${toWidth}px`,
      "--vs-workflow-side-gap": `${toGap}px`,
      duration: sidePanelMotionFamily.reflow.duration,
      ease: sidePanelMotionFamily.reflow.ease,
      overwrite: "auto",
      onComplete: () => {
        shell.style.removeProperty("--vs-workflow-side-width");
        shell.style.removeProperty("--vs-workflow-side-gap");
        shell.style.removeProperty("will-change");
      }
    });
  }

  function toggleWorkflowSideCollapsed(shell, nextCollapsed) {
    if (!shell) return;
    const snapshot = getWorkflowSideState(shell);
    workflowSideReflowToken += 1;
    const token = workflowSideReflowToken;
    shell.dataset.vsWorkflowSideCollapsed = nextCollapsed ? "true" : "false";
    shell.classList.toggle("is-sidebar-collapsed", nextCollapsed);
    requestAnimationFrame(() => {
      if (token !== workflowSideReflowToken) return;
      animateWorkflowSideReflow(shell, snapshot);
      requestAnimationFrame(refresh);
    });
  }

  function bindStudioSideMotionControls() {
    if (root.dataset.vsStudioSideMotionBound === "true") return;
    root.dataset.vsStudioSideMotionBound = "true";
  }

  function decorateTopActionIconButtons() {
    document.querySelectorAll(topActionIconSelectors.join(",")).forEach((button) => {
      const icon = button.querySelector("svg, img");
      const label = textOf(button) || visibleTextOf(button);
      if (label) {
        button.setAttribute("aria-label", label);
      }
      if (!icon && /收起|折叠|展开/.test(label)) {
        button.dataset.vsCollapseActionIcon = /展开/.test(label) ? "expand" : "collapse";
      } else {
        delete button.dataset.vsCollapseActionIcon;
      }
      button.removeAttribute("title");
      if (icon || button.dataset.vsCollapseActionIcon) {
        removeVisibleTextNodes(button);
        if (icon) removeEmptyDecorChildren(button, icon);
      }
      button.dataset.vsTopActionIcon = "true";
      if (requiresActionHint(button)) {
        button.dataset.vsForceHint = "true";
      } else if (isObviousHintControl(button)) {
        delete button.dataset.vsForceHint;
        clearHint(button);
      } else {
        button.dataset.vsForceHint = "true";
      }
      button.classList.remove("vs-text-icon-link");
      button.classList.add("vs-top-action-icon");
      // 2026-06-13 top-bar unification: one-shot action buttons join the shared
      // entry-glow family so every top-bar icon button is 38x38 + blue glow.
      // .vs-top-action-icon is kept only for layout order + collapse-chevron glyph.
      button.classList.add("vs-entry-glow-button");
    });
  }

  function decorateTopChrome() {
    const nav = document.querySelector("[data-top-nav]");
    if (!nav) return;
    const title = getVisibleTopTitleContainer(nav);

    if (!title) return;
    const titleNode = getTopTitleNode(title);
    if (!titleNode) return;
    const text = getRouteTitleText(getCurrentRoute(), titleNode);
    if (titleNode.dataset.vsTitleHoverBound !== "true") {
      titleNode.dataset.vsTitleHoverBound = "true";
      titleNode.addEventListener("pointerenter", () => titleNode.classList.add("vs-title-is-hovered"));
      titleNode.addEventListener("pointerleave", () => titleNode.classList.remove("vs-title-is-hovered"));
      titleNode.addEventListener("mouseenter", () => titleNode.classList.add("vs-title-is-hovered"));
      titleNode.addEventListener("mouseleave", () => titleNode.classList.remove("vs-title-is-hovered"));
      titleNode.addEventListener("focusin", () => titleNode.classList.add("vs-title-is-hovered"));
      titleNode.addEventListener("focusout", () => titleNode.classList.remove("vs-title-is-hovered"));
    }
    if (!text) return;
    if (titleNode.dataset.vsTitleEnergy === "true") {
      if (titleNode.dataset.text !== text) {
        titleNode.dataset.text = text;
        titleNode.setAttribute("aria-label", text);
        titleNode.querySelector(".vs-title-base")?.replaceChildren(document.createTextNode(text));
        const hover = titleNode.querySelector(".hover-text");
        if (hover) {
          hover.dataset.text = text;
          hover.textContent = "";
        }
        if (!titleNode.querySelector(".vs-title-scan-bar")) {
          const scanBar = document.createElement("span");
          scanBar.className = "vs-title-scan-bar";
          scanBar.setAttribute("aria-hidden", "true");
          titleNode.append(scanBar);
        }
      }
      return;
    }
    titleNode.textContent = "";
    titleNode.dataset.vsTitleEnergy = "true";
    titleNode.dataset.text = text;
    titleNode.setAttribute("aria-label", text);
    titleNode.classList.add("vs-energy-title");
    const base = document.createElement("span");
    base.className = "vs-title-base";
    base.textContent = text;
    const hover = document.createElement("span");
    hover.className = "hover-text";
    hover.dataset.text = text;
    hover.textContent = "";
    hover.setAttribute("aria-hidden", "true");
    const scanBar = document.createElement("span");
    scanBar.className = "vs-title-scan-bar";
    scanBar.setAttribute("aria-hidden", "true");
    titleNode.append(base, hover, scanBar);
  }

  function getTitleScanMetrics(titleNode) {
    const computed = window.getComputedStyle(titleNode);
    const titleWidth = titleNode.getBoundingClientRect().width || 1;
    const scanGap = Number.parseFloat(computed.getPropertyValue("--scan-gap")) || 8;
    const barWidth = Number.parseFloat(computed.getPropertyValue("--border-right")) || 6;
    return {
      homeLeft: -(scanGap + barWidth),
      farLeft: titleWidth + scanGap,
      hiddenClip: "inset(0 100% 0 0)",
      revealedClip: "inset(0 0 0 0)"
    };
  }

  function playRouteTitleScan(titleNode) {
    if (!titleNode) return;
    window.clearTimeout(titleNode._vsTitleRouteScanTimer);
    if (titleNode._vsTitleRouteScanTween) {
      titleNode._vsTitleRouteScanTween.kill();
      titleNode._vsTitleRouteScanTween = null;
    }
    const hover = titleNode.querySelector(".hover-text");
    const scanBar = titleNode.querySelector(".vs-title-scan-bar");
    if (!hover || !scanBar || !window.gsap) return;
    const scan = getTitleScanMetrics(titleNode);
    const revealDuration = 0.62;
    const returnAt = 0.9;
    const returnDuration = 0.42;
    titleNode.classList.remove("vs-title-route-scan");
    titleNode.classList.add("vs-title-route-scan");
    window.gsap.killTweensOf([hover, scanBar]);
    const scanDriver = { progress: 0 };
    const renderScan = () => {
      const progress = clampNumber(scanDriver.progress, 0, 1);
      const hiddenPercent = Math.max(0, 100 - (progress * 100));
      const scanLeft = scan.homeLeft + ((scan.farLeft - scan.homeLeft) * progress);
      hover.style.clipPath = `inset(0 ${hiddenPercent}% 0 0)`;
      hover.style.opacity = "1";
      scanBar.style.left = `${scanLeft}px`;
      scanBar.style.opacity = "0.96";
    };
    const tl = window.gsap.timeline({
      defaults: { overwrite: "auto" },
      onComplete: () => {
        window.gsap.set(hover, {
          clipPath: scan.hiddenClip,
          filter: "none",
          textShadow: "none",
          opacity: 1
        });
        window.gsap.set(scanBar, {
          left: scan.homeLeft,
          opacity: 0.95,
          boxShadow: "0 0 12px rgba(55, 255, 139, 0.72)"
        });
        window.requestAnimationFrame(() => {
          titleNode.classList.remove("vs-title-route-scan");
          window.requestAnimationFrame(() => {
          if (!titleNode.isConnected) return;
          window.gsap.set(hover, {
            clearProps: "width,clipPath,filter,textShadow,opacity,visibility"
          });
          window.gsap.set(scanBar, {
            clearProps: "left,opacity,boxShadow"
          });
        });
      });
        titleNode._vsTitleRouteScanTween = null;
      }
    });
    tl.set(hover, {
      width: "100%",
      clipPath: scan.hiddenClip,
      opacity: 1,
      filter: "none",
      textShadow: "0 0 7px rgba(55, 255, 139, 0.72), 0 0 16px rgba(55, 255, 139, 0.38)"
    }, 0)
      .set(scanBar, {
        left: scan.homeLeft,
        opacity: 0.96
      }, 0);
    tl.call(renderScan, null, 0)
      .to(scanDriver, {
        progress: 1,
        duration: revealDuration,
        ease: "power2.inOut",
        onUpdate: renderScan,
        onComplete: renderScan
      }, 0)
      .to(scanBar, {
        duration: revealDuration,
        ease: "power2.inOut",
        boxShadow: "0 0 10px rgba(55, 255, 139, 0.82), 0 0 23px rgba(55, 255, 139, 0.62)"
      }, 0)
      .to(scanDriver, {
        progress: 0,
        duration: returnDuration,
        ease: "power2.inOut",
        onUpdate: renderScan,
        onComplete: renderScan
      }, returnAt)
      .to(scanBar, {
        duration: returnDuration,
        ease: "power2.inOut",
        boxShadow: "0 0 12px rgba(55, 255, 139, 0.72)"
      }, returnAt)
      .to(hover, {
        opacity: 0,
        duration: 0.12,
        ease: "power1.out"
      }, returnAt + returnDuration);
    titleNode._vsTitleRouteScanTween = tl;
  }

  function scheduleTitleTagMagnetRetry() {
    window.clearTimeout(titleTagMagnetRetryTimer);
    titleTagMagnetRetryTimer = window.setTimeout(() => {
      titleTagMagnetRetryTimer = 0;
      animateTitleTagMagnet();
    }, 90);
  }

  function animateTitleTagMagnet() {
    const titleNode = getVisibleTopTitleContainer()?.querySelector?.(".vs-energy-title") || document.querySelector("[data-top-nav-title] .vs-energy-title");
    const rail = document.querySelector("[data-vs-top-surface-rail]");
    const text = titleNode?.dataset?.text || "";
    const route = getCurrentRoute();
    if (!titleNode || !text) return;
    const titleWidth = readTitleVisualWidth(titleNode);
    const titleRight = readTitleVisualRight(titleNode);
    const railLayoutLeft = readRailLayoutLeft(rail);
    const previous = topTitleMotionState;
    const nextState = {
      text,
      route,
      railLeft: railLayoutLeft,
      titleRight,
      titleWidth
    };
    const titleChanged = previous.text && (previous.text !== text || previous.route !== route);
    if (titleChanged && (!rail || railLayoutLeft == null)) {
      pendingTitleTagMotion = {
        previous,
        nextText: text,
        nextRoute: route,
        nextTitleWidth: titleWidth,
        nextTitleRight: titleRight
      };
      topTitleMotionState = nextState;
      scheduleTitleTagMagnetRetry();
      if (!reduceMotion && window.gsap) playRouteTitleScan(titleNode);
      return;
    }
    let motionPrevious = previous;
    if (!titleChanged && pendingTitleTagMotion && pendingTitleTagMotion.nextText === text && pendingTitleTagMotion.nextRoute === route) {
      motionPrevious = pendingTitleTagMotion.previous;
      if (!rail || railLayoutLeft == null) {
        topTitleMotionState = nextState;
        scheduleTitleTagMagnetRetry();
        return;
      }
    }
    pendingTitleTagMotion = null;
    topTitleMotionState = nextState;

    if (!motionPrevious.text) return;
    if (motionPrevious.text === text && motionPrevious.route === route) return;
    if (reduceMotion || !window.gsap) return;

    if (!rail || nextState.railLeft == null) {
      playRouteTitleScan(titleNode);
      return;
    }
    const widthShift = (nextState.titleWidth || 0) - (motionPrevious.titleWidth || 0);
    const titleRightShift = motionPrevious.titleRight == null || nextState.titleRight == null
      ? 0
      : nextState.titleRight - motionPrevious.titleRight;
    if (motionPrevious.railLeft == null && widthShift <= 4 && titleRightShift <= 4) {
      playRouteTitleScan(titleNode);
      return;
    }
    const measuredRailShift = motionPrevious.railLeft == null
      ? 0
      : nextState.railLeft - motionPrevious.railLeft;
    const layoutPushShift = Math.max(measuredRailShift, widthShift, titleRightShift);
    const shouldPushFromTitleGrowth = widthShift > 4 || titleRightShift > 4;
    const railShift = measuredRailShift > 4 || layoutPushShift <= 4
      ? measuredRailShift
      : layoutPushShift;
    const shiftDistance = Math.max(Math.abs(measuredRailShift), Math.abs(widthShift), Math.abs(titleRightShift));
    const startOffset = Number.isFinite(measuredRailShift)
      ? -measuredRailShift
      : 0;
    if (railShift > 4 || shouldPushFromTitleGrowth) {
      playRouteTitleScan(titleNode);
    }
    if (shiftDistance <= 4) return;
    const startX = clampNumber(startOffset, -140, 140);
    const launchImpulse = shouldPushFromTitleGrowth ? Math.max(railShift, widthShift, titleRightShift) : railShift;
    const launchTravel = clampNumber(Math.max(56, launchImpulse * 1.72), 56, 128);
    const gravityLift = -clampNumber(Math.max(2.5, shiftDistance * 0.055), 2.5, 6);
    const landingOvershoot = -clampNumber(Math.max(6, shiftDistance * 0.16), 6, 12);
    const landingRebound = clampNumber(Math.max(2.5, shiftDistance * 0.07), 2.5, 5.5);
    const landingSquashY = clampNumber(Math.max(1.8, shiftDistance * 0.035), 1.8, 3.8);
    const landingLiftY = -clampNumber(Math.max(0.8, shiftDistance * 0.016), 0.8, 1.8);
    window.gsap.killTweensOf(rail);
    window.gsap.set(rail, {
      x: startX,
      y: 0,
      willChange: "transform",
      overwrite: true
    });
    const tl = window.gsap.timeline({
      defaults: { overwrite: "auto" },
      onComplete: () => {
        rail.style.removeProperty("transform");
        rail.style.removeProperty("will-change");
      }
    });
    if (shouldPushFromTitleGrowth) {
      tl.to(rail, {
        x: launchTravel,
        y: gravityLift,
        duration: 0.68,
        ease: "power2.out"
      }, 0.05)
        .to(rail, {
          x: launchTravel,
          y: gravityLift,
          duration: 0.12,
          ease: "none"
        }, ">");
    }
    tl.to(rail, {
      x: landingOvershoot,
      y: landingSquashY,
      duration: shouldPushFromTitleGrowth ? 0.46 : 0.5,
      ease: "power2.in"
    }, shouldPushFromTitleGrowth ? 0.82 : 0.1)
      .to(rail, {
        x: landingRebound,
        y: landingLiftY,
        duration: 0.16,
        ease: "power2.out"
      }, ">")
      .to(rail, {
        x: 0,
        y: 0,
        duration: 0.18,
        ease: "power2.out"
      }, ">");
  }

  function getTopTitleNode(title) {
    const titleSelector = "h1, h2, h3, strong, b";
    const heading = [...title.querySelectorAll(titleSelector)]
      .find((el) => visibleTextOf(el) && !el.closest("button, a, [role='button']"));
    if (heading) return heading;

    const element = [...title.children].find((child) => {
      if (child.matches("button, a, [role='button'], svg, img")) return false;
      if (child.querySelector("button, a, [role='button']")) return false;
      return Boolean(visibleTextOf(child));
    });
    if (element) return element;

    const textNode = [...title.childNodes].find((node) => (
      node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim()
    ));
    if (!textNode) return null;
    const span = document.createElement("span");
    span.textContent = textNode.textContent.trim();
    textNode.replaceWith(span);
    return span;
  }

  function isVisibleTopTitleContainer(candidate) {
    if (!candidate) return false;
      if (candidate.closest("[data-route-keepalive-active='false']")) return false;
      const rect = candidate.getBoundingClientRect();
      const style = window.getComputedStyle(candidate);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function getOrCreateGeneratedTopTitle(nav) {
    if (!nav) return null;
    let generated = nav.querySelector("[data-vs-generated-title]");
    if (!generated) {
      generated = document.createElement("div");
      generated.className = "vs-generated-top-title";
      generated.dataset.topNavTitle = "true";
      generated.dataset.vsGeneratedTitle = "true";
      nav.prepend(generated);
    }
    const text = getRouteTitleText(getCurrentRoute());
    if (text && generated.dataset.vsGeneratedRouteText !== text && generated.dataset.vsTitleEnergy !== "true") {
      generated.textContent = text;
      generated.dataset.vsGeneratedRouteText = text;
    }
    return generated;
  }

  function getVisibleTopTitleContainer(nav = document.querySelector("[data-top-nav]")) {
    const candidates = [...document.querySelectorAll("[data-top-nav-title]")]
      .filter((candidate) => candidate.dataset.vsGeneratedTitle !== "true");
    const visible = candidates.find(isVisibleTopTitleContainer);
    if (visible) {
      nav?.querySelector?.("[data-vs-generated-title]")?.remove();
      return visible;
    }
    return getOrCreateGeneratedTopTitle(nav) || candidates[0] || null;
  }

  function cleanupTopActionCounters() {
    document.querySelectorAll("[data-r3-conversations-top-actions]").forEach((group) => {
      [...group.children].forEach((child) => {
        if (child.matches("button, a, [role='button']")) return;
        if (/^\d+\s*条$/.test(visibleTextOf(child))) {
          child.classList.add("vs-top-count-hidden");
          child.setAttribute("aria-hidden", "true");
        }
      });
    });
  }

  function isTitleSubcopyCandidate(el) {
    if (!el || !visibleTextOf(el)) return false;
    if (el.matches("h1, h2, h3, h4, h5, h6, strong, b, button, a, input, select, textarea, [role='button']")) return false;
    if (el.closest("[data-r15-workflow-node], [data-r15-task-card], [data-r2-conversation-item], [data-r3-conversation-message], [data-r1-plugin-select], [data-plugin-readiness-item], [data-studio-runtime-boundary-item], [data-studio-sidebar-runtime-item], .vs-object-card")) return false;
    if (el.querySelector("button, a, input, select, textarea, [role='button']")) return false;
    if (el.matches("[class*='badge'], [class*='Badge']")) return false;
    const text = visibleTextOf(el);
    if (text.length > 96) return false;
    return el.matches("p, small, span, div");
  }

  function hasDirectTitle(container) {
    return [...container.children].some((child) => {
      if (child.matches("h1, h2, h3, h4, h5, h6, strong, b")) return true;
      return Boolean(child.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > strong, :scope > b"));
    });
  }

  function hideFollowingSubcopy(titleEl) {
    let node = titleEl.nextElementSibling;
    while (node) {
      if (!isTitleSubcopyCandidate(node)) break;
      node.classList.add("vs-title-subcopy");
      node.setAttribute("aria-hidden", "true");
      node = node.nextElementSibling;
    }
  }

  function simplifyTitleSubcopy() {
    document.querySelectorAll("[data-top-nav-title]").forEach((container) => {
      [...container.children].forEach((child, index) => {
        if (index > 0 && isTitleSubcopyCandidate(child)) {
          child.classList.add("vs-title-subcopy");
          child.setAttribute("aria-hidden", "true");
        }
      });
    });

    const roots = document.querySelectorAll("[data-top-nav], [data-open-surface-registry]");
    roots.forEach((rootEl) => {
      rootEl.querySelectorAll("h1, h2, h3, h4, h5, h6, strong, b").forEach((title) => {
        if (title.closest("[data-r15-workflow-node], [data-r15-task-card], [data-r2-conversation-item], [data-r3-conversation-message], [data-r1-plugin-select], [data-plugin-readiness-item], .vs-object-card")) return;
        hideFollowingSubcopy(title);

        const parent = title.parentElement;
        const grandparent = parent?.parentElement;
        if (parent && grandparent && grandparent !== rootEl) {
          let node = parent.nextElementSibling;
          while (node) {
            if (!isTitleSubcopyCandidate(node)) break;
            node.classList.add("vs-title-subcopy");
            node.setAttribute("aria-hidden", "true");
            node = node.nextElementSibling;
          }
        }
      });

      rootEl.querySelectorAll(".text-muted-foreground, .text-foreground\\/90").forEach((el) => {
        if (el.closest("button, a, [role='button'], [data-r15-workflow-node], [data-r15-task-card], [data-r2-conversation-item], [data-r3-conversation-message], [data-r1-plugin-select], [data-plugin-readiness-item], .vs-object-card")) return;
        if (!el.closest("[data-top-nav], header, [class*='head'], [class*='title']")) return;
        if (!isTitleSubcopyCandidate(el)) return;
        el.classList.add("vs-title-subcopy");
        el.setAttribute("aria-hidden", "true");
      });
    });
  }

  function isTechnicalCopyElement(el) {
    if (!el || el.closest(".vs-meow-hint, .vs-visual-badge, [data-lobby-guide-stage-scene], [data-lobby-guide-meowni-wrap], [data-lobby-guide-meowni]")) return false;
    if (el.matches("script, style, svg, img, canvas, iframe, input, textarea, select, option")) return false;
    if (el.matches("button, a, [role='button'], [role='tab'], [contenteditable='true']")) return false;
    if (el.closest(".vs-card-action-trigger, .vs-card-action-bar, [data-top-nav-title]")) return false;
    if (el.querySelector("button, a, [role='button'], input, textarea, select, iframe, canvas, img, svg")) return false;
    const text = visibleTextOf(el);
    if (!text) return false;
    if (el.closest("[data-r15-task-card]") && /^(待确认|待办|进行中|阻塞|完成|已完成)$/.test(text)) return true;
    if (technicalCopyExactPattern.test(text)) return true;
    if (text.length > 180) return technicalCopyPattern.test(text);
    return technicalCopyPattern.test(text);
  }

  function cleanupTechnicalCopy() {
    document.querySelectorAll(".vs-studio-hidden-count-row").forEach((row) => {
      if (row.querySelector("[data-studio-real-project-count]")) return;
      row.classList.remove("vs-studio-hidden-count-row");
      row.removeAttribute("data-vs-studio-hidden-count-row");
      row.removeAttribute("aria-hidden");
    });
    document.querySelectorAll("[data-studio-real-project-count]").forEach((el) => {
      el.classList.add("vs-technical-copy-hidden");
      el.dataset.vsTechnicalCopyHidden = "true";
      el.setAttribute("aria-hidden", "true");
      const row = el.parentElement;
      if (!row) return;
      row.classList.add("vs-studio-hidden-count-row");
      row.dataset.vsStudioHiddenCountRow = "true";
      row.setAttribute("aria-hidden", "true");
    });

    document.querySelectorAll("[data-vs-technical-copy-hidden='true']").forEach((el) => {
      if (isTechnicalCopyElement(el)) return;
      el.classList.remove("vs-technical-copy-hidden");
      el.removeAttribute("data-vs-technical-copy-hidden");
      el.removeAttribute("aria-hidden");
    });

    const roots = [
      document.querySelector("[data-top-nav]"),
      getActiveRouteRoot(),
      ...document.querySelectorAll("[data-open-surface-registry]")
    ].filter(Boolean);
    const seen = new Set();
    roots.forEach((rootEl) => {
      if (seen.has(rootEl)) return;
      seen.add(rootEl);
      rootEl.querySelectorAll("p, small, span, div, dd, dt, li").forEach((el) => {
        if (!isTechnicalCopyElement(el)) return;
        el.classList.add("vs-technical-copy-hidden");
        el.dataset.vsTechnicalCopyHidden = "true";
        el.setAttribute("aria-hidden", "true");
      });
    });
  }

  function isCardCommandButton(button) {
    if (!button) return false;
    if (
      button.matches(
        [
          "[data-r1-task-edit]",
          "[data-r1-task-delete]",
          "[data-r1-task-status-toggle]",
          "[data-r15-task-action]",
          "[data-r2-workspace-task-action]"
        ].join(",")
      )
    ) {
      return true;
    }
    const attrs = [...button.attributes]
      .map((attr) => `${attr.name}=${attr.value}`)
      .join(" ")
      .toLowerCase();
    if (/(action|edit|delete|close|open|enable|disable|publish|export|save|test|mark|continue|folder|refresh|launch|install|accept|archive|schedule|today|block|start|done|status-toggle)/.test(attrs)) {
      return true;
    }
    return /^(编辑|接收|忽略|删除|开始|完成|继续|阻塞|归档|安排日期|加入今日|切状态|打开|打开目录|目录|保存|发布|测试|启用|标记|生成|去发布|关闭|刷新|Agent 继续制作)$/.test(visibleTextOf(button));
  }

  function isCardActionStructurallyAvailable(button, card) {
    if (!button || !card || isInInactiveKeepalive(button)) return false;
    let node = button;
    while (node && node !== card) {
      if (node.hidden || node.getAttribute?.("aria-hidden") === "true") return false;
      if (getComputedStyle(node).display === "none") return false;
      node = node.parentElement;
    }
    return true;
  }

  function getCardActionButtons(card) {
    return [...card.querySelectorAll("button, a, [role='button']")].filter((button) => {
      if (button === card) return false;
      if (button.closest(".vs-card-action-trigger, .vs-meow-hint, [data-top-nav], [data-next-sidebar-product-shell], .meowdesk-sidebar")) return false;
      if (button.closest("[data-r2-workspace-slot-picker], .vs-segmented-control")) return false;
      if (getTopPageSwitchGroup(button)) return false;
      if (!isCardCommandButton(button)) return false;
      if (!isCardActionStructurallyAvailable(button, card)) return false;
      return true;
    });
  }

  function findCommonActionBar(card, actions) {
    if (actions.length < 1) return null;
    let node = actions[0].parentElement;
    let fallback = null;
    while (node && node !== card) {
      if (actions.every((action) => node.contains(action))) {
        fallback = node;
        if (!node.matches("button, a, [role='button']")) return node;
      }
      node = node.parentElement;
    }
    return fallback;
  }

  function shouldCollapseSingleCardAction(card) {
    if (!card) return false;
    return Boolean(card.closest("[data-studio-inspector][data-studio-inspector-layout='side']"));
  }

  function closeOtherCardActionMenus(currentCard) {
    document.querySelectorAll(".vs-card-actions-collapsed[data-vs-actions-open='true']").forEach((card) => {
      if (card === currentCard) return;
      card.dataset.vsActionsOpen = "false";
      card.querySelector(":scope > .vs-card-action-trigger")?.setAttribute("aria-expanded", "false");
    });
  }

  function ensureCardActionTrigger(card) {
    let trigger = card.querySelector(":scope > .vs-card-action-trigger");
    if (trigger) {
      clearHint(trigger);
      trigger.removeAttribute("title");
      return trigger;
    }
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "vs-card-action-trigger";
    trigger.setAttribute("aria-label", "更多操作");
    trigger.setAttribute("aria-expanded", "false");
    clearHint(trigger);
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = card.dataset.vsActionsOpen === "true";
      closeOtherCardActionMenus(card);
      card.dataset.vsActionsOpen = open ? "false" : "true";
      trigger.setAttribute("aria-expanded", open ? "false" : "true");
    });
    card.appendChild(trigger);
    return trigger;
  }

  function clearCardActionMenu(card) {
    if (!card) return;
    card.classList.remove("vs-card-actions-collapsed");
    delete card.dataset.vsActionsOpen;
    card.querySelector(":scope > .vs-card-action-trigger")?.remove();
    card.querySelectorAll(".vs-card-action-item").forEach((button) => {
      button.classList.remove("vs-card-action-item");
    });
    card.querySelectorAll(".vs-card-action-bar").forEach((bar) => {
      bar.classList.remove("vs-card-action-bar");
      delete bar.dataset.vsCardActionBar;
    });
  }

  function decorateCardActionMenus() {
    if (liveAppMode) {
      // In the real React app, functional controls must keep their native owner.
      // The VS card-action menu is a sandbox-only visual experiment that creates
      // extra DOM and re-parents action bars; in live mode it can steal Studio
      // Agent/Inspector controls and make buttons disappear or clip.
      document.querySelectorAll(".vs-card-actions-collapsed").forEach((card) => clearCardActionMenu(card));
      document.querySelectorAll(".vs-card-action-bar, .vs-card-action-item").forEach((el) => {
        el.classList.remove("vs-card-action-bar", "vs-card-action-item");
        delete el.dataset.vsCardActionBar;
      });
      document.querySelectorAll(".vs-card-action-trigger").forEach((trigger) => trigger.remove());
      return;
    }
    document.querySelectorAll(interactiveCardSelectors.join(",")).forEach((card) => {
      if (!card || card.closest("[data-top-nav], [data-next-sidebar-product-shell], .meowdesk-sidebar")) return;
      if (isAgentWorkSurface(card)) {
        clearCardActionMenu(card);
        return;
      }
      if (!isMotionVisible(card)) return;
      const actions = getCardActionButtons(card);
      const actionBar = findCommonActionBar(card, actions);
      card.querySelectorAll(".vs-card-action-item").forEach((button) => {
        if (actions.includes(button)) return;
        button.classList.remove("vs-card-action-item");
      });
      card.querySelectorAll(".vs-card-action-bar").forEach((bar) => {
        if (bar === actionBar) return;
        bar.classList.remove("vs-card-action-bar");
        delete bar.dataset.vsCardActionBar;
      });
      const collapseSingleAction = actions.length === 1 && shouldCollapseSingleCardAction(card);
      if ((actions.length <= 1 && !collapseSingleAction) || !actionBar || actionBar === card) {
        clearCardActionMenu(card);
        return;
      }

      card.classList.add("vs-card-actions-collapsed");
      if (!card.dataset.vsActionsOpen) card.dataset.vsActionsOpen = "false";
      actions.forEach((button) => {
        button.classList.add("vs-card-action-item");
        button.removeAttribute("title");
      });
      actionBar.classList.add("vs-card-action-bar");
      actionBar.dataset.vsCardActionBar = "true";
      const trigger = ensureCardActionTrigger(card);
      trigger.setAttribute("aria-expanded", card.dataset.vsActionsOpen === "true" ? "true" : "false");
    });
  }

  function bindCardActionMenuEvents() {
    if (liveAppMode) return;
    if (root.dataset.vsCardActionMenusBound === "true") return;
    root.dataset.vsCardActionMenusBound = "true";
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.(".vs-card-actions-collapsed")) return;
      closeOtherCardActionMenus(null);
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeOtherCardActionMenus(null);
    }, true);
  }

  function showHint(target) {
    if (root.classList.contains("vs-resize-hint-suppressed")) return;
    if (target.closest?.(resizeHandleSelector)) return;
    if (!target.dataset.vsHintTitle) return;
    const suppressUntil = Number(target.dataset.vsSuppressHintUntil || 0);
    if (suppressUntil && performance.now() < suppressUntil) return;
    if (target.matches("[data-meow-box-trigger]") && target.getAttribute("aria-expanded") === "true") return;
    activeTarget = target;
    const tip = ensureTooltip();
    const body = target.dataset.vsHintBody || "";
    tip.querySelector(".vs-meow-hint__title").textContent = target.dataset.vsHintTitle;
    tip.querySelector(".vs-meow-hint__body").textContent = body;
    tip.dataset.vsHasBody = body ? "true" : "false";
    placeTooltip(target);
    if (window.gsap) {
      window.gsap.killTweensOf(tip);
      window.gsap.set(tip, { clearProps: "opacity,visibility,transform" });
    }
    requestAnimationFrame(() => {
      if (activeTarget === target) tip.dataset.vsVisible = "true";
    });
  }

  function hideHint(target, immediate = false) {
    if (target && activeTarget !== target) return;
    activeTarget = null;
    const tip = ensureTooltip();
    if (window.gsap) {
      window.gsap.killTweensOf(tip);
      window.gsap.set(tip, { clearProps: "opacity,visibility,transform" });
    }
    tip.dataset.vsVisible = "false";
    if (immediate) {
      tip.style.opacity = "0";
      tip.style.visibility = "hidden";
      tip.style.transform = "translate3d(0, -8px, 0) scale(0.98)";
    }
  }

  function bindHintEvents() {
    document.querySelectorAll("[data-vs-hint-title]").forEach((el) => {
      if (el.dataset.vsHintBound) return;
      el.dataset.vsHintBound = "true";
      el.addEventListener("pointerenter", () => showHint(el));
      el.addEventListener("pointerleave", () => hideHint(el));
      el.addEventListener("mouseenter", () => showHint(el));
      el.addEventListener("mouseleave", () => hideHint(el));
      el.addEventListener("click", () => {
        const topPageSwitch = Boolean(getTopPageSwitchGroup(el));
        if (topPageSwitch) el.dataset.vsSuppressHintUntil = String(performance.now() + 700);
        hideHint(el, topPageSwitch);
      });
      el.addEventListener("focus", () => showHint(el));
      el.addEventListener("blur", () => hideHint(el));
    });
  }

  function bindResizeHintSuppression() {
    if (root.dataset.vsResizeHintSuppressionBound === "true") return;
    root.dataset.vsResizeHintSuppressionBound = "true";
    const release = () => {
      root.classList.remove("vs-resize-hint-suppressed");
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", release, true);
    };
    document.addEventListener("pointerdown", (event) => {
      if (!event.target?.closest?.(resizeHandleSelector)) return;
      root.classList.add("vs-resize-hint-suppressed");
      hideHint(null, true);
      document.addEventListener("pointerup", release, true);
      document.addEventListener("pointercancel", release, true);
      window.addEventListener("blur", release, true);
    }, true);
  }

  function bindResizeInertia() {
    if (reduceMotion || !window.gsap) return;
    document.querySelectorAll(resizeHandleSelector).forEach((handle) => {
      if (handle.dataset.vsResizeInertiaBound === "true") return;
      handle.dataset.vsResizeInertiaBound = "true";
      handle.addEventListener("pointerdown", (event) => {
        const state = {
          lastX: event.clientX,
          lastTime: performance.now(),
          velocity: 0
        };
        resizeInertiaState.set(handle, state);
        const move = (moveEvent) => {
          const now = performance.now();
          const dt = Math.max(16, now - state.lastTime);
          state.velocity = (moveEvent.clientX - state.lastX) / dt;
          state.lastX = moveEvent.clientX;
          state.lastTime = now;
        };
        const release = () => {
          document.removeEventListener("pointermove", move, true);
          document.removeEventListener("pointerup", release, true);
          document.removeEventListener("pointercancel", release, true);
          window.removeEventListener("blur", release, true);
          const current = resizeInertiaState.get(handle);
          resizeInertiaState.delete(handle);
          const kick = clampNumber((current?.velocity || 0) * 80, -3.5, 3.5);
          if (Math.abs(kick) < 0.9) return;
          window.gsap.killTweensOf(handle, "--vs-resize-kick-x");
          window.gsap.fromTo(handle, {
            "--vs-resize-kick-x": `${kick}px`
          }, {
            "--vs-resize-kick-x": "0px",
            duration: 0.34,
            ease: "power3.out",
            overwrite: "auto",
            onComplete: () => handle.style.removeProperty("--vs-resize-kick-x")
          });
        };
        document.addEventListener("pointermove", move, true);
        document.addEventListener("pointerup", release, true);
        document.addEventListener("pointercancel", release, true);
        window.addEventListener("blur", release, true);
      }, true);
    });
  }

  function bindButtonMotion() {
    if (reduceMotion || !window.gsap) return;
    const selector = [
      "button",
      "[data-next-route]",
      "[data-meow-box-launch]",
      "[data-meow-tab]",
      "[data-r1-plugin-select]"
    ].join(",");
    document.querySelectorAll(selector).forEach((el) => {
      if (el.dataset.vsMotionBound) return;
      if (el.matches("[data-r2-workspace-slot-button]") || el.closest("[data-r2-workspace-slot-picker]")) return;
      if (el.matches("[data-vs-top-action-icon='true']")) return;
      if (el.classList.contains("vs-entry-glow-button") || getTopPageSwitchGroup(el)) return;
      el.dataset.vsMotionBound = "true";
      el.addEventListener("pointerenter", () => {
        if (isVisibleTextButton(el) || isSegmentControlElement(el)) return;
        const sidebar = Boolean(el.closest("[data-next-sidebar-product-shell], .meowdesk-sidebar"));
        window.gsap.to(el, { y: sidebar ? -1.5 : -0.75, scale: sidebar ? 1.035 : 1.01, duration: 0.2, ease: "power3.out", overwrite: "auto" });
      });
      el.addEventListener("pointerleave", () => {
        if (isSegmentControlElement(el)) {
          window.gsap.killTweensOf(el);
          el.style.removeProperty("transform");
          return;
        }
        window.gsap.to(el, { y: 0, scale: 1, duration: 0.2, ease: "power3.out", overwrite: "auto" });
      });
      el.addEventListener("pointerdown", () => {
        if (isVisibleTextButton(el) || isSegmentControlElement(el)) return;
        window.gsap.to(el, { y: 0, scale: 0.965, duration: 0.08, ease: "power1.out", overwrite: "auto" });
      });
      el.addEventListener("pointerup", () => {
        if (isVisibleTextButton(el) || isSegmentControlElement(el)) return;
        const sidebar = Boolean(el.closest("[data-next-sidebar-product-shell], .meowdesk-sidebar"));
        window.gsap.to(el, { y: sidebar ? -1.5 : -0.75, scale: sidebar ? 1.035 : 1.01, duration: 0.16, ease: "power3.out", overwrite: "auto" });
      });
    });

    document.querySelectorAll("[data-vs-top-action-icon='true']").forEach((el) => {
      if (el.dataset.vsTopActionMotionBound === "true") return;
      if (!el.closest(iconTextMenuSelectors.join(","))) return;
      el.dataset.vsTopActionMotionBound = "true";
      el.addEventListener("pointerenter", () => {
        window.gsap.to(el, { y: -1, scale: 1.035, duration: 0.18, ease: "power3.out", overwrite: "auto" });
      });
      el.addEventListener("pointerleave", () => {
        window.gsap.to(el, { y: 0, scale: 1, duration: 0.18, ease: "power3.out", clearProps: "transform", overwrite: "auto" });
      });
      el.addEventListener("pointerdown", () => {
        window.gsap.to(el, { y: 0, scale: 0.94, duration: 0.07, ease: "power1.out", overwrite: "auto" });
      });
      el.addEventListener("pointerup", () => {
        window.gsap.to(el, { y: -1, scale: 1.035, duration: 0.14, ease: "power3.out", overwrite: "auto" });
      });
    });
  }

  function bindCardMotion() {
    if (reduceMotion || !window.gsap) return;
    const selector = [
      ".vs-interactive-card",
      ".vs-object-card",
      "[data-r1-plugin-select]",
      "[data-r2-workspace-sidebar-builtin]",
      "[data-r2-workspace-sidebar-manager-widget]",
      "[data-plugin-readiness-item]"
    ].join(",");
    const breathTweenProps = [
      "--vs-card-breath-near",
      "--vs-card-breath-soft",
      "--vs-card-breath-inset",
      "--vs-card-hover-glow-opacity",
      "--vs-card-hover-ring-alpha",
      "--vs-card-hover-near-alpha",
      "--vs-card-hover-soft-alpha",
      "--vs-card-hover-inset-alpha"
    ].join(",");
    const darkBreathVars = {
      "--vs-card-breath-near": 0,
      "--vs-card-breath-soft": 0,
      "--vs-card-breath-inset": 0.006,
      "--vs-card-hover-glow-opacity": 0.1,
      "--vs-card-hover-ring-alpha": 0.035,
      "--vs-card-hover-near-alpha": 0.018,
      "--vs-card-hover-soft-alpha": 0.006,
      "--vs-card-hover-inset-alpha": 0.018
    };
    const brightBreathVars = {
      "--vs-card-breath-near": 0.34,
      "--vs-card-breath-soft": 0.18,
      "--vs-card-breath-inset": 0.16,
      "--vs-card-hover-glow-opacity": 1,
      "--vs-card-hover-ring-alpha": 0.34,
      "--vs-card-hover-near-alpha": 0.3,
      "--vs-card-hover-soft-alpha": 0.14,
      "--vs-card-hover-inset-alpha": 0.16
    };
    const stopBreath = (el) => {
      window.clearTimeout(cardBreathTimers.get(el));
      cardBreathTimers.delete(el);
      cardBreathTimelines.get(el)?.kill();
      cardBreathTimelines.delete(el);
      delete el.dataset.vsCardBreathing;
      window.gsap.killTweensOf(el, breathTweenProps);
      window.gsap.to(el, {
        "--vs-card-breath-near": 0,
        "--vs-card-breath-soft": 0,
        "--vs-card-breath-inset": 0,
        "--vs-card-hover-glow-opacity": 1,
        "--vs-card-hover-ring-alpha": 0.22,
        "--vs-card-hover-near-alpha": 0.199,
        "--vs-card-hover-soft-alpha": 0.069,
        "--vs-card-hover-inset-alpha": 0.085,
        duration: 0.18,
        ease: "power2.out",
        overwrite: "auto",
        onComplete: () => {
          el.style.removeProperty("--vs-card-breath-near");
          el.style.removeProperty("--vs-card-breath-soft");
          el.style.removeProperty("--vs-card-breath-inset");
          el.style.removeProperty("--vs-card-hover-glow-opacity");
          el.style.removeProperty("--vs-card-hover-ring-alpha");
          el.style.removeProperty("--vs-card-hover-near-alpha");
          el.style.removeProperty("--vs-card-hover-soft-alpha");
          el.style.removeProperty("--vs-card-hover-inset-alpha");
        }
      });
    };
    const scheduleBreath = (el) => {
      window.clearTimeout(cardBreathTimers.get(el));
      const timer = window.setTimeout(() => {
        if (!el.matches(":hover") && !el.matches(":focus-within")) return;
        el.dataset.vsCardBreathing = "true";
        cardBreathTimelines.get(el)?.kill();
        window.gsap.killTweensOf(el, breathTweenProps);
        const tl = window.gsap.timeline({
          repeat: -1,
          defaults: { overwrite: "auto" }
        });
        tl.to(el, { ...darkBreathVars, duration: 0.48, ease: "sine.inOut" })
          .to(el, { ...brightBreathVars, duration: 1.32, ease: "sine.inOut" })
          .to(el, { ...darkBreathVars, duration: 1.84, ease: "sine.inOut" })
          .to(el, { ...darkBreathVars, duration: 0.22, ease: "none" });
        cardBreathTimelines.set(el, tl);
      }, 1500);
      cardBreathTimers.set(el, timer);
    };
    document.querySelectorAll(selector).forEach((el) => {
      if (el.dataset.vsCardMotionBound) return;
      el.dataset.vsCardMotionBound = "true";
      el.addEventListener("pointerenter", () => {
        scheduleBreath(el);
        window.gsap.to(el, { y: 0, scale: 0.98, duration: 0.26, ease: "power3.out", overwrite: "auto" });
      });
      el.addEventListener("pointerleave", () => {
        stopBreath(el);
        window.gsap.to(el, { y: 0, scale: 1, duration: 0.22, ease: "power3.out", clearProps: "transform", overwrite: "auto" });
      });
      el.addEventListener("focusin", () => scheduleBreath(el));
      el.addEventListener("focusout", () => stopBreath(el));
      el.addEventListener("pointerdown", () => {
        window.gsap.to(el, { y: 0, scale: 0.975, duration: 0.08, ease: "power1.out", overwrite: "auto" });
      });
      el.addEventListener("pointerup", () => {
        window.gsap.to(el, { y: 0, scale: 0.98, duration: 0.16, ease: "power3.out", overwrite: "auto" });
      });
    });
  }

  function animateMeowBoxMenu() {
    if (reduceMotion || !window.gsap) return;
    const menu = document.querySelector("[data-meow-box-menu]");
    const trigger = document.querySelector("[data-meow-box-trigger]");
    const expanded = trigger?.getAttribute("aria-expanded") === "true";
    if (!menu) {
      meowBoxMenuOpen = false;
      return;
    }
    if (!expanded) return;
    if (meowBoxMenuOpen || menu.dataset.vsMeowBoxAnimated === "true") {
      meowBoxMenuOpen = true;
      return;
    }
    meowBoxMenuOpen = true;
    menu.dataset.vsMeowBoxAnimated = "true";
    animateBoxOrganizerMenu(menu, "[data-meow-box-launch]:not(.vs-meow-box-assigned-hidden)");
  }

  function animateBoxOrganizerMenu(menu, itemSelector = "") {
    if (!menu || reduceMotion || !window.gsap) return;
    const items = itemSelector ? menu.querySelectorAll(itemSelector) : [];
    const tl = window.gsap.timeline({ defaults: { ease: "power3.out", overwrite: "auto" } });
    tl.fromTo(menu, {
      autoAlpha: 0,
      x: -12,
      scale: 0.982
    }, {
      autoAlpha: 1,
      x: 0,
      scale: 1,
      duration: 0.24,
      clearProps: "transform,opacity,visibility"
    });
    if (items.length) {
      tl.fromTo(items, {
        autoAlpha: 0,
        x: -10,
        scale: 0.98
      }, {
        autoAlpha: 1,
        x: 0,
        scale: 1,
        duration: 0.22,
        stagger: 0.035,
        clearProps: "transform,opacity,visibility"
      }, "<0.05");
    }
  }

  function animateRoute() {
    if (!window.gsap) return;
    cleanupInactiveKeepaliveRoutes();
    const active = getActiveRouteRoot();
    const currentRoute = getCurrentRoute();
    const routeKey = currentRoute === "lobby"
      ? "lobby"
      : active?.getAttribute("data-route-keepalive") ||
        active?.getAttribute("data-r2-feature-page-route") ||
        active?.getAttribute("data-open-surface-active") ||
        currentRoute;
    if (!active) return;
    if (routeAnimationSignature === routeKey) {
      active.dataset.vsRouteAnimated = routeKey;
      return;
    }
    if (active.dataset.vsRouteAnimated === routeKey) {
      routeAnimationSignature = routeKey;
      return;
    }
    routeAnimationSignature = routeKey;
    active.dataset.vsRouteAnimated = routeKey;
    const routeHost = active.closest?.("[data-open-surface-registry]");
    if (routeHost && routeHost !== active) {
      window.gsap.killTweensOf(routeHost);
      clearTransientMotionStyles(routeHost);
    }
    const nodes = [
      active,
      ...active.querySelectorAll([
        ".meowdesk-workspace-shell",
        "[data-lobby-route]",
        "[data-r1-plugin-detail]",
        "[data-r2-feature-page-route]",
      ].join(","))
    ];
    window.gsap.killTweensOf(nodes);
    nodes.forEach(clearTransientMotionStyles);
  }

  function clearLobbySectionOpacity(rootEl = getActiveRouteRoot()) {
    if (!rootEl || getCurrentRoute() !== "lobby") return;
    const nodes = [
      rootEl,
      ...rootEl.querySelectorAll([
        "[data-lobby-profile-route]",
        "[data-lobby-guide-route]",
        "[data-lobby-community-route]",
        "[data-lobby-route] > *"
      ].join(","))
    ];
    if (window.gsap) window.gsap.killTweensOf(nodes);
    nodes.forEach((node) => {
      node.style.removeProperty("opacity");
      node.style.removeProperty("visibility");
      node.style.removeProperty("transform");
      node.style.removeProperty("will-change");
    });
  }

  function getInternalSwitchState() {
    const route = getCurrentRoute();
    const groups = [
      ...topPageSwitchGroups,
      { selector: "[data-r2-workspace-slot]", active: '[data-r2-workspace-slot-active="true"]', attr: "data-r2-workspace-slot" }
    ];
    let baseState = null;
    for (const group of groups) {
      const buttons = [...document.querySelectorAll(group.selector)];
      const active = document.querySelector(group.active);
      if (!active) continue;
      const key = active.getAttribute(group.attr) || textOf(active);
      baseState = {
        signature: `${route}:${group.attr}:${key}`,
        group: group.attr,
        route,
        index: buttons.indexOf(active),
        key
      };
      break;
    }
    const segmentState = getActiveSegmentSwitchState(route);
    if (segmentState) {
      return {
        ...segmentState,
        route,
        signature: `${baseState?.signature || route}|${segmentState.signature}`
      };
    }
    if (baseState) return baseState;
    return { signature: "", group: "", route, index: -1, key: "" };
  }

  function getActiveRouteRoot() {
    const route = getCurrentRoute();
    if (route === "workspace") {
      return document.querySelector("[data-route-keepalive='workspace'][data-route-keepalive-active='true']");
    }
    if (route === "studio") {
      return document.querySelector("[data-route-keepalive='studio'][data-route-keepalive-active='true']");
    }
    if (route === "lobby") {
      return document.querySelector("[data-lobby-route]");
    }
    return document.querySelector("[data-r2-feature-page-route]") ||
      document.querySelector("[data-open-surface-registry]");
  }

  function getWorkspacePaneGrid() {
    return document.querySelector("[data-route-keepalive='workspace'][data-route-keepalive-active='true'] [data-r2-workspace-panes]") ||
      document.querySelector("[data-route-keepalive='workspace'][data-route-keepalive-active='true'] .meowdesk-workspace-pane-grid");
  }

  function getWorkspacePanes() {
    const grid = getWorkspacePaneGrid();
    if (!grid) return [];
    return [...grid.querySelectorAll("[data-r2-workspace-pane], .meowdesk-workspace-pane")].filter((pane) => {
      return isMotionVisible(pane);
    });
  }

  function workspacePaneKey(pane, index) {
    return pane.getAttribute("data-r2-workspace-pane") || pane.id || `pane-${index}`;
  }

  function captureWorkspacePaneRects() {
    workspacePaneRects.clear();
    getWorkspacePanes().forEach((pane, index) => {
      const rect = pane.getBoundingClientRect();
      workspacePaneRects.set(workspacePaneKey(pane, index), {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      });
    });
  }

  function animateWorkspacePaneReflow(direction = 1, firstRects = null, run = null) {
    if (reduceMotion || !window.gsap) {
      workspacePaneRects.clear();
      return;
    }
    window.cancelAnimationFrame(workspacePaneFlipRaf);
    const rects = firstRects || new Map(workspacePaneRects);
    if (!firstRects) workspacePaneRects.clear();
    if (!rects.size || run?.played) return;

    workspacePaneFlipRaf = window.requestAnimationFrame(() => {
      const panes = getWorkspacePanes();
      if (!panes.length) return;

      const moving = [];
      let sawUntrackedPane = false;
      panes.forEach((pane, index) => {
        const key = workspacePaneKey(pane, index);
        const first = rects.get(key);
        const last = pane.getBoundingClientRect();
        if (!first) {
          sawUntrackedPane = true;
          window.gsap.killTweensOf(pane);
          clearTransientMotionStyles(pane);
          return;
        }

        const dx = first.left - last.left;
        const rawDy = first.top - last.top;
        const dy = Math.abs(rawDy) < 10 ? 0 : rawDy;
        if (Math.abs(dx) < 0.75 && Math.abs(dy) < 0.75) return;
        moving.push({ pane, dx, dy });
      });

      if (!moving.length) {
        if (run && sawUntrackedPane) run.played = true;
        return;
      }
      if (run) run.played = true;

      moving.forEach(({ pane, dx, dy }) => {
        window.gsap.killTweensOf(pane);
        window.gsap.set(pane, { willChange: "transform", transformOrigin: "top left" });
        window.gsap.fromTo(pane, {
          x: dx,
          y: dy
        }, {
          x: 0,
          y: 0,
          duration: 0.38,
          ease: "power2.out",
          clearProps: "transform,transformOrigin,willChange",
          overwrite: "auto"
        });
      });

    });
  }

  function animateInternalSwitch() {
    const state = getInternalSwitchState();
    internalSwitchSignature = state.signature || "";
    internalSwitchState = state;
    window.clearTimeout(internalSwitchTimer);
    window.cancelAnimationFrame(internalSwitchTimer);
    internalSwitchTimer = 0;
    clearLobbySectionOpacity();
  }

  function getCurrentRoute() {
    const active = document.querySelector('[data-next-route][aria-current="page"]');
    return active?.getAttribute("data-next-route") || location.hash.replace(/^#/, "") || "lobby";
  }

  function addBadge() {
    if (liveAppMode) {
      document.querySelectorAll(".vs-visual-badge").forEach((badge) => badge.remove());
      return;
    }
    if (document.querySelector(".vs-visual-badge")) return;
    const badge = document.createElement("div");
    badge.className = "vs-visual-badge";
    badge.textContent = `VS visual ${vsVisualVersion}`;
    document.body.appendChild(badge);
    if (!reduceMotion && window.gsap) {
      window.gsap.fromTo(badge, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, delay: 0.25, ease: "power2.out" });
    }
  }

  function bootMotion() {
    if (reduceMotion || !window.gsap) return;
    if (liveAppMode) return;
    if (root.dataset.vsBootMotionPlayed) return;
    root.dataset.vsBootMotionPlayed = "true";
    window.gsap.set("[data-next-sidebar-product-shell], [data-top-nav], [data-open-surface-registry]", {
      x: 0,
      y: 0,
      clearProps: "transform"
    });
  }

  let raf = 0;
  let postMutationRefreshTimer = 0;
  function refresh() {
    if (visualRefreshPending) {
      visualRefreshAfterRaf = true;
      return;
    }
    visualRefreshPending = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      visualRefreshPending = false;
      // Disconnect the DOM observer for the duration of this decoration sweep.
      // refresh() rewrites class/aria/dataset/style on many elements every pass;
      // some of those (aria-expanded, data-state, etc.) are observed attributes,
      // so leaving the observer connected makes the sweep re-trigger itself,
      // producing a permanent ~50Hz full-document decoration loop while idle.
      // We discard the self-generated records (takeRecords) before re-observing,
      // so real external mutations after the sweep still drive a fresh refresh.
      if (domObserver) domObserver.disconnect();
      pruneMeowBoxCoreLaunches();
      removeLegacyTitleSidebarToggles();
      applySidebarHiddenBoxItems();
      decorateTopActionIconButtons();
      arrangeStudioTopButtons();
      hydrateHints();
      bindSidebarShell();
      syncSidebarVisualZones();
      renderVsPinnedSidebarBoxItems();
      bindSidebarPinnedBoxDragSources();
      decorateMeowBoxMenu();
      simplifyTitleSubcopy();
      decorateTopChrome();
      bindTopSurfaceHoverGuard();
      bindTopSurfaceDangerArmDelegation();
      bindNativeTopSurfaceHoverDelegation();
      bindNativeTopSurfaceCloseRequests();
      bindClosedSurfaceReopenTriggers();
      renderTopSurfaceTabs();
      animateTitleTagMagnet();
      cleanupTechnicalCopy();
      decorateTaskTagChips();
      decoratePanelHeaders();
      decorateTaskCenterLabels();
      decorateWorkflowSingleSidebar();
      syncTopSidePanelProxies();
      decoratePickerDialogs();
      decorateBlueResidueCleanup();
      decorateWorkspaceSidePanel();
      decorateInteractiveCards();
      decorateCardActionMenus();
      decorateSharedEntryGlowButtons();
      decorateTopIconTextButtons();
      cleanupPageSwitchCursorResidue();
      decorateSegmentedControls();
      bindStudioGhostSuppressionCapture();
      bindWorkspacePaneMotionControls();
      bindResizeHintSuppression();
      bindResizeInertia();
      bindStudioSideMotionControls();
      bindCardActionMenuEvents();
      bindMeowBoxRefresh();
      bindVirtualBoxOutsideClose();
      cleanupTopActionCounters();
      bindHintEvents();
      bindButtonMotion();
      bindCardMotion();
      animateMeowBoxMenu();
      animateRoute();
      animateInternalSwitch();
      addBadge();
      // Re-arm the observer, discarding the records our own sweep just generated
      // so the decoration loop does not re-trigger itself.
      if (domObserver) {
        domObserver.takeRecords();
        domObserver.observe(document.documentElement, domObserverConfig);
      }
      if (visualRefreshAfterRaf) {
        visualRefreshAfterRaf = false;
        window.setTimeout(refresh, 34);
      }
    });
  }

  function schedulePostMutationRefresh() {
    window.clearTimeout(postMutationRefreshTimer);
    postMutationRefreshTimer = window.setTimeout(() => {
      refresh();
    }, 80);
  }

  window.addEventListener("resize", () => {
    if (activeTarget) placeTooltip(activeTarget);
    syncActiveVirtualBoxMenu();
  });

  const observer = new MutationObserver((mutations) => {
    const shouldSyncSegments = mutations.some((mutation) => {
      if (![
        "aria-selected",
        "aria-pressed",
        "data-state",
        "data-r2-workspace-slot-active",
        "data-studio-inspector-panel-tab-active",
        "data-studio-project-bucket-active",
        "data-r3-conversation-agent-active"
      ].includes(mutation.attributeName)) return false;
      const target = mutation.target?.nodeType === 1 ? mutation.target : mutation.target?.parentElement;
      return Boolean(target?.closest?.(segmentedControlSelectors.join(",")));
    });
    refresh();
    schedulePostMutationRefresh();
    if (shouldSyncSegments) scheduleSegmentCursorSync();
  });
  domObserver = observer;
  const domObserverConfig = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "aria-current",
      "aria-selected",
      "aria-pressed",
      "aria-expanded",
      "data-route-keepalive-active",
      "data-open-surface-active",
      "data-studio-page-tab-active",
      "data-studio-inspector-toggle-active",
      "data-r15-task-tab-active",
      "data-r2-workspace-slot-active",
      "data-studio-inspector-panel-tab-active",
      "data-studio-project-bucket-active",
      "data-r3-conversation-agent-active",
      "class",
      "data-state"
    ]
  };
  observer.observe(document.documentElement, domObserverConfig);

  bindTopSurfaceHoverGuard();
  bindTopSurfaceDangerArmDelegation();
  bindNativeTopSurfaceHoverDelegation();
  bindNativeTopSurfaceCloseRequests();
  bindClosedSurfaceReopenTriggers();

  function startVisualRefresh() {
    refresh();
    window.setTimeout(() => {
      refresh();
      bootMotion();
    }, 120);
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", startVisualRefresh);
  } else {
    startVisualRefresh();
  }

  window.setTimeout(refresh, 500);
  window.setTimeout(refresh, 1200);
})();

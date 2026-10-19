import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BookOpen, Bot, CalendarDays, ChevronLeft, ChevronRight, Clock, ClipboardList, Columns3, FolderOpen, GalleryVerticalEnd, Hammer, LayoutDashboard, MessageSquare, Monitor, Moon, PackagePlus, PanelRight, Plus, RefreshCw, RotateCcw, Settings, Sparkles, Store, Sun, Upload, User, Users, X, type LucideIcon } from "lucide-react";
import { AppShell, RouteShell, TopNav, type ShellRoute } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LobbySectionId } from "@/features/lobby/lobby-route";
import {
  readWorkspaceEnabledSidebarWidgetIds,
  sidebarBuiltins,
  writeWorkspaceEnabledSidebarWidgetIds,
  type WorkspaceHiddenPaneSummary
} from "@/features/workspace/workspace-model";
import type { StudioInspectorTab, StudioPage } from "@/features/studio/studio-route";
import { fileUrlFromPath } from "@/lib/file-url";
import { THEME_MODE_STORAGE_KEY, normalizeResolvedThemeMode, type ResolvedThemeMode } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";
import {
  hydrateHomeBackedStorage,
  readHomeBackedStorageCache,
  writeHomeBackedStorageCache,
  type HomeBackedStorageOptions
} from "@/lib/workbench-api";
import { listAgentRuntimes, stopAgentRuntime } from "@/features/agent-runtime/agent-runtime-manager";
import { createOpenSurfaceRegistry } from "@/features/open-surface/open-surface-registry";
import { createRuntimeSurfaceAttachmentSnapshot } from "@/features/open-surface/open-surface-runtime-attachments";
import {
  ProductShellSidebarControls,
  createProductShellProjection,
  productShellRouteKindForRouteId,
  productShellTabPolicyForRouteId,
  type ProductShellBoxInput,
  type ProductShellRouteInput,
  type ProductShellSidebarPlacement,
  type ProductShellSurfaceTab
} from "@/features/product-shell";
import type { AgentRuntimeDescriptor } from "@/lib/identity";
import { useRouteTransition } from "./use-route-transition";
import { useWorkbenchSummary, type WorkbenchExtensionSummary, type WorkbenchSummary } from "./use-workbench-summary";

type BaseRouteId = "lobby" | "workspace" | "studio" | "plugins" | "tasks" | "conversations" | "obsidian" | "profile" | "access";
type FeatureRouteId = `feature:${string}`;
type RouteId = BaseRouteId | FeatureRouteId;
type WorkbenchTheme = ResolvedThemeMode;
type TaskCenterTab = "ai" | "mine" | "calendar" | "week" | "today" | "matrix" | "habits";
type WorkspaceRightSidebarOwner = "workspace";

const LobbyRoute = lazy(() => import("@/features/lobby/lobby-route").then((module) => ({ default: module.LobbyRoute })));
const PluginsRoute = lazy(() => import("@/features/plugins/plugins-route").then((module) => ({ default: module.PluginsRoute })));
const TaskCenterRoute = lazy(() => import("@/features/tasks/task-center-route").then((module) => ({ default: module.TaskCenterRoute })));
const ConversationsRoute = lazy(() => import("@/features/conversations/conversations-route").then((module) => ({ default: module.ConversationsRoute })));
const ObsidianRoute = lazy(() => import("@/features/obsidian/obsidian-route").then((module) => ({ default: module.ObsidianRoute })));
const ProfileRoute = lazy(() => import("@/features/profile/profile-route").then((module) => ({ default: module.ProfileRoute })));
const AccessConfigRoute = lazy(() => import("@/features/readiness/readiness-routes").then((module) => ({ default: module.AccessConfigRoute })));
const WorkspaceRoute = lazy(() => import("@/features/workspace/workspace-route").then((module) => ({ default: module.WorkspaceRoute })));
const StudioRoute = lazy(() => import("@/features/studio/studio-route").then((module) => ({ default: module.StudioRoute })));

const baseRouteIds = new Set<BaseRouteId>(["lobby", "workspace", "studio", "plugins", "tasks", "conversations", "obsidian", "profile", "access"]);
const workspaceSlotCounts = [1, 2, 3, 4, 5, 6];
const workspaceSlotCountStorageKey = "meowdesk.workspace.slotCount.v3";
const enabledFeaturePagesStorageKey = "meowdesk.workspace.enabledFeaturePages.v1";
const productShellSidebarPinsStorageKey = "meowdesk.productShell.sidebarPins.v1";
const productShellBoxesStorageKey = "meowdesk.productShell.boxes.v1";
const productShellSidebarCoreRouteIds = new Set<string>(["lobby", "workspace", "studio"]);

function stringArrayStorageValue(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
}

function topLevelStorageValue<T>(homeKey: string, storageKey: string, fallback: T, validate?: (value: unknown) => T): HomeBackedStorageOptions<T> {
  return { storageKey, homeKey, fieldKey: storageKey, fallback, validate };
}

const enabledFeaturePagesStorage = topLevelStorageValue("workspaceExtensions", enabledFeaturePagesStorageKey, [], stringArrayStorageValue);
const productShellSidebarPinsStorage = topLevelStorageValue("productShell", productShellSidebarPinsStorageKey, [], stringArrayStorageValue);
const productShellBoxesStorage = topLevelStorageValue("productShell", productShellBoxesStorageKey, [], (value) => Array.isArray(value) ? value : []);
const workspaceSlotCountStorage = topLevelStorageValue("workspaceShell", workspaceSlotCountStorageKey, 1, (value) => {
  const number = Number(value);
  return workspaceSlotCounts.includes(number) ? number : 1;
});
const themeModeStorage: HomeBackedStorageOptions<WorkbenchTheme> = {
  storageKey: THEME_MODE_STORAGE_KEY,
  homeKey: "theme",
  fallback: "dark",
  validate: normalizeResolvedThemeMode
};

const routes: Array<ShellRoute<BaseRouteId>> = [
  { id: "lobby", label: "大厅", icon: LayoutDashboard },
  { id: "workspace", label: "工作区", icon: Monitor },
  { id: "studio", label: "工坊", icon: Hammer },
  { id: "tasks", label: "任务中心", icon: ClipboardList },
  { id: "conversations", label: "对话管理", icon: MessageSquare },
  { id: "obsidian", label: "Obsidian", icon: BookOpen }
];

const lobbySections: Array<{ id: LobbySectionId; label: string; icon: LucideIcon }> = [
  { id: "profile", label: "个人主页", icon: User },
  { id: "guide", label: "新手教程", icon: BookOpen },
  { id: "friends", label: "好友", icon: Users },
  { id: "plugins", label: "社区", icon: Store }
];

const taskCenterTabs: Array<{ id: TaskCenterTab; label: string; icon: LucideIcon }> = [
  { id: "ai", label: "AI任务", icon: Sparkles },
  { id: "mine", label: "我的任务", icon: User },
  { id: "calendar", label: "月视图", icon: CalendarDays },
  { id: "week", label: "周视图", icon: CalendarDays },
  { id: "today", label: "日程", icon: Clock },
  { id: "matrix", label: "四象限", icon: Columns3 },
  { id: "habits", label: "每日打卡", icon: RotateCcw }
];

const routeTitles: Record<BaseRouteId, { title: string; subtitle: string }> = {
  lobby: {
    title: "大厅",
    subtitle: "个人主页、新手教程、好友和社区入口"
  },
  studio: {
    title: "工坊",
    subtitle: "Meowdesk 作品制作、草稿和插件发布准备区"
  },
  workspace: {
    title: "工作区",
    subtitle: "多 Agent 少切窗工作环境、优先看板、右侧栏组件和桌宠"
  },
  plugins: {
    title: "社区",
    subtitle: "右侧栏组件、功能页和 Skill 生态入口"
  },
  tasks: {
    title: "任务中心",
    subtitle: "任务状态、日程入口和本地 storage 读写"
  },
  conversations: {
    title: "对话管理",
    subtitle: "本地会话、工作窗镜像和 Agent 历史入口"
  },
  obsidian: {
    title: "Obsidian",
    subtitle: "本地 vault 阅读器和大脑入口"
  },
  profile: {
    title: "资料编辑",
    subtitle: "从 Lobby 个人卡进入的本地资料编辑页"
  },
  access: {
    title: "设置",
    subtitle: "外观、工作窗配置和本地数据目录"
  }
};

function featureRouteId(id: string): FeatureRouteId {
  return `feature:${id}`;
}

function featureIdFromRoute(route: string) {
  return route.startsWith("feature:") ? route.slice("feature:".length) : "";
}

function readEnabledFeaturePageIds() {
  if (typeof window === "undefined") return [];
  return readHomeBackedStorageCache(enabledFeaturePagesStorage);
}

function readProductShellSidebarPinIds() {
  if (typeof window === "undefined") return [];
  return readHomeBackedStorageCache(productShellSidebarPinsStorage)
    .filter((routeId) => routeId && !productShellSidebarCoreRouteIds.has(routeId));
}

function writeProductShellSidebarPinIds(routeIds: string[]) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(productShellSidebarPinsStorage, routeIds);
}

function normalizeProductShellBoxId(id: string) {
  return String(id || "").trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64);
}

function readProductShellBoxes(): ProductShellBoxInput[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = readHomeBackedStorageCache(productShellBoxesStorage);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((box, index) => ({
        id: normalizeProductShellBoxId(String(box?.id || "")),
        title: String(box?.title || `Meow Box ${index + 2}`).trim() || `Meow Box ${index + 2}`,
        itemRouteIds: Array.isArray(box?.itemRouteIds) ? box.itemRouteIds.map(String).filter(Boolean) : []
      }))
      .filter((box) => box.id && box.id !== "default");
  } catch {
    return [];
  }
}

function writeProductShellBoxes(boxes: ProductShellBoxInput[]) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(productShellBoxesStorage, boxes);
}

function productShellSidebarPlacementForRouteId(routeId: string, pinnedRouteIds: Set<string>): ProductShellSidebarPlacement {
  if (productShellSidebarCoreRouteIds.has(routeId)) return "core";
  if (pinnedRouteIds.has(routeId)) return "pinned";
  return "box-only";
}

function readHashRoute(): RouteId {
  if (typeof window === "undefined") return "lobby";
  const hashRoute = window.location.hash.replace(/^#\/?/, "");
  if (hashRoute === "settings" || String(hashRoute).startsWith("settings/")) return "access";
  if (String(hashRoute).startsWith("access/")) return "access";
  if (baseRouteIds.has(hashRoute as BaseRouteId)) return hashRoute as BaseRouteId;
  if (featureIdFromRoute(hashRoute) && readEnabledFeaturePageIds().includes(featureIdFromRoute(hashRoute))) return hashRoute as FeatureRouteId;
  return "lobby";
}

function readThemePreference(): WorkbenchTheme {
  if (typeof window === "undefined") return "dark";
  return readHomeBackedStorageCache(themeModeStorage);
}

function readWorkspaceSlotCount() {
  if (typeof window === "undefined") return 1;
  return readHomeBackedStorageCache(workspaceSlotCountStorage);
}

function clampWorkspaceSlotCount(count: number) {
  return Math.max(1, Math.min(6, Math.round(count)));
}

export function App() {
  const [route, setRoute] = useState<RouteId>(() => readHashRoute());
  const [workspaceRouteMounted, setWorkspaceRouteMounted] = useState(() => route === "workspace");
  const [studioRouteMounted, setStudioRouteMounted] = useState(() => route === "studio");
  const [lobbySection, setLobbySection] = useState<LobbySectionId>("profile");
  const [taskTab, setTaskTab] = useState<TaskCenterTab>("ai");
  const [studioPage, setStudioPage] = useState<StudioPage>("make");
  const [studioInspectorTab, setStudioInspectorTab] = useState<StudioInspectorTab>("projects");
  const [workspaceRightSidebarCollapsed, setWorkspaceRightSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<WorkbenchTheme>(() => readThemePreference());
  const [workspaceSlotCount, setWorkspaceSlotCount] = useState(() => readWorkspaceSlotCount());
  const [workspaceHiddenPanes, setWorkspaceHiddenPanes] = useState<WorkspaceHiddenPaneSummary[]>([]);
  const [workspaceHiddenPaneRestoreRequest, setWorkspaceHiddenPaneRestoreRequest] = useState("");
  const [enabledFeaturePageIds, setEnabledFeaturePageIds] = useState<string[]>(readEnabledFeaturePageIds);
  const [productShellSidebarPinIds, setProductShellSidebarPinIds] = useState<string[]>(readProductShellSidebarPinIds);
  const [productShellBoxes, setProductShellBoxes] = useState<ProductShellBoxInput[]>(readProductShellBoxes);
  const [closedSurfaceRouteIds, setClosedSurfaceRouteIds] = useState<string[]>([]);
  const [agentRuntimeDescriptors, setAgentRuntimeDescriptors] = useState<AgentRuntimeDescriptor[]>([]);
  const routeRef = useRef<HTMLDivElement>(null);
  const smokeAgentRuntimeHoldUntilRef = useRef(0);
  const workbenchSummary = useWorkbenchSummary();
  const enabledFeaturePages = useMemo(() => {
    const enabledIds = new Set(enabledFeaturePageIds);
    return workbenchSummary.workshopExtensions
      .filter((item) => item.type === "feature-page" && item.entryPath && enabledIds.has(item.id))
      .slice(0, 8);
  }, [enabledFeaturePageIds, workbenchSummary.workshopExtensions]);
  const activeFeaturePage = useMemo(() => {
    const featureId = featureIdFromRoute(route);
    return featureId ? enabledFeaturePages.find((item) => item.id === featureId) : undefined;
  }, [enabledFeaturePages, route]);
  const shellRoutes = useMemo<Array<ShellRoute<RouteId>>>(() => [
    ...routes,
    ...enabledFeaturePages.map((item) => ({
      id: featureRouteId(item.id),
      label: item.name,
      icon: GalleryVerticalEnd,
      badge: "本机"
    }))
  ], [enabledFeaturePages]);
  const productShellSidebarPinIdSet = useMemo(() => new Set(productShellSidebarPinIds), [productShellSidebarPinIds]);
  const sidebarRoutes = useMemo<Array<ShellRoute<RouteId>>>(() => {
    return shellRoutes.filter((item) => {
      const routeId = String(item.id);
      return productShellSidebarCoreRouteIds.has(routeId);
    });
  }, [shellRoutes]);
  const topNavCopy = activeFeaturePage
    ? { title: activeFeaturePage.name, subtitle: "本机功能页 · 工坊作品" }
    : routeTitles[baseRouteIds.has(route as BaseRouteId) ? route as BaseRouteId : "lobby"];
  const closedSurfaceRouteIdSet = useMemo(() => new Set(closedSurfaceRouteIds), [closedSurfaceRouteIds]);
  const openSurfaceRegistry = useMemo(() => createOpenSurfaceRegistry(
    shellRoutes.filter((item) => productShellTabPolicyForRouteId(String(item.id)) !== "ephemeral").map((item) => {
      const routeId = item.id;
      const keepaliveMounted =
        (routeId === "workspace" && workspaceRouteMounted) ||
        (routeId === "studio" && studioRouteMounted);
      const closed = closedSurfaceRouteIdSet.has(String(routeId));
      return {
        routeId,
        title: item.label,
        active: route === routeId && !closed,
        mounted: !closed && (route === routeId || keepaliveMounted)
      };
    })
  ), [closedSurfaceRouteIdSet, route, shellRoutes, studioRouteMounted, workspaceRouteMounted]);
  const runtimeSurfaceAttachments = useMemo(() => createRuntimeSurfaceAttachmentSnapshot({
    openSurfaceRegistry,
    runtimes: agentRuntimeDescriptors
  }), [agentRuntimeDescriptors, openSurfaceRegistry]);
  const productShellProjection = useMemo(() => createProductShellProjection({
    routes: shellRoutes.map((item, index): ProductShellRouteInput => ({
      id: String(item.id),
      label: item.label,
      kind: productShellRouteKindForRouteId(String(item.id)),
      sidebarPlacement: productShellSidebarPlacementForRouteId(String(item.id), productShellSidebarPinIdSet),
      tabPolicy: productShellTabPolicyForRouteId(String(item.id)),
      priority: index
    })),
    boxes: productShellBoxes,
    openSurfaceRegistry,
    runtimeSurfaceAttachments
  }), [openSurfaceRegistry, productShellBoxes, productShellSidebarPinIdSet, runtimeSurfaceAttachments, shellRoutes]);
  const productShellTabByRouteId = useMemo(() => {
    return new Map(productShellProjection.openTabs.map((tab) => [tab.routeId, tab]));
  }, [productShellProjection.openTabs]);
  useRouteTransition(routeRef, [route]);
  const handleRouteChange = useCallback((nextRoute: RouteId) => {
    setRoute(nextRoute);
    setClosedSurfaceRouteIds((current) => current.filter((routeId) => routeId !== String(nextRoute)));
    if (typeof window === "undefined") return;
    const nextHash = `#${nextRoute}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }, []);
  const handleTopSurfaceClose = useCallback((routeId: string) => {
    const normalizedRouteId = String(routeId || "").trim();
    if (!normalizedRouteId) return;
    const tab = productShellTabByRouteId.get(normalizedRouteId);
    if (!tab?.closable || tab.closeMode === "not-closable") return;
    const attachment = runtimeSurfaceAttachments.byRouteId[normalizedRouteId];
    const stoppedRuntimeKeys = new Set<string>();
    for (const runtime of attachment?.runtimes || []) {
      if (!["running", "starting", "stopping"].includes(runtime.status)) continue;
      const runtimeKey = runtime.runtimeKey || runtime.sessionKey || runtime.sessionId || runtime.runtimeId || runtime.id;
      if (!runtimeKey || stoppedRuntimeKeys.has(runtimeKey)) continue;
      stoppedRuntimeKeys.add(runtimeKey);
      try {
        stopAgentRuntime(runtimeKey);
      } catch {
        // The runtime may have already exited while the close confirmation was open.
      }
    }
    if (stoppedRuntimeKeys.size && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("meowdesk:agent-runtime-refresh"));
    }
    setClosedSurfaceRouteIds((current) => {
      if (current.includes(normalizedRouteId)) return current;
      return [...current, normalizedRouteId];
    });
  }, [productShellTabByRouteId, runtimeSurfaceAttachments]);
  const handleProductShellSidebarPinChange = useCallback((routeId: string, pinned: boolean) => {
    const normalizedRouteId = String(routeId || "").trim();
    if (!normalizedRouteId || productShellSidebarCoreRouteIds.has(normalizedRouteId)) return;
    const availableRouteIds = new Set(shellRoutes.map((item) => String(item.id)));
    if (!availableRouteIds.has(normalizedRouteId)) return;
    setProductShellSidebarPinIds((current) => {
      const next = new Set(current.filter((item) => availableRouteIds.has(item) && !productShellSidebarCoreRouteIds.has(item)));
      if (pinned) {
        next.add(normalizedRouteId);
      } else {
        next.delete(normalizedRouteId);
      }
      const nextRouteIds = [...next];
      writeProductShellSidebarPinIds(nextRouteIds);
      return nextRouteIds;
    });
    if (pinned) {
      setProductShellBoxes((current) => {
        const nextBoxes = current.map((box) => ({
          ...box,
          itemRouteIds: (box.itemRouteIds || []).filter((item) => item !== normalizedRouteId)
        }));
        writeProductShellBoxes(nextBoxes);
        return nextBoxes;
      });
    }
  }, [shellRoutes]);
  const handleProductShellBoxCreate = useCallback(() => {
    setProductShellBoxes((current) => {
      const usedIds = new Set(current.map((box) => box.id));
      let index = current.length + 2;
      let id = normalizeProductShellBoxId(`box-${index}`);
      while (usedIds.has(id)) {
        index += 1;
        id = normalizeProductShellBoxId(`box-${index}`);
      }
      const nextBoxes = [
        ...current,
        { id, title: `Meow Box ${index}`, itemRouteIds: [] }
      ];
      writeProductShellBoxes(nextBoxes);
      return nextBoxes;
    });
  }, []);
  const handleProductShellBoxDelete = useCallback((boxId: string) => {
    const normalizedBoxId = normalizeProductShellBoxId(boxId);
    if (!normalizedBoxId || normalizedBoxId === "default") return;
    setProductShellBoxes((current) => {
      const nextBoxes = current.filter((box) => box.id !== normalizedBoxId);
      writeProductShellBoxes(nextBoxes);
      return nextBoxes;
    });
  }, []);
  const handleProductShellRouteBoxMove = useCallback((routeId: string, targetBoxId: string) => {
    const normalizedRouteId = String(routeId || "").trim();
    const normalizedBoxId = normalizeProductShellBoxId(targetBoxId);
    if (!normalizedRouteId || !normalizedBoxId || productShellSidebarCoreRouteIds.has(normalizedRouteId)) return;
    const availableRouteIds = new Set(shellRoutes.map((item) => String(item.id)));
    if (!availableRouteIds.has(normalizedRouteId)) return;
    setProductShellSidebarPinIds((current) => {
      if (!current.includes(normalizedRouteId)) return current;
      const nextRouteIds = current.filter((item) => item !== normalizedRouteId);
      writeProductShellSidebarPinIds(nextRouteIds);
      return nextRouteIds;
    });
    setProductShellBoxes((current) => {
      const targetExists = normalizedBoxId === "default" || current.some((box) => box.id === normalizedBoxId);
      if (!targetExists) return current;
      const nextBoxes = current.map((box) => {
        const withoutRoute = (box.itemRouteIds || []).filter((item) => item !== normalizedRouteId);
        return {
          ...box,
          itemRouteIds: box.id === normalizedBoxId ? [...withoutRoute, normalizedRouteId] : withoutRoute
        };
      });
      writeProductShellBoxes(nextBoxes);
      return nextBoxes;
    });
  }, [shellRoutes]);
  const handleThemeChange = useCallback((nextTheme: WorkbenchTheme) => {
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      writeHomeBackedStorageCache(themeModeStorage, nextTheme);
    }
  }, []);
  const handleWorkspaceSlotCountChange = useCallback((nextCount: number) => {
    const previous = workspaceSlotCount;
    const normalized = clampWorkspaceSlotCount(nextCount);
    if (typeof window !== "undefined" && normalized > previous) {
      window.dispatchEvent(new CustomEvent("meowdesk:workspace-pane-count-intent", {
        detail: {
          previous,
          next: normalized
        }
      }));
    }
    setWorkspaceSlotCount(normalized);
    if (typeof window !== "undefined") {
      writeHomeBackedStorageCache(workspaceSlotCountStorage, normalized);
    }
  }, [workspaceSlotCount]);
  const handleWorkspaceHiddenPaneRestore = useCallback((paneId: string) => {
    if (!paneId) return;
    setWorkspaceHiddenPaneRestoreRequest(`${paneId}:${Date.now()}`);
  }, []);
  const handleWorkspaceRightSidebarCollapsedChange = useCallback((collapsed: boolean, source = "app") => {
    setWorkspaceRightSidebarCollapsed(collapsed);
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("meowdesk:workspace-sidebar-toggle", {
      detail: {
        collapsed,
        owner: "workspace" satisfies WorkspaceRightSidebarOwner,
        source
      }
    }));
    window.dispatchEvent(new CustomEvent("meowdesk:right-sidebar-owner-toggle", {
      detail: {
        collapsed,
        owner: "workspace" satisfies WorkspaceRightSidebarOwner,
        source
      }
    }));
  }, []);
  const handleWorkspaceRightSidebarToggle = useCallback((source = "app") => {
    setWorkspaceRightSidebarCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("meowdesk:workspace-sidebar-toggle", {
          detail: {
            collapsed: next,
            owner: "workspace" satisfies WorkspaceRightSidebarOwner,
            source
          }
        }));
        window.dispatchEvent(new CustomEvent("meowdesk:right-sidebar-owner-toggle", {
          detail: {
            collapsed: next,
            owner: "workspace" satisfies WorkspaceRightSidebarOwner,
            source
          }
        }));
      }
      return next;
    });
  }, []);
  const topNavAction = useMemo(() => {
    if (route === "lobby") {
      return (
        <LobbyTopActions
          activeSection={lobbySection}
          onSectionChange={(section) => {
            setLobbySection(section);
            window.dispatchEvent(new CustomEvent("meowdesk:lobby-show-section"));
          }}
        />
      );
    }
    if (route === "plugins") return <RouteAction icon={Store} label="插件可达" />;
    if (route === "tasks") return <TaskTopActions activeTab={taskTab} onActiveTabChange={setTaskTab} />;
    if (route === "studio") {
      return (
          <StudioTopActions
            activePage={studioPage}
            onPageChange={setStudioPage}
            inspectorOpen={!workspaceRightSidebarCollapsed}
            activeInspectorTab={studioInspectorTab}
            onInspectorOpenChange={(open) => handleWorkspaceRightSidebarCollapsedChange(!open, "studio-top-actions")}
          />
        );
      }
    if (route === "workspace") {
      return (
        <WorkspaceTopActions
          summary={workbenchSummary}
          slotCount={workspaceSlotCount}
          hiddenPanes={workspaceHiddenPanes}
          sidebarCollapsed={workspaceRightSidebarCollapsed}
          onSlotCountChange={handleWorkspaceSlotCountChange}
          onRestoreHiddenPane={handleWorkspaceHiddenPaneRestore}
          onSidebarCollapsedChange={(collapsed) => handleWorkspaceRightSidebarCollapsedChange(collapsed, "workspace-top-actions")}
        />
      );
    }
    if (route === "conversations") return <ConversationTopActions summary={workbenchSummary} />;
    if (route === "obsidian") return <ObsidianTopActions />;
    if (route === "access") return <ThemeTopActions theme={theme} onThemeChange={handleThemeChange} />;
    if (route === "profile") return <RouteAction icon={User} label="本地资料" />;
    if (activeFeaturePage) return <RouteAction icon={GalleryVerticalEnd} label="本机功能页" />;
    return (
      <Button variant="outline" size="sm">
        <Hammer size={15} aria-hidden="true" />
        工坊设置
      </Button>
    );
  }, [activeFeaturePage, handleRouteChange, handleThemeChange, handleWorkspaceHiddenPaneRestore, handleWorkspaceRightSidebarCollapsedChange, handleWorkspaceSlotCountChange, lobbySection, route, studioInspectorTab, studioPage, taskTab, theme, workbenchSummary, workspaceHiddenPanes, workspaceRightSidebarCollapsed, workspaceSlotCount]);

  useEffect(() => {
    const handleHashChange = () => setRoute(readHashRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (route === "workspace") setWorkspaceRouteMounted(true);
    if (route === "studio") setStudioRouteMounted(true);
  }, [route]);

  useEffect(() => {
    let disposed = false;
    const refreshAgentRuntimeDescriptors = async () => {
      if (smokeAgentRuntimeHoldUntilRef.current > Date.now()) return;
      if (typeof window === "undefined" || !window.workbench?.listAgentRuntimes) {
        if (!disposed) setAgentRuntimeDescriptors([]);
        return;
      }
      try {
        const runtimes = await listAgentRuntimes();
        if (!disposed) setAgentRuntimeDescriptors(runtimes);
      } catch {
        if (!disposed) setAgentRuntimeDescriptors([]);
      }
    };
    void refreshAgentRuntimeDescriptors();
    const injectSmokeAgentRuntimes = (event: Event) => {
      const detail = (event as CustomEvent<{ owner?: string; runtimes?: AgentRuntimeDescriptor[] }>).detail;
      const smokeOwner = detail?.owner === "renderer-smoke";
      const smokeDocument = document.documentElement.classList.contains("meowdesk-renderer-smoke");
      if (!smokeOwner && !smokeDocument) return;
      smokeAgentRuntimeHoldUntilRef.current = Date.now() + 8000;
      setAgentRuntimeDescriptors(Array.isArray(detail?.runtimes) ? detail.runtimes : []);
    };
    const interval = window.setInterval(refreshAgentRuntimeDescriptors, 2500);
    window.addEventListener("focus", refreshAgentRuntimeDescriptors);
    window.addEventListener("meowdesk:agent-runtime-refresh", refreshAgentRuntimeDescriptors);
    window.addEventListener("meowdesk:renderer-smoke-agent-runtimes", injectSmokeAgentRuntimes);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshAgentRuntimeDescriptors);
      window.removeEventListener("meowdesk:agent-runtime-refresh", refreshAgentRuntimeDescriptors);
      window.removeEventListener("meowdesk:renderer-smoke-agent-runtimes", injectSmokeAgentRuntimes);
    };
  }, []);

  useEffect(() => {
    const refreshEnabledFeaturePages = () => setEnabledFeaturePageIds(readEnabledFeaturePageIds());
    const disposeHydration = hydrateHomeBackedStorage(enabledFeaturePagesStorage, refreshEnabledFeaturePages);
    window.addEventListener("storage", refreshEnabledFeaturePages);
    window.addEventListener("meowdesk:workspace-toggle-feature-page", refreshEnabledFeaturePages);
    return () => {
      disposeHydration();
      window.removeEventListener("storage", refreshEnabledFeaturePages);
      window.removeEventListener("meowdesk:workspace-toggle-feature-page", refreshEnabledFeaturePages);
    };
  }, []);

  useEffect(() => {
    const refreshShellStorage = (key: string) => {
      if (key === THEME_MODE_STORAGE_KEY) setTheme(readThemePreference());
      if (key === workspaceSlotCountStorageKey) setWorkspaceSlotCount(readWorkspaceSlotCount());
      if (key === productShellSidebarPinsStorageKey) setProductShellSidebarPinIds(readProductShellSidebarPinIds());
      if (key === productShellBoxesStorageKey) setProductShellBoxes(readProductShellBoxes());
    };
    const disposers = [
      hydrateHomeBackedStorage(themeModeStorage, () => refreshShellStorage(THEME_MODE_STORAGE_KEY)),
      hydrateHomeBackedStorage(workspaceSlotCountStorage, () => refreshShellStorage(workspaceSlotCountStorageKey)),
      hydrateHomeBackedStorage(productShellSidebarPinsStorage, () => refreshShellStorage(productShellSidebarPinsStorageKey)),
      hydrateHomeBackedStorage(productShellBoxesStorage, () => refreshShellStorage(productShellBoxesStorageKey))
    ];
    return () => {
      disposers.forEach((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    const closeTopSurface = (event: Event) => {
      const routeId = String((event as CustomEvent<{ routeId?: string }>).detail?.routeId || "").trim();
      if (routeId) handleTopSurfaceClose(routeId);
    };
    window.addEventListener("meowdesk:top-surface-close-confirmed", closeTopSurface);
    return () => window.removeEventListener("meowdesk:top-surface-close-confirmed", closeTopSurface);
  }, [handleTopSurfaceClose]);

  useEffect(() => {
    const availableRouteIds = new Set(shellRoutes.map((item) => String(item.id)));
    setProductShellSidebarPinIds((current) => {
      const nextRouteIds = current.filter((routeId) => availableRouteIds.has(routeId) && !productShellSidebarCoreRouteIds.has(routeId));
      if (nextRouteIds.length === current.length && nextRouteIds.every((routeId, index) => routeId === current[index])) {
        return current;
      }
      writeProductShellSidebarPinIds(nextRouteIds);
      return nextRouteIds;
    });
    setProductShellBoxes((current) => {
      const pinned = new Set(productShellSidebarPinIds);
      let changed = false;
      const nextBoxes = current.map((box) => {
        const nextRouteIds = (box.itemRouteIds || []).filter((routeId, index, list) => {
          const keep = availableRouteIds.has(routeId) &&
            !productShellSidebarCoreRouteIds.has(routeId) &&
            !pinned.has(routeId) &&
            list.indexOf(routeId) === index;
          if (!keep) changed = true;
          return keep;
        });
        if (nextRouteIds.length !== (box.itemRouteIds || []).length) changed = true;
        return { ...box, itemRouteIds: nextRouteIds };
      });
      if (!changed) return current;
      writeProductShellBoxes(nextBoxes);
      return nextBoxes;
    });
  }, [productShellSidebarPinIds, shellRoutes]);

  useEffect(() => {
    const activeFeatureId = featureIdFromRoute(route);
    if (!activeFeatureId) return;
    if (enabledFeaturePages.some((item) => item.id === activeFeatureId)) return;
    handleRouteChange("plugins");
  }, [enabledFeaturePages, handleRouteChange, route]);

  return (
    <AppShell
      theme={theme}
      routes={sidebarRoutes}
      activeRoute={route}
      onRouteChange={handleRouteChange}
      topNav={(
        <TopNav
          title={topNavCopy.title}
          subtitle={topNavCopy.subtitle}
          runningSurfaces={(
            <TopSurfaceRail
              tabs={productShellProjection.openTabs}
              routes={shellRoutes}
              activeRoute={route}
              onRouteChange={handleRouteChange}
              onSurfaceClose={handleTopSurfaceClose}
            />
          )}
          actions={topNavAction}
        />
      )}
      sidebarProductShell={({ sidebarCollapsed }) => (
        <ProductShellSidebarControls
          projection={productShellProjection}
          routes={shellRoutes}
          activeRoute={route}
          onRouteChange={handleRouteChange}
          sidebarCollapsed={sidebarCollapsed}
          onSidebarPinChange={handleProductShellSidebarPinChange}
          onBoxCreate={handleProductShellBoxCreate}
          onBoxDelete={handleProductShellBoxDelete}
          onRouteBoxMove={handleProductShellRouteBoxMove}
        />
      )}
      sidebarFooter={
        <>
          <ThemeSidebarAction theme={theme} onThemeChange={handleThemeChange} />
          <button
            type="button"
            data-next-sidebar-settings
            data-next-route="access"
            aria-current={route === "access" ? "page" : undefined}
            onClick={() => handleRouteChange("access")}
            className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings size={16} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left">设置</span>
          </button>
        </>
      }
    >
      <span
        className="sr-only"
        data-workbench-bridge-status={workbenchSummary.status}
        data-workbench-bridge-summary
      >
        {workbenchSummary.status === "ready"
          ? `作品 ${workbenchSummary.workshopExtensionCount ?? 0}`
          : workbenchSummary.status === "error"
            ? workbenchSummary.error || "preload bridge returned an error."
            : "preload bridge pending"}
      </span>
      <RouteShell
        ref={routeRef}
        data-open-surface-registry="true"
        data-open-surface-active={openSurfaceRegistry.activeSurface?.id || ""}
        data-open-surface-count={openSurfaceRegistry.mountedSurfaces.length}
        data-runtime-surface-attachments={runtimeSurfaceAttachments.counts.routes}
        data-runtime-surface-reattachable={runtimeSurfaceAttachments.counts.reattachableRuntimes}
      >
          {workspaceRouteMounted ? (
            <div
              className={cn("h-full min-h-0", route === "workspace" ? "grid" : "hidden")}
              data-route-keepalive="workspace"
              data-route-keepalive-active={route === "workspace" ? "true" : "false"}
            >
              <Suspense fallback={null}>
                <WorkspaceRoute
                  summary={workbenchSummary}
                  slotCount={workspaceSlotCount}
                  rightSidebarCollapsed={workspaceRightSidebarCollapsed}
                  fitSignal={route === "workspace" ? `active:${workspaceSlotCount}` : `hidden:${workspaceSlotCount}`}
                  hiddenPaneRestoreRequest={workspaceHiddenPaneRestoreRequest}
                  onSlotCountChange={handleWorkspaceSlotCountChange}
                  onHiddenPanesChange={setWorkspaceHiddenPanes}
                />
              </Suspense>
            </div>
          ) : null}
          <Suspense fallback={null}>
            {route === "lobby" ? <LobbyRoute summary={workbenchSummary} activeSection={lobbySection} onSectionChange={setLobbySection} /> : null}
          </Suspense>
          {studioRouteMounted ? (
            <div
              className={cn("h-full min-h-0", route === "studio" ? "grid" : "hidden")}
              data-route-keepalive="studio"
              data-route-keepalive-active={route === "studio" ? "true" : "false"}
            >
              <Suspense fallback={null}>
                <StudioRoute
                  summary={workbenchSummary}
                  studioPage={studioPage}
                  onStudioPageChange={setStudioPage}
                  inspectorOpen={!workspaceRightSidebarCollapsed}
                  inspectorTab={studioInspectorTab}
                  onInspectorOpenChange={(open) => handleWorkspaceRightSidebarCollapsedChange(!open, "studio-route")}
                  onInspectorTabChange={setStudioInspectorTab}
                />
              </Suspense>
            </div>
          ) : null}
          <Suspense fallback={null}>
            {route === "plugins" ? <PluginsRoute summary={workbenchSummary} /> : null}
            {route === "tasks" ? <TaskCenterRoute summary={workbenchSummary} activeTab={taskTab} onActiveTabChange={setTaskTab} /> : null}
            {route === "conversations" ? (
              <ConversationsRoute
                summary={workbenchSummary}
                runtimeSurfaceAttachments={runtimeSurfaceAttachments}
                onRouteChange={(nextRoute) => handleRouteChange(nextRoute as RouteId)}
              />
            ) : null}
            {route === "obsidian" ? <ObsidianRoute summary={workbenchSummary} /> : null}
            {route === "profile" ? <ProfileRoute summary={workbenchSummary} /> : null}
            {route === "access" ? <AccessConfigRoute summary={workbenchSummary} theme={theme} onThemeChange={handleThemeChange} /> : null}
          </Suspense>
          {featureIdFromRoute(route) ? <FeaturePageRoute page={activeFeaturePage} /> : null}
        </RouteShell>
    </AppShell>
  );
}

function TopSurfaceRail({
  tabs,
  routes,
  activeRoute,
  onRouteChange,
  onSurfaceClose
}: {
  tabs: ProductShellSurfaceTab[];
  routes: Array<ShellRoute<RouteId>>;
  activeRoute: RouteId;
  onRouteChange: (route: RouteId) => void;
  onSurfaceClose: (routeId: string) => void;
}) {
  const routeById = useMemo(() => new Map(routes.map((item) => [String(item.id), item])), [routes]);
  const [dangerRouteId, setDangerRouteId] = useState("");
  const [hoverRouteId, setHoverRouteId] = useState("");
  const [confirmRouteId, setConfirmRouteId] = useState("");
  const [confirmExpanded, setConfirmExpanded] = useState(false);
  const [hoverHint, setHoverHint] = useState<{
    routeId: string;
    kind: "main" | "close";
    title: string;
    body: string;
    left: number;
    top: number;
  } | null>(null);
  const confirmPanelRef = useRef<HTMLDivElement>(null);
  const pendingCloseTab = useMemo(() => {
    return confirmRouteId ? tabs.find((tab) => tab.routeId === confirmRouteId && tab.closable) || null : null;
  }, [confirmRouteId, tabs]);

  const showHoverHint = useCallback((
    target: HTMLElement,
    nextHint: { routeId: string; kind: "main" | "close"; title: string; body: string }
  ) => {
    const rect = target.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const left = Math.min(Math.max(rect.left + rect.width / 2, 92), Math.max(92, viewportWidth - 92));
    const top = Math.min(rect.bottom + 10, Math.max(16, viewportHeight - 16));
    setHoverHint({ ...nextHint, left, top });
  }, []);

  const clearHoverHint = useCallback((routeId: string) => {
    setHoverHint((current) => (current?.routeId === routeId ? null : current));
  }, []);

  useEffect(() => {
    if (!confirmRouteId) return;
    if (pendingCloseTab) return;
    setConfirmRouteId("");
    setConfirmExpanded(false);
  }, [confirmRouteId, pendingCloseTab]);

  useEffect(() => {
    if (!pendingCloseTab) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setConfirmRouteId("");
      setConfirmExpanded(false);
    };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [pendingCloseTab]);

  if (!tabs.length) return null;
  const pendingRoute = pendingCloseTab ? routeById.get(pendingCloseTab.routeId) : null;
  const pendingLabel = pendingRoute?.label || pendingCloseTab?.title || "当前页面";
  const pendingHasRuntime = Boolean(pendingCloseTab?.hasRunningRuntime || pendingCloseTab?.runtimeCount);
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const closeWarningStyle: CSSProperties | undefined = confirmExpanded
    ? { opacity: 0, transform: "scale(0.38)" }
    : undefined;
  const closeContentStyle: CSSProperties | undefined = confirmExpanded
    ? { opacity: 1, pointerEvents: "auto", transform: "rotateX(0deg)" }
    : undefined;
  const hoverHintNode = hoverHint ? (
    <span
      className="meowdesk-top-surface-floating-hint"
      role="tooltip"
      data-meow-top-surface-floating-hint={hoverHint.kind}
      data-meow-top-surface-hint={hoverHint.kind}
      data-meow-top-surface-hint-visible="true"
      data-meow-top-surface-hint-route={hoverHint.routeId}
      style={{
        "--meowdesk-hint-left": `${hoverHint.left}px`,
        "--meowdesk-hint-top": `${hoverHint.top}px`
      } as CSSProperties}
    >
      <span className="meowdesk-top-surface-hint__title">{hoverHint.title}</span>
      <span className="meowdesk-top-surface-hint__body">{hoverHint.body}</span>
    </span>
  ) : null;
  const closeDialogNode = pendingCloseTab ? (
    <div
      className="meowdesk-surface-close-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meowdesk-surface-close-title"
      aria-describedby="meowdesk-surface-close-description"
      data-meow-surface-close-dialog
      data-product-shell-surface-close-dialog
      data-meow-warning-dialog
      data-meow-warning-owner="meowdesk-warning-dialog"
      data-meow-warning-family="flip-confirm-card"
      data-meow-warning-variant="top-surface-close"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        setConfirmRouteId("");
        setConfirmExpanded(false);
      }}
    >
      <section
        ref={confirmPanelRef}
        className="meowdesk-surface-close-panel"
        tabIndex={-1}
        data-meow-surface-close-panel
        data-meow-warning-card
        data-meow-warning-owner="meowdesk-warning-dialog"
        data-meow-warning-family="flip-confirm-card"
        data-meow-warning-variant="top-surface-close"
        data-meow-surface-close-expanded={confirmExpanded ? "true" : "false"}
        onPointerEnter={() => setConfirmExpanded(true)}
        onPointerLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setConfirmExpanded(false);
        }}
        onFocusCapture={() => setConfirmExpanded(true)}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setConfirmExpanded(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          setConfirmExpanded(true);
        }}
      >
        <span className="meowdesk-surface-close-warning" data-meow-warning-icon style={closeWarningStyle} aria-hidden="true">
          <AlertTriangle size={42} strokeWidth={2.4} />
        </span>
        <div className="meowdesk-surface-close-content" data-meow-warning-content style={closeContentStyle}>
          <h2 id="meowdesk-surface-close-title">
            {pendingHasRuntime ? "关闭并停止 Agent？" : "关闭标签？"}
          </h2>
          <p id="meowdesk-surface-close-description">
            {pendingHasRuntime
              ? `会关闭「${pendingLabel}」顶部标签，并停止这个页面关联的 Agent 进程。尚未保存的输出可能会丢失。`
              : `会从顶部移除「${pendingLabel}」标签；如果这个页面有关联 Agent，确认关闭也会停止对应进程。`}
          </p>
          <div className="meowdesk-surface-close-actions" data-meow-warning-actions>
            <button
              type="button"
              className="meowdesk-surface-close-cancel"
              onClick={() => {
                setConfirmRouteId("");
                setConfirmExpanded(false);
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="meowdesk-surface-close-confirm"
              onClick={() => {
                onSurfaceClose(pendingCloseTab.routeId);
                setConfirmRouteId("");
                setConfirmExpanded(false);
              }}
            >
              {pendingHasRuntime ? "确认关闭并停止" : "确认关闭"}
            </button>
          </div>
        </div>
      </section>
    </div>
  ) : null;
  return (
    <>
      <div
        className="meowdesk-top-surface-rail"
        data-meow-top-surface-rail
        data-meow-top-surface-family="product-shell-top-surface"
        data-product-shell-top-surface-rail
      >
        {tabs.map((tab) => {
          const route = routeById.get(tab.routeId);
          const Icon = route?.icon;
          const active = tab.active || String(activeRoute) === tab.routeId;
          const label = route?.label || tab.title;
          const dangerous = dangerRouteId === tab.routeId;
          const hovered = hoverRouteId === tab.routeId;
          const mainHint = {
            routeId: tab.routeId,
            kind: "main" as const,
            title: label,
            body: active ? "当前页面" : "切换到这个页面"
          };
          const closeHint = {
            routeId: tab.routeId,
            kind: "close" as const,
            title: `关闭 ${label}`,
            body: tab.runtimeCount ? `停止 ${tab.runtimeCount} 个关联 Agent` : "移除顶部运行标签"
          };
          return (
            <div
              key={tab.id}
              className="meowdesk-top-surface-tag"
              data-meow-top-surface-tag={tab.id}
              data-meow-top-surface-key={tab.id}
              data-meow-top-surface-label={label}
              data-meow-top-surface-route={tab.routeId}
              data-meow-top-surface-active={active ? "true" : undefined}
              data-product-shell-top-surface-tag={tab.routeId}
              data-product-shell-top-surface-status={tab.status}
              data-product-shell-top-surface-closable={tab.closable ? "true" : "false"}
              data-product-shell-top-surface-close-mode={tab.closeMode}
              data-product-shell-top-surface-runtime-count={tab.runtimeCount}
              data-product-shell-top-surface-running-runtime={tab.hasRunningRuntime ? "true" : undefined}
              data-product-shell-top-surface-primary-runtime-key={tab.primaryRuntimeKey || undefined}
              data-meow-top-surface-danger={dangerous ? "true" : undefined}
              data-meow-top-surface-hover={hovered ? "true" : undefined}
              onPointerEnter={() => setHoverRouteId(tab.routeId)}
              onFocus={() => setHoverRouteId(tab.routeId)}
              onPointerLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setHoverRouteId((current) => current === tab.routeId ? "" : current);
                setDangerRouteId((current) => current === tab.routeId ? "" : current);
                clearHoverHint(tab.routeId);
              }}
              onBlur={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setHoverRouteId((current) => current === tab.routeId ? "" : current);
                setDangerRouteId((current) => current === tab.routeId ? "" : current);
                clearHoverHint(tab.routeId);
              }}
            >
              <button
                type="button"
                className="meowdesk-top-surface-main"
                aria-current={active ? "page" : undefined}
                aria-label={label}
                data-meow-top-surface-main
                data-meow-top-surface-key={tab.id}
                data-meow-tab-active={active ? "true" : undefined}
                onPointerEnter={(event) => showHoverHint(event.currentTarget, mainHint)}
                onFocus={(event) => showHoverHint(event.currentTarget, mainHint)}
                onClick={() => onRouteChange(tab.routeId as RouteId)}
              >
                {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                <span className="meowdesk-top-surface-label">{label}</span>
              </button>
              {tab.closable ? (
                <button
                  type="button"
                  className="meowdesk-top-surface-close"
                  aria-label={tab.closeMode === "detach-only" ? `关闭 ${label}` : `关闭 ${label}`}
                  data-meow-top-surface-close
                  data-meow-top-surface-key={tab.id}
                  data-product-shell-top-surface-close={tab.routeId}
                  data-product-shell-top-surface-close-mode={tab.closeMode}
                  onPointerEnter={(event) => {
                    setDangerRouteId(tab.routeId);
                    showHoverHint(event.currentTarget, closeHint);
                  }}
                  onFocus={(event) => {
                    setDangerRouteId(tab.routeId);
                    showHoverHint(event.currentTarget, closeHint);
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDangerRouteId(tab.routeId);
                    showHoverHint(event.currentTarget, closeHint);
                    setConfirmRouteId(tab.routeId);
                    setConfirmExpanded(event.detail === 0);
                  }}
                >
                  <X size={10} strokeWidth={2.8} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {portalRoot && hoverHintNode ? createPortal(hoverHintNode, portalRoot) : null}
      {portalRoot && closeDialogNode ? createPortal(closeDialogNode, portalRoot) : null}
    </>
  );
}

function FeaturePageRoute({ page }: { page?: WorkbenchExtensionSummary }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const src = useMemo(() => {
    const url = fileUrlFromPath(page?.entryPath);
    if (!url || !page) return "";
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}meowdeskFeaturePage=${encodeURIComponent(page.id)}`;
  }, [page]);
  const syncFrame = useCallback(() => {
    const frame = frameRef.current;
    if (!frame?.contentWindow || !page) return;
    try {
      frame.contentWindow.postMessage({
        source: "meodesk",
        type: "meodesk:init",
        protocol: "meodesk.host.v0",
        host: {
          app: "Meowdesk",
          surface: "feature-page",
          chrome: "host",
          themeMode: "inherit",
          tokenProtocol: "meodesk.theme.v0"
        },
        extension: {
          id: page.id,
          name: page.name,
          type: page.type,
          target: page.target || "main-nav",
          version: page.version || "",
          runtime: page.runtime || "html"
        },
        container: {
          width: Math.round(frame.getBoundingClientRect().width || 0),
          height: Math.round(frame.getBoundingClientRect().height || 0),
          devicePixelRatio: window.devicePixelRatio || 1
        }
      }, "*");
    } catch {
      // The local feature page may still be navigating.
    }
  }, [page]);

  useEffect(() => {
    if (!src) return;
    for (const delay of [80, 240, 600]) {
      window.setTimeout(syncFrame, delay);
    }
  }, [src, syncFrame]);

  if (!page) {
    return (
      <div className="grid h-full min-h-0 place-items-center text-sm text-muted-foreground" data-r2-feature-page-route-empty>
        功能页未启用或入口不可用。
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden" data-r2-feature-page-route={page.id}>
      {src ? (
        <iframe
          ref={frameRef}
          className="h-full min-h-0 w-full border-0 bg-background"
          src={src}
          title={page.name}
          sandbox="allow-scripts allow-forms"
          data-r2-feature-page-iframe={page.id}
          onLoad={syncFrame}
        />
      ) : (
        <div className="grid h-full min-h-0 place-items-center text-sm text-muted-foreground" data-r2-feature-page-missing-entry={page.id}>
          功能页入口未生成。
        </div>
      )}
    </section>
  );
}

function TaskTopActions({
  activeTab,
  onActiveTabChange
}: {
  activeTab: TaskCenterTab;
  onActiveTabChange: (tab: TaskCenterTab) => void;
}) {
  const openTaskDialog = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("meowdesk:task-new"));
    }
  };
  return (
    <div className="flex min-w-0 max-w-[calc(100vw-360px)] items-center gap-1 overflow-x-auto" data-r15-task-top-actions>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 px-2"
        data-r15-task-new
        onClick={openTaskDialog}
      >
        <Plus size={14} aria-hidden="true" />
        <span className="hidden min-[1180px]:inline">新建任务</span>
      </Button>
      {taskCenterTabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={active}
            aria-label={tab.label}
            title={tab.label}
            data-r15-task-tab={tab.id}
            data-r15-task-tab-active={active ? "true" : undefined}
            onClick={() => onActiveTabChange(tab.id)}
            className={cn("h-8 shrink-0 px-2 text-muted-foreground", active && "bg-accent text-foreground")}
          >
            <Icon size={14} aria-hidden="true" />
            <span className="hidden min-[1260px]:inline">{tab.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

function StudioTopActions({
  activePage,
  onPageChange,
  inspectorOpen,
  activeInspectorTab,
  onInspectorOpenChange
}: {
  activePage: StudioPage;
  onPageChange: (page: StudioPage) => void;
  inspectorOpen: boolean;
  activeInspectorTab: StudioInspectorTab;
  onInspectorOpenChange: (open: boolean) => void;
}) {
  const inspectorVisible = activePage === "make" && inspectorOpen;
  const toggleInspector = () => {
    if (activePage !== "make") {
      onPageChange("make");
      onInspectorOpenChange(true);
      return;
    }
    onPageChange("make");
    onInspectorOpenChange(!inspectorOpen);
  };
  const emitStudioEvent = (name: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(name));
    }
  };

  return (
    <div className="flex min-w-0 max-w-[calc(100vw-360px)] items-center gap-1 overflow-x-auto" data-studio-top-actions>
        <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-background/55 p-0.5" data-studio-top-page-tabs>
        {[
          { id: "make" as const, label: "制作台", icon: Bot },
          { id: "manage" as const, label: "作品管理", icon: GalleryVerticalEnd }
        ].map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={active}
              title={item.label}
              data-studio-page-tab={item.id}
              data-studio-page-tab-active={active ? "true" : undefined}
              onClick={() => onPageChange(item.id)}
              className={cn("meowdesk-top-nav-icon-button border-transparent bg-transparent px-0 text-muted-foreground", active && "bg-accent text-foreground")}
            >
              <Icon size={14} aria-hidden="true" />
              <span className="hidden min-[1240px]:inline">{item.label}</span>
            </Button>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={inspectorVisible}
        data-studio-inspector-toggle
        data-studio-inspector-toggle-active={inspectorVisible ? "true" : undefined}
        data-studio-inspector-active-tab={activeInspectorTab}
        onClick={toggleInspector}
        title={inspectorVisible ? "收起辅助面板" : "打开辅助面板"}
        className={cn("meowdesk-top-nav-icon-button shrink-0 border-transparent bg-transparent px-0", inspectorVisible && "bg-accent text-foreground")}
      >
        <PanelRight size={14} aria-hidden="true" />
        <span className="hidden min-[1180px]:inline">辅助面板</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-studio-import-meow
        onClick={() => emitStudioEvent("meowdesk:studio-import")}
        title="安装 .meow"
        className="meowdesk-top-nav-icon-button shrink-0 border-transparent bg-transparent px-0"
      >
        <Upload size={14} aria-hidden="true" />
        <span className="hidden min-[1320px]:inline">安装 .meow</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-studio-new-draft
        onClick={() => emitStudioEvent("meowdesk:studio-new-draft")}
        title="新建作品"
        className="meowdesk-top-nav-icon-button shrink-0 border-transparent bg-transparent px-0"
      >
        <PackagePlus size={14} aria-hidden="true" />
        <span className="hidden min-[1320px]:inline">新建作品</span>
      </Button>
    </div>
  );
}

function WorkspaceTopActions({
  summary,
  slotCount,
  hiddenPanes,
  sidebarCollapsed,
  onSlotCountChange,
  onRestoreHiddenPane,
  onSidebarCollapsedChange
}: {
  summary: WorkbenchSummary;
  slotCount: number;
  hiddenPanes: WorkspaceHiddenPaneSummary[];
  sidebarCollapsed: boolean;
  onSlotCountChange: (count: number) => void;
  onRestoreHiddenPane: (paneId: string) => void;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
}) {
  const [managerOpen, setManagerOpen] = useState(false);
  const sidebarInventoryKey = summary.sidebarWidgetRuntimes.map((widget) => `${widget.id}:${widget.readiness}:${widget.entryPath || ""}`).join("|");
  const [enabledWidgetIds, setEnabledWidgetIds] = useState(() => readWorkspaceEnabledSidebarWidgetIds(summary.sidebarWidgetRuntimes));
  useEffect(() => {
    setEnabledWidgetIds(readWorkspaceEnabledSidebarWidgetIds(summary.sidebarWidgetRuntimes));
  }, [sidebarInventoryKey, summary.sidebarWidgetRuntimes]);
  useEffect(() => {
    const refreshEnabledWidgets = () => {
      setEnabledWidgetIds(readWorkspaceEnabledSidebarWidgetIds(summary.sidebarWidgetRuntimes));
    };
    window.addEventListener("meowdesk:workspace-toggle-sidebar-widget", refreshEnabledWidgets);
    return () => window.removeEventListener("meowdesk:workspace-toggle-sidebar-widget", refreshEnabledWidgets);
  }, [sidebarInventoryKey, summary.sidebarWidgetRuntimes]);
  const enabledWidgetIdSet = useMemo(() => new Set(enabledWidgetIds), [enabledWidgetIds]);
  const sidebarWidgets = summary.sidebarWidgetRuntimes.slice(0, 3);
  const toggleSidebarWidget = (id: string, enabled: boolean) => {
    const knownIds = new Set(summary.sidebarWidgetRuntimes.map((widget) => widget.id));
    const next = new Set(enabledWidgetIds.filter((item) => knownIds.has(item)));
    if (enabled) {
      next.add(id);
    } else {
      next.delete(id);
    }
    const nextIds = [...next];
    setEnabledWidgetIds(nextIds);
    writeWorkspaceEnabledSidebarWidgetIds(nextIds);
    window.dispatchEvent(new CustomEvent("meowdesk:workspace-toggle-sidebar-widget", {
      detail: { id, enabled }
    }));
  };
  const toggleWorkspaceSidebar = () => {
    onSidebarCollapsedChange(!sidebarCollapsed);
  };
  return (
    <div className="meowdesk-workspace-actions" data-r2-workspace-toolbar data-meow-right-sidebar-control-owner="workspace">
      {hiddenPanes.length ? (
        <div className="meowdesk-workspace-hidden-tray" data-r2-workspace-hidden-tray>
          {hiddenPanes.map((pane) => (
            <button
              key={pane.id}
              type="button"
              data-r2-workspace-pane-restore={pane.id}
              title={`恢复 ${pane.name}`}
              onClick={() => onRestoreHiddenPane(pane.id)}
            >
              {pane.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="meowdesk-workspace-slot-picker" data-r2-workspace-slot-picker aria-label="工作窗数量">
        {workspaceSlotCounts.map((count) => {
          const active = slotCount === count;
          return (
            <button
              key={count}
              type="button"
              className={cn("meowdesk-workspace-slot-button", active && "is-active")}
              aria-pressed={active}
              title={`${count} 个窗口`}
              data-r2-workspace-slot-button={count}
              data-r2-workspace-slot-active={active ? "true" : undefined}
              onClick={() => onSlotCountChange(count)}
            >
              {count}
            </button>
          );
        })}
      </div>
      <div className="relative flex items-center gap-1" data-r2-workspace-sidebar-manager>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-expanded={managerOpen}
          aria-label="管理右侧栏组件"
          title="管理右侧栏组件"
          data-r2-workspace-sidebar-manager-button
          onClick={() => setManagerOpen((current) => !current)}
          className="meowdesk-top-nav-icon-button vs-entry-glow-button border-transparent bg-transparent p-0"
        >
          <PanelRight size={14} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={sidebarCollapsed ? "展开右侧栏" : "折叠右侧栏"}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "展开右侧栏" : "折叠右侧栏"}
          data-r2-workspace-sidebar-toggle
          data-r2-workspace-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
          data-meow-right-sidebar-control-owner="workspace"
          data-meow-right-sidebar-family="workspace"
          data-meow-right-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
          data-meow-action-owner="workspace"
          data-meow-action-family="workspace-action-surface"
          data-meow-action-state="primary"
          data-meow-action-source="right-sidebar-toggle"
          onClick={toggleWorkspaceSidebar}
          className="meowdesk-top-nav-icon-button meowdesk-workspace-action-surface p-0"
        >
          {sidebarCollapsed ? <ChevronLeft size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </Button>
        {managerOpen ? (
          <div
            className="absolute right-0 top-[calc(100%+8px)] z-50 grid w-72 gap-3 rounded-md border border-border bg-surface-raised p-3 text-xs shadow-xl"
            data-r2-workspace-sidebar-manager-menu
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-foreground">右侧栏</strong>
              <span className="rounded-full bg-background/70 px-2 py-0.5 text-muted-foreground" data-r2-workspace-slot="workspace-sidebar">workspace-sidebar</span>
            </div>
            <div className="grid gap-1.5">
              <span className="text-[11px] font-medium uppercase text-muted-foreground">内置</span>
              {sidebarBuiltins.map((item) => (
                <span key={item.id} className="grid gap-0.5 rounded-md border border-border bg-background/55 px-2.5 py-2" data-r2-workspace-sidebar-builtin={item.id}>
                  <span className="flex items-center justify-between gap-2">
                    <strong className="text-foreground">{item.name}</strong>
                    <Badge variant={item.enabled ? "success" : "default"}>{item.enabled ? "on" : "off"}</Badge>
                  </span>
                  <span className="text-muted-foreground">{item.detail}</span>
                </span>
              ))}
            </div>
            <div className="grid gap-1.5">
              <span className="text-[11px] font-medium uppercase text-muted-foreground">工坊组件</span>
              {sidebarWidgets.length ? sidebarWidgets.map((widget) => (
                <label key={widget.id} className="grid gap-0.5 rounded-md border border-border bg-background/55 px-2.5 py-2" data-r2-workspace-sidebar-manager-widget={widget.id}>
                  <span className="flex items-center justify-between gap-2">
                    <strong className="truncate text-foreground">{widget.name}</strong>
                    <input
                      type="checkbox"
                      checked={enabledWidgetIdSet.has(widget.id)}
                      disabled={widget.readiness !== "loadable" || !widget.entryPath}
                      data-r2-workspace-sidebar-widget-toggle={widget.id}
                      onChange={(event) => toggleSidebarWidget(widget.id, event.currentTarget.checked)}
                    />
                  </span>
                  <span className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span className="truncate">{widget.entry || widget.runtime || "entry pending"}</span>
                    <Badge variant={widget.readiness === "loadable" ? "success" : "default"}>{widget.readiness}</Badge>
                  </span>
                </label>
              )) : (
                <span className="rounded-md border border-dashed border-border px-3 py-5 text-center text-muted-foreground">暂无已索引右侧栏组件</span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConversationTopActions({ summary }: { summary: WorkbenchSummary }) {
  const openConversationDir = () => {
    if (summary.conversationsDir) {
      void window.workbench?.openPath(summary.conversationsDir);
    }
  };
  const refreshConversations = () => {
    window.dispatchEvent(new CustomEvent("meowdesk:conversations-refresh"));
    summary.refresh();
  };
  return (
    <div className="flex min-w-0 items-center gap-1" data-r3-conversations-top-actions>
      <Button type="button" variant="outline" size="sm" onClick={refreshConversations} disabled={summary.refreshing} className="h-8 px-2" data-r3-conversations-top-refresh>
        <RefreshCw className={cn(summary.refreshing && "animate-spin")} size={14} aria-hidden="true" />
        <span className="hidden min-[1180px]:inline">{summary.refreshing ? "刷新中" : "刷新"}</span>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={openConversationDir} disabled={!summary.conversationsDir} className="h-8 px-2" data-r3-conversations-top-open-dir>
        <FolderOpen size={14} aria-hidden="true" />
        <span className="hidden min-[1180px]:inline">目录</span>
      </Button>
      <Badge>{summary.conversationCount ?? summary.conversations.length} 条</Badge>
    </div>
  );
}

function ObsidianTopActions() {
  const emit = (name: string) => window.dispatchEvent(new CustomEvent(name));
  return (
    <div className="flex min-w-0 items-center gap-1" data-r3-obsidian-top-actions>
      <Button type="button" variant="outline" size="sm" onClick={() => emit("meowdesk:obsidian-pick-vault")} className="h-8 px-2" data-r3-obsidian-top-pick>
        <FolderOpen size={14} aria-hidden="true" />
        <span className="hidden min-[1180px]:inline">选择 vault</span>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => emit("meowdesk:obsidian-refresh")} className="h-8 px-2" data-r3-obsidian-top-refresh>
        <RefreshCw size={14} aria-hidden="true" />
        <span className="hidden min-[1180px]:inline">刷新</span>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => emit("meowdesk:obsidian-open-current")} className="h-8 px-2" data-r3-obsidian-top-open>
        <BookOpen size={14} aria-hidden="true" />
        <span className="hidden min-[1180px]:inline">打开</span>
      </Button>
    </div>
  );
}

function ThemeTopActions({ theme, onThemeChange }: { theme: WorkbenchTheme; onThemeChange: (theme: WorkbenchTheme) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background/55 p-1" data-r15-theme-picker>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={theme === "light"}
        data-r15-theme-option="light"
        className={cn("h-8 px-2 text-muted-foreground", theme === "light" && "bg-accent text-foreground")}
        onClick={() => onThemeChange("light")}
      >
        <Sun size={14} aria-hidden="true" />
        亮色
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={theme === "dark"}
        data-r15-theme-option="dark"
        className={cn("h-8 px-2 text-muted-foreground", theme === "dark" && "bg-accent text-foreground")}
        onClick={() => onThemeChange("dark")}
      >
        <Moon size={14} aria-hidden="true" />
        暗色
      </Button>
    </div>
  );
}

function ThemeSidebarAction({ theme, onThemeChange }: { theme: WorkbenchTheme; onThemeChange: (theme: WorkbenchTheme) => void }) {
  const nextTheme = theme === "light" ? "dark" : "light";
  const Icon = theme === "light" ? Moon : Sun;
  return (
    <button
      type="button"
      data-r15-theme-sidebar-toggle
      data-r15-theme-current={theme}
      onClick={() => onThemeChange(nextTheme)}
      className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon size={16} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">{theme === "light" ? "切到暗色" : "切到亮色"}</span>
    </button>
  );
}

function LobbyTopActions({
  activeSection,
  onSectionChange
}: {
  activeSection: LobbySectionId;
  onSectionChange: (section: LobbySectionId) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1" data-lobby-top-actions>
      <div className="flex min-w-0 items-center gap-0.5 rounded-md border border-border bg-background/55 p-0.5 min-[1180px]:gap-1 min-[1180px]:p-1" data-lobby-top-sections>
        {lobbySections.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={active}
              aria-label={item.label}
              title={item.label}
              data-lobby-section-tab={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn("h-7 px-1.5 text-muted-foreground min-[1180px]:px-2", active && "bg-accent text-foreground")}
            >
              <Icon size={14} aria-hidden="true" />
              <span className="hidden min-[1180px]:inline">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function RouteAction({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <Button variant="outline" size="sm">
      <Icon size={15} aria-hidden="true" />
      {label}
    </Button>
  );
}

import type { WorkbenchSummary } from "@/app/use-workbench-summary";
import {
  hydrateHomeBackedStorage,
  readHomeBackedStorageCache,
  writeHomeBackedStorageCache,
  type HomeBackedStorageOptions
} from "@/lib/workbench-api";

export type WorkspaceHiddenPaneSummary = {
  id: string;
  name: string;
  kind: "agent" | "terminal" | "browser" | "renderer" | "blank";
};

export type WorkspaceTerminalStatus = "idle" | "starting" | "running" | "stopping" | "exited" | "error";

const WORKSPACE_ENABLED_SIDEBAR_WIDGETS_STORAGE_KEY = "meowdesk.workspace.enabledSidebarWidgets.v2";

export const sidebarBuiltins = [
  { id: "board", name: "优先看板", detail: "工作区右侧任务摘要", enabled: true },
  { id: "pets", name: "桌宠", detail: "Agent 状态反馈 dock", enabled: true }
];

function defaultEnabledSidebarWidgetIds(widgets: WorkbenchSummary["sidebarWidgetRuntimes"]) {
  void widgets;
  return [];
}

function stringArrayStorageValue(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
}

function numberStorageValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function recordStorageValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function workspaceStorageValue<T>(homeKey: string, storageKey: string, fallback: T, validate?: (value: unknown) => T): HomeBackedStorageOptions<T> {
  return { storageKey, homeKey, fieldKey: storageKey, fallback, validate };
}

const WORKSPACE_ENABLED_SIDEBAR_WIDGETS_STORAGE = workspaceStorageValue("workspaceExtensions", WORKSPACE_ENABLED_SIDEBAR_WIDGETS_STORAGE_KEY, [], stringArrayStorageValue);

export function readWorkspaceEnabledSidebarWidgetIds(widgets: WorkbenchSummary["sidebarWidgetRuntimes"]) {
  if (typeof window === "undefined") return defaultEnabledSidebarWidgetIds(widgets);
  const knownIds = new Set(widgets.map((widget) => widget.id));
  const ids = readHomeBackedStorageCache(WORKSPACE_ENABLED_SIDEBAR_WIDGETS_STORAGE);
  return ids.length ? ids.filter((id) => knownIds.has(id)) : defaultEnabledSidebarWidgetIds(widgets);
}

export function writeWorkspaceEnabledSidebarWidgetIds(ids: string[]) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(WORKSPACE_ENABLED_SIDEBAR_WIDGETS_STORAGE, [...new Set(ids)]);
}

export type WorkspacePane = {
  id: string;
  toolId?: string;
  name: string;
  kind: "agent" | "terminal" | "browser" | "renderer" | "blank";
  command?: string;
  commandLine?: string;
  args?: string[];
  cwd?: string;
};

export type WorkspaceConfigChoice = Omit<WorkspacePane, "id"> & {
  id: string;
  detail: string;
  actionLabel: string;
};

export type WorkspacePetPosition = { x: number; y: number };

export const WORKSPACE_PANE_DRAG_MIME = "application/x-meowdesk-workspace-pane";
export const DEFAULT_WORKSPACE_BOARD_HEIGHT = 180;
export const DEFAULT_WORKSPACE_PET_HEIGHT = 140;
export const DEFAULT_WORKSPACE_WIDGET_HEIGHT = 260;
export const MIN_WORKSPACE_WIDGET_HEIGHT = 180;

const WORKSPACE_SIDEBAR_WIDTH_STORAGE_KEY = "meowdesk.workspace.sidebarWidth";
const WORKSPACE_BOARD_HEIGHT_STORAGE_KEY = "meowdesk.workspace.boardHeight";
const WORKSPACE_PET_HEIGHT_STORAGE_KEY = "meowdesk.workspace.petHeight";
const WORKSPACE_PET_POSITIONS_STORAGE_KEY = "meowdesk.workspace.petPositions";
const WORKSPACE_SIDEBAR_WIDGET_HEIGHTS_STORAGE_KEY = "meowdesk.workspace.sidebarWidgetHeights";
const WORKSPACE_CONFIGURED_PANES_STORAGE_KEY = "meowdesk.workspace.configuredPanes.v3";
const WORKSPACE_PANE_ORDER_STORAGE_KEY = "meowdesk.workspace.paneOrder.v1";
const WORKSPACE_ORDER_SLOT_IDS = Array.from({ length: 6 }, (_, index) => `blank-${index + 1}`);
const WORKSPACE_SIDEBAR_WIDTH_STORAGE = workspaceStorageValue("workspaceShell", WORKSPACE_SIDEBAR_WIDTH_STORAGE_KEY, 320, (value) => numberStorageValue(value, 320));
const WORKSPACE_BOARD_HEIGHT_STORAGE = workspaceStorageValue("workspaceShell", WORKSPACE_BOARD_HEIGHT_STORAGE_KEY, DEFAULT_WORKSPACE_BOARD_HEIGHT, (value) => numberStorageValue(value, DEFAULT_WORKSPACE_BOARD_HEIGHT));
const WORKSPACE_PET_HEIGHT_STORAGE = workspaceStorageValue("workspaceShell", WORKSPACE_PET_HEIGHT_STORAGE_KEY, DEFAULT_WORKSPACE_PET_HEIGHT, (value) => numberStorageValue(value, DEFAULT_WORKSPACE_PET_HEIGHT));
const WORKSPACE_PET_POSITIONS_STORAGE = workspaceStorageValue("workspaceShell", WORKSPACE_PET_POSITIONS_STORAGE_KEY, {}, recordStorageValue);
const WORKSPACE_SIDEBAR_WIDGET_HEIGHTS_STORAGE = workspaceStorageValue("workspaceLayout", WORKSPACE_SIDEBAR_WIDGET_HEIGHTS_STORAGE_KEY, {}, recordStorageValue);
const WORKSPACE_CONFIGURED_PANES_STORAGE = workspaceStorageValue("workspaceLayout", WORKSPACE_CONFIGURED_PANES_STORAGE_KEY, {}, recordStorageValue);
const WORKSPACE_PANE_ORDER_STORAGE = workspaceStorageValue("workspaceLayout", WORKSPACE_PANE_ORDER_STORAGE_KEY, [], stringArrayStorageValue);

function commandLineForTool(command?: string, args?: string[]) {
  return [command, ...(args || [])].filter(Boolean).join(" ");
}

export function workspaceConfigChoices(summary: WorkbenchSummary): WorkspaceConfigChoice[] {
  const choices: WorkspaceConfigChoice[] = [
    {
      id: "browser-preview",
      name: "浏览器预览",
      kind: "browser",
      command: "http://localhost:3000",
      commandLine: "http://localhost:3000",
      detail: "用于 localhost、本地页面和前端开发预览",
      actionLabel: "打开"
    },
    {
      id: "output-renderer",
      name: "Meow Viewer",
      kind: "renderer",
      command: "绑定一个 CLI 工作窗",
      commandLine: "Markdown / ANSI / Agent profile",
      detail: "旁路读取 CLI 输出，整理成页面化阅读视图",
      actionLabel: "添加"
    }
  ];
  const seen = new Set(choices.map((choice) => choice.id));
  for (const tool of summary.agentTools) {
    if (seen.has(tool.id)) continue;
    seen.add(tool.id);
    const commandLine = commandLineForTool(tool.command, tool.args || []);
    choices.push({
      id: tool.id,
      toolId: tool.id,
      name: tool.name,
      kind: "agent",
      command: tool.command,
      commandLine,
      args: tool.args || [],
      cwd: tool.cwd,
      detail: commandLine || "命令待配置",
      actionLabel: "选择"
    });
  }
  for (const session of summary.terminalSessions) {
    if (seen.has(session.id)) continue;
    seen.add(session.id);
    const commandLine = commandLineForTool(session.command, session.args);
    choices.push({
      id: session.id,
      toolId: session.id,
      name: session.name,
      kind: "terminal",
      command: session.command,
      commandLine,
      args: session.args,
      cwd: session.cwd,
      detail: commandLine || "命令待配置",
      actionLabel: "选择"
    });
  }
  return choices;
}

export function workspacePaneFromChoice(paneId: string, choice: WorkspaceConfigChoice): WorkspacePane {
  return {
    id: paneId,
    toolId: choice.toolId,
    name: choice.name,
    kind: choice.kind,
    command: choice.command,
    commandLine: choice.commandLine,
    args: choice.args || [],
    cwd: choice.cwd
  };
}

export function workspacePanes(summary: WorkbenchSummary): WorkspacePane[] {
  void summary;
  return [];
}

export function clampWorkspaceSlotCount(count: number) {
  return Math.max(1, Math.min(6, Math.round(count)));
}

export function isWorkspaceOrderSlotId(id: string) {
  return /^blank-\d+$/.test(id);
}

export function workspaceSidebarWidthBounds(viewportWidth?: number) {
  const width = viewportWidth || (typeof window === "undefined" ? 1280 : window.innerWidth) || 1280;
  const min = 260;
  const maxByViewport = Math.max(min, width - 420);
  return { min, max: Math.min(560, maxByViewport) };
}

export function clampWorkspaceSidebarWidth(value: number, viewportWidth?: number) {
  const width = Number(value);
  const { min, max } = workspaceSidebarWidthBounds(viewportWidth);
  if (!Number.isFinite(width) || width <= 0) return 320;
  return Math.round(Math.max(min, Math.min(max, width)));
}

export function readWorkspaceSidebarWidth() {
  if (typeof window === "undefined") return 320;
  return clampWorkspaceSidebarWidth(readHomeBackedStorageCache(WORKSPACE_SIDEBAR_WIDTH_STORAGE));
}

export function writeWorkspaceSidebarWidth(width: number) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(WORKSPACE_SIDEBAR_WIDTH_STORAGE, width);
}

export function clampWorkspaceBoardHeight(value: number, columnHeight?: number) {
  const height = Number(value);
  const min = 180;
  const maxByColumn = columnHeight ? Math.max(min, columnHeight - 388) : 320;
  const max = Math.min(360, maxByColumn);
  if (!Number.isFinite(height) || height <= 0) return DEFAULT_WORKSPACE_BOARD_HEIGHT;
  return Math.round(Math.max(min, Math.min(max, height)));
}

export function readWorkspaceBoardHeight() {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE_BOARD_HEIGHT;
  return clampWorkspaceBoardHeight(readHomeBackedStorageCache(WORKSPACE_BOARD_HEIGHT_STORAGE));
}

export function writeWorkspaceBoardHeight(height: number) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(WORKSPACE_BOARD_HEIGHT_STORAGE, height);
}

export function clampWorkspacePetHeight(value: number, columnHeight?: number) {
  const height = Number(value);
  const min = 112;
  const maxByColumn = columnHeight ? Math.max(min, columnHeight - 260) : 260;
  const max = Math.min(380, maxByColumn);
  if (!Number.isFinite(height) || height <= 0) return DEFAULT_WORKSPACE_PET_HEIGHT;
  return Math.round(Math.max(min, Math.min(max, height)));
}

export function readWorkspacePetHeight() {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE_PET_HEIGHT;
  return clampWorkspacePetHeight(readHomeBackedStorageCache(WORKSPACE_PET_HEIGHT_STORAGE));
}

export function writeWorkspacePetHeight(height: number) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(WORKSPACE_PET_HEIGHT_STORAGE, height);
}

export function readWorkspacePetPositions(): Record<string, WorkspacePetPosition> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = readHomeBackedStorageCache(WORKSPACE_PET_POSITIONS_STORAGE);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([id, value]) => {
      const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const x = Number(record.x);
      const y = Number(record.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return [id, { x, y }];
    }).filter((item): item is [string, WorkspacePetPosition] => Boolean(item)));
  } catch {
    return {};
  }
}

export function writeWorkspacePetPositions(positions: Record<string, WorkspacePetPosition>) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(WORKSPACE_PET_POSITIONS_STORAGE, positions);
}

function workspacePaneKind(value: unknown): WorkspacePane["kind"] {
  if (value === "agent" || value === "terminal" || value === "browser" || value === "renderer") return value;
  return "blank";
}

function normalizeStoredWorkspacePane(id: string, value: unknown): WorkspacePane | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const paneId = typeof record.id === "string" && record.id.trim() ? record.id : id;
  const kind = workspacePaneKind(record.kind);
  if (kind === "blank") return null;
  const name = typeof record.name === "string" && record.name.trim() ? record.name : "工作窗";
  return {
    id: paneId,
    toolId: typeof record.toolId === "string" ? record.toolId : undefined,
    name,
    kind,
    command: typeof record.command === "string" ? record.command : undefined,
    commandLine: typeof record.commandLine === "string" ? record.commandLine : undefined,
    args: Array.isArray(record.args) ? record.args.map(String).filter(Boolean) : [],
    cwd: typeof record.cwd === "string" ? record.cwd : undefined
  };
}

export function readWorkspaceConfiguredPanes() {
  if (typeof window === "undefined") return {};
  try {
    const parsed = readHomeBackedStorageCache(WORKSPACE_CONFIGURED_PANES_STORAGE);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([id, value]) => {
      const pane = normalizeStoredWorkspacePane(id, value);
      return pane ? [pane.id, pane] : null;
    }).filter((item): item is [string, WorkspacePane] => Boolean(item)));
  } catch {
    return {};
  }
}

export function writeWorkspaceConfiguredPanes(panes: Record<string, WorkspacePane>) {
  if (typeof window === "undefined") return;
  const normalized = Object.fromEntries(Object.entries(panes).filter(([, pane]) => pane.kind !== "blank"));
  writeHomeBackedStorageCache(WORKSPACE_CONFIGURED_PANES_STORAGE, normalized);
}

export function readWorkspacePaneOrder() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = readHomeBackedStorageCache(WORKSPACE_PANE_ORDER_STORAGE);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function writeWorkspacePaneOrder(ids: string[]) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(WORKSPACE_PANE_ORDER_STORAGE, [...new Set(ids)].filter(Boolean).slice(0, 24));
}

export function orderWorkspacePanes(panes: WorkspacePane[], order: string[]) {
  const byId = new Map(panes.map((pane) => [pane.id, pane]));
  const ordered: WorkspacePane[] = [];
  for (const id of order) {
    const pane = byId.get(id);
    if (!pane) continue;
    ordered.push(pane);
    byId.delete(id);
  }
  return [...ordered, ...panes.filter((pane) => byId.has(pane.id))];
}

export function workspaceGridPanes(sourcePanes: WorkspacePane[], slotCount: number, order: string[] = []): WorkspacePane[] {
  const slots = clampWorkspaceSlotCount(slotCount);
  const panes = sourcePanes.slice(0, slots);
  const usedIds = new Set(panes.map((pane) => pane.id));
  const orderedBlankIds = [
    ...new Set([
      ...order.filter(isWorkspaceOrderSlotId),
      ...WORKSPACE_ORDER_SLOT_IDS
    ])
  ];
  for (const blankId of orderedBlankIds) {
    if (panes.length >= slots) break;
    if (usedIds.has(blankId)) continue;
    const index = Number(blankId.replace("blank-", "")) || panes.length + 1;
    panes.push({
      id: blankId,
      name: `工作窗 ${index}`,
      kind: "blank",
      command: "待配置工具或 Agent"
    });
    usedIds.add(blankId);
  }
  return panes;
}

export function clampWorkspaceSidebarWidgetHeight(value: number) {
  const height = Number(value);
  if (!Number.isFinite(height) || height <= 0) return DEFAULT_WORKSPACE_WIDGET_HEIGHT;
  return Math.round(Math.max(MIN_WORKSPACE_WIDGET_HEIGHT, Math.min(520, height)));
}

export function sidebarWidgetHeight(widget: WorkbenchSummary["sidebarWidgetRuntimes"][number]) {
  const preferred = Number(widget.preferredHeight || widget.minHeight || DEFAULT_WORKSPACE_WIDGET_HEIGHT);
  if (!Number.isFinite(preferred) || preferred <= 0) return DEFAULT_WORKSPACE_WIDGET_HEIGHT;
  return clampWorkspaceSidebarWidgetHeight(Math.min(preferred, DEFAULT_WORKSPACE_WIDGET_HEIGHT));
}

export function readWorkspaceSidebarWidgetHeights() {
  if (typeof window === "undefined") return {};
  try {
    const parsed = readHomeBackedStorageCache(WORKSPACE_SIDEBAR_WIDGET_HEIGHTS_STORAGE);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([id, value]) => [id, clampWorkspaceSidebarWidgetHeight(Number(value))])
        .filter(([id]) => String(id).trim())
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

export function writeWorkspaceSidebarWidgetHeights(heights: Record<string, number>) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(WORKSPACE_SIDEBAR_WIDGET_HEIGHTS_STORAGE, heights);
}

export function hydrateWorkspaceModelStorage(onValue: (key: string) => void) {
  const disposers = [
    hydrateHomeBackedStorage(WORKSPACE_ENABLED_SIDEBAR_WIDGETS_STORAGE, () => onValue(WORKSPACE_ENABLED_SIDEBAR_WIDGETS_STORAGE_KEY)),
    hydrateHomeBackedStorage(WORKSPACE_SIDEBAR_WIDTH_STORAGE, () => onValue(WORKSPACE_SIDEBAR_WIDTH_STORAGE_KEY)),
    hydrateHomeBackedStorage(WORKSPACE_BOARD_HEIGHT_STORAGE, () => onValue(WORKSPACE_BOARD_HEIGHT_STORAGE_KEY)),
    hydrateHomeBackedStorage(WORKSPACE_PET_HEIGHT_STORAGE, () => onValue(WORKSPACE_PET_HEIGHT_STORAGE_KEY)),
    hydrateHomeBackedStorage(WORKSPACE_PET_POSITIONS_STORAGE, () => onValue(WORKSPACE_PET_POSITIONS_STORAGE_KEY)),
    hydrateHomeBackedStorage(WORKSPACE_SIDEBAR_WIDGET_HEIGHTS_STORAGE, () => onValue(WORKSPACE_SIDEBAR_WIDGET_HEIGHTS_STORAGE_KEY)),
    hydrateHomeBackedStorage(WORKSPACE_CONFIGURED_PANES_STORAGE, () => onValue(WORKSPACE_CONFIGURED_PANES_STORAGE_KEY)),
    hydrateHomeBackedStorage(WORKSPACE_PANE_ORDER_STORAGE, () => onValue(WORKSPACE_PANE_ORDER_STORAGE_KEY))
  ];
  return () => {
    disposers.forEach((dispose) => dispose());
  };
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XtermTerminal } from "@xterm/xterm";
import { Activity, Bot, Check, ChevronLeft, ChevronRight, ClipboardList, Copy, FileText, FolderOpen, Info, Maximize2, Minimize2, Minus, Monitor, PawPrint, Play, Plus, Power, RefreshCw, Settings, Sparkles, Terminal, Trash2, X } from "lucide-react";
import type { WorkbenchSummary } from "@/app/use-workbench-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LaunchEmptyState } from "@/components/ui/launch-empty-state";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import meowniGuideCommand from "@/assets/meowni/cutouts/meowni-guide-command.png";
import { fileUrlFromPath } from "@/lib/file-url";
import { listPets, optionalWorkbenchApi, readPetDirectionFixes, readPetScales, readTaskCenterTasks, writePetDirectionFixes, writePetScales, writeTaskCenterTasks } from "@/lib/workbench-api";
import type { PetDirectionFixMap, PetPackageDescriptor, PetScaleMap, TaskCenterTask } from "@/lib/workbench-api";
import { cn } from "@/lib/utils";
import { AccessAgentIcon, RouteFrame, notifyPetSettingsChanged, openExternalUrl } from "../readiness/readiness-shared";
import {
  attachAgentRuntimeData,
  attachAgentRuntimeExit,
  createAgentRuntimeOwnership,
  detachAgentRuntime,
  reattachAgentRuntime,
  resizeAgentRuntime,
  setAgentRuntimeSourceAdapter,
  startAgentRuntime,
  stopAgentRuntime,
  writeAgentRuntime
} from "../agent-runtime/agent-runtime-manager";
import { MeowViewerComposer } from "../meow-viewer/meow-viewer-composer";
import { WorkspaceRenderedConversation, WorkspaceRendererStatusPanel, workspaceRendererPendingReplyIndex } from "../meow-viewer/meow-viewer-conversation";
import {
  workspaceRendererNormalizeUserText,
  workspaceRendererParseSourceSnapshot,
  workspaceRendererSourceEventsHaveSemanticAdapterOutput,
  workspaceRendererStripTerminalControls
} from "../meow-viewer/meow-viewer-parser";
import { workspaceRendererProfileForPane } from "../meow-viewer/meow-viewer-contract";
import type {
  WorkspaceRenderedSegment,
  WorkspaceRendererProfile,
  WorkspaceRendererSourceEvent,
  WorkspaceRendererSourceSnapshot,
  WorkspaceRendererStatusItem,
  WorkspaceTerminalSubmitSource,
  WorkspaceTerminalUserTurn
} from "../meow-viewer/meow-viewer-contract";
import {
  workspaceRendererDisplayTranscriptWithStatusPreview,
  workspaceRendererDedupeSourceEvents,
  workspaceRendererMergeStatusPreview,
  workspaceRendererSourceEventListSignature,
  workspaceRendererSourceEventSignature,
  workspaceRendererStatusPreviewFromTerminalData,
  workspaceRendererTextHasStatusPreview,
  workspaceTerminalTranscript
} from "../meow-viewer/meow-viewer-source";
import {
  TASK_CENTER_TASKS_CHANGED_EVENT,
  TaskSourceIcon,
  notifyTaskCenterTasksChanged,
  primaryTaskAction,
  sortTasks,
  sortTasksForBoard,
  taskActionText,
  taskActions,
  taskIsActive,
  taskIsDone,
  taskPrimaryTag,
  taskSourceLabel,
  taskStatusBadge,
  taskStatusLabels,
  taskTagBadgeLabel,
  taskTimeValue,
  tasksAfterAction,
  todayKey,
  type TaskAction
} from "../tasks/task-center-model";
import {
  DEFAULT_WORKSPACE_PET_HEIGHT,
  MIN_WORKSPACE_WIDGET_HEIGHT,
  WORKSPACE_PANE_DRAG_MIME,
  clampWorkspaceBoardHeight,
  clampWorkspacePetHeight,
  clampWorkspaceSidebarWidgetHeight,
  clampWorkspaceSidebarWidth,
  clampWorkspaceSlotCount,
  hydrateWorkspaceModelStorage,
  isWorkspaceOrderSlotId,
  orderWorkspacePanes,
  readWorkspaceBoardHeight,
  readWorkspaceConfiguredPanes,
  readWorkspaceEnabledSidebarWidgetIds,
  readWorkspacePaneOrder,
  readWorkspacePetHeight,
  readWorkspacePetPositions,
  readWorkspaceSidebarWidgetHeights,
  readWorkspaceSidebarWidth,
  sidebarWidgetHeight,
  workspaceSidebarWidthBounds,
  workspaceConfigChoices,
  workspaceGridPanes,
  workspacePaneFromChoice,
  workspacePanes,
  writeWorkspaceBoardHeight,
  writeWorkspaceConfiguredPanes,
  writeWorkspaceEnabledSidebarWidgetIds,
  writeWorkspacePaneOrder,
  writeWorkspacePetHeight,
  writeWorkspacePetPositions,
  writeWorkspaceSidebarWidgetHeights,
  writeWorkspaceSidebarWidth,
  type WorkspaceConfigChoice,
  type WorkspaceHiddenPaneSummary,
  type WorkspacePane,
  type WorkspacePetPosition,
  type WorkspaceTerminalStatus
} from "./workspace-model";
import { WorkspaceRightSidebarOwner } from "./workspace-right-sidebar-owner";

function sidebarWidgetIframeUrl(widget: WorkbenchSummary["sidebarWidgetRuntimes"][number], reloadToken: number) {
  const baseUrl = fileUrlFromPath(widget.entryPath);
  if (!baseUrl) return "";
  const query = new URLSearchParams({
    meodeskExtension: widget.id,
    meodeskVersion: widget.version || "current",
    meodeskReload: String(reloadToken),
    meodeskHost: "workspace-sidebar",
    meodeskTheme: typeof document === "undefined"
      ? "dark"
      : (document.querySelector("[data-meowdesk-theme]") as HTMLElement | null)?.dataset.meowdeskTheme || "dark",
    meodeskThemeMode: "inherit",
    meodeskTokenProtocol: "meodesk.theme.v0"
  });
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${query.toString()}`;
}

function meowdeskHostThemePayload() {
  const root = typeof document === "undefined"
    ? null
    : (document.querySelector("[data-meowdesk-theme]") as HTMLElement | null) || document.documentElement;
  const styles = root ? window.getComputedStyle(root) : null;
  const themeName = root?.dataset.meowdeskTheme || "dark";
  const tokenMap: Record<string, string> = {
    "--meodesk-bg": "--color-background",
    "--meodesk-panel": "--color-surface",
    "--meodesk-panel-strong": "--color-surface-raised",
    "--meodesk-panel-soft": "--color-muted",
    "--meodesk-border": "--color-border",
    "--meodesk-text": "--color-foreground",
    "--meodesk-muted": "--color-muted-foreground",
    "--meodesk-accent": "--color-primary",
    "--meodesk-danger": "--color-danger",
    "--meodesk-warning": "--color-warning",
    "--meodesk-radius": "8px",
    "--meodesk-ease": "160ms ease"
  };
  const tokens = Object.fromEntries(Object.entries(tokenMap).map(([target, source]) => {
    const value = source.startsWith("--") ? styles?.getPropertyValue(source).trim() : source;
    return [target, value || ""];
  }).filter(([, value]) => value));
  return {
    protocol: "meodesk.theme.v0",
    name: themeName,
    colorScheme: themeName === "light" ? "light" : "dark",
    tokens: {
      ...tokens,
      "--meodesk-font": styles?.fontFamily || "system-ui, sans-serif"
    }
  };
}

function sidebarWidgetHostPayload(
  widget: WorkbenchSummary["sidebarWidgetRuntimes"][number],
  frame: HTMLIFrameElement | null,
  type = "meodesk:init"
) {
  const body = frame?.closest?.(".meowdesk-workspace-widget-body") || frame;
  const rect = body?.getBoundingClientRect?.() || { width: 0, height: 0 };
  return {
    source: "meodesk",
    type,
    protocol: "meodesk.host.v0",
    host: {
      app: "Meowdesk",
      surface: "workspace-sidebar",
      chrome: "minimal",
      themeMode: "inherit",
      tokenProtocol: "meodesk.theme.v0"
    },
    extension: {
      id: widget.id,
      name: widget.name,
      type: "sidebar-widget",
      target: "workspace-sidebar",
      version: widget.version || "",
      versionKey: widget.version || "current",
      runtime: widget.runtime || "html",
      sidebarWidget: {
        minHeight: widget.minHeight,
        preferredHeight: widget.preferredHeight,
        resizeMode: widget.resizeMode
      }
    },
    container: {
      width: Math.round(rect.width || 0),
      height: Math.round(rect.height || 0),
      devicePixelRatio: window.devicePixelRatio || 1
    },
    theme: meowdeskHostThemePayload()
  };
}

function sidebarWidgetHostMessage(
  widget: WorkbenchSummary["sidebarWidgetRuntimes"][number],
  frame: HTMLIFrameElement | null,
  type = "meodesk:init"
) {
  const payload = sidebarWidgetHostPayload(widget, frame, type);
  if (type !== "meodesk:theme") return payload;
  return {
    ...payload,
    colorScheme: payload.theme.colorScheme,
    tokens: payload.theme.tokens
  };
}

function SidebarWidgetIframeHost({
  widget,
  reloadToken
}: {
  widget: WorkbenchSummary["sidebarWidgetRuntimes"][number];
  reloadToken: number;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const src = useMemo(() => sidebarWidgetIframeUrl(widget, reloadToken), [widget, reloadToken]);

  const syncFrame = (type = "meodesk:init") => {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    try {
      frame.contentWindow.postMessage(sidebarWidgetHostMessage(widget, frame, type), "*");
      if (type === "meodesk:init") {
        frame.contentWindow.postMessage(sidebarWidgetHostMessage(widget, frame, "meodesk:theme"), "*");
      }
    } catch {
      // The frame may be navigating during reload.
    }
  };

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const body = frame.closest(".meowdesk-workspace-widget-body") || frame;
    const observer = window.ResizeObserver ? new ResizeObserver(() => syncFrame("meodesk:resize")) : null;
    observer?.observe(body);
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
      if (data.source !== "meodesk-extension") return;
      if (!["meodesk:ready", "meodesk:theme:get", "meodesk:resize:get"].includes(String(data.type || ""))) return;
      const responseType = data.type === "meodesk:theme:get"
        ? "meodesk:theme"
        : data.type === "meodesk:resize:get"
          ? "meodesk:resize"
          : "meodesk:init";
      syncFrame(responseType);
    };
    window.addEventListener("message", handleMessage);
    for (const delay of [0, 80, 240]) {
      window.setTimeout(() => syncFrame("meodesk:init"), delay);
    }
    return () => {
      observer?.disconnect();
      window.removeEventListener("message", handleMessage);
    };
  }, [src, widget]);

  if (!src) {
    return (
      <div
        className="meowdesk-workspace-widget-frame"
        data-r2-workspace-widget-frame={widget.id}
        data-r2-workspace-widget-frame-mode="missing-entry"
      >
        <div className="grid gap-2 text-xs">
          <span className="font-medium text-foreground">组件入口待补齐</span>
          <span className="truncate text-muted-foreground">{widget.path || widget.manifestPath || "workspace-sidebar"}</span>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={frameRef}
      className="meowdesk-workspace-widget-frame meowdesk-workspace-widget-iframe"
      src={src}
      title={widget.name}
      sandbox="allow-scripts allow-forms"
      scrolling="no"
      data-r2-workspace-widget-frame={widget.id}
      data-r2-workspace-widget-frame-mode="iframe-host"
      data-r2-workspace-widget-iframe={widget.id}
      onLoad={() => syncFrame("meodesk:init")}
    />
  );
}

function SidebarWidgetHost({
  widget,
  height,
  onHeightChange,
  onDisable
}: {
  widget: WorkbenchSummary["sidebarWidgetRuntimes"][number];
  height: number;
  onHeightChange: (id: string, height: number) => void;
  onDisable: (id: string) => void;
}) {
  const resizeDragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [reloadToken, setReloadToken] = useState(() => Date.now());
  const [resizing, setResizing] = useState(false);
  const canMount = widget.readiness === "loadable" && Boolean(widget.entryPath);

  useEffect(() => {
    const handle = resizeHandleRef.current;
    if (!handle) return undefined;
    const startNativeResize = (event: PointerEvent) => {
      if (event.button > 0) return;
      event.preventDefault();
      resizeDragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: height
      };
      setResizing(true);
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // Programmatic smoke events may not own an active pointer.
      }
    };
    handle.addEventListener("pointerdown", startNativeResize);
    return () => {
      handle.removeEventListener("pointerdown", startNativeResize);
    };
  }, [height]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handle = resizeHandleRef.current;
    if (!handle) return undefined;
    const handleWindowResizeMove = (event: PointerEvent) => {
      const drag = resizeDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      onHeightChange(widget.id, drag.startHeight + (event.clientY - drag.startY));
    };
    const handleWindowResizeEnd = (event: PointerEvent) => {
      const drag = resizeDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      resizeDragRef.current = null;
      setResizing(false);
    };
    handle.addEventListener("pointermove", handleWindowResizeMove);
    handle.addEventListener("pointerup", handleWindowResizeEnd);
    handle.addEventListener("pointercancel", handleWindowResizeEnd);
    window.addEventListener("pointermove", handleWindowResizeMove, true);
    window.addEventListener("pointerup", handleWindowResizeEnd, true);
    window.addEventListener("pointercancel", handleWindowResizeEnd, true);
    return () => {
      handle.removeEventListener("pointermove", handleWindowResizeMove);
      handle.removeEventListener("pointerup", handleWindowResizeEnd);
      handle.removeEventListener("pointercancel", handleWindowResizeEnd);
      window.removeEventListener("pointermove", handleWindowResizeMove, true);
      window.removeEventListener("pointerup", handleWindowResizeEnd, true);
      window.removeEventListener("pointercancel", handleWindowResizeEnd, true);
    };
  }, [onHeightChange, widget.id]);

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button > 0) return;
    event.preventDefault();
    resizeDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: height
    };
    setResizing(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Programmatic smoke events may not own an active pointer.
    }
  };

  const handleResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    onHeightChange(widget.id, drag.startHeight + (event.clientY - drag.startY));
  };

  const stopResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    resizeDragRef.current = null;
    setResizing(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture may already be released by the browser.
    }
  };

  return (
    <article
      className={cn("meowdesk-workspace-widget", resizing && "is-resizing")}
      style={{ "--r2-workspace-widget-height": `${height}px` } as CSSProperties}
      data-r2-workspace-widget-host={widget.id}
      data-r2-workspace-sidebar-widget={widget.id}
      data-r2-workspace-widget-readiness={widget.readiness}
      data-r2-workspace-widget-height={height}
    >
      <header className="meowdesk-workspace-widget-head">
        <strong>
          {widget.name}
          <span>{widget.entry || "entry pending"} · {widget.runtime || "html"}</span>
        </strong>
        <span className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={!canMount} onClick={() => setReloadToken(Date.now())}>
            <RefreshCw size={13} aria-hidden="true" />
            刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-r2-workspace-widget-close={widget.id}
            onClick={() => onDisable(widget.id)}
          >
            <X size={13} aria-hidden="true" />
            关闭
          </Button>
        </span>
      </header>
      <div className="meowdesk-workspace-widget-body">
        {canMount ? (
          <SidebarWidgetIframeHost widget={widget} reloadToken={reloadToken} />
        ) : (
          <div
            className="meowdesk-workspace-widget-frame"
            data-r2-workspace-widget-frame={widget.id}
            data-r2-workspace-widget-frame-mode={widget.readiness === "loadable" ? "missing-entry" : "contract-only"}
          >
            <div className="grid gap-2 text-xs">
              <span className="font-medium text-foreground">{widget.readiness === "loadable" ? "组件入口已就绪" : "组件入口待补齐"}</span>
              <span className="truncate text-muted-foreground">{widget.path || widget.manifestPath || "workspace-sidebar"}</span>
              <span className="text-muted-foreground">iframe runtime 等待可加载入口。</span>
            </div>
          </div>
        )}
      </div>
      <div
        ref={resizeHandleRef}
        className="meowdesk-workspace-widget-resizer"
        role="separator"
        aria-orientation="horizontal"
        aria-valuemin={180}
        aria-valuemax={520}
        aria-valuenow={height}
        title="拖动调整组件高度"
        data-r2-workspace-widget-resizer={widget.id}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={stopResize}
        onPointerCancel={stopResize}
      />
    </article>
  );
}

type WorkspacePetStatus = "idle" | "starting" | "active" | "sleep" | "error";
type WorkspacePetInteraction = "jump";
type WorkspacePetActor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  lastMoveAt: number;
  dragging: boolean;
  manualPosition: boolean;
  interaction: WorkspacePetInteraction | "";
  interactionUntil: number;
};

type WorkspacePetLoopItem = {
  sprite: HTMLElement;
  actor: WorkspacePetActor;
  width: number;
  height: number;
  previousX: number;
  previousY: number;
  directionFix: number;
  speed: number;
  interaction: WorkspacePetInteraction | "";
};

function terminalHostTheme() {
  const root = typeof document === "undefined"
    ? null
    : (document.querySelector("[data-meowdesk-theme]") as HTMLElement | null) || document.documentElement;
  const styles = root ? window.getComputedStyle(root) : null;
  const color = (name: string, fallback: string) => styles?.getPropertyValue(name).trim() || fallback;
  return {
    background: "#05070a",
    foreground: color("--color-foreground", "#e5edf5"),
    cursor: color("--color-primary", "#60a5fa"),
    selectionBackground: "rgba(96, 165, 250, 0.24)",
    black: "#0f172a",
    red: color("--color-danger", "#f87171"),
    green: color("--color-success", "#34d399"),
    yellow: color("--color-warning", "#fbbf24"),
    blue: color("--color-primary", "#60a5fa"),
    magenta: "#c084fc",
    cyan: "#22d3ee",
    white: "#e5e7eb"
  };
}

function terminalStatusLabel(status: WorkspaceTerminalStatus) {
  if (status === "starting") return "启动中";
  if (status === "running") return "运行中";
  if (status === "stopping") return "停止中";
  if (status === "exited") return "已退出";
  if (status === "error") return "错误";
  return "待启动";
}

function workspacePetStatusForPane(
  pane: WorkspacePane,
  terminalStatuses: Record<string, WorkspaceTerminalStatus>,
  hiddenPaneIds: Set<string>
): WorkspacePetStatus {
  if (hiddenPaneIds.has(pane.id)) return "sleep";
  const status = terminalStatuses[pane.id] || "idle";
  if (status === "running") return "active";
  if (status === "starting" || status === "stopping") return "starting";
  if (status === "error") return "error";
  if (status === "exited") return "sleep";
  return "idle";
}

function workspacePetStatusLabel(status: WorkspacePetStatus) {
  if (status === "active") return "运行中";
  if (status === "starting") return "启动中";
  if (status === "sleep") return "休息中";
  if (status === "error") return "异常";
  return "待机";
}

function workspacePetStatusBadgeVariant(status: WorkspacePetStatus) {
  if (status === "active") return "success";
  if (status === "starting") return "warning";
  if (status === "error") return "danger";
  if (status === "sleep") return "default";
  return "primary";
}

function workspacePetMovementSpeed(status: WorkspacePetStatus) {
  if (status === "active") return 78;
  if (status === "starting") return 52;
  return 0;
}

function workspacePetDefaultPosition(
  slot: number,
  fieldWidth: number,
  fieldHeight: number,
  spriteWidth: number,
  spriteHeight: number
) {
  const inset = Math.max(12, Math.round(fieldWidth * 0.07));
  const x = slot === 2
    ? fieldWidth / 2 - spriteWidth / 2
    : slot === 3
      ? fieldWidth - spriteWidth - inset
      : inset;
  const maxY = workspacePetMaxY(fieldHeight, spriteHeight);
  const y = maxY <= 32 ? Math.round(maxY * 0.15) : maxY - (slot === 2 ? 16 : 20);
  return {
    x: Math.round(Math.max(0, Math.min(Math.max(0, fieldWidth - spriteWidth), x))),
    y: Math.round(Math.max(0, Math.min(maxY, y)))
  };
}

function workspacePetMaxY(fieldHeight: number, spriteHeight: number) {
  return Math.max(18, fieldHeight - spriteHeight);
}

function createWorkspacePetActor(
  slot: number,
  status: WorkspacePetStatus,
  fieldWidth: number,
  fieldHeight: number,
  spriteWidth: number,
  spriteHeight: number,
  manualPosition?: WorkspacePetPosition
): WorkspacePetActor {
  const initial = manualPosition
    ? {
      x: Math.max(0, Math.min(Math.max(0, fieldWidth - spriteWidth), manualPosition.x)),
      y: Math.max(0, Math.min(Math.max(0, fieldHeight - spriteHeight), manualPosition.y))
    }
    : workspacePetDefaultPosition(slot, fieldWidth, fieldHeight, spriteWidth, spriteHeight);
  const facing = slot % 2 === 0 ? -1 : 1;
  return {
    x: initial.x,
    y: initial.y,
    vx: facing * workspacePetMovementSpeed(status),
    vy: 0,
    facing,
    lastMoveAt: 0,
    dragging: false,
    manualPosition: Boolean(manualPosition),
    interaction: "",
    interactionUntil: 0
  };
}

function syncWorkspacePetFacing(actor: WorkspacePetActor) {
  if (!actor.vx) return;
  actor.facing = actor.vx < 0 ? -1 : 1;
}

function separateWorkspacePetActors(items: WorkspacePetLoopItem[], fieldWidth: number, fieldHeight: number) {
  const actors = items
    .filter((item) => !item.actor.dragging)
    .map((item) => ({
      ...item,
      radius: Math.max(item.width, item.height) / 2 + 3
    }));

  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 0; index < actors.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < actors.length; otherIndex += 1) {
        const first = actors[index];
        const second = actors[otherIndex];
        const firstCx = first.actor.x + first.width / 2;
        const firstCy = first.actor.y + first.height / 2;
        const secondCx = second.actor.x + second.width / 2;
        const secondCy = second.actor.y + second.height / 2;
        let dx = secondCx - firstCx;
        let dy = secondCy - firstCy;
        let distance = Math.hypot(dx, dy);
        const minDistance = first.radius + second.radius;
        if (distance >= minDistance) continue;
        if (distance < 0.1) {
          dx = index % 2 === 0 ? 1 : -1;
          dy = otherIndex % 2 === 0 ? 1 : -1;
          distance = Math.hypot(dx, dy);
        }
        const push = (minDistance - distance) / 2;
        const nx = dx / distance;
        const ny = dy / distance;
        first.actor.x = Math.max(0, Math.min(Math.max(0, fieldWidth - first.width), first.actor.x - nx * push));
        first.actor.y = Math.max(0, Math.min(workspacePetMaxY(fieldHeight, first.height), first.actor.y - ny * push));
        second.actor.x = Math.max(0, Math.min(Math.max(0, fieldWidth - second.width), second.actor.x + nx * push));
        second.actor.y = Math.max(0, Math.min(workspacePetMaxY(fieldHeight, second.height), second.actor.y + ny * push));
        if (Math.abs(first.actor.vx) > 0 || Math.abs(second.actor.vx) > 0) {
          first.actor.vx = -first.actor.vx;
          second.actor.vx = -second.actor.vx;
          syncWorkspacePetFacing(first.actor);
          syncWorkspacePetFacing(second.actor);
        }
      }
    }
  }
}

function workspacePetFrame(status: WorkspacePetStatus, frame: number, slot: number) {
  if (status === "active") return { row: slot % 2 ? 1 : 2, col: frame % 8 };
  if (status === "starting") return { row: 6, col: frame % 6 };
  if (status === "error") return { row: 5, col: frame % 8 };
  if (status === "sleep") return { row: 8, col: frame % 6 };
  return { row: 0, col: frame % 6 };
}

function workspacePetInterval(status: WorkspacePetStatus) {
  if (status === "active") return 92;
  if (status === "starting") return 132;
  if (status === "error") return 140;
  if (status === "sleep") return 230;
  return 180;
}

function panePetSearchText(pane: WorkspacePane) {
  return [
    pane.id,
    pane.toolId,
    pane.name,
    pane.kind,
    pane.command,
    pane.commandLine
  ].filter(Boolean).join(" ").toLowerCase();
}

function petMatches(pet: PetPackageDescriptor, tokens: string[]) {
  const text = [pet.id, pet.slug, pet.displayName, pet.description].filter(Boolean).join(" ").toLowerCase();
  return tokens.some((token) => text.includes(token));
}

function workspacePetForPane(pane: WorkspacePane, pets: PetPackageDescriptor[], usedPetIds: Set<string>) {
  if (!pets.length) return null;
  const search = panePetSearchText(pane);
  const rule = [
    { match: ["claude"], pets: ["clawd", "clawd-music"] },
    { match: ["hermes"], pets: ["longpaopao"] },
    { match: ["terminal", "powershell", "shell", "pwsh", "cmd"], pets: ["terminal"] },
    { match: ["codex"], pets: ["terminal", "longpaopao"] }
  ].find((item) => item.match.some((token) => search.includes(token)));
  const preferred = rule
    ? pets.find((pet) => !usedPetIds.has(pet.id) && petMatches(pet, rule.pets))
    : null;
  if (preferred) return preferred;
  const defaultOrder = ["clawd", "clawd-music", "longpaopao", "terminal"];
  for (const token of defaultOrder) {
    const pet = pets.find((item) => !usedPetIds.has(item.id) && petMatches(item, [token]));
    if (pet) return pet;
  }
  return pets.find((pet) => !usedPetIds.has(pet.id)) || pets[0];
}

export function petScaleForPackage(pet: PetPackageDescriptor, scales: PetScaleMap) {
  const raw = Number(scales[pet.id] ?? (pet.slug ? scales[pet.slug] : undefined) ?? 1);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.max(0.6, Math.min(2.2, raw));
}

export function petDirectionForPackage(pet: PetPackageDescriptor, directionFixes: PetDirectionFixMap) {
  const raw = Number(directionFixes[pet.id] ?? (pet.slug ? directionFixes[pet.slug] : undefined) ?? 1);
  return raw < 0 ? -1 : 1;
}

export function WorkspacePetCanvas({
  pet,
  status,
  slot,
  label
}: {
  pet: PetPackageDescriptor;
  status: WorkspacePetStatus;
  slot: number;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = new Image();
    image.decoding = "async";
    image.src = pet.spritesheetUrl;
    let raf = 0;
    let frame = 0;
    let lastFrameAt = 0;
    let canceled = false;

    const draw = (timestamp = performance.now()) => {
      if (canceled || !canvas || !image.complete || !image.naturalWidth || !image.naturalHeight) return;
      const size = Math.max(32, Math.round(canvas.getBoundingClientRect().width || 58));
      const pixelRatio = window.devicePixelRatio || 1;
      const targetSize = Math.round(size * pixelRatio);
      if (canvas.width !== targetSize || canvas.height !== targetSize) {
        canvas.width = targetSize;
        canvas.height = targetSize;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      const interval = workspacePetInterval(status);
      if (!lastFrameAt || timestamp - lastFrameAt >= interval) {
        frame += 1;
        lastFrameAt = timestamp;
      }
      const columns = Math.max(1, pet.columns || 8);
      const rows = Math.max(1, pet.rows || 9);
      const { row, col } = workspacePetFrame(status, frame, slot);
      const sourceWidth = image.naturalWidth / columns;
      const sourceHeight = image.naturalHeight / rows;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, size, size);
      context.imageSmoothingEnabled = false;
      context.drawImage(
        image,
        Math.min(columns - 1, col) * sourceWidth,
        Math.min(rows - 1, row) * sourceHeight,
        sourceWidth,
        sourceHeight,
        0,
        0,
        size,
        size
      );
      raf = window.requestAnimationFrame(draw);
    };

    image.onload = () => {
      draw();
    };
    image.onerror = () => {
      const context = canvas.getContext("2d");
      if (!context) return;
      const size = 58;
      canvas.width = size;
      canvas.height = size;
      context.clearRect(0, 0, size, size);
      context.fillStyle = "#7dd3fc";
      context.beginPath();
      context.arc(size / 2, size / 2, 18, 0, Math.PI * 2);
      context.fill();
    };
    if (image.complete) draw();
    return () => {
      canceled = true;
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [pet.spritesheetUrl, pet.columns, pet.rows, status, slot]);

  return <canvas ref={canvasRef} className="meowdesk-workspace-pet-canvas" aria-label={label} />;
}

function WorkspaceTerminalRuntime({
  pane,
  fitSignal,
  sourceCaptureActive = false,
  onStatusChange,
  onSourceSnapshot,
  onClearUserTurns,
  onUserSubmit,
  onConfigurePane
}: {
  pane: WorkspacePane;
  fitSignal?: string;
  sourceCaptureActive?: boolean;
  onStatusChange?: (status: WorkspaceTerminalStatus) => void;
  onSourceSnapshot?: (id: string, snapshot: WorkspaceRendererSourceSnapshot) => void;
  onClearUserTurns?: (id: string) => void;
  onUserSubmit?: (id: string, text: string, source: WorkspaceTerminalSubmitSource) => void;
  onConfigurePane?: (paneId: string) => void;
}) {
  const sessionId = pane.id;
  const ownership = useMemo(() => workspaceRuntimeOwnershipForPane(pane), [pane.id, pane.kind, pane.toolId]);
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XtermTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const sizeKeyRef = useRef("");
  const rawOutputRef = useRef("");
  const sourceEventsRef = useRef<WorkspaceRendererSourceEvent[]>([]);
  const outputFlushTimerRef = useRef<number>(0);
  const dataFitTimerRef = useRef<number>(0);
  const statusPreviewRef = useRef("");
  const statusPreviewRawRef = useRef("");
  const outputSnapshotRef = useRef({
    displayTranscript: "",
    rawPreviewAt: 0,
    semanticKey: "",
    status: "idle"
  });
  const outputUiSampleAtRef = useRef(0);
  const statusRef = useRef<WorkspaceTerminalStatus>("idle");
  const inputDraftRef = useRef("");
  const reattachedRuntimeKeyRef = useRef("");
  const [status, setStatus] = useState<WorkspaceTerminalStatus>("idle");
  const [message, setMessage] = useState("xterm 已就绪，等待启动。");
  const [outputTick, setOutputTick] = useState(0);
  const [outputSample, setOutputSample] = useState("");
  const commandText = (pane.commandLine || [pane.command, ...(pane.args || [])].filter(Boolean).join(" ")).trim() || pane.command || "";
  const canStart = Boolean(pane.toolId && commandText);
  const busy = status === "starting" || status === "running" || status === "stopping";
  const isAgentPane = pane.kind === "agent";

  const fitTerminal = () => {
    const host = hostRef.current;
    const term = termRef.current;
    const fit = fitRef.current;
    if (!host || !term || !fit) return;
    const box = host.getBoundingClientRect();
    if (box.width < 40 || box.height < 40) return;
    try {
      fit.fit();
      const cols = Math.max(20, term.cols || 0);
      const rows = Math.max(8, term.rows || 0);
      host.dataset.r2TerminalCols = String(cols);
      host.dataset.r2TerminalRows = String(rows);
      const sizeKey = `${cols}x${rows}`;
      if (sizeKeyRef.current !== sizeKey) {
        sizeKeyRef.current = sizeKey;
        resizeAgentRuntime(sessionId, cols, rows);
      }
      term.refresh(0, Math.max(0, rows - 1));
    } catch {
      // Grid transitions can briefly leave xterm with a zero-sized host.
    }
  };

  const settleTerminalFit = async () => {
    fitTerminal();
    if (typeof window === "undefined") return;
    for (const delay of [0, 16, 64, 140]) {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => {
          window.requestAnimationFrame(() => {
            fitTerminal();
            resolve();
          });
        }, delay);
      });
    }
  };

  const scheduleFit = () => {
    if (typeof window === "undefined") return;
    for (const delay of [0, 16, 80, 180, 360, 700]) {
      window.setTimeout(() => window.requestAnimationFrame(fitTerminal), delay);
    }
  };

  const scheduleDataFit = () => {
    if (typeof window === "undefined") {
      fitTerminal();
      return;
    }
    if (dataFitTimerRef.current) return;
    dataFitTimerRef.current = window.setTimeout(() => {
      dataFitTimerRef.current = 0;
      window.requestAnimationFrame(fitTerminal);
    }, 180);
  };

  const flushTerminalOutput = () => {
    outputFlushTimerRef.current = 0;
    if (!sourceCaptureActive) return;
    const profile = workspaceRendererProfileForPane(pane);
    const sourceEvents = sourceEventsRef.current;
    const semanticActive = workspaceRendererSourceEventsHaveSemanticAdapterOutput(sourceEvents);
    const semanticKey = semanticActive ? workspaceRendererSourceEventListSignature(sourceEvents) : "";
    const now = Date.now();
    const previousSnapshot = outputSnapshotRef.current;
    const statusValue = statusRef.current;
    const semanticChanged = semanticKey !== previousSnapshot.semanticKey;
    const statusChanged = statusValue !== previousSnapshot.status;
    const rawPreviewDue = now - previousSnapshot.rawPreviewAt >= (profile === "hermes" ? 1400 : 450);
    if (semanticActive && profile === "hermes" && !semanticChanged && !statusChanged && !rawPreviewDue) {
      return;
    }
    const shouldRefreshDisplayTranscript = !semanticActive || profile !== "hermes" || semanticChanged || rawPreviewDue || !previousSnapshot.displayTranscript;
    const statusPreview = workspaceRendererMergeStatusPreview(
      statusPreviewRef.current,
      workspaceRendererStatusPreviewFromTerminalData(statusPreviewRawRef.current)
    );
    statusPreviewRef.current = statusPreview;
    const displayTranscript = shouldRefreshDisplayTranscript
      ? workspaceRendererDisplayTranscriptWithStatusPreview(statusPreview, workspaceTerminalTranscript(termRef.current))
      : previousSnapshot.displayTranscript;
    outputSnapshotRef.current = {
      displayTranscript,
      rawPreviewAt: now,
      semanticKey,
      status: statusValue
    };
    onSourceSnapshot?.(sessionId, {
      id: sessionId,
      ...ownership,
      profile,
      sourceEvents,
      displayTranscript,
      rawTranscript: rawOutputRef.current,
      status: statusValue,
      updatedAt: now
    });
  };

  const scheduleOutputFlush = () => {
    if (!sourceCaptureActive) return;
    if (typeof window === "undefined") {
      flushTerminalOutput();
      return;
    }
    if (outputFlushTimerRef.current) return;
    const profile = workspaceRendererProfileForPane(pane);
    const semanticActive = workspaceRendererSourceEventsHaveSemanticAdapterOutput(sourceEventsRef.current);
    outputFlushTimerRef.current = window.setTimeout(flushTerminalOutput, semanticActive && profile === "hermes" ? 160 : 90);
  };

  const appendTerminalSourceEvents = (events: WorkspaceRendererSourceEvent[]) => {
    if (!events.length) return;
    const existingRaw = sourceEventsRef.current.find((event) => event.kind === "terminal_raw");
    const existingOther = sourceEventsRef.current.filter((event) => event.kind !== "terminal_raw");
    const incomingRaw = events
      .filter((event) => event.kind === "terminal_raw" && event.text)
      .map((event) => event.text || "")
      .join("");
    const incomingOther = events.filter((event) => event.kind !== "terminal_raw");
    const rawText = `${existingRaw?.text || ""}${incomingRaw}`.slice(-128000);
    const latestRaw = [...events].reverse().find((event) => event.kind === "terminal_raw" && event.text) || existingRaw;
    sourceEventsRef.current = [
      ...(rawText
        ? [{
          ...ownership,
          kind: "terminal_raw" as const,
          text: rawText,
          source: latestRaw?.source || "terminal",
          createdAt: latestRaw?.createdAt || Date.now()
        }]
        : []),
      ...workspaceRendererDedupeSourceEvents([...existingOther, ...incomingOther], 400)
    ];
  };

  const recordTerminalInputData = (data: string) => {
    if (!onUserSubmit || !data || data.includes("\u001b")) return;
    let draft = inputDraftRef.current;
    for (const char of Array.from(data)) {
      if (char === "\r" || char === "\n") {
        const text = workspaceRendererNormalizeUserText(draft);
        if (text) onUserSubmit(sessionId, text, "terminal");
        draft = "";
        continue;
      }
      if (char === "\u007f" || char === "\b") {
        draft = draft.slice(0, -1);
        continue;
      }
      if (char >= " ") draft += char;
    }
    inputDraftRef.current = draft.slice(-2000);
  };

  useEffect(() => {
    statusRef.current = status;
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    scheduleFit();
  }, [fitSignal]);

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const handleWorkspaceFit = () => scheduleFit();
    window.addEventListener("meowdesk:workspace-fit-terminals", handleWorkspaceFit);
    return () => window.removeEventListener("meowdesk:workspace-fit-terminals", handleWorkspaceFit);
  }, [sessionId]);

  useEffect(() => {
    if (status !== "idle") scheduleFit();
  }, [status]);

  useEffect(() => {
    let disposed = false;
    if (!canStart || reattachedRuntimeKeyRef.current || statusRef.current !== "idle") {
      return () => {
        disposed = true;
      };
    }
    void reattachAgentRuntime({
      sessionId: ownership.sessionId,
      surfaceId: ownership.surfaceId
    }, { sourceAdapter: sourceCaptureActive }).then((result) => {
      if (disposed || !result.ok) return;
      reattachedRuntimeKeyRef.current = result.descriptor.runtimeKey;
      statusRef.current = "running";
      setStatus("running");
      setMessage("已接回运行中的 Agent runtime。");
      termRef.current?.writeln("\r\n[reattached live runtime]");
      scheduleFit();
      if (sourceCaptureActive) scheduleOutputFlush();
      window.dispatchEvent(new CustomEvent("meowdesk:agent-runtime-refresh"));
    }).catch(() => {});
    return () => {
      disposed = true;
    };
  }, [canStart, ownership, sourceCaptureActive]);

  useEffect(() => {
    void setAgentRuntimeSourceAdapter(sessionId, sourceCaptureActive).catch(() => {});
    if (sourceCaptureActive) {
      scheduleOutputFlush();
      return () => {
        void setAgentRuntimeSourceAdapter(sessionId, false).catch(() => {});
      };
    }
    void setAgentRuntimeSourceAdapter(sessionId, false).catch(() => {});
    if (outputFlushTimerRef.current) window.clearTimeout(outputFlushTimerRef.current);
    outputFlushTimerRef.current = 0;
    rawOutputRef.current = "";
    outputSnapshotRef.current = {
      displayTranscript: "",
      rawPreviewAt: 0,
      semanticKey: "",
      status: statusRef.current
    };
    return () => {
      void setAgentRuntimeSourceAdapter(sessionId, false).catch(() => {});
    };
  }, [sessionId, sourceCaptureActive]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new XtermTerminal({
      cursorBlink: true,
      convertEol: true,
      scrollback: 4000,
      windowsMode: true,
      fontFamily: "Cascadia Mono, Consolas, ui-monospace, monospace",
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 1.12,
      theme: terminalHostTheme()
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      const key = String(event.key || "").toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return true;
      if (key === "c") {
        const selection = term.getSelection();
        if (selection) {
          void optionalWorkbenchApi()?.writeClipboardText(selection);
          return false;
        }
        return Boolean(event.shiftKey);
      }
      if (key === "v") {
        void optionalWorkbenchApi()?.readClipboardText().then((text) => {
          if (text) writeAgentRuntime(sessionId, text);
        });
        return false;
      }
      return true;
    });
    const dataDisposable = term.onData((data) => {
      if (statusRef.current === "running" || statusRef.current === "starting") {
        recordTerminalInputData(data);
        writeAgentRuntime(sessionId, data);
      }
    });
    termRef.current = term;
    fitRef.current = fit;
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(scheduleFit);
      observer.observe(host);
      resizeObserverRef.current = observer;
    }
    window.addEventListener("resize", scheduleFit);
    scheduleFit();

    return () => {
      dataDisposable.dispose();
      window.removeEventListener("resize", scheduleFit);
      if (outputFlushTimerRef.current) window.clearTimeout(outputFlushTimerRef.current);
      outputFlushTimerRef.current = 0;
      if (dataFitTimerRef.current) window.clearTimeout(dataFitTimerRef.current);
      dataFitTimerRef.current = 0;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (statusRef.current === "running" || statusRef.current === "starting" || statusRef.current === "stopping") {
        try {
          void detachAgentRuntime(sessionId).catch(() => {});
        } catch {
          // The bridge may already be gone during window teardown.
        }
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      sizeKeyRef.current = "";
    };
  }, [commandText, pane.name, sessionId]);

  useEffect(() => {
    return attachAgentRuntimeData(sessionId, (event) => {
      if (statusRef.current !== "running") {
        setStatus("running");
      }
      scheduleDataFit();
      const createdAt = Date.now();
      statusPreviewRawRef.current = `${statusPreviewRawRef.current}${event.data}`.slice(-16000);
      statusPreviewRef.current = workspaceRendererMergeStatusPreview(
        statusPreviewRef.current,
        workspaceRendererStatusPreviewFromTerminalData(event.data)
      );
      const upstreamSourceEvents: WorkspaceRendererSourceEvent[] = (event.sourceEvents || []).map((sourceEvent) => ({
        ...ownership,
        kind: sourceEvent.kind,
        text: sourceEvent.text,
        summary: sourceEvent.summary,
        tone: sourceEvent.tone,
        label: sourceEvent.label,
        detail: sourceEvent.detail,
        status: sourceEvent.status,
        source: sourceEvent.source,
        createdAt: sourceEvent.createdAt
      }));
      const incomingSourceEvents = sourceCaptureActive
        ? upstreamSourceEvents
        : upstreamSourceEvents.filter((sourceEvent) => sourceEvent.kind !== "terminal_raw" && sourceEvent.kind !== "terminal_display");
      if (sourceCaptureActive && !incomingSourceEvents.some((sourceEvent) => sourceEvent.kind === "terminal_raw" && sourceEvent.text) && event.data) {
        incomingSourceEvents.push({
          ...ownership,
          kind: "terminal_raw",
          text: event.data,
          source: "terminal",
          createdAt
        });
      }
      appendTerminalSourceEvents(incomingSourceEvents);
      if (sourceCaptureActive) {
        rawOutputRef.current = `${rawOutputRef.current}${event.data}`.slice(-128000);
        scheduleOutputFlush();
      }
      termRef.current?.write(event.data, () => {
        scheduleDataFit();
        if (sourceCaptureActive) scheduleOutputFlush();
      });
      const semanticActive = workspaceRendererSourceEventsHaveSemanticAdapterOutput(sourceEventsRef.current);
      const hasNonRawSourceEvent = incomingSourceEvents.some((sourceEvent) => sourceEvent.kind !== "terminal_raw" && sourceEvent.kind !== "terminal_display");
      const profile = workspaceRendererProfileForPane(pane);
      if (!semanticActive || profile !== "hermes" || hasNonRawSourceEvent || createdAt - outputUiSampleAtRef.current >= 500) {
        outputUiSampleAtRef.current = createdAt;
        setOutputTick((current) => current + 1);
        setOutputSample((current) => `${current}${event.data}`.slice(-600));
      }
    }, ownership);
  }, [onSourceSnapshot, ownership, pane, sessionId, sourceCaptureActive]);

  useEffect(() => {
    return attachAgentRuntimeExit(sessionId, (event) => {
      setStatus(event.exitCode ? "error" : "exited");
      setMessage(`进程已退出：${event.exitCode}`);
      termRef.current?.writeln(`\r\n[process exited: ${event.exitCode}]`);
      flushTerminalOutput();
    }, ownership);
  }, [ownership, sessionId]);

  const handleStart = async () => {
    if (!pane.toolId) {
      setStatus("error");
      setMessage("这个工作窗没有绑定可启动的 toolId。");
      return;
    }
    if (!commandText) {
      setStatus("error");
      setMessage("这个工作窗没有启动命令。");
      return;
    }
    try {
      setStatus("starting");
      setMessage("正在通过旧 terminal IPC 启动。");
      sizeKeyRef.current = "";
      inputDraftRef.current = "";
      rawOutputRef.current = "";
      statusPreviewRef.current = "";
      statusPreviewRawRef.current = "";
      sourceEventsRef.current = [];
      onClearUserTurns?.(sessionId);
      outputSnapshotRef.current = {
        displayTranscript: "",
        rawPreviewAt: 0,
        semanticKey: "",
        status: "starting"
      };
      outputUiSampleAtRef.current = 0;
      setOutputTick(0);
      setOutputSample("");
      termRef.current?.reset();
      if (sourceCaptureActive) {
        onSourceSnapshot?.(sessionId, {
          id: sessionId,
          ...ownership,
          profile: workspaceRendererProfileForPane(pane),
          sourceEvents: [],
          displayTranscript: "",
          rawTranscript: "",
          status: "starting",
          updatedAt: Date.now()
        });
      }
      await settleTerminalFit();
      const initialCols = Math.max(20, Math.round(termRef.current?.cols || Number(hostRef.current?.dataset.r2TerminalCols) || 100));
      const initialRows = Math.max(8, Math.round(termRef.current?.rows || Number(hostRef.current?.dataset.r2TerminalRows) || 30));
      termRef.current?.writeln(`${pane.name} 正在启动...`);
      scheduleFit();
      await startAgentRuntime({
        sessionId,
        toolId: pane.toolId,
        ownership,
        cols: initialCols,
        rows: initialRows,
        toolOverride: {
          name: pane.name,
          args: pane.args || [],
          cwd: pane.cwd || ".",
          replaceExisting: true
        },
        sourceAdapter: sourceCaptureActive
      });
      sizeKeyRef.current = "";
      setStatus("running");
      setMessage("已连接旧 Meowdesk terminal runtime。");
      scheduleFit();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setStatus("error");
      setMessage(text);
      termRef.current?.writeln(`\r\n启动失败：${text}`);
    }
  };

  const showStartPanel = status === "idle" || status === "exited" || (status === "error" && outputTick === 0);

  return (
    <div
      className="meowdesk-workspace-terminal-runtime"
      data-r2-terminal-runtime={sessionId}
      data-runtime-id={ownership.runtimeId}
      data-session-id={ownership.sessionId}
      data-surface-id={ownership.surfaceId}
      data-conversation-id={ownership.conversationId}
      data-agent-id={ownership.agentId}
      data-source-id={ownership.sourceId}
      data-project-id={ownership.projectId}
      data-r2-terminal-runtime-kind={pane.kind}
      data-r2-terminal-runtime-status={status}
      data-r2-terminal-source-capture={sourceCaptureActive ? "active" : "idle"}
      data-r2-terminal-output-tick={outputTick}
      data-r2-terminal-output-sample={outputSample}
      data-r2-terminal-status-preview={statusPreviewRef.current.slice(-500)}
    >
      <div className="meowdesk-workspace-xterm-host" ref={hostRef} data-r2-terminal-host={sessionId} />
      {showStartPanel ? (
        <div
          className={cn("meowdesk-workspace-start-panel", isAgentPane && "is-agent")}
          data-r2-terminal-start-panel={sessionId}
          data-r2-terminal-start-panel-kind={pane.kind}
        >
          {isAgentPane ? (
            <LaunchEmptyState
              variant="workspace-agent"
              icon={<AccessAgentIcon name={pane.name} kind={pane.kind || pane.toolId} size="lg" chrome="none" />}
              iconChrome="tile"
              title={(
                <>
                  <strong>{pane.name}</strong>
                  {workspaceRendererProfileForPane(pane) === "hermes" ? <Badge variant="warning">Hermes Beta</Badge> : null}
                </>
              )}
              meta={commandText || message}
              primaryAction={(
                <Button
                  type="button"
                  variant="outline"
                  className="meowdesk-workspace-launch-button"
                  disabled={!canStart || busy}
                  data-r2-terminal-start={sessionId}
                  onClick={handleStart}
                  title="启动工作区 Agent"
                  aria-label="启动工作区 Agent"
                >
                  <Play size={16} aria-hidden="true" />
                  启动 {pane.name}
                </Button>
              )}
              secondaryAction={(
                <Button
                  type="button"
                  variant="outline"
                  className="meowdesk-workspace-start-change"
                  onClick={() => onConfigurePane?.(pane.id)}
                  data-r2-workspace-change-agent={pane.id}
                >
                  更换
                </Button>
              )}
            />
          ) : (
            <LaunchEmptyState
              variant="workspace-agent"
              icon={(
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="meowdesk-workspace-launch-button"
                  disabled={!canStart || busy}
                  data-r2-terminal-start={sessionId}
                  data-meow-launch-action="primary"
                  onClick={handleStart}
                  title="启动工作窗"
                  aria-label="启动工作窗"
                >
                  <Play size={24} aria-hidden="true" />
                </Button>
              )}
              iconChrome="action"
              title={<strong>启动 {pane.name}</strong>}
              meta={message}
            />
          )}
        </div>
      ) : null}
      {status === "starting" ? (
        <div className="meowdesk-agent-starting-overlay" data-r2-terminal-starting={sessionId}>
          <span className="meowdesk-agent-startup-spinner" aria-hidden="true" />
          <strong>{pane.name} 正在启动</strong>
          <span>{workspaceRendererProfileForPane(pane) === "hermes" ? "Hermes 首次连接可能会多等一会。" : "正在连接本机 Agent runtime。"}</span>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceBrowserPreview({ pane }: { pane: WorkspacePane }) {
  const target = pane.commandLine || pane.command || "http://localhost:3000";
  return (
    <div
      className="grid h-full min-h-0 place-items-center bg-[#080b10] p-5 text-center text-sm text-muted-foreground"
      data-r2-browser-preview-pane={pane.id}
    >
      <div className="grid max-w-[320px] justify-items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-[18px] border border-border bg-background/55 text-primary">
          <Monitor size={24} aria-hidden="true" />
        </span>
        <strong className="text-foreground">{pane.name}</strong>
        <span className="max-w-full truncate font-mono text-xs" data-r2-browser-preview-url={target}>
          {target}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => openExternalUrl(target)} data-r2-browser-preview-open={pane.id}>
          打开预览
        </Button>
      </div>
    </div>
  );
}

function workspaceRendererTerminalSubmitText(text: string) {
  return workspaceRendererNormalizeUserText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function workspaceRendererSourceOptionLabel(pane: WorkspacePane) {
  const label = pane.name || "CLI";
  return workspaceRendererProfileForPane(pane) === "hermes" ? `${label} · Beta` : label;
}

function workspaceRuntimeOwnershipForPane(pane: WorkspacePane) {
  return createAgentRuntimeOwnership({
    surfaceKind: "workspace-pane",
    surfaceLocalId: pane.id,
    sessionId: pane.id,
    agentId: pane.toolId || pane.kind,
    sourceLocalId: pane.id
  });
}

function workspaceRendererSourceSnapshotForPane(pane: WorkspacePane, snapshot?: WorkspaceRendererSourceSnapshot): WorkspaceRendererSourceSnapshot {
  const ownership = workspaceRuntimeOwnershipForPane(pane);
  return {
    id: pane.id,
    ...ownership,
    ...snapshot,
    runtimeId: snapshot?.runtimeId || ownership.runtimeId,
    sessionId: snapshot?.sessionId || ownership.sessionId,
    surfaceId: snapshot?.surfaceId || ownership.surfaceId,
    conversationId: snapshot?.conversationId || ownership.conversationId,
    agentId: snapshot?.agentId || ownership.agentId,
    sourceId: snapshot?.sourceId || ownership.sourceId,
    projectId: snapshot?.projectId || ownership.projectId,
    profile: snapshot?.profile || workspaceRendererProfileForPane(pane),
    status: snapshot?.status || "idle",
    updatedAt: snapshot?.updatedAt || 0
  };
}

function WorkspaceOutputRenderer({
  pane,
  sourcePanes,
  terminalSources,
  terminalStatuses,
  terminalUserTurns,
  onSourceBindingChange,
  onUserSubmit
}: {
  pane: WorkspacePane;
  sourcePanes: WorkspacePane[];
  terminalSources: Record<string, WorkspaceRendererSourceSnapshot>;
  terminalStatuses: Record<string, WorkspaceTerminalStatus>;
  terminalUserTurns: Record<string, WorkspaceTerminalUserTurn[]>;
  onSourceBindingChange: (rendererPaneId: string, sourcePaneId: string) => void;
  onUserSubmit: (id: string, text: string, source: WorkspaceTerminalSubmitSource) => void;
}) {
  const bindablePanes = sourcePanes.filter((item) => item.id !== pane.id && (item.kind === "agent" || item.kind === "terminal"));
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const lastSourceIdRef = useRef("");

  useEffect(() => {
    setSelectedSourceId((current) => {
      if (current && bindablePanes.some((item) => item.id === current)) return current;
      return "";
    });
  }, [bindablePanes.map((item) => item.id).join("|")]);

  useEffect(() => {
    onSourceBindingChange(pane.id, selectedSourceId);
    return () => onSourceBindingChange(pane.id, "");
  }, [onSourceBindingChange, pane.id, selectedSourceId]);

  const selectedSource = bindablePanes.find((item) => item.id === selectedSourceId) || null;
  const profile = selectedSource ? workspaceRendererProfileForPane(selectedSource) : "other";
  const rawSourceSnapshot = selectedSource ? terminalSources[selectedSource.id] : undefined;
  const sourceSnapshot = selectedSource ? workspaceRendererSourceSnapshotForPane(selectedSource, rawSourceSnapshot) : undefined;
  const sourceVersion = sourceSnapshot?.updatedAt || 0;
  const sourceEvents = sourceSnapshot?.sourceEvents || [];
  const semanticActive = selectedSource ? workspaceRendererSourceEventsHaveSemanticAdapterOutput(sourceEvents) : false;
  const sourceEventsParseKey = semanticActive
    ? workspaceRendererSourceEventListSignature(sourceEvents)
    : sourceEvents.map(workspaceRendererSourceEventSignature).join("\u0002");
  const parseDisplayTranscript = sourceSnapshot?.displayTranscript || "";
  const parseRawTranscript = semanticActive ? "" : sourceSnapshot?.rawTranscript || "";
  const sourceRawPreview = sourceSnapshot?.rawTranscript || sourceSnapshot?.displayTranscript || "";
  const selectedUserTurns = selectedSource ? terminalUserTurns[selectedSource.id] || [] : [];
  const sourceStatus = selectedSource ? terminalStatuses[selectedSource.id] || sourceSnapshot?.status || "idle" : "idle";
  const parsedOutput = useMemo(() => selectedSource
    ? workspaceRendererParseSourceSnapshot({
      id: selectedSource.id,
      profile,
      displayTranscript: parseDisplayTranscript,
      rawTranscript: parseRawTranscript,
      sourceEvents,
      userTurns: selectedUserTurns,
      status: sourceStatus,
      updatedAt: sourceVersion
    })
    : { sourceEvents: [], events: [], segments: [], statusItems: [], permissionPrompt: null },
  [
    selectedSource?.id,
    profile,
    parseDisplayTranscript,
    parseRawTranscript,
    sourceEventsParseKey,
    selectedUserTurns,
    sourceStatus
  ]);
  const renderedSegments = parsedOutput.segments;
  const rendererStatusItems = parsedOutput.statusItems;
  const pendingReplyIndex = workspaceRendererPendingReplyIndex(renderedSegments, sourceStatus);
  const visibleStatusItems = pendingReplyIndex >= 0 || sourceStatus === "starting"
    ? rendererStatusItems
    : rendererStatusItems.filter((item) => item.tone !== "thinking");
  const permissionPrompt = parsedOutput.permissionPrompt;
  const rendererEvents = parsedOutput.events;
  const rendererSourceEvents = parsedOutput.sourceEvents;

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !selectedSource) return;
    const sourceChanged = lastSourceIdRef.current !== selectedSource.id;
    if (sourceChanged) {
      lastSourceIdRef.current = selectedSource.id;
      autoFollowRef.current = true;
    }
    if (autoFollowRef.current) body.scrollTop = body.scrollHeight;
  }, [sourceVersion, renderedSegments.length, selectedSource?.id, selectedUserTurns.length]);

  const handleBodyScroll = () => {
    const body = bodyRef.current;
    if (!body) return;
    autoFollowRef.current = body.scrollHeight - body.scrollTop - body.clientHeight <= 56;
  };

  const sendTextToSelectedSource = (value: string) => {
    if (!selectedSource) return;
    const text = workspaceRendererNormalizeUserText(value);
    if (!text || sourceStatus !== "running") return;
    const terminalText = workspaceRendererTerminalSubmitText(text);
    onUserSubmit(selectedSource.id, text, "renderer");
    writeAgentRuntime(selectedSource.id, terminalText);
    window.setTimeout(() => writeAgentRuntime(selectedSource.id, "\r"), 18);
    autoFollowRef.current = true;
    window.setTimeout(() => {
      const body = bodyRef.current;
      if (body) body.scrollTop = body.scrollHeight;
    }, 0);
  };

  const handlePermissionChoice = (value: string) => {
    if (!selectedSource || sourceStatus !== "running") return;
    autoFollowRef.current = true;
    writeAgentRuntime(selectedSource.id, value);
    window.setTimeout(() => writeAgentRuntime(selectedSource.id, "\r"), 18);
  };

  return (
    <div
      className="meowdesk-output-renderer"
      data-r2-output-renderer={pane.id}
      data-r2-output-renderer-source={selectedSource?.id || ""}
      data-r2-output-renderer-runtime-id={sourceSnapshot?.runtimeId || ""}
      data-r2-output-renderer-session-id={sourceSnapshot?.sessionId || ""}
      data-r2-output-renderer-surface-id={sourceSnapshot?.surfaceId || ""}
      data-r2-output-renderer-conversation-id={sourceSnapshot?.conversationId || ""}
      data-r2-output-renderer-source-id={sourceSnapshot?.sourceId || ""}
      data-r2-output-renderer-project-id={sourceSnapshot?.projectId || ""}
      data-r2-output-renderer-profile={profile}
      data-r2-output-renderer-status={sourceStatus}
      data-r2-output-renderer-events={rendererEvents.length}
      data-r2-output-renderer-source-events={rendererSourceEvents.length}
      data-r2-output-renderer-status-preview={workspaceRendererStatusPreviewFromTerminalData(parseDisplayTranscript).slice(-500)}
    >
      {selectedSource ? <WorkspaceRendererStatusPanel items={visibleStatusItems} /> : null}
      <div ref={bodyRef} className="meowdesk-output-renderer-body" data-r2-output-renderer-content onScroll={handleBodyScroll}>
        {!selectedSource ? (
          <div className="meowdesk-output-renderer-bind" data-r2-output-renderer-empty="no-source">
            <LaunchEmptyState
              variant="meow-viewer-bind"
              icon={<FileText size={28} />}
              title={<strong>Meow Viewer</strong>}
              meta={bindablePanes.length ? "选择一个 CLI 工作窗作为渲染来源" : "先启动一个 CLI 工作窗"}
              primaryAction={(
                <button
                  type="button"
                  className="meowdesk-workspace-launch-button meowdesk-output-renderer-bind-action"
                  disabled={!bindablePanes.length}
                  onClick={() => {
                    const firstSource = bindablePanes[0];
                    if (firstSource) setSelectedSourceId(firstSource.id);
                  }}
                  data-r2-output-renderer-bind-button
                  data-r2-output-renderer-bind-target={bindablePanes[0]?.id || ""}
                  title={bindablePanes.length ? "绑定 CLI" : "没有可绑定的 CLI 工作窗"}
                  aria-label={bindablePanes.length ? "绑定 CLI" : "没有可绑定的 CLI 工作窗"}
                >
                  <Play size={16} aria-hidden="true" />
                  {bindablePanes.length ? "绑定 CLI" : "没有可绑定的 CLI"}
                </button>
              )}
            />
          </div>
        ) : renderedSegments.length ? (
          <div className="meowdesk-output-renderer-stream" data-r2-output-renderer-stream>
            <WorkspaceRenderedConversation
              segments={renderedSegments}
              profile={profile}
              statusItems={rendererStatusItems}
              sourceStatus={sourceStatus}
            />
          </div>
        ) : (
          <div className="meowdesk-output-renderer-empty" data-r2-output-renderer-empty="no-output">
            <Sparkles size={24} aria-hidden="true" />
            <strong>等待 {selectedSource.name} 输出</strong>
            <span>CLI 原始输出仍在旁边的 terminal 中，页面渲染会自动跟随。</span>
          </div>
        )}
      </div>
      {selectedSource ? (
        <MeowViewerComposer
          surface="workspace"
          profile={profile}
          targetName={selectedSource.name}
          running={sourceStatus === "running"}
          onSendText={sendTextToSelectedSource}
          permissionSlot={permissionPrompt ? (
            <section className="meowdesk-output-renderer-permission" aria-label={permissionPrompt.title} data-r2-output-renderer-permission>
              <div className="meowdesk-output-renderer-permission-head">
                <strong>{permissionPrompt.title}</strong>
                <span>{permissionPrompt.detail}</span>
              </div>
              <div className="meowdesk-output-renderer-permission-actions">
                {permissionPrompt.choices.map((choice) => (
                  <Button
                    key={choice.value}
                    type="button"
                    variant={choice.tone}
                    size="sm"
                    onClick={() => handlePermissionChoice(choice.value)}
                    data-r2-output-renderer-permission-choice={choice.value}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}
        />
      ) : null}
      {selectedSource && sourceRawPreview ? (
        <details className="meowdesk-output-renderer-raw" data-r2-output-renderer-raw>
          <summary>原始片段</summary>
          <pre>{workspaceRendererStripTerminalControls(sourceRawPreview).slice(-2400)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function openTaskCenterRoute() {
  if (typeof window === "undefined") return;
  if (window.location.hash === "#tasks") return;
  window.location.hash = "#tasks";
}

function WorkspacePriorityTaskBoard({ summary }: { summary: WorkbenchSummary }) {
  const [tasks, setTasks] = useState<TaskCenterTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [savingTaskId, setSavingTaskId] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(sortTasks(await readTaskCenterTasks()));
      setStatus("");
    } catch (error) {
      setStatus(`任务读取失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
    window.addEventListener(TASK_CENTER_TASKS_CHANGED_EVENT, loadTasks);
    return () => window.removeEventListener(TASK_CENTER_TASKS_CHANGED_EVENT, loadTasks);
  }, [loadTasks]);

  const activeTasks = tasks.filter(taskIsActive);
  const priorityTasks = sortTasksForBoard(activeTasks).slice(0, 1);
  const extraCount = Math.max(0, activeTasks.length - priorityTasks.length);

  const runTaskAction = async (action: TaskAction, task: TaskCenterTask) => {
    setSavingTaskId(task.id);
    try {
      const nextTasks = sortTasks(tasksAfterAction(tasks, action, task));
      await writeTaskCenterTasks(nextTasks);
      setTasks(nextTasks);
      notifyTaskCenterTasksChanged(nextTasks);
      summary.refresh();
      setStatus(`「${task.title}」${taskActionText(action)}。`);
    } catch (error) {
      setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSavingTaskId("");
    }
  };

  return (
    <div
      className="grid max-h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-1.5 text-xs"
      data-r2-workspace-task-board
      data-r2-workspace-task-count={tasks.length}
      data-r2-workspace-task-active-count={activeTasks.length}
    >
      <div className="grid min-h-0 content-start gap-1 overflow-hidden" data-r2-workspace-task-list>
        {loading ? (
          <div className="rounded-md border border-border bg-background/45 px-2 py-2 text-muted-foreground" data-r2-workspace-task-loading>
            正在读取任务...
          </div>
        ) : priorityTasks.length ? priorityTasks.map((task) => {
          const primary = primaryTaskAction(task);
          const saving = savingTaskId === task.id;
          return (
            <article
              key={task.id}
              className="min-w-0 rounded-md border border-border bg-surface/70 px-2 py-1"
              data-r2-workspace-task-card={task.id}
              data-r2-workspace-task-card-status={task.status}
            >
              <div className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-1.5">
                <TaskSourceIcon task={task} size="sm" />
                <button type="button" className="min-w-0 text-left" onClick={openTaskCenterRoute}>
                  <strong className="block min-w-0 truncate text-[12px] leading-4">{task.title}</strong>
                  <span className="block min-w-0 truncate text-[10px] leading-3 text-muted-foreground">
                    {taskSourceLabel(task)} · {taskTimeValue(task)} · {taskTagBadgeLabel(taskPrimaryTag(task))}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 shrink-0 px-1.5 text-[11px]"
                  disabled={saving}
                  data-r2-workspace-task-action={primary}
                  data-r2-workspace-task-action-id={task.id}
                  onClick={() => void runTaskAction(primary, task)}
                >
                  <Activity size={12} aria-hidden="true" />
                  {taskActions(task).find(([action]) => action === primary)?.[1] || "推进"}
                </Button>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-md border border-dashed border-border bg-background/45 px-2 py-2 text-muted-foreground" data-r2-workspace-task-empty>
            暂无待处理任务
          </div>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 truncate" data-r2-workspace-task-status>
          {status || (extraCount ? `另 ${extraCount} 项在任务中心` : "与任务中心同步")}
        </span>
        <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 px-1.5 text-[11px]" onClick={openTaskCenterRoute} data-r2-workspace-task-open-center>
          任务中心
        </Button>
      </div>
    </div>
  );
}

export function WorkspaceRoute({
  summary,
  slotCount,
  rightSidebarCollapsed = false,
  fitSignal = "",
  hiddenPaneRestoreRequest = "",
  onSlotCountChange,
  onHiddenPanesChange
}: {
  summary: WorkbenchSummary;
  slotCount: number;
  rightSidebarCollapsed?: boolean;
  fitSignal?: string;
  hiddenPaneRestoreRequest?: string;
  onSlotCountChange?: (count: number) => void;
  onHiddenPanesChange?: (panes: WorkspaceHiddenPaneSummary[]) => void;
}) {
  const normalizedSlotCount = clampWorkspaceSlotCount(slotCount);
  const baseSourcePanes = workspacePanes(summary);
  const sourcePaneIds = baseSourcePanes.map((pane) => pane.id).join("|");
  const configChoices = workspaceConfigChoices(summary);
  const openTasks = summary.openTaskCount ?? 0;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(rightSidebarCollapsed);
  const [maximizedPaneId, setMaximizedPaneId] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(readWorkspaceSidebarWidth);
  const [boardHeight, setBoardHeight] = useState(readWorkspaceBoardHeight);
  const [petHeight, setPetHeight] = useState(readWorkspacePetHeight);
  const [widgetHeights, setWidgetHeights] = useState<Record<string, number>>(readWorkspaceSidebarWidgetHeights);
  const [enabledWidgetIds, setEnabledWidgetIds] = useState(() => readWorkspaceEnabledSidebarWidgetIds(summary.sidebarWidgetRuntimes));
  const [hiddenPaneIds, setHiddenPaneIds] = useState<string[]>([]);
  const [closedPaneIds, setClosedPaneIds] = useState<string[]>([]);
  const [terminalStatuses, setTerminalStatuses] = useState<Record<string, WorkspaceTerminalStatus>>({});
  const [terminalSources, setTerminalSources] = useState<Record<string, WorkspaceRendererSourceSnapshot>>({});
  const [terminalUserTurns, setTerminalUserTurns] = useState<Record<string, WorkspaceTerminalUserTurn[]>>({});
  const [outputRendererBindings, setOutputRendererBindings] = useState<Record<string, string>>({});
  const [configuredPanes, setConfiguredPanes] = useState<Record<string, WorkspacePane>>(readWorkspaceConfiguredPanes);
  const [paneOrder, setPaneOrder] = useState<string[]>(readWorkspacePaneOrder);
  const [configuringPaneId, setConfiguringPaneId] = useState("");
  const [freshPaneIds, setFreshPaneIds] = useState<string[]>([]);
  const [configuredPulsePaneIds, setConfiguredPulsePaneIds] = useState<string[]>([]);
  const [confirmingClosePaneId, setConfirmingClosePaneId] = useState("");
  const [petPackages, setPetPackages] = useState<PetPackageDescriptor[]>([]);
  const [petScales, setPetScales] = useState<PetScaleMap>({});
  const [petDirectionFixes, setPetDirectionFixes] = useState<PetDirectionFixMap>({});
  const [petPositions, setPetPositions] = useState<Record<string, WorkspacePetPosition>>(readWorkspacePetPositions);
  const [petInteractions, setPetInteractions] = useState<Record<string, WorkspacePetInteraction>>({});
  const [draggingPetId, setDraggingPetId] = useState("");
  const [draggingPaneId, setDraggingPaneId] = useState("");
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const [resizingBoard, setResizingBoard] = useState(false);
  const [resizingPet, setResizingPet] = useState(false);
  const enabledWidgetIdSet = useMemo(() => new Set(enabledWidgetIds), [enabledWidgetIds]);
  const hiddenPaneIdSet = useMemo(() => new Set(hiddenPaneIds), [hiddenPaneIds]);
  const closedPaneIdSet = useMemo(() => new Set(closedPaneIds), [closedPaneIds]);
  const configuredPaneIds = Object.keys(configuredPanes).join("|");
  const paneOrderKey = paneOrder.join("|");
  const sourcePanes = useMemo(() => orderWorkspacePanes(baseSourcePanes, paneOrder), [sourcePaneIds, paneOrderKey]);
  const activeSourcePanes = sourcePanes.filter((pane) => !closedPaneIdSet.has(pane.id));
  const gridPanes = workspaceGridPanes(activeSourcePanes, normalizedSlotCount, paneOrder).map((pane) => {
    const configuredPane = pane.kind === "blank" ? configuredPanes[pane.id] : undefined;
    return configuredPane || pane;
  });
  const gridPaneIds = gridPanes.map((pane) => pane.id).join("|");
  const activeGridPanes = gridPanes.filter((pane) => !closedPaneIdSet.has(pane.id));
  const visibleGridPanes = activeGridPanes.filter((pane) => !hiddenPaneIdSet.has(pane.id));
  const hiddenGridPanes = activeGridPanes.filter((pane) => hiddenPaneIdSet.has(pane.id));
  const panes = orderWorkspacePanes(visibleGridPanes, paneOrder);
  const hiddenPanes = orderWorkspacePanes(hiddenGridPanes, paneOrder);
  const hiddenPaneSummaryKey = hiddenPanes.map((pane) => `${pane.id}:${pane.name}:${pane.kind}`).join("|");
  const effectiveSlotCount = clampWorkspaceSlotCount(Math.max(1, panes.length));
  const paneLookup = [...panes, ...hiddenPanes];
  const confirmingClosePane = paneLookup.find((pane) => pane.id === confirmingClosePaneId)
    || sourcePanes.find((pane) => pane.id === confirmingClosePaneId)
    || configuredPanes[confirmingClosePaneId];
  const paneIds = panes.map((pane) => pane.id).join("|");
  const paneIdSet = useMemo(() => new Set(panes.map((pane) => pane.id)), [paneIds]);
  const outputRendererBindingKey = Object.entries(outputRendererBindings)
    .map(([rendererPaneId, sourcePaneId]) => `${rendererPaneId}:${sourcePaneId}`)
    .sort()
    .join("|");
  const activeOutputSourceIds = useMemo(() => new Set(
    Object.values(outputRendererBindings).filter(Boolean)
  ), [outputRendererBindingKey]);
  const sidebarWidgets = summary.sidebarWidgetRuntimes.filter((widget) => enabledWidgetIdSet.has(widget.id)).slice(0, 3);
  const loadableWidgetCount = sidebarWidgets.filter((widget) => widget.readiness === "loadable").length;
  const usedPetIds = new Set<string>();
  const workspacePetPanes = [...activeSourcePanes, ...Object.values(configuredPanes)].filter((pane) => pane.kind !== "renderer");
  const workspacePets = workspacePetPanes.slice(0, 3).map((pane, index) => {
    const pet = workspacePetForPane(pane, petPackages, usedPetIds);
    if (pet) usedPetIds.add(pet.id);
    return {
      pane,
      pet,
      slot: index + 1,
      status: workspacePetStatusForPane(pane, terminalStatuses, hiddenPaneIdSet)
    };
  });
  const primaryWorkspacePet = workspacePets[0];
  const workspacePetLoopKey = workspacePets.map((pet) => `${pet.pane.id}:${pet.pet?.id || "none"}:${pet.slot}:${pet.status}`).join("|");
  const sidebarWidgetFitKey = sidebarWidgets.map((widget) => `${widget.id}:${widget.minHeight || ""}:${widget.preferredHeight || ""}`).join("|");
  const sidebarInventoryKey = summary.sidebarWidgetRuntimes.map((widget) => `${widget.id}:${widget.readiness}:${widget.entryPath || ""}`).join("|");
  const workspaceTerminalFitKey = [
    fitSignal,
    normalizedSlotCount,
    effectiveSlotCount,
    paneIds,
    gridPaneIds,
    maximizedPaneId,
    sidebarCollapsed,
    sidebarWidth,
    hiddenPaneSummaryKey
  ].join(":");
  const workspaceShellRef = useRef<HTMLDivElement>(null);
  const workspaceSidebarRef = useRef<HTMLElement>(null);
  const sidebarResizeHandleRef = useRef<HTMLDivElement>(null);
  const boardResizeHandleRef = useRef<HTMLDivElement>(null);
  const petResizeHandleRef = useRef<HTMLDivElement>(null);
  const previousSlotCountRef = useRef(normalizedSlotCount);
  const sidebarWidthDragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const boardHeightDragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const petHeightDragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const petDragRef = useRef<{
    pointerId: number;
    paneId: string;
    offsetX: number;
    offsetY: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    lastX?: number;
    lastY?: number;
  } | null>(null);
  const petFieldRef = useRef<HTMLDivElement>(null);
  const petActorsRef = useRef(new Map<string, WorkspacePetActor>());
  const petRafRef = useRef(0);
  const petPositionsRef = useRef(petPositions);
  const petInteractionTimersRef = useRef(new Map<string, number>());
  const programmaticResizeEndTimerRef = useRef(0);

  useEffect(() => {
    setMaximizedPaneId((current) => (current && !paneIdSet.has(current) ? "" : current));
  }, [paneIdSet]);

  useEffect(() => {
    const previousSlotCount = previousSlotCountRef.current;
    if (previousSlotCount === normalizedSlotCount) return;
    previousSlotCountRef.current = normalizedSlotCount;
    if (normalizedSlotCount > previousSlotCount && typeof window !== "undefined") {
      const addedIds = Array.from({ length: normalizedSlotCount - previousSlotCount }, (_, index) => `blank-${previousSlotCount + index + 1}`);
      setFreshPaneIds((current) => Array.from(new Set([...current, ...addedIds])));
      window.setTimeout(() => {
        setFreshPaneIds((current) => current.filter((id) => !addedIds.includes(id)));
      }, 1400);
    }
    setClosedPaneIds((current) => current.filter((id) => !isWorkspaceOrderSlotId(id)));
  }, [normalizedSlotCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const markFreshPanes = (event: Event) => {
      const detail = (event as CustomEvent<{ previous?: number; next?: number }>).detail || {};
      const previous = clampWorkspaceSlotCount(Number(detail.previous) || normalizedSlotCount);
      const next = clampWorkspaceSlotCount(Number(detail.next) || normalizedSlotCount);
      if (next <= previous) return;
      const addedIds = Array.from({ length: next - previous }, (_, index) => `blank-${previous + index + 1}`);
      setFreshPaneIds((current) => Array.from(new Set([...current, ...addedIds])));
      window.setTimeout(() => {
        setFreshPaneIds((current) => current.filter((id) => !addedIds.includes(id)));
      }, 1400);
    };
    window.addEventListener("meowdesk:workspace-pane-count-intent", markFreshPanes);
    return () => window.removeEventListener("meowdesk:workspace-pane-count-intent", markFreshPanes);
  }, [normalizedSlotCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const delay of [0, 16, 80, 180, 360]) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("meowdesk:workspace-fit-terminals", {
          detail: { key: workspaceTerminalFitKey }
        }));
      }, delay);
    }
  }, [workspaceTerminalFitKey]);

  useEffect(() => {
    writeWorkspaceSidebarWidth(sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    writeWorkspaceBoardHeight(boardHeight);
  }, [boardHeight]);

  useEffect(() => {
    writeWorkspacePetHeight(petHeight);
  }, [petHeight]);

  useEffect(() => {
    const refreshWorkspaceModelStorage = () => {
      setSidebarWidth(readWorkspaceSidebarWidth());
      setBoardHeight(readWorkspaceBoardHeight());
      setPetHeight(readWorkspacePetHeight());
      setWidgetHeights(readWorkspaceSidebarWidgetHeights());
      setEnabledWidgetIds(readWorkspaceEnabledSidebarWidgetIds(summary.sidebarWidgetRuntimes));
      setConfiguredPanes(readWorkspaceConfiguredPanes());
      setPaneOrder(readWorkspacePaneOrder());
      setPetPositions(readWorkspacePetPositions());
    };
    const disposeHydration = hydrateWorkspaceModelStorage(refreshWorkspaceModelStorage);
    return disposeHydration;
  }, [summary.sidebarWidgetRuntimes]);

  useEffect(() => {
    let canceled = false;
    listPets()
      .then((result) => {
        if (!canceled) setPetPackages(result.pets);
      })
      .catch(() => {
        if (!canceled) setPetPackages([]);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const refreshPetSettings = async () => {
      try {
        const [scales, directionFixes] = await Promise.all([readPetScales(), readPetDirectionFixes()]);
        if (canceled) return;
        setPetScales(scales);
        setPetDirectionFixes(directionFixes);
      } catch {
        if (canceled) return;
        setPetScales({});
        setPetDirectionFixes({});
      }
    };
    void refreshPetSettings();
    window.addEventListener("meowdesk:pet-settings-changed", refreshPetSettings);
    return () => {
      canceled = true;
      window.removeEventListener("meowdesk:pet-settings-changed", refreshPetSettings);
    };
  }, []);

  useEffect(() => {
    petPositionsRef.current = petPositions;
  }, [petPositions]);

  useEffect(() => {
    return () => {
      if (petRafRef.current) {
        window.clearTimeout(petRafRef.current);
        petRafRef.current = 0;
      }
      for (const timer of petInteractionTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      petInteractionTimersRef.current.clear();
      if (programmaticResizeEndTimerRef.current) {
        window.clearTimeout(programmaticResizeEndTimerRef.current);
        programmaticResizeEndTimerRef.current = 0;
      }
    };
  }, []);

  const triggerPetJump = useCallback((paneId: string) => {
    if (typeof window === "undefined") return;
    const actor = petActorsRef.current.get(paneId);
    const now = performance.now();
    if (actor) {
      actor.interaction = "jump";
      actor.interactionUntil = now + 760;
      actor.lastMoveAt = now;
    }
    setPetInteractions((current) => ({ ...current, [paneId]: "jump" }));
    const previousTimer = petInteractionTimersRef.current.get(paneId);
    if (previousTimer) window.clearTimeout(previousTimer);
    const timer = window.setTimeout(() => {
      setPetInteractions((current) => {
        if (current[paneId] !== "jump") return current;
        const next = { ...current };
        delete next[paneId];
        return next;
      });
      const currentActor = petActorsRef.current.get(paneId);
      if (currentActor?.interaction === "jump" && performance.now() >= currentActor.interactionUntil) {
        currentActor.interaction = "";
        currentActor.interactionUntil = 0;
      }
      petInteractionTimersRef.current.delete(paneId);
    }, 820);
    petInteractionTimersRef.current.set(paneId, timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const actorKeys = new Set(workspacePets.filter((pet) => pet.pet).map((pet) => pet.pane.id));
    for (const key of petActorsRef.current.keys()) {
      if (!actorKeys.has(key)) petActorsRef.current.delete(key);
    }
    if (petRafRef.current) {
      window.clearTimeout(petRafRef.current);
      petRafRef.current = 0;
    }

    const tick = () => {
      const timestamp = performance.now();
      const field = petFieldRef.current;
      if (!field) {
        petRafRef.current = window.setTimeout(tick, 33);
        return;
      }
      const fieldRect = field.getBoundingClientRect();
      const sprites = [...field.querySelectorAll<HTMLElement>("[data-r2-workspace-pet-sprite]")];
      const loopItems: WorkspacePetLoopItem[] = [];
      for (const [index, sprite] of sprites.entries()) {
        const paneId = sprite.getAttribute("data-r2-workspace-pet-sprite") || "";
        if (!paneId) continue;
        const status = (sprite.getAttribute("data-r2-workspace-pet-sprite-status") || "idle") as WorkspacePetStatus;
        const slot = Number(sprite.getAttribute("data-r2-workspace-pet-slot")) || index + 1;
        const directionFix = Number(sprite.getAttribute("data-r2-workspace-pet-direction-fix")) < 0 ? -1 : 1;
        const spriteWidth = sprite.offsetWidth || 72;
        const spriteHeight = sprite.offsetHeight || 62;
        const maxX = Math.max(0, fieldRect.width - spriteWidth);
        const maxY = workspacePetMaxY(fieldRect.height, spriteHeight);
        let actor = petActorsRef.current.get(paneId);
        if (!actor) {
          actor = createWorkspacePetActor(
            slot,
            status,
            fieldRect.width,
            fieldRect.height,
            spriteWidth,
            spriteHeight,
            petPositionsRef.current[paneId]
          );
          petActorsRef.current.set(paneId, actor);
        }
        if (petPositionsRef.current[paneId]) {
          actor.manualPosition = true;
        }

        actor.x = Math.max(0, Math.min(maxX, actor.x));
        actor.y = Math.max(0, Math.min(maxY, actor.y));
        const previousX = actor.x;
        const previousY = actor.y;
        const speed = workspacePetMovementSpeed(status);
        if (!actor.dragging) {
          if (speed <= 0) {
            actor.vx = 0;
            actor.vy = 0;
          } else {
            if (!actor.vx) actor.vx = (actor.facing < 0 ? -1 : 1) * speed;
            actor.vx = (actor.vx < 0 ? -1 : 1) * speed;
            actor.vy = 0;
            const dt = Math.min(0.05, (timestamp - (actor.lastMoveAt || timestamp)) / 1000);
            actor.x += actor.vx * dt;
            actor.y += actor.vy * dt;
            if (actor.x <= 0 || actor.x >= maxX) {
              actor.x = Math.max(0, Math.min(maxX, actor.x));
              actor.vx = Math.abs(actor.vx) * (actor.x <= 0 ? 1 : -1);
              actor.facing = actor.vx < 0 ? -1 : 1;
            } else if (actor.vx) {
              actor.facing = actor.vx < 0 ? -1 : 1;
            }
            if (actor.y <= 0 || actor.y >= maxY) {
              actor.y = Math.max(0, Math.min(maxY, actor.y));
              actor.vy = Math.abs(actor.vy) * (actor.y <= 0 ? 1 : -1);
            }
          }
        }

        if (actor.interaction && actor.interactionUntil && timestamp > actor.interactionUntil) {
          actor.interaction = "";
          actor.interactionUntil = 0;
        }
        const interaction = actor.interaction && timestamp <= actor.interactionUntil ? actor.interaction : "";
        loopItems.push({
          sprite,
          actor,
          width: spriteWidth,
          height: spriteHeight,
          previousX,
          previousY,
          directionFix,
          speed,
          interaction
        });
        actor.lastMoveAt = timestamp;
      }

      separateWorkspacePetActors(loopItems, fieldRect.width, fieldRect.height);
      for (const item of loopItems) {
        const { actor, directionFix, interaction, speed, sprite } = item;
        const paneId = sprite.getAttribute("data-r2-workspace-pet-sprite") || "";
        const hasManualPosition = actor.manualPosition || Boolean(paneId && petPositionsRef.current[paneId]);
        const frameDx = actor.x - item.previousX;
        const frameDy = actor.y - item.previousY;
        if (speed > 0 && !actor.dragging && Math.abs(frameDx) > 0.1) {
          actor.facing = frameDx < 0 ? -1 : 1;
        }
        const visualDirection = (actor.facing < 0 ? -1 : 1) * directionFix;
        sprite.style.setProperty("--r2-workspace-pet-visual-direction", String(visualDirection));
        sprite.style.setProperty("--r2-workspace-pet-x", `${Math.round(actor.x)}px`);
        sprite.style.setProperty("--r2-workspace-pet-y", `${Math.round(actor.y)}px`);
        sprite.dataset.r2WorkspacePetMotion = speed > 0 && !actor.dragging ? "moving" : "still";
        sprite.dataset.r2WorkspacePetFacing = actor.facing < 0 ? "left" : "right";
        sprite.dataset.r2WorkspacePetX = String(Math.round(actor.x));
        sprite.dataset.r2WorkspacePetY = String(Math.round(actor.y));
        if (hasManualPosition) {
          sprite.dataset.r2WorkspacePetManualPosition = "true";
          sprite.classList.add("is-positioned");
        } else {
          delete sprite.dataset.r2WorkspacePetManualPosition;
          sprite.classList.remove("is-positioned");
        }
        sprite.dataset.r2WorkspacePetFrameDx = String(Math.round(frameDx * 100) / 100);
        sprite.dataset.r2WorkspacePetFrameDy = String(Math.round(frameDy * 100) / 100);
        if (interaction) {
          sprite.dataset.r2WorkspacePetInteraction = interaction;
        } else {
          delete sprite.dataset.r2WorkspacePetInteraction;
        }
        sprite.classList.toggle("is-jumping", interaction === "jump");
      }
      petRafRef.current = window.setTimeout(tick, 33);
    };

    petRafRef.current = window.setTimeout(tick, 0);
    return () => {
      if (petRafRef.current) {
        window.clearTimeout(petRafRef.current);
        petRafRef.current = 0;
      }
    };
  }, [workspacePetLoopKey]);

  useEffect(() => {
    const knownIds = new Set([
      ...sourcePanes.map((pane) => pane.id),
      ...Object.keys(configuredPanes),
      ...gridPanes.map((pane) => pane.id)
    ]);
    setHiddenPaneIds((current) => current.filter((id) => knownIds.has(id)));
    setClosedPaneIds((current) => current.filter((id) => knownIds.has(id)));
    setTerminalStatuses((current) => Object.fromEntries(Object.entries(current).filter(([id]) => knownIds.has(id))));
    setPaneOrder((current) => {
      const next = current.filter((id) => knownIds.has(id));
      if (next.length === current.length) return current;
      writeWorkspacePaneOrder(next);
      return next;
    });
  }, [configuredPaneIds, gridPaneIds, normalizedSlotCount, sourcePaneIds]);

  useEffect(() => {
    setEnabledWidgetIds(readWorkspaceEnabledSidebarWidgetIds(summary.sidebarWidgetRuntimes));
  }, [sidebarInventoryKey]);

  useEffect(() => {
    const handleSidebarToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ collapsed?: boolean; owner?: string }>).detail || {};
      if (detail.owner && detail.owner !== "workspace") return;
      setSidebarCollapsed(Boolean(detail.collapsed));
    };
    window.addEventListener("meowdesk:workspace-sidebar-toggle", handleSidebarToggle);
    return () => window.removeEventListener("meowdesk:workspace-sidebar-toggle", handleSidebarToggle);
  }, []);

  useEffect(() => {
    setSidebarCollapsed(rightSidebarCollapsed);
  }, [rightSidebarCollapsed]);

  useEffect(() => {
    const handleToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; enabled?: boolean }>).detail || {};
      const id = String(detail.id || "").trim();
      if (!id) return;
      setEnabledWidgetIds((current) => {
        const next = new Set(current);
        if (detail.enabled === false) {
          next.delete(id);
        } else {
          next.add(id);
        }
        const nextIds = [...next].filter((item) => summary.sidebarWidgetRuntimes.some((widget) => widget.id === item));
        writeWorkspaceEnabledSidebarWidgetIds(nextIds);
        return nextIds;
      });
    };
    window.addEventListener("meowdesk:workspace-toggle-sidebar-widget", handleToggle);
    return () => window.removeEventListener("meowdesk:workspace-toggle-sidebar-widget", handleToggle);
  }, [summary.sidebarWidgetRuntimes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      const shellWidth = workspaceShellRef.current?.getBoundingClientRect().width;
      const columnHeight = workspaceSidebarRef.current?.getBoundingClientRect().height;
      setSidebarWidth((current) => clampWorkspaceSidebarWidth(current, shellWidth));
      setBoardHeight((current) => clampWorkspaceBoardHeight(current, columnHeight));
      setPetHeight((current) => clampWorkspacePetHeight(current, columnHeight));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const columnHeight = workspaceSidebarRef.current?.getBoundingClientRect().height;
    setBoardHeight((current) => clampWorkspaceBoardHeight(current, columnHeight));
    setPetHeight((current) => clampWorkspacePetHeight(current, columnHeight));
  }, [sidebarWidgets.length]);

  useEffect(() => {
    if (typeof window === "undefined" || sidebarCollapsed) return;
    const frame = window.requestAnimationFrame(() => {
      const sidebar = workspaceSidebarRef.current;
      if (!sidebar) return;
      let remainingOverflow = Math.ceil(sidebar.scrollHeight - sidebar.clientHeight);
      if (remainingOverflow <= 1) return;
      remainingOverflow += 8;

      if (sidebarWidgets.length) {
        const nextWidgetHeights = { ...widgetHeights };
        let changed = false;
        for (const widget of sidebarWidgets) {
          if (remainingOverflow <= 0) break;
          const currentHeight = clampWorkspaceSidebarWidgetHeight(nextWidgetHeights[widget.id] || sidebarWidgetHeight(widget));
          const widgetMin = Math.max(MIN_WORKSPACE_WIDGET_HEIGHT, Number(widget.minHeight) || MIN_WORKSPACE_WIDGET_HEIGHT);
          const reduction = Math.min(remainingOverflow, Math.max(0, currentHeight - widgetMin));
          if (reduction > 0) {
            nextWidgetHeights[widget.id] = currentHeight - reduction;
            remainingOverflow -= reduction;
            changed = true;
          }
        }
        if (changed) {
          setWidgetHeights(nextWidgetHeights);
          writeWorkspaceSidebarWidgetHeights(nextWidgetHeights);
        }
      }

      if (remainingOverflow > 0) {
        const nextPetHeight = Math.max(112, petHeight - remainingOverflow);
        if (nextPetHeight !== petHeight) {
          remainingOverflow -= petHeight - nextPetHeight;
          setPetHeight(nextPetHeight);
        }
      }

      if (remainingOverflow > 0) {
        const nextBoardHeight = Math.max(180, boardHeight - remainingOverflow);
        if (nextBoardHeight !== boardHeight) {
          setBoardHeight(nextBoardHeight);
        }
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [boardHeight, petHeight, sidebarCollapsed, sidebarWidgetFitKey, widgetHeights]);

  const handleSidebarResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button > 0 || sidebarCollapsed) return;
    event.preventDefault();
    sidebarWidthDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: workspaceSidebarRef.current?.getBoundingClientRect().width || sidebarWidth
    };
    setResizingSidebar(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Programmatic smoke events may not own an active pointer.
    }
  };

  const handleSidebarResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sidebarWidthDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const shellWidth = workspaceShellRef.current?.getBoundingClientRect().width;
    setSidebarWidth(clampWorkspaceSidebarWidth(drag.startWidth + (drag.startX - event.clientX), shellWidth));
  };

  const stopSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sidebarWidthDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    sidebarWidthDragRef.current = null;
    setResizingSidebar(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture may already be released by the browser.
    }
  };

  const handleBoardResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button > 0 || sidebarCollapsed) return;
    event.preventDefault();
    boardHeightDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: boardHeight
    };
    setResizingBoard(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Programmatic smoke events may not own an active pointer.
    }
  };

  const handleBoardResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = boardHeightDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const columnHeight = workspaceSidebarRef.current?.getBoundingClientRect().height;
    setBoardHeight(clampWorkspaceBoardHeight(drag.startHeight + (event.clientY - drag.startY), columnHeight));
  };

  const stopBoardResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = boardHeightDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    boardHeightDragRef.current = null;
    setResizingBoard(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture may already be released by the browser.
    }
  };

  const handlePetResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button > 0 || sidebarCollapsed) return;
    event.preventDefault();
    petHeightDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: petHeight
    };
    setResizingPet(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Programmatic smoke events may not own an active pointer.
    }
  };

  const handlePetResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = petHeightDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const columnHeight = workspaceSidebarRef.current?.getBoundingClientRect().height;
    setPetHeight(clampWorkspacePetHeight(drag.startHeight + (event.clientY - drag.startY), columnHeight));
  };

  const stopPetResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = petHeightDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    petHeightDragRef.current = null;
    setResizingPet(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture may already be released by the browser.
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const markProgrammaticResize = (target: "sidebar" | "board" | "pet") => {
      if (programmaticResizeEndTimerRef.current) {
        window.clearTimeout(programmaticResizeEndTimerRef.current);
      }
      if (target === "sidebar") setResizingSidebar(true);
      if (target === "board") setResizingBoard(true);
      if (target === "pet") setResizingPet(true);
      programmaticResizeEndTimerRef.current = window.setTimeout(() => {
        setResizingSidebar(false);
        setResizingBoard(false);
        setResizingPet(false);
        programmaticResizeEndTimerRef.current = 0;
      }, 120);
    };
    const handleProgrammaticResize = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; deltaX?: number; deltaY?: number }>).detail || {};
      if (detail.target === "sidebar") {
        markProgrammaticResize("sidebar");
        const shellWidth = workspaceShellRef.current?.getBoundingClientRect().width;
        setSidebarWidth((current) => clampWorkspaceSidebarWidth(current + Number(detail.deltaX || 0), shellWidth));
      }
      if (detail.target === "board") {
        markProgrammaticResize("board");
        const columnHeight = workspaceSidebarRef.current?.getBoundingClientRect().height;
        setBoardHeight((current) => clampWorkspaceBoardHeight(current + Number(detail.deltaY || 0), columnHeight));
      }
      if (detail.target === "pet") {
        markProgrammaticResize("pet");
        const columnHeight = workspaceSidebarRef.current?.getBoundingClientRect().height;
        setPetHeight((current) => clampWorkspacePetHeight(current + Number(detail.deltaY || 0), columnHeight));
      }
    };
    window.addEventListener("meowdesk:workspace-resize", handleProgrammaticResize);
    return () => window.removeEventListener("meowdesk:workspace-resize", handleProgrammaticResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const startSidebarNativeResize = (event: PointerEvent) => {
      if (event.button > 0 || sidebarCollapsed) return;
      event.preventDefault();
      sidebarWidthDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: workspaceSidebarRef.current?.getBoundingClientRect().width || sidebarWidth
      };
      setResizingSidebar(true);
      try {
        sidebarResizeHandleRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // Programmatic smoke events may not own an active pointer.
      }
    };

    const startBoardNativeResize = (event: PointerEvent) => {
      if (event.button > 0 || sidebarCollapsed) return;
      event.preventDefault();
      boardHeightDragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: boardHeight
      };
      setResizingBoard(true);
      try {
        boardResizeHandleRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // Programmatic smoke events may not own an active pointer.
      }
    };

    const startPetNativeResize = (event: PointerEvent) => {
      if (event.button > 0 || sidebarCollapsed) return;
      event.preventDefault();
      petHeightDragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: petHeight
      };
      setResizingPet(true);
      try {
        petResizeHandleRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // Programmatic smoke events may not own an active pointer.
      }
    };

    const handleWindowResizeMove = (event: PointerEvent) => {
      const sidebarDrag = sidebarWidthDragRef.current;
      if (sidebarDrag?.pointerId === event.pointerId) {
        event.preventDefault();
        const shellWidth = workspaceShellRef.current?.getBoundingClientRect().width;
        setSidebarWidth(clampWorkspaceSidebarWidth(sidebarDrag.startWidth + (sidebarDrag.startX - event.clientX), shellWidth));
      }

      const boardDrag = boardHeightDragRef.current;
      if (boardDrag?.pointerId === event.pointerId) {
        event.preventDefault();
        const columnHeight = workspaceSidebarRef.current?.getBoundingClientRect().height;
        setBoardHeight(clampWorkspaceBoardHeight(boardDrag.startHeight + (event.clientY - boardDrag.startY), columnHeight));
      }

      const petDrag = petHeightDragRef.current;
      if (petDrag?.pointerId === event.pointerId) {
        event.preventDefault();
        const columnHeight = workspaceSidebarRef.current?.getBoundingClientRect().height;
        setPetHeight(clampWorkspacePetHeight(petDrag.startHeight + (event.clientY - petDrag.startY), columnHeight));
      }
    };

    const handleWindowResizeEnd = (event: PointerEvent) => {
      if (sidebarWidthDragRef.current?.pointerId === event.pointerId) {
        sidebarWidthDragRef.current = null;
        setResizingSidebar(false);
      }
      if (boardHeightDragRef.current?.pointerId === event.pointerId) {
        boardHeightDragRef.current = null;
        setResizingBoard(false);
      }
      if (petHeightDragRef.current?.pointerId === event.pointerId) {
        petHeightDragRef.current = null;
        setResizingPet(false);
      }
    };

    const sidebarHandle = sidebarResizeHandleRef.current;
    const boardHandle = boardResizeHandleRef.current;
    const petHandle = petResizeHandleRef.current;
    sidebarHandle?.addEventListener("pointerdown", startSidebarNativeResize);
    boardHandle?.addEventListener("pointerdown", startBoardNativeResize);
    petHandle?.addEventListener("pointerdown", startPetNativeResize);
    sidebarHandle?.addEventListener("pointermove", handleWindowResizeMove);
    sidebarHandle?.addEventListener("pointerup", handleWindowResizeEnd);
    sidebarHandle?.addEventListener("pointercancel", handleWindowResizeEnd);
    boardHandle?.addEventListener("pointermove", handleWindowResizeMove);
    boardHandle?.addEventListener("pointerup", handleWindowResizeEnd);
    boardHandle?.addEventListener("pointercancel", handleWindowResizeEnd);
    petHandle?.addEventListener("pointermove", handleWindowResizeMove);
    petHandle?.addEventListener("pointerup", handleWindowResizeEnd);
    petHandle?.addEventListener("pointercancel", handleWindowResizeEnd);
    window.addEventListener("pointermove", handleWindowResizeMove, true);
    window.addEventListener("pointerup", handleWindowResizeEnd, true);
    window.addEventListener("pointercancel", handleWindowResizeEnd, true);
    return () => {
      sidebarHandle?.removeEventListener("pointerdown", startSidebarNativeResize);
      boardHandle?.removeEventListener("pointerdown", startBoardNativeResize);
      petHandle?.removeEventListener("pointerdown", startPetNativeResize);
      sidebarHandle?.removeEventListener("pointermove", handleWindowResizeMove);
      sidebarHandle?.removeEventListener("pointerup", handleWindowResizeEnd);
      sidebarHandle?.removeEventListener("pointercancel", handleWindowResizeEnd);
      boardHandle?.removeEventListener("pointermove", handleWindowResizeMove);
      boardHandle?.removeEventListener("pointerup", handleWindowResizeEnd);
      boardHandle?.removeEventListener("pointercancel", handleWindowResizeEnd);
      petHandle?.removeEventListener("pointermove", handleWindowResizeMove);
      petHandle?.removeEventListener("pointerup", handleWindowResizeEnd);
      petHandle?.removeEventListener("pointercancel", handleWindowResizeEnd);
      window.removeEventListener("pointermove", handleWindowResizeMove, true);
      window.removeEventListener("pointerup", handleWindowResizeEnd, true);
      window.removeEventListener("pointercancel", handleWindowResizeEnd, true);
    };
  }, [boardHeight, petHeight, sidebarCollapsed, sidebarWidth]);

  const handlePetSpritePointerDown = (event: ReactPointerEvent<HTMLDivElement>, paneId: string) => {
    if (event.button > 0) return;
    event.preventDefault();
    const spriteRect = event.currentTarget.getBoundingClientRect();
    petDragRef.current = {
      pointerId: event.pointerId,
      paneId,
      offsetX: event.clientX - spriteRect.left,
      offsetY: event.clientY - spriteRect.top,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false
    };
    const actor = petActorsRef.current.get(paneId);
    if (actor) {
      actor.dragging = true;
      actor.vx = 0;
      actor.vy = 0;
      actor.interaction = "";
      actor.interactionUntil = 0;
    }
    setDraggingPetId(paneId);
    triggerPetJump(paneId);
    event.currentTarget.classList.add("is-dragging", "is-jumping");
    event.currentTarget.dataset.r2WorkspacePetInteraction = "jump";
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Programmatic smoke events may not own an active pointer.
    }
  };

  const handlePetSpritePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = petDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) > 4) {
      drag.moved = true;
    }
    const field = event.currentTarget.closest(".meowdesk-workspace-pet-field") as HTMLElement | null;
    if (!field) return;
    const fieldRect = field.getBoundingClientRect();
    const spriteRect = event.currentTarget.getBoundingClientRect();
    const maxX = Math.max(0, fieldRect.width - spriteRect.width);
    const maxY = workspacePetMaxY(fieldRect.height, spriteRect.height);
    const x = Math.max(0, Math.min(maxX, event.clientX - fieldRect.left - drag.offsetX));
    const y = Math.max(0, Math.min(maxY, event.clientY - fieldRect.top - drag.offsetY));
    const nextPosition = { x: Math.round(x), y: Math.round(y) };
    drag.lastX = nextPosition.x;
    drag.lastY = nextPosition.y;
    const actor = petActorsRef.current.get(drag.paneId);
    if (actor) {
      actor.x = x;
      actor.y = y;
      actor.lastMoveAt = performance.now();
      actor.manualPosition = true;
    }
    event.currentTarget.style.setProperty("--r2-workspace-pet-x", `${nextPosition.x}px`);
    event.currentTarget.style.setProperty("--r2-workspace-pet-y", `${nextPosition.y}px`);
    event.currentTarget.dataset.r2WorkspacePetX = String(nextPosition.x);
    event.currentTarget.dataset.r2WorkspacePetY = String(nextPosition.y);
    event.currentTarget.dataset.r2WorkspacePetManualPosition = "true";
    petPositionsRef.current = {
      ...petPositionsRef.current,
      [drag.paneId]: nextPosition
    };
    setPetPositions((current) => ({
      ...current,
      [drag.paneId]: nextPosition
    }));
  };

  const stopPetSpriteDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = petDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    petDragRef.current = null;
    setDraggingPetId("");
    event.currentTarget.classList.remove("is-dragging");
    const actor = petActorsRef.current.get(drag.paneId);
    if (actor) {
      actor.dragging = false;
      actor.lastMoveAt = performance.now();
      if (typeof drag.lastX === "number" && typeof drag.lastY === "number") {
        actor.manualPosition = true;
      }
    }
    if (typeof drag.lastX === "number" && typeof drag.lastY === "number") {
      const finalPosition = { x: drag.lastX, y: drag.lastY };
      event.currentTarget.style.setProperty("--r2-workspace-pet-x", `${drag.lastX}px`);
      event.currentTarget.style.setProperty("--r2-workspace-pet-y", `${drag.lastY}px`);
      event.currentTarget.dataset.r2WorkspacePetX = String(drag.lastX);
      event.currentTarget.dataset.r2WorkspacePetY = String(drag.lastY);
      event.currentTarget.dataset.r2WorkspacePetManualPosition = "true";
      petPositionsRef.current = {
        ...petPositionsRef.current,
        [drag.paneId]: finalPosition
      };
    }
    setPetPositions((current) => {
      const next = typeof drag.lastX === "number" && typeof drag.lastY === "number"
        ? { ...current, [drag.paneId]: { x: drag.lastX, y: drag.lastY } }
        : current;
      writeWorkspacePetPositions(next);
      return next;
    });
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture may already be released by the browser.
    }
    if (event.type === "pointerup" && !drag.moved) {
      triggerPetJump(drag.paneId);
    }
  };

  const setSidebarWidgetHeight = (id: string, height: number) => {
    setWidgetHeights((current) => {
      const next = { ...current, [id]: clampWorkspaceSidebarWidgetHeight(height) };
      writeWorkspaceSidebarWidgetHeights(next);
      return next;
    });
  };

  const disableSidebarWidget = (id: string) => {
    setEnabledWidgetIds((current) => {
      const nextIds = current.filter((item) => item !== id);
      writeWorkspaceEnabledSidebarWidgetIds(nextIds);
      return nextIds;
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("meowdesk:workspace-toggle-sidebar-widget", {
        detail: { id, enabled: false }
      }));
    }
  };

  const updateTerminalStatus = (id: string, status: WorkspaceTerminalStatus) => {
    setTerminalStatuses((current) => current[id] === status ? current : { ...current, [id]: status });
  };

  const updateOutputRendererBinding = useCallback((rendererPaneId: string, sourcePaneId: string) => {
    setOutputRendererBindings((current) => {
      if (!sourcePaneId) {
        if (!current[rendererPaneId]) return current;
        const next = { ...current };
        delete next[rendererPaneId];
        return next;
      }
      if (current[rendererPaneId] === sourcePaneId) return current;
      return { ...current, [rendererPaneId]: sourcePaneId };
    });
  }, []);

  const updateTerminalSource = useCallback((id: string, snapshot: WorkspaceRendererSourceSnapshot) => {
    if (!id) return;
    const sourceEvents = (snapshot.sourceEvents || []).slice(-401);
    const nextSnapshot: WorkspaceRendererSourceSnapshot = {
      ...snapshot,
      id,
      sourceEvents,
      displayTranscript: String(snapshot.displayTranscript || "").slice(-64000),
      rawTranscript: String(snapshot.rawTranscript || "").slice(-128000),
      updatedAt: snapshot.updatedAt || Date.now()
    };
    setTerminalSources((current) => {
      const existing = current[id];
      const existingSourceEvents = existing?.sourceEvents || [];
      const sameNonRawSourceEvents =
        workspaceRendererSourceEventListSignature(existingSourceEvents) === workspaceRendererSourceEventListSignature(sourceEvents);
      const semanticActive = workspaceRendererSourceEventsHaveSemanticAdapterOutput(sourceEvents);
      const profile = nextSnapshot.profile || existing?.profile || "other";
      const existingHasStatusPreview = workspaceRendererTextHasStatusPreview(`${existing?.displayTranscript || ""}\n${existing?.rawTranscript || ""}`);
      const nextHasStatusPreview = workspaceRendererTextHasStatusPreview(`${nextSnapshot.displayTranscript || ""}\n${nextSnapshot.rawTranscript || ""}`);
      const rawOnlyHermesPreviewChange =
        semanticActive &&
        profile === "hermes" &&
        sameNonRawSourceEvents &&
        existing?.status === nextSnapshot.status &&
        (!nextHasStatusPreview || existingHasStatusPreview) &&
        (
          existing?.displayTranscript !== nextSnapshot.displayTranscript ||
          existing?.rawTranscript !== nextSnapshot.rawTranscript
        ) &&
        Date.now() - (existing?.updatedAt || 0) < 1400;
      if (rawOnlyHermesPreviewChange) {
        return current;
      }
      if (
        existing?.displayTranscript === nextSnapshot.displayTranscript &&
        existing?.rawTranscript === nextSnapshot.rawTranscript &&
        existing?.status === nextSnapshot.status &&
        sameNonRawSourceEvents
      ) {
        return current;
      }
      return { ...current, [id]: nextSnapshot };
    });
  }, []);

  const recordTerminalUserTurn = useCallback((id: string, text: string, source: WorkspaceTerminalSubmitSource) => {
    const normalizedText = workspaceRendererNormalizeUserText(text);
    if (!id || !normalizedText) return;
    const createdAt = Date.now();
    setTerminalUserTurns((current) => {
      const turns = current[id] || [];
      const last = turns[turns.length - 1];
      if (last && last.text === normalizedText && createdAt - last.createdAt < 900) {
        return current;
      }
      const nextTurn: WorkspaceTerminalUserTurn = {
        id: `${id}-${createdAt}-${turns.length + 1}`,
        text: normalizedText,
        source,
        createdAt
      };
      return {
        ...current,
        [id]: [...turns, nextTurn].slice(-80)
      };
    });
  }, []);

  const clearTerminalUserTurns = useCallback((id: string) => {
    if (!id) return;
    setTerminalUserTurns((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const moveWorkspacePane = useCallback((fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    const visibleIds = panes.map((pane) => pane.id);
    if (!visibleIds.includes(fromId) || !visibleIds.includes(toId)) return;
    setPaneOrder((current) => {
      const orderedVisibleIds = [
        ...current.filter((id) => visibleIds.includes(id)),
        ...visibleIds.filter((id) => !current.includes(id))
      ];
      const fromIndex = orderedVisibleIds.indexOf(fromId);
      const toIndex = orderedVisibleIds.indexOf(toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const nextVisibleIds = [...orderedVisibleIds];
      const [movedId] = nextVisibleIds.splice(fromIndex, 1);
      nextVisibleIds.splice(toIndex, 0, movedId);
      const nextOrder = [
        ...nextVisibleIds,
        ...current.filter((id) => !visibleIds.includes(id))
      ];
      writeWorkspacePaneOrder(nextOrder);
      return nextOrder;
    });
  }, [paneIds]);

  const moveWorkspacePaneByOffset = useCallback((paneId: string, offset: number) => {
    const visibleIds = panes.map((pane) => pane.id);
    const index = visibleIds.indexOf(paneId);
    if (index < 0) return;
    const targetIndex = Math.max(0, Math.min(visibleIds.length - 1, index + offset));
    if (targetIndex === index) return;
    moveWorkspacePane(paneId, visibleIds[targetIndex]);
  }, [moveWorkspacePane, paneIds]);

  const handleWorkspacePaneDragStart = (event: ReactDragEvent<HTMLElement>, pane: WorkspacePane) => {
    if (hiddenPaneIdSet.has(pane.id) || panes.length < 2) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(WORKSPACE_PANE_DRAG_MIME, pane.id);
    event.dataTransfer.setData("text/plain", pane.id);
    setDraggingPaneId(pane.id);
  };

  const handleWorkspacePaneDragOver = (event: ReactDragEvent<HTMLElement>, pane: WorkspacePane) => {
    if (!draggingPaneId || draggingPaneId === pane.id || hiddenPaneIdSet.has(pane.id)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleWorkspacePaneDrop = (event: ReactDragEvent<HTMLElement>, pane: WorkspacePane) => {
    const sourceId = event.dataTransfer.getData(WORKSPACE_PANE_DRAG_MIME) || event.dataTransfer.getData("text/plain") || draggingPaneId;
    if (!sourceId || sourceId === pane.id || hiddenPaneIdSet.has(pane.id)) return;
    event.preventDefault();
    moveWorkspacePane(sourceId, pane.id);
    setDraggingPaneId("");
  };

  const handleWorkspacePaneDragEnd = () => {
    setDraggingPaneId("");
  };

  const handleWorkspacePaneDragKeyDown = (event: ReactKeyboardEvent<HTMLElement>, pane: WorkspacePane) => {
    if (panes.length < 2) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveWorkspacePaneByOffset(pane.id, -1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveWorkspacePaneByOffset(pane.id, 1);
    }
  };

  const configureWorkspacePane = (choice: WorkspaceConfigChoice) => {
    if (!configuringPaneId) return;
    const paneId = configuringPaneId;
    const nextPane = workspacePaneFromChoice(paneId, choice);
    setFreshPaneIds((current) => current.filter((id) => id !== paneId));
    setConfiguredPulsePaneIds((current) => Array.from(new Set([...current, paneId])));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setConfiguredPulsePaneIds((current) => current.filter((id) => id !== paneId));
      }, 1600);
    }
    setConfiguredPanes((current) => {
      const next = { ...current, [paneId]: nextPane };
      writeWorkspaceConfiguredPanes(next);
      return next;
    });
    setHiddenPaneIds((current) => current.filter((id) => id !== paneId));
    setClosedPaneIds((current) => current.filter((id) => id !== paneId));
    setTerminalStatuses((current) => {
      const next = { ...current };
      delete next[paneId];
      return next;
    });
    setTerminalSources((current) => {
      const next = { ...current };
      delete next[paneId];
      return next;
    });
    setTerminalUserTurns((current) => {
      const next = { ...current };
      delete next[paneId];
      return next;
    });
    setConfiguringPaneId("");
  };

  const hideWorkspacePane = (pane: WorkspacePane) => {
    if (pane.kind === "blank") return;
    setHiddenPaneIds((current) => current.includes(pane.id) ? current : [...current, pane.id]);
    setMaximizedPaneId((current) => current === pane.id ? "" : current);
  };

  const restoreWorkspacePane = (id: string) => {
    setHiddenPaneIds((current) => current.filter((item) => item !== id));
  };

  useEffect(() => {
    onHiddenPanesChange?.(hiddenPanes.map((pane) => ({
      id: pane.id,
      name: pane.name,
      kind: pane.kind
    })));
  }, [hiddenPaneSummaryKey, onHiddenPanesChange]);

  useEffect(() => {
    const paneId = hiddenPaneRestoreRequest.split(":")[0];
    if (!paneId) return;
    restoreWorkspacePane(paneId);
  }, [hiddenPaneRestoreRequest]);

  const requestCloseWorkspacePane = (pane: WorkspacePane) => {
    if (pane.kind === "blank") return;
    setConfirmingClosePaneId(pane.id);
  };

  const closeWorkspacePane = (pane: WorkspacePane) => {
    if (pane.kind === "blank") return;
    setConfirmingClosePaneId("");
    const nextSlotCountAfterClose = clampWorkspaceSlotCount(normalizedSlotCount - 1);
    try {
      stopAgentRuntime(pane.id);
    } catch {
      // Closing a pane may race with a process that has already exited.
    }
    if (configuredPanes[pane.id]) {
      const remainingVisiblePaneIds = panes.filter((item) => item.id !== pane.id).map((item) => item.id);
      setConfiguredPanes((current) => {
        const next = { ...current };
        delete next[pane.id];
        writeWorkspaceConfiguredPanes(next);
        return next;
      });
      setClosedPaneIds((current) => current.includes(pane.id) ? current : [...current, pane.id]);
      setHiddenPaneIds((current) => current.filter((id) => id !== pane.id));
      setPaneOrder((current) => {
        const next = [
          ...remainingVisiblePaneIds,
          ...current.filter((id) => id !== pane.id && !remainingVisiblePaneIds.includes(id))
        ];
        if (next.join("|") === current.join("|")) return current;
        writeWorkspacePaneOrder(next);
        return next;
      });
      setTerminalStatuses((current) => {
        const next = { ...current };
        delete next[pane.id];
        return next;
      });
      setTerminalSources((current) => {
        const next = { ...current };
        delete next[pane.id];
        return next;
      });
      setTerminalUserTurns((current) => {
        const next = { ...current };
        delete next[pane.id];
        return next;
      });
      setMaximizedPaneId((current) => current === pane.id ? "" : current);
      onSlotCountChange?.(nextSlotCountAfterClose);
      return;
    }
    setClosedPaneIds((current) => current.includes(pane.id) ? current : [...current, pane.id]);
    setHiddenPaneIds((current) => current.filter((id) => id !== pane.id));
    setTerminalSources((current) => {
      const next = { ...current };
      delete next[pane.id];
      return next;
    });
    setMaximizedPaneId((current) => current === pane.id ? "" : current);
    onSlotCountChange?.(nextSlotCountAfterClose);
  };

  return (
    <RouteFrame
      id="workspace"
      eyebrow="Workspace"
      title="工作区"
      copy="把本机 CLI Agent、终端和本地预览放进多工作窗，减少日常工作时在不同 Agent 间来回切窗。右侧栏保留看板、组件和桌宠反馈。"
      badge="R2 visible"
      compact
    >
      <div
        ref={workspaceShellRef}
        className={cn(
          "meowdesk-workspace-shell",
          sidebarCollapsed && "is-sidebar-collapsed",
          sidebarWidgets.length && "has-sidebar-widgets",
          maximizedPaneId && "is-pane-maximized",
          resizingSidebar && "is-sidebar-resizing",
          resizingBoard && "is-board-resizing",
          resizingPet && "is-pet-resizing",
          draggingPaneId && "is-pane-dragging"
        )}
        style={{
          "--r2-workspace-sidebar-width": `${sidebarWidth}px`,
          "--r2-workspace-board-height": `${boardHeight}px`,
          "--r2-workspace-pet-height": `${petHeight}px`
        } as CSSProperties}
        data-r2-workspace-route
        data-r2-workspace-old-shape="workspace-side-column"
        data-r2-workspace-maximized-pane={maximizedPaneId || undefined}
        data-r2-workspace-sidebar-width={sidebarWidth}
        data-r2-workspace-board-height={boardHeight}
        data-r2-workspace-pet-height={petHeight}
      >
        <Panel className="meowdesk-workspace-frame" data-r2-workspace-frame>
          <PanelBody className="meowdesk-workspace-frame-body min-h-0 overflow-hidden p-2">
            <div
              className={cn("meowdesk-workspace-pane-grid", `layout-${effectiveSlotCount}`, maximizedPaneId && "is-pane-maximized")}
              data-r2-workspace-panes
              data-r2-workspace-pane-count={effectiveSlotCount}
              data-r2-workspace-requested-pane-count={normalizedSlotCount}
            >
              {panes.map((pane, paneIndex) => {
                const Icon = pane.kind === "terminal" ? Terminal : pane.kind === "browser" ? Monitor : pane.kind === "renderer" ? FileText : pane.kind === "blank" ? Plus : Bot;
                const isBlank = pane.kind === "blank";
                const isMaximized = maximizedPaneId === pane.id;
                const isHiddenByMaximize = Boolean(maximizedPaneId && !isMaximized);
                const isFreshPane = freshPaneIds.includes(pane.id);
                const isConfiguredPulsePane = configuredPulsePaneIds.includes(pane.id);
                const runtimeStatus = isBlank || pane.kind === "renderer" || pane.kind === "browser" ? "idle" : terminalStatuses[pane.id] || "idle";
                return (
                  <article
                    key={pane.id}
                    className={cn(
                      "meowdesk-workspace-pane",
                      isBlank && "is-blank",
                      isMaximized && "is-maximized",
                      isHiddenByMaximize && "is-hidden-by-maximize",
                      isFreshPane && "is-pane-new",
                      isConfiguredPulsePane && "is-pane-configured-pulse",
                      draggingPaneId === pane.id && "is-pane-dragging",
                      draggingPaneId && draggingPaneId !== pane.id && "is-pane-drop-target"
                    )}
                    data-r2-workspace-pane={pane.id}
                    data-r2-workspace-pane-kind={pane.kind}
                    data-r2-workspace-pane-order-index={paneIndex}
                    data-r2-workspace-pane-maximized={isMaximized ? "true" : undefined}
                    data-r2-workspace-pane-hidden-by-maximize={isHiddenByMaximize ? "true" : undefined}
                    data-r2-workspace-pane-new={isFreshPane ? "true" : undefined}
                    data-r2-workspace-pane-configured={configuredPanes[pane.id] ? "true" : undefined}
                    data-r2-workspace-pane-configured-pulse={isConfiguredPulsePane ? "true" : undefined}
                    data-r2-workspace-pane-dragging={draggingPaneId === pane.id ? "true" : undefined}
                    data-r2-workspace-pane-drop-target={draggingPaneId && draggingPaneId !== pane.id ? "true" : undefined}
                    onDragOver={(event) => handleWorkspacePaneDragOver(event, pane)}
                    onDrop={(event) => handleWorkspacePaneDrop(event, pane)}
                  >
                    <header className="meowdesk-workspace-pane-head">
                      <div className="meowdesk-workspace-pane-title">
                        <span
                          className="meowdesk-workspace-pane-drag"
                          role="button"
                          tabIndex={panes.length > 1 ? 0 : -1}
                          draggable={panes.length > 1}
                          aria-label={`拖动调整 ${pane.name} 位置`}
                          title="拖动调整窗口位置"
                          data-r2-workspace-pane-drag={pane.id}
                          onDragStart={(event) => handleWorkspacePaneDragStart(event, pane)}
                          onDragEnd={handleWorkspacePaneDragEnd}
                          onKeyDown={(event) => handleWorkspacePaneDragKeyDown(event, pane)}
                        />
                        <span className="meowdesk-workspace-pane-tool-icon">
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <strong>{pane.name}</strong>
                        <Badge className="meowdesk-workspace-pane-badge" variant={isBlank ? "default" : runtimeStatus === "running" ? "success" : runtimeStatus === "starting" ? "warning" : "primary"}>
                          {isBlank ? "待配置" : pane.kind === "renderer" ? "Meow Viewer" : pane.kind === "browser" ? "预览" : terminalStatusLabel(runtimeStatus)}
                        </Badge>
                      </div>
                      <div className="meowdesk-workspace-pane-controls">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="meowdesk-workspace-pane-control"
                          disabled={isBlank}
                          aria-label="隐藏工作窗"
                          title="隐藏工作窗"
                          data-r2-workspace-pane-hide={pane.id}
                          onClick={() => hideWorkspacePane(pane)}
                        >
                          <Minus size={14} aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="meowdesk-workspace-pane-control"
                          aria-pressed={isMaximized}
                          aria-label={isMaximized ? "还原工作窗" : "放大工作窗"}
                          title={isMaximized ? "还原工作窗" : "放大工作窗"}
                          data-r2-workspace-pane-maximize={pane.id}
                          onClick={() => setMaximizedPaneId((current) => current === pane.id ? "" : pane.id)}
                        >
                          {isMaximized ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="meowdesk-workspace-pane-control is-danger"
                          disabled={isBlank}
                          aria-label="关闭工作窗"
                          title="关闭工作窗并停止进程"
                          data-r2-workspace-pane-close={pane.id}
                          onClick={() => requestCloseWorkspacePane(pane)}
                        >
                          <X size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    </header>
                    <div
                      className={cn("meowdesk-workspace-terminal-surface", !isBlank && "has-terminal-runtime")}
                      data-r2-terminal-surface={pane.id}
                    >
                      {isBlank ? (
                        <div className="meowdesk-workspace-start-panel is-placeholder">
                          <LaunchEmptyState
                            variant="workspace-agent"
                            icon={(
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="meowdesk-workspace-launch-button"
                                title="配置工作窗"
                                aria-label="配置工作窗"
                                data-r2-workspace-configure-pane={pane.id}
                                data-meow-launch-action="primary"
                                onClick={() => setConfiguringPaneId(pane.id)}
                              >
                                <Plus size={24} aria-hidden="true" />
                              </Button>
                            )}
                            iconChrome="action"
                            title={<strong>待配置工作窗</strong>}
                            meta="可配置 CLI Agent、本地终端或预览窗口，集中在这里少切窗工作。"
                          />
                        </div>
                      ) : pane.kind === "browser" ? (
                        <WorkspaceBrowserPreview pane={pane} />
                      ) : pane.kind === "renderer" ? (
                        <WorkspaceOutputRenderer
                          pane={pane}
                          sourcePanes={panes}
                          terminalSources={terminalSources}
                          terminalStatuses={terminalStatuses}
                          terminalUserTurns={terminalUserTurns}
                          onSourceBindingChange={updateOutputRendererBinding}
                          onUserSubmit={recordTerminalUserTurn}
                        />
                      ) : (
                        <WorkspaceTerminalRuntime
                          pane={pane}
                          fitSignal={workspaceTerminalFitKey}
                          sourceCaptureActive={activeOutputSourceIds.has(pane.id)}
                          onStatusChange={(status) => updateTerminalStatus(pane.id, status)}
                          onSourceSnapshot={updateTerminalSource}
                          onClearUserTurns={clearTerminalUserTurns}
                          onUserSubmit={recordTerminalUserTurn}
                          onConfigurePane={(paneId) => setConfiguringPaneId(paneId)}
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </PanelBody>
        </Panel>

        <div
          ref={sidebarResizeHandleRef}
          className="meowdesk-workspace-sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={workspaceSidebarWidthBounds(workspaceShellRef.current?.getBoundingClientRect().width).min}
          aria-valuemax={workspaceSidebarWidthBounds(workspaceShellRef.current?.getBoundingClientRect().width).max}
          aria-valuenow={sidebarWidth}
          title="拖动调整右侧栏宽度"
          data-r2-workspace-sidebar-resizer
          onPointerDown={handleSidebarResizeStart}
          onPointerMove={handleSidebarResizeMove}
          onPointerUp={stopSidebarResize}
          onPointerCancel={stopSidebarResize}
        />
        <WorkspaceRightSidebarOwner
          ref={workspaceSidebarRef}
          page="workspace"
          collapsed={sidebarCollapsed}
          width={sidebarWidth}
          className="meowdesk-workspace-side-column"
          data-r2-workspace-sidebar
          data-r2-workspace-side-column
        >
          <Panel className="meowdesk-workspace-side-card meowdesk-workspace-board">
            <PanelHeader className="px-2.5 py-1.5">
              <div>
                <div className="text-sm font-semibold">优先看板</div>
                <div className="text-xs text-muted-foreground">{openTasks} 个打开任务</div>
              </div>
              <ClipboardList size={15} className="text-muted-foreground" aria-hidden="true" />
            </PanelHeader>
            <PanelBody className="min-h-0 overflow-hidden p-1.5">
              <WorkspacePriorityTaskBoard summary={summary} />
            </PanelBody>
          </Panel>

          <div
            ref={boardResizeHandleRef}
            className="meowdesk-workspace-side-resizer"
            role="separator"
            aria-orientation="horizontal"
            aria-valuemin={180}
            aria-valuemax={360}
            aria-valuenow={boardHeight}
            title="拖动调整优先看板高度"
            data-r2-workspace-board-resizer
            onPointerDown={handleBoardResizeStart}
            onPointerMove={handleBoardResizeMove}
            onPointerUp={stopBoardResize}
            onPointerCancel={stopBoardResize}
          />

          {sidebarWidgets.length ? (
            <section className="meowdesk-workspace-widget-zone" data-r2-workspace-sidebar-widgets data-r2-workspace-sidebar-widget-count={sidebarWidgets.length}>
              {sidebarWidgets.map((widget) => (
                <SidebarWidgetHost
                  key={widget.id}
                  widget={widget}
                  height={widgetHeights[widget.id] || sidebarWidgetHeight(widget)}
                  onHeightChange={setSidebarWidgetHeight}
                  onDisable={disableSidebarWidget}
                />
              ))}
            </section>
          ) : null}

          <Panel className="meowdesk-workspace-side-card meowdesk-workspace-pet">
            <div
              ref={petResizeHandleRef}
              className="meowdesk-workspace-pet-resizer"
              role="separator"
              aria-orientation="horizontal"
              aria-valuemin={112}
              aria-valuemax={380}
              aria-valuenow={petHeight}
              title="拖动调整桌宠高度"
              data-r2-workspace-pet-resizer
              onPointerDown={handlePetResizeStart}
              onPointerMove={handlePetResizeMove}
              onPointerUp={stopPetResize}
              onPointerCancel={stopPetResize}
            />
            <PanelHeader>
              <div>
                <div className="text-sm font-semibold">桌宠</div>
                <div className="text-xs text-muted-foreground">工作窗状态反馈</div>
              </div>
              <PawPrint size={15} className="text-muted-foreground" aria-hidden="true" />
            </PanelHeader>
            <PanelBody className="min-h-0 overflow-hidden p-2">
                <div
                  className="meowdesk-workspace-pet-dock"
                  data-r2-workspace-pet-dock
                data-r2-workspace-pet-count={workspacePets.filter((pet) => pet.pet).length}
              >
                <div className="meowdesk-workspace-pet-quick-bar" data-r2-workspace-pet-quick-bar>
                  <div className="meowdesk-workspace-pet-quick-title">
                    <span>当前桌宠</span>
                    <strong>{primaryWorkspacePet?.pane.name || "Meowdesk"}</strong>
                  </div>
                  <span className="sr-only" data-r2-workspace-pet-status={primaryWorkspacePet?.status || "idle"}>
                    {workspacePetStatusLabel(primaryWorkspacePet?.status || "idle")}
                  </span>
                </div>
                <div ref={petFieldRef} className="meowdesk-workspace-pet-field" data-r2-workspace-pet-field>
                  {workspacePets.some((pet) => pet.pet) ? workspacePets.map((pet) => {
                    if (!pet.pet) return null;
                    const manualPosition = petPositions[pet.pane.id];
                    const directionFix = petDirectionForPackage(pet.pet, petDirectionFixes);
                    const interaction = petInteractions[pet.pane.id];
                    return (
                      <div
                        key={pet.pane.id}
                        className={cn(
                          "meowdesk-workspace-pet-sprite",
                          "is-actor-controlled",
                          `pet-slot-${pet.slot}`,
                          `pet-state-${pet.status}`,
                          manualPosition && "is-positioned",
                          draggingPetId === pet.pane.id && "is-dragging",
                          interaction === "jump" && "is-jumping"
                        )}
                        style={{
                          "--r2-workspace-pet-scale": petScaleForPackage(pet.pet, petScales),
                          "--r2-workspace-pet-direction": directionFix,
                          "--r2-workspace-pet-visual-direction": directionFix,
                          ...(manualPosition ? {
                            "--r2-workspace-pet-x": `${manualPosition.x}px`,
                            "--r2-workspace-pet-y": `${manualPosition.y}px`
                          } : {})
                        } as CSSProperties}
                        data-r2-workspace-pet-sprite={pet.pane.id}
                        data-r2-workspace-pet-package={pet.pet.id}
                        data-r2-workspace-pet-sprite-status={pet.status}
                        data-r2-workspace-pet-slot={pet.slot}
                        data-r2-workspace-pet-direction-fix={directionFix}
                        data-r2-workspace-pet-interaction={interaction || undefined}
                        data-r2-workspace-pet-manual-position={manualPosition ? "true" : undefined}
                        title={`${pet.pane.name}：${workspacePetStatusLabel(pet.status)}`}
                        onPointerDown={(event) => handlePetSpritePointerDown(event, pet.pane.id)}
                        onPointerMove={handlePetSpritePointerMove}
                        onPointerUp={stopPetSpriteDrag}
                        onPointerCancel={stopPetSpriteDrag}
                      >
                        <span className="meowdesk-workspace-pet-aura" aria-hidden="true" />
                        <WorkspacePetCanvas pet={pet.pet} status={pet.status} slot={pet.slot} label={`${pet.pet.displayName} · ${pet.pane.name}`} />
                      </div>
                    );
                  }) : (
                    <div className="meowdesk-workspace-pet-empty">
                      <PawPrint size={18} aria-hidden="true" />
                      <span>{loadableWidgetCount} 个右侧栏组件可装载</span>
                    </div>
                  )}
                </div>
              </div>
            </PanelBody>
          </Panel>
        </WorkspaceRightSidebarOwner>
      </div>
      <Dialog open={Boolean(confirmingClosePaneId)} onOpenChange={(open) => !open && setConfirmingClosePaneId("")}>
        <DialogContent
          className="meowdesk-confirm-dialog meowdesk-surface-close-family-dialog vs-surface-close-panel"
          data-r2-workspace-close-dialog
          data-vs-surface-close-family="workspace-pane"
          data-meow-warning-card
          data-meow-warning-owner="meowdesk-warning-dialog"
          data-meow-warning-family="flip-confirm-card"
          data-meow-warning-variant="workspace-pane-close"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <span className="vs-surface-close-warning" data-meow-warning-icon aria-hidden="true" />
          <div className="vs-surface-close-content" data-meow-warning-content>
            <DialogHeader>
              <DialogTitle>关闭工作窗？</DialogTitle>
              <DialogDescription>
                会停止「{confirmingClosePane?.name || "这个工作窗"}」对应的 Agent / terminal 进程，并把这个工作窗恢复为待配置状态。
              </DialogDescription>
            </DialogHeader>
            <p className="meowdesk-surface-close-note">
              如果只是暂时不看这个窗口，请用「隐藏」。确认关闭会结束当前窗口关联的进程，尚未保存的输出可能会丢失。
            </p>
            <DialogFooter className="vs-surface-close-actions" data-meow-warning-actions>
              <Button type="button" variant="outline" onClick={() => setConfirmingClosePaneId("")} className="vs-surface-close-cancel" data-r2-workspace-pane-close-cancel>
                取消
              </Button>
              <Button
                type="button"
                variant="outline"
                className="vs-surface-close-confirm"
                disabled={!confirmingClosePane}
                onClick={() => confirmingClosePane && closeWorkspacePane(confirmingClosePane)}
                data-r2-workspace-pane-close-confirm={confirmingClosePaneId || undefined}
              >
                确认关闭
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(configuringPaneId)} onOpenChange={(open) => !open && setConfiguringPaneId("")}>
        <DialogContent
          className="meowdesk-picker-dialog w-[min(560px,calc(100vw-32px))]"
          data-r2-workspace-config-dialog
          data-meow-picker-dialog="workspace-config"
          data-meow-picker-family="agent-tool-picker"
          data-meow-picker-live="native-content"
        >
          <DialogHeader>
            <DialogTitle>配置工作窗</DialogTitle>
            <DialogDescription>
              选择要放进这个工作窗的 CLI Agent、本地终端或预览窗口；工作区用于日常少切窗，工坊用于制作 Meowdesk 组件、功能页等作品。
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1" data-r2-workspace-config-tool-list>
            {configChoices.map((choice) => {
              const Icon = choice.kind === "browser" ? Monitor : choice.kind === "terminal" ? Terminal : Bot;
              return (
                <button
                  key={choice.id}
                  type="button"
                  className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-background/55 px-3 py-2 text-left text-xs transition hover:border-primary/45 hover:bg-primary/10"
                  data-r2-workspace-config-tool={choice.id}
                  data-r2-workspace-config-tool-kind={choice.kind}
                  onClick={() => configureWorkspacePane(choice)}
                >
                  {choice.kind === "browser" ? (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary/35 bg-primary/10 text-primary">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                  ) : (
                    <AccessAgentIcon name={choice.name} kind={choice.kind} />
                  )}
                  <span className="min-w-0">
                    <strong className="block truncate text-sm text-foreground">{choice.name}</strong>
                    <span className="mt-1 block truncate text-muted-foreground">{choice.detail}</span>
                  </span>
                  <Badge variant={workspaceRendererProfileForPane(choice) === "hermes" ? "warning" : choice.kind === "browser" ? "primary" : "default"}>
                    {workspaceRendererProfileForPane(choice) === "hermes" ? `${choice.actionLabel} · Beta` : choice.actionLabel}
                  </Badge>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfiguringPaneId("")}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RouteFrame>
  );
}

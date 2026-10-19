import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Boxes, ChevronDown, Pin, Plus, Trash2, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MeowBoxDescriptor, ProductShellLaunchItem, ProductShellProjection } from "./product-shell-model";

export type ProductShellRouteView<T extends string = string> = {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: ReactNode;
};

export type ProductShellSidebarControlsProps<T extends string = string> = {
  projection: ProductShellProjection;
  routes: Array<ProductShellRouteView<T>>;
  activeRoute: T;
  onRouteChange: (route: T) => void;
  sidebarCollapsed: boolean;
  onSidebarPinChange?: (routeId: string, pinned: boolean) => void;
  onBoxCreate?: () => void;
  onBoxDelete?: (boxId: string) => void;
  onRouteBoxMove?: (routeId: string, boxId: string) => void;
};

const productShellDragMime = "application/x-meowdesk-product-shell-route";

export function ProductShellSidebarControls<T extends string>({
  projection,
  routes,
  activeRoute,
  onRouteChange,
  sidebarCollapsed,
  onSidebarPinChange,
  onBoxCreate,
  onBoxDelete,
  onRouteBoxMove
}: ProductShellSidebarControlsProps<T>) {
  const [boxOpen, setBoxOpen] = useState(false);
  const [openBoxId, setOpenBoxId] = useState("default");
  const [sidebarDropActive, setSidebarDropActive] = useState(false);
  const [boxDropActiveId, setBoxDropActiveId] = useState("");
  const [dragRouteId, setDragRouteId] = useState("");
  const dragRouteIdRef = useRef("");
  const routeById = useMemo(() => new Map(routes.map((route) => [String(route.id), route])), [routes]);
  const launchItemByRouteId = useMemo(
    () => new Map(projection.launchItems.map((item) => [item.routeId, item])),
    [projection.launchItems]
  );
  const selectedBox = projection.meowBoxes.find((box) => box.id === openBoxId) || projection.meowBoxes[0];
  const showSidebarPinZone = Boolean(dragRouteId || sidebarDropActive);
  useEffect(() => {
    setBoxOpen(false);
  }, [activeRoute]);
  useEffect(() => {
    if (!projection.meowBoxes.some((box) => box.id === openBoxId)) {
      setOpenBoxId(projection.meowBoxes[0]?.id || "default");
    }
  }, [openBoxId, projection.meowBoxes]);
  const activateRoute = (routeId: string) => {
    onRouteChange(routeId as T);
    setBoxOpen(false);
  };
  const togglePinned = (routeId: string, pinned: boolean) => {
    onSidebarPinChange?.(routeId, pinned);
  };
  const isMovableRoute = (routeId: string) => {
    const item = launchItemByRouteId.get(routeId);
    return Boolean(item && !item.locked);
  };
  const readDragRouteId = (event: DragEvent) => {
    return event.dataTransfer.getData(productShellDragMime) || event.dataTransfer.getData("text/plain") || dragRouteIdRef.current || dragRouteId;
  };
  const startRouteDrag = (event: DragEvent, routeId: string) => {
    if (!isMovableRoute(routeId)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(productShellDragMime, routeId);
    event.dataTransfer.setData("text/plain", routeId);
    dragRouteIdRef.current = routeId;
    setDragRouteId(routeId);
  };
  const clearRouteDrag = () => {
    dragRouteIdRef.current = "";
    setDragRouteId("");
    setSidebarDropActive(false);
    setBoxDropActiveId("");
  };
  const handleSidebarDragOver = (event: DragEvent) => {
    const routeId = readDragRouteId(event);
    if (!routeId || !isMovableRoute(routeId)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setSidebarDropActive(true);
  };
  const handleSidebarDrop = (event: DragEvent) => {
    const routeId = readDragRouteId(event);
    setSidebarDropActive(false);
    if (!routeId || !isMovableRoute(routeId)) return;
    event.preventDefault();
    event.stopPropagation();
    togglePinned(routeId, true);
    setBoxOpen(false);
    clearRouteDrag();
  };
  const handleBoxDragOver = (event: DragEvent, boxId: string) => {
    const routeId = readDragRouteId(event);
    if (!routeId || !isMovableRoute(routeId)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setBoxDropActiveId(boxId);
  };
  const handleBoxDrop = (event: DragEvent, boxId: string) => {
    const routeId = readDragRouteId(event);
    setBoxDropActiveId("");
    if (!routeId || !isMovableRoute(routeId)) return;
    event.preventDefault();
    event.stopPropagation();
    onRouteBoxMove?.(routeId, boxId);
    setOpenBoxId(boxId);
    setBoxOpen(true);
    clearRouteDrag();
  };
  const renderLaunchRow = (item: ProductShellLaunchItem, box: MeowBoxDescriptor) => {
    const route = routeById.get(item.routeId);
    const Icon = route?.icon || Boxes;
    const canPin = !item.locked && Boolean(onSidebarPinChange);
    return (
      <div
        key={item.routeId}
        className="meowdesk-meow-box-item flex min-w-0 items-center gap-1"
        data-meow-box-item={item.routeId}
        data-meow-box-item-owner={box.id}
      >
        <button
          type="button"
          role="menuitem"
          disabled={!item.launchable}
          draggable={canPin}
          data-meow-box-launch={item.routeId}
          data-meow-box-launch-draggable={canPin ? "true" : "false"}
          data-meow-box-launch-box={box.id}
          data-meow-box-launch-mounted={item.mounted ? "true" : "false"}
          data-meow-box-launch-active={item.active ? "true" : undefined}
          data-meow-box-launch-pinned={item.pinned ? "true" : undefined}
          data-meow-box-launch-attach-mode={item.attachMode}
          data-meow-box-launch-runtime-count={item.runtimeCount}
          data-meow-box-launch-primary-runtime={item.primaryRuntimeKey || undefined}
          onDragStart={(event) => startRouteDrag(event, item.routeId)}
          onDragEnd={clearRouteDrag}
          onClick={() => activateRoute(item.routeId)}
          className={cn(
            "meowdesk-meow-box-launch grid h-9 min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-45",
            item.active && "bg-accent text-foreground"
          )}
        >
          <Icon size={15} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span className="flex min-w-0 shrink-0 items-center justify-end gap-1 whitespace-nowrap" data-meow-box-launch-meta={item.routeId}>
            {route?.badge ? <Badge className="h-5 shrink-0 px-1.5 text-[10px] leading-none">{route.badge}</Badge> : null}
            {item.reattachableRuntimeCount ? <Badge className="h-5 shrink-0 px-1.5 text-[10px] leading-none" variant="success">{item.reattachableRuntimeCount}</Badge> : null}
            {item.mounted ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden="true" /> : null}
          </span>
        </button>
        {canPin ? (
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={item.pinned}
            title={item.pinned ? "从左侧栏移除" : "固定到左侧栏"}
            data-meow-box-pin={item.routeId}
            data-meow-box-pin-active={item.pinned ? "true" : undefined}
            onClick={() => togglePinned(item.routeId, !item.pinned)}
            className={cn(
              "meowdesk-meow-box-mini-action flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              item.pinned && "text-foreground"
            )}
          >
            {item.pinned ? "−" : "+"}
            <span className="sr-only">{item.pinned ? "取消固定" : "固定"}</span>
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className={cn("flex min-h-0 w-full flex-col gap-3", sidebarCollapsed && "items-center")}
      data-product-shell
      data-product-shell-drag-route={dragRouteId || undefined}
      data-product-shell-owner={projection.owner}
      data-product-shell-source-owner={projection.sourceOwner}
      data-product-shell-runtime-source-owner={projection.runtimeSourceOwner}
      data-product-shell-open-count={projection.counts.open}
      data-product-shell-detached-count={projection.counts.detached}
      data-product-shell-runtime-count={projection.counts.runtimes}
      data-product-shell-reattachable-runtime-count={projection.counts.reattachableRuntimes}
      data-product-shell-active-surface={projection.activeSurfaceId}
    >
      {projection.sidebarPinnedItems.length ? (
        <div
          className={cn("grid w-full gap-1", sidebarCollapsed && "justify-items-center")}
          data-product-shell-sidebar-pinned
          data-product-shell-sidebar-pinned-owner={projection.owner}
          data-product-shell-sidebar-pinned-drop-active={sidebarDropActive ? "true" : undefined}
          onDragEnter={handleSidebarDragOver}
          onDragOver={handleSidebarDragOver}
          onDragLeave={() => setSidebarDropActive(false)}
          onDrop={handleSidebarDrop}
        >
          {projection.sidebarPinnedItems.map((item) => {
            const route = routeById.get(item.routeId);
            const Icon = route?.icon || Boxes;
            const active = item.active || String(activeRoute) === item.routeId;
            return (
              <button
                key={item.routeId}
                type="button"
                draggable={!item.locked}
                aria-current={active ? "page" : undefined}
                title={route?.label || item.label}
                data-next-route={item.routeId}
                data-product-shell-sidebar-pinned-item={item.routeId}
                data-product-shell-sidebar-pinned-active={active ? "true" : undefined}
                data-product-shell-sidebar-pinned-box={item.boxId || undefined}
                data-meow-action-owner={sidebarCollapsed ? "product-shell" : undefined}
                data-meow-action-family={sidebarCollapsed ? "workspace-action-surface" : undefined}
                data-meow-action-state={sidebarCollapsed ? "primary" : undefined}
                data-meow-action-source={sidebarCollapsed ? "product-shell-sidebar-pinned" : undefined}
                onDragStart={(event) => startRouteDrag(event, item.routeId)}
                onDragEnd={clearRouteDrag}
                onClick={() => activateRoute(item.routeId)}
                className={cn(
                  "meowdesk-sidebar-route flex h-9 min-w-0 items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  sidebarCollapsed ? "w-9 justify-center px-0" : "w-full px-2",
                  active && "bg-accent text-foreground",
                  sidebarCollapsed && "meowdesk-workspace-action-surface"
                )}
              >
                <Icon size={16} aria-hidden="true" />
                <span className={cn("min-w-0 flex-1 truncate text-left", sidebarCollapsed && "sr-only")}>{route?.label || item.label}</span>
                {route?.badge && !sidebarCollapsed ? <span className="text-[11px] text-muted-foreground">{route.badge}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {showSidebarPinZone ? (
        <div
          className={cn(
            "meowdesk-sidebar-pin-zone grid min-h-9 w-full place-items-center rounded-md border border-transparent bg-transparent px-2 text-[11px] text-muted-foreground",
            sidebarCollapsed && "min-h-8 w-9 px-0",
            sidebarDropActive && "is-drop-active border-primary/35 bg-primary/15 shadow-[0_0_18px_rgba(77,163,255,0.18)]"
          )}
          data-product-shell-sidebar-pin-zone
          data-product-shell-sidebar-pin-zone-active={sidebarDropActive ? "true" : undefined}
          data-meow-action-owner={sidebarCollapsed ? "product-shell" : undefined}
          data-meow-action-family={sidebarCollapsed ? "product-shell-drop-target" : undefined}
          data-meow-action-state={sidebarDropActive ? "drop-active" : "idle"}
          data-meow-action-source={sidebarCollapsed ? "product-shell-sidebar-pin-zone" : undefined}
          onDragEnter={handleSidebarDragOver}
          onDragOver={handleSidebarDragOver}
          onDragLeave={() => setSidebarDropActive(false)}
          onDrop={handleSidebarDrop}
        >
          <Pin
            className={cn(!sidebarCollapsed && "sr-only")}
            data-product-shell-sidebar-pin-zone-icon
            size={15}
            aria-hidden="true"
          />
          <span className={cn(sidebarCollapsed && "sr-only")}>拖到这里固定到侧栏</span>
        </div>
      ) : null}

      <div className={cn("relative w-full", sidebarCollapsed && "grid justify-items-center")} data-meow-box>
        <Button
          type="button"
          variant="outline"
          size={sidebarCollapsed ? "icon" : "sm"}
          aria-expanded={boxOpen}
          aria-haspopup="menu"
          title="打开 Meow Box"
          data-meow-box-trigger
          data-meow-box-owner={projection.owner}
          data-meow-box-family="product-shell-meow-box"
          data-meow-box-collapsed={sidebarCollapsed ? "true" : "false"}
          data-meow-box-open={boxOpen ? "true" : undefined}
          data-meow-box-drop-active={boxDropActiveId === "default" ? "true" : undefined}
          data-meow-action-owner={sidebarCollapsed ? "product-shell" : undefined}
          data-meow-action-family={sidebarCollapsed ? "workspace-action-surface" : undefined}
          data-meow-action-state={sidebarCollapsed ? "primary" : undefined}
          data-meow-action-source={sidebarCollapsed ? "product-shell-meow-box-trigger" : undefined}
          className={cn("h-9", sidebarCollapsed ? "mx-auto w-9 meowdesk-workspace-action-surface" : "w-full justify-start px-2")}
          onClick={() => setBoxOpen((current) => !current)}
          onDragEnter={(event) => handleBoxDragOver(event, "default")}
          onDragOver={(event) => handleBoxDragOver(event, "default")}
          onDragLeave={() => setBoxDropActiveId("")}
          onDrop={(event) => handleBoxDrop(event, "default")}
        >
          <Boxes size={16} aria-hidden="true" />
          <span className={cn("min-w-0 flex-1 truncate text-left", sidebarCollapsed && "sr-only")}>Meow Box</span>
          <ChevronDown className={cn(sidebarCollapsed && "sr-only")} size={13} aria-hidden="true" />
        </Button>
        {boxOpen ? (
          <div
            role="menu"
            className={cn(
              "meowdesk-meow-box-menu absolute z-50 grid w-72 gap-2 rounded-md border border-border bg-surface-raised p-2 text-xs shadow-xl",
              sidebarCollapsed ? "left-[calc(100%+8px)] top-0" : "left-0 top-[calc(100%+8px)]"
            )}
            data-meow-box-menu
            data-meow-box-owner={projection.owner}
            data-meow-box-family="product-shell-meow-box"
            data-meow-box-active-id={selectedBox?.id || "default"}
            data-meow-box-menu-state="open"
            data-meow-box-ready="true"
          >
            <div className="flex min-w-0 items-center gap-1" data-meow-box-switcher>
              {projection.meowBoxes.map((box) => (
                <button
                  key={box.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selectedBox?.id === box.id}
                  data-meow-box-switch={box.id}
                  data-meow-box-switch-active={selectedBox?.id === box.id ? "true" : undefined}
                  data-meow-box-drop-active={boxDropActiveId === box.id ? "true" : undefined}
                  data-meow-box-switch-count={box.itemRouteIds.length}
                  onClick={() => setOpenBoxId(box.id)}
                  onDragEnter={(event) => handleBoxDragOver(event, box.id)}
                  onDragOver={(event) => handleBoxDragOver(event, box.id)}
                  onDragLeave={() => setBoxDropActiveId("")}
                  onDrop={(event) => handleBoxDrop(event, box.id)}
                  className={cn(
                    "meowdesk-meow-box-switch min-w-0 flex-1 rounded-md px-2 py-1 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    selectedBox?.id === box.id && "bg-accent text-foreground",
                    boxDropActiveId === box.id && "bg-primary/15 text-foreground"
                  )}
                >
                  <span className="block truncate">{box.title}</span>
                </button>
              ))}
              {onBoxCreate ? (
                <button
                  type="button"
                  role="menuitem"
                  aria-label="新建 Box"
                  title="新建 Box"
                  data-meow-box-create
                  onClick={onBoxCreate}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus size={13} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {selectedBox ? (
              <div
                key={selectedBox.id}
                className="grid gap-1"
                data-meow-box-id={selectedBox.id}
                data-meow-box-default={selectedBox.defaultBox ? "true" : undefined}
                data-meow-box-drop-active={boxDropActiveId === selectedBox.id ? "true" : undefined}
                onDragEnter={(event) => handleBoxDragOver(event, selectedBox.id)}
                onDragOver={(event) => handleBoxDragOver(event, selectedBox.id)}
                onDragLeave={() => setBoxDropActiveId("")}
                onDrop={(event) => handleBoxDrop(event, selectedBox.id)}
              >
                {!selectedBox.defaultBox ? (
                  <div className="flex items-center justify-between gap-2 px-1.5 py-1 text-[11px] font-medium text-muted-foreground">
                    <span>{selectedBox.defaultBox ? "" : selectedBox.title}</span>
                    {!selectedBox.defaultBox && onBoxDelete ? (
                      <button
                        type="button"
                        role="menuitem"
                        aria-label="解散 Box"
                        title="解散 Box"
                        data-meow-box-delete={selectedBox.id}
                        onClick={() => onBoxDelete(selectedBox.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {selectedBox.itemRouteIds.length ? selectedBox.itemRouteIds.map((routeId) => {
                  const item = launchItemByRouteId.get(routeId);
                  return item ? renderLaunchRow(item, selectedBox) : null;
                }) : (
                  <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground" data-meow-box-empty={selectedBox.id}>
                    空 Box
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={cn("grid min-h-0 w-full gap-1", sidebarCollapsed && "justify-items-center")}
        data-meow-tabs
        data-meow-tabs-owner={projection.owner}
      >
        {!sidebarCollapsed ? <div className="px-2 text-[11px] font-medium text-muted-foreground">运行中</div> : null}
        {projection.openTabs.length ? projection.openTabs.map((tab) => {
          const route = routeById.get(tab.routeId);
          const Icon = route?.icon;
          const active = tab.active || String(activeRoute) === tab.routeId;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={active ? "page" : undefined}
              title={tab.title}
              data-meow-tab={tab.id}
              data-meow-tab-route={tab.routeId}
              data-meow-tab-status={tab.status}
              data-meow-tab-active={active ? "true" : undefined}
              data-meow-tab-policy={tab.tabPolicy}
              data-meow-tab-closable={tab.closable ? "true" : "false"}
              data-meow-tab-attach-mode={tab.attachMode}
              data-meow-tab-runtime-count={tab.runtimeCount}
              data-meow-tab-reattachable-runtime-count={tab.reattachableRuntimeCount}
              data-meow-tab-primary-runtime={tab.primaryRuntimeKey || undefined}
              data-meow-action-owner={sidebarCollapsed ? "product-shell" : undefined}
              data-meow-action-family={sidebarCollapsed ? "workspace-action-surface" : undefined}
              data-meow-action-state={sidebarCollapsed ? "primary" : undefined}
              data-meow-action-source={sidebarCollapsed ? "product-shell-open-tab" : undefined}
              onClick={() => activateRoute(tab.routeId)}
              className={cn(
                "flex h-9 min-w-0 items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                sidebarCollapsed ? "w-9 justify-center px-0" : "w-full px-2",
                active && "bg-accent text-foreground",
                sidebarCollapsed && "meowdesk-workspace-action-surface"
              )}
            >
              {Icon ? <Icon size={16} aria-hidden="true" /> : null}
              <span className={cn("min-w-0 flex-1 truncate text-left", sidebarCollapsed && "sr-only")}>{route?.label || tab.title}</span>
              {tab.reattachableRuntimeCount ? <Badge className={cn(sidebarCollapsed && "sr-only")} variant="success">{tab.reattachableRuntimeCount}</Badge> : null}
              {tab.status === "detached" ? <span className={cn("h-1.5 w-1.5 rounded-full bg-warning", sidebarCollapsed && "sr-only")} aria-hidden="true" /> : null}
            </button>
          );
        }) : (
          <span className={cn("px-2 text-xs text-muted-foreground", sidebarCollapsed && "sr-only")} data-meow-tabs-empty>暂无运行中</span>
        )}
      </div>
    </div>
  );
}

export const ProductShellControls = ProductShellSidebarControls;
export type ProductShellControlsProps<T extends string = string> = ProductShellSidebarControlsProps<T>;

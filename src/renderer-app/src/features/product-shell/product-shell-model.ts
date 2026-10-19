import type { OpenSurfaceRegistrySnapshot } from "@/features/open-surface/open-surface-registry";
import type {
  RuntimeSurfaceAttachmentSnapshot,
  RuntimeSurfaceRouteAttachment
} from "@/features/open-surface/open-surface-runtime-attachments";
import type { OpenSurfaceDescriptor, SurfaceId } from "@/lib/identity";

export type ProductShellRouteKind =
  | "core-route"
  | "workspace"
  | "studio"
  | "conversation"
  | "feature-page";
export type ProductShellSidebarPlacement = "core" | "pinned" | "box-only";
export type ProductShellTabPolicy = "ephemeral" | "surface" | "runtime";

export type ProductShellRouteInput = {
  id: string;
  label: string;
  kind?: ProductShellRouteKind;
  sidebarPlacement?: ProductShellSidebarPlacement;
  tabPolicy?: ProductShellTabPolicy;
  launchable?: boolean;
  priority?: number;
};

export type ProductShellBoxInput = {
  id: string;
  title: string;
  itemRouteIds?: string[];
};

export type ProductShellSurfaceTab = {
  id: string;
  routeId: string;
  title: string;
  active: boolean;
  status: OpenSurfaceDescriptor["status"];
  sourceOwner: OpenSurfaceDescriptor["owner"];
  tabPolicy: ProductShellTabPolicy;
  closable: boolean;
  closeMode: "detach-only" | "not-closable";
  attachMode: "route-only" | "runtime-reattach";
  runtimeCount: number;
  reattachableRuntimeCount: number;
  runtimeIds: string[];
  primaryRuntimeId?: string;
  primaryRuntimeKey?: string;
  hasRunningRuntime: boolean;
};

export type ProductShellLaunchItem = {
  routeId: string;
  label: string;
  kind: ProductShellRouteKind;
  sidebarPlacement: ProductShellSidebarPlacement;
  tabPolicy: ProductShellTabPolicy;
  active: boolean;
  mounted: boolean;
  launchable: boolean;
  locked: boolean;
  pinned: boolean;
  surfaceId?: string;
  attachMode: "route-only" | "runtime-reattach";
  runtimeCount: number;
  reattachableRuntimeCount: number;
  primaryRuntimeId?: string;
  primaryRuntimeKey?: string;
  boxId?: string;
  boxTitle?: string;
};

export type MeowBoxDescriptor = {
  id: string;
  title: string;
  owner: "product-shell";
  defaultBox: boolean;
  itemRouteIds: string[];
};

export type ProductShellProjection = {
  owner: "product-shell";
  sourceOwner: "open-surface-registry";
  runtimeSourceOwner: "runtime-surface-attachments" | "none";
  activeSurfaceId: string;
  openTabs: ProductShellSurfaceTab[];
  launchItems: ProductShellLaunchItem[];
  sidebarCoreItems: ProductShellLaunchItem[];
  sidebarPinnedItems: ProductShellLaunchItem[];
  meowBoxes: MeowBoxDescriptor[];
  counts: {
    open: number;
    detached: number;
    launchable: number;
    pinned: number;
    runtimes: number;
    reattachableRuntimes: number;
  };
};

export function productShellRouteKindForRouteId(routeId: string): ProductShellRouteKind {
  if (routeId === "workspace") return "workspace";
  if (routeId === "studio") return "studio";
  if (routeId === "conversations") return "conversation";
  if (routeId.startsWith("feature:")) return "feature-page";
  return "core-route";
}

export function productShellTabPolicyForRouteId(routeId: string): ProductShellTabPolicy {
  if (routeId === "workspace" || routeId === "studio") return "surface";
  return "ephemeral";
}

function normalizeBoxId(id: string) {
  return String(id || "").trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64);
}

function normalizeRouteInput(route: ProductShellRouteInput, index: number): Required<ProductShellRouteInput> {
  const id = String(route.id || "").trim();
  const label = String(route.label || id || "Untitled").trim();
  return {
    id,
    label,
    kind: route.kind || productShellRouteKindForRouteId(id),
    sidebarPlacement: route.sidebarPlacement || "box-only",
    tabPolicy: route.tabPolicy || productShellTabPolicyForRouteId(id),
    launchable: route.launchable !== false,
    priority: Number.isFinite(route.priority) ? Number(route.priority) : index
  };
}

function normalizeBoxInput(box: ProductShellBoxInput, index: number): ProductShellBoxInput | null {
  const id = normalizeBoxId(box.id);
  if (!id || id === "default") return null;
  const title = String(box.title || `Meow Box ${index + 2}`).trim() || `Meow Box ${index + 2}`;
  return {
    id,
    title,
    itemRouteIds: Array.isArray(box.itemRouteIds) ? box.itemRouteIds.map((routeId) => String(routeId || "").trim()).filter(Boolean) : []
  };
}

function surfaceTabFromDescriptor(
  surface: OpenSurfaceDescriptor,
  routeById: Map<string, Required<ProductShellRouteInput>>,
  runtimeAttachment?: RuntimeSurfaceRouteAttachment
): ProductShellSurfaceTab | null {
  if (!surface.routeId || surface.status === "closed") return null;
  const route = routeById.get(surface.routeId);
  const tabPolicy = route?.tabPolicy || productShellTabPolicyForRouteId(surface.routeId);
  if (tabPolicy === "ephemeral") return null;
  const hasRuntimeLifecycle = Boolean(runtimeAttachment?.runtimeCount);
  const closable = tabPolicy === "surface" || hasRuntimeLifecycle;
  return {
    id: String(surface.id),
    routeId: surface.routeId,
    title: surface.title,
    active: surface.status === "active",
    status: surface.status,
    sourceOwner: surface.owner,
    tabPolicy,
    closable,
    closeMode: closable ? "detach-only" : "not-closable",
    attachMode: runtimeAttachment?.attachMode || "route-only",
    runtimeCount: runtimeAttachment?.runtimeCount || 0,
    reattachableRuntimeCount: runtimeAttachment?.reattachableRuntimeCount || 0,
    runtimeIds: runtimeAttachment?.runtimeIds || [],
    primaryRuntimeId: runtimeAttachment?.primaryRuntimeId || undefined,
    primaryRuntimeKey: runtimeAttachment?.primaryRuntimeKey || undefined,
    hasRunningRuntime: runtimeAttachment?.hasRunningRuntime || false
  };
}

function runtimeSurfaceTabDescriptor(
  attachment: RuntimeSurfaceRouteAttachment,
  route: Required<ProductShellRouteInput>
): OpenSurfaceDescriptor {
  return {
    id: attachment.routeSurfaceId as SurfaceId,
    surfaceId: attachment.routeSurfaceId as SurfaceId,
    kind: "route",
    routeId: attachment.routeId,
    title: route.label || attachment.title,
    owner: "open-surface-registry",
    status: attachment.routeSurfaceStatus === "closed" ? "detached" : attachment.routeSurfaceStatus
  };
}

export function createProductShellProjection(input: {
  routes: ProductShellRouteInput[];
  boxes?: ProductShellBoxInput[];
  openSurfaceRegistry: OpenSurfaceRegistrySnapshot;
  runtimeSurfaceAttachments?: RuntimeSurfaceAttachmentSnapshot;
}): ProductShellProjection {
  const routes = input.routes
    .map(normalizeRouteInput)
    .filter((route) => route.id)
    .sort((a, b) => a.priority - b.priority);
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const runtimeAttachmentByRouteId = input.runtimeSurfaceAttachments?.byRouteId || {};
  const openTabs = input.openSurfaceRegistry.mountedSurfaces
    .map((surface) => surfaceTabFromDescriptor(surface, routeById, surface.routeId ? runtimeAttachmentByRouteId[surface.routeId] : undefined))
    .filter((tab): tab is ProductShellSurfaceTab => Boolean(tab));
  const openTabRouteIds = new Set(openTabs.map((tab) => tab.routeId));
  for (const attachment of input.runtimeSurfaceAttachments?.routeAttachments || []) {
    if (!attachment.runtimeCount || openTabRouteIds.has(attachment.routeId)) continue;
    const route = routeById.get(attachment.routeId);
    if (!route) continue;
    const tab = surfaceTabFromDescriptor(runtimeSurfaceTabDescriptor(attachment, route), routeById, attachment);
    if (!tab) continue;
    openTabs.push(tab);
    openTabRouteIds.add(tab.routeId);
  }
  const normalizedBoxes = (input.boxes || [])
    .map(normalizeBoxInput)
    .filter((box): box is ProductShellBoxInput => Boolean(box));
  const assignedBoxByRouteId = new Map<string, ProductShellBoxInput>();
  const boxableRouteIds = new Set(routes
    .filter((route) => route.sidebarPlacement === "box-only")
    .map((route) => route.id));
  const userBoxes = normalizedBoxes.map((box) => {
    const itemRouteIds: string[] = [];
    const seenRouteIds = new Set<string>();
    for (const routeId of box.itemRouteIds || []) {
      if (!boxableRouteIds.has(routeId) || assignedBoxByRouteId.has(routeId) || seenRouteIds.has(routeId)) continue;
      seenRouteIds.add(routeId);
      itemRouteIds.push(routeId);
      assignedBoxByRouteId.set(routeId, box);
    }
    return {
      id: box.id,
      title: box.title,
      owner: "product-shell" as const,
      defaultBox: false,
      itemRouteIds
    };
  });
  const launchItems = routes.map((route) => {
    const surface = input.openSurfaceRegistry.byRouteId[route.id];
    const runtimeAttachment = runtimeAttachmentByRouteId[route.id];
    const assignedBox = assignedBoxByRouteId.get(route.id);
    return {
      routeId: route.id,
      label: route.label,
      kind: route.kind,
      sidebarPlacement: route.sidebarPlacement,
      tabPolicy: route.tabPolicy,
      active: surface?.status === "active",
      mounted: surface ? surface.status === "active" || surface.status === "detached" : false,
      launchable: route.launchable,
      locked: route.sidebarPlacement === "core",
      pinned: route.sidebarPlacement === "pinned",
      surfaceId: surface ? String(surface.id) : undefined,
      attachMode: runtimeAttachment?.attachMode || "route-only",
      runtimeCount: runtimeAttachment?.runtimeCount || 0,
      reattachableRuntimeCount: runtimeAttachment?.reattachableRuntimeCount || 0,
      primaryRuntimeId: runtimeAttachment?.primaryRuntimeId || undefined,
      primaryRuntimeKey: runtimeAttachment?.primaryRuntimeKey || undefined,
      boxId: assignedBox?.id,
      boxTitle: assignedBox?.title
    };
  });
  const sidebarCoreItems = launchItems.filter((item) => item.sidebarPlacement === "core");
  const sidebarPinnedItems = launchItems.filter((item) => item.sidebarPlacement === "pinned");
  const defaultMeowBox = {
    id: "default",
    title: "Meow Box",
    owner: "product-shell" as const,
    defaultBox: true,
    itemRouteIds: launchItems
      .filter((item) => item.sidebarPlacement === "box-only" && !assignedBoxByRouteId.has(item.routeId))
      .map((item) => item.routeId)
  };

  return {
    owner: "product-shell",
    sourceOwner: "open-surface-registry",
    runtimeSourceOwner: input.runtimeSurfaceAttachments?.owner || "none",
    activeSurfaceId: input.openSurfaceRegistry.activeSurface ? String(input.openSurfaceRegistry.activeSurface.id) : "",
    openTabs,
    launchItems,
    sidebarCoreItems,
    sidebarPinnedItems,
    meowBoxes: [defaultMeowBox, ...userBoxes],
    counts: {
      open: openTabs.length,
      detached: input.openSurfaceRegistry.detachedSurfaces.length,
      launchable: launchItems.filter((item) => item.launchable).length,
      pinned: sidebarPinnedItems.length,
      runtimes: input.runtimeSurfaceAttachments?.counts.runtimes || 0,
      reattachableRuntimes: input.runtimeSurfaceAttachments?.counts.reattachableRuntimes || 0
    }
  };
}

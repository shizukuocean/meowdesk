import {
  DEFAULT_PROJECT_ID,
  createOwnershipId,
  type OpenSurfaceDescriptor,
  type SurfaceId
} from "@/lib/identity";

export type OpenSurfaceRouteState = {
  routeId: string;
  title: string;
  active: boolean;
  mounted: boolean;
};

export type OpenSurfaceRegistrySnapshot = {
  surfaces: OpenSurfaceDescriptor[];
  activeSurface: OpenSurfaceDescriptor | null;
  mountedSurfaces: OpenSurfaceDescriptor[];
  detachedSurfaces: OpenSurfaceDescriptor[];
  bySurfaceId: Record<string, OpenSurfaceDescriptor>;
  byRouteId: Record<string, OpenSurfaceDescriptor>;
};

export function openSurfaceIdForRoute(routeId: string): SurfaceId {
  return createOwnershipId("surface", "route", routeId);
}

function normalizeRouteState(route: OpenSurfaceRouteState): OpenSurfaceRouteState {
  const routeId = String(route.routeId || "").trim();
  return {
    routeId,
    title: String(route.title || routeId || "Untitled surface").trim(),
    active: route.active === true,
    mounted: route.mounted === true || route.active === true
  };
}

export function createRouteSurfaceDescriptor(route: OpenSurfaceRouteState): OpenSurfaceDescriptor {
  const normalized = normalizeRouteState(route);
  return {
    id: openSurfaceIdForRoute(normalized.routeId),
    kind: "route",
    routeId: normalized.routeId,
    title: normalized.title,
    owner: "open-surface-registry",
    status: normalized.active ? "active" : normalized.mounted ? "detached" : "closed",
    surfaceId: openSurfaceIdForRoute(normalized.routeId),
    projectId: DEFAULT_PROJECT_ID
  };
}

export function createOpenSurfaceRegistry(routes: OpenSurfaceRouteState[]): OpenSurfaceRegistrySnapshot {
  const routeIds = new Set<string>();
  const surfaces = routes
    .map(normalizeRouteState)
    .filter((route) => {
      if (!route.routeId || routeIds.has(route.routeId)) return false;
      routeIds.add(route.routeId);
      return true;
    })
    .map(createRouteSurfaceDescriptor);
  const bySurfaceId = Object.fromEntries(surfaces.map((surface) => [String(surface.id), surface]));
  const byRouteId = Object.fromEntries(surfaces.map((surface) => [surface.routeId || String(surface.id), surface]));
  return {
    surfaces,
    activeSurface: surfaces.find((surface) => surface.status === "active") || null,
    mountedSurfaces: surfaces.filter((surface) => surface.status === "active" || surface.status === "detached"),
    detachedSurfaces: surfaces.filter((surface) => surface.status === "detached"),
    bySurfaceId,
    byRouteId
  };
}

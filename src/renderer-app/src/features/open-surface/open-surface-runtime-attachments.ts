import type { AgentRuntimeDescriptor, OpenSurfaceDescriptor, OpenSurfaceKind } from "@/lib/identity";
import type { OpenSurfaceRegistrySnapshot } from "./open-surface-registry";

export type RuntimeSurfaceAttachmentOwner = "runtime-surface-attachments";
export type RuntimeSurfaceAttachMode = "route-only" | "runtime-reattach";

export type RuntimeSurfaceRouteRule = {
  routeId: string;
  runtimeSurfaceKinds: OpenSurfaceKind[];
  title?: string;
};

export type RuntimeSurfaceAttachmentRuntime = {
  id: string;
  runtimeId: string;
  runtimeKey: string;
  sessionId?: string;
  sessionKey?: string;
  toolId?: string;
  surfaceId?: string;
  conversationId?: string;
  agentId?: string;
  sourceId?: string;
  projectId?: string;
  status: AgentRuntimeDescriptor["status"];
  attachStatus: AgentRuntimeDescriptor["attachStatus"];
  reattachable: boolean;
  cwd?: string;
  startedAt?: number;
};

export type RuntimeSurfaceRouteAttachment = {
  routeId: string;
  routeSurfaceId: string;
  routeSurfaceStatus: OpenSurfaceDescriptor["status"];
  title: string;
  owner: RuntimeSurfaceAttachmentOwner;
  sourceOwner: "agent-runtime-manager";
  runtimes: RuntimeSurfaceAttachmentRuntime[];
  runtimeIds: string[];
  primaryRuntimeId: string;
  primaryRuntimeKey: string;
  runtimeCount: number;
  reattachableRuntimeCount: number;
  hasRunningRuntime: boolean;
  attachMode: RuntimeSurfaceAttachMode;
};

export type RuntimeSurfaceAttachmentSnapshot = {
  owner: RuntimeSurfaceAttachmentOwner;
  sourceOwners: {
    openSurface: "open-surface-registry";
    runtime: "agent-runtime-manager";
  };
  routeAttachments: RuntimeSurfaceRouteAttachment[];
  byRouteId: Record<string, RuntimeSurfaceRouteAttachment>;
  bySurfaceId: Record<string, RuntimeSurfaceRouteAttachment>;
  orphanRuntimes: RuntimeSurfaceAttachmentRuntime[];
  counts: {
    routes: number;
    runtimes: number;
    runningRuntimes: number;
    reattachableRuntimes: number;
    orphanRuntimes: number;
  };
};

export const defaultRuntimeSurfaceRouteRules: RuntimeSurfaceRouteRule[] = [
  { routeId: "workspace", title: "工作区", runtimeSurfaceKinds: ["workspace-pane", "workspace-viewer"] },
  { routeId: "studio", title: "工坊", runtimeSurfaceKinds: ["studio-agent", "studio-viewer"] },
  { routeId: "conversations", title: "对话管理", runtimeSurfaceKinds: ["conversation"] }
];

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function routeSurfaceIdForRoute(routeId: string) {
  return `surface:route:${String(routeId || "").trim()}`;
}

function splitSurfaceId(value: unknown) {
  const text = stringValue(value);
  const match = text.match(/^surface:([^:]+)(?::(.+))?$/);
  if (!match) return null;
  return {
    kind: match[1] as OpenSurfaceKind,
    localId: match[2] || ""
  };
}

function runtimeIsReattachable(runtime: AgentRuntimeDescriptor) {
  return runtime.status === "running" && runtime.attachStatus !== "unavailable";
}

function runtimeAttachment(runtime: AgentRuntimeDescriptor): RuntimeSurfaceAttachmentRuntime {
  const runtimeId = stringValue(runtime.runtimeId) || stringValue(runtime.id) || runtime.runtimeKey;
  return {
    id: stringValue(runtime.id) || runtimeId,
    runtimeId,
    runtimeKey: runtime.runtimeKey,
    sessionId: stringValue(runtime.sessionId) || undefined,
    sessionKey: runtime.sessionKey,
    toolId: runtime.toolId,
    surfaceId: stringValue(runtime.surfaceId) || undefined,
    conversationId: stringValue(runtime.conversationId) || undefined,
    agentId: stringValue(runtime.agentId) || undefined,
    sourceId: stringValue(runtime.sourceId) || undefined,
    projectId: stringValue(runtime.projectId) || undefined,
    status: runtime.status,
    attachStatus: runtime.attachStatus,
    reattachable: runtimeIsReattachable(runtime),
    cwd: runtime.cwd,
    startedAt: runtime.startedAt
  };
}

function routeIdForRuntime(runtime: AgentRuntimeDescriptor, rules: RuntimeSurfaceRouteRule[]) {
  const surface = splitSurfaceId(runtime.surfaceId);
  if (!surface) return "";
  if (surface.kind === "route") return surface.localId;
  const rule = rules.find((candidate) => candidate.runtimeSurfaceKinds.includes(surface.kind));
  if (rule) return rule.routeId;
  if (surface.kind === "feature-page" && surface.localId) return `feature:${surface.localId}`;
  return "";
}

function sortRuntimeAttachments(
  left: RuntimeSurfaceAttachmentRuntime,
  right: RuntimeSurfaceAttachmentRuntime
) {
  return Number(right.reattachable) - Number(left.reattachable)
    || Number(right.status === "running") - Number(left.status === "running")
    || Number(right.startedAt || 0) - Number(left.startedAt || 0)
    || left.runtimeKey.localeCompare(right.runtimeKey);
}

function routeSortIndex(
  routeId: string,
  surfaceOrder: Map<string, number>,
  rules: RuntimeSurfaceRouteRule[]
) {
  const surfaceIndex = surfaceOrder.get(routeId);
  if (surfaceIndex !== undefined) return surfaceIndex;
  const ruleIndex = rules.findIndex((rule) => rule.routeId === routeId);
  return ruleIndex >= 0 ? 1000 + ruleIndex : 10000;
}

export function createRuntimeSurfaceAttachmentSnapshot(input: {
  openSurfaceRegistry: OpenSurfaceRegistrySnapshot;
  runtimes?: AgentRuntimeDescriptor[];
  routeRules?: RuntimeSurfaceRouteRule[];
}): RuntimeSurfaceAttachmentSnapshot {
  const rules = input.routeRules?.length ? input.routeRules : defaultRuntimeSurfaceRouteRules;
  const runtimeGroups = new Map<string, RuntimeSurfaceAttachmentRuntime[]>();
  const orphanRuntimes: RuntimeSurfaceAttachmentRuntime[] = [];

  for (const runtime of input.runtimes || []) {
    const attachment = runtimeAttachment(runtime);
    const routeId = routeIdForRuntime(runtime, rules);
    if (!routeId) {
      orphanRuntimes.push(attachment);
      continue;
    }
    runtimeGroups.set(routeId, [...(runtimeGroups.get(routeId) || []), attachment]);
  }

  const routeIds = new Set<string>();
  for (const surface of input.openSurfaceRegistry.surfaces) {
    if (surface.routeId) routeIds.add(surface.routeId);
  }
  for (const routeId of runtimeGroups.keys()) routeIds.add(routeId);

  const surfaceOrder = new Map(
    input.openSurfaceRegistry.surfaces
      .map((surface, index) => [surface.routeId || "", index] as const)
      .filter(([routeId]) => Boolean(routeId))
  );

  const routeAttachments = [...routeIds]
    .sort((left, right) => {
      return routeSortIndex(left, surfaceOrder, rules) - routeSortIndex(right, surfaceOrder, rules)
        || left.localeCompare(right);
    })
    .map((routeId) => {
      const surface = input.openSurfaceRegistry.byRouteId[routeId];
      const runtimes = [...(runtimeGroups.get(routeId) || [])].sort(sortRuntimeAttachments);
      const primaryRuntime = runtimes[0];
      const reattachableRuntimeCount = runtimes.filter((runtime) => runtime.reattachable).length;
      const hasRunningRuntime = runtimes.some((runtime) => runtime.status === "running");
      const routeSurfaceId = surface ? String(surface.id) : routeSurfaceIdForRoute(routeId);
      const routeSurfaceStatus = surface?.status || (runtimes.length ? "detached" : "closed");
      const rule = rules.find((candidate) => candidate.routeId === routeId);
      return {
        routeId,
        routeSurfaceId,
        routeSurfaceStatus,
        title: surface?.title || rule?.title || routeId,
        owner: "runtime-surface-attachments" as const,
        sourceOwner: "agent-runtime-manager" as const,
        runtimes,
        runtimeIds: runtimes.map((runtime) => runtime.runtimeId),
        primaryRuntimeId: primaryRuntime?.runtimeId || "",
        primaryRuntimeKey: primaryRuntime?.runtimeKey || "",
        runtimeCount: runtimes.length,
        reattachableRuntimeCount,
        hasRunningRuntime,
        attachMode: reattachableRuntimeCount ? "runtime-reattach" as const : "route-only" as const
      };
    });

  const byRouteId = Object.fromEntries(routeAttachments.map((attachment) => [attachment.routeId, attachment]));
  const bySurfaceId = Object.fromEntries(routeAttachments.map((attachment) => [attachment.routeSurfaceId, attachment]));
  const allRuntimes = routeAttachments.flatMap((attachment) => attachment.runtimes);

  return {
    owner: "runtime-surface-attachments",
    sourceOwners: {
      openSurface: "open-surface-registry",
      runtime: "agent-runtime-manager"
    },
    routeAttachments,
    byRouteId,
    bySurfaceId,
    orphanRuntimes,
    counts: {
      routes: routeAttachments.length,
      runtimes: allRuntimes.length,
      runningRuntimes: allRuntimes.filter((runtime) => runtime.status === "running").length,
      reattachableRuntimes: allRuntimes.filter((runtime) => runtime.reattachable).length,
      orphanRuntimes: orphanRuntimes.length
    }
  };
}

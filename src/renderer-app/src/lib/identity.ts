export type OwnershipIdKind =
  | "runtime"
  | "session"
  | "surface"
  | "conversation"
  | "agent"
  | "source"
  | "project";

export type RuntimeId = string & { readonly __runtimeId: unique symbol };
export type SessionId = string & { readonly __sessionId: unique symbol };
export type SurfaceId = string & { readonly __surfaceId: unique symbol };
export type ConversationId = string & { readonly __conversationId: unique symbol };
export type AgentId = string & { readonly __agentId: unique symbol };
export type SourceId = string & { readonly __sourceId: unique symbol };
export type ProjectId = string & { readonly __projectId: unique symbol };

export type OwnershipScope = {
  runtimeId?: RuntimeId | string;
  sessionId?: SessionId | string;
  surfaceId?: SurfaceId | string;
  conversationId?: ConversationId | string;
  agentId?: AgentId | string;
  sourceId?: SourceId | string;
  projectId?: ProjectId | string;
};

export type OpenSurfaceKind =
  | "route"
  | "workspace-pane"
  | "workspace-viewer"
  | "studio-agent"
  | "studio-viewer"
  | "conversation"
  | "dev-ledger"
  | "feature-page"
  | "sidebar-widget";

export type OpenSurfaceDescriptor = OwnershipScope & {
  id: SurfaceId;
  kind: OpenSurfaceKind;
  routeId?: string;
  title: string;
  owner: "open-surface-registry";
  status: "active" | "detached" | "hibernated" | "closed";
};

export type AgentRuntimeDescriptor = OwnershipScope & {
  id: RuntimeId | string;
  runtimeKey: string;
  sessionKey?: string;
  toolId?: string;
  owner: "agent-runtime-manager";
  status: "idle" | "starting" | "running" | "stopping" | "exited" | "error";
  attachStatus: "reattachable" | "attached" | "detached" | "unavailable";
  cwd?: string;
  startedAt?: number;
};

export type MeowViewerBindingDescriptor = OwnershipScope & {
  viewerSurfaceId: SurfaceId | string;
  targetSurfaceId: SurfaceId | string;
  owner: "meow-viewer";
};

export const DEFAULT_PROJECT_ID = "project:local-workbench" as ProjectId;

function cleanOwnershipPart(value: unknown, fallback: string) {
  const text = String(value || "").trim() || fallback;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    || fallback;
}

function normalizeOwnershipId(kind: OwnershipIdKind, value: unknown, fallback: string) {
  const cleaned = cleanOwnershipPart(value, fallback);
  const prefix = `${kind}:`;
  return cleaned.startsWith(prefix) ? cleaned : `${kind}:${cleaned}`;
}

export function createOwnershipId(kind: "runtime", ...parts: unknown[]): RuntimeId;
export function createOwnershipId(kind: "session", ...parts: unknown[]): SessionId;
export function createOwnershipId(kind: "surface", ...parts: unknown[]): SurfaceId;
export function createOwnershipId(kind: "conversation", ...parts: unknown[]): ConversationId;
export function createOwnershipId(kind: "agent", ...parts: unknown[]): AgentId;
export function createOwnershipId(kind: "source", ...parts: unknown[]): SourceId;
export function createOwnershipId(kind: "project", ...parts: unknown[]): ProjectId;
export function createOwnershipId(kind: OwnershipIdKind, ...parts: unknown[]) {
  const body = parts.length
    ? parts.map((part, index) => cleanOwnershipPart(part, `part-${index + 1}`)).join(":")
    : "default";
  return `${kind}:${body}`;
}

export function normalizeOwnershipScope(scope: OwnershipScope = {}): OwnershipScope {
  return {
    runtimeId: scope.runtimeId,
    sessionId: scope.sessionId,
    surfaceId: scope.surfaceId,
    conversationId: scope.conversationId,
    agentId: scope.agentId,
    sourceId: scope.sourceId,
    projectId: scope.projectId || DEFAULT_PROJECT_ID
  };
}

export function createRuntimeOwnershipScope(input: {
  surfaceKind: OpenSurfaceKind;
  surfaceLocalId: string;
  sessionId: string;
  agentId?: string;
  sourceLocalId?: string;
  conversationId?: string;
  projectId?: string;
}): Required<OwnershipScope> {
  const sessionId = createOwnershipId("session", input.sessionId);
  const surfaceId = createOwnershipId("surface", input.surfaceKind, input.surfaceLocalId);
  const agentId = createOwnershipId("agent", input.agentId || input.sessionId);
  const sourceId = createOwnershipId("source", input.sourceLocalId || input.sessionId);
  const conversationId = input.conversationId
    ? normalizeOwnershipId("conversation", input.conversationId, "conversation") as ConversationId
    : createOwnershipId("conversation", input.surfaceKind, input.surfaceLocalId, input.sessionId);
  const runtimeId = createOwnershipId("runtime", input.sessionId);
  const projectId = input.projectId
    ? normalizeOwnershipId("project", input.projectId, "project") as ProjectId
    : DEFAULT_PROJECT_ID;
  return {
    runtimeId,
    sessionId,
    surfaceId,
    conversationId,
    agentId,
    sourceId,
    projectId
  };
}

export function ownershipAttributes(scope: OwnershipScope) {
  const normalized = normalizeOwnershipScope(scope);
  return {
    "data-runtime-id": normalized.runtimeId || "",
    "data-session-id": normalized.sessionId || "",
    "data-surface-id": normalized.surfaceId || "",
    "data-conversation-id": normalized.conversationId || "",
    "data-agent-id": normalized.agentId || "",
    "data-source-id": normalized.sourceId || "",
    "data-project-id": normalized.projectId || ""
  };
}

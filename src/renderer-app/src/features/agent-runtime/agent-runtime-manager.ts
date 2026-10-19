import {
  killTerminalSession,
  listAgentRuntimeDescriptors,
  onTerminalData,
  onTerminalExit,
  resizeTerminalSession,
  setTerminalSourceAdapter,
  startTerminalSession,
  writeTerminalSession
} from "@/lib/workbench-api";
import type { TerminalDataEvent, TerminalExitEvent, TerminalStartPayload } from "@/lib/workbench-api";
import {
  createRuntimeOwnershipScope,
  normalizeOwnershipScope,
  type AgentRuntimeDescriptor,
  type OpenSurfaceKind,
  type OwnershipScope
} from "@/lib/identity";

export type AgentRuntimeStartPayload = TerminalStartPayload & {
  ownership?: OwnershipScope;
};

type SessionSelector = string | (() => string);
type OwnershipSelector = OwnershipScope | (() => OwnershipScope);
type OwnershipField = keyof OwnershipScope;
export type AgentRuntimeRegistrySelector =
  | string
  | ((runtime: AgentRuntimeDescriptor) => boolean)
  | (Partial<OwnershipScope> & {
    id?: string;
    runtimeKey?: string;
    sessionKey?: string;
    toolId?: string;
  });
export type AgentRuntimeReattachOptions = {
  sourceAdapter?: boolean;
};
export type AgentRuntimeReattachResult =
  | {
    ok: true;
    descriptor: AgentRuntimeDescriptor;
    sourceAdapterActive: boolean;
  }
  | {
    ok: false;
    reason: "missing" | "not-running";
    descriptor?: AgentRuntimeDescriptor;
  };

const OWNERSHIP_FIELDS: OwnershipField[] = [
  "runtimeId",
  "sessionId",
  "surfaceId",
  "conversationId",
  "agentId",
  "sourceId",
  "projectId"
];

function selectedSessionId(selector: SessionSelector) {
  return typeof selector === "function" ? selector() : selector;
}

function selectedOwnership(selector: OwnershipSelector | undefined) {
  return normalizeOwnershipScope(typeof selector === "function" ? selector() : selector);
}

function ownershipMatches(event: OwnershipScope, expected: OwnershipScope) {
  return OWNERSHIP_FIELDS.every((field) => {
    const eventValue = event[field];
    const expectedValue = expected[field];
    if (!expectedValue) return true;
    return Boolean(eventValue) && eventValue === expectedValue;
  });
}

export const __runtimeOwnershipContract = {
  ownershipMatches
};

function mergeOwnershipFallback<T extends OwnershipScope>(event: T, fallback: OwnershipScope): T {
  return {
    ...fallback,
    ...event
  };
}

function runtimeMatchesRegistrySelector(runtime: AgentRuntimeDescriptor, selector: AgentRuntimeRegistrySelector) {
  if (typeof selector === "function") return selector(runtime);
  if (typeof selector === "string") {
    return [
      runtime.id,
      runtime.runtimeKey,
      runtime.sessionKey,
      runtime.runtimeId,
      runtime.sessionId
    ].filter(Boolean).some((value) => String(value) === selector);
  }
  if (selector.id && String(runtime.id) !== String(selector.id)) return false;
  if (selector.runtimeKey && runtime.runtimeKey !== selector.runtimeKey) return false;
  if (selector.sessionKey && runtime.sessionKey !== selector.sessionKey) return false;
  if (selector.toolId && runtime.toolId !== selector.toolId) return false;
  return OWNERSHIP_FIELDS.every((field) => {
    const expectedValue = selector[field];
    return !expectedValue || runtime[field] === expectedValue;
  });
}

export function createAgentRuntimeOwnership(input: {
  surfaceKind: OpenSurfaceKind;
  surfaceLocalId: string;
  sessionId: string;
  agentId?: string;
  sourceLocalId?: string;
  conversationId?: string;
  projectId?: string;
}) {
  return createRuntimeOwnershipScope(input);
}

export async function listAgentRuntimes() {
  return listAgentRuntimeDescriptors();
}

export async function findAgentRuntime(selector: AgentRuntimeRegistrySelector) {
  const runtimes = await listAgentRuntimes();
  return runtimes.find((runtime) => runtimeMatchesRegistrySelector(runtime, selector)) || null;
}

export async function reattachAgentRuntime(
  selector: AgentRuntimeRegistrySelector,
  options: AgentRuntimeReattachOptions = {}
): Promise<AgentRuntimeReattachResult> {
  const descriptor = await findAgentRuntime(selector);
  if (!descriptor) return { ok: false, reason: "missing" };
  if (descriptor.status !== "running") return { ok: false, reason: "not-running", descriptor };
  if (options.sourceAdapter !== true) {
    return { ok: true, descriptor, sourceAdapterActive: false };
  }
  const adapter = await setTerminalSourceAdapter(descriptor.runtimeKey, true);
  return {
    ok: true,
    descriptor,
    sourceAdapterActive: adapter.active
  };
}

export async function startAgentRuntime(payload: AgentRuntimeStartPayload) {
  const ownership = normalizeOwnershipScope(payload.ownership);
  return startTerminalSession({
    ...payload,
    runtimeId: ownership.runtimeId,
    surfaceId: ownership.surfaceId,
    conversationId: ownership.conversationId,
    agentId: ownership.agentId,
    sourceId: ownership.sourceId,
    projectId: ownership.projectId,
    ownership
  });
}

export function writeAgentRuntime(sessionId: string, data: string) {
  writeTerminalSession(sessionId, data);
}

export function resizeAgentRuntime(sessionId: string, cols: number, rows: number) {
  resizeTerminalSession(sessionId, cols, rows);
}

export function stopAgentRuntime(sessionId: string) {
  killTerminalSession(sessionId);
}

export function detachAgentRuntime(sessionId: string) {
  return setTerminalSourceAdapter(sessionId, false);
}

export function setAgentRuntimeSourceAdapter(sessionId: string, enabled: boolean) {
  return setTerminalSourceAdapter(sessionId, enabled);
}

export function attachAgentRuntimeData(
  sessionId: SessionSelector,
  callback: (event: TerminalDataEvent) => void,
  ownership?: OwnershipSelector
) {
  return onTerminalData((event) => {
    if (event.id !== selectedSessionId(sessionId)) return;
    const normalized = selectedOwnership(ownership);
    if (!ownershipMatches(event, normalized)) return;
    const scopedEvent = mergeOwnershipFallback(event, normalized);
    callback({
      ...scopedEvent,
      sourceEvents: (event.sourceEvents || [])
        .filter((sourceEvent) => ownershipMatches(sourceEvent, normalized))
        .map((sourceEvent) => mergeOwnershipFallback(sourceEvent, normalized))
    });
  });
}

export function attachAgentRuntimeExit(
  sessionId: SessionSelector,
  callback: (event: TerminalExitEvent) => void,
  ownership?: OwnershipSelector
) {
  return onTerminalExit((event) => {
    if (event.id !== selectedSessionId(sessionId)) return;
    const normalized = selectedOwnership(ownership);
    if (!ownershipMatches(event, normalized)) return;
    callback(mergeOwnershipFallback(event, normalized));
  });
}

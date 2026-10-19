import { createOwnershipId, normalizeOwnershipScope, type AgentRuntimeDescriptor, type OwnershipScope } from "./identity";

export type WorkbenchApi = {
  getConfig: () => Promise<unknown>;
  getStorageInfo: () => Promise<unknown>;
  readStorage: (key: string) => Promise<unknown>;
  writeStorage: (key: string, value: unknown) => Promise<unknown>;
  deleteStorage: (key: string) => Promise<unknown>;
  pickObsidianVault: () => Promise<unknown>;
  listObsidianFiles: (vaultPath: string) => Promise<unknown>;
  readObsidianFile: (filePath: string) => Promise<unknown>;
  openExternal: (url: string) => Promise<unknown>;
  openPath: (targetPath: string) => Promise<unknown>;
  writeClipboardText: (text: string) => Promise<unknown>;
  readClipboardText: () => Promise<string>;
  getAgentInterfaceInfo: (payload?: unknown) => Promise<unknown>;
  createWorkshopProject: (payload: unknown) => Promise<unknown>;
  markWorkshopProjectReady: (payload: unknown) => Promise<unknown>;
  exportMeowPackage: (payload: unknown) => Promise<unknown>;
  importMeowPackage: (payload: unknown) => Promise<unknown>;
  mirrorConversation: (payload: unknown) => Promise<unknown>;
  deleteConversationMirror: (payload: unknown) => Promise<unknown>;
  onConversationsChanged: (callback: (payload: unknown) => void) => () => void;
  getAgentPresets: () => Promise<unknown>;
  testToolCommand: (payload: unknown) => Promise<unknown>;
  addUserTool: (payload: unknown) => Promise<unknown>;
  deleteUserTool: (toolId: string) => Promise<unknown>;
  listPets: () => Promise<unknown>;
  installPet: (slug: string) => Promise<unknown>;
  deletePet: (slug: string) => Promise<unknown>;
  listAgentRuntimes: () => Promise<unknown>;
  startTerminal: (payload: unknown) => Promise<unknown>;
  setTerminalSourceAdapter: (payload: unknown) => Promise<unknown>;
  writeTerminal: (id: string, data: string) => void;
  resizeTerminal: (id: string, cols: number, rows: number) => void;
  killTerminal: (id: string) => void;
  onTerminalData: (callback: (payload: unknown) => void) => () => void;
  onTerminalExit: (callback: (payload: unknown) => void) => () => void;
};

export type HomeBackedStorageOptions<T> = {
  storageKey: string;
  homeKey: string;
  fieldKey?: string;
  fallback: T;
  validate?: (value: unknown) => T;
};

export type WorkshopProjectReadyPayload = {
  id?: string;
  projectId?: string;
  folderName?: string;
};

export type WorkshopProjectType = "feature-page" | "sidebar-widget";

export type WorkshopProjectSnapshot = {
  id: string;
  name: string;
  type: string;
  target?: string;
  version?: string;
  entry?: string;
  runtime?: string;
  status?: string;
  path?: string;
  manifestPath?: string;
  entryPath?: string;
  versionsDir?: string;
};

export type WorkshopProjectCreatePayload = {
  name: string;
  type: WorkshopProjectType;
  id?: string;
  folderName?: string;
};

export type WorkshopProjectCreateResult = {
  ok: true;
  project: WorkshopProjectSnapshot;
  createdAt?: string;
};

export type WorkshopProjectReadyResult = {
  ok: true;
  id: string;
  name?: string;
  version?: string;
  path?: string;
  manifestPath?: string;
  entryPath?: string;
};

export type WorkshopMeowPackageInfo = {
  id?: string;
  name?: string;
  type?: string;
  target?: string;
  version?: string;
  runtime?: string;
  entry?: string;
  summary?: string;
  changelog?: string;
  sourcePath?: string;
  installMode?: string;
};

export type WorkshopPublishDraftPayload = {
  title?: string;
  summary?: string;
  changelog?: string;
  version?: string;
};

export type WorkshopExportMeowPackagePayload = {
  id?: string;
  projectId?: string;
  folderName?: string;
  publish?: WorkshopPublishDraftPayload;
  publishDraft?: WorkshopPublishDraftPayload;
};

export type WorkshopExportMeowPackageResult = {
  ok: true;
  packagePath: string;
  package?: WorkshopMeowPackageInfo;
  packagedAt?: string;
  exportedAt?: string;
  status?: string;
  manifestPath?: string;
  path?: string;
};

export type WorkshopImportMeowPackagePayload = {
  packagePath?: string;
  path?: string;
  targetPath?: string;
  destinationPath?: string;
  dryRun?: boolean;
  testInstall?: boolean;
};

export type WorkshopImportMeowPackageResult =
  | { ok: false; canceled: true }
  | {
      ok: true;
      dryRun?: boolean;
      testInstall?: boolean;
      packagePath: string;
      package?: WorkshopMeowPackageInfo;
      project: WorkshopProjectSnapshot;
      existingProject?: WorkshopProjectSnapshot;
      installMode?: string;
      installedAt?: string;
      status?: string;
    };

export type TerminalSessionDescriptor = {
  id: string;
  name: string;
  toolKind: string;
  command: string;
  args: string[];
  cwd: string;
  owner: "legacy";
  status: "available" | "incomplete";
  mount: "contract-only";
};

export type TerminalStartPayload = OwnershipScope & {
  sessionId: string;
  toolId: string;
  ownership?: OwnershipScope;
  cols?: number;
  rows?: number;
  toolOverride?: {
    name?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    replaceExisting?: boolean;
  };
  workshop?: {
    enabled: boolean;
    type?: string;
    label?: string;
    target?: string;
    projectId?: string;
    projectName?: string;
    projectPath?: string;
    manifestPath?: string;
    entryPath?: string;
    entry?: string;
    status?: string;
    version?: string;
    runtime?: string;
  };
  sourceAdapter?: boolean;
};

export type TerminalStartResult = {
  ok: true;
};

export type TerminalSourceEvent = OwnershipScope & {
  kind:
    | "terminal_display"
    | "terminal_raw"
    | "terminal_status"
    | "status"
    | "user_submit"
    | "user_message"
    | "assistant_message"
    | "markdown_document"
    | "thinking"
    | "startup"
    | "tool_call"
    | "tool_result";
  text?: string;
  summary?: string;
  tone?: "read" | "write" | "edit" | "run" | "info";
  label?: string;
  detail?: string;
  status?: string;
  source?: "terminal" | "renderer" | "adapter";
  createdAt?: number;
};

export type TerminalDataEvent = OwnershipScope & {
  id: string;
  toolId?: string;
  data: string;
  sourceEvents?: TerminalSourceEvent[];
};

export type TerminalExitEvent = OwnershipScope & {
  id: string;
  toolId?: string;
  exitCode: number;
};

export type SidebarWidgetRuntimeDescriptor = {
  id: string;
  name: string;
  version?: string;
  status: string;
  runtime: string;
  target: string;
  entry?: string;
  entryPath?: string;
  manifestPath?: string;
  path?: string;
  minHeight?: number;
  preferredHeight?: number;
  resizeMode?: string;
  owner: "legacy";
  protection: "iframe-protected";
  readiness: "loadable" | "draft" | "missing-entry" | "invalid";
};

export type SidebarIframeHostDescriptor = {
  id: string;
  name: string;
  runtime: string;
  target: string;
  entry?: string;
  entryPath?: string;
  manifestPath?: string;
  owner: "legacy";
  previewOwner: "next-contract";
  mountBoundary: "contract-only";
  lifecycle: "not-mounted";
  sandbox: "allow-scripts";
  themeInit: "pending";
  resize: "contract-pending";
  messageBridge: "disabled";
  persistence: "disabled";
  readiness: SidebarWidgetRuntimeDescriptor["readiness"];
  risk: "protected-runtime";
};

export type PetPackageDescriptor = {
  id: string;
  slug?: string;
  displayName: string;
  description?: string;
  directory?: string;
  spritesheetPath: string;
  spritesheetUrl: string;
  columns: number;
  rows: number;
};

export type PetPackageListResult = {
  directory?: string;
  pets: PetPackageDescriptor[];
};

export type PetScaleMap = Record<string, number>;
export type PetDirectionFixMap = Record<string, 1 | -1>;

export type TaskCenterTaskStatus = "inbox" | "todo" | "doing" | "blocked" | "done";

export type TaskCenterTask = {
  id: string;
  title: string;
  status: TaskCenterTaskStatus;
  detail?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  source?: string;
  origin?: string;
  priority?: string;
  tag?: string;
  tags?: string[];
  archived?: boolean;
  completedAt?: string | number;
  createdAt?: string | number;
  updatedAt?: string | number;
  externalId?: string;
  raw?: Record<string, unknown>;
};

export type ProfileSettings = {
  displayName: string;
  id?: string | number;
  developerId?: string;
  email?: string;
  title?: string;
  bio?: string;
  level?: number;
  avatarDataUrl?: string;
  gender?: string;
  emailPublic?: boolean;
  signedIn?: boolean;
  ownedTitleIds?: string[];
  wornTitleIds?: string[];
  raw?: Record<string, unknown>;
};

export type ConversationDeletePayload = {
  conversationId?: string;
  path?: string;
};

export type ConversationDeleteResult =
  | { ok: true; deleted: true; path?: string }
  | { ok: false; error?: string };

export type ObsidianVaultFile = {
  name: string;
  title: string;
  path: string;
  relativePath: string;
  folder: string;
  size: number;
  modifiedAt: number;
  tags: string[];
  links: string[];
  excerpt?: string;
};

export type ObsidianVaultTag = {
  tag: string;
  count: number;
};

export type ObsidianVaultScanResult = {
  path: string;
  name: string;
  files: ObsidianVaultFile[];
  tags: ObsidianVaultTag[];
  raw?: Record<string, unknown>;
};

export type ObsidianNotePayload = {
  path: string;
  raw: string;
  truncated: boolean;
  size: number;
  modifiedAt: number;
};

declare global {
  interface Window {
    workbench?: WorkbenchApi;
  }
}

export function workbenchApi() {
  if (!window.workbench) {
    throw new Error("window.workbench is unavailable. Check preload wiring.");
  }
  return window.workbench;
}

export function optionalWorkbenchApi() {
  return window.workbench || null;
}

export function hasWorkbenchApi() {
  return Boolean(window.workbench);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  throw new Error("workbench API returned a non-object response.");
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalProfileImageDataUrl(value: unknown) {
  const text = optionalString(value);
  return text?.startsWith("data:image/") ? text : undefined;
}

function optionalStringOrNumber(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function requiredString(value: unknown, message: string) {
  const text = optionalString(value);
  if (!text) throw new Error(message);
  return text;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function storageValue(value: unknown) {
  const record = recordValue(value);
  if (!record) return value;
  if ("value" in record) return record.value;
  return value;
}

const homeBackedStorageWriteQueues = new Map<string, Promise<unknown>>();

function cloneStorageFallback<T>(fallback: T): T {
  if (Array.isArray(fallback)) return [...fallback] as T;
  if (fallback && typeof fallback === "object") return { ...(fallback as Record<string, unknown>) } as T;
  return fallback;
}

function normalizeHomeBackedValue<T>(
  value: unknown,
  fallback: T,
  validate?: (value: unknown) => T
) {
  if (validate) return validate(value);
  return (value === null || value === undefined ? cloneStorageFallback(fallback) : value) as T;
}

function readLocalStorageJson<T>(
  storageKey: string,
  fallback: T,
  validate?: (value: unknown) => T
) {
  if (typeof window === "undefined") return cloneStorageFallback(fallback);
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return cloneStorageFallback(fallback);
    try {
      return normalizeHomeBackedValue(JSON.parse(raw), fallback, validate);
    } catch {
      return normalizeHomeBackedValue(raw, fallback, validate);
    }
  } catch {
    return cloneStorageFallback(fallback);
  }
}

function writeLocalStorageJson(storageKey: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // localStorage is only the renderer cache; Home remains the durable target.
  }
}

export function readHomeBackedStorageCache<T>(options: HomeBackedStorageOptions<T>) {
  return readLocalStorageJson(options.storageKey, options.fallback, options.validate);
}

export function writeHomeBackedStorageCache<T>(options: HomeBackedStorageOptions<T>, value: T) {
  writeLocalStorageJson(options.storageKey, value);
  void writeHomeBackedStorage(options, value);
}

export async function readHomeBackedStorage<T>(options: HomeBackedStorageOptions<T>) {
  const api = optionalWorkbenchApi();
  if (!api?.readStorage) return readHomeBackedStorageCache(options);
  try {
    const result = await api.readStorage(options.homeKey);
    const record = recordValue(result);
    if (record?.exists === false) {
      const cached = readHomeBackedStorageCache(options);
      await writeHomeBackedStorage(options, cached);
      return cached;
    }
    const homeValue = storageValue(result);
    const homeRecord = options.fieldKey ? recordValue(homeValue) : null;
    const rawValue = options.fieldKey ? homeRecord?.[options.fieldKey] : homeValue;
    if (rawValue === null || rawValue === undefined) {
      const cached = readHomeBackedStorageCache(options);
      await writeHomeBackedStorage(options, cached);
      return cached;
    }
    const value = normalizeHomeBackedValue(rawValue, options.fallback, options.validate);
    writeLocalStorageJson(options.storageKey, value);
    return value;
  } catch {
    return readHomeBackedStorageCache(options);
  }
}

export async function writeHomeBackedStorage<T>(options: HomeBackedStorageOptions<T>, value: T) {
  const api = optionalWorkbenchApi();
  if (!api?.writeStorage) return value;
  const write = async () => {
    if (!options.fieldKey) {
      await api.writeStorage(options.homeKey, value);
      return value;
    }
    let existing: Record<string, unknown> = {};
    try {
      const result = await api.readStorage(options.homeKey);
      existing = recordValue(storageValue(result)) || {};
    } catch {
      existing = {};
    }
    await api.writeStorage(options.homeKey, {
      ...existing,
      [options.fieldKey]: value
    });
    return value;
  };
  const previous = homeBackedStorageWriteQueues.get(options.homeKey) || Promise.resolve();
  const queued = previous.then(write, write);
  homeBackedStorageWriteQueues.set(options.homeKey, queued.catch(() => undefined));
  try {
    await queued;
  } catch {
    // The local cache was already updated; next successful write will repair Home.
  } finally {
    if (homeBackedStorageWriteQueues.get(options.homeKey) === queued) {
      homeBackedStorageWriteQueues.delete(options.homeKey);
    }
  }
  return value;
}

export function hydrateHomeBackedStorage<T>(
  options: HomeBackedStorageOptions<T>,
  onValue: (value: T) => void
) {
  if (typeof window === "undefined") return () => {};
  let disposed = false;
  readHomeBackedStorage(options)
    .then((value) => {
      if (!disposed) onValue(value);
    })
    .catch(() => undefined);
  return () => {
    disposed = true;
  };
}

function taskStatus(value: unknown): TaskCenterTaskStatus {
  const status = (optionalString(value) || "").toLowerCase();
  if (["done", "completed", "complete", "archived"].includes(status)) return "done";
  if (["blocked", "failed"].includes(status)) return "blocked";
  if (["doing", "active", "in-progress", "progress"].includes(status)) return "doing";
  if (["todo", "planned"].includes(status)) return "todo";
  return "inbox";
}

function taskPriority(value: unknown) {
  const priority = (optionalString(value) || "").toLowerCase();
  if (["high", "urgent", "p0", "p1"].includes(priority)) return "high";
  if (["low", "p3", "p4"].includes(priority)) return "low";
  return "medium";
}

function isTerminalLikeTool(record: Record<string, unknown>) {
  const kindText = [
    optionalString(record.toolKind),
    optionalString(record.kind),
    optionalString(record.type)
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(terminal|powershell|shell|pwsh|cmd)\b/.test(kindText)) return true;

  const identityText = [
    optionalString(record.id),
    optionalString(record.name)
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(terminal|powershell|shell|pwsh|cmd)\b/.test(identityText)) return true;

  const command = (optionalString(record.command) || "").toLowerCase();
  const kindAllowsCommandHeuristic = !kindText || kindText === "other";
  return kindAllowsCommandHeuristic && /\b(bash|zsh|fish|sh|powershell(?:\.exe)?|pwsh(?:\.exe)?|cmd(?:\.exe)?)\b/.test(command);
}

function optionalPackageInfo(value: unknown): WorkshopMeowPackageInfo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return {
    id: optionalString(record.id),
    name: optionalString(record.name),
    type: optionalString(record.type),
    target: optionalString(record.target),
    version: optionalString(record.version),
    runtime: optionalString(record.runtime),
    entry: optionalString(record.entry),
    summary: optionalString(record.summary),
    changelog: optionalString(record.changelog),
    sourcePath: optionalString(record.sourcePath),
    installMode: optionalString(record.installMode)
  };
}

function normalizeWorkshopProjectSnapshot(value: unknown): WorkshopProjectSnapshot {
  const record = asRecord(value);
  return {
    id: requiredString(record.id, "workshop project response is missing id."),
    name: requiredString(record.name, "workshop project response is missing name."),
    type: requiredString(record.type, "workshop project response is missing type."),
    target: optionalString(record.target),
    version: optionalString(record.version),
    entry: optionalString(record.entry),
    runtime: optionalString(record.runtime),
    status: optionalString(record.status),
    path: optionalString(record.path),
    manifestPath: optionalString(record.manifestPath),
    entryPath: optionalString(record.entryPath),
    versionsDir: optionalString(record.versionsDir)
  };
}

export function normalizeWorkshopProjectCreateResult(value: unknown): WorkshopProjectCreateResult {
  const record = asRecord(value);
  if (record.ok !== true) {
    throw new Error("workshop project was not created.");
  }
  return {
    ok: true,
    project: normalizeWorkshopProjectSnapshot(record.project),
    createdAt: optionalString(record.createdAt)
  };
}

export function normalizeWorkshopProjectReadyResult(value: unknown): WorkshopProjectReadyResult {
  const record = asRecord(value);
  if (record.ok !== true) {
    throw new Error("workshop project was not marked ready.");
  }
  const id = optionalString(record.id);
  if (!id) {
    throw new Error("workshop ready response is missing id.");
  }
  return {
    ok: true,
    id,
    name: optionalString(record.name),
    version: optionalString(record.version),
    path: optionalString(record.path),
    manifestPath: optionalString(record.manifestPath),
    entryPath: optionalString(record.entryPath)
  };
}

export function normalizeWorkshopExportMeowPackageResult(value: unknown): WorkshopExportMeowPackageResult {
  const record = asRecord(value);
  if (record.ok !== true) {
    throw new Error("workshop .meow package was not exported.");
  }
  return {
    ok: true,
    packagePath: requiredString(record.packagePath, "workshop export response is missing packagePath."),
    package: optionalPackageInfo(record.package),
    packagedAt: optionalString(record.packagedAt),
    exportedAt: optionalString(record.exportedAt),
    status: optionalString(record.status),
    manifestPath: optionalString(record.manifestPath),
    path: optionalString(record.path)
  };
}

export function normalizeWorkshopImportMeowPackageResult(value: unknown): WorkshopImportMeowPackageResult {
  const record = asRecord(value);
  if (record.ok === false && record.canceled === true) {
    return { ok: false, canceled: true };
  }
  if (record.ok !== true) {
    throw new Error("workshop .meow package was not imported.");
  }
  return {
    ok: true,
    dryRun: record.dryRun === true,
    testInstall: record.testInstall === true,
    packagePath: requiredString(record.packagePath, "workshop import response is missing packagePath."),
    package: optionalPackageInfo(record.package),
    project: normalizeWorkshopProjectSnapshot(record.project),
    existingProject: record.existingProject ? normalizeWorkshopProjectSnapshot(record.existingProject) : undefined,
    installMode: optionalString(record.installMode),
    installedAt: optionalString(record.installedAt),
    status: optionalString(record.status)
  };
}

export function normalizeTerminalSessionDescriptor(value: unknown, index = 0): TerminalSessionDescriptor | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!isTerminalLikeTool(record)) return null;
  const id = optionalString(record.id) || optionalString(record.name) || `terminal-${index + 1}`;
  const command = optionalString(record.command) || "";
  return {
    id,
    name: optionalString(record.name) || id,
    toolKind: optionalString(record.toolKind) || optionalString(record.kind) || "terminal",
    command,
    args: optionalStringArray(record.args),
    cwd: optionalString(record.cwd) || ".",
    owner: "legacy",
    status: command ? "available" : "incomplete",
    mount: "contract-only"
  };
}

function normalizeTerminalStartResult(value: unknown): TerminalStartResult {
  if (value === true) return { ok: true };
  const record = asRecord(value);
  if (record.ok === true) return { ok: true };
  throw new Error("terminal session did not start.");
}

function normalizeAgentRuntimeStatus(value: unknown): AgentRuntimeDescriptor["status"] {
  const status = optionalString(value);
  return status === "idle"
    || status === "starting"
    || status === "running"
    || status === "stopping"
    || status === "exited"
    || status === "error"
    ? status
    : "exited";
}

function normalizeAgentRuntimeAttachStatus(
  value: unknown,
  status: AgentRuntimeDescriptor["status"]
): AgentRuntimeDescriptor["attachStatus"] {
  const attachStatus = optionalString(value);
  if (attachStatus === "attached" || attachStatus === "detached" || attachStatus === "reattachable" || attachStatus === "unavailable") {
    return attachStatus;
  }
  return status === "running" ? "reattachable" : "unavailable";
}

function normalizeAgentRuntimeDescriptor(value: unknown, index = 0): AgentRuntimeDescriptor | null {
  const record = recordValue(value);
  if (!record) return null;
  const runtimeKey = optionalString(record.runtimeKey)
    || optionalString(record.sessionKey)
    || optionalString(record.id)
    || optionalString(record.sessionId)
    || `runtime-${index + 1}`;
  const ownership = normalizeOwnershipScope(normalizeApiOwnershipScope(record, {
    runtimeId: optionalString(record.runtimeId) || createOwnershipId("runtime", runtimeKey),
    sessionId: optionalString(record.sessionId) || createOwnershipId("session", runtimeKey)
  }));
  const status = normalizeAgentRuntimeStatus(record.status);
  return {
    ...ownership,
    id: optionalString(record.id) || ownership.runtimeId || createOwnershipId("runtime", runtimeKey),
    runtimeKey,
    sessionKey: optionalString(record.sessionKey) || runtimeKey,
    toolId: optionalString(record.toolId),
    owner: "agent-runtime-manager",
    status,
    attachStatus: normalizeAgentRuntimeAttachStatus(record.attachStatus, status),
    cwd: optionalString(record.cwd),
    startedAt: optionalNumber(record.startedAt)
  };
}

function normalizeApiOwnershipScope(record: Record<string, unknown> | null | undefined, fallback: OwnershipScope = {}): OwnershipScope {
  return {
    runtimeId: optionalString(record?.runtimeId) || fallback.runtimeId,
    sessionId: optionalString(record?.sessionId) || fallback.sessionId,
    surfaceId: optionalString(record?.surfaceId) || fallback.surfaceId,
    conversationId: optionalString(record?.conversationId) || fallback.conversationId,
    agentId: optionalString(record?.agentId) || fallback.agentId,
    sourceId: optionalString(record?.sourceId) || fallback.sourceId,
    projectId: optionalString(record?.projectId) || fallback.projectId
  };
}

function normalizeTerminalDataEvent(value: unknown): TerminalDataEvent | null {
  const record = recordValue(value);
  if (!record) return null;
  const id = optionalString(record.id);
  if (!id) return null;
  const ownership = normalizeApiOwnershipScope(record);
  const sourceEvents = Array.isArray(record.sourceEvents)
    ? record.sourceEvents
      .map((item): TerminalSourceEvent | null => {
        const event = recordValue(item);
        if (!event) return null;
        const kind = optionalString(event.kind);
        if (!kind || ![
          "terminal_display",
          "terminal_raw",
          "terminal_status",
          "status",
          "user_submit",
          "user_message",
          "assistant_message",
          "markdown_document",
          "thinking",
          "startup",
          "tool_call",
          "tool_result"
        ].includes(kind)) return null;
        const source = optionalString(event.source);
        const tone = optionalString(event.tone);
        return {
          kind: kind as TerminalSourceEvent["kind"],
          text: optionalString(event.text),
          summary: optionalString(event.summary),
          tone: tone === "read" || tone === "write" || tone === "edit" || tone === "run" || tone === "info" ? tone : undefined,
          label: optionalString(event.label),
          detail: optionalString(event.detail),
          status: optionalString(event.status),
          source: source === "terminal" || source === "renderer" || source === "adapter" ? source : undefined,
          createdAt: typeof event.createdAt === "number" && Number.isFinite(event.createdAt)
            ? event.createdAt
            : undefined,
          ...normalizeApiOwnershipScope(event, ownership)
        };
      })
      .filter((item): item is TerminalSourceEvent => Boolean(item))
    : undefined;
  return {
    id,
    toolId: optionalString(record.toolId),
    data: typeof record.data === "string" ? record.data : String(record.data ?? ""),
    sourceEvents,
    ...ownership
  };
}

function normalizeTerminalExitEvent(value: unknown): TerminalExitEvent | null {
  const record = recordValue(value);
  if (!record) return null;
  const id = optionalString(record.id);
  if (!id) return null;
  const exitCode = typeof record.exitCode === "number" && Number.isFinite(record.exitCode)
    ? record.exitCode
    : Number(record.exitCode || 0);
  return {
    id,
    toolId: optionalString(record.toolId),
    exitCode: Number.isFinite(exitCode) ? Math.round(exitCode) : 0,
    ...normalizeApiOwnershipScope(record)
  };
}

function normalizePetPackageDescriptor(value: unknown, index = 0): PetPackageDescriptor | null {
  const record = recordValue(value);
  if (!record) return null;
  const id = optionalString(record.id) || optionalString(record.slug) || `pet-${index + 1}`;
  const spritesheetUrl = optionalString(record.spritesheetUrl);
  const spritesheetPath = optionalString(record.spritesheetPath);
  if (!spritesheetUrl || !spritesheetPath) return null;
  return {
    id,
    slug: optionalString(record.slug),
    displayName: optionalString(record.displayName) || optionalString(record.name) || id,
    description: optionalString(record.description),
    directory: optionalString(record.directory),
    spritesheetPath,
    spritesheetUrl,
    columns: Math.max(1, Math.round(optionalNumber(record.columns) || 8)),
    rows: Math.max(1, Math.round(optionalNumber(record.rows) || 9))
  };
}

export function normalizePetPackageListResult(value: unknown): PetPackageListResult {
  const record = recordValue(value) || {};
  const pets = (Array.isArray(record.pets) ? record.pets : [])
    .map(normalizePetPackageDescriptor)
    .filter((item): item is PetPackageDescriptor => Boolean(item));
  return {
    directory: optionalString(record.directory),
    pets
  };
}

function normalizePetScaleMap(value: unknown): PetScaleMap {
  const record = recordValue(value) || {};
  return Object.fromEntries(Object.entries(record)
    .map(([key, raw]) => {
      const scale = Number(raw);
      return [key, Number.isFinite(scale) ? Math.max(0.6, Math.min(2.2, scale)) : 1];
    })
    .filter(([key]) => Boolean(key))) as PetScaleMap;
}

function normalizePetDirectionFixMap(value: unknown): PetDirectionFixMap {
  const record = recordValue(value) || {};
  return Object.fromEntries(Object.entries(record)
    .map(([key, raw]) => [key, Number(raw) < 0 ? -1 : 1])
    .filter(([key]) => Boolean(key))) as PetDirectionFixMap;
}

export function normalizeSidebarWidgetRuntimeDescriptor(value: unknown, index = 0): SidebarWidgetRuntimeDescriptor | null {
  const record = recordValue(value);
  if (!record) return null;
  const type = optionalString(record.type);
  const target = optionalString(record.target);
  if (type !== "sidebar-widget" && target !== "workspace-sidebar") return null;
  const id = optionalString(record.id) || optionalString(record.folderName) || `sidebar-widget-${index + 1}`;
  const status = optionalString(record.status) || (optionalString(record.error) ? "error" : "draft");
  const entry = optionalString(record.entry);
  const entryPath = optionalString(record.entryPath);
  const sidebarWidget = recordValue(record.sidebarWidget);
  const error = optionalString(record.error);
  let readiness: SidebarWidgetRuntimeDescriptor["readiness"] = "draft";
  if (error || status === "error") {
    readiness = "invalid";
  } else if (!entry || !entryPath) {
    readiness = "missing-entry";
  } else if (["ready", "enabled", "published"].includes(status)) {
    readiness = "loadable";
  }
  return {
    id,
    name: optionalString(record.name) || id,
    version: optionalString(record.version),
    status,
    runtime: optionalString(record.runtime) || "html",
    target: target || "workspace-sidebar",
    entry,
    entryPath,
    manifestPath: optionalString(record.manifestPath),
    path: optionalString(record.path) || optionalString(record.projectPath),
    minHeight: optionalNumber(sidebarWidget?.minHeight),
    preferredHeight: optionalNumber(sidebarWidget?.preferredHeight),
    resizeMode: optionalString(sidebarWidget?.resizeMode),
    owner: "legacy",
    protection: "iframe-protected",
    readiness
  };
}

export function normalizeSidebarIframeHostDescriptor(value: unknown, index = 0): SidebarIframeHostDescriptor | null {
  const runtime = normalizeSidebarWidgetRuntimeDescriptor(value, index);
  if (!runtime) return null;
  return {
    id: runtime.id,
    name: runtime.name,
    runtime: runtime.runtime,
    target: runtime.target,
    entry: runtime.entry,
    entryPath: runtime.entryPath,
    manifestPath: runtime.manifestPath,
    owner: runtime.owner,
    previewOwner: "next-contract",
    mountBoundary: "contract-only",
    lifecycle: "not-mounted",
    sandbox: "allow-scripts",
    themeInit: "pending",
    resize: "contract-pending",
    messageBridge: "disabled",
    persistence: "disabled",
    readiness: runtime.readiness,
    risk: "protected-runtime"
  };
}

function normalizeTaskCenterTask(value: unknown, index = 0): TaskCenterTask {
  const record = recordValue(value) || {};
  const id = optionalString(record.id) || optionalString(record.externalId) || `task-${index + 1}`;
  const status = taskStatus(record.status || record.state);
  return {
    id,
    title: optionalString(record.title) || optionalString(record.name) || "未命名任务",
    status,
    detail: optionalString(record.detail) || optionalString(record.description),
    scheduledDate: optionalString(record.scheduledDate) || optionalString(record.calendarDate) || optionalString(record.planDate) || optionalString(record.due),
    scheduledTime: optionalString(record.scheduledTime) || optionalString(record.time),
    source: optionalString(record.source),
    origin: optionalString(record.origin),
    priority: taskPriority(record.priority),
    tag: optionalString(record.tag),
    tags: optionalStringArray(record.tags),
    archived: typeof record.archived === "boolean" ? record.archived : status === "done",
    completedAt: optionalStringOrNumber(record.completedAt),
    createdAt: optionalStringOrNumber(record.createdAt),
    updatedAt: optionalStringOrNumber(record.updatedAt),
    externalId: optionalString(record.externalId),
    raw: record
  };
}

function taskCenterTaskStorageValue(task: TaskCenterTask) {
  const updatedAt = task.updatedAt || Date.now();
  const completedAt = task.status === "done" ? (task.completedAt || Date.now()) : 0;
  return {
    ...(task.raw || {}),
    id: task.id,
    title: task.title,
    status: task.status,
    detail: task.detail || "",
    scheduledDate: task.scheduledDate || "",
    scheduledTime: task.scheduledTime || "",
    priority: task.priority || "medium",
    source: task.source || "我",
    origin: task.origin || "user",
    tag: task.tag || "personal",
    tags: task.tags?.length ? task.tags : [task.tag || "personal"],
    archived: task.archived ?? task.status === "done",
    completedAt,
    createdAt: task.createdAt || Date.now(),
    updatedAt,
    externalId: task.externalId || ""
  };
}

function taskCenterTaskArray(value: unknown) {
  if (Array.isArray(value)) return value;
  const record = recordValue(value);
  return Array.isArray(record?.tasks) ? record.tasks : [];
}

function normalizeProfileSettings(value: unknown): ProfileSettings {
  const record = recordValue(value) || {};
  const id = optionalStringOrNumber(record.id);
  const level = optionalNumber(record.level);
  const ownedTitleIds = optionalStringArray(record.ownedTitleIds);
  const wornTitleIds = optionalStringArray(record.wornTitleIds);
  return {
    displayName: optionalString(record.displayName) || optionalString(record.name) || optionalString(record.username) || "本地开发者",
    id,
    developerId: optionalString(record.developerId) || (id === undefined ? undefined : String(id)),
    email: optionalString(record.email),
    title: optionalString(record.title) || optionalString(record.equippedTitle),
    bio: optionalString(record.bio) || optionalString(record.summary),
    level,
    avatarDataUrl: optionalProfileImageDataUrl(record.avatarDataUrl),
    gender: optionalString(record.gender),
    emailPublic: typeof record.emailPublic === "boolean" ? record.emailPublic : undefined,
    signedIn: typeof record.signedIn === "boolean" ? record.signedIn : undefined,
    ownedTitleIds: ownedTitleIds.length ? ownedTitleIds : ["developer", "round-table-1"],
    wornTitleIds: wornTitleIds.length ? wornTitleIds : ["developer"],
    raw: record
  };
}

function profileSettingsStorageValue(profile: ProfileSettings) {
  const developerNumericId = Number(profile.developerId);
  const id = profile.id ?? (Number.isFinite(developerNumericId) && developerNumericId > 0 ? Math.round(developerNumericId) : undefined);
  const lockedDeveloperId = id === undefined ? (Number.isFinite(developerNumericId) && developerNumericId > 0 ? String(Math.round(developerNumericId)) : "1") : String(id);
  return {
    ...(profile.raw || {}),
    id,
    developerId: lockedDeveloperId,
    email: profile.email || "",
    displayName: profile.displayName,
    title: profile.title || "",
    bio: profile.bio || "",
    level: profile.level,
    avatarDataUrl: profile.avatarDataUrl || "",
    gender: profile.gender || "hidden",
    emailPublic: Boolean(profile.emailPublic),
    signedIn: Boolean(profile.signedIn),
    ownedTitleIds: profile.ownedTitleIds?.length ? profile.ownedTitleIds : ["developer", "round-table-1"],
    wornTitleIds: profile.wornTitleIds?.length ? profile.wornTitleIds : ["developer"],
    updatedAt: Date.now()
  };
}

function normalizeConversationDeleteResult(value: unknown): ConversationDeleteResult {
  const record = recordValue(value);
  if (record?.ok === true) {
    return {
      ok: true,
      deleted: true,
      path: optionalString(record.path)
    };
  }
  return {
    ok: false,
    error: optionalString(record?.error) || "conversation delete failed"
  };
}

function normalizeObsidianFile(value: Record<string, unknown>, index: number): ObsidianVaultFile | null {
  const path = optionalString(value.path);
  if (!path) return null;
  const name = optionalString(value.name) || optionalString(value.title) || `note-${index + 1}.md`;
  return {
    name,
    title: optionalString(value.title) || name.replace(/\.md$/i, ""),
    path,
    relativePath: optionalString(value.relativePath) || name,
    folder: optionalString(value.folder) || "",
    size: optionalNumber(value.size) || 0,
    modifiedAt: optionalNumber(value.modifiedAt) || 0,
    tags: optionalStringArray(value.tags),
    links: optionalStringArray(value.links),
    excerpt: optionalString(value.excerpt)
  };
}

function normalizeObsidianVaultScanResult(value: unknown): ObsidianVaultScanResult {
  const record = asRecord(value);
  const files = Array.isArray(record.files)
    ? record.files
      .map((item, index) => {
        const file = recordValue(item);
        return file ? normalizeObsidianFile(file, index) : null;
      })
      .filter((item): item is ObsidianVaultFile => Boolean(item))
    : [];
  const tags = Array.isArray(record.tags)
    ? record.tags.map((item) => {
      const tagRecord = recordValue(item) || {};
      return {
        tag: optionalString(tagRecord.tag) || "",
        count: optionalNumber(tagRecord.count) || 0
      };
    }).filter((item) => item.tag)
    : [];
  const path = requiredString(record.path, "obsidian vault scan is missing path.");
  return {
    path,
    name: optionalString(record.name) || path.split(/[\\/]/).filter(Boolean).pop() || "Obsidian vault",
    files,
    tags,
    raw: record
  };
}

function normalizeObsidianNotePayload(value: unknown): ObsidianNotePayload {
  const record = asRecord(value);
  return {
    path: requiredString(record.path, "obsidian note payload is missing path."),
    raw: optionalString(record.raw) || "",
    truncated: record.truncated === true,
    size: optionalNumber(record.size) || 0,
    modifiedAt: optionalNumber(record.modifiedAt) || 0
  };
}

export async function createWorkshopProject(payload: WorkshopProjectCreatePayload) {
  const result = await workbenchApi().createWorkshopProject(payload);
  return normalizeWorkshopProjectCreateResult(result);
}

export async function markWorkshopProjectReady(payload: WorkshopProjectReadyPayload) {
  const result = await workbenchApi().markWorkshopProjectReady(payload);
  return normalizeWorkshopProjectReadyResult(result);
}

export async function exportMeowPackage(payload: WorkshopExportMeowPackagePayload) {
  const result = await workbenchApi().exportMeowPackage(payload);
  return normalizeWorkshopExportMeowPackageResult(result);
}

export async function importMeowPackage(payload: WorkshopImportMeowPackagePayload = {}) {
  const result = await workbenchApi().importMeowPackage(payload);
  return normalizeWorkshopImportMeowPackageResult(result);
}

export async function readTaskCenterTasks() {
  const result = await workbenchApi().readStorage("tasks");
  return taskCenterTaskArray(storageValue(result)).map(normalizeTaskCenterTask);
}

export async function writeTaskCenterTasks(tasks: TaskCenterTask[]) {
  await workbenchApi().writeStorage("tasks", tasks.map(taskCenterTaskStorageValue));
  return tasks;
}

export async function readProfileSettings() {
  const result = await workbenchApi().readStorage("profile");
  return normalizeProfileSettings(storageValue(result));
}

export async function writeProfileSettings(profile: ProfileSettings) {
  const storageValue = profileSettingsStorageValue(profile);
  await workbenchApi().writeStorage("profile", storageValue);
  return normalizeProfileSettings(storageValue);
}

export async function deleteConversationMirror(payload: ConversationDeletePayload) {
  const result = await workbenchApi().deleteConversationMirror(payload);
  return normalizeConversationDeleteResult(result);
}

export async function readObsidianVaultPath() {
  const result = await workbenchApi().readStorage("obsidianVault");
  return optionalString(storageValue(result)) || "";
}

export async function writeObsidianVaultPath(vaultPath: string) {
  const normalized = String(vaultPath || "").trim();
  await workbenchApi().writeStorage("obsidianVault", normalized);
  return normalized;
}

export async function pickObsidianVault() {
  const result = await workbenchApi().pickObsidianVault();
  if (!result) return null;
  const vault = normalizeObsidianVaultScanResult(result);
  await writeObsidianVaultPath(vault.path);
  return vault;
}

export async function listObsidianFiles(vaultPath: string) {
  const targetPath = requiredString(vaultPath, "obsidian vault path is required.");
  const result = await workbenchApi().listObsidianFiles(targetPath);
  return normalizeObsidianVaultScanResult(result);
}

export async function readObsidianFile(filePath: string) {
  const targetPath = requiredString(filePath, "obsidian note path is required.");
  const result = await workbenchApi().readObsidianFile(targetPath);
  return normalizeObsidianNotePayload(result);
}

export async function listPets() {
  const result = await workbenchApi().listPets();
  return normalizePetPackageListResult(result);
}

export async function readPetScales() {
  const result = await workbenchApi().readStorage("petScales");
  return normalizePetScaleMap(storageValue(result));
}

export async function writePetScales(scales: PetScaleMap) {
  const normalized = normalizePetScaleMap(scales);
  await workbenchApi().writeStorage("petScales", normalized);
  return normalized;
}

export async function readPetDirectionFixes() {
  const result = await workbenchApi().readStorage("petDirectionFixes");
  return normalizePetDirectionFixMap(storageValue(result));
}

export async function writePetDirectionFixes(directionFixes: PetDirectionFixMap) {
  const normalized = normalizePetDirectionFixMap(directionFixes);
  await workbenchApi().writeStorage("petDirectionFixes", normalized);
  return normalized;
}

export async function listAgentRuntimeDescriptors() {
  const result = await workbenchApi().listAgentRuntimes();
  const records = Array.isArray(result) ? result : [];
  return records
    .map(normalizeAgentRuntimeDescriptor)
    .filter((item): item is AgentRuntimeDescriptor => Boolean(item));
}

export async function startTerminalSession(payload: TerminalStartPayload) {
  const sessionId = requiredString(payload.sessionId, "terminal start payload is missing sessionId.");
  const toolId = requiredString(payload.toolId, "terminal start payload is missing toolId.");
  const result = await workbenchApi().startTerminal({
    ...payload,
    sessionId,
    toolId
  });
  return normalizeTerminalStartResult(result);
}

export async function setTerminalSourceAdapter(id: string, enabled: boolean) {
  const sessionId = requiredString(id, "terminal source adapter payload is missing id.");
  const api = workbenchApi();
  if (!api.setTerminalSourceAdapter) return { ok: false, active: false };
  const result = await api.setTerminalSourceAdapter({ id: sessionId, enabled: Boolean(enabled) });
  const record = asRecord(result);
  return {
    ok: record.ok === true,
    active: record.active === true
  };
}

export function writeTerminalSession(id: string, data: string) {
  const sessionId = requiredString(id, "terminal write payload is missing id.");
  workbenchApi().writeTerminal(sessionId, String(data || ""));
}

export function resizeTerminalSession(id: string, cols: number, rows: number) {
  const sessionId = requiredString(id, "terminal resize payload is missing id.");
  const normalizedCols = Math.max(20, Math.round(Number(cols) || 0));
  const normalizedRows = Math.max(8, Math.round(Number(rows) || 0));
  workbenchApi().resizeTerminal(sessionId, normalizedCols, normalizedRows);
}

export function killTerminalSession(id: string) {
  const sessionId = requiredString(id, "terminal kill payload is missing id.");
  workbenchApi().killTerminal(sessionId);
}

export function onTerminalData(callback: (event: TerminalDataEvent) => void) {
  return workbenchApi().onTerminalData((payload) => {
    const event = normalizeTerminalDataEvent(payload);
    if (event) callback(event);
  });
}

export function onTerminalExit(callback: (event: TerminalExitEvent) => void) {
  return workbenchApi().onTerminalExit((payload) => {
    const event = normalizeTerminalExitEvent(payload);
    if (event) callback(event);
  });
}

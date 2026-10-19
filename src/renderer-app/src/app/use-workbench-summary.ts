import { useCallback, useEffect, useState } from "react";
import {
  normalizeSidebarIframeHostDescriptor,
  normalizeSidebarWidgetRuntimeDescriptor,
  normalizeTerminalSessionDescriptor,
  optionalWorkbenchApi
} from "@/lib/workbench-api";
import type {
  SidebarIframeHostDescriptor,
  SidebarWidgetRuntimeDescriptor,
  TerminalSessionDescriptor
} from "@/lib/workbench-api";

type WorkbenchSummaryState = {
  bridgeReady: boolean;
  status: "missing" | "loading" | "ready" | "error";
  homePath?: string;
  extensionsDir?: string;
  workshopExtensionCount?: number;
  workshopExtensions: WorkbenchExtensionSummary[];
  conversationCount?: number;
  conversationsDir?: string;
  conversationSources: WorkbenchConversationSource[];
  conversationHistoryMode?: string;
  obsidianVaultPath?: string;
  profile?: WorkbenchProfileSummary;
  taskCount?: number;
  openTaskCount?: number;
  doneTaskCount?: number;
  conversations: WorkbenchConversationSummary[];
  agentTools: WorkbenchAgentToolSummary[];
  terminalSessions: TerminalSessionDescriptor[];
  sidebarWidgetRuntimes: SidebarWidgetRuntimeDescriptor[];
  sidebarIframeHosts: SidebarIframeHostDescriptor[];
  lastLoadedAt?: number;
  error?: string;
};

export type WorkbenchSummary = WorkbenchSummaryState & {
  refresh: () => void;
  refreshing: boolean;
};

export type WorkbenchExtensionSummary = {
  id: string;
  name: string;
  type: string;
  status: string;
  version?: string;
  summary?: string;
  entry?: string;
  runtime?: string;
  target?: string;
  path?: string;
  manifestPath?: string;
  entryPath?: string;
  projectFilePath?: string;
  activeVersion?: string;
  versions: WorkbenchExtensionVersionSummary[];
  modifiedAt?: number;
  createdAt?: number;
  error?: string;
};

export type WorkbenchExtensionVersionSummary = {
  key: string;
  version?: string;
  label?: string;
  current: boolean;
  status?: string;
  summary?: string;
  runtime?: string;
  entry?: string;
  path?: string;
  manifestPath?: string;
  entryPath?: string;
  modifiedAt?: number;
};

export type WorkbenchAgentToolSummary = {
  id: string;
  name: string;
  kind?: string;
  command?: string;
  args?: string[];
  cwd?: string;
};

export type WorkbenchConversationSummary = {
  id: string;
  title: string;
  agent: string;
  status?: string;
  source?: string;
  preview?: string;
  path?: string;
  fileName?: string;
  size?: number;
  modifiedAt?: number;
  createdAt?: number;
  error?: string;
  messages: WorkbenchConversationMessage[];
  messageCount: number;
};

export type WorkbenchConversationMessage = {
  id: string;
  role: string;
  content: string;
  createdAt?: number;
};

export type WorkbenchConversationSource = {
  id: string;
  label: string;
  status?: string;
  count?: number;
};

export type WorkbenchProfileSummary = {
  displayName: string;
  developerId?: string;
  title?: string;
  bio?: string;
  avatarDataUrl?: string;
  level?: number;
  email?: string;
  gender?: string;
  emailPublic?: boolean;
  signedIn?: boolean;
  ownedTitleIds?: string[];
  wornTitleIds?: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function imageDataUrlValue(value: unknown) {
  const text = stringValue(value);
  return text?.startsWith("data:image/") ? text : undefined;
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function arrayRecords(value: unknown) {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
}

function storagePayloadValue(value: unknown) {
  return asRecord(value)?.value;
}

function normalizeWorkshopExtensionVersion(value: Record<string, unknown>, index: number): WorkbenchExtensionVersionSummary {
  const version = stringValue(value.version);
  const key = stringValue(value.key) || version || `version-${index + 1}`;
  return {
    key,
    version,
    label: stringValue(value.label) || (version ? `v${version}` : key),
    current: Boolean(value.current),
    status: stringValue(value.status),
    summary: stringValue(value.summary),
    runtime: stringValue(value.runtime),
    entry: stringValue(value.entry),
    path: stringValue(value.path),
    manifestPath: stringValue(value.manifestPath),
    entryPath: stringValue(value.entryPath),
    modifiedAt: numberValue(value.modifiedAt)
  };
}

function normalizeWorkshopExtension(value: Record<string, unknown>, index: number): WorkbenchExtensionSummary {
  const id = stringValue(value.id) || stringValue(value.folderName) || `extension-${index + 1}`;
  return {
    id,
    name: stringValue(value.name) || id,
    type: stringValue(value.type) || "unknown",
    status: stringValue(value.status) || (stringValue(value.error) ? "error" : "draft"),
    version: stringValue(value.version),
    summary: stringValue(value.summary),
    entry: stringValue(value.entry),
    runtime: stringValue(value.runtime),
    target: stringValue(value.target),
    path: stringValue(value.path) || stringValue(value.projectPath),
    manifestPath: stringValue(value.manifestPath),
    entryPath: stringValue(value.entryPath),
    projectFilePath: stringValue(value.projectFilePath),
    activeVersion: stringValue(value.activeVersion),
    versions: arrayRecords(value.versions).map(normalizeWorkshopExtensionVersion),
    modifiedAt: numberValue(value.modifiedAt),
    createdAt: numberValue(value.createdAt),
    error: stringValue(value.error)
  };
}

function normalizeAgentTool(value: Record<string, unknown>, index: number): WorkbenchAgentToolSummary {
  const id = stringValue(value.id) || stringValue(value.name) || `tool-${index + 1}`;
  return {
    id,
    name: stringValue(value.name) || id,
    kind: stringValue(value.toolKind) || stringValue(value.kind) || stringValue(value.type),
    command: stringValue(value.command),
    args: Array.isArray(value.args) ? value.args.map(String).filter(Boolean) : [],
    cwd: stringValue(value.cwd)
  };
}

function normalizeConversation(value: Record<string, unknown>, index: number): WorkbenchConversationSummary {
  const payload = asRecord(value.request) || value;
  const id = stringValue(payload.conversationId)
    || stringValue(value.conversationId)
    || stringValue(payload.id)
    || stringValue(value.id)
    || `conversation-${index + 1}`;
  const messages = conversationMessages(payload);
  const lastMessage = messages[messages.length - 1];
  const title = stringValue(payload.title)
    || stringValue(payload.name)
    || stringValue(value.title)
    || stringValue(value.name)
    || id;
  return {
    id,
    title,
    agent: stringValue(payload.agent)
      || stringValue(payload.agentName)
      || stringValue(payload.agentId)
      || stringValue(payload.toolKind)
      || stringValue(value.agent)
      || stringValue(value.agentName)
      || "Agent",
    status: stringValue(value.error) ? "error" : stringValue(payload.status) || stringValue(value.status),
    source: stringValue(payload.source) || stringValue(value.source) || stringValue(value.fileName),
    preview: stringValue(payload.preview) || stringValue(payload.summary) || stringValue(lastMessage?.content),
    path: stringValue(value.path) || stringValue(payload.path),
    fileName: stringValue(value.fileName),
    size: numberValue(value.size),
    modifiedAt: numberValue(value.modifiedAt) || numberValue(payload.updatedAt) || numberValue(payload.modifiedAt),
    createdAt: numberValue(value.createdAt) || numberValue(payload.createdAt),
    error: stringValue(value.error) || stringValue(payload.error),
    messages,
    messageCount: messages.length
  };
}

function normalizeConversationMessage(value: unknown, index: number): WorkbenchConversationMessage | null {
  if (typeof value === "string" && value.trim()) {
    return {
      id: `message-${index + 1}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: value
    };
  }
  const record = asRecord(value);
  if (!record) return null;
  const content = stringValue(record.content)
    || stringValue(record.text)
    || stringValue(record.message)
    || stringValue(record.output)
    || stringValue(record.body);
  if (!content) return null;
  return {
    id: stringValue(record.id) || stringValue(record.messageId) || `message-${index + 1}`,
    role: stringValue(record.role) || stringValue(record.kind) || stringValue(record.speaker) || "message",
    content,
    createdAt: numberValue(record.createdAt) || numberValue(record.timestamp) || numberValue(record.time)
  };
}

function conversationMessages(payload: Record<string, unknown>) {
  for (const key of ["messages", "conversation", "turns", "items", "entries", "transcript"]) {
    const source = payload[key];
    if (!Array.isArray(source)) continue;
    return source
      .map(normalizeConversationMessage)
      .filter((item): item is WorkbenchConversationMessage => Boolean(item));
  }
  return [];
}

function normalizeConversationSource(value: Record<string, unknown>, index: number): WorkbenchConversationSource {
  const id = stringValue(value.id) || stringValue(value.name) || stringValue(value.label) || `source-${index + 1}`;
  return {
    id,
    label: stringValue(value.label) || stringValue(value.name) || id,
    status: stringValue(value.status),
    count: numberValue(value.count)
  };
}

function normalizeProfile(value: unknown): WorkbenchProfileSummary | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const displayName = stringValue(record.displayName) || stringValue(record.name) || stringValue(record.username);
  const developerId = stringValue(record.developerId) || stringValue(record.id);
  const title = stringValue(record.title) || stringValue(record.equippedTitle);
  const bio = stringValue(record.bio) || stringValue(record.summary);
  const avatarDataUrl = imageDataUrlValue(record.avatarDataUrl);
  if (!displayName && !developerId && !title && !bio && !avatarDataUrl) return undefined;
  return {
    displayName: displayName || "本地开发者",
    developerId,
    title,
    bio,
    avatarDataUrl,
    level: numberValue(record.level),
    email: stringValue(record.email),
    gender: stringValue(record.gender),
    emailPublic: typeof record.emailPublic === "boolean" ? record.emailPublic : undefined,
    signedIn: typeof record.signedIn === "boolean" ? record.signedIn : undefined,
    ownedTitleIds: Array.isArray(record.ownedTitleIds) ? record.ownedTitleIds.map(String).filter(Boolean) : undefined,
    wornTitleIds: Array.isArray(record.wornTitleIds) ? record.wornTitleIds.map(String).filter(Boolean) : undefined
  };
}

function taskRecords(value: unknown) {
  if (Array.isArray(value)) return arrayRecords(value);
  const record = asRecord(value);
  return arrayRecords(record?.tasks);
}

function doneTaskRecords(records: Array<Record<string, unknown>>) {
  return records.filter((task) => {
    const status = (stringValue(task.status) || stringValue(task.state) || "").toLowerCase();
    return ["done", "completed", "complete", "archived"].includes(status);
  });
}

export function useWorkbenchSummary(): WorkbenchSummary {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [summary, setSummary] = useState<WorkbenchSummaryState>(() => ({
    bridgeReady: Boolean(optionalWorkbenchApi()),
    status: optionalWorkbenchApi() ? "loading" : "missing",
    workshopExtensions: [],
    conversations: [],
    conversationSources: [],
    agentTools: [],
    terminalSessions: [],
    sidebarWidgetRuntimes: [],
    sidebarIframeHosts: []
  }));
  const refresh = useCallback(() => setRefreshNonce((current) => current + 1), []);

  useEffect(() => {
    const api = optionalWorkbenchApi();
    if (!api) {
      setSummary({
        bridgeReady: false,
        status: "missing",
        workshopExtensions: [],
        conversations: [],
        conversationSources: [],
        agentTools: [],
        terminalSessions: [],
        sidebarWidgetRuntimes: [],
        sidebarIframeHosts: []
      });
      return;
    }

    const bridge = api;
    let cancelled = false;
    setSummary((current) => ({ ...current, bridgeReady: true, status: "loading", error: undefined }));

    async function loadSummary() {
      try {
        const [configInfo, storageInfo, agentInfo, profileStorage, tasksStorage, obsidianVaultStorage] = await Promise.all([
          bridge.getConfig(),
          bridge.getStorageInfo(),
          bridge.getAgentInterfaceInfo({ includeNativeHistory: false, forceRefresh: refreshNonce > 0 }),
          bridge.readStorage("profile").catch(() => null),
          bridge.readStorage("tasks").catch(() => null),
          bridge.readStorage("obsidianVault").catch(() => null)
        ]);
        if (cancelled) return;

        const config = asRecord(configInfo);
        const storage = asRecord(storageInfo);
        const storageDirs = asRecord(storage?.directories);
        const agent = asRecord(agentInfo);
        const workshopExtensionRecords = arrayRecords(agent?.workshopExtensions);
        const workshopExtensions = workshopExtensionRecords.map(normalizeWorkshopExtension);
        const conversationSummaries = arrayRecords(agent?.conversations).map(normalizeConversation);
        const conversationSources = arrayRecords(agent?.conversationSources).map(normalizeConversationSource);
        const sidebarWidgetRuntimes = workshopExtensionRecords
          .map(normalizeSidebarWidgetRuntimeDescriptor)
          .filter((item): item is SidebarWidgetRuntimeDescriptor => Boolean(item));
        const sidebarIframeHosts = workshopExtensionRecords
          .map(normalizeSidebarIframeHostDescriptor)
          .filter((item): item is SidebarIframeHostDescriptor => Boolean(item));
        const profile = normalizeProfile(storagePayloadValue(profileStorage));
        const tasks = taskRecords(storagePayloadValue(tasksStorage));
        const doneTasks = doneTaskRecords(tasks);
        const configTools = arrayRecords(config?.tools);
        const terminalEntries = configTools.map((tool, index) => ({
          tool,
          index,
          descriptor: normalizeTerminalSessionDescriptor(tool, index)
        }));
        const agentTools = terminalEntries
          .filter((entry) => !entry.descriptor)
          .map((entry) => normalizeAgentTool(entry.tool, entry.index));
        const terminalSessions = terminalEntries
          .map((entry) => entry.descriptor)
          .filter((item): item is TerminalSessionDescriptor => Boolean(item));
        setSummary({
          bridgeReady: true,
          status: "ready",
          homePath: stringValue(storage?.homePath),
          extensionsDir: stringValue(storageDirs?.extensions),
          workshopExtensionCount: workshopExtensions.length,
          workshopExtensions,
          conversations: conversationSummaries,
          conversationsDir: stringValue(agent?.conversationsDir),
          conversationSources,
          conversationHistoryMode: stringValue(agent?.historyMode),
          obsidianVaultPath: stringValue(storagePayloadValue(obsidianVaultStorage)),
          profile,
          taskCount: tasks.length,
          doneTaskCount: doneTasks.length,
          openTaskCount: tasks.length - doneTasks.length,
          agentTools,
          terminalSessions,
          sidebarWidgetRuntimes,
          sidebarIframeHosts,
          conversationCount: arrayLength(agent?.conversations),
          lastLoadedAt: Date.now()
        });
      } catch (error) {
        if (cancelled) return;
        setSummary({
          bridgeReady: true,
          status: "error",
          workshopExtensions: [],
          agentTools: [],
          conversations: [],
          conversationSources: [],
          terminalSessions: [],
          sidebarWidgetRuntimes: [],
          sidebarIframeHosts: [],
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  return {
    ...summary,
    refresh,
    refreshing: summary.status === "loading"
  };
}

import {
  hydrateHomeBackedStorage,
  readHomeBackedStorageCache,
  writeHomeBackedStorageCache,
  type HomeBackedStorageOptions
} from "@/lib/workbench-api";

export type ProjectType = "feature-page" | "sidebar-widget";
export type ProjectDraftType = ProjectType | "other";
export type ProjectState = "draft" | "review" | "ready" | "error";
export type StudioPage = "make" | "manage" | "publish";
export type StudioInspectorTab = "types" | "projects" | "detail" | "runtime";
export type StudioAgentStatus = "empty" | "selected" | "starting" | "running" | "exited" | "error";
export type StudioPendingOperation = "" | "create" | "import" | "mark-ready" | "export" | "publish" | "install-test";

export type ProjectDraft = {
  id?: string;
  name: string;
  type: ProjectDraftType;
  state: ProjectState;
  summary?: string;
  version?: string;
  error?: string;
  source?: "local" | "real";
  path?: string;
  entryPath?: string;
};

export type StudioProjectExportRecord = {
  packagePath: string;
  exportedAt: number;
};

export type StudioProjectPublishDraft = {
  title: string;
  summary: string;
  changelog: string;
  version: string;
};

export type StudioProjectInstallTestRecord = {
  testedAt: number;
  packagePath: string;
  installMode: string;
  testInstallPath: string;
  existingProjectName?: string;
};

export type StudioProjectPublishRecord = StudioProjectPublishDraft & {
  type: string;
  packagePath: string;
  publishedAt: number;
  checks: Record<string, boolean>;
  installTest?: StudioProjectInstallTestRecord;
};

export const initialProjectDrafts: ProjectDraft[] = [
  { name: "番茄钟右侧栏", type: "sidebar-widget", state: "ready" },
  { name: "任务看板", type: "sidebar-widget", state: "draft" },
  { name: "插件产品页", type: "feature-page", state: "review" }
];

const studioWorkspaceEnabledSidebarWidgetsStorageKey = "meowdesk.workspace.enabledSidebarWidgets.v2";
const studioWorkspaceEnabledFeaturePagesStorageKey = "meowdesk.workspace.enabledFeaturePages.v1";
const studioRemovedWorkshopProjectIdsStorageKey = "meowdesk.studio.removedWorkshopProjects.v1";
const studioProjectExportRecordsStorageKey = "meowdesk.studio.projectExportRecords.v1";
const studioProjectPublishDraftsStorageKey = "meowdesk.studio.projectPublishDrafts.v1";
const studioProjectPublishRecordsStorageKey = "meowdesk.studio.projectPublishRecords.v1";

export const studioRemovedWorkshopProjectsChangedEvent = "meowdesk:studio-removed-workshop-projects-changed";

function stringArrayStorageValue(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
}

function recordStorageValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function studioStorageValue<T>(homeKey: string, storageKey: string, fallback: T, validate?: (value: unknown) => T): HomeBackedStorageOptions<T> {
  return { storageKey, homeKey, fieldKey: storageKey, fallback, validate };
}

const STUDIO_ENABLED_SIDEBAR_WIDGETS_STORAGE = studioStorageValue("workspaceExtensions", studioWorkspaceEnabledSidebarWidgetsStorageKey, [], stringArrayStorageValue);
const STUDIO_ENABLED_FEATURE_PAGES_STORAGE = studioStorageValue("workspaceExtensions", studioWorkspaceEnabledFeaturePagesStorageKey, [], stringArrayStorageValue);
const STUDIO_REMOVED_PROJECTS_STORAGE = studioStorageValue("studioState", studioRemovedWorkshopProjectIdsStorageKey, [], stringArrayStorageValue);
const STUDIO_PROJECT_EXPORT_RECORDS_STORAGE = studioStorageValue("studioPublish", studioProjectExportRecordsStorageKey, {}, recordStorageValue);
const STUDIO_PROJECT_PUBLISH_DRAFTS_STORAGE = studioStorageValue("studioPublish", studioProjectPublishDraftsStorageKey, {}, recordStorageValue);
const STUDIO_PROJECT_PUBLISH_RECORDS_STORAGE = studioStorageValue("studioPublish", studioProjectPublishRecordsStorageKey, {}, recordStorageValue);

export function studioWorkshopTarget(type: ProjectType) {
  return type === "sidebar-widget" ? "workspace-sidebar" : "main-nav";
}

export function workshopRuntimeForType(type: ProjectType) {
  return type === "sidebar-widget" ? "meodesk-sidebar-widget" : "html";
}

export function readStudioEnabledSidebarWidgetIds() {
  if (typeof window === "undefined") return [];
  return readHomeBackedStorageCache(STUDIO_ENABLED_SIDEBAR_WIDGETS_STORAGE);
}

export function writeStudioEnabledSidebarWidgetIds(ids: string[]) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(STUDIO_ENABLED_SIDEBAR_WIDGETS_STORAGE, [...new Set(ids)]);
}

export function readStudioEnabledFeaturePageIds() {
  if (typeof window === "undefined") return [];
  return readHomeBackedStorageCache(STUDIO_ENABLED_FEATURE_PAGES_STORAGE);
}

export function writeStudioEnabledFeaturePageIds(ids: string[]) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(STUDIO_ENABLED_FEATURE_PAGES_STORAGE, [...new Set(ids)]);
}

export function readStudioRemovedWorkshopProjectIds() {
  if (typeof window === "undefined") return [];
  return readHomeBackedStorageCache(STUDIO_REMOVED_PROJECTS_STORAGE);
}

export function writeStudioRemovedWorkshopProjectIds(ids: string[]) {
  if (typeof window === "undefined") return;
  const normalized = [...new Set(ids)];
  writeHomeBackedStorageCache(STUDIO_REMOVED_PROJECTS_STORAGE, normalized);
  window.dispatchEvent(new CustomEvent(studioRemovedWorkshopProjectsChangedEvent, { detail: { ids: normalized } }));
}

export function readStudioProjectExportRecords(): Record<string, StudioProjectExportRecord> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = readHomeBackedStorageCache(STUDIO_PROJECT_EXPORT_RECORDS_STORAGE);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, value]) => {
      if (!value || typeof value !== "object") return [];
      const record = value as Partial<StudioProjectExportRecord>;
      const packagePath = typeof record.packagePath === "string" ? record.packagePath : "";
      const exportedAt = typeof record.exportedAt === "number" ? record.exportedAt : 0;
      return packagePath ? [[id, { packagePath, exportedAt }]] : [];
    }));
  } catch {
    return {};
  }
}

export function writeStudioProjectExportRecords(records: Record<string, StudioProjectExportRecord>) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(STUDIO_PROJECT_EXPORT_RECORDS_STORAGE, records);
}

export function readStudioProjectPublishDrafts(): Record<string, StudioProjectPublishDraft> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = readHomeBackedStorageCache(STUDIO_PROJECT_PUBLISH_DRAFTS_STORAGE);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, value]) => {
      if (!value || typeof value !== "object") return [];
      const record = value as Partial<StudioProjectPublishDraft>;
      return [[id, {
        title: typeof record.title === "string" ? record.title : "",
        summary: typeof record.summary === "string" ? record.summary : "",
        changelog: typeof record.changelog === "string" ? record.changelog : "",
        version: typeof record.version === "string" ? record.version : ""
      }]];
    }));
  } catch {
    return {};
  }
}

export function writeStudioProjectPublishDraft(id: string, draft: StudioProjectPublishDraft) {
  if (typeof window === "undefined") return;
  const drafts = readStudioProjectPublishDrafts();
  drafts[id] = draft;
  writeHomeBackedStorageCache(STUDIO_PROJECT_PUBLISH_DRAFTS_STORAGE, drafts);
}

export function readStudioProjectPublishRecords(): Record<string, StudioProjectPublishRecord> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = readHomeBackedStorageCache(STUDIO_PROJECT_PUBLISH_RECORDS_STORAGE);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([id, value]) => {
      if (!value || typeof value !== "object") return [];
      const record = value as Partial<StudioProjectPublishRecord>;
      const packagePath = typeof record.packagePath === "string" ? record.packagePath : "";
      if (!packagePath) return [];
      const installTest = record.installTest && typeof record.installTest === "object" ? record.installTest as Partial<StudioProjectInstallTestRecord> : undefined;
      return [[id, {
        title: typeof record.title === "string" ? record.title : "",
        summary: typeof record.summary === "string" ? record.summary : "",
        changelog: typeof record.changelog === "string" ? record.changelog : "",
        version: typeof record.version === "string" ? record.version : "",
        type: typeof record.type === "string" ? record.type : "",
        packagePath,
        publishedAt: typeof record.publishedAt === "number" ? record.publishedAt : 0,
        checks: record.checks && typeof record.checks === "object" ? record.checks as Record<string, boolean> : {},
        installTest: installTest?.packagePath ? {
          testedAt: typeof installTest.testedAt === "number" ? installTest.testedAt : 0,
          packagePath: String(installTest.packagePath || ""),
          installMode: String(installTest.installMode || ""),
          testInstallPath: String(installTest.testInstallPath || ""),
          existingProjectName: typeof installTest.existingProjectName === "string" ? installTest.existingProjectName : undefined
        } : undefined
      }]];
    }));
  } catch {
    return {};
  }
}

export function writeStudioProjectPublishRecords(records: Record<string, StudioProjectPublishRecord>) {
  if (typeof window === "undefined") return;
  writeHomeBackedStorageCache(STUDIO_PROJECT_PUBLISH_RECORDS_STORAGE, records);
}

export function hydrateStudioModelStorage(onValue: (key: string) => void) {
  const disposers = [
    hydrateHomeBackedStorage(STUDIO_ENABLED_SIDEBAR_WIDGETS_STORAGE, () => onValue(studioWorkspaceEnabledSidebarWidgetsStorageKey)),
    hydrateHomeBackedStorage(STUDIO_ENABLED_FEATURE_PAGES_STORAGE, () => onValue(studioWorkspaceEnabledFeaturePagesStorageKey)),
    hydrateHomeBackedStorage(STUDIO_REMOVED_PROJECTS_STORAGE, () => onValue(studioRemovedWorkshopProjectIdsStorageKey)),
    hydrateHomeBackedStorage(STUDIO_PROJECT_EXPORT_RECORDS_STORAGE, () => onValue(studioProjectExportRecordsStorageKey)),
    hydrateHomeBackedStorage(STUDIO_PROJECT_PUBLISH_DRAFTS_STORAGE, () => onValue(studioProjectPublishDraftsStorageKey)),
    hydrateHomeBackedStorage(STUDIO_PROJECT_PUBLISH_RECORDS_STORAGE, () => onValue(studioProjectPublishRecordsStorageKey))
  ];
  return () => {
    disposers.forEach((dispose) => dispose());
  };
}

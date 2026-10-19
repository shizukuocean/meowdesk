import { createOwnershipId, normalizeOwnershipScope, type OwnershipScope } from "@/lib/identity";

export type DevLedgerEntityKind =
  | "dev-session"
  | "project-record"
  | "subproject-record"
  | "category-record"
  | "spec-card"
  | "acceptance-item"
  | "problem-record"
  | "artifact"
  | "evidence"
  | "retest-run"
  | "lesson-candidate"
  | "actor"
  | "decision-record"
  | "risk-acceptance"
  | "link";

export type DevLedgerHelperPageId =
  | "product-maintenance"
  | "new-product-development"
  | "acceptance"
  | "record-library"
  | "classification-settings";

export type DevLedgerRecordStage =
  | "capture"
  | "clarify"
  | "agent-handoff"
  | "acceptance-feedback"
  | "retest"
  | "done";

export type DevLedgerCategoryKind =
  | "bug"
  | "improvement"
  | "ui-visual"
  | "prototype"
  | "new-product"
  | "acceptance"
  | "professional";

export type DevLedgerPriority = "low" | "normal" | "high" | "urgent";

export type DevLedgerRecordStatus =
  | "draft"
  | "open"
  | "ready"
  | "passed"
  | "failed"
  | "blocked"
  | "archived";

export type DevLedgerStableRef = OwnershipScope & {
  kind: "conversation" | "runtime" | "surface" | "source" | "artifact" | "evidence" | "external";
  id: string;
  label?: string;
  uri?: string;
};

export type DevLedgerRecord = OwnershipScope & {
  id: string;
  kind: DevLedgerEntityKind;
  title: string;
  status: DevLedgerRecordStatus;
  helperPage?: DevLedgerHelperPageId;
  stage?: DevLedgerRecordStage;
  categoryKind?: DevLedgerCategoryKind;
  categoryId?: string;
  subprojectId?: string;
  priority?: DevLedgerPriority;
  tags?: string[];
  stableKey?: string;
  summary?: string;
  refs?: DevLedgerStableRef[];
  parentId?: string;
  createdAt: number;
  updatedAt: number;
  source: "dev-guy" | "helper" | "meow-viewer" | "studio" | "workspace" | "system";
};

export type DevLedgerAppendInput = OwnershipScope & {
  kind: DevLedgerEntityKind;
  title: string;
  status?: DevLedgerRecordStatus;
  helperPage?: DevLedgerHelperPageId;
  stage?: DevLedgerRecordStage;
  categoryKind?: DevLedgerCategoryKind;
  categoryId?: string;
  subprojectId?: string;
  priority?: DevLedgerPriority;
  tags?: string[];
  stableKey?: string;
  summary?: string;
  refs?: DevLedgerStableRef[];
  parentId?: string;
  source: DevLedgerRecord["source"];
};

export type DevLedgerUpdateInput = Partial<OwnershipScope> & {
  title?: string;
  status?: DevLedgerRecordStatus;
  helperPage?: DevLedgerHelperPageId;
  stage?: DevLedgerRecordStage;
  categoryKind?: DevLedgerCategoryKind;
  categoryId?: string;
  subprojectId?: string;
  priority?: DevLedgerPriority;
  tags?: string[];
  stableKey?: string;
  summary?: string;
  refs?: DevLedgerStableRef[];
  parentId?: string;
  source?: DevLedgerRecord["source"];
};

export type DevLedgerQuery = {
  kinds?: DevLedgerEntityKind[];
  statuses?: DevLedgerRecordStatus[];
  helperPages?: DevLedgerHelperPageId[];
  stages?: DevLedgerRecordStage[];
  categoryKinds?: DevLedgerCategoryKind[];
  projectId?: string;
  subprojectId?: string;
  categoryId?: string;
  parentId?: string;
  tags?: string[];
  searchText?: string;
  scope?: OwnershipScope;
};

export type DevLedgerStore = {
  read: () => unknown[];
  write: (records: DevLedgerRecord[]) => void;
  now?: () => number;
};

export type DevLedgerStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
};

export type DevLedgerAdapter = {
  append: (input: DevLedgerAppendInput) => DevLedgerRecord;
  update: (id: string, patch: DevLedgerUpdateInput) => DevLedgerRecord | null;
  read: () => DevLedgerRecord[];
  query: (query?: DevLedgerQuery) => DevLedgerRecord[];
};

export const DEV_LEDGER_OWNER = "dev-ledger-core";
export const DEV_LEDGER_STORAGE_CLASSIFICATION = "helper-deferred";
export const DEV_LEDGER_STORAGE_KEY = "meowdesk.devLedger.records.v1";
export const DEV_LEDGER_RECORD_LIMIT = 1000;
export const DEV_LEDGER_TEXT_LIMITS = {
  id: 180,
  title: 160,
  stableKey: 240,
  summary: 2000,
  tag: 64,
  refLabel: 160,
  refUri: 600,
  tags: 40,
  refs: 20
} as const;
const DEV_LEDGER_ENTITY_KINDS: DevLedgerEntityKind[] = [
  "dev-session",
  "project-record",
  "subproject-record",
  "category-record",
  "spec-card",
  "acceptance-item",
  "problem-record",
  "artifact",
  "evidence",
  "retest-run",
  "lesson-candidate",
  "actor",
  "decision-record",
  "risk-acceptance",
  "link"
];
const DEV_LEDGER_HELPER_PAGES: DevLedgerHelperPageId[] = [
  "product-maintenance",
  "new-product-development",
  "acceptance",
  "record-library",
  "classification-settings"
];
const DEV_LEDGER_RECORD_STAGES: DevLedgerRecordStage[] = [
  "capture",
  "clarify",
  "agent-handoff",
  "acceptance-feedback",
  "retest",
  "done"
];
const DEV_LEDGER_CATEGORY_KINDS: DevLedgerCategoryKind[] = [
  "bug",
  "improvement",
  "ui-visual",
  "prototype",
  "new-product",
  "acceptance",
  "professional"
];
const DEV_LEDGER_PRIORITIES: DevLedgerPriority[] = [
  "low",
  "normal",
  "high",
  "urgent"
];
const DEV_LEDGER_RECORD_STATUSES: DevLedgerRecordStatus[] = [
  "draft",
  "open",
  "ready",
  "passed",
  "failed",
  "blocked",
  "archived"
];
const DEV_LEDGER_RECORD_SOURCES: DevLedgerRecord["source"][] = [
  "dev-guy",
  "helper",
  "meow-viewer",
  "studio",
  "workspace",
  "system"
];
const DEV_LEDGER_SCOPE_FIELDS: Array<keyof OwnershipScope> = [
  "runtimeId",
  "sessionId",
  "surfaceId",
  "conversationId",
  "agentId",
  "sourceId",
  "projectId"
];

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function optionalString(value: unknown, maxLength: number = DEV_LEDGER_TEXT_LIMITS.id) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalStringArray(
  value: unknown,
  maxItems: number = DEV_LEDGER_TEXT_LIMITS.tags,
  maxLength: number = DEV_LEDGER_TEXT_LIMITS.tag
) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => optionalString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function ownershipScopeFromRecord(record: Record<string, unknown>): OwnershipScope {
  return {
    runtimeId: optionalString(record.runtimeId),
    sessionId: optionalString(record.sessionId),
    surfaceId: optionalString(record.surfaceId),
    conversationId: optionalString(record.conversationId),
    agentId: optionalString(record.agentId),
    sourceId: optionalString(record.sourceId),
    projectId: optionalString(record.projectId)
  };
}

export function normalizeDevLedgerRecordStatus(value: unknown): DevLedgerRecordStatus {
  const status = optionalString(value) as DevLedgerRecordStatus | undefined;
  return status && DEV_LEDGER_RECORD_STATUSES.includes(status) ? status : "open";
}

function normalizeDevLedgerRecordSource(value: unknown): DevLedgerRecord["source"] {
  const source = optionalString(value) as DevLedgerRecord["source"] | undefined;
  return source && DEV_LEDGER_RECORD_SOURCES.includes(source) ? source : "system";
}

function normalizeDevLedgerEntityKind(value: unknown): DevLedgerEntityKind | null {
  const kind = optionalString(value) as DevLedgerEntityKind | undefined;
  return kind && DEV_LEDGER_ENTITY_KINDS.includes(kind) ? kind : null;
}

function normalizeDevLedgerHelperPage(value: unknown): DevLedgerHelperPageId | undefined {
  const page = optionalString(value) as DevLedgerHelperPageId | undefined;
  return page && DEV_LEDGER_HELPER_PAGES.includes(page) ? page : undefined;
}

function normalizeDevLedgerRecordStage(value: unknown): DevLedgerRecordStage | undefined {
  const stage = optionalString(value) as DevLedgerRecordStage | undefined;
  return stage && DEV_LEDGER_RECORD_STAGES.includes(stage) ? stage : undefined;
}

function normalizeDevLedgerCategoryKind(value: unknown): DevLedgerCategoryKind | undefined {
  const kind = optionalString(value) as DevLedgerCategoryKind | undefined;
  return kind && DEV_LEDGER_CATEGORY_KINDS.includes(kind) ? kind : undefined;
}

function normalizeDevLedgerPriority(value: unknown): DevLedgerPriority | undefined {
  const priority = optionalString(value) as DevLedgerPriority | undefined;
  return priority && DEV_LEDGER_PRIORITIES.includes(priority) ? priority : undefined;
}

function normalizeDevLedgerRef(value: unknown): DevLedgerStableRef | null {
  const record = recordValue(value);
  if (!record) return null;
  const kind = optionalString(record.kind) as DevLedgerStableRef["kind"] | undefined;
  if (!kind || !["conversation", "runtime", "surface", "source", "artifact", "evidence", "external"].includes(kind)) {
    return null;
  }
  const id = optionalString(record.id, DEV_LEDGER_TEXT_LIMITS.id);
  if (!id) return null;
  return {
    ...normalizeOwnershipScope(ownershipScopeFromRecord(record)),
    kind,
    id,
    label: optionalString(record.label, DEV_LEDGER_TEXT_LIMITS.refLabel),
    uri: optionalString(record.uri, DEV_LEDGER_TEXT_LIMITS.refUri)
  };
}

export function normalizeDevLedgerRecord(value: unknown): DevLedgerRecord | null {
  const record = recordValue(value);
  if (!record) return null;
  const kind = normalizeDevLedgerEntityKind(record.kind);
  const id = optionalString(record.id, DEV_LEDGER_TEXT_LIMITS.id);
  if (!kind || !id) return null;
  const createdAt = optionalNumber(record.createdAt) || Date.now();
  return {
    ...normalizeOwnershipScope(ownershipScopeFromRecord(record)),
    id,
    kind,
    title: optionalString(record.title, DEV_LEDGER_TEXT_LIMITS.title) || id,
    status: normalizeDevLedgerRecordStatus(record.status),
    helperPage: normalizeDevLedgerHelperPage(record.helperPage),
    stage: normalizeDevLedgerRecordStage(record.stage),
    categoryKind: normalizeDevLedgerCategoryKind(record.categoryKind),
    categoryId: optionalString(record.categoryId),
    subprojectId: optionalString(record.subprojectId),
    priority: normalizeDevLedgerPriority(record.priority),
    tags: optionalStringArray(record.tags),
    stableKey: optionalString(record.stableKey, DEV_LEDGER_TEXT_LIMITS.stableKey),
    summary: optionalString(record.summary, DEV_LEDGER_TEXT_LIMITS.summary),
    refs: Array.isArray(record.refs)
      ? record.refs.slice(0, DEV_LEDGER_TEXT_LIMITS.refs)
        .map(normalizeDevLedgerRef)
        .filter((item): item is DevLedgerStableRef => Boolean(item))
      : [],
    parentId: optionalString(record.parentId),
    createdAt,
    updatedAt: optionalNumber(record.updatedAt) || createdAt,
    source: normalizeDevLedgerRecordSource(record.source)
  };
}

function scopeMatches(record: OwnershipScope, scope: OwnershipScope) {
  return DEV_LEDGER_SCOPE_FIELDS.every((field) => {
    const expected = scope[field];
    return !expected || record[field] === expected;
  });
}

function queryValueListMatches<T extends string>(value: T | undefined, expected?: T[]) {
  return !expected?.length || Boolean(value && expected.includes(value));
}

function queryStringMatches(value: string | undefined, expected?: string) {
  return !expected || String(value || "") === expected;
}

function queryTagsMatch(recordTags: string[] | undefined, expectedTags?: string[]) {
  if (!expectedTags?.length) return true;
  const tags = new Set((recordTags || []).map((tag) => tag.toLowerCase()));
  return expectedTags.every((tag) => tags.has(String(tag || "").toLowerCase()));
}

function recordSearchText(record: DevLedgerRecord) {
  return [
    record.id,
    record.title,
    record.summary,
    record.stableKey,
    record.categoryId,
    record.subprojectId,
    ...(record.tags || []),
    ...(record.refs || []).flatMap((ref) => [ref.id, ref.label, ref.uri])
  ].filter(Boolean).join("\n").toLowerCase();
}

export function filterDevLedgerRecords(records: DevLedgerRecord[], query: DevLedgerQuery = {}) {
  const search = String(query.searchText || "").trim().toLowerCase();
  return records.filter((record) => {
    if (query.kinds?.length && !query.kinds.includes(record.kind)) return false;
    if (query.statuses?.length && !query.statuses.includes(record.status)) return false;
    if (!queryValueListMatches(record.helperPage, query.helperPages)) return false;
    if (!queryValueListMatches(record.stage, query.stages)) return false;
    if (!queryValueListMatches(record.categoryKind, query.categoryKinds)) return false;
    if (!queryStringMatches(String(record.projectId || ""), query.projectId)) return false;
    if (!queryStringMatches(record.subprojectId, query.subprojectId)) return false;
    if (!queryStringMatches(record.categoryId, query.categoryId)) return false;
    if (!queryStringMatches(record.parentId, query.parentId)) return false;
    if (!queryTagsMatch(record.tags, query.tags)) return false;
    if (query.scope && !scopeMatches(record, query.scope)) return false;
    if (search && !recordSearchText(record).includes(search)) return false;
    return true;
  });
}

function createDevLedgerRecord(input: DevLedgerAppendInput, now = Date.now()): DevLedgerRecord {
  const ownership = normalizeOwnershipScope(input);
  const record = normalizeDevLedgerRecord({
    ...ownership,
    id: createOwnershipId("source", "dev-ledger", input.kind, now),
    kind: input.kind,
    title: input.title,
    status: input.status || "open",
    helperPage: input.helperPage,
    stage: input.stage,
    categoryKind: input.categoryKind,
    categoryId: input.categoryId,
    subprojectId: input.subprojectId,
    priority: input.priority,
    tags: input.tags || [],
    stableKey: input.stableKey,
    summary: input.summary,
    refs: input.refs || [],
    parentId: input.parentId,
    createdAt: now,
    updatedAt: now,
    source: input.source
  });
  if (!record) {
    throw new Error("Unable to normalize Dev Ledger record");
  }
  return record;
}

export function updateDevLedgerRecord(
  records: DevLedgerRecord[],
  id: string,
  patch: DevLedgerUpdateInput,
  now = Date.now()
) {
  let updated: DevLedgerRecord | null = null;
  const nextRecords = records.map((record) => {
    if (record.id !== id) return record;
    updated = normalizeDevLedgerRecord({
      ...record,
      ...patch,
      updatedAt: now
    });
    return updated || record;
  });
  return {
    records: nextRecords,
    record: updated
  };
}

export function createMemoryDevLedgerStore(initialRecords: unknown[] = [], now?: () => number): DevLedgerStore {
  let records = Array.isArray(initialRecords) ? [...initialRecords] : [];
  return {
    read: () => [...records],
    write: (nextRecords) => {
      records = [...nextRecords];
    },
    now
  };
}

function browserDevLedgerStorage(): DevLedgerStorageLike | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function createLocalStorageDevLedgerStore(
  storage: DevLedgerStorageLike | null = browserDevLedgerStorage(),
  key = DEV_LEDGER_STORAGE_KEY,
  now?: () => number
): DevLedgerStore {
  return {
    read: () => {
      if (!storage) return [];
      try {
        const parsed = JSON.parse(storage.getItem(key) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    write: (records) => {
      if (!storage) return;
      const safeRecords = records
        .map(normalizeDevLedgerRecord)
        .filter((item): item is DevLedgerRecord => Boolean(item))
        .slice(-DEV_LEDGER_RECORD_LIMIT);
      storage.setItem(key, JSON.stringify(safeRecords));
    },
    now
  };
}

export function createDevLedgerAdapter(store: DevLedgerStore): DevLedgerAdapter {
  const read = () => store.read()
    .map(normalizeDevLedgerRecord)
    .filter((record): record is DevLedgerRecord => Boolean(record));
  const write = (records: DevLedgerRecord[]) => {
    store.write(records
      .map(normalizeDevLedgerRecord)
      .filter((record): record is DevLedgerRecord => Boolean(record))
      .slice(-DEV_LEDGER_RECORD_LIMIT));
  };
  return {
    append(input) {
      const now = store.now?.() || Date.now();
      const record = createDevLedgerRecord(input, now);
      write([...read(), record]);
      return record;
    },
    update(id, patch) {
      const result = updateDevLedgerRecord(read(), id, patch, store.now?.() || Date.now());
      if (!result.record) return null;
      write(result.records);
      return result.record;
    },
    read,
    query(query = {}) {
      return filterDevLedgerRecords(read(), query);
    }
  };
}

function readRawDevLedgerRecords(): DevLedgerRecord[] {
  return createLocalStorageDevLedgerStore().read()
    .map(normalizeDevLedgerRecord)
    .filter((item): item is DevLedgerRecord => Boolean(item));
}

function writeRawDevLedgerRecords(records: DevLedgerRecord[]) {
  createLocalStorageDevLedgerStore().write(records);
}

export function appendDevLedgerRecord(input: DevLedgerAppendInput): DevLedgerRecord {
  const now = Date.now();
  const record = createDevLedgerRecord(input, now);
  writeRawDevLedgerRecords([...readRawDevLedgerRecords(), record].slice(-DEV_LEDGER_RECORD_LIMIT));
  return record;
}

export function updateStoredDevLedgerRecord(id: string, patch: DevLedgerUpdateInput) {
  const result = updateDevLedgerRecord(readRawDevLedgerRecords(), id, patch);
  if (!result.record) return null;
  writeRawDevLedgerRecords(result.records);
  return result.record;
}

export function queryDevLedgerRecords(query: DevLedgerQuery = {}) {
  return filterDevLedgerRecords(readRawDevLedgerRecords(), query);
}

export function readDevLedgerRecords() {
  return readRawDevLedgerRecords();
}

export function devLedgerRecordsForProject(projectId: string) {
  return readRawDevLedgerRecords().filter((record) => String(record.projectId || "") === projectId);
}

export function devLedgerRecordsForSubproject(subprojectId: string) {
  return readRawDevLedgerRecords().filter((record) => record.subprojectId === subprojectId);
}

export function devLedgerRecordsForCategory(categoryId: string) {
  return readRawDevLedgerRecords().filter((record) => record.categoryId === categoryId);
}

export function devLedgerRecordsForStage(stage: DevLedgerRecordStage) {
  return readRawDevLedgerRecords().filter((record) => record.stage === stage);
}

export function devLedgerRecordsForScope(scope: OwnershipScope) {
  return readRawDevLedgerRecords().filter((record) => scopeMatches(record, scope));
}

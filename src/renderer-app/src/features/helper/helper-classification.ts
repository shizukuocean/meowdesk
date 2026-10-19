import {
  type DevLedgerAdapter,
  type DevLedgerAppendInput,
  type DevLedgerCategoryKind,
  type DevLedgerEntityKind,
  type DevLedgerRecord
} from "../dev-ledger/dev-ledger-core";

export type HelperClassificationInput = {
  title: string;
  projectId?: string;
  subprojectId?: string;
  categoryId?: string;
  categoryKind?: DevLedgerCategoryKind;
  parentId?: string;
  summary?: string;
  tags?: string[];
};

export type HelperClassificationKind = Extract<DevLedgerEntityKind, "project-record" | "subproject-record" | "category-record">;

export type HelperClassificationUpsertResult = {
  record: DevLedgerRecord;
  created: boolean;
};

const DEFAULT_PROJECT_ID = "project:local-workbench";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanString)
    .filter(Boolean)
    .filter((item, index, values) => values.indexOf(item) === index)
    .slice(0, 40);
}

function slugPart(value: unknown, fallback: string) {
  return (cleanString(value) || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_.:-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "") || fallback;
}

export function helperClassificationStableKey(kind: HelperClassificationKind, input: HelperClassificationInput) {
  const title = slugPart(input.title, kind);
  if (kind === "project-record") return `helper:project:${slugPart(input.projectId, title)}`;
  if (kind === "subproject-record") {
    return `helper:subproject:${slugPart(input.projectId, DEFAULT_PROJECT_ID)}:${slugPart(input.subprojectId, title)}`;
  }
  return `helper:category:${slugPart(input.projectId, DEFAULT_PROJECT_ID)}:${slugPart(input.categoryId, title)}`;
}

function createAppendInput(kind: HelperClassificationKind, input: HelperClassificationInput): DevLedgerAppendInput {
  const title = cleanString(input.title) || kind;
  const projectId = cleanString(input.projectId) || DEFAULT_PROJECT_ID;
  const subprojectId = kind === "subproject-record"
    ? cleanString(input.subprojectId) || `subproject:${slugPart(title, "local")}`
    : cleanString(input.subprojectId) || undefined;
  const categoryId = kind === "category-record"
    ? cleanString(input.categoryId) || `category:${slugPart(title, "local")}`
    : cleanString(input.categoryId) || undefined;
  return {
    kind,
    title,
    status: "open",
    helperPage: "classification-settings",
    stage: "capture",
    projectId,
    subprojectId,
    categoryId,
    categoryKind: kind === "category-record" ? input.categoryKind || "improvement" : undefined,
    parentId: cleanString(input.parentId) || (kind === "subproject-record" ? projectId : subprojectId),
    priority: "normal",
    tags: cleanStringList(input.tags),
    stableKey: helperClassificationStableKey(kind, input),
    summary: cleanString(input.summary) || undefined,
    refs: [],
    source: "helper"
  };
}

export function upsertHelperClassificationRecord(
  adapter: DevLedgerAdapter,
  kind: HelperClassificationKind,
  input: HelperClassificationInput
): HelperClassificationUpsertResult {
  const appendInput = createAppendInput(kind, input);
  const existing = adapter.read().find((record) => record.kind === kind && record.stableKey === appendInput.stableKey);
  if (!existing) {
    return {
      created: true,
      record: adapter.append(appendInput)
    };
  }
  const record = adapter.update(existing.id, {
    title: appendInput.title,
    status: "open",
    helperPage: "classification-settings",
    stage: "capture",
    projectId: appendInput.projectId,
    subprojectId: appendInput.subprojectId,
    categoryId: appendInput.categoryId,
    categoryKind: appendInput.categoryKind,
    parentId: appendInput.parentId,
    priority: appendInput.priority,
    tags: appendInput.tags,
    summary: appendInput.summary,
    source: "helper"
  }) || existing;
  return {
    created: false,
    record
  };
}

export function upsertHelperProject(adapter: DevLedgerAdapter, input: HelperClassificationInput) {
  return upsertHelperClassificationRecord(adapter, "project-record", input);
}

export function upsertHelperSubproject(adapter: DevLedgerAdapter, input: HelperClassificationInput) {
  return upsertHelperClassificationRecord(adapter, "subproject-record", input);
}

export function upsertHelperCategory(adapter: DevLedgerAdapter, input: HelperClassificationInput) {
  return upsertHelperClassificationRecord(adapter, "category-record", input);
}

export function helperClassificationRecords(adapter: DevLedgerAdapter) {
  return adapter.query({
    kinds: ["project-record", "subproject-record", "category-record"]
  });
}

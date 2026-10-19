import type {
  DevLedgerAppendInput,
  DevLedgerCategoryKind,
  DevLedgerEntityKind,
  DevLedgerHelperPageId,
  DevLedgerPriority,
  DevLedgerQuery,
  DevLedgerRecordStage,
  DevLedgerRecordStatus,
  DevLedgerStableRef
} from "../dev-ledger/dev-ledger-core";

export type HelperRecordMode = "vibe" | "professional";
export type HelperProductMaintenanceEntryId = "bug" | "improvement" | "ui-visual" | "prototype";
export type HelperFieldId =
  | "title"
  | "projectId"
  | "categoryKind"
  | "userText"
  | "expectedOutcome"
  | "affectedArea"
  | "notInScope"
  | "acceptanceNotes"
  | "technicalContext"
  | "reproSteps"
  | "verificationHint";

export type HelperInternalPageDefinition = {
  id: DevLedgerHelperPageId;
  label: string;
  role: string;
};

export type HelperEntryDefinition = {
  id: HelperProductMaintenanceEntryId | "new-product" | "acceptance" | "professional";
  label: string;
  helperPage: DevLedgerHelperPageId;
  categoryKind: DevLedgerCategoryKind;
  defaultKind: DevLedgerEntityKind;
  defaultStage: DevLedgerRecordStage;
};

export type HelperFieldDefinition = {
  id: HelperFieldId;
  label: string;
  requiredIn: HelperRecordMode[];
  handoffSection: "intent" | "scope" | "acceptance" | "technical";
};

export type HelperRecordDraftInput = {
  mode?: HelperRecordMode;
  entryId?: HelperEntryDefinition["id"];
  kind?: DevLedgerEntityKind;
  title?: string;
  projectId?: string;
  subprojectId?: string;
  categoryId?: string;
  categoryKind?: DevLedgerCategoryKind;
  priority?: DevLedgerPriority;
  tags?: string[];
  stage?: DevLedgerRecordStage;
  status?: DevLedgerRecordStatus;
  userText?: string;
  expectedOutcome?: string;
  affectedArea?: string;
  notInScope?: string;
  acceptanceNotes?: string;
  technicalContext?: string;
  reproSteps?: string;
  verificationHint?: string;
  refs?: DevLedgerStableRef[];
  parentId?: string;
};

export type HelperRecordDraft = Required<Pick<HelperRecordDraftInput,
  "mode" | "entryId" | "kind" | "title" | "projectId" | "categoryKind" | "stage" | "status"
>> & Omit<HelperRecordDraftInput,
  "mode" | "entryId" | "kind" | "title" | "projectId" | "categoryKind" | "stage" | "status"
> & {
  helperPage: DevLedgerHelperPageId;
  summary: string;
};

const DEFAULT_PROJECT_ID = "project:local-workbench";

export const helperInternalPages: HelperInternalPageDefinition[] = [
  {
    id: "product-maintenance",
    label: "产品维护",
    role: "记录现有产品或 Meowdesk 行为中的问题、改进、视觉调整和原型修改。"
  },
  {
    id: "new-product-development",
    label: "新产品开发",
    role: "承接从零开发功能、工具、插件、右侧栏组件或小产品的开发会话。"
  },
  {
    id: "acceptance",
    label: "验收",
    role: "管理验收项、复验结果、回归反馈和用户打回说明。"
  },
  {
    id: "record-library",
    label: "记录库",
    role: "搜索、筛选、打开和整理已提交记录。"
  },
  {
    id: "classification-settings",
    label: "分类设置",
    role: "维护 project、subproject、category 和 tag。"
  }
];

export const helperEntryDefinitions: HelperEntryDefinition[] = [
  {
    id: "bug",
    label: "Bug / 问题",
    helperPage: "product-maintenance",
    categoryKind: "bug",
    defaultKind: "problem-record",
    defaultStage: "capture"
  },
  {
    id: "improvement",
    label: "功能改进",
    helperPage: "product-maintenance",
    categoryKind: "improvement",
    defaultKind: "problem-record",
    defaultStage: "capture"
  },
  {
    id: "ui-visual",
    label: "视觉 / UI 调整",
    helperPage: "product-maintenance",
    categoryKind: "ui-visual",
    defaultKind: "problem-record",
    defaultStage: "capture"
  },
  {
    id: "prototype",
    label: "原型编辑器",
    helperPage: "product-maintenance",
    categoryKind: "prototype",
    defaultKind: "problem-record",
    defaultStage: "capture"
  },
  {
    id: "new-product",
    label: "新产品开发",
    helperPage: "new-product-development",
    categoryKind: "new-product",
    defaultKind: "dev-session",
    defaultStage: "capture"
  },
  {
    id: "acceptance",
    label: "验收反馈",
    helperPage: "acceptance",
    categoryKind: "acceptance",
    defaultKind: "acceptance-item",
    defaultStage: "acceptance-feedback"
  },
  {
    id: "professional",
    label: "专业需求 / 代码问题",
    helperPage: "product-maintenance",
    categoryKind: "professional",
    defaultKind: "spec-card",
    defaultStage: "clarify"
  }
];

export const helperFieldDefinitions: HelperFieldDefinition[] = [
  { id: "title", label: "一句话标题", requiredIn: ["vibe", "professional"], handoffSection: "intent" },
  { id: "projectId", label: "所属项目", requiredIn: ["vibe", "professional"], handoffSection: "scope" },
  { id: "categoryKind", label: "问题/需求类型", requiredIn: ["vibe", "professional"], handoffSection: "scope" },
  { id: "userText", label: "现在发生了什么 / 想做什么", requiredIn: ["vibe", "professional"], handoffSection: "intent" },
  { id: "expectedOutcome", label: "希望变成什么样", requiredIn: ["vibe", "professional"], handoffSection: "acceptance" },
  { id: "affectedArea", label: "影响范围", requiredIn: [], handoffSection: "scope" },
  { id: "notInScope", label: "这次不做什么", requiredIn: [], handoffSection: "scope" },
  { id: "acceptanceNotes", label: "验收标准 / 反馈", requiredIn: [], handoffSection: "acceptance" },
  { id: "technicalContext", label: "技术上下文", requiredIn: ["professional"], handoffSection: "technical" },
  { id: "reproSteps", label: "复现步骤", requiredIn: [], handoffSection: "technical" },
  { id: "verificationHint", label: "建议验证方式", requiredIn: [], handoffSection: "acceptance" }
];

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

export function helperEntryForId(entryId: HelperEntryDefinition["id"] | undefined) {
  return helperEntryDefinitions.find((entry) => entry.id === entryId) || helperEntryDefinitions[0];
}

export function helperEntryForCategory(categoryKind: DevLedgerCategoryKind | undefined) {
  return helperEntryDefinitions.find((entry) => entry.categoryKind === categoryKind) || helperEntryDefinitions[0];
}

export function helperFieldsForMode(mode: HelperRecordMode) {
  return helperFieldDefinitions.filter((field) => field.requiredIn.includes(mode) || mode === "professional");
}

export function normalizeHelperRecordDraft(input: HelperRecordDraftInput = {}): HelperRecordDraft {
  const mode: HelperRecordMode = input.mode === "professional" ? "professional" : "vibe";
  const entry = input.entryId
    ? helperEntryForId(input.entryId)
    : helperEntryForCategory(input.categoryKind);
  const categoryKind = input.categoryKind || entry.categoryKind;
  const title = cleanString(input.title) || cleanString(input.userText).slice(0, 80) || entry.label;
  const userText = cleanString(input.userText);
  const expectedOutcome = cleanString(input.expectedOutcome);
  const summary = [userText, expectedOutcome ? `期望：${expectedOutcome}` : ""].filter(Boolean).join("\n\n");
  return {
    mode,
    entryId: entry.id,
    kind: input.kind || entry.defaultKind,
    title,
    projectId: cleanString(input.projectId) || DEFAULT_PROJECT_ID,
    subprojectId: cleanString(input.subprojectId) || undefined,
    categoryId: cleanString(input.categoryId) || undefined,
    categoryKind,
    priority: input.priority || "normal",
    tags: cleanStringList(input.tags),
    stage: input.stage || entry.defaultStage,
    status: input.status || "draft",
    userText,
    expectedOutcome,
    affectedArea: cleanString(input.affectedArea) || undefined,
    notInScope: cleanString(input.notInScope) || undefined,
    acceptanceNotes: cleanString(input.acceptanceNotes) || undefined,
    technicalContext: cleanString(input.technicalContext) || undefined,
    reproSteps: cleanString(input.reproSteps) || undefined,
    verificationHint: cleanString(input.verificationHint) || undefined,
    refs: input.refs || [],
    parentId: cleanString(input.parentId) || undefined,
    helperPage: entry.helperPage,
    summary
  };
}

export function helperMissingRequiredFields(input: HelperRecordDraftInput | HelperRecordDraft) {
  const draft = "helperPage" in input ? input : normalizeHelperRecordDraft(input);
  const fields = helperFieldDefinitions.filter((field) => field.requiredIn.includes(draft.mode));
  return fields
    .filter((field) => {
      const value = draft[field.id as keyof HelperRecordDraft];
      return Array.isArray(value) ? !value.length : !cleanString(value);
    })
    .map((field) => field.id);
}

export function helperRecordDraftToDevLedgerInput(draftInput: HelperRecordDraftInput | HelperRecordDraft): DevLedgerAppendInput {
  const draft = "helperPage" in draftInput ? draftInput : normalizeHelperRecordDraft(draftInput);
  return {
    kind: draft.kind,
    title: draft.title,
    status: draft.status,
    helperPage: draft.helperPage,
    stage: draft.stage,
    categoryKind: draft.categoryKind,
    categoryId: draft.categoryId,
    subprojectId: draft.subprojectId,
    priority: draft.priority,
    tags: draft.tags,
    stableKey: `${draft.helperPage}:${draft.categoryKind}:${draft.projectId}:${draft.title}`,
    summary: draft.summary,
    refs: draft.refs,
    parentId: draft.parentId,
    projectId: draft.projectId,
    source: "helper"
  };
}

export function helperRecordQueryForPage(pageId: DevLedgerHelperPageId): DevLedgerQuery {
  if (pageId === "record-library") return {};
  if (pageId === "classification-settings") {
    return {
      kinds: ["project-record", "subproject-record", "category-record"]
    };
  }
  return {
    helperPages: [pageId]
  };
}

import {
  helperEntryForId,
  helperEntryForCategory,
  normalizeHelperRecordDraft,
  type HelperRecordDraft,
  type HelperRecordDraftInput
} from "./helper-contract";
import type { DevLedgerRecord } from "../dev-ledger/dev-ledger-core";

export type HelperAgentHandoffInput = HelperRecordDraftInput & {
  agentName?: string;
  extraContext?: string;
};

export type HelperStoredRecordHandoffInput = {
  agentName?: string;
  extraContext?: string;
  expectedOutcome?: string;
  notInScope?: string;
  acceptanceNotes?: string;
  technicalContext?: string;
  verificationHint?: string;
};

function cleanBlock(value: unknown) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function section(title: string, body: string | string[]) {
  const lines = Array.isArray(body) ? body.map(cleanBlock).filter(Boolean) : [cleanBlock(body)].filter(Boolean);
  if (!lines.length) return "";
  return [`## ${title}`, ...lines].join("\n");
}

function bulletList(items: Array<[string, unknown]>) {
  return items
    .map(([label, value]) => [label, cleanBlock(value)] as const)
    .filter(([, value]) => value)
    .map(([label, value]) => `- ${label}: ${value}`)
    .join("\n");
}

function tagsLine(tags?: string[]) {
  return tags?.length ? tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ") : "";
}

export function createHelperAgentHandoff(input: HelperAgentHandoffInput | HelperRecordDraft) {
  const draft = "helperPage" in input ? input : normalizeHelperRecordDraft(input);
  const entry = helperEntryForId(draft.entryId);
  const agentName = cleanBlock("agentName" in input ? input.agentName : "") || "Agent";
  const extraContext = cleanBlock("extraContext" in input ? input.extraContext : "");
  const title = `# ${draft.title}`;
  const meta = bulletList([
    ["目标接收者", agentName],
    ["Helper 入口", entry.label],
    ["模式", draft.mode === "professional" ? "professional" : "vibe"],
    ["项目", draft.projectId],
    ["子项目", draft.subprojectId],
    ["分类", draft.categoryKind],
    ["分类 ID", draft.categoryId],
    ["阶段", draft.stage],
    ["优先级", draft.priority],
    ["标签", tagsLine(draft.tags)]
  ]);
  const intent = bulletList([
    ["用户原话 / 需求", draft.userText],
    ["期望结果", draft.expectedOutcome],
    ["影响范围", draft.affectedArea],
    ["这次不做", draft.notInScope]
  ]);
  const acceptance = bulletList([
    ["验收标准 / 反馈", draft.acceptanceNotes],
    ["建议验证方式", draft.verificationHint]
  ]);
  const technical = bulletList([
    ["技术上下文", draft.technicalContext],
    ["复现步骤", draft.reproSteps],
    ["补充上下文", extraContext]
  ]);
  const refs = draft.refs?.length
    ? draft.refs.map((ref) => `- ${ref.kind}: ${ref.label || ref.id}${ref.uri ? ` (${ref.uri})` : ""}`).join("\n")
    : "";

  return [
    title,
    section("交接元信息", meta),
    section("要解决什么", intent),
    section("验收与边界", acceptance),
    section("技术补充", technical),
    section("稳定引用", refs),
    "## 执行要求",
    "- 先确认 owner 和最小可验证路径。",
    "- 不要扩大到未列入本次范围的 UI 或 runtime 改动。",
    "- 输出时说明修改点、验证方式和剩余风险。"
  ].filter(Boolean).join("\n\n");
}

export function helperRecordToHandoffInput(
  record: DevLedgerRecord,
  input: HelperStoredRecordHandoffInput = {}
): HelperAgentHandoffInput {
  const entry = helperEntryForCategory(record.categoryKind);
  return {
    mode: entry.id === "professional" ? "professional" : "vibe",
    entryId: entry.id,
    kind: record.kind,
    title: record.title,
    projectId: record.projectId,
    subprojectId: record.subprojectId,
    categoryId: record.categoryId,
    categoryKind: record.categoryKind || entry.categoryKind,
    priority: record.priority,
    tags: record.tags,
    stage: record.stage,
    status: record.status,
    userText: record.summary || record.title,
    expectedOutcome: input.expectedOutcome || "",
    notInScope: input.notInScope,
    acceptanceNotes: input.acceptanceNotes,
    technicalContext: input.technicalContext,
    verificationHint: input.verificationHint,
    refs: record.refs,
    parentId: record.parentId,
    agentName: input.agentName,
    extraContext: input.extraContext
  };
}

export function createHelperAgentHandoffForRecord(
  record: DevLedgerRecord,
  input: HelperStoredRecordHandoffInput = {}
) {
  return createHelperAgentHandoff(helperRecordToHandoffInput(record, input));
}

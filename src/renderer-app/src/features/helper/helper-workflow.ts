import {
  type DevLedgerAdapter,
  type DevLedgerRecord,
  type DevLedgerRecordStage,
  type DevLedgerRecordStatus,
  type DevLedgerStableRef
} from "../dev-ledger/dev-ledger-core";
import { createHelperAgentHandoffForRecord, type HelperStoredRecordHandoffInput } from "./helper-agent-handoff";

export type HelperWorkflowAction =
  | "submit"
  | "clarify"
  | "handoff"
  | "acceptance-feedback"
  | "retest"
  | "pass"
  | "fail"
  | "archive"
  | "reopen";

export type HelperWorkflowTransition = {
  action: HelperWorkflowAction;
  label: string;
  stage: DevLedgerRecordStage;
  status: DevLedgerRecordStatus;
};

export type HelperWorkflowTransitionInput = {
  note?: string;
  tags?: string[];
  refs?: DevLedgerStableRef[];
};

export type HelperWorkflowTransitionResult =
  | {
    ok: true;
    transition: HelperWorkflowTransition;
    previous: DevLedgerRecord;
    record: DevLedgerRecord;
  }
  | {
    ok: false;
    reason: "not-found" | "update-failed";
    id: string;
  };

export type HelperHandoffPreparationResult =
  | {
    ok: true;
    record: DevLedgerRecord;
    handoff: string;
  }
  | {
    ok: false;
    reason: "not-found";
    id: string;
  };

export const helperWorkflowTransitions: HelperWorkflowTransition[] = [
  { action: "submit", label: "提交记录", stage: "clarify", status: "open" },
  { action: "clarify", label: "继续澄清", stage: "clarify", status: "open" },
  { action: "handoff", label: "准备交接", stage: "agent-handoff", status: "ready" },
  { action: "acceptance-feedback", label: "进入验收反馈", stage: "acceptance-feedback", status: "open" },
  { action: "retest", label: "等待复验", stage: "retest", status: "open" },
  { action: "pass", label: "验收通过", stage: "done", status: "passed" },
  { action: "fail", label: "验收打回", stage: "retest", status: "failed" },
  { action: "archive", label: "归档记录", stage: "done", status: "archived" },
  { action: "reopen", label: "重新打开", stage: "clarify", status: "open" }
];

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueList(values: Array<string | undefined>) {
  return values
    .map(cleanString)
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 40);
}

export function helperTransitionForAction(action: HelperWorkflowAction) {
  return helperWorkflowTransitions.find((transition) => transition.action === action) || helperWorkflowTransitions[0];
}

export function transitionHelperRecord(
  adapter: DevLedgerAdapter,
  id: string,
  action: HelperWorkflowAction,
  input: HelperWorkflowTransitionInput = {}
): HelperWorkflowTransitionResult {
  const previous = adapter.read().find((record) => record.id === id);
  if (!previous) {
    return {
      ok: false,
      reason: "not-found",
      id
    };
  }
  const transition = helperTransitionForAction(action);
  const note = cleanString(input.note);
  const summary = note
    ? [previous.summary, `【${transition.label}】${note}`].filter(Boolean).join("\n\n")
    : previous.summary;
  const record = adapter.update(id, {
    stage: transition.stage,
    status: transition.status,
    summary,
    tags: uniqueList([...(previous.tags || []), ...(input.tags || [])]),
    refs: [...(previous.refs || []), ...(input.refs || [])]
  });
  if (!record) {
    return {
      ok: false,
      reason: "update-failed",
      id
    };
  }
  return {
    ok: true,
    transition,
    previous,
    record
  };
}

export function archiveHelperRecord(adapter: DevLedgerAdapter, id: string, note?: string) {
  return transitionHelperRecord(adapter, id, "archive", { note });
}

export function prepareHelperAgentHandoff(
  adapter: DevLedgerAdapter,
  id: string,
  input: HelperStoredRecordHandoffInput = {}
): HelperHandoffPreparationResult {
  const record = adapter.read().find((item) => item.id === id);
  if (!record) {
    return {
      ok: false,
      reason: "not-found",
      id
    };
  }
  return {
    ok: true,
    record,
    handoff: createHelperAgentHandoffForRecord(record, input)
  };
}

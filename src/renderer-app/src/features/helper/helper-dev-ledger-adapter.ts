import {
  type DevLedgerAdapter,
  type DevLedgerHelperPageId,
  type DevLedgerQuery,
  type DevLedgerRecord,
  type DevLedgerRecordStage,
  type DevLedgerRecordStatus
} from "../dev-ledger/dev-ledger-core";
import {
  helperMissingRequiredFields,
  helperRecordDraftToDevLedgerInput,
  helperRecordQueryForPage,
  normalizeHelperRecordDraft,
  type HelperRecordDraft,
  type HelperRecordDraftInput
} from "./helper-contract";

export type HelperRecordAppendResult =
  | {
    ok: true;
    draft: HelperRecordDraft;
    record: DevLedgerRecord;
  }
  | {
    ok: false;
    draft: HelperRecordDraft;
    missingFields: string[];
  };

export function appendHelperRecord(adapter: DevLedgerAdapter, input: HelperRecordDraftInput): HelperRecordAppendResult {
  const draft = normalizeHelperRecordDraft(input);
  const missingFields = helperMissingRequiredFields(draft);
  if (missingFields.length) {
    return {
      ok: false,
      draft,
      missingFields
    };
  }
  return {
    ok: true,
    draft,
    record: adapter.append(helperRecordDraftToDevLedgerInput(draft))
  };
}

export function updateHelperRecordStage(
  adapter: DevLedgerAdapter,
  id: string,
  stage: DevLedgerRecordStage,
  status?: DevLedgerRecordStatus
) {
  return adapter.update(id, {
    stage,
    ...(status ? { status } : {})
  });
}

export function helperRecordsForPage(adapter: DevLedgerAdapter, pageId: DevLedgerHelperPageId) {
  return adapter.query(helperRecordQueryForPage(pageId));
}

export function queryHelperRecords(adapter: DevLedgerAdapter, query: DevLedgerQuery = {}) {
  return adapter.query(query);
}

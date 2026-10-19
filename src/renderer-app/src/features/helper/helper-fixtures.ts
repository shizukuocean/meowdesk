import {
  createDevLedgerAdapter,
  createMemoryDevLedgerStore,
  type DevLedgerAdapter
} from "../dev-ledger/dev-ledger-core";
import { appendHelperRecord } from "./helper-dev-ledger-adapter";
import { upsertHelperCategory, upsertHelperProject, upsertHelperSubproject } from "./helper-classification";

export type HelperFixture = {
  adapter: DevLedgerAdapter;
  projectId: string;
  subprojectId: string;
  categoryId: string;
  recordId: string;
};

export function createHelperDevLedgerFixture(now: () => number = () => 1700000000000): HelperFixture {
  const adapter = createDevLedgerAdapter(createMemoryDevLedgerStore([], now));
  const project = upsertHelperProject(adapter, {
    title: "Meowdesk",
    projectId: "project:meowdesk",
    summary: "Meowdesk local workbench project."
  }).record;
  const subproject = upsertHelperSubproject(adapter, {
    title: "Helper",
    projectId: project.projectId,
    subprojectId: "subproject:helper",
    summary: "Helper and Dev Ledger functional layer."
  }).record;
  const category = upsertHelperCategory(adapter, {
    title: "视觉调整",
    projectId: project.projectId,
    subprojectId: subproject.subprojectId,
    categoryId: "category:ui-visual",
    categoryKind: "ui-visual",
    summary: "UI / visual adjustment records."
  }).record;
  const record = appendHelperRecord(adapter, {
    mode: "vibe",
    entryId: "ui-visual",
    title: "Helper 页面不要吓退 vibe coder",
    projectId: project.projectId,
    subprojectId: subproject.subprojectId,
    categoryId: category.categoryId,
    tags: ["helper", "fixture"],
    userText: "Helper 需要引导，但不能看起来像复杂仪表盘。",
    expectedOutcome: "保留流程感，同时减少视觉压力。",
    notInScope: "不做最终视觉语言。"
  });
  if (!record.ok) {
    throw new Error(`Helper fixture record failed: ${record.missingFields.join(",")}`);
  }
  return {
    adapter,
    projectId: project.projectId || "project:meowdesk",
    subprojectId: subproject.subprojectId || "subproject:helper",
    categoryId: category.categoryId || "category:ui-visual",
    recordId: record.record.id
  };
}

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");
const helperDir = path.join(repoRoot, "src", "renderer-app", "src", "features", "helper");
const devLedgerCorePath = path.join(repoRoot, "src", "renderer-app", "src", "features", "dev-ledger", "dev-ledger-core.ts");

const moduleCache = new Map();

function cleanOwnershipPart(value, fallback) {
  const text = String(value || "").trim() || fallback;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "") || fallback;
}

const identityStub = {
  createOwnershipId(kind, ...parts) {
    const body = parts.length
      ? parts.map((part, index) => cleanOwnershipPart(part, `part-${index + 1}`)).join(":")
      : "default";
    return `${kind}:${body}`;
  },
  normalizeOwnershipScope(scope = {}) {
    return {
      ...scope,
      projectId: scope.projectId || "project:local-workbench"
    };
  }
};

function resolveTsModule(fromFile, id) {
  if (id === "@/lib/identity") return id;
  if (!id.startsWith(".")) {
    throw new Error(`Unexpected helper contract runtime import: ${id}`);
  }
  const base = path.resolve(path.dirname(fromFile), id);
  for (const candidate of [`${base}.ts`, path.join(base, "index.ts")]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Unable to resolve ${id} from ${fromFile}`);
}

function loadTsModule(filePath) {
  if (filePath === "@/lib/identity") return identityStub;
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;
  const source = fs.readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
    }
  });
  const module = { exports: {} };
  moduleCache.set(filePath, module);
  const context = {
    exports: module.exports,
    module,
    require(id) {
      return loadTsModule(resolveTsModule(filePath, id));
    },
    console
  };
  vm.runInNewContext(transpiled.outputText, context, {
    filename: filePath,
    displayErrors: true
  });
  return module.exports;
}

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ""}`);
  }
}

function helperSources() {
  const sources = fs.readdirSync(helperDir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => fs.readFileSync(path.join(helperDir, name), "utf8"))
    .join("\n");
  return sources;
}

function assertSourceDoesNotContainRuntimeOwnership() {
  const sources = helperSources();
  for (const forbidden of [
    "startAgentRuntime",
    "stopAgentRuntime",
    "writeAgentRuntime",
    "resizeAgentRuntime",
    "listAgentRuntimes",
    "attachAgentRuntimeData",
    "onTerminalData",
    "MeowViewer"
  ]) {
    assert(!sources.includes(forbidden), `Helper pre-UI contract must not own runtime or Viewer collection: ${forbidden}`);
  }
}

function assertHelperDoesNotOwnStorage() {
  const sources = helperSources();
  for (const forbidden of [
    "localStorage",
    "readHomeBackedStorage",
    "writeHomeBackedStorage",
    "readStorage",
    "writeStorage",
    "window.workbench",
    "DEV_LEDGER_STORAGE_KEY"
  ]) {
    assert(!sources.includes(forbidden), `Helper must not own storage directly: ${forbidden}`);
  }
}

function main() {
  const helper = loadTsModule(path.join(helperDir, "index.ts"));
  const devLedger = loadTsModule(devLedgerCorePath);

  assert(devLedger.DEV_LEDGER_OWNER === "dev-ledger-core", "Dev Ledger owner marker should be explicit", devLedger.DEV_LEDGER_OWNER);
  assert(devLedger.DEV_LEDGER_STORAGE_CLASSIFICATION === "helper-deferred", "Dev Ledger storage classification should stay helper-deferred", devLedger.DEV_LEDGER_STORAGE_CLASSIFICATION);
  assert(devLedger.DEV_LEDGER_STORAGE_KEY === "meowdesk.devLedger.records.v1", "Dev Ledger storage key changed unexpectedly", devLedger.DEV_LEDGER_STORAGE_KEY);
  assert(devLedger.DEV_LEDGER_TEXT_LIMITS.summary <= 2000, "Dev Ledger records must stay thin by default", devLedger.DEV_LEDGER_TEXT_LIMITS);

  assert(helper.helperInternalPages.length === 5, "Helper should keep five internal pages", helper.helperInternalPages);
  assert(
    helper.helperInternalPages.map((page) => page.id).join("|") === "product-maintenance|new-product-development|acceptance|record-library|classification-settings",
    "Helper internal page order changed",
    helper.helperInternalPages
  );
  assert(helper.helperFieldsForMode("vibe").length < helper.helperFieldsForMode("professional").length, "Professional mode should expose more fields without a second schema");

  const store = devLedger.createMemoryDevLedgerStore([], () => 1700000000000);
  const adapter = devLedger.createDevLedgerAdapter(store);
  const appendResult = helper.appendHelperRecord(adapter, {
    mode: "vibe",
    entryId: "ui-visual",
    title: "Helper 页面看起来太复杂",
    projectId: "project:meowdesk",
    subprojectId: "subproject:helper",
    categoryId: "category:ui",
    tags: ["helper", "visual"],
    userText: "当前页面像仪表盘，vibe coder 会被劝退。",
    expectedOutcome: "保留引导，但视觉上更轻。",
    notInScope: "不做 GSAP 和完整视觉定稿。",
    acceptanceNotes: "用户能清楚知道这个阶段去哪里写。"
  });

  assert(appendResult.ok, "Vibe record should append when required fields are present", appendResult);
  assert(appendResult.record.helperPage === "product-maintenance", "Product maintenance entry should map to product-maintenance page", appendResult.record);
  assert(appendResult.record.categoryKind === "ui-visual", "Category kind should be preserved", appendResult.record);
  assert(appendResult.record.projectId === "project:meowdesk", "Project id should anchor the record", appendResult.record);

  const missingResult = helper.appendHelperRecord(adapter, {
    mode: "professional",
    entryId: "professional",
    title: "缺少专业上下文",
    projectId: "project:meowdesk",
    userText: "需要专业版字段。"
  });
  assert(!missingResult.ok && missingResult.missingFields.includes("expectedOutcome"), "Professional/vibe required fields should stay explicit", missingResult);
  assert(missingResult.missingFields.includes("technicalContext"), "Professional mode should require technical context", missingResult);

  const updated = helper.updateHelperRecordStage(adapter, appendResult.record.id, "agent-handoff", "ready");
  assert(updated?.stage === "agent-handoff" && updated.status === "ready", "Stage update should use Dev Ledger adapter", updated);

  const pageRecords = helper.helperRecordsForPage(adapter, "product-maintenance");
  const categoryRecords = helper.queryHelperRecords(adapter, { categoryId: "category:ui" });
  const searchRecords = helper.queryHelperRecords(adapter, { searchText: "劝退" });
  const libraryRecords = helper.helperRecordsForPage(adapter, "record-library");
  const classificationRecords = helper.helperRecordsForPage(adapter, "classification-settings");
  assert(pageRecords.length === 1, "Product maintenance page query should find the record", pageRecords);
  assert(categoryRecords.length === 1, "Category query should find the record", categoryRecords);
  assert(searchRecords.length === 1, "Search should inspect title/summary/tags/refs", searchRecords);
  assert(libraryRecords.length === 1, "Record library should query all records", libraryRecords);
  assert(classificationRecords.length === 0, "Classification settings should only show classification entities", classificationRecords);

  const handoff = helper.createHelperAgentHandoff({
    ...appendResult.draft,
    agentName: "Claude",
    extraContext: "先做数据和流程，不进入视觉。"
  });
  assert(handoff.includes("Helper 页面看起来太复杂"), "Handoff should include title", handoff);
  assert(handoff.includes("不做 GSAP 和完整视觉定稿"), "Handoff should include explicit not-in-scope", handoff);
  assert(handoff.includes("先确认 owner 和最小可验证路径"), "Handoff should include execution discipline", handoff);

  const handoffFromRecord = helper.prepareHelperAgentHandoff(adapter, appendResult.record.id, {
    agentName: "Codex",
    extraContext: "从已存 Dev Ledger record 生成，不依赖 UI 重新拼字段。"
  });
  assert(handoffFromRecord.ok, "Stored record should prepare handoff by id", handoffFromRecord);
  assert(handoffFromRecord.handoff.includes("Codex"), "Stored record handoff should include target agent", handoffFromRecord);

  const handoffTransition = helper.transitionHelperRecord(adapter, appendResult.record.id, "handoff", {
    note: "准备交给 Agent 执行。",
    tags: ["handoff"]
  });
  assert(handoffTransition.ok && handoffTransition.record.stage === "agent-handoff", "Handoff transition should update stage", handoffTransition);
  assert(handoffTransition.ok && handoffTransition.record.status === "ready", "Handoff transition should set ready status", handoffTransition);
  assert(handoffTransition.ok && handoffTransition.record.tags.includes("handoff"), "Transition should merge tags", handoffTransition);

  const failedTransition = helper.transitionHelperRecord(adapter, appendResult.record.id, "fail", {
    note: "用户验收打回，等待复验。"
  });
  assert(failedTransition.ok && failedTransition.record.stage === "retest", "Failed acceptance should move to retest", failedTransition);
  assert(failedTransition.ok && failedTransition.record.status === "failed", "Failed acceptance should mark failed", failedTransition);

  const passedTransition = helper.transitionHelperRecord(adapter, appendResult.record.id, "pass", {
    note: "复验通过。"
  });
  assert(passedTransition.ok && passedTransition.record.stage === "done", "Passed record should move to done", passedTransition);
  assert(passedTransition.ok && passedTransition.record.status === "passed", "Passed record should mark passed", passedTransition);

  const archiveTransition = helper.archiveHelperRecord(adapter, appendResult.record.id, "阶段记录归档。");
  assert(archiveTransition.ok && archiveTransition.record.status === "archived", "Archive helper should mark record archived", archiveTransition);

  const project = helper.upsertHelperProject(adapter, {
    title: "Meowdesk",
    projectId: "project:meowdesk"
  });
  const projectUpdate = helper.upsertHelperProject(adapter, {
    title: "Meowdesk Project",
    projectId: "project:meowdesk",
    summary: "Updated display title."
  });
  const subproject = helper.upsertHelperSubproject(adapter, {
    title: "Helper",
    projectId: "project:meowdesk",
    subprojectId: "subproject:helper"
  });
  const category = helper.upsertHelperCategory(adapter, {
    title: "视觉调整",
    projectId: "project:meowdesk",
    subprojectId: "subproject:helper",
    categoryId: "category:ui",
    categoryKind: "ui-visual"
  });
  assert(project.created, "Project classification should be created on first upsert", project);
  assert(!projectUpdate.created && projectUpdate.record.title === "Meowdesk Project", "Project classification should update on second upsert", projectUpdate);
  assert(subproject.record.parentId === "project:meowdesk", "Subproject should link back to project", subproject);
  assert(category.record.categoryKind === "ui-visual", "Category classification should keep category kind", category);
  assert(helper.helperClassificationRecords(adapter).length === 3, "Classification records should expose project/subproject/category only", helper.helperClassificationRecords(adapter));

  const fixture = helper.createHelperDevLedgerFixture(() => 1800000000000);
  assert(fixture.adapter.read().length === 4, "Helper fixture should seed classification records and one task record", fixture.adapter.read());

  const fakeStorage = new Map();
  const storage = {
    getItem(key) {
      return fakeStorage.has(key) ? fakeStorage.get(key) : null;
    },
    setItem(key, value) {
      fakeStorage.set(key, value);
    }
  };
  const persistentAdapter = devLedger.createDevLedgerAdapter(devLedger.createLocalStorageDevLedgerStore(storage, "helper-test", () => 1900000000000));
  const persistentRecord = helper.appendHelperRecord(persistentAdapter, {
    title: "持久化测试",
    projectId: "project:meowdesk",
    categoryKind: "bug",
    userText: "记录应该落到注入 storage。",
    expectedOutcome: "重新创建 adapter 后仍能读到。"
  });
  assert(persistentRecord.ok, "Persistent adapter should append helper record", persistentRecord);
  const restoredAdapter = devLedger.createDevLedgerAdapter(devLedger.createLocalStorageDevLedgerStore(storage, "helper-test"));
  const restoredRecords = restoredAdapter.query({ searchText: "持久化测试" });
  assert(restoredRecords.length === 1, "Local storage adapter should restore records across adapters", restoredRecords);

  const longText = "x".repeat(devLedger.DEV_LEDGER_TEXT_LIMITS.summary + 500);
  const longRefUri = `file:///tmp/${"very-long-path-".repeat(80)}`;
  const thinRecord = persistentAdapter.append({
    kind: "evidence",
    title: `${"长标题".repeat(120)}`,
    projectId: "project:meowdesk",
    status: "open",
    summary: longText,
    tags: Array.from({ length: 60 }, (_, index) => `tag-${index}-${"x".repeat(80)}`),
    refs: Array.from({ length: 30 }, (_, index) => ({
      kind: "evidence",
      id: `evidence-${index}`,
      label: "截图证据".repeat(80),
      uri: longRefUri
    })),
    source: "helper"
  });
  assert(thinRecord.title.length <= devLedger.DEV_LEDGER_TEXT_LIMITS.title, "Dev Ledger should trim long titles", thinRecord.title.length);
  assert(thinRecord.summary.length === devLedger.DEV_LEDGER_TEXT_LIMITS.summary, "Dev Ledger should trim large summaries", thinRecord.summary.length);
  assert(thinRecord.tags.length === devLedger.DEV_LEDGER_TEXT_LIMITS.tags, "Dev Ledger should cap tags", thinRecord.tags.length);
  assert(thinRecord.tags.every((tag) => tag.length <= devLedger.DEV_LEDGER_TEXT_LIMITS.tag), "Dev Ledger should trim tag text", thinRecord.tags);
  assert(thinRecord.refs.length === devLedger.DEV_LEDGER_TEXT_LIMITS.refs, "Dev Ledger should cap stable refs", thinRecord.refs.length);
  assert(thinRecord.refs.every((ref) => (ref.label || "").length <= devLedger.DEV_LEDGER_TEXT_LIMITS.refLabel), "Dev Ledger should trim ref labels", thinRecord.refs);
  assert(thinRecord.refs.every((ref) => (ref.uri || "").length <= devLedger.DEV_LEDGER_TEXT_LIMITS.refUri), "Dev Ledger should trim ref URIs", thinRecord.refs);

  assertSourceDoesNotContainRuntimeOwnership();
  assertHelperDoesNotOwnStorage();

  console.log(JSON.stringify({
    ok: true,
    helperPages: helper.helperInternalPages.length,
    records: adapter.read().length,
    handoffSections: (handoff.match(/^## /gm) || []).length
  }));
}

main();

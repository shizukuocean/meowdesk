const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");
const productShellModelPath = path.join(
  repoRoot,
  "src",
  "renderer-app",
  "src",
  "features",
  "product-shell",
  "product-shell-model.ts"
);

function loadProductShellModel() {
  const source = fs.readFileSync(productShellModelPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
    }
  });
  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    require(id) {
      throw new Error(`Product Shell model should not require runtime modules during contract test: ${id}`);
    }
  };
  vm.runInNewContext(transpiled.outputText, context, {
    filename: productShellModelPath,
    displayErrors: true
  });
  return module.exports;
}

function surface(routeId, title, status) {
  return {
    id: `surface:route:${routeId}`,
    surfaceId: `surface:route:${routeId}`,
    routeId,
    title,
    owner: "open-surface-registry",
    status,
    projectId: "project:local-workbench"
  };
}

function runtimeAttachment(routeId, runtimeKey) {
  return {
    routeId,
    routeSurfaceId: `surface:route:${routeId}`,
    routeSurfaceStatus: "detached",
    title: routeId,
    owner: "runtime-surface-attachments",
    sourceOwner: "agent-runtime-manager",
    runtimes: [{
      id: `runtime:${runtimeKey}`,
      runtimeId: `runtime:${runtimeKey}`,
      runtimeKey,
      status: "running",
      attachStatus: "reattachable",
      reattachable: true
    }],
    runtimeIds: [`runtime:${runtimeKey}`],
    primaryRuntimeId: `runtime:${runtimeKey}`,
    primaryRuntimeKey: runtimeKey,
    runtimeCount: 1,
    reattachableRuntimeCount: 1,
    hasRunningRuntime: true,
    attachMode: "runtime-reattach"
  };
}

function runtimeSurfaceAttachments(routeAttachments) {
  return {
    owner: "runtime-surface-attachments",
    sourceOwners: {
      openSurface: "open-surface-registry",
      runtime: "agent-runtime-manager"
    },
    routeAttachments,
    byRouteId: Object.fromEntries(routeAttachments.map((attachment) => [attachment.routeId, attachment])),
    bySurfaceId: Object.fromEntries(routeAttachments.map((attachment) => [attachment.routeSurfaceId, attachment])),
    orphanRuntimes: [],
    counts: {
      routes: routeAttachments.length,
      runtimes: routeAttachments.reduce((total, attachment) => total + attachment.runtimeCount, 0),
      runningRuntimes: routeAttachments.length,
      reattachableRuntimes: routeAttachments.reduce((total, attachment) => total + attachment.reattachableRuntimeCount, 0),
      orphanRuntimes: 0
    }
  };
}

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ""}`);
  }
}

function main() {
  const {
    createProductShellProjection,
    productShellRouteKindForRouteId,
    productShellTabPolicyForRouteId
  } = loadProductShellModel();
  assert(typeof createProductShellProjection === "function", "Missing createProductShellProjection export");
  assert(typeof productShellRouteKindForRouteId === "function", "Missing productShellRouteKindForRouteId export");
  assert(typeof productShellTabPolicyForRouteId === "function", "Missing productShellTabPolicyForRouteId export");
  assert(productShellRouteKindForRouteId("workspace") === "workspace", "Workspace route kind mismatch");
  assert(productShellRouteKindForRouteId("studio") === "studio", "Studio route kind mismatch");
  assert(productShellRouteKindForRouteId("conversations") === "conversation", "Conversations route kind mismatch");
  assert(productShellRouteKindForRouteId("feature:smoke") === "feature-page", "Feature route kind mismatch");
  assert(productShellRouteKindForRouteId("tasks") === "core-route", "Core route kind mismatch");
  assert(productShellTabPolicyForRouteId("workspace") === "surface", "Workspace tab policy mismatch");
  assert(productShellTabPolicyForRouteId("studio") === "surface", "Studio tab policy mismatch");
  assert(productShellTabPolicyForRouteId("tasks") === "ephemeral", "Tasks should not become a Meow Tab by default");
  assert(productShellTabPolicyForRouteId("feature:smoke") === "ephemeral", "Feature pages should stay ephemeral by default");

  const workspace = surface("workspace", "工作区", "detached");
  const studio = surface("studio", "工坊", "active");
  const tasks = surface("tasks", "任务中心", "active");
  const conversations = surface("conversations", "对话管理", "closed");
  const registry = {
    surfaces: [workspace, studio, tasks, conversations],
    activeSurface: studio,
    mountedSurfaces: [workspace, studio, tasks],
    detachedSurfaces: [workspace],
    bySurfaceId: {
      [workspace.id]: workspace,
      [studio.id]: studio,
      [tasks.id]: tasks,
      [conversations.id]: conversations
    },
    byRouteId: {
      workspace,
      studio,
      tasks,
      conversations
    }
  };
  const routeInputs = [
    { id: "lobby", label: "大厅", kind: "core-route", priority: 0, sidebarPlacement: "core" },
    { id: "studio", label: "工坊", kind: "studio", priority: 20, sidebarPlacement: "core", tabPolicy: "surface" },
    { id: "workspace", label: "工作区", kind: "workspace", priority: 10, sidebarPlacement: "core", tabPolicy: "surface" },
    { id: "tasks", label: "任务中心", kind: "core-route", priority: 25, sidebarPlacement: "pinned", tabPolicy: "ephemeral" },
    { id: "conversations", label: "对话管理", kind: "conversation", priority: 30, sidebarPlacement: "box-only", tabPolicy: "ephemeral" },
    { id: "feature:smoke", label: "Smoke Feature", kind: "feature-page", priority: 40, launchable: false },
    { id: "", label: "Empty route", priority: 50 }
  ];
  const projection = createProductShellProjection({
    openSurfaceRegistry: registry,
    routes: routeInputs,
    boxes: [
      { id: "daily", title: "Daily Box", itemRouteIds: ["conversations", "tasks", "workspace", "feature:smoke", "conversations"] },
      { id: "overflow", title: "Overflow Box", itemRouteIds: ["feature:smoke", "missing-route"] }
    ]
  });

  assert(projection.owner === "product-shell", "Projection must stay owned by product-shell", projection);
  assert(projection.sourceOwner === "open-surface-registry", "Projection must cite Open Surface as source owner", projection);
  assert(projection.runtimeSourceOwner === "none", "Projection should not invent runtime source without attachment input", projection);
  assert(projection.activeSurfaceId === "surface:route:studio", "Projection active surface mismatch", projection);
  assert(projection.counts.open === 2, "Open tab count mismatch", projection.counts);
  assert(projection.counts.detached === 1, "Detached count mismatch", projection.counts);
  assert(projection.counts.launchable === 5, "Launchable count mismatch", projection.counts);
  assert(projection.counts.pinned === 1, "Pinned count mismatch", projection.counts);
  assert(projection.counts.runtimes === 0 && projection.counts.reattachableRuntimes === 0, "Runtime counts should default to zero", projection.counts);

  assert(
    projection.openTabs.map((tab) => `${tab.routeId}:${tab.status}:${tab.active}`).join("|") === "workspace:detached:false|studio:active:true",
    "Open tabs should preserve mounted surface order and filter ephemeral pages",
    projection.openTabs
  );
  assert(
    projection.openTabs.every((tab) => tab.closable === true && tab.closeMode === "detach-only"),
    "Surface tabs should expose the detach-only close contract",
    projection.openTabs
  );
  assert(!projection.openTabs.some((tab) => tab.routeId === "tasks"), "Ephemeral task route must not become an open tab", projection.openTabs);
  assert(
    projection.launchItems.map((item) => item.routeId).join("|") === "lobby|workspace|studio|tasks|conversations|feature:smoke",
    "Launch items should use normalized route priority and omit blank routes",
    projection.launchItems
  );
  assert(
    projection.sidebarCoreItems.map((item) => item.routeId).join("|") === "lobby|workspace|studio",
    "Sidebar core items should stay limited to the core product routes",
    projection.sidebarCoreItems
  );
  assert(
    projection.sidebarPinnedItems.map((item) => item.routeId).join("|") === "tasks",
    "Sidebar pinned items should be separately projected",
    projection.sidebarPinnedItems
  );
  assert(
    projection.meowBoxes[0]?.itemRouteIds.join("|") === "",
    "Default Meow Box should contain only unassigned box-only items (core, pinned, and user-box items must not duplicate into the box)",
    projection.meowBoxes
  );
  assert(
    projection.meowBoxes.map((box) => `${box.id}:${box.defaultBox}:${box.itemRouteIds.join(",")}`).join("|") === "default:true:|daily:false:conversations,feature:smoke|overflow:false:",
    "User Meow Boxes should own only valid box-only routes once, preserving single ownership",
    projection.meowBoxes
  );
  assert(
    !projection.meowBoxes[0]?.itemRouteIds.some((id) => ["lobby", "workspace", "studio"].includes(id)),
    "Core routes must never appear in the default Meow Box",
    projection.meowBoxes
  );
  assert(
    !projection.meowBoxes[0]?.itemRouteIds.includes("tasks"),
    "Pinned items must not appear in the default Meow Box",
    projection.meowBoxes
  );
  assert(
    !projection.meowBoxes.some((box) => box.itemRouteIds.includes("tasks") || box.itemRouteIds.includes("workspace")),
    "Pinned and core items must not be assignable to user-created Meow Boxes",
    projection.meowBoxes
  );

  const workspaceLaunch = projection.launchItems.find((item) => item.routeId === "workspace");
  const studioLaunch = projection.launchItems.find((item) => item.routeId === "studio");
  const tasksLaunch = projection.launchItems.find((item) => item.routeId === "tasks");
  const conversationsLaunch = projection.launchItems.find((item) => item.routeId === "conversations");
  const featureLaunch = projection.launchItems.find((item) => item.routeId === "feature:smoke");
  assert(workspaceLaunch?.mounted === true && workspaceLaunch.active === false && workspaceLaunch.locked === true, "Detached workspace should be mounted core item but inactive", workspaceLaunch);
  assert(studioLaunch?.mounted === true && studioLaunch.active === true && studioLaunch.locked === true, "Active studio should be mounted core item and active", studioLaunch);
  assert(tasksLaunch?.mounted === true && tasksLaunch.active === true && tasksLaunch.pinned === true && tasksLaunch.tabPolicy === "ephemeral", "Pinned task launch should not imply a Meow Tab", tasksLaunch);
  assert(conversationsLaunch?.mounted === false && conversationsLaunch.active === false, "Closed conversations route should not be mounted", conversationsLaunch);
  assert(featureLaunch?.launchable === false && featureLaunch.locked === false && featureLaunch.pinned === false, "Disabled feature route should stay non-launchable and box-only", featureLaunch);
  assert(conversationsLaunch?.boxId === "daily" && conversationsLaunch.boxTitle === "Daily Box", "Launch items should expose user Box ownership", conversationsLaunch);
  assert(featureLaunch?.boxId === "daily", "Duplicate user Box assignments should keep the first owning Box", featureLaunch);

  const runtimeAwareProjection = createProductShellProjection({
    openSurfaceRegistry: {
      surfaces: [],
      activeSurface: null,
      mountedSurfaces: [],
      detachedSurfaces: [],
      bySurfaceId: {},
      byRouteId: {}
    },
    routes: routeInputs,
    runtimeSurfaceAttachments: runtimeSurfaceAttachments([
      runtimeAttachment("workspace", "workspace-live")
    ])
  });
  const runtimeTab = runtimeAwareProjection.openTabs.find((tab) => tab.routeId === "workspace");
  const runtimeLaunch = runtimeAwareProjection.launchItems.find((item) => item.routeId === "workspace");
  assert(runtimeAwareProjection.runtimeSourceOwner === "runtime-surface-attachments", "Runtime-aware projection should cite attachment owner", runtimeAwareProjection);
  assert(runtimeAwareProjection.counts.runtimes === 1 && runtimeAwareProjection.counts.reattachableRuntimes === 1, "Runtime-aware counts mismatch", runtimeAwareProjection.counts);
  assert(runtimeTab?.attachMode === "runtime-reattach", "Live runtime should create a reattach tab even when route is not mounted", runtimeTab);
  assert(runtimeTab?.primaryRuntimeKey === "workspace-live" && runtimeTab.reattachableRuntimeCount === 1, "Runtime tab should expose primary runtime descriptor fields", runtimeTab);
  assert(runtimeTab?.closable === true && runtimeTab.closeMode === "detach-only", "Runtime reattach tab should expose the modeled close/stop affordance", runtimeTab);
  assert(runtimeLaunch?.attachMode === "runtime-reattach" && runtimeLaunch.primaryRuntimeKey === "workspace-live", "Launch item should stay runtime-aware without owning lifecycle", runtimeLaunch);

  console.log(JSON.stringify({
    ok: true,
    owner: projection.owner,
    openTabs: projection.openTabs.length,
    launchItems: projection.launchItems.length,
    activeSurfaceId: projection.activeSurfaceId
  }));
}

main();

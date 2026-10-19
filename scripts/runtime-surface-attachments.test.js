const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");
const attachmentsPath = path.join(
  repoRoot,
  "src",
  "renderer-app",
  "src",
  "features",
  "open-surface",
  "open-surface-runtime-attachments.ts"
);

function loadRuntimeSurfaceAttachments() {
  const source = fs.readFileSync(attachmentsPath, "utf8");
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
      throw new Error(`Runtime surface attachment contract should not require runtime modules: ${id}`);
    }
  };
  vm.runInNewContext(transpiled.outputText, context, {
    filename: attachmentsPath,
    displayErrors: true
  });
  return module.exports;
}

function routeSurface(routeId, status = "detached") {
  return {
    id: `surface:route:${routeId}`,
    surfaceId: `surface:route:${routeId}`,
    kind: "route",
    routeId,
    title: routeId,
    owner: "open-surface-registry",
    status
  };
}

function runtime(overrides) {
  return {
    id: overrides.runtimeId || overrides.runtimeKey,
    runtimeId: overrides.runtimeId || `runtime:${overrides.runtimeKey}`,
    runtimeKey: overrides.runtimeKey,
    sessionKey: overrides.runtimeKey,
    sessionId: overrides.sessionId || `session:${overrides.runtimeKey}`,
    surfaceId: overrides.surfaceId,
    conversationId: overrides.conversationId || `conversation:${overrides.runtimeKey}`,
    agentId: overrides.agentId || "agent:claude",
    sourceId: overrides.sourceId || `source:${overrides.runtimeKey}`,
    projectId: "project:local-workbench",
    toolId: overrides.toolId || "claude",
    owner: "agent-runtime-manager",
    status: overrides.status || "running",
    attachStatus: overrides.attachStatus || "reattachable",
    startedAt: overrides.startedAt || 1000
  };
}

function registry() {
  const workspace = routeSurface("workspace", "detached");
  const studio = routeSurface("studio", "active");
  return {
    surfaces: [workspace, studio],
    activeSurface: studio,
    mountedSurfaces: [workspace, studio],
    detachedSurfaces: [workspace],
    bySurfaceId: {
      [workspace.id]: workspace,
      [studio.id]: studio
    },
    byRouteId: {
      workspace,
      studio
    }
  };
}

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ""}`);
  }
}

function main() {
  const { createRuntimeSurfaceAttachmentSnapshot } = loadRuntimeSurfaceAttachments();
  assert(typeof createRuntimeSurfaceAttachmentSnapshot === "function", "Missing createRuntimeSurfaceAttachmentSnapshot export");

  const snapshot = createRuntimeSurfaceAttachmentSnapshot({
    openSurfaceRegistry: registry(),
    runtimes: [
      runtime({
        runtimeKey: "workspace-claude",
        surfaceId: "surface:workspace-pane:agent-left",
        startedAt: 4000
      }),
      runtime({
        runtimeKey: "workspace-exited",
        surfaceId: "surface:workspace-pane:agent-right",
        status: "exited",
        attachStatus: "unavailable",
        startedAt: 5000
      }),
      runtime({
        runtimeKey: "studio-hermes",
        surfaceId: "surface:studio-agent:workshop-agent",
        toolId: "hermes",
        startedAt: 3000
      }),
      runtime({
        runtimeKey: "unknown",
        surfaceId: "surface:unknown:loose"
      })
    ]
  });

  assert(snapshot.owner === "runtime-surface-attachments", "Snapshot owner mismatch", snapshot);
  assert(snapshot.sourceOwners.runtime === "agent-runtime-manager", "Runtime source owner mismatch", snapshot);
  assert(snapshot.counts.runtimes === 3, "Known runtime count mismatch", snapshot.counts);
  assert(snapshot.counts.reattachableRuntimes === 2, "Reattachable runtime count mismatch", snapshot.counts);
  assert(snapshot.counts.orphanRuntimes === 1, "Unknown runtime must stay orphaned", snapshot.counts);

  const workspace = snapshot.byRouteId.workspace;
  const studio = snapshot.byRouteId.studio;
  assert(workspace.runtimeCount === 2, "Workspace should receive workspace-pane runtimes", workspace);
  assert(workspace.reattachableRuntimeCount === 1, "Exited workspace runtime must not be reattachable", workspace);
  assert(workspace.primaryRuntimeKey === "workspace-claude", "Primary runtime should prefer reattachable running runtime", workspace);
  assert(workspace.attachMode === "runtime-reattach", "Workspace route should become a runtime reattach target", workspace);
  assert(studio.runtimeCount === 1 && studio.primaryRuntimeKey === "studio-hermes", "Studio-agent runtime should map to studio route", studio);
  assert(!snapshot.byRouteId.unknown, "Unknown surface must not create a route attachment", snapshot.byRouteId);

  const syntheticSnapshot = createRuntimeSurfaceAttachmentSnapshot({
    openSurfaceRegistry: {
      surfaces: [],
      activeSurface: null,
      mountedSurfaces: [],
      detachedSurfaces: [],
      bySurfaceId: {},
      byRouteId: {}
    },
    runtimes: [
      runtime({
        runtimeKey: "workspace-live-after-reload",
        surfaceId: "surface:workspace-pane:agent-left"
      })
    ]
  });
  assert(
    syntheticSnapshot.byRouteId.workspace.routeSurfaceStatus === "detached",
    "Live runtime should synthesize a detached route surface when route is not mounted",
    syntheticSnapshot.byRouteId.workspace
  );

  console.log(JSON.stringify({
    ok: true,
    routes: snapshot.counts.routes,
    runtimes: snapshot.counts.runtimes,
    orphanRuntimes: snapshot.counts.orphanRuntimes
  }));
}

main();

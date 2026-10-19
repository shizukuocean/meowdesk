const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");
const contractPath = path.join(
  repoRoot,
  "src",
  "renderer-app",
  "src",
  "features",
  "conversations",
  "conversation-recovery-contract.ts"
);

function loadConversationRecoveryContract() {
  const source = fs.readFileSync(contractPath, "utf8");
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
      throw new Error(`Conversation recovery contract should not require runtime modules: ${id}`);
    }
  };
  vm.runInNewContext(transpiled.outputText, context, {
    filename: contractPath,
    displayErrors: true
  });
  return module.exports;
}

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ""}`);
  }
}

function runtimeAttachment(routeId, conversationId, reattachableRuntimeCount = 1) {
  return {
    routeId,
    routeSurfaceId: `surface:route:${routeId}`,
    routeSurfaceStatus: "detached",
    title: routeId,
    owner: "runtime-surface-attachments",
    sourceOwner: "agent-runtime-manager",
    runtimes: [{
      id: `${routeId}-runtime`,
      runtimeId: `runtime:${routeId}`,
      runtimeKey: `${routeId}-runtime`,
      conversationId,
      status: "running",
      attachStatus: "reattachable",
      reattachable: reattachableRuntimeCount > 0
    }],
    runtimeIds: [`runtime:${routeId}`],
    primaryRuntimeId: `runtime:${routeId}`,
    primaryRuntimeKey: `${routeId}-runtime`,
    runtimeCount: 1,
    reattachableRuntimeCount,
    hasRunningRuntime: true,
    attachMode: reattachableRuntimeCount ? "runtime-reattach" : "route-only"
  };
}

function snapshot(routeAttachments) {
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

function main() {
  const { createConversationRecoveryDescriptor } = loadConversationRecoveryContract();
  assert(typeof createConversationRecoveryDescriptor === "function", "Missing createConversationRecoveryDescriptor export");

  const live = createConversationRecoveryDescriptor({
    conversation: { id: "workspace-pane:left:left" },
    runtimeSurfaceAttachments: snapshot([
      runtimeAttachment("workspace", "conversation:workspace-pane:left:left"),
      runtimeAttachment("studio", "conversation:studio-agent:workshop-agent:other")
    ])
  });
  assert(live.owner === "conversation-recovery", "Conversation recovery owner mismatch", live);
  assert(live.mode === "live-runtime", "Matching live runtime should enable live-runtime mode", live);
  assert(live.coldPreviewOnly === false, "Live runtime should not be cold preview only", live);
  assert(live.liveRouteIds.join("|") === "workspace", "Live route ids should only include matching conversation runtimes", live);
  assert(live.targetRoutes.join("|") === "workspace", "Live target route mismatch", live);
  assert(live.reattachableRuntimeCount === 1, "Reattachable count mismatch", live);

  const cold = createConversationRecoveryDescriptor({
    conversation: { id: "old-chat" },
    runtimeSurfaceAttachments: snapshot([
      runtimeAttachment("workspace", "conversation:other-chat")
    ])
  });
  assert(cold.mode === "cold-preview", "Unmatched conversation should remain cold-preview", cold);
  assert(cold.coldPreviewOnly === true, "Cold conversation should stay preview-only", cold);
  assert(cold.targetRoutes.join("|") === "workspace|studio", "Cold target routes should remain explicit future targets", cold);

  console.log(JSON.stringify({
    ok: true,
    liveMode: live.mode,
    coldMode: cold.mode
  }));
}

main();

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");

const sourceFiles = [
  "src/renderer-app/src/app/App.tsx",
  "src/renderer-app/src/lib/theme-tokens.ts",
  "src/renderer-app/src/features/workspace/workspace-model.ts",
  "src/renderer-app/src/features/studio/studio-model.ts",
  "src/renderer-app/src/features/lobby/lobby-route.tsx",
  "src/renderer-app/src/features/dev-ledger/dev-ledger-core.ts"
];

const homeBackedKeys = new Map([
  ["meowdesk.theme", "theme"],
  ["meowdesk.workspace.slotCount.v3", "workspaceShell"],
  ["meowdesk.workspace.enabledFeaturePages.v1", "workspaceExtensions"],
  ["meowdesk.workspace.enabledSidebarWidgets.v2", "workspaceExtensions"],
  ["meowdesk.workspace.sidebarWidth", "workspaceShell"],
  ["meowdesk.workspace.boardHeight", "workspaceShell"],
  ["meowdesk.workspace.petHeight", "workspaceShell"],
  ["meowdesk.workspace.petPositions", "workspaceShell"],
  ["meowdesk.workspace.configuredPanes.v3", "workspaceLayout"],
  ["meowdesk.workspace.paneOrder.v1", "workspaceLayout"],
  ["meowdesk.workspace.sidebarWidgetHeights", "workspaceLayout"],
  ["meowdesk.productShell.sidebarPins.v1", "productShell"],
  ["meowdesk.productShell.boxes.v1", "productShell"],
  ["meowdesk.studio.removedWorkshopProjects.v1", "studioState"],
  ["meowdesk.studio.projectExportRecords.v1", "studioPublish"],
  ["meowdesk.studio.projectPublishDrafts.v1", "studioPublish"],
  ["meowdesk.studio.projectPublishRecords.v1", "studioPublish"]
]);

const homeBackedReservedKeys = new Map([
  ["meowdesk.themePreset.v1", "themePreset"]
]);

const helperDeferredKeys = new Set([
  "meowdesk.devLedger.records.v1"
]);

const allowedStorageEventUsages = new Map([
  ["src/renderer-app/src/app/App.tsx", 2],
  ["src/renderer-app/src/features/studio/studio-route.tsx", 6]
]);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ""}`);
  }
}

function extractMeowdeskLocalStorageKeys(source) {
  const keys = new Set();
  for (const match of source.matchAll(/["'](meowdesk\.[^"']+)["']/g)) {
    keys.add(match[1]);
  }
  return keys;
}

function meodeskStorageMapKeys(source) {
  const mapStart = source.indexOf("const MEODESK_STORAGE_FILE_MAP = {");
  const mapEnd = source.indexOf("\n};", mapStart);
  assert(mapStart >= 0 && mapEnd > mapStart, "Unable to locate MEODESK_STORAGE_FILE_MAP");
  const mapSource = source.slice(mapStart, mapEnd);
  return new Set([...mapSource.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*):\s*\[/gm)].map((match) => match[1]));
}

function loadWorkbenchApi() {
  const sourcePath = path.join(repoRoot, "src", "renderer-app", "src", "lib", "workbench-api.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
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
    console,
    require(id) {
      if (id === "./identity") {
        return {
          createOwnershipId: (...parts) => parts.filter(Boolean).join(":"),
          normalizeOwnershipScope: (scope) => scope || {}
        };
      }
      throw new Error(`Unexpected workbench-api dependency in data ownership test: ${id}`);
    }
  };
  vm.runInNewContext(transpiled.outputText, context, {
    filename: sourcePath,
    displayErrors: true
  });
  return { api: module.exports, context };
}

function createLocalStorageMock() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
    dump() {
      return Object.fromEntries(values);
    }
  };
}

async function runHomeBackedStorageBehaviorTest() {
  const { api, context } = loadWorkbenchApi();
  const storageFiles = new Map();
  const localStorage = createLocalStorageMock();
  context.window = {
    localStorage,
    workbench: {
      async readStorage(key) {
        if (!storageFiles.has(key)) return { ok: true, exists: false, key, value: null };
        return { ok: true, exists: true, key, value: storageFiles.get(key) };
      },
      async writeStorage(key, value) {
        storageFiles.set(key, value);
        return { ok: true, key };
      }
    }
  };

  const slotOptions = {
    storageKey: "meowdesk.workspace.slotCount.v3",
    homeKey: "workspaceShell",
    fieldKey: "meowdesk.workspace.slotCount.v3",
    fallback: 1,
    validate: (value) => {
      const number = Number(value);
      return [1, 2, 3, 4, 5, 6].includes(number) ? number : 1;
    }
  };
  const sidebarOptions = {
    storageKey: "meowdesk.workspace.sidebarWidth",
    homeKey: "workspaceShell",
    fieldKey: "meowdesk.workspace.sidebarWidth",
    fallback: 320,
    validate: (value) => Number(value) || 320
  };

  localStorage.setItem(slotOptions.storageKey, "3");
  const seededValue = await api.readHomeBackedStorage(slotOptions);
  assert(seededValue === 3, "Home missing field should hydrate from legacy localStorage cache", { seededValue });
  assert(storageFiles.get("workspaceShell")?.[slotOptions.fieldKey] === 3, "Legacy localStorage value should seed Home storage when Home is missing", storageFiles.get("workspaceShell"));

  storageFiles.set("workspaceShell", {
    [slotOptions.fieldKey]: 5,
    untouched: "keep"
  });
  const homeValue = await api.readHomeBackedStorage(slotOptions);
  assert(homeValue === 5, "Home value should win over renderer cache once present", { homeValue, localStorage: localStorage.dump() });
  assert(localStorage.getItem(slotOptions.storageKey) === "5", "Home read should refresh renderer cache", localStorage.dump());

  api.writeHomeBackedStorageCache(sidebarOptions, 420);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const workspaceShell = storageFiles.get("workspaceShell");
  assert(workspaceShell?.[slotOptions.fieldKey] === 5, "Field writes must preserve sibling Home fields", workspaceShell);
  assert(workspaceShell?.[sidebarOptions.fieldKey] === 420, "Field writes should store the changed key in Home", workspaceShell);

  await Promise.all([
    api.writeHomeBackedStorage(slotOptions, 2),
    api.writeHomeBackedStorage(sidebarOptions, 500)
  ]);
  const queuedWorkspaceShell = storageFiles.get("workspaceShell");
  assert(queuedWorkspaceShell?.[slotOptions.fieldKey] === 2, "Queued same-file writes should keep the slot field", queuedWorkspaceShell);
  assert(queuedWorkspaceShell?.[sidebarOptions.fieldKey] === 500, "Queued same-file writes should keep the sidebar field", queuedWorkspaceShell);
}

async function main() {
  const meodeskHomeSource = read("src/main/meodesk-home-service.js");
  const meodeskHomeKeys = meodeskStorageMapKeys(meodeskHomeSource);
  for (const homeKey of new Set([...homeBackedKeys.values(), ...homeBackedReservedKeys.values()])) {
    assert(meodeskHomeKeys.has(homeKey), "Home-backed localStorage owner key missing from Meodesk Home map", homeKey);
  }

  const findings = [];
  const allClassifiedKeys = new Map([
    ...homeBackedKeys.entries(),
    ...homeBackedReservedKeys.entries(),
    ...[...helperDeferredKeys].map((key) => [key, "helper-deferred"])
  ]);

  for (const relativePath of sourceFiles) {
    const source = read(relativePath);
    const keys = extractMeowdeskLocalStorageKeys(source);
    for (const key of keys) {
      if (!allClassifiedKeys.has(key)) {
        findings.push({ relativePath, key, reason: "unclassified meowdesk localStorage key" });
      }
    }
  }
  assert(!findings.length, "Every meowdesk localStorage key must be classified", findings);

  const workbenchApiSource = read("src/renderer-app/src/lib/workbench-api.ts");
  const packageSource = read("package.json");
  const shellScenariosSource = read("src/main/renderer-smoke-scenarios/shell-scenarios.js");
  assert(workbenchApiSource.includes("export function readHomeBackedStorageCache"), "Missing readHomeBackedStorageCache helper");
  assert(workbenchApiSource.includes("export function writeHomeBackedStorageCache"), "Missing writeHomeBackedStorageCache helper");
  assert(workbenchApiSource.includes("fieldKey?: string"), "Home-backed helper must support fieldKey merge writes");
  assert(packageSource.includes("smoke:renderer:data-ownership"), "verify scripts must expose the data ownership renderer smoke");
  assert(shellScenariosSource.includes("data-ownership-home-backed"), "Renderer smoke must verify Home-backed UI writes");

  const appSource = read("src/renderer-app/src/app/App.tsx");
  const workspaceModelSource = read("src/renderer-app/src/features/workspace/workspace-model.ts");
  const studioModelSource = read("src/renderer-app/src/features/studio/studio-model.ts");
  const themeTokensSource = read("src/renderer-app/src/lib/theme-tokens.ts");
  const lobbySource = read("src/renderer-app/src/features/lobby/lobby-route.tsx");
  const devLedgerSource = read("src/renderer-app/src/features/dev-ledger/dev-ledger-core.ts");

  assert(appSource.includes("hydrateHomeBackedStorage"), "App shell must hydrate Home-backed shell state");
  assert(workspaceModelSource.includes("hydrateWorkspaceModelStorage"), "Workspace model must expose Home hydration");
  assert(studioModelSource.includes("hydrateStudioModelStorage"), "Studio model must expose Home hydration");
  assert(lobbySource.includes("readStudioProjectPublishRecords"), "Lobby publish records must share Studio/Home reader");
  assert(devLedgerSource.includes("createLocalStorageDevLedgerStore"), "DevLedger helper-deferred localStorage adapter should remain explicit");
  assert(workspaceModelSource.includes('workspaceStorageValue("workspaceExtensions", WORKSPACE_ENABLED_SIDEBAR_WIDGETS_STORAGE_KEY'), "Workspace sidebar widget state must merge into workspaceExtensions by fieldKey, not overwrite the whole Home file");
  assert(appSource.includes('topLevelStorageValue("workspaceExtensions", enabledFeaturePagesStorageKey'), "Feature page state must merge into workspaceExtensions by fieldKey");
  assert(studioModelSource.includes('studioStorageValue("workspaceExtensions", studioWorkspaceEnabledSidebarWidgetsStorageKey'), "Studio sidebar widget state must merge into workspaceExtensions by fieldKey");
  assert(studioModelSource.includes('studioStorageValue("workspaceExtensions", studioWorkspaceEnabledFeaturePagesStorageKey'), "Studio feature page state must merge into workspaceExtensions by fieldKey");

  for (const [key, homeKey] of homeBackedKeys) {
    const owners = [appSource, workspaceModelSource, studioModelSource, themeTokensSource].filter((source) => source.includes(key));
    assert(owners.length > 0, "Home-backed key is not declared in renderer owners", key);
    const homeOwnerSources = [appSource, workspaceModelSource, studioModelSource];
    assert(homeOwnerSources.some((source) => source.includes(`"${homeKey}"`)), "Home-backed key is not mapped to expected Home owner", { key, homeKey });
  }

  for (const relativePath of Object.keys(Object.fromEntries(allowedStorageEventUsages))) {
    const source = read(relativePath);
    const expected = allowedStorageEventUsages.get(relativePath);
    const count = (source.match(/["']storage["']/g) || []).length;
    assert(count === expected, "Unexpected storage event listener count", { relativePath, expected, count });
  }

  console.log(JSON.stringify({
    ok: true,
    homeBackedKeys: homeBackedKeys.size,
    reservedHomeBackedKeys: homeBackedReservedKeys.size,
    helperDeferredKeys: helperDeferredKeys.size,
    homeOwners: [...new Set([...homeBackedKeys.values(), ...homeBackedReservedKeys.values()])].sort()
  }));
}

main()
  .then(runHomeBackedStorageBehaviorTest)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

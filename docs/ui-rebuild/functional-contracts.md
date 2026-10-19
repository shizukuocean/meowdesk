# Functional Contracts for UI Rebuild

> These contracts protect current Meowdesk behavior while the renderer is
> rebuilt.

## Principle

The UI may change. Runtime contracts must not break accidentally.

The first rebuild phase should treat existing preload and IPC channels as stable
APIs. New React components should call adapters that wrap `window.workbench`
instead of reaching directly into Electron details.

Current cleanup note: the old `src/renderer/*` UI files are retired in this
worktree. References below to legacy selectors and legacy runtime are historical
or compatibility-oriented. They do not make `MEOWDESK_RENDERER=legacy` a valid
launch path.

## Current Preload API

Defined in:

```text
src/preload.js
```

Exposed object:

```text
window.workbench
```

Important method groups:

| Group | Methods |
|---|---|
| config/storage | `getConfig`, `getStorageInfo`, `readStorage`, `writeStorage`, `deleteStorage` |
| shell/clipboard | `openExternal`, `openPath`, `writeClipboardText`, `readClipboardText` |
| agent interface | `getAgentInterfaceInfo`, `getAgentPresets`, `testToolCommand`, `addUserTool`, `deleteUserTool` |
| workshop | `createWorkshopProject`, `markWorkshopProjectReady`, `exportMeowPackage`, `importMeowPackage` |
| workflow | `saveWorkflowDraft`, `deleteWorkflowDraft`, `dispatchWorkflowTask`, `readWorkflowDrafts` |
| conversations | `mirrorConversation`, `deleteConversationMirror`, `onConversationsChanged` |
| pets | `listPets`, `installPet`, `deletePet` |
| runtime registry | `listAgentRuntimes` |
| terminal | `startTerminal`, `writeTerminal`, `resizeTerminal`, `killTerminal`, `onTerminalData`, `onTerminalExit` |

## Adapter Requirement

Create a renderer-side adapter before migrating runtime-heavy modules:

```text
src/renderer-app/src/lib/workbench-api.ts
```

The adapter should:

- type and wrap `window.workbench`;
- centralize missing-API handling;
- keep component code independent from raw Electron IPC names;
- allow test mocks for UI-only routes.
- preserve cleanup for event subscriptions. `onConversationsChanged`,
  `onTerminalData`, and `onTerminalExit` return unsubscribe functions; legacy
  callers may ignore the return value, but React callers must invoke it during
  effect cleanup.

## Identity / Ownership Contract

Runtime-aware features must carry ownership fields before consuming Agent
output:

```text
runtimeId
sessionId
surfaceId
conversationId
agentId
sourceId
projectId
```

`src/renderer-app/src/lib/identity.ts` owns these field names and descriptor
types. Renderer features should use `OwnershipScope`,
`OpenSurfaceDescriptor`, `AgentRuntimeDescriptor`, and
`MeowViewerBindingDescriptor` instead of inventing route-local identity keys.

## Agent Runtime Registry Contract

The current registry bridge is intentionally narrow:

- `agentRuntime:list` in the main process returns live runtime descriptors.
- `window.workbench.listAgentRuntimes()` exposes that read-only snapshot.
- `listAgentRuntimeDescriptors()` normalizes the raw response in the renderer
  adapter.
- `src/renderer-app/src/features/agent-runtime/agent-runtime-manager.ts` is the
  only renderer feature that should expose `listAgentRuntimes`,
  `findAgentRuntime`, or `reattachAgentRuntime`.

The descriptor contains both ownership ids and the low-level runtime key:

```text
id / runtimeId
runtimeKey
sessionKey
sessionId
surfaceId
conversationId
agentId
sourceId
projectId
status
attachStatus
```

`listAgentRuntimes` is read-only. It must not start, stop, kill, resize, or
write to a terminal. `reattachAgentRuntime` is a live-runtime helper; source
adapter activation must stay explicit so listing or previewing runtimes does
not accidentally trigger Agent output collection.

## Planning Contracts

The non-visual planning contracts now have explicit owners:

- Open Surface registry:
  `src/renderer-app/src/features/open-surface/open-surface-registry.ts`
  describes active, mounted, and detached surface instances. It is not Meow
  Tabs or Product Shell UI. App composition should feed it from the current
  shell route list so every active top-level route has a surface identity,
  while keepalive routes such as Workspace and Studio can become detached.
- Runtime surface attachments:
  `src/renderer-app/src/features/open-surface/open-surface-runtime-attachments.ts`
  maps live Agent Runtime Manager descriptors back to top-level route
  surfaces. It can mark a route as `runtime-reattach`, count live runtimes, and
  preserve orphan runtimes, but it must not execute runtime lifecycle actions.
- Product Shell:
  `src/renderer-app/src/features/product-shell/product-shell-model.ts`
  projects route metadata, the Open Surface registry, and runtime surface
  attachments into Meow Tabs and Meow Box descriptors. It is a consumer layer
  only: it may switch routes through the existing app route handler, but it
  must not start, stop, list, reattach, resize, or write Agent / terminal
  runtimes.
- Conversation recovery:
  `src/renderer-app/src/features/conversations/conversation-recovery-contract.ts`
  separates `live-runtime` reattach affordances from `cold-preview` historical
  mirrors. Cold recovery and history injection remain deferred.
- Dev Ledger Core:
  `src/renderer-app/src/features/dev-ledger/dev-ledger-core.ts` is passive
  storage plus scope filtering. `docs/architecture/dev-ledger-helper-contract.md`
  owns the Helper internal-page contract. Dev Ledger must not scrape route state
  or become a cross-feature god module.
- Helper pre-UI model:
  `src/renderer-app/src/features/helper` owns internal page metadata,
  field-mode normalization, thin Dev Ledger adapter calls, and deterministic
  Agent handoff text. It also owns pure workflow transitions, project /
  subproject / category classification helpers, and deterministic fixtures for
  tests or visual previews. It must not become the routed Helper UI until the
  data contract has tests and owner boundaries in place.
- Theme tokens:
  `src/renderer-app/src/lib/theme-tokens.ts` owns Appearance setting storage
  keys, preset normalization, density, font scale, and semantic token names.
- Locale dictionary:
  `src/renderer-app/src/lib/locale-dictionary.ts` owns locale codes, storage
  key, and label fallback.

## High-Risk Legacy Selectors

The retired renderer depended heavily on DOM ids and delegated `data-*`
selectors.
Do not remove or rename equivalent behavior until the owning module has been
migrated.

Known high-risk areas:

| Area | Legacy selectors / concepts |
|---|---|
| global routes | `setView`, `.view`, `#lobbyView`, `#workspaceView`, `#workflowView`, `#workshopView` |
| profile | `#profileLoginBtn`, `#profileAvatarInput`, `#profileBioSaveBtn`, `#profileTitlePicker` |
| plugin marketplace | `#pluginMarketTabs`, `#pluginMarketList`, plugin detail and author profile handlers |
| task center | `[data-task-center-tab]`, task board render/update functions |
| workflow | `#workflowCanvasSurface`, `#workflowNodeLayer`, `[data-workflow-*]` |
| workshop/studio | `#workshopView`, `[data-workshop-page]`, `[data-workshop-type]`, `[data-workshop-add-agent]`, `[data-workshop-start-agent]`, `[data-workshop-enable-extension]` |
| sidebar widgets | `#workshopSidebarWidgets`, `[data-workshop-sidebar-widget]`, `[data-workshop-widget-resizer]` |
| terminal | terminal host elements, xterm fit lifecycle, terminal id mapping |

## Modules to Avoid in First Pass

Do not use these as the first React migration target:

- xterm terminal lifecycle;
- workflow canvas;
- Agent process management;
- sidebar widget iframe runtime;
- task persistence internals.

These modules have behavior beyond visual layout and should be migrated only
after the shell and sample route are stable.

## Safe First-Pass Targets

Good first targets:

- static AppShell;
- TopNav and route frame;
- theme tokens;
- Lobby visual layout;
- profile mock display shell;
- plugin marketplace card/detail visual shell;
- Studio overview shell without live terminal migration.

## Phase-Two Allowed Workshop Touches

Phase two may read workshop summaries and perform narrow existing workshop
actions only through `window.workbench` and the renderer adapter.

Allowed now:

- `getAgentInterfaceInfo()` for read-only workshop extension summaries;
- `getAgentInterfaceInfo({ forceRefresh: true })` for manual refresh actions;
- `markWorkshopProjectReady({ id })` for marking a known local workshop project
  ready, when covered by hidden Electron smoke tests.

Renderer code should call the typed `markWorkshopProjectReady()` helper from
`src/renderer-app/src/lib/workbench-api.ts` instead of directly treating the raw
IPC response as successful. The helper must validate `ok: true` and `id` before
updating UI state.

Read-only project detail fields may be displayed when already returned by
`getAgentInterfaceInfo()`: `entry`, `runtime`, `path`, `manifestPath`,
`entryPath`, `projectFilePath`, `modifiedAt`, `createdAt`, and `versions`.
Version records are display-only and must not trigger export/import/install
runtime without a separate migration plan.

Broken or invalid manifests returned by `getAgentInterfaceInfo()` may be shown
as read-only error projects. Error projects must not expose mark-ready,
export/import, install, or runtime launch actions until a repair contract exists.

Still not allowed without a separate migration plan:

- moving Agent-assisted workshop creation into React;
- replacing `.meow` import/export runtime;
- moving right-sidebar iframe loading into React;
- changing the Meodesk Home extension manifest schema.

## Phase-Three Allowed Workshop Touches

Phase three may wire the next renderer to existing workshop write contracts
when all calls go through typed adapter helpers and hidden Electron smoke
scenarios use temporary Meodesk Home directories.

Allowed in the first phase-three slice:

- `createWorkshopProject({ name, type, folderName? })` as an empty local
  workshop project scaffold. This creates manifest/docs/version directories but
  does not start an Agent or generate the entry file.
- `exportMeowPackage({ id })` for a known local project with an existing entry
  file. The UI must surface errors when export is blocked by a missing entry or
  package size limits.
- `importMeowPackage({})` from the visible UI, using the existing main-process
  file dialog. Hidden smoke may call `importMeowPackage({ packagePath })` with a
  deterministic fixture to avoid OS dialog automation.

Renderer code must use these helpers from
`src/renderer-app/src/lib/workbench-api.ts`:

- `createWorkshopProject()`;
- `exportMeowPackage()`;
- `importMeowPackage()`;
- `markWorkshopProjectReady()`.

Each helper must validate `ok` and required fields before Studio updates state.

Still deferred:

- Agent-assisted creation and terminal session lifecycle;
- right-sidebar iframe enable/use runtime;
- version switching as an active runtime choice;
- rollback, because no preload/main contract currently restores a snapshot into
  the current project root;
- arbitrary user-entered filesystem paths in renderer UI.

## Runtime Preservation Rules

1. Keep `src/preload.js` compatible until a replacement contract is documented.
2. Keep backups/Git anchors available until the next renderer passes route and
   runtime gates.
3. Do not migrate terminal state and visual shell in the same patch.
4. Do not migrate workflow canvas before the basic route shell has stabilized.
5. Treat right sidebar iframe loading as a runtime contract, not a card style.
6. Keep Meowdesk Home data format stable during phase one.
7. In phase four, the next renderer may show Agent / Terminal / task-center
   boundary state, but React must not own xterm lifecycle until a legacy mount
   contract and smoke coverage exist.
8. In phase five, the next renderer may show right-sidebar iframe and Workflow
   Beta boundary state, but React must not mount iframe widgets or call
   Workflow write/dispatch methods from the boundary panel.
9. In phase six, the next renderer may become the default entry in this
   worktree only after top-level routes are reachable and explicit legacy
   handoff/protected states exist for runtime-heavy features.

## Phase-Four Terminal Descriptor Contract

The next renderer may normalize terminal-like tools into read-only
`TerminalSessionDescriptor` records for display in Studio.

Allowed descriptor fields are descriptive only:

- stable id and display name;
- tool kind, command, args, and cwd;
- owner, status, and mount contract labels.

The descriptor does not grant runtime ownership. React must not call
`startTerminal`, `writeTerminal`, `resizeTerminal`, or `killTerminal` for this
boundary panel. React must not attach, fit, dispose, or recreate xterm. PTY,
stdin/stdout, terminal process kill, and xterm lifecycle remain owned by the
protected runtime until a separate terminal mount contract is implemented and
covered by smoke tests.

Agent / terminal pages should use a single side Inspector for auxiliary
surfaces. Project lists, project details, runtime metadata, terminal descriptors,
and task summaries should not become separate persistent side or bottom panels
that compress the Agent reading area.

## Phase-Five Sidebar / Workflow Descriptor Contract

The next renderer may normalize `getAgentInterfaceInfo().workshopExtensions`
records into read-only `SidebarWidgetRuntimeDescriptor` records when the
manifest declares `type=sidebar-widget` or `target=workspace-sidebar`.

Allowed descriptor fields are descriptive only:

- id, name, version, status, runtime, target, entry, and paths;
- sidebar sizing hints such as min height, preferred height, and resize mode;
- owner, protection, and readiness labels.

The descriptor does not grant iframe ownership. React must not create or
replace the sidebar widget iframe host, resize handler, message bridge, theme
bridge, or widget persistence lifecycle in this phase.

The next renderer may also normalize Workflow Beta drafts from
`readWorkflowDrafts()` / `getAgentInterfaceInfo().workflows` into read-only
`WorkflowBoundaryDescriptor` records.

Allowed descriptor fields are descriptive only:

- id, name, version, source, file path, and file name;
- node and edge counts;
- owner, protection, execution, status, and parse error labels.

The descriptor does not grant Workflow runtime ownership. React must not call
`saveWorkflowDraft`, `deleteWorkflowDraft`, or `dispatchWorkflowTask` from the
boundary panel, and must not replace the Workflow canvas, message bus, task
dispatch, Agent battery, or execution chain.

## Phase-Six Default Entry Contract

The UI rebuild worktree loads the next renderer by default when
`MEOWDESK_RENDERER` is unset. After the cleanup, the legacy renderer is retired
and `MEOWDESK_RENDERER=legacy` is rejected.

Default entry readiness requires top-level next routes for:

- Lobby;
- Studio / workshop;
- plugin marketplace;
- task center;
- Workflow Beta;
- profile center.

Routes may be implemented as one of these states:

- `next`: primary shell is implemented in React;
- `read-only`: adapter reads summaries but does not write runtime state;
- `deferred runtime`: the user-visible entry exists in next, but true writes or
  runtime lifecycle remain behind an older protected service;
- `protected`: the route explains that the runtime is deliberately not owned by
  next yet.

Do not remove preload methods, storage keys, or IPC handlers merely because the
renderer shell changed. Runtime-heavy features must not be silently hidden
because they are not rewritten yet.

Route reachability does not require every non-core route to stay pinned in the
left sidebar. Product Shell smoke checks should use the route/hash contract when
a feature can be opened but is not a permanent sidebar entry.

## Acceptance Checklist

A migrated route is acceptable only when:

- its old user-visible purpose is still present;
- navigation to and from the route works;
- no required preload method is lost;
- `npm run test:workbench-contract` still passes when preload, IPC, or adapter
  boundaries change;
- no storage key migration is required without a separate plan;
- visual design follows `design-system-v1.md`;
- rollback can be performed from a known backup/Git anchor if the next renderer
  fails.

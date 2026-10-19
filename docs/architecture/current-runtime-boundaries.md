# Current Runtime Boundaries

> Status: source of truth after the long tech-debt cleanup on 2026-06-07.
> Scope: renderer ownership, protected runtime services, IPC boundaries, and
> feature-module ownership.

## Renderer Ownership

The React/Vite next renderer is the only normal UI entry in this worktree.

Current paths:

```text
src/renderer-app/index.html
src/renderer-app/src/
dist/renderer-app/
```

Retired paths:

```text
src/renderer/index.html
src/renderer/renderer.js
src/renderer/styles.css
```

`MEOWDESK_RENDERER=legacy` is no longer a rollback path. `src/main/renderer-entry.js`
rejects the retired renderer explicitly so a smoke or manual launch cannot
silently fall back to deleted UI files.

## Protected Runtime Services

Some code and descriptors still use the word `legacy` as a compatibility owner.
That does not mean the legacy renderer is active. It means the next renderer is
calling or describing an older runtime service that has not been fully
reimplemented behind a new owner name yet.

Use these meanings when reading the code:

| Term | Current meaning |
|---|---|
| `next renderer` | The active React renderer. |
| `retired legacy renderer` | Deleted `src/renderer/*` UI files. Not a launch target. |
| `protected runtime` | Existing terminal/sidebar/service behavior that must not be casually rewritten. |
| `deferred runtime` | User-visible route exists, but full runtime ownership is intentionally deferred. |
| `owner: "legacy"` | Compatibility descriptor value; do not rename without updating adapter and smoke contracts together. |

## Current Feature Ownership

| Area | Current owner | Notes |
|---|---|---|
| App shell/routes | `src/renderer-app/src/app` and feature routes | Next renderer owns navigation and page composition. |
| Meow Viewer | `src/renderer-app/src/features/meow-viewer` | Contract/profile types, parser, source, composer, and conversation renderer are no longer owned by readiness. |
| Workspace | `src/renderer-app/src/features/workspace` | Owns workspace panes, terminal host UI, sidebar widgets, Viewer adapter, and `workspace-model.ts` model/storage helpers. |
| Studio/workshop | `src/renderer-app/src/features/studio` plus main workshop service | Owns workshop UI, safe create/import/export/readiness paths, and `studio-model.ts` model/storage helpers. |
| Readiness glue | `src/renderer-app/src/features/readiness` | Should stay as route composition/shared shell helpers, not a feature dumping ground. |
| Conversations | `src/renderer-app/src/features/conversations` plus main conversation service | Reads local conversation mirrors through typed adapter/IPC. |
| Obsidian | `src/renderer-app/src/features/obsidian` plus main Obsidian service | Reads only registered vault markdown files. |
| Tasks/Profile/Plugins | Dedicated feature folders | Must not move implementation back into readiness. |
| Workflow Beta archive | `docs/ui-rebuild/workflow-beta-archive-2026-07-10.md` plus archive branch/tag | No active renderer or main-process owner exists in the MVP baseline. A future revival requires a new product contract and owner map. |
| Identity / ownership contracts | `src/renderer-app/src/lib/identity.ts` | Defines runtime, session, surface, conversation, agent, source, and project identity fields before UI consumers attach to them. |
| Agent runtime manager | `src/renderer-app/src/features/agent-runtime` plus `src/main/terminal-runtime-service.js` | Owns renderer-facing runtime registry descriptors and attach/reattach helpers. Route components must not own process lifetime. |
| Open surface registry | `src/renderer-app/src/features/open-surface` | Describes mounted, active, and detached surface instances from the current shell route list. Runtime surface attachments live here as a read-only bridge from runtime descriptors to route surfaces. It is not a Tabs UI owner. |
| Product Shell / Meow Tabs / Meow Box | `src/renderer-app/src/features/product-shell` plus App top-nav composition | Consumes Open Surface descriptors and route metadata as a read-only projection. It may switch routes, but must not own Agent / terminal lifecycle or copy feature state. |
| Dev Ledger Core / Helper contract | `src/renderer-app/src/features/dev-ledger` plus `docs/architecture/dev-ledger-helper-contract.md` | Passive record storage, Helper internal-page contract, local storage adapter, fixtures, and thin scope adapter only. It must not scrape unrelated feature state. |
| Helper pre-UI model | `src/renderer-app/src/features/helper` | Owns Helper internal-page metadata, field-mode contract, Dev Ledger adapter calls, workflow transitions, classification upserts, fixtures, and Agent handoff text generation. It is not a routed UI yet. |
| Theme / locale contracts | `src/renderer-app/src/lib/theme-tokens.ts` and `src/renderer-app/src/lib/locale-dictionary.ts` | Contract layer for existing Appearance settings and naming. UI polish remains deferred. |

## Main Process Ownership

`src/main.js` is now the main coordinator. New business logic should prefer the
service modules under `src/main/`.

Current service split:

```text
src/main/agent-interface-service.js
src/main/agent-runtime-context-service.js
src/main/agent-runtime-launch-service.js
src/main/command-resolver.js
src/main/conversation-service.js
src/main/meodesk-home-service.js
src/main/obsidian-service.js
src/main/pet-service.js
src/main/renderer-entry.js
src/main/renderer-smoke-runner.js
src/main/renderer-smoke-heavy-scenarios.js
src/main/renderer-smoke-scenarios/
src/main/terminal-runtime-service.js
src/main/terminal-source-adapter-service.js
src/main/workshop-service.js
```

When adding or fixing behavior, prefer:

- IPC payload normalization near the handler/service boundary.
- Filesystem access constrained to Meodesk Home or explicitly registered vaults.
- Service-level helpers over adding another large block to `src/main.js`.
- Runtime prompt/context markdown changes in
  `src/main/agent-runtime-context-service.js`, not in launch/env helpers.
- Contract tests or smoke coverage before widening an IPC method.

## Runtime Rules

- Do not restore the retired renderer files.
- Do not use `MEOWDESK_RENDERER=legacy` as a recovery plan.
- Do not restore desktop embedding, `getDisplayMedia` projection, or raw HWND
  `SetParent`.
- Runtime ownership starts with `runtimeId`, `sessionId`, `surfaceId`,
  `conversationId`, `agentId`, `sourceId`, and `projectId`. If a runtime
  consumer cannot name these fields, it should not attach to Agent output yet.
- `Agent Runtime Manager` is the renderer owner for live runtime registry,
  descriptor lookup, and reattach helpers. Workspace, Studio, and future
  conversation recovery entries may consume it but must not become process
  lifecycle owners.
- `agentRuntime:list` is a read-only descriptor IPC. It must not start, kill,
  resize, or write to a terminal. Reattach helpers are explicit, and source
  adapter activation must remain opt-in.
- Meow Viewer reads scoped output only. It does not own session management,
  runtime registry state, or cold conversation recovery.
- Open Surface descriptors track already-open surface instances. Product Shell,
  Meow Tabs, and Meow Box may consume them as a read-only route/surface
  projection, but must not take runtime lifecycle ownership or copy feature
  state.
- Product Shell smoke scenarios may route to non-core feature pages through the
  route/hash contract. Do not require every feature route to expose a permanent
  left-sidebar `data-next-route` button; the sidebar may stay limited to core or
  user-pinned entries.
- Runtime surface attachments map live `workspace-pane`, `studio-agent`, and
  future conversation runtimes back to route surfaces. This projection only
  describes reattachability; it does not start, stop, kill, resize, or write
  Agent / terminal runtimes.
- Dev Ledger Core is a passive ledger. Keep adapters thin and scoped; do not
  turn it into a global state collector.
- Helper is a future feature-page consumer of Dev Ledger Core. It may organize
  records into internal pages, run pure state transitions, and manage project /
  subproject / category metadata, but it must not own Agent / terminal lifecycle
  or Meow Viewer source collection.
- Do not mount Studio sidebar iframes until message bridge, resize, persistence,
  sandbox, and origin rules are specified.
- Do not restore Workflow Beta route, IPC, service, battery protocol, or smoke
  scripts from the archive into the current MVP baseline.
- Do not put new features into `readiness-routes.tsx`, `renderer-smoke-runner.js`,
  or `main.js` as a shortcut.
- Do not add new hidden smoke scenarios to `renderer-smoke-runner.js`; use the
  domain modules under `src/main/renderer-smoke-scenarios/`.
- Do not re-add route-local copies of pure model/storage helpers that already
  belong to `workspace-model.ts`, `studio-model.ts`, or shared renderer `lib`
  modules.

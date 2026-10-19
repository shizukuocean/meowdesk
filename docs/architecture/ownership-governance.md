# Ownership Governance

> Status: current ownership rules for Engineering Governance Phase 2.
> Scope: where Meowdesk code should live, which files are pressure zones, and
> which shortcuts are forbidden.

## Purpose

This document prevents future work from drifting back into a few oversized
files. It is a routing table for implementation.

Before editing, identify the owner. If the work does not fit an owner, create or
extend the smallest appropriate owner module before adding behavior.

## Renderer Ownership

| Area | Owner | Allowed work | Do not put here |
|---|---|---|---|
| App shell | `src/renderer-app/src/app` | route wiring, shell state, top-level feature composition | feature behavior, parser logic, IPC payload semantics |
| Layout components | `src/renderer-app/src/components/layout` | reusable shell/top-nav/page layout | feature-specific state |
| UI primitives | `src/renderer-app/src/components/ui` | small reusable controls | product workflows |
| Workspace | `src/renderer-app/src/features/workspace` | panes, terminal host UI, sidebar widgets, pet dock, workspace Viewer adapter, feature-local model/storage helpers | Studio/workshop behavior, parser internals |
| Studio/workshop | `src/renderer-app/src/features/studio` | workshop UI, Agent runtime stage, Studio Viewer overlay, feature-local model/storage helpers | workspace pane lifecycle, parser internals |
| Meow Viewer | `src/renderer-app/src/features/meow-viewer` | shared contract/profile types, parser, source normalization, conversation rendering, commands, composer | workspace/studio owner-specific session lifecycle |
| Readiness | `src/renderer-app/src/features/readiness` | route composition fixtures and shared readiness surfaces | new product behavior, runtime ownership |
| Tasks | `src/renderer-app/src/features/tasks` | task center UI and task actions | workspace-only task dock behavior |
| Workflow Beta archive | Archive branch/tag plus `docs/ui-rebuild/workflow-beta-archive-2026-07-10.md` | historical reference only | active route, canvas, runtime, or battery behavior without a new Shizuku-approved contract |
| Obsidian | `src/renderer-app/src/features/obsidian` | vault/file route UI and markdown display | arbitrary filesystem reads |
| Conversations | `src/renderer-app/src/features/conversations` | local conversation mirrors and route UI | raw source adapter parsing |
| Plugins/profile/lobby | matching `features/*` folders | route-specific surfaces | runtime iframe permissions without governance review |
| Renderer shared utilities | `src/renderer-app/src/lib` | framework-neutral helpers such as path-to-file-URL conversion | feature workflows, permission policy, or IPC payload semantics |

## Main Process Ownership

| Area | Owner | Allowed work | Do not put here |
|---|---|---|---|
| Coordinator | `src/main.js` | app boot, window lifecycle, service registration, narrow IPC wiring | new business logic blocks |
| Renderer entry | `src/main/renderer-entry.js` | active renderer selection and retired renderer rejection | rollback to legacy renderer |
| Meodesk Home/storage | `src/main/meodesk-home-service.js` | Meodesk Home directory contract, legacy migration, storage file key mapping, runtime cache paths | renderer UI state interpretation, Agent prompt policy |
| Agent runtime context | `src/main/agent-runtime-context-service.js` | Workshop/runtime normalizers, context markdown, prompt markdown, session skill markdown | terminal PTY lifecycle, command launch args, filesystem writes |
| Agent runtime launch | `src/main/agent-runtime-launch-service.js` | runtime env projection, Claude/Hermes launch args, WSL env/path injection | runtime prompt text, terminal PTY lifecycle |
| Command resolution | `src/main/command-resolver.js` | tool command normalization and launch descriptors | UI display logic |
| Terminal runtime | `src/main/terminal-runtime-service.js` | PTY lifecycle and terminal sessions | Viewer parsing policy |
| Terminal source adapter | `src/main/terminal-source-adapter-service.js` | semantic source events and adapter state | renderer state management |
| Workshop | `src/main/workshop-service.js` | local workshop project scan/create/import/export | plugin iframe runtime permissions without policy |
| Workflow Beta archive | No active main-process service; use archive refs for historical reference | new contract proposal only | restoring archived IPC/service code into the MVP baseline |
| Conversation | `src/main/conversation-service.js` | conversation mirrors and local source scan | renderer route rendering |
| Obsidian | `src/main/obsidian-service.js` | registered vault/file reads | arbitrary path expansion |
| Pet | `src/main/pet-service.js` | pet package/settings data | renderer animation behavior |
| Agent interface | `src/main/agent-interface-service.js` | local Agent interface summaries | terminal process lifecycle |

## Test Ownership

| Area | Owner | Notes |
|---|---|---|
| Smoke CLI entry | `scripts/renderer-smoke.js` | command parsing and launcher only |
| Smoke runner | `src/main/renderer-smoke-runner.js` | hidden Electron smoke dispatch, screenshot summary, and size parsing only |
| Smoke registry | `src/main/renderer-smoke-scenarios/index.js` | scenario name registration and unknown-scenario failure |
| Smoke scenario modules | `src/main/renderer-smoke-scenarios/*-scenarios.js` | scenario-specific assertions grouped by product/runtime domain |
| Heavy scenario wrapper | `src/main/renderer-smoke-heavy-scenarios.js` | compatibility wrapper for formerly heavy scenarios |
| Parser fixtures | `scripts/meow-viewer-parser.test.mjs`, `scripts/meow-viewer-parser-fixtures/` | parser/source behavior fixtures and fixture harness/groups |
| MVP baseline contract | `scripts/mvp-baseline-contract.test.js` | Workflow archive boundary, bridge capability alignment, and current core-gate composition |
| Workbench contract | `scripts/workbench-contract.test.js` | preload/adapter/main handler contract |
| Smoke registry contract | `scripts/renderer-smoke-registry.test.js` | package smoke scripts must map to registered scenarios |
| Static analysis | `scripts/analyze-dependencies.js`, `scripts/lib/static-js-analysis.js` | governance reports only |

## Visual Ownership

`src/renderer-app/src/styles/app.css` is a visual leaf file.

Allowed:

- design tokens
- layout and component styling
- route visual states
- feature-specific class styling

Not allowed:

- business rules
- IPC behavior
- parser behavior
- test-only selectors that do not map to real UI state

When CSS changes affect a visible surface, run the matching renderer smoke.

## Pressure Files

These files may still be edited, but every edit must explain why the owner is
correct and which follow-up test covers it:

```text
src/renderer-app/src/features/workspace/workspace-route.tsx
src/renderer-app/src/features/studio/studio-route.tsx
src/renderer-app/src/features/meow-viewer/meow-viewer-parser.ts
src/renderer-app/src/styles/app.css
src/main.js
```

Do not add unrelated helpers or future-feature staging code to pressure files.
Phase N moved Workspace and Studio pure model/storage helpers into
`workspace-model.ts` and `studio-model.ts`; future pane sizing, ordering,
project draft, or localStorage normalization should extend those model files
instead of returning to the route components. Shared path-to-file-URL conversion
belongs in `src/renderer-app/src/lib/file-url.ts`.
Phase P moved shared Meow Viewer data types and profile detection into
`src/renderer-app/src/features/meow-viewer/meow-viewer-contract.ts`; future
Workspace/Studio callers should import contract types from that file instead of
depending on parser internals for non-parser concerns.
Phase P also started fixture ownership cleanup: shared parser fixture helpers
and source-event fixtures live under `scripts/meow-viewer-parser-fixtures/`.
Future parser rule changes should prefer adding or moving a named fixture group
there instead of growing the monolithic test file.
Renderer smoke scenario files are not product pressure files, but a new scenario
must live in the smallest matching domain module and be registered in
`src/main/renderer-smoke-scenarios/index.js`.
Phase R moved Agent runtime prompt/context generation into
`src/main/agent-runtime-context-service.js`; future Workshop/runtime prompt,
rules, and session skill text should extend that service rather than returning
to `src/main.js` or launch/env helpers.

## Forbidden Shortcuts

- Adding a new feature to `readiness-routes.tsx` because the route already sees
  many features.
- Adding a new IPC handler block to `src/main.js` when a service owner exists.
- Adding Meodesk Home/storage path logic back into `src/main.js`.
- Adding Agent runtime prompt/context markdown back into `src/main.js`.
- Adding Agent runtime env/launch argument helpers back into `src/main.js`.
- Adding a new smoke scenario by pasting a long `executeJavaScript` string into
  the runner or heavy wrapper instead of a domain scenario module.
- Adding parser behavior without a fixture.
- Moving shared Meow Viewer contract/profile concerns back into
  `meow-viewer-parser.ts`.
- Adding a plugin/file/URL permission without documenting allow/reject rules.
- Solving UI state by adding global CSS that hides broken ownership.

## Ownership Decision Checklist

Before editing:

```text
1. Is this renderer, main, test, visual, release, or docs work?
2. Which owner folder owns the behavior?
3. Is the target file a pressure file?
4. Does the change widen IPC, filesystem, plugin, URL, or command permissions?
5. Which narrow gate proves the owner still works?
6. Which full gate is needed before phase completion?
7. Does Brain2 need a state writeback?
```

If the answer to item 2 is unclear, stop and define ownership before coding.

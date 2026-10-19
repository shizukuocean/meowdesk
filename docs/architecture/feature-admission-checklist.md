# Feature Admission Checklist

> Status: current admission gate for future Meowdesk feature or core-chain work.
> Scope: maintenance, new features, runtime changes, IPC changes, plugin changes,
> and high-risk refactors.

## Purpose

Meowdesk should not return to a "ship first, discover debt later" workflow.

Before adding a feature or changing a core chain, answer the checklist below and
select the matching verification gate.

## Readiness Definition

`readyForFeatureDevelopment=true` and `maintenanceCompletionPercent=100` mean
feature-development readiness is green:

- P0/P1 blocking debt is resolved.
- verification, safety, release-inventory, packaged-smoke, Dev Helper, and
  project-evaluation gates are present and green.
- remaining pressure files are tracked and governed.

They do not mean every pressure file has been physically split to an ideal final
size.

Before resuming feature work after the maintenance cleanup, complete these
P1-lite closeout items:

- create a local checkpoint commit or a named evidence package; after Shizuku's
  2026-06-08 authorization, prefer a local checkpoint commit on
  `claude/tech-debt-phase1`
- read `docs/architecture/workspace-route-hotspots.md` before touching
  Workspace runtime surfaces
- read `docs/architecture/studio-route-hotspots.md` before touching Studio,
  workshop, or Agent runtime surfaces
- read `docs/architecture/css-admission-policy.md` before adding or changing
  broad visual styles

## Classify The Work

Choose one primary class:

| Class | Meaning | Extra caution |
|---|---|---|
| Maintenance | preserves behavior while reducing debt or risk | must not alter UI/product semantics casually |
| Bug fix | corrects a verified broken behavior | must include repro or fixture/smoke assertion |
| Feature | adds user-visible capability | must have owner, boundary, and tests before implementation |
| Runtime | changes terminal/Agent/source adapter/process behavior | must cover lifecycle and cleanup |
| IPC/filesystem | widens bridge or main process access | must document allow/reject rules |
| Plugin/security | touches iframe, external URL, command, or extension boundary | must include permission model |
| Release | packaging/version/install/rollback work | must not rewrite product behavior as a side effect |
| Experiment | intentionally uncertain prototype | must be isolated and not enter default runtime |

## Admission Questions

Do not edit until these are answered:

```text
1. What is the exact user or maintenance problem?
2. Which owner module receives the change?
3. Is the target a pressure file?
4. Does this touch IPC, filesystem, external URLs, plugins, command execution, or PTY lifecycle?
5. What is allowed?
6. What is rejected?
7. What narrow verification gate proves the change?
8. What regression gate protects the old behavior?
9. Does this need Brain2 writeback?
10. What would rollback mean?
```

## Core Chain Gates

| Chain | Required narrow gates |
|---|---|
| Meow Viewer parser/source | `npm run test:meow-viewer-parser`, relevant workspace/studio Viewer smoke |
| Agent runtime registry / ownership | `npm run test:workbench-contract`, `npm run test:runtime-safety`, `npm run typecheck:renderer` |
| Workspace terminal/viewer | `npm run smoke:renderer:workspace-route-keepalive`, `npm run smoke:renderer:workspace-output-renderer` |
| Studio Agent/workshop | `npm run smoke:renderer:studio`, `npm run smoke:renderer:runtime-boundary`, workshop-specific smoke |
| Workspace right-sidebar owner | `npm run smoke:renderer:right-sidebar-owner`, `npm run smoke:renderer:r15-r2a` |
| App shell/routes | `npm run smoke:renderer:default-readiness`, `npm run smoke:renderer:phase-six` |
| Preload/workbench API | `npm run test:workbench-contract` |
| Main services | `node --check src\main.js`, `node --check src\main\agent-runtime-context-service.js`, service-specific syntax/contract tests |
| CSS layout | affected surface smoke plus `npm run build:renderer` |
| Static governance | `node --check scripts\analyze-dependencies.js`, `node --check scripts\maintenance-final-audit.js`, `npm run analyze:deps`, `npm run audit:maintenance` |

Use full verification before declaring a broad phase complete:

```text
npm run verify:renderer
```

## Rejection Rules

Reject the implementation path if it requires any of these:

- restoring `MEOWDESK_RENDERER=legacy`
- adding feature behavior to readiness as a shortcut
- widening `openPath`, Obsidian read, or plugin iframe access without policy
- adding broad `try/catch` that converts failures to green tests
- adding parser heuristics without fixtures
- adding a hidden smoke that only checks existence when behavior matters
- adding a new large block to `src/main.js` where a service exists
- changing UI style/layout while a maintenance-only goal is active

For permission-sensitive, bundle-sensitive, or release-like changes, read these
documents before editing:

```text
docs/architecture/runtime-safety-permissions.md
docs/architecture/performance-bundle-governance.md
docs/architecture/release-readiness.md
docs/architecture/workspace-route-hotspots.md
docs/architecture/studio-route-hotspots.md
docs/architecture/css-admission-policy.md
```

## Minimum Evidence By Work Type

| Work type | Minimum evidence |
|---|---|
| Parser behavior | fixture before/after plus affected smoke |
| IPC addition | preload contract, main handler existence, invalid input rejection |
| Filesystem access | allowed path test and rejected path test; use `npm run test:runtime-safety` when the shell, Obsidian, package, or terminal boundary is touched |
| Plugin iframe | sandbox/origin/permission note plus smoke or contract |
| Terminal lifecycle | start/write/resize/kill/cleanup boundary check |
| Route behavior | route smoke and screenshot nonblank check |
| CSS cleanup | dead selector search and affected smoke |
| Release work | package/dependency inventory, `npm run audit:maintenance`, `npm run release:minimal-check`, and rollback note |

## Handoff Requirements

At handoff, record:

```text
changed owner modules
verification commands
known non-failing noise
remaining debt
whether Brain2 was updated
whether commit/push/PR happened
```

If a change is large, create an anchor before continuing.

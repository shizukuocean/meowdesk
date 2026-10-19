# Meowdesk UI T-S-G Rebuild

> Status: Historical UI rebuild record; current active renderer is next
> Scope: React + Tailwind + shadcn/ui + GSAP rebuild path
> Safety rule: current V0.2 baseline must remain recoverable

This folder records the UI rebuild path. The current source of truth for active
runtime ownership is now in
[`docs/architecture/current-runtime-boundaries.md`](../architecture/current-runtime-boundaries.md).

The goal is not to decorate the existing prototype. The goal is to give
Meowdesk a durable UI system so future features are designed and implemented
from shared rules.

## Current Status After Cleanup

- The React/Vite next renderer is the only normal UI entry in this worktree.
- The old `src/renderer/index.html`, `src/renderer/renderer.js`, and
  `src/renderer/styles.css` files are retired.
- `MEOWDESK_RENDERER=legacy` is not a rollback path here; main rejects it.
- Historical phase notes below still mention legacy default/rollback because
  that was true during the migration. Do not use those older notes as the
  current launch contract.
- When current code says `owner: "legacy"`, read it as a protected/deferred
  runtime-service compatibility label, not as an active legacy renderer.

## Why This Exists

The retired renderer grew as a functional prototype:

- `src/renderer/index.html`
- `src/renderer/renderer.js`
- `src/renderer/styles.css`

Those files proved the product direction, but they did not form a sustainable
design system. They are no longer the active UI target.

## Phase-One Objective

Phase one should produce a new UI foundation without breaking the existing app:

1. Keep the current main baseline usable and recoverable.
2. Build a new renderer shell in parallel.
3. Define Meowdesk design tokens, component rules, and motion rules.
4. Use Lobby and/or Studio as the first sample route.
5. Keep existing Electron, preload, IPC, storage, terminal, and extension
   contracts stable until each module is deliberately migrated.

## Phase-Two Objective

Phase two starts turning the sample shell into a controlled real-data surface:

1. Keep `legacy` as the default renderer and keep `next` opt-in.
2. Read real workshop summaries through `window.workbench`, via the adapter.
3. Let Studio perform narrow, existing workshop actions only when they are
   already exposed by preload and covered by smoke tests.
4. Continue to avoid xterm, Agent process management, Workflow Beta canvas, and
   right-sidebar iframe runtime migration.
5. Keep every new runtime touch covered by hidden Electron smoke scenarios.

## Phase-Three Objective

Phase three starts the real Studio operation loop while still avoiding
runtime-heavy surfaces:

1. Keep `legacy` as the default renderer and keep `next` opt-in.
2. Keep all write actions behind typed `window.workbench` adapter helpers.
3. Wire the safe existing workshop operations into Studio:
   `createWorkshopProject`, `exportMeowPackage`, and `importMeowPackage`.
4. Verify write paths only against temporary Meodesk Home fixtures in hidden
   Electron smoke scenarios.
5. Continue to defer xterm, Agent process management, right-sidebar iframe
   runtime, Workflow Beta canvas, version switching, and rollback until their
   contracts are explicit.

## Phase-Four Objective

Phase four starts the runtime boundary migration while keeping protected runtime
ownership intact:

1. Keep `legacy` as the default renderer and keep `next` opt-in.
2. Keep Agent / terminal pages Agent-first: the terminal or Agent viewport is
   the main stage.
3. Put auxiliary tools, project lists, details, and runtime metadata into one
   side Inspector instead of scattering them around the page.
4. Read terminal session descriptors through the typed adapter only.
5. Do not let React own xterm mount, fit, stdin/stdout, or process kill until a
   separate mount contract and smoke coverage exist.

## Phase-Five Objective

Phase five extends runtime boundary migration to right-sidebar iframe widgets
and Workflow Beta while keeping both legacy-owned:

1. Keep `legacy` as the default renderer and keep `next` opt-in.
2. Read sidebar-widget manifests and Workflow Beta drafts through typed
   read-only descriptors.
3. Show protected boundary state in the Studio Inspector runtime tab.
4. Do not mount sidebar iframes from React.
5. Do not save, delete, dispatch, run, or rewire Workflow Beta from React.

## Phase-Six Objective

Phase six makes the next renderer a default-entry candidate while preserving a
documented protected-runtime boundary:

1. Switch the worktree default renderer to `next` when `MEOWDESK_RENDERER` is
   unset.
2. Treat the old renderer as retired in this worktree; use backups or Git
   history for rollback, not `MEOWDESK_RENDERER=legacy`.
3. Restore top-level feature reachability in next: Lobby, Studio, plugin
   marketplace, task center, Workflow Beta, and profile.
4. Mark runtime-heavy surfaces as `deferred runtime` / `protected runtime`
   instead of silently dropping them.
5. Cover default-entry and route reachability with hidden Electron smoke.

## R1 Recovery Objective

R1 starts the post T-S-G recovery line by making low-risk feature routes real in
the next renderer without taking over runtime hosts:

1. Create the capability matrix for product surface ownership and risk.
2. Restore task center storage read/write, create, edit, status change, and day
   summary through typed adapter helpers.
3. Restore local profile editing for display name, developer id, title, and bio.
4. Restore plugin marketplace detail visibility for local indexed workshop
   works.
5. Keep xterm, Agent process lifecycle, right-sidebar iframe host, and Workflow
   execution out of R1.

## R1.5 + R2A Objective

R1.5 restores the major old task and Workflow showcase shapes without crossing
runtime boundaries:

1. Task Center regains AI tasks, my tasks, day schedule, month calendar, tag
   sections, and status columns on top of the R1 typed storage adapter.
2. Workflow Beta regains a read-only showcase canvas with node, edge, and
   inspector summaries.
3. Workflow save, delete, dispatch, and execution remain legacy-protected.
4. R2A defines the right-sidebar iframe host contract only; next does not mount
   real widget iframes.

## Documents

- [Design System V1](./design-system-v1.md)
- [Capability Matrix](./capability-matrix.md)
- [Desktop Agent Embedding Strategy](./desktop-agent-embedding-strategy.md)
- [R2A Sidebar Iframe Host Contract](./r2a-sidebar-iframe-host-contract.md)
- [Migration Plan](./migration-plan.md)
- [Functional Contracts](./functional-contracts.md)
- [Rebuild Roadmap](./rebuild-roadmap.md)
- [Current Runtime Boundaries](../architecture/current-runtime-boundaries.md)
- [Testing Strategy](../architecture/testing-strategy.md)
- [Development Workflow](../architecture/development-workflow.md)
- [Engineering Governance Roadmap](../architecture/engineering-governance-roadmap.md)
- [Ownership Governance](../architecture/ownership-governance.md)
- [Feature Admission Checklist](../architecture/feature-admission-checklist.md)
- [Runtime Safety And Permissions](../architecture/runtime-safety-permissions.md)
- [Performance And Bundle Governance](../architecture/performance-bundle-governance.md)
- [Release Readiness](../architecture/release-readiness.md)
- [Maintenance Audit](../analysis/meodesk-maintenance-audit.md)
- [Dependency Analysis](../analysis/meodesk-dependency-analysis.md)
- [Phase Six Default Readiness](./phase-six-default-readiness.md)
- [Phase Five Runtime Boundary](./phase-five-runtime-boundary.md)
- [Phase Four Runtime Boundary](./phase-four-runtime-boundary.md)
- [Phase-One Readiness](./phase-one-readiness.md)
- [Phase-Two Readiness](./phase-two-readiness.md)
- [Phase-Three Readiness](./phase-three-readiness.md)

## Product Tone

Meowdesk should feel like:

- a local desktop workbench;
- an Agent studio;
- a plugin ecosystem;
- quiet, dense, precise, and long-session friendly;
- lightly alive, but never childish.

Meowdesk should not feel like:

- a marketing landing page;
- a generic SaaS admin panel;
- a game store;
- a decorative demo page;
- a random pile of feature cards.

## Implementation Stance

Tailwind and shadcn/ui provide order. They do not define Meowdesk's soul.
GSAP provides motion. It must not compensate for weak layout or unclear state.

Use the stack as follows:

```text
Tailwind       -> tokens, layout rules, state utilities
shadcn/ui      -> accessible component grammar and base components
GSAP           -> deliberate state transitions and staged motion
Meowdesk rules -> product tone, workflow, domain objects, and final judgment
```

## Rebuild Gate

Do not replace the current renderer until the new shell proves these basics:

- app launches in Electron;
- preload API remains available;
- navigation route state works;
- at least one sample route reaches the desired visual standard;
- old baseline remains recoverable;
- no current Meowdesk Home data migration is required for the sample route.

For the current phase-one acceptance map, see
[Phase-One Readiness](./phase-one-readiness.md).

For the current phase-two acceptance map, see
[Phase-Two Readiness](./phase-two-readiness.md).

For the current phase-three acceptance map, see
[Phase-Three Readiness](./phase-three-readiness.md).

For the current phase-four runtime boundary map, see
[Phase Four Runtime Boundary](./phase-four-runtime-boundary.md).

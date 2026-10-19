# Phase-Three Readiness

> Updated: 2026-05-30
> Status: historical workshop-operation slice; not the current launch contract

Current cleanup note: this document records phase-three facts from 2026-05-30.
The old `src/renderer/*` renderer has since been retired in this worktree.
Use `docs/architecture/current-runtime-boundaries.md` and
`docs/architecture/testing-strategy.md` for current operation.

This note records the third Meowdesk UI T-S-G rebuild stage. Phase three turns
Studio from a mostly read-only real-data surface into a controlled workshop
operation surface while keeping runtime-heavy systems out of the React shell.

## Current Gates

- Historical phase-three gate: `legacy` remained the default renderer path.
- Historical phase-three gate: `next` remained opt-in through
  `MEOWDESK_RENDERER=next`.
- The main baseline at `<BASELINE_ROOT>` remains untouched.
- All new Studio write actions call typed helpers in
  `src/renderer-app/src/lib/workbench-api.ts`.
- Hidden Electron smoke scenarios seed only temporary Meodesk Home directories.
- No xterm, Agent process, right-sidebar iframe, or Workflow Beta runtime has
  been migrated.

## Implemented In The First Slice

- `workbench-api.ts` now wraps and validates:
  - `createWorkshopProject()`;
  - `markWorkshopProjectReady()`;
  - `exportMeowPackage()`;
  - `importMeowPackage()`.
- Studio keeps the local sample draft flow for quick UI testing.
- Studio adds a real "创建本机工程" action that calls the existing
  `createWorkshopProject` preload contract for `feature-page` and
  `sidebar-widget` projects.
- Studio adds an "安装 .meow" action using the existing
  `importMeowPackage` contract. The visible UI uses the main-process dialog;
  smoke tests use a fixed package path.
- Real Studio project cards add a "生成 .meow" action using the existing
  `exportMeowPackage` contract.
- Studio reuses the operation status area for create/import/export success and
  failure feedback, including the exported package path.
- Studio now follows an Agent-first layout rule: the app side navigation
  collapses on focus routes, the Agent stage is widened and enlarged, and
  project type, project list, and project detail panels are opt-in toggles
  instead of always-visible columns.

## Verification Command

Use this command from the rebuild workspace root:

```powershell
npm run verify:renderer
```

The phase-three slice adds these smoke scenarios:

```powershell
npm run smoke:renderer:workshop-create
npm run smoke:renderer:workshop-export
npm run smoke:renderer:workshop-import
```

Expected scenario names:

```json
{
  "create": "workshop-create-project",
  "export": "workshop-export-meow",
  "import": "workshop-import-meow"
}
```

## Boundaries Still Protected

Phase three still does not migrate:

- xterm sessions and PTY lifecycle;
- Agent process management or Agent-assisted creation;
- Workflow Beta canvas/runtime;
- right-sidebar iframe runtime and "use sidebar widget" lifecycle;
- active version switching as a runtime selection;
- rollback from `versions/` snapshots.

## Runtime Notes

`createWorkshopProject` creates a local project scaffold and manifest, but it
does not create the runnable entry file. A newly created project may still fail
mark-ready or export until an Agent or user writes the entry.

`exportMeowPackage` is intentionally exposed only as a project-level action.
The main process still enforces entry existence and package size limits.

`importMeowPackage` installs a `.meow` package into the local extensions
directory. The visible UI delegates package picking to the existing main-process
dialog; automated smoke uses a deterministic `.meow` fixture under temporary
user data so it does not touch the user's real Meodesk Home.

Version switching and rollback remain separate contracts. The current main
process only scans `versions/` for display; it does not expose a safe restore
operation.

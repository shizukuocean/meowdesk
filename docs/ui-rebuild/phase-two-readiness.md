# Phase-Two Readiness

> Updated: 2026-05-30
> Status: historical real-data increment; not the current launch contract

Current cleanup note: this document records phase-two facts from 2026-05-30.
The old `src/renderer/*` renderer has since been retired in this worktree.
Use `docs/architecture/current-runtime-boundaries.md` and
`docs/architecture/testing-strategy.md` for current operation.

This note records the second Meowdesk UI T-S-G rebuild stage. Phase two begins
after the React/Tailwind/shadcn-style/GSAP shell has been accepted and the
rebuild workspace has its own local Git history.

## Current Gates

- Historical phase-two gate: `legacy` remained the default renderer path.
- Historical phase-two gate: `next` remained opt-in through
  `MEOWDESK_RENDERER=next`.
- The main baseline at `<BASELINE_ROOT>` remains untouched.
- The rebuild workspace has local Git commits and no GitHub remote requirement.
- Lobby and Studio read real workshop summaries through the
  `window.workbench` adapter.
- Studio can call the existing `markWorkshopProjectReady` preload method for a
  real local workshop project.
- The mark-ready path is covered by a hidden Electron smoke scenario that seeds
  only a temporary Meodesk Home directory.
- The mark-ready UI now uses a renderer-side typed wrapper that validates the
  IPC result before treating the operation as successful.
- Studio has a read-only real project detail panel and a manual refresh action
  that re-reads `getAgentInterfaceInfo({ forceRefresh: true })`.
- Studio displays read-only workshop version history when the existing
  `versions` array is returned by `getAgentInterfaceInfo()`.
- Studio surfaces broken or invalid workshop manifests as read-only error
  projects instead of hiding them or offering unsafe actions.

## Implemented In Phase Two

- `useWorkbenchSummary` normalizes `getAgentInterfaceInfo().workshopExtensions`
  into typed workshop extension summaries.
- Lobby plugin category counts and profile entry stats use real workshop
  extension counts when available.
- Studio merges local sample drafts with real local workshop projects.
- Real Studio projects show their type, status, version, summary, and a local
  project marker.
- Draft real projects expose a narrow `标记可用` action that calls the existing
  preload/API boundary instead of rewriting workshop runtime logic.
- `workbench-api.ts` exports `WorkshopProjectReadyPayload`,
  `WorkshopProjectReadyResult`, `normalizeWorkshopProjectReadyResult()`, and a
  typed `markWorkshopProjectReady()` helper for the Studio mark-ready action.
- The `window.workbench` summary adapter now keeps read-only project metadata:
  `entry`, `runtime`, `path`, `manifestPath`, `entryPath`, `projectFilePath`,
  `modifiedAt`, and `createdAt`.
- Studio can select a real project and show a read-only detail panel with id,
  runtime, entry file, manifest path, project path, and timestamps.
- Studio exposes a manual refresh button for workshop summaries.
- The summary adapter normalizes read-only version records with `key`,
  `version`, `label`, `current`, `status`, `summary`, `runtime`, `entry`,
  `path`, `manifestPath`, `entryPath`, and `modifiedAt`.
- The Studio detail panel shows current and historical version snapshots without
  changing any package, manifest, or install runtime.
- Broken manifest projects render as `error`, show the parse/read error in the
  project list and detail panel, and do not expose the mark-ready action.

## Verification Command

Use this command from the rebuild workspace root:

```powershell
npm run verify:renderer
```

It currently covers:

- renderer typecheck;
- renderer build;
- `src\main.js` syntax check;
- `src\preload.js` syntax check;
- `scripts\renderer-smoke.js` syntax check;
- `scripts\workbench-contract.test.js` syntax check;
- baseline workflow bus assertions;
- `window.workbench` preload/adapter/IPC contract check;
- historical default renderer smoke with `MEOWDESK_RENDERER` unset;
- historical explicit legacy renderer smoke;
- explicit next renderer smoke;
- next `window.workbench` bridge smoke;
- seeded real workshop data smoke;
- seeded workshop mark-ready smoke;
- seeded workshop detail and refresh smoke;
- seeded workshop version history smoke;
- seeded invalid workshop manifest smoke;
- next hash route smoke;
- compact 900x600 layout smoke;
- Lobby plugin tabs smoke;
- Studio local draft creation smoke.

For the mark-ready path alone:

```powershell
npm run smoke:renderer:workshop-ready
```

Expected smoke result includes:

```json
{
  "scenario": "workshop-mark-ready",
  "status": "ready"
}
```

For the project detail and refresh path alone:

```powershell
npm run smoke:renderer:workshop-detail
```

Expected smoke result includes:

```json
{
  "scenario": "workshop-project-detail",
  "before": "draft",
  "after": "ready"
}
```

For the version history path alone:

```powershell
npm run smoke:renderer:workshop-versions
```

Expected smoke result includes:

```json
{
  "scenario": "workshop-version-history",
  "count": 2
}
```

For the invalid manifest path alone:

```powershell
npm run smoke:renderer:workshop-invalid
```

Expected smoke result includes:

```json
{
  "scenario": "workshop-invalid-manifest",
  "state": "error"
}
```

## Boundaries Still Protected

Phase two still does not migrate:

- xterm sessions and PTY lifecycle;
- Agent process management;
- Workflow Beta canvas/runtime;
- right-sidebar iframe runtime;
- `.meow` import/export UX;
- full workshop project creation;
- plugin install/update runtime;
- durable profile/auth/account flows.

## Runtime Notes

The mark-ready action is intentionally narrow. It uses the existing
`window.workbench.markWorkshopProjectReady({ id })` contract, which reaches the
existing main-process workshop implementation. React owns only the button state,
success/error message, typed response normalization, and local visual refresh.
If the IPC response is missing `ok: true` or `id`, the UI treats it as failure.

The refresh action is also narrow. It only re-runs the existing summary read
with `forceRefresh: true`; it does not poll, watch files, mutate storage, or
take ownership of workshop runtime.

The version history view is read-only. It renders `versions` records already
returned by main-process scanning and does not call export/import/install code.

The invalid manifest view is also read-only. It displays scan errors already
returned by main-process scanning and deliberately hides mark-ready actions for
error projects.

The smoke runner seeds data under a temporary Electron user-data directory. It
does not write to the user's real Meodesk Home during verification.

## Next Phase Candidates

- Write the dedicated `createWorkshopProject` migration contract before wiring
  it into the next renderer.
- Decide whether opening local project folders through `openPath` belongs in
  phase two light operations or a later Studio tools pass.
- Keep runtime-heavy surfaces out until each has a separate migration plan.

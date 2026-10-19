# Phase-One Readiness

> Updated: 2026-05-30
> Status: historical renderer-foundation gate; not the current launch contract

Current cleanup note: this document records phase-one facts from 2026-05-30.
The old `src/renderer/*` renderer has since been retired in this worktree.
Use `docs/architecture/current-runtime-boundaries.md` and
`docs/architecture/testing-strategy.md` for current operation.

This note is the acceptance map for the first Meowdesk UI T-S-G rebuild stage.
It records what is runnable now, what remains deliberately out of scope, and
which command should be used before handing the workspace to the next session.

## Current Gates

- Historical phase-one gate: `legacy` remained the default renderer path and
  loaded `src/renderer/index.html`.
- Historical phase-one gate: `next` was opt-in through `MEOWDESK_RENDERER=next`
  and loaded
  `dist/renderer-app/index.html`.
- The rebuild workspace has a local Git starting commit:
  `42e657b chore: start meowdesk ui rebuild workspace`.
- The next renderer builds through Vite and TypeScript.
- The next renderer uses React, Tailwind v4, shadcn-style Radix primitives, and
  GSAP route transitions.
- The next renderer has a minimal Meowdesk component system:
  `Button`, `Badge`, `Panel`, `Tabs`, `Tooltip`, `Dialog`, `Input`, `Switch`,
  `AppShell`, `TopNav`, `PageHeader`, and `RouteShell`.
- The `window.workbench` boundary is accessed through a renderer adapter, not by
  migrating runtime modules into React.
- The next shell supports stable hash routes for `#lobby` and `#studio`.
- Lobby and Studio sample routes are available and covered by hidden Electron
  smoke scenarios.

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
- historical legacy renderer smoke;
- next renderer smoke;
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

For narrower checks, use:

```powershell
npm run build:renderer
node --check src\main.js
node --check src\preload.js
npm run test:baseline
npm run test:workbench-contract
npm run smoke:renderer
npm run smoke:renderer:default
npm run smoke:renderer:bridge
npm run smoke:renderer:workshop-data
npm run smoke:renderer:workshop-ready
npm run smoke:renderer:workshop-detail
npm run smoke:renderer:workshop-versions
npm run smoke:renderer:workshop-invalid
npm run smoke:renderer:routes
npm run smoke:renderer:compact
npm run smoke:renderer:lobby
npm run smoke:renderer:studio
```

## Key Files

- `vite.renderer.config.js`
- `package.json`
- `tsconfig.renderer.json`
- `components.json`
- `src\main.js`
- `src\preload.js`
- `scripts\renderer-smoke.js`
- `src\renderer-app\index.html`
- `src\renderer-app\src\main.tsx`
- `src\renderer-app\src\app\App.tsx`
- `src\renderer-app\src\app\use-route-transition.ts`
- `src\renderer-app\src\app\use-workbench-summary.ts`
- `src\renderer-app\src\lib\workbench-api.ts`
- `src\renderer-app\src\components\layout\*.tsx`
- `src\renderer-app\src\components\ui\*.tsx`
- `src\renderer-app\src\features\lobby\lobby-route.tsx`
- `src\renderer-app\src\features\studio\studio-route.tsx`

## Smoke Evidence

The smoke runner uses a temporary user-data directory and can capture screenshots
under `tmp\renderer-smoke\`. The `tmp\` directory is ignored and should not be
treated as durable evidence.

Current scenario names:

- `workbench-bridge`
- `workshop-real-data`
- `workshop-mark-ready`
- `workshop-project-detail`
- `workshop-version-history`
- `workshop-invalid-manifest`
- `compact-layout`
- `next-route-hash`
- `lobby-plugin-tabs`
- `studio-create-draft`

The smoke path checks that screenshots are not blank by sampling captured image
pixels in Electron.

## Deliberately Not Migrated

Phase one must not migrate or rewrite these runtime surfaces:

- xterm sessions and PTY lifecycle;
- Agent process management;
- Workflow Beta canvas/runtime;
- right-sidebar iframe runtime;
- real plugin install/update flows;
- durable Studio write paths.

The next renderer may read a small summary through `window.workbench`, but it
must not take ownership of these contracts until a later migration pass.

## Known Follow-Up Risks

- `window.workbench` is an ABI. Method names, parameter shapes, and event
  channels need adapter tests before any runtime migration.
- Preload event listeners now return unsubscribe functions for conversation and
  terminal streams. React pages that subscribe to these channels must invoke the
  cleanup function during effect teardown.
- `getStorageInfo()` and `getAgentInterfaceInfo()` are read-oriented from the
  renderer point of view, but they can still initialize local data contracts.
  Avoid frequent polling or StrictMode-amplified side effects.
- The current next shell is dark-token first. `whitemeo` needs a separate token
  pass before theme switching is treated as complete.
- Studio is a visual/runtime-boundary sample. Its local draft creation is not a
  replacement for `createWorkshopProject`, `.meow` import/export, manifest
  writes, or Agent-assisted workshop creation.
- The current smoke viewport proves the shell is nonblank and interactive, but
  not every compact window layout has been manually reviewed.

## Git Workspace State

The user requested this rebuild workspace to have separate local Git management.
Windows PowerShell still does not expose `git.exe`, but WSL Git is available and
was used only inside this directory.

Current local starting commit:

```text
42e657b chore: start meowdesk ui rebuild workspace
```

No GitHub remote is required for this rebuild workspace. Keep using local Git
only unless the user explicitly changes that policy.

## Rollback Rule

`<BASELINE_ROOT>` is the protected main baseline and must not be
modified by this rebuild stage. The pre-rebuild backup remains available at:

```text
<BACKUP_ROOT>\20260530-082713-ui-rebuild-prebackup
<BACKUP_ROOT>\20260530-082713-ui-rebuild-prebackup.zip
```

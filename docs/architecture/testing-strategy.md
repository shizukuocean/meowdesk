# Testing Strategy

> Status: current verification contract after the 2026-06-07 debt cleanup.
> Scope: local commands, hidden Electron smokes, current MVP baseline coverage,
> and anti-fake-green rules.

## Primary Verification

Use this as the normal full renderer verification gate:

```text
npm run verify:renderer
```

The gate currently includes renderer typecheck, Meow Viewer parser fixtures,
renderer build, Node syntax checks, baseline/contract tests, and hidden Electron
smokes for the active next renderer.

Since 2026-06-07, renderer smoke leaf scripts are routed through:

```text
scripts/run-renderer-smoke-command.js
```

The wrapper builds the renderer by default. `verify:renderer` builds once before
the smoke chain and then sets `MEOWDESK_SKIP_RENDERER_BUILD=1` so each smoke
uses the already-built renderer output instead of rebuilding repeatedly.

Latest evidence:

```text
npm run smoke:renderer:phase-six
# passed; wrapper performed build:renderer first

npm run build:renderer
MEOWDESK_SKIP_RENDERER_BUILD=1 npm run smoke:renderer:phase-six
# passed; smoke did not invoke build:renderer again

npm run verify:renderer
# passed in 223.6 seconds on 2026-06-07 after build reuse and smoke-noise mitigation
```

`verify:renderer` should never include a retired test that exits successfully
without checking behavior. When a script is retired, remove it from the gate or
turn it into an explicit retirement/coverage assertion.

## Fast Local Gates

Use narrower gates while editing:

```text
npm run typecheck:renderer
npm run build:renderer
npm run test:meow-viewer-parser
npm run test:mvp-baseline
npm run test:workbench-contract
npm run test:runtime-safety
npm run test:renderer-smoke-registry
node --check src\main.js
node --check src\main\agent-runtime-context-service.js
node --check src\preload.js
node --check scripts\renderer-smoke.js
node --check scripts\maintenance-final-audit.js
```

Use route-specific smoke commands when the touched feature has one:

```text
npm run smoke:renderer:studio
npm run smoke:renderer:studio-meow-viewer
npm run smoke:renderer:workspace-route-keepalive
npm run smoke:renderer:workspace-output-renderer
npm run smoke:renderer:workspace-output-renderer-claude-startup
npm run smoke:renderer:workspace-output-renderer-claude-chat
npm run smoke:renderer:right-sidebar-owner
npm run smoke:renderer:r15-r2a
npm run smoke:renderer:r3-product-surfaces
npm run smoke:renderer:phase-six
```

If the renderer has already been built and only smoke behavior changed, set
`MEOWDESK_SKIP_RENDERER_BUILD=1` for the individual smoke run. Do not set it
when renderer source changed unless a fresh `npm run build:renderer` has already
passed in the same local verification session.

For a final maintenance/readiness snapshot after a broad debt phase:

```text
npm run analyze:deps
npm run audit:maintenance
```

## Archived Workflow Beta Boundary

Workflow Beta runtime/CDP smokes are archived outside the current MVP baseline.
The active baseline instead proves that the route, IPC, service, battery
protocol, and dedicated smoke scripts stay absent while the archive refs remain
documented.

## Hidden Electron Smoke Rules

Hidden smokes may launch isolated Electron instances with temporary
`MEOWDESK_USER_DATA_DIR` directories. They must not require starting or stopping
the user's real Meowdesk window.

Smoke scenarios should:

- Use the active/default next renderer.
- Seed temporary Meodesk Home fixtures instead of touching user data.
- Assert behavior or boundary contracts, not only element existence.
- Keep scenario-specific logic in `src/main/renderer-smoke-scenarios/*-scenarios.js`.
- Keep every package `--scenario` value registered in
  `src/main/renderer-smoke-scenarios/index.js`; `npm run test:renderer-smoke-registry`
  enforces this.
- Avoid hiding runtime failures behind broad `try/catch` blocks.

## Noise Tracking

The verification gate should stay quiet enough that real failures are visible.

Current tracked noise:

| Noise | Status | Owner |
|---|---|---|
| Vite renderer main chunk warning over 500 kB | Resolved by Phase H route-level lazy loading on 2026-06-07; keep tracked as a regression signal | `docs/architecture/performance-bundle-governance.md` |
| node-pty `AttachConsole failed` after hidden terminal smokes | Mitigated in smoke mode through Windows `useConptyDll`; full verify passed without this noise on 2026-06-07 | terminal runtime / smoke governance |
| Chromium GPU shutdown noise after hidden screenshots | Mitigated in smoke mode by disabling hardware acceleration/GPU in `src/main.js`; full verify passed without this noise on 2026-06-07 | hidden Electron smoke governance |

Do not hide these messages by redirecting stderr globally. Reduce the cause or
classify it in docs with a follow-up owner.

## Anti-Fake-Green Checklist

Before adding a test to a verification gate, check:

- Does it assert the behavior named by the script?
- Does it fail if the target module/file is missing?
- Does it avoid unconditional `process.exit(0)` retirement behavior?
- Does it avoid broad skips unless the skip itself is the behavior under test?
- Does it name external prerequisites, such as CDP ports or real running apps?
- Does it cover the active next renderer rather than deleted legacy UI files?

## Core Coverage Expectations

| Area | Minimum coverage |
|---|---|
| Meow Viewer parser/source | Fixture tests plus workspace/studio smoke. |
| Workbench API/preload | Contract test for exposed methods and handler availability. |
| Main services | Node syntax checks plus focused contract tests where inputs are normalized. |
| IPC/filesystem boundaries | Tests or smoke fixtures that prove invalid paths/protocols are rejected. |
| Workspace terminal/viewer | Hidden smoke for output rendering and keepalive boundaries. |
| Studio/workshop | Hidden smoke for create/ready/detail/export/import/data and Viewer isolation. |
| Current MVP baseline | Archive-boundary and Agent bridge capability contract plus the core runtime, shell, ownership, and legacy-isolation gates. |

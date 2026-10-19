# Development Workflow

> Status: current workflow after the 2026-06-07 debt cleanup.
> Scope: how to make maintenance or feature changes without reintroducing the
> retired renderer path, fake-green tests, or unsafe runtime shortcuts.

## Before Editing

Confirm the target worktree is the active rebuild worktree:

```text
<PROJECT_ROOT>
```

Do not use the main baseline worktree for this maintenance line:

```text
<BASELINE_ROOT>
```

Read the current boundaries first when the change touches runtime ownership,
IPC, renderer routes, Meow Viewer, terminal behavior, or smoke tests:

```text
docs/architecture/current-runtime-boundaries.md
docs/architecture/testing-strategy.md
docs/architecture/engineering-governance-roadmap.md
docs/architecture/ownership-governance.md
docs/architecture/feature-admission-checklist.md
docs/architecture/workspace-route-hotspots.md
docs/architecture/studio-route-hotspots.md
docs/architecture/css-admission-policy.md
docs/architecture/runtime-safety-permissions.md
docs/architecture/performance-bundle-governance.md
docs/architecture/release-readiness.md
docs/analysis/meodesk-maintenance-audit.md
docs/analysis/meodesk-project-evaluation-packet.md
docs/analysis/meodesk-dependency-analysis.md
```

## Ownership Rules

- `src/renderer-app/src/app` owns the active renderer shell and route
  composition.
- `src/renderer-app/src/features/workspace` owns workspace panes, terminal host,
  sidebar widgets, pet dock, workspace Viewer adaptation, and
  `workspace-model.ts` model/storage helpers.
- `src/renderer-app/src/features/studio` owns workshop/studio UI and the Studio
  Meow Viewer overlay plus `studio-model.ts` model/storage helpers.
- `src/renderer-app/src/features/meow-viewer` owns shared contract/profile
  types, parser/source, conversation rendering, commands, and composer behavior.
  Workspace/Studio callers should use `meow-viewer-contract.ts` for data
  shapes and profile detection instead of importing parser internals for those
  concerns.
- `src/renderer-app/src/lib` owns renderer-wide, framework-neutral utilities
  such as `file-url.ts`; do not put feature workflows or IPC policy there.
- `src/renderer-app/src/features/readiness` is a fixture/composition area; do
  not put new product behavior there.
- `src/main.js` is the coordinator; new main-process behavior should prefer a
  service module under `src/main/`.
- `src/preload.js` is the bridge contract. Add or widen IPC deliberately and
  cover it with contract tests.
- `src/renderer-app/src/styles/app.css` is a visual leaf file. It should not
  contain behavior rules.

## Readiness Language

When reports say `readyForFeatureDevelopment=true` or
`maintenanceCompletionPercent=100`, read that as feature-development readiness,
not debt erasure.

Current meaning:

- blocking maintenance debt is resolved
- verification and governance gates are present and green
- remaining pressure files are tracked and governed

Current non-meaning:

- every large file has been physically split
- public installer/signing/release work is complete
- future features can bypass owner/test/rollback admission

## Hard Boundaries

Do not restore or depend on:

```text
MEOWDESK_RENDERER=legacy
src/renderer/index.html
src/renderer/renderer.js
src/renderer/styles.css
desktop embedding
getDisplayMedia projection
raw HWND SetParent
```

Do not treat `owner: "legacy"` as proof that the retired renderer is active. It
is a compatibility label for protected/deferred runtime services.

## Fast Gates

Use the narrowest gate that covers the changed surface:

```text
npm run typecheck:renderer
npm run build:renderer
npm run test:meow-viewer-parser:check
npm run test:meow-viewer-parser
npm run test:mvp-baseline
npm run test:workbench-contract
node --check src\main.js
node --check src\main\meodesk-home-service.js
node --check src\main\agent-runtime-context-service.js
node --check src\main\agent-runtime-launch-service.js
node --check src\preload.js
node --check scripts\renderer-smoke.js
node --check scripts\analyze-dependencies.js
node --check scripts\maintenance-final-audit.js
node --check scripts\project-evaluation-packet.js
node --check scripts\release-minimal-check.js
node --check scripts\package-internal-app.js
node --check scripts\packaged-launch-smoke.js
node --check scripts\dev-helper-acceptance-check.js
node --check scripts\lib\static-js-analysis.js
```

Run dependency analysis after structural changes:

```text
npm run analyze:deps
npm run audit:maintenance
npm run audit:project
npm run dev-helper:acceptance-check
npm run package:internal
npm run smoke:packaged-launch
npm run release:minimal-check
```

Renderer smoke leaf scripts run through
`scripts/run-renderer-smoke-command.js`. By default each leaf smoke builds the
renderer first. The full `verify:renderer` gate builds once, sets
`MEOWDESK_SKIP_RENDERER_BUILD=1`, and then runs the smoke matrix against the
same build output.

For a focused smoke after an already-passing build:

```text
set MEOWDESK_SKIP_RENDERER_BUILD=1&& npm run smoke:renderer:phase-six
```

Use this only when the current `dist/renderer-app` was built from the source you
are validating.

## Surface Smoke Matrix

Use these route-specific checks after touching the matching area:

| Changed area | Smoke commands |
|---|---|
| App shell/routes/default readiness | `npm run smoke:renderer:default-readiness`, `npm run smoke:renderer:phase-six` |
| Studio runtime | `npm run smoke:renderer:studio`, `npm run smoke:renderer:runtime-boundary`, `npm run smoke:renderer:studio-meow-viewer` |
| Workspace terminal/viewer | `npm run smoke:renderer:workspace-route-keepalive`, `npm run smoke:renderer:workspace-output-renderer` |
| Claude/Hermes Viewer parsing | `npm run test:meow-viewer-parser`, `npm run smoke:renderer:workspace-output-renderer-claude-startup`, `npm run smoke:renderer:workspace-output-renderer-claude-chat` |
| Workspace right-sidebar owner | `npm run smoke:renderer:right-sidebar-owner`, `npm run smoke:renderer:r15-r2a` |
| Workshop CRUD/import/export | `npm run smoke:renderer:workshop-data`, `npm run smoke:renderer:workshop-ready`, `npm run smoke:renderer:workshop-detail`, `npm run smoke:renderer:workshop-export`, `npm run smoke:renderer:workshop-import` |
| Runtime permissions | `npm run test:runtime-safety`, `npm run test:workbench-contract` |
| Product surfaces | `npm run smoke:renderer:r1-functions`, `npm run smoke:renderer:r3-product-surfaces` |
| Dev Helper acceptance ledger | `npm run dev-helper:acceptance-check` |

Use the full gate before calling a maintenance phase complete:

```text
npm run verify:renderer
```

## External Engineering Review

Before asking Claude or another external reviewer to judge the project, refresh
the local evaluation packet:

```text
npm run audit:maintenance
npm run audit:project
```

Then use:

```text
docs/analysis/meodesk-project-evaluation-packet.md
docs/analysis/meodesk-claude-evaluation-prompt.md
```

Before handing an external review packet to GPT, validate the project-specific
manifest and generated Markdown:

```text
npm run validate:review-packet -- <review-packet-directory>
```

The validator checks required files, commit hashes, bundle HEAD/status evidence,
unexpanded placeholders, and accidental generator-script residue. It does not
modify the packet or treat Drive as a live development root.

The external review should classify issues as blockers, urgent debt, worthwhile
follow-up, or over-governance/false positive. It should not recommend restoring
retired runtime paths or block local feature development on public-release-only
requirements.

## Archived Workflow Beta

Workflow Beta CDP/runtime smoke commands are not part of the current MVP
verification contract. Use the archive branch/tag only for historical
inspection. A future Workflow feature must define a new product contract,
runtime owner, permission boundary, and verification plan before code returns.

## Safe Change Patterns

- Add parser fixtures before changing Meow Viewer parser behavior.
- Keep route components thin by moving reusable behavior into feature-local
  helpers or hooks.
- Keep IPC path validation close to the main service boundary.
- Prefer explicit errors over silent skips in tests and smoke scripts.
- Treat hidden Electron smokes as isolated test launches with temporary user
  data, not as the user's real app session.
- Add or change hidden Electron smoke behavior in
  `src/main/renderer-smoke-scenarios/*-scenarios.js`, then register the scenario
  through `src/main/renderer-smoke-scenarios/index.js`.
- Keep `src/main/renderer-smoke-runner.js` dispatch-only. Do not paste long
  `executeJavaScript` scenario bodies back into the runner or heavy wrapper.
- When CSS changes touch layout, run the smoke for that visible surface.

## Known Residual Debt

These are not blockers for normal maintenance, but they are the next cost
centers:

- `workspace-route.tsx` and `studio-route.tsx` are still large runtime surfaces.
  Read `workspace-route-hotspots.md` and `studio-route-hotspots.md` before
  touching their hotspot areas.
- `meow-viewer-parser.ts` is behavior-rich and needs fixtures before further
  splitting.
- Renderer smoke now has a registry and domain scenario modules. The remaining
  smoke debt is inside individual long scenario bodies and repeated in-browser
  DOM helpers, not in the central runner.
- `app.css` is segmented but still large. Read `css-admission-policy.md` before
  adding new selector families or broad route/layout styles.
- The Phase H route split removed the renderer main chunk warning; keep future
  eager imports aligned with `docs/architecture/performance-bundle-governance.md`.
- Hidden terminal smokes should remain free of node-pty `AttachConsole failed`
  noise after the smoke-only Windows PTY mitigation. If it returns, treat it as
  verification-noise debt, not as expected permanent output.

## Completion Checklist

Before handing off a change:

- Active renderer remains next-only.
- Retired legacy renderer files are still absent.
- No new feature was placed in readiness, smoke runner, or main coordinator as a
  shortcut.
- Touched IPC or filesystem paths have rejection behavior covered.
- The narrow gate for the touched surface passed.
- `npm run verify:renderer` passed for phase completion or broad changes.
- Documentation and `docs/analysis` were updated when structure or verification
  meaning changed.

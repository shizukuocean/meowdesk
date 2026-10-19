# Engineering Governance Roadmap

> Status: Phase 2 governance plan after the 2026-06-07 Phase 0-11 debt cleanup.
> Scope: sustainable development governance for the active Meowdesk rebuild
> worktree, not a feature roadmap and not a UI redesign plan.

## Objective

Move Meowdesk from "large debt cleanup completed" to "future development is
harder to accidentally corrupt."

This roadmap focuses on systems that prevent debt from re-accumulating:

- stable anchors and recovery evidence
- ownership boundaries
- verification speed and signal quality
- runtime permissions and safety
- performance and bundle governance
- release engineering readiness
- feature admission discipline

## Current Anchor

The latest non-commit anchor is:

```text
<DESKTOP>\meowdesk-governance-phase2-anchor-20260607-222132
```

It contains WSL Git status, tracked patch, diff summaries, untracked list, and a
source snapshot excluding dependencies/build outputs.

No local commit was created because Shizuku had not explicitly authorized a
commit.

## Non-Goals

Do not use this governance phase to:

- add product features
- adjust UI style or layout
- restore the retired legacy renderer
- restore desktop embedding, `getDisplayMedia`, or raw HWND `SetParent`
- migrate the whole test stack to another framework in one step
- mechanically split files only to satisfy a line-count target
- touch the main baseline worktree at `<BASELINE_ROOT>`

## Phase A: Recovery And Anchors

Goal: make large maintenance work recoverable before more changes accumulate.

Deliverables:

- local commit if explicitly authorized, otherwise evidence package
- branch/worktree status record
- tracked patch
- untracked file list
- dependency-free source snapshot
- validation summary

Evidence:

- anchor directory exists
- `git-status-short.txt` records branch and dirty state
- `tracked-worktree.patch` exists
- source snapshot exists

Stop condition:

- continuing work no longer depends on chat memory to reconstruct the previous
  verified state.

## Phase B: Ownership Governance

Goal: make it obvious where code should live before implementation starts.

Deliverables:

- ownership matrix for renderer, main process, smoke tests, CSS, plugins, and
  data boundaries
- "do not add here" list for known pressure files
- module admission checklist for new work

Current documents:

- `docs/architecture/ownership-governance.md`
- `docs/architecture/feature-admission-checklist.md`
- `docs/architecture/runtime-safety-permissions.md`
- `docs/architecture/performance-bundle-governance.md`
- `docs/architecture/release-readiness.md`

Current pressure files:

```text
src/renderer-app/src/features/workspace/workspace-route.tsx
src/renderer-app/src/features/studio/studio-route.tsx
src/renderer-app/src/features/meow-viewer/meow-viewer-parser.ts
src/renderer-app/src/styles/app.css
src/main.js
```

Phase M moved hidden renderer smoke dispatch into compact runner/registry files
and scenario-specific bodies into `src/main/renderer-smoke-scenarios/`. The
remaining smoke cleanup is helper extraction inside long scenario bodies, not a
central runner pressure file.

Phase N moved Workspace and Studio route-local pure model/storage helpers into
`src/renderer-app/src/features/workspace/workspace-model.ts` and
`src/renderer-app/src/features/studio/studio-model.ts`, and moved shared
path-to-file-URL conversion into `src/renderer-app/src/lib/file-url.ts`. The
route files remain pressure files, but future storage, sizing, ordering, and
project-draft helpers should not be reintroduced into the route components.

Phase P started Meow Viewer physical ownership cleanup by moving shared data
contract/profile detection into
`src/renderer-app/src/features/meow-viewer/meow-viewer-contract.ts`. The parser
still owns behavior-rich transcript parsing, but Workspace/Studio and Viewer UI
modules no longer need parser imports for profile/type-only concerns. Continue
Phase P by splitting source event adapter behavior and fixture groups before
touching parser rules. The first fixture split now lives under
`scripts/meow-viewer-parser-fixtures/`, and `test:meow-viewer-parser:check`
is part of `verify:renderer`.

Phase Q started main-process second-pass cleanup by moving Meodesk Home
directory/storage ownership into `src/main/meodesk-home-service.js`. `src/main.js`
keeps the IPC wiring and composed `storage:getInfo` view, while Home migration,
storage file mapping, runtime cache path, workflow directory, and conversation
directory helpers live in the service.

Phase Q also moved Agent runtime launch projection into
`src/main/agent-runtime-launch-service.js`: runtime env variables, Claude/Hermes
argument insertion, Hermes session skill shell injection, WSL path/env export,
and runtime args now live outside the main coordinator.

Phase R moved Agent runtime prompt/context generation into
`src/main/agent-runtime-context-service.js`: Workshop/Workflow runtime
normalizers, human-readable runtime context markdown, Workshop type rules,
Workshop session skill markdown, and Workflow session prompt/skill markdown now
live outside the main coordinator. `src/main.js` keeps session directory
selection, runtime JSON assembly, file writes, and terminal runtime injection.

Stop condition:

- a future task can identify its owner, tests, safety boundary, and forbidden
  shortcuts before editing.

## Phase C: Verification Platform

Goal: make verification faster, quieter, and harder to fake.

Deliverables:

- script taxonomy: fast, surface, full, CDP, release
- reduced repeated renderer builds where practical
- explicit smoke prerequisite documentation
- node-pty smoke shutdown-noise mitigation or classification
- static analysis/report generation workflow

Evidence:

- `npm run verify:renderer` still passes
- narrow smoke commands remain available
- CDP-dependent checks fail with prerequisite messages rather than fake green
- no retired renderer path is used as a passing condition
- renderer smoke leaf scripts use `scripts/run-renderer-smoke-command.js`
- full renderer verification passed in 223.6 seconds on 2026-06-07 after
  build-reuse wiring and smoke-noise mitigation
- Windows hidden terminal smoke noise is mitigated in smoke mode without
  changing normal product PTY behavior
- hidden smoke GPU shutdown noise is mitigated in smoke mode without changing
  normal product rendering

Stop condition:

- developers can choose a correct verification gate without reading package
  scripts line by line.

## Phase D: Runtime Safety And Permissions

Goal: make unsafe operations explicit and reject invalid access at boundaries.

Deliverables:

- IPC payload validation inventory
- filesystem boundary inventory
- plugin iframe permission model
- external URL/path opening policy
- Obsidian vault access policy
- Agent command execution boundary checklist

Evidence:

- contract tests or smoke fixtures cover rejection behavior for widened
  boundaries
- docs name what is allowed, what is rejected, and where validation lives
- `docs/architecture/runtime-safety-permissions.md` records the current bridge
  surface, high-risk methods, and minimum tests before widening access

Stop condition:

- adding a new IPC/file/plugin capability requires a clear permission decision,
  not only a UI button.

## Phase E: Performance And Bundle Governance

Goal: reduce known runtime and development friction before adding more surface.

Deliverables:

- renderer chunk/bundle plan
- terminal/sourceEvents parsing-cost map
- Meow Viewer parser fixture-first split plan
- smoke runtime cost notes
- startup and package-size notes

Evidence:

- Vite chunk warning is either reduced or tracked with a concrete split plan
- parser changes are covered by fixtures before refactor
- smoke time/noise is tracked as a governance metric
- `docs/architecture/performance-bundle-governance.md` records the current
  1.1 MB renderer chunk and the route-splitting order

Stop condition:

- performance work is attached to measurable signals rather than subjective
  "feels slow" notes alone.

## Phase F: Release Engineering

Goal: prepare Meowdesk for stable local releases instead of relying on a dev
folder.

Deliverables:

- release readiness checklist
- dependency and package-size inventory
- version/stable-anchor policy
- user-data migration and rollback notes
- installer/distribution prerequisites
- crash/log diagnostics plan

Evidence:

- release blockers are separated from development blockers
- package/dependency risks are documented before any public packaging attempt
- `docs/architecture/release-readiness.md` separates source-run readiness from
  distributable release readiness

Stop condition:

- "can run from source" is no longer confused with "ready to ship."

## Phase G: Feature Admission Discipline

Goal: prevent future feature work from recreating the current debt pattern.

Deliverables:

- pre-feature checklist
- core-chain modification checklist
- required test matrix by owner
- documentation writeback route
- explicit no-go list for readiness/main/smoke runner/CSS shortcuts

Current document:

- `docs/architecture/feature-admission-checklist.md`

Admission checklist:

```text
1. What owner folder/module receives the change?
2. What IPC/filesystem/plugin boundary changes?
3. What existing tests prove the old behavior still works?
4. What new unit/contract/smoke proves the new behavior?
5. What failure mode is rejected, not silently skipped?
6. Does the change touch a pressure file?
7. Does it require documentation or Brain2 writeback?
8. Is it feature work, maintenance work, release work, or experiment?
```

Stop condition:

- future work starts with ownership and validation, not with "just add it here."

## Completion Criteria

Engineering Governance Phase 2 is complete only when:

- a stable anchor or authorized local commit exists
- roadmap, ownership, verification, safety, performance, release, and feature
  admission documents exist and are linked from the project docs
- at least one concrete verification improvement is implemented, not only
  described
- `npm run verify:renderer` passes after changes
- Brain2 records the new development discipline and remaining non-blocking debt

## Current Recommended Order

1. Finish Phase A anchor package.
2. Write and link this roadmap.
3. Add ownership and feature admission docs/checklists.
4. Improve verification speed/noise without weakening coverage.
5. Create safety/performance/release inventories.
6. Run full verification.
7. Write back to Brain2.

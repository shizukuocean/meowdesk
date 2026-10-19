# Studio Route Hotspots

> Status: feature-admission guardrail for the current Studio route.
> Scope: `src/renderer-app/src/features/studio/studio-route.tsx`.

## Purpose

`studio-route.tsx` remains a large runtime surface, but it is governed and no
longer owns pure model/storage helpers. Treat it as the Studio coordinator and
UI composition surface, not as a place to add new low-level runtime, parser, or
storage policy.

## Current Ownership

| Owner | Files | Rule |
|---|---|---|
| Studio route composition | `studio-route.tsx` | Studio page, inspector, project cards, Agent runtime stage, preview/overlay composition |
| Studio model/storage | `studio-model.ts` | draft defaults, project type mapping, publish/export records, enabled extension state |
| Workshop main service | `src/main/workshop-service.js` | create/import/export/package safety and project filesystem behavior |
| Agent runtime services | `src/main/agent-runtime-*.js` | runtime prompt/context/env/launch projection |
| Meow Viewer core | `features/meow-viewer/*` | parser/source/contract/conversation/composer behavior |

## Hotspot Map

Line numbers are current anchors, not permanent contracts. Re-check nearby code
before editing.

| Area | Current anchors | Risk | Preferred move |
|---|---:|---|---|
| Studio top-level state and project operations | 135-690 | drafts, real workshop projects, import/export/publish status | Pure model/storage stays in `studio-model.ts`; package behavior stays in main workshop service |
| Project list/detail composition | 717-1080, 1958-2929 | card actions, detail actions, enable/export readiness | Keep action payloads typed; use workshop smokes after changes |
| Studio Meow Viewer overlay | 1099-1210 | shared Viewer source/composer adapter | Shared behavior belongs in `features/meow-viewer`; Studio passes source/session/action adapter only |
| Agent runtime stage | 1241-1830 | terminal/xterm lifecycle, source adapter opt-in, runtime context | Runtime changes require terminal/source adapter and runtime-boundary smokes |
| Desktop Agent placeholder/projection status | 1854-1938 | visible desktop-agent promise/disabled state | Do not restore desktop embedding or HWND hosting |
| Runtime boundary panels | 2130-2360 | protected runtime declarations and iframe boundaries | Keep as boundary evidence; do not turn archived Workflow material into a live runtime shortcut |
| Extension enable/export/publish actions | 2367-3030 | sidebar enable state, feature-page state, `.meow` export/publish | Storage helpers stay in `studio-model.ts`; package safety stays in main service |
| Project preview iframe | 3168-3248 | iframe theme/init, preview shell | Do not widen iframe sandbox, persistence, or parent bridge without permission docs and tests |

## Extract-First Triggers

Extract a hook/component/helper before the behavior change when any of these are
true:

- The change adds new persisted Studio state, publish/export metadata, or
  enabled-extension state.
- The change widens `.meow` create/import/export/install behavior.
- The change touches Agent terminal lifecycle, source adapter activation, or
  runtime prompt/context injection.
- The change changes Studio Meow Viewer source/session binding.
- The change widens iframe preview/host permissions or parent message handling.
- The route would gain another long async workflow or broad `useEffect`.

Small direct edits are allowed when they:

- Adjust labels, icons, tab wiring, or existing action placement.
- Fix a local rendering bug without new runtime or persistence semantics.
- Preserve the existing protected runtime boundary.

## Do Not Add Here

- Parser heuristics.
- Workshop filesystem/package safety rules.
- Runtime prompt/context construction.
- Desktop embedding, `getDisplayMedia`, HWND hosting, or projection revival.
- New iframe bridge/persistence behavior without a permission model.
- New CSS systems.

## Minimum Gates

Choose the narrowest matching gates:

```text
npm run typecheck:renderer
npm run build:renderer
npm run smoke:renderer:studio
npm run smoke:renderer:runtime-boundary
npm run smoke:renderer:studio-meow-viewer
npm run smoke:renderer:terminal-boundary
npm run smoke:renderer:workshop-data
npm run smoke:renderer:workshop-ready
npm run smoke:renderer:workshop-detail
npm run smoke:renderer:workshop-export
npm run smoke:renderer:workshop-import
npm run smoke:renderer:right-sidebar-owner
npm run test:runtime-safety
npm run test:workbench-contract
```

Run `npm run verify:renderer` before declaring a broad Studio phase complete.

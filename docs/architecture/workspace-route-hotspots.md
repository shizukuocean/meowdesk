# Workspace Route Hotspots

> Status: feature-admission guardrail for the current Workspace route.
> Scope: `src/renderer-app/src/features/workspace/workspace-route.tsx`.

## Purpose

`workspace-route.tsx` is a large but governed runtime surface. It is not a
blocker for feature development, and it should not be split mechanically for
line count alone.

Use this file before changing Workspace behavior so future work does not put
model, storage, terminal, Viewer, or widget logic back into the route body.

## Current Ownership

| Owner | Files | Rule |
|---|---|---|
| Workspace route composition | `workspace-route.tsx` | UI composition, pane lifecycle wiring, terminal host mounting, sidebar/pet surface wiring |
| Workspace model/storage | `workspace-model.ts` | pane config, ordering, sizing, sidebar widget state, pet state persistence |
| Meow Viewer core | `features/meow-viewer/*` | parser/source/contract/conversation/composer behavior |
| Workbench API | `src/renderer-app/src/lib/workbench-api.ts` plus preload/main contract | IPC payload shape and runtime bridge |
| CSS leaf | `src/renderer-app/src/styles/app.css` | existing global visual rules only |

## Hotspot Map

Line numbers are current anchors, not permanent contracts. Re-check nearby code
before editing.

| Area | Current anchors | Risk | Preferred move |
|---|---:|---|---|
| Sidebar widget iframe host | 106-416 | iframe URL, theme, resize, message surface | Keep host behavior in small components; do not widen message bridge without runtime permission review |
| Workspace terminal runtime | 758-1239 | xterm lifecycle, resize, source adapter opt-in, terminal events | Add tests/smoke for start/write/resize/kill/source adapter; avoid raw transcript work outside Viewer binding |
| Meow Viewer Workspace adapter | 1273-1475 | source selection, parser profile, composer actions | Keep shared behavior in `features/meow-viewer`; route should only adapt pane/source/session |
| Workspace route state cluster | 1615-1724 | many state holders for panes, sidebar, pets, terminal, Viewer | New pure helpers go to `workspace-model.ts`; new feature hooks/components should stay feature-local |
| Sidebar/board/pet sizing | 2066-2168 | pointer drag, persisted sizes, bounds | Reuse clamps in `workspace-model.ts`; broad changes should extract a focused hook |
| Pet drag/animation bridge | 2170-2266 plus actor effects | pointer drag, motion state, per-pane pet mapping | Do not mix terminal/runtime semantics into pet state |
| Pane ordering/hide/close lifecycle | 2386-2559 | drag order, hidden panes, close confirmation, terminal kill | Run keepalive/output smokes; broad changes should extract pane lifecycle helpers |
| Rendered pane grid and side column | 2581-2950 | route layout, pane data attributes, side panel surfaces | CSS/layout changes need affected smoke and non-overlap review |

## Extract-First Triggers

Extract a hook/component/helper before the behavior change when any of these are
true:

- The change adds new persistent state or storage behavior.
- The change widens terminal lifecycle, source adapter, or Viewer binding logic.
- The change adds a new iframe/widget message, permission, or persistence path.
- The change touches pane ordering, hide/restore, close, or keep-alive behavior
  and is more than a small bug fix.
- The change adds a reusable pure helper, data normalizer, clamp, serializer, or
  localStorage reader/writer.
- The route would gain another long `useEffect`, pointer-drag block, or
  multi-step async workflow.

Small direct edits are allowed when they:

- Fix a local bug without adding new state or storage.
- Adjust labels, icons, data attributes, or small layout class wiring.
- Preserve existing owner boundaries and are covered by a narrow smoke.

## Do Not Add Here

- Parser rules or profile detection.
- New raw transcript heuristics.
- New model/storage helpers.
- New broad IPC permission policy.
- New CSS selector systems.
- Product behavior shortcuts that belong in readiness fixtures.

## Minimum Gates

Choose the narrowest matching gates:

```text
npm run typecheck:renderer
npm run build:renderer
npm run smoke:renderer:workspace-route-keepalive
npm run smoke:renderer:workspace-output-renderer
npm run smoke:renderer:workspace-output-renderer-claude-startup
npm run smoke:renderer:workspace-output-renderer-claude-chat
npm run test:meow-viewer-parser
npm run test:workbench-contract
npm run test:runtime-safety
```

Run `npm run verify:renderer` before declaring a broad Workspace phase complete.

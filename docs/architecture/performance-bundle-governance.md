# Performance And Bundle Governance

> Status: current performance governance inventory for Engineering Governance
> Phase 2.
> Scope: renderer bundle size, route loading, parser cost, terminal source
> capture, smoke runtime, and measurable follow-up gates.

## Current Signals

Latest Phase H renderer build output on 2026-06-07:

```text
dist/renderer-app/assets/index-*.css              157.05 kB
dist/renderer-app/assets/index-*.js               358.14 kB
dist/renderer-app/assets/meow-viewer-source-*.js  372.55 kB
dist/renderer-app/assets/studio-route-*.js         89.11 kB
dist/renderer-app/assets/workspace-route-*.js      67.54 kB
```

The previous Phase 2 baseline had a 1,107.37 kB eager main renderer chunk and a
Vite over-500 kB warning. Phase H moved route surfaces behind lazy boundaries,
including keepalive-aware first-activation loading for Workspace and Studio. The
main chunk no longer trips the Vite warning; Meow Viewer remains a large shared
behavior chunk and should be treated as the next performance-sensitive surface.

Latest full renderer verification after build reuse:

```text
npm run verify:renderer
# passed in 223.6 seconds after build reuse and smoke-noise mitigation
```

## Bundle Ownership

| Surface | Current pressure | Governance rule |
|---|---|---|
| `src/renderer-app/src/app/App.tsx` | Owns route shell and light top-action models | Do not add new large feature imports here without route-loading review |
| Workspace/Studio | Lazy after first activation, keep mounted after visit | Preserve keepalive/session semantics before changing route boundaries |
| Lobby/Tasks/Workflow/Conversations/Obsidian/Profile/Plugins | Lazy route-sized surfaces | Keep feature-only helpers out of the app shell unless they are intentionally lightweight models |
| Meow Viewer parser/conversation | Behavior-rich parser and renderer | Fixture-first refactor before any performance split |
| CSS | One large visual leaf | Remove dead selectors only with affected surface smoke |

## Route Splitting Order

Do not solve the warning by only raising `chunkSizeWarningLimit`.

Preferred order:

1. Keep non-keepalive route surfaces lazy: Lobby, Tasks, Workflow,
   Conversations, Obsidian, Profile, Plugins.
2. Keep Workspace and Studio first-activation lazy, then mounted after visit.
3. Move Access settings out of readiness when it grows again; readiness should
   remain composition/glue, not a route barrel for product features.
4. Use build output and route smokes as evidence after each split.

Minimum gate after route splitting or route-shell dependency changes:

```text
npm run build:renderer
npm run smoke:renderer:workspace-route-keepalive
npm run smoke:renderer:studio
npm run smoke:renderer:studio-meow-viewer
npm run smoke:renderer:phase-six
npm run smoke:renderer:compact
npm run smoke:renderer:r3-product-surfaces
```

Run the full gate before phase completion:

```text
npm run verify:renderer
```

## Parser And SourceEvents Cost

Meow Viewer cost is not only bundle size. Terminal source capture and parser
normalization can become runtime bottlenecks.

Rules:

- Add parser fixtures before changing parsing heuristics.
- Keep terminal raw/display source event caps explicit.
- Do not move source adapter behavior into renderer route components.
- Treat Claude/Hermes output rendering smokes as performance-risk coverage, not
  only visual smoke.

Required gates:

```text
npm run test:meow-viewer-parser
npm run smoke:renderer:workspace-output-renderer
npm run smoke:renderer:workspace-output-renderer-claude-startup
npm run smoke:renderer:workspace-output-renderer-claude-chat
```

## Smoke Runtime Cost

Build reuse is the first concrete speed improvement: smoke leaf scripts can now
reuse one renderer build under `verify:renderer`.

Rules:

- Do not add repeated renderer builds back into smoke leaf scripts.
- Keep CDP-dependent `smoke:workflow` outside `verify:renderer` unless the
  prerequisite can be made isolated and automatic.
- Track runtime and noise when a new heavy smoke is added.

Current target:

```text
verify:renderer should stay below the old 286 second baseline unless coverage
meaningfully expands.
```

## Release Size Notes

Before packaging, collect:

- renderer asset sizes
- Electron app package size
- native dependency footprint, especially `node-pty`
- generated Meodesk Home fixture/package size
- startup time from packaged app, not only source mode

These belong in release engineering evidence, not in feature notes.

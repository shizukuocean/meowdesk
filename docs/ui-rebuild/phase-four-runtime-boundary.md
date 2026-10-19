# Phase Four Runtime Boundary

> Status: second batch verified
> Scope: Agent / Terminal / task-center migration boundary
> Rule: wrap protected runtime before rewriting lifecycle

Current cleanup note: this document records the original phase-four boundary.
The legacy renderer is now retired; references to legacy runtime below mean
older protected runtime services, not a launchable renderer.

## Goal

Phase four starts runtime-sensitive migration without moving xterm, Agent
process management, or task persistence into React yet.

The first safe step is a visible runtime boundary in Studio:

```text
React next shell
  -> shows Agent / Terminal / task-center boundary state
  -> reads configured Agent count through the typed adapter path
  -> keeps terminal and process lifecycle in protected runtime
```

## First Batch

- Studio includes a `Runtime boundary` panel.
- The panel shows:
  - configured Agent count from `getConfig().tools`;
  - Terminal runtime as protected/deferred;
  - task center as deferred/protected.
- No xterm instance is created by React.
- No terminal start/write/resize/kill lifecycle is changed.
- No task persistence format is changed.

## Second Batch

The second batch keeps the same runtime ownership boundary, but makes the
layout and terminal descriptor contract explicit:

- Studio uses an Agent-first layout. The Agent / terminal viewport is the main
  stage and keeps the largest continuous area.
- Project types, project list, project detail, runtime metadata, and terminal
  session state are collected into one side Inspector.
- The Runtime boundary panel lives in the Inspector instead of becoming a
  separate bottom tool that compresses the Agent stage.
- `getConfig().tools` may be normalized into read-only
  `TerminalSessionDescriptor` records.
- Terminal descriptors are contract-only. They do not start, write, resize,
  kill, mount, fit, attach, or dispose xterm.
- Protected runtime remains the owner of PTY, stdin/stdout, process kill, and
  xterm lifecycle.

## Verification

New smoke:

```text
npm run smoke:renderer:runtime-boundary
npm run smoke:renderer:terminal-boundary
```

These smokes open next Studio and assert:

- Agent stage is visible.
- Inspector can open the runtime tab.
- runtime boundary panel is visible inside the Inspector.
- Terminal runtime row reports protected runtime status.
- task-center row reports protected runtime status.
- `studio-terminal-boundary` seeds one terminal tool and verifies that the
  descriptor count and terminal display name are rendered.
- terminal mount contract text is visible.

The smoke is included in:

```text
npm run verify:renderer
```

## Next Boundary Steps

Recommended next steps:

1. Add a typed terminal-session adapter that can describe a session without
   owning xterm rendering. `TerminalSessionDescriptor` is the current first
   version of this adapter surface.
2. Add a real terminal mount contract before any React terminal
   component.
3. Add task-center read-only summary before allowing task writes.
4. Only then decide whether xterm is wrapped, embedded, or migrated route by
   route.

## Do Not Do Yet

- Do not start Agent processes from the next renderer.
- Do not create a React-owned xterm lifecycle.
- Do not migrate task persistence and terminal lifecycle in one patch.
- Do not use the retired legacy renderer as a rollback path.

# Phase Six Default Readiness

> Status: first batch verified
> Scope: function reachability and default renderer switch
> Rule: historical phase-six gate; current cleanup has retired the legacy
> renderer entry

## Goal

Phase six turns the next renderer into the default-entry candidate for the UI
rebuild worktree.

```text
MEOWDESK_RENDERER unset
  -> next renderer

MEOWDESK_RENDERER=legacy
  -> historical rollback path during phase six; now rejected in this worktree
```

This is not a full runtime rewrite. The goal is that the user can enter the new
Meowdesk shell and find every major product area, while dangerous runtime
surfaces are clearly marked as deferred/protected runtime boundaries.

## Implemented Reachability

Top-level next routes now cover:

- Lobby;
- Studio / workshop;
- plugin marketplace;
- task center;
- Workflow Beta;
- profile center.

Runtime-heavy surfaces remain protected:

- profile writes, avatar file handling, and formal auth;
- plugin install/enable lifecycle outside the existing Studio safe subset;
- right-sidebar iframe host, resize, theme, message bridge, and persistence;
- task write/edit/drag/drop/day-schedule persistence;
- Workflow Beta canvas, message bus, Agent battery, and execution chain;
- terminal/xterm and Agent process lifecycle.

## Verification

New smoke:

```text
npm run smoke:renderer:default-readiness
npm run smoke:renderer:phase-six
```

These smokes verify:

- default renderer with `MEOWDESK_RENDERER` unset loads next;
- explicit next still loads next;
- all six top-level routes become active from the sidebar;
- phase-six routes render fullscreen-aware surfaces;
- profile, task center, Workflow Beta, and right-sidebar iframe deferred
  runtime markers are present;
- route shells do not introduce horizontal overflow.

Both smokes are included in:

```text
npm run verify:renderer
```

## What This Does Not Mean

Phase six did not mean the old runtime had been deleted or fully rewritten. The
later cleanup retired the old renderer entry, while still keeping several older
runtime services behind explicit protected/deferred boundaries.

The follow-up "rebuild" planning pass should decide which runtime systems are
rebuilt first and which are kept as stable legacy services behind the new shell.

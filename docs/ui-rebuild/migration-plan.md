# Meowdesk UI Rebuild Migration Plan

> Goal: rebuild the renderer shell without interrupting current Meowdesk
> functionality.

## Current Status

This is a historical migration plan. It describes how the next renderer was
introduced. The current worktree no longer keeps `src/renderer/*` as an active
renderer rollback path; those files are retired and `MEOWDESK_RENDERER=legacy`
is rejected by `src/main/renderer-entry.js`.

For current ownership, see
[`docs/architecture/current-runtime-boundaries.md`](../architecture/current-runtime-boundaries.md).

## Safety Position

Do not perform a big-bang replacement. Use backups, Git history, and focused
verification gates for recovery. The current V0.2 baseline remains recoverable
outside this worktree, but not by launching `MEOWDESK_RENDERER=legacy` here.

Current pre-rebuild backup:

```text
<BACKUP_ROOT>\20260530-082713-ui-rebuild-prebackup
<BACKUP_ROOT>\20260530-082713-ui-rebuild-prebackup.zip
```

## Recommended Technical Shape

The original recommendation was to add a new renderer app without deleting the
old renderer:

```text
src/
  main.js
  preload.js
  renderer/             # retired after migration cleanup
  renderer-app/         # new React + Tailwind + shadcn/ui app
    index.html
    src/
      app/
      components/
      features/
      lib/
      styles/
```

Build output should go to a generated folder such as:

```text
dist/renderer-app/
```

The Electron main process has an explicit switch for loading either renderer.
During phases one through five the legacy renderer remained default. In phase
six the UI rebuild worktree switched the default to next. After the later
cleanup, the old renderer files were retired and the next renderer became the
only normal UI entry.

Example intent:

```text
MEOWDESK_RENDERER unset  -> dist/renderer-app/index.html
MEOWDESK_RENDERER=next   -> dist/renderer-app/index.html
MEOWDESK_RENDERER=legacy -> rejected; retired renderer
```

The exact environment flag can be decided during implementation.

## Package Direction

Expected additions:

- React;
- Vite or another small renderer bundler;
- Tailwind CSS;
- shadcn/ui dependencies;
- lucide-react;
- class-variance-authority / clsx / tailwind-merge;
- GSAP after the first static shell is stable.

Do not add GSAP before the first route has a stable layout and component
grammar.

## Migration Phases

### Phase 0: Guardrails

- Keep the old renderer launch path only during the migration window.
- Add the new renderer behind an explicit switch.
- Keep `preload.js` API compatible.
- Add documentation and acceptance gates.
- Avoid Meowdesk Home data migration.

### Phase 1: New Shell and Sample Route

Build:

- `AppShell`
- `TopNav`
- `PageHeader`
- basic route state
- theme tokens
- Button, Tabs, Panel, Dialog, Tooltip, StatusBadge

Sample route candidates:

1. Lobby / personal center / plugin marketplace
2. Studio / workshop overview

Recommended first sample: Lobby.

Reason:

- It is the user's first impression.
- It has product identity, account/profile, plugin ecosystem, and navigation.
- It can be rebuilt without immediately touching xterm or Agent runtime.
- It gives the clearest visual proof of the new design language.

Studio should be the second sample because it proves Meowdesk's most distinctive
product idea: Agent-built tools.

### Phase 2: Studio Route

Migrate the visible shell for:

- Studio overview;
- create type selection;
- Agent station placeholder;
- project card list;
- plugin post entry points.

Do not migrate terminal runtime first. Use a stable placeholder or a wrapped
legacy terminal mount until the shell is proven.

### Phase 3: Workspace Skeleton

Migrate only the layout skeleton:

- top route frame;
- pane layout;
- right sidebar container;
- sidebar widget cards;
- pet dock container.

Keep terminal internals and iframe plugin loading behind adapters.

### Phase 4: Runtime-Sensitive Modules

Only after shell parity:

- xterm terminal lifecycle;
- Agent process state;
- sidebar widget iframe loading and resizing;
- task center persistence;
- workflow canvas interactions.

These modules should not be first movers.

## Non-Goals for Phase One

- Do not redesign product scope.
- Do not migrate Meowdesk Home path names.
- Do not remove the old renderer during phase-one migration. After cleanup, use
  the current runtime-boundary document instead of this historical gate.
- Do not rebuild the workflow engine.
- Do not rewrite Agent runtime behavior.
- Do not add decorative motion before layout works.

## Verification Gates

Each phase must pass:

- `node --check src/main.js`
- `node --check src/preload.js`
- active baseline/contract tests: `npm run test:baseline` and
  `npm run test:workbench-contract`
- Electron launch check for the active renderer path
- visual screenshot review at 1280px width

Runtime-sensitive phases must also verify:

- terminal starts and receives input;
- right sidebar plugin iframe loads;
- Studio project list scans;
- task data persists;
- workflow Beta remains viewable if included in that phase.

## Rollback Rule

During the original migration, rollback used the renderer flag. In the current
worktree, rollback means restoring from a known backup/Git anchor; do not expect
`MEOWDESK_RENDERER=legacy` to load deleted files.

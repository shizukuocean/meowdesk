# Release Readiness

> Status: release-engineering inventory for Engineering Governance Phase J.
> Scope: what must be true before treating Meowdesk as shippable, not merely
> runnable from source.

## Current Position

Meowdesk can be verified from source in the active rebuild worktree. That is not
the same as a distributable release.

Current source gate:

```text
npm run verify:renderer
```

Current minimal release inventory:

```text
npm run release:minimal-check
```

The script writes:

```text
docs/analysis/meodesk-release-minimal-check.md
docs/analysis/meodesk-release-minimal-check.json
```

Current internal package loop:

```text
npm run package:internal
npm run smoke:packaged-launch
npm run release:minimal-check
```

Latest Phase O result: source checkpoint prerequisites are present, and the
internal unpacked package loop is available. `package:internal` stages
`out/meowdesk-internal-unpacked/resources/app` with the renderer build, main
process source, assets, config, and runtime dependency closure. The packaged
launch smoke starts that app with an isolated `MEOWDESK_USER_DATA_DIR` and
records:

```text
docs/analysis/meodesk-packaged-launch-smoke.md
docs/analysis/meodesk-packaged-launch-smoke.json
```

This is still an internal unpacked package, not an installer, signed artifact,
or public distribution.

Current CDP-dependent gate:

```text
npm run smoke:workflow
```

`smoke:workflow` requires a real running Meowdesk instance with CDP exposed and
is intentionally separate from the isolated renderer gate.

## Release Classes

| Class | Meaning | Minimum evidence |
|---|---|---|
| Source checkpoint | Local worktree can be verified and recovered | Git status/patch anchor or authorized commit; `verify:renderer` passed |
| Internal test build | Packaged app can launch on the local machine | package command, launch smoke, userData isolation notes |
| Manual beta | User can install/run with documented rollback | installer, version policy, migration/rollback notes |
| Public release | Supportable outside the developer machine | signed/package artifact, diagnostics, crash/log plan, dependency audit |

## Release Blockers To Separate From Dev Blockers

Development can continue with these tracked, but release cannot:

- No installer workflow documented.
- No versioned release-anchor policy.
- No user-data migration and rollback note.
- No diagnostic/log collection plan for terminal/Agent failures.
- Packaged mode has proven basic next-renderer launch, but has not yet proven
  terminal start/write/kill with `node-pty`.
- Renderer main chunk warning was reduced by Phase H; keep
  `release:minimal-check` and performance governance as regression signals.

## Minimum Release Checklist

Before an internal test build:

```text
npm run verify:renderer
npm run analyze:deps
npm run audit:maintenance
npm run package:internal
npm run smoke:packaged-launch
npm run release:minimal-check
```

Then record:

- exact branch and commit or non-commit anchor
- package command and output directory
- app launch result
- renderer entry selected by default
- userData path used for test launch
- whether terminal start/write/kill works in packaged mode
- whether Workshop import/export writes only under Meodesk Home
- whether Obsidian reads stay inside selected vaults
- known warnings and accepted risks

## Version And Anchor Policy

Every release-like build needs one of:

- an authorized local commit hash, or
- a named evidence package containing status, diff, untracked list, source
  snapshot, and verification output.

Do not ship from an unnamed dirty state.

## User Data Migration Policy

Before changing stored file formats:

- identify the storage key or Meodesk Home path
- write the previous and next schema shape
- define whether migration is automatic, manual, or unsupported
- define rollback behavior
- add fixture coverage for old data if automatic migration is promised

## Diagnostics Policy

Release builds need a way to inspect failures without asking the user to rerun
from a dev terminal.

Minimum diagnostic plan:

- renderer/main startup log location
- terminal/Agent launch failure messages with command, resolved path, cwd, and
  blocked reason
- package import/export errors with project id and sanitized path
- Obsidian vault path rejection messages
- smoke or manual checklist for packaged startup

## Current Follow-Ups

1. Add installer/signing decision only after internal package smoke stays green.
2. Record packaged `node-pty` terminal start/write/kill behavior, not only
   source-mode terminal smokes.
3. Add user-data migration and rollback notes before changing storage schemas.
4. Add startup/terminal diagnostic log plan before manual beta.
5. Keep `release:minimal-check` output as the release inventory artifact before
   any internal packaged build.

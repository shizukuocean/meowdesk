# Dev Ledger And Helper Contract

> Status: planning contract for the next Helper integration slice.
> Scope: Dev Ledger Core, Helper internal pages, record ownership, and
> non-visual implementation boundaries.

## Purpose

Helper is a Meowdesk feature page for vibe-coding development guidance,
recording, and acceptance. It should help users clarify what they want, reduce
patch-style rework, and gradually build product thinking without forcing them to
write a professional PRD.

Dev Ledger Core is the passive record layer behind Helper. It stores thin
records and stable references. It does not scrape Workspace, Studio, Meow
Viewer, Tasks, or Conversations.

## Owner Boundaries

| Area | Owner | Boundary |
|---|---|---|
| Helper pre-UI contract | `src/renderer-app/src/features/helper` | Owns Helper data model, internal-page mapping, Dev Ledger adapter, and Agent handoff text. Full UI remains deferred. |
| Dev Ledger Core | `src/renderer-app/src/features/dev-ledger/dev-ledger-core.ts` | Owns append/read/filter record helpers and local passive storage. Its explicit owner marker is `DEV_LEDGER_OWNER = "dev-ledger-core"`. |
| Workspace / Studio | their feature folders | May emit scoped records or stable refs, but do not let Helper own runtime lifecycle. |
| Meow Viewer | `src/renderer-app/src/features/meow-viewer` | May offer "record issue/evidence" entry points later, but still only reads scoped output. |
| Agent Runtime Manager | `src/renderer-app/src/features/agent-runtime` | Remains the only renderer owner for live runtime registry and reattach helpers. |

Helper must never start, stop, kill, resize, or reattach Agent / terminal
runtimes. Helper records may reference runtime/session/source ids, but live
process ownership stays outside Helper.

## Pre-UI Modules

The current non-visual implementation is intentionally small:

```text
src/renderer-app/src/features/helper/helper-contract.ts
src/renderer-app/src/features/helper/helper-dev-ledger-adapter.ts
src/renderer-app/src/features/helper/helper-agent-handoff.ts
src/renderer-app/src/features/helper/helper-workflow.ts
src/renderer-app/src/features/helper/helper-classification.ts
src/renderer-app/src/features/helper/helper-fixtures.ts
src/renderer-app/src/features/helper/index.ts
```

Responsibilities:

- `helper-contract.ts`: internal pages, product-maintenance entries, field
  modes, draft normalization, required-field checks, and query mapping.
- `helper-dev-ledger-adapter.ts`: thin append/update/query adapter over Dev
  Ledger Core.
- `helper-agent-handoff.ts`: deterministic Agent handoff text generation from
  either a draft or a stored Dev Ledger record.
- `helper-workflow.ts`: pure record-state transitions for submit, clarify,
  Agent handoff, acceptance feedback, retest, pass/fail, archive, and reopen.
- `helper-classification.ts`: thin project, subproject, and category upsert
  helpers. It stores classification settings as Dev Ledger records instead of
  giving Helper a separate hidden database.
- `helper-fixtures.ts`: deterministic fixture records for contract tests and
  future visual previews.
- `dev-ledger-core.ts`: exposes memory and localStorage-backed stores so tests,
  previews, and the future UI can inject storage instead of writing directly to
  browser globals. It is the only module that may own
  `meowdesk.devLedger.records.v1`.

The contract test is:

```text
npm run test:helper-contract
```

The fixture path is deliberately headless. It can seed a realistic Helper
record set without mounting the routed Helper UI or touching live Agent
runtime state.

## Helper Internal Pages

Helper is one Meowdesk feature page with internal pages, similar to Lobby
sections. It is not one giant form page.

| Internal page | Role | Primary records |
|---|---|---|
| 产品维护 | Existing product or Meowdesk behavior changes. | `problem-record`, `spec-card`, `acceptance-item`, `evidence` |
| 新产品开发 | From-zero product or feature creation. | `dev-session`, `spec-card`, `artifact`, `acceptance-item` |
| 验收 | Retest, pass/fail, regression, and user feedback. | `acceptance-item`, `retest-run`, `evidence` |
| 记录库 | Search, filter, open, and manage submitted records. | all record kinds |
| 分类设置 | Project, subproject, category, and tag maintenance. | `project-record`, `subproject-record`, `category-record` |

The submission pages only handle the current task entry. Submitted items move to
记录库 for browsing, filtering, and detail review.

## Product Maintenance Entrances

产品维护 needs clear routes for users who do not know product-development
terms:

| Entrance | Category kind | Typical question |
|---|---|---|
| Bug / 问题 | `bug` | Something is wrong or broken. |
| 功能改进 | `improvement` | Existing behavior should work better. |
| 视觉 / UI 调整 | `ui-visual` | The product works, but the look, layout, or interaction feels wrong. |
| 原型编辑器 | `prototype` | The user needs to sketch or adjust a rough product shape. |

Each entrance should guide the same lightweight flow:

```text
记录 -> 澄清 -> Agent 交接 -> 验收反馈
```

The current state contract behind that flow is:

| Action | Stage | Status | Meaning |
|---|---|---|---|
| `submit` / `clarify` / `reopen` | `clarify` | `open` | The record still needs human clarification. |
| `handoff` | `agent-handoff` | `ready` | The record can be handed to an Agent, but Helper does not run the Agent. |
| `acceptance-feedback` | `acceptance-feedback` | `open` | The user is reviewing delivered work or adding feedback. |
| `fail` / `retest` | `retest` | `failed` or `open` | The work needs another pass. |
| `pass` | `done` | `passed` | The item has passed acceptance. |
| `archive` | `done` | `archived` | The item is closed for browsing/history. |

These transitions are pure Dev Ledger adapter updates. They must not trigger
runtime starts, source collection, Viewer rendering, or route changes.

## Field Discipline

Keep required fields minimal. Do not remove product thinking; move optional
detail into progressive sections.

Required for a basic vibe-coding record:

```text
title
categoryKind
projectId
summary or user description
expected outcome
stage
status
```

Recommended but optional:

```text
subprojectId
priority
tags
refs
evidence summary
agent handoff text
acceptance notes
```

Professional mode may expose more structure for users who are technical but not
product-minded. Professional mode must still write the same Dev Ledger records
instead of creating a second schema.

## Classification Settings

Project, subproject, and category management belongs to Helper as thin
metadata, but the records still live in Dev Ledger Core:

```text
project-record
subproject-record
category-record
```

Use stable keys for idempotent upsert. Re-saving "Meowdesk / Helper / UI"
should update the same records, not create duplicate projects or categories.

Classification records are shown by the future `分类设置` internal page and by
`记录库` filters. Submission pages should read them as options; they should not
copy category state into page-local stores.

## Storage Adapter Rules

Dev Ledger Core has two store shapes:

- memory store for tests, visual previews, and fixtures;
- localStorage store for the first local MVP.

Renderer components should consume `DevLedgerAdapter`. They should not call
`localStorage` directly, because that would make later migration to a file,
SQLite, or packaged project ledger harder.

The current storage key is deliberately classified as helper-deferred:

```text
DEV_LEDGER_STORAGE_CLASSIFICATION = "helper-deferred"
DEV_LEDGER_STORAGE_KEY = "meowdesk.devLedger.records.v1"
```

That means it is not yet a durable product data owner like Meodesk Home-backed
Workspace or Studio state. Do not add it to Home storage just to make a test
green. A future migration needs an explicit ledger owner decision, import path,
and privacy/export rule.

Helper modules must not import the storage key, call `localStorage`, call
Meodesk Home storage helpers, or use `window.workbench` directly. Helper talks
to Dev Ledger through `DevLedgerAdapter`; Dev Ledger Core owns the current local
MVP persistence.

## Thin Record Rules

Dev Ledger stores small summaries plus stable references. It must not become a
hidden transcript, diff, or terminal-log database.

Default limits live in `DEV_LEDGER_TEXT_LIMITS` and are enforced when records
are normalized or written:

```text
title <= 160 characters
summary <= 2000 characters
tags <= 40 entries, each <= 64 characters
refs <= 20 entries
ref label <= 160 characters
ref uri <= 600 characters
```

If a future feature needs larger evidence, store it as an explicit artifact
owned by the correct feature or Home/project ledger, then save only the stable
reference in Dev Ledger.

## Dev Ledger Entities

The current entity vocabulary is:

```text
dev-session
project-record
subproject-record
category-record
spec-card
acceptance-item
problem-record
artifact
evidence
retest-run
lesson-candidate
actor
decision-record
risk-acceptance
link
```

Use `artifact` for what was produced, such as a file, commit, local build,
prototype, or `.meow` package.

Use `evidence` for proof that it works, such as smoke output, screenshot,
Meow Viewer excerpt, user acceptance note, or test result.

Use `link` to connect records without merging concepts. For example, a
`dev-session` can link to a future `ConversationThread`, but the two should not
become one object.

## Stable Reference Rules

Dev Ledger stores summaries plus stable references:

- Good: `projectId`, `surfaceId`, `sessionId`, `sourceId`, file path summary,
  smoke command, screenshot path, result text excerpt.
- Avoid by default: full dirty diff, full terminal transcript, full private
  conversation dump, live object references.

Large evidence can be attached later as explicit artifacts, but it should not be
the default record body.

## Integration Rules

- Helper emits records through Dev Ledger Core append helpers.
- Workspace, Studio, and Meow Viewer may pass scoped metadata into Helper.
- Dev Ledger filters by `projectId`, `subprojectId`, `categoryId`, `stage`, and
  ownership scope.
- Helper may show live-runtime references as labels, but it does not reattach or
  collect runtime output by itself.
- Lesson candidates must go through privacy cleaning before becoming Dev Guy or
  skill material.
- Agent Action Protocol records are declaration/audit material for now; no
  executor is part of Helper MVP.

## Deferred Work

Do not implement these in the contract slice:

- full Helper UI;
- GSAP or visual polish;
- MCP write tools;
- Agent Action executor;
- cold conversation restore;
- Team collaboration.

These need the identity/ownership and runtime boundaries to stay stable first.

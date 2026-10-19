# Meowdesk Rebuild Roadmap After UI T-S-G

> Status: planning entry after phase six
> Scope: rebuild the product on top of the next renderer without losing legacy
> runtime capabilities

## Current Baseline

After phase six, the UI rebuild worktree has:

- next renderer as the default entry when `MEOWDESK_RENDERER` is unset;
- retired legacy renderer rejected by `MEOWDESK_RENDERER=legacy`; rollback now
  means backup/Git anchor recovery;
- primary sidebar routes for 大厅, workspace, Studio, task center,
  Workflow Beta, conversations, and Obsidian, with 设置 at the sidebar
  bottom;
- deep-link routes remain available for plugin marketplace and profile
  editing, but their product entry is 大厅 rather than extra primary menu
  items;
- typed read-only / safe adapters for workshop summaries, selected workshop
  actions, terminal descriptors, sidebar widget descriptors, and Workflow Beta
  descriptors;
- old product-area visibility restored for workspace panes, priority board,
  right sidebar widgets, pet dock, conversation manager, Obsidian reader shell,
  settings/access configuration, and Lobby friends/tutorial entry;
- the R1.5 direction document is now represented as product-shape work: 大厅
  as the social/start center, 插件广场/好友/个人主页/新手教程 tab pages,
  Agent access moved into 设置, marketplace/social signals, Task Center
  month/week/schedule/matrix/habit views, and Studio make/manage split;
- Workflow Beta showcase canvas now keeps old interaction semantics for wheel
  zoom, right-button panning, left-button selection/wiring intent, and built-in
  port fallbacks;
- hidden Electron smoke coverage for default, next, route reachability,
  bridge, workshop operations, runtime boundaries, and full verify.
- R2 workspace runtime slice restores xterm inside existing work windows,
  workspace-sidebar iframe mounting for ready local widgets, sidebar widget
  enable/disable storage, and settings command testing while preserving the
  accepted R1.5 page shape.
- R3 local product-surface slice restores Conversations and Obsidian as real
  local readers: conversation JSON/message bodies come from the existing agent
  interface summary, and markdown vault list/read/wiki/backlink/tag behavior
  uses the existing Obsidian IPC without adding preload surface.

This is a new shell plus guarded legacy boundaries. It is not yet a complete
runtime rewrite.

## Rebuild Definition

The next stage should treat Meowdesk as a new product shell with protected
runtime services behind explicit contracts.

Do not measure success by deleting legacy code quickly. Measure success by:

- every product area having a clear owner and route;
- runtime services having typed contracts;
- high-risk lifecycle code being wrapped before it is replaced;
- each migration step being covered by smoke or contract tests;
- users never losing a previously working workflow without an explicit fallback.

## Suggested Tracks

### Track A: Runtime Host Layer

Goal: define stable host contracts for Agent and terminal runtime.

Deliverables:

- Agent session descriptor and lifecycle contract;
- terminal host/mount in the existing Workspace work-window surface;
- process start/write/resize/kill safety tests;
- visible recovery path when an Agent or terminal crashes.

Do not combine this with Workflow execution migration.

Status: workspace terminal host is now active through the old preload/main IPC;
Studio Agent stage and Workflow execution remain protected.

### Track B: Extension Host Layer

Goal: rebuild right-sidebar widget hosting around a typed iframe host.

Deliverables:

- iframe mount contract;
- message bridge contract;
- theme/init protocol contract;
- resize and persistence contract;
- smoke with a temporary sidebar widget fixture.

Do not let plugin marketplace card UI own iframe lifecycle.

Status: workspace side column now mounts ready local sidebar widgets in-place and
sends init/theme/resize payloads; Studio runtime tab remains a protected
descriptor/contract view.

### Track C: Task Center

Goal: rebuild task UI and persistence as a first-class product area.

Deliverables:

- task storage schema review;
- read/write adapter helpers;
- day schedule and status transition tests;
- migration-safe task editor;
- smoke for create/update/status/day view.
- R1.5 visual views already exist for month, week, schedule, matrix, and daily
  habit shapes; future work should only turn these into real recurrence,
  reminders, or sync after a task-schema review.

### Track D: Workflow Beta

Goal: decide whether Workflow remains showcase-only or becomes a real builder.

Deliverables:

- read-only canvas contract first;
- node/card display contract;
- save/delete contract second;
- execution/message-bus contract last;
- clear product decision on whether Agent battery execution returns soon.

Do not mix canvas rewrite with execution-chain rewrite.

### Track E: Profile And Marketplace

Goal: turn the reachable route shells into real product surfaces.

Deliverables:

- profile write adapter and avatar file contract;
- plugin detail and author page data contract;
- install/enable lifecycle ownership;
- auth plan separated from local mock profile.

Current R1.5 line has intentionally stopped at local/social shape:

- 大厅 is the social plaza and first-run center, not a remote account system or
  a bucket of extra primary navigation items.
- Profile shows level/title/avatar/email visibility from local storage only.
- Marketplace shows category, author, heat, likes/downloads/rating metadata as
  local presentation; real follow/like/download/install ownership is deferred.
- Studio shows works management and publish-info placeholders; real publishing
  belongs to a later gated marketplace track.

R3 has started this track from the lowest-risk local product surfaces:

- Conversations now show local history groups, detail metadata, and message
  bodies, with managed mirror deletion through the existing IPC.
- Obsidian now has a local vault reader for saved vault path, file list, note
  body, wiki links, backlinks, and tags.
- Remote social/auth/community marketplace functions remain outside this slice.

### Track F: Packaging And Release

Goal: make the next shell shippable.

Deliverables:

- desktop shortcut points at the intended workspace;
- build/package checklist;
- dependency size and Electron packaging review;
- rollback notes for backup/Git anchors and packaging;
- user-facing acceptance checklist.

## Immediate Next Planning Move

The R1 recovery line now owns the capability matrix:

- [R1 Capability Matrix](./capability-matrix.md)

Keep it current before starting each runtime rebuild slice.

```text
Feature -> current owner -> next route -> adapter status -> smoke coverage ->
runtime risk -> rebuild track -> next commit target
```

That matrix should decide each rebuild slice. The safest next track remains
product/runtime closure around local surfaces and extension lifecycle. Workflow
execution should still wait for an explicit contract and separate product
decision.

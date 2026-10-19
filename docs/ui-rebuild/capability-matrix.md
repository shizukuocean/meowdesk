# Meowdesk R1/R1.5/R2/R3 Runtime Capability Matrix

> Status: R1.5 page-shape baseline preserved + R2 workspace runtime host restored + R3 local product surfaces restored
> Scope: next renderer feature surfaces after UI T-S-G phase six
> Worktree: `<PROJECT_ROOT>`

This matrix tracks which product capabilities are real in the next renderer,
which ones are read-only, and which ones remain protected/deferred runtime
surfaces. `owner: "legacy"` values are compatibility descriptors for older
runtime services, not an active legacy renderer.

| Feature | Current owner | Next route | Adapter status | Smoke coverage | Runtime risk | Rebuild track | Next commit target |
|---|---|---|---|---|---|---|---|
| Lobby / 大厅 overview | next renderer | `#lobby` | read-only summary through `useWorkbenchSummary()` | `smoke:renderer:lobby`, `smoke:renderer:phase-six` | low | shell/product surface | keep stable |
| 大厅 profile/plugins/access/start pages | next renderer | `#lobby`, `#profile`, `#plugins`, `#access` | profile storage adapter + tabbed social plaza + marketplace + Agent access icons + start center | `smoke:renderer:lobby`, `smoke:renderer:r1-functions` | low/medium | Profile/Marketplace | keep local-only until auth |
| Workspace shell | next renderer + protected terminal IPC | `#workspace` | visible multi-pane layout preserved; xterm host mounts in existing work windows; terminal/Agent start, stdout, resize, and exit flow through existing IPC | `smoke:renderer:r15-r2a`, `smoke:renderer:phase-six` | high | R2 Runtime Host | runtime host restored without page redesign |
| Studio workshop list / management | next + legacy IPC | `#studio` | typed workshop adapters for summary/create/import/export/mark-ready + visible make/manage page split | workshop data/create/import/export/detail/version/invalid smokes; `smoke:renderer:studio` | medium | workshop operation loop | keep non-runtime actions only |
| Studio Agent/terminal stage | protected runtime service | `#studio` | descriptors and protected boundary only | runtime + terminal boundary smokes | high | R2 Runtime Host | do not mount xterm in Studio without a separate contract |
| Right sidebar widgets | next workspace iframe host + legacy descriptors | `#workspace`, `#studio`, `#plugins` | workspace mounts ready sidebar-widget entries in the existing side column; Studio still shows protected contract/descriptor view | sidebar/workflow boundary smoke, R1/R1.5 functions smoke | high | R2 Extension Host | workspace iframe host restored; Studio remains protected |
| Plugin marketplace list/detail | next renderer | `#plugins` | reads indexed workshop extensions; detail panel shows runtime/entry/path plus R1.5 market metrics | `smoke:renderer:r1-functions`, phase-six reachability | low/medium | R1 Profile/Marketplace | detail restored, install deferred |
| Task center | next renderer + storage IPC | `#tasks` | typed `readTaskCenterTasks()` / `writeTaskCenterTasks()`; board/month/week/schedule/matrix/habit views | `smoke:renderer:r1-functions`, `smoke:renderer:r15-r2a` | medium | R1.5 Task Center | old main shape restored |
| Task drag/drop and workflow picker | deferred runtime service | `#tasks`, Workflow Beta | deferred runtime boundary | phase-six reachability | high | R2/R3 Task + Workflow | explicit contract required |
| Profile center | next renderer + storage IPC | `#profile` | typed `readProfileSettings()` / `writeProfileSettings()` | `smoke:renderer:r1-functions` | low | R1 Profile/Marketplace | local fields restored |
| Avatar file and auth | legacy/mock | `#profile` | protected/handoff | phase-six reachability | medium/high | R3 product closure | separate file/auth contract |
| Conversations | next renderer + legacy conversation mirror/import | `#conversations` | typed local history summary/detail/messages from agent interface; open directory and delete local mirror through existing IPC | `smoke:renderer:r3-product-surfaces`, `smoke:renderer:phase-six` | medium | R3 Local Product Surfaces | local reader/manager restored; native bulk import ownership still gated |
| Obsidian reader | next renderer + legacy Obsidian IPC | `#obsidian` | typed vault storage, list/read, markdown blocks, wiki links, backlinks, and tag context through existing IPC | `smoke:renderer:r3-product-surfaces`, `smoke:renderer:phase-six` | medium | R3 Local Product Surfaces | local vault reader restored; write/sync/publish remain gated |
| Access Agent configuration | legacy config/tools IPC | `#access`, `#lobby` | visible settings sections + tool descriptors + Agent icon identity + storage paths + command test action via existing IPC | `smoke:renderer:lobby`, `smoke:renderer:r15-r2a`, `smoke:renderer:phase-six` | medium/high | R2 Runtime Host | command test restored; add/delete UI still gated |
| Workflow Beta showcase canvas | legacy workflow storage | `#workflow`, Studio runtime tab | read-only descriptor with built-in port fallback, wheel zoom, right-button pan | phase-six, sidebar/workflow boundary, R1.5/R2A smoke | high | R3 Workflow decision | read-only canvas restored, execution protected |
| Desktop packaging/default entry | worktree main process | app launch | default next; retired legacy renderer is rejected | default/default-readiness/next smokes | medium | R3 Packaging | main baseline merge later |

## R1 Boundary

R1 restores low-risk functions in next:

- task storage read/write, creation, edit, status changes, and day summary;
- local profile display/edit for name, developer id, title, and bio;
- plugin marketplace detail visibility for local indexed workshop works;
- capability tracking in this matrix.

R1 deliberately does not migrate:

- xterm mount, fit, stdin/stdout, resize, or process kill;
- Agent process lifecycle;
- right-sidebar iframe host, resize, theme, message bridge, or persistence;
- Workflow Beta canvas, save/delete, dispatch, or execution chain.

R2 should start from a single runtime host contract, not from Workflow execution.

## R1.5 + R2A Boundary

R1.5 adds old-shape product visibility without changing runtime ownership:

- Task Center restores AI tasks, my tasks, day schedule, month calendar, tag
  sections, and status columns through the existing R1 typed storage adapter.
- Workflow Beta restores a read-only canvas, node/edge rendering, and inspector
  summaries from `WorkflowBoundaryDescriptor`.
- Workflow save/delete/dispatch/execute remain protected and are guarded by
  smoke stubs.

R2A adds `SidebarIframeHostDescriptor` as a contract-only layer:

- mount is `contract-only`;
- lifecycle is `not-mounted`;
- theme/init and resize are pending contracts;
- message bridge and persistence are disabled;
- the next renderer must not create an iframe for real widgets yet.

## R2B Overnight Boundary

R2B restores old Meowdesk product areas as visible next routes without taking
ownership of their high-risk runtimes:

- `#workspace` shows the old workbench structure: multi work windows, window
  count controls, save/add icons, priority board, right-sidebar widget list, and
  pet dock.
- `#conversations` shows the old conversation management shape: agent tabs,
  local conversation list, and detail panel.
- `#obsidian` shows the old reader shape: file list, note shell, backlinks, and
  tag/context column.
- `#access` restores settings/access semantics: work window configuration,
  Agent connect requests, local data paths, Obsidian, and advanced sections.
- Workflow Beta now restores old interaction semantics for the protected
  showcase canvas: mouse wheel zoom, right-button canvas pan, left-button
  selection/wiring semantics, and built-in Agent/result/task/context ports.

## R1.5 Direction Document Boundary

The 2026-05-31 user direction document stays inside R1.5 as long as it remains
product-shape work:

- `Lobby` is renamed to 大厅. 社交广场 is the positioning of this area,
  not a standalone feature tab. The visible tabs are 插件广场, 好友,
  个人主页, and 新手教程.
- Profile and marketplace adopt familiar social/market signals such as level,
  titles, author, likes, downloads, heat, and rating as local visual metadata.
  Real remote social data, follow/like permissions, and auth remain R3.
- Access configuration is hidden inside 设置. 大厅 keeps only an Agent access
  tutorial/guide that jumps to 设置; recognizable Agent icons remain in the
  settings tool list. Command testing, process start, and auth remain R2
  runtime work.
- Task Center adds month, week, schedule, Eisenhower matrix, and daily habit
  views over the existing local task adapter. Recurrence engines, reminders,
  and sync remain deferred.
- Studio adds a make/manage page split so works can be seen as in-progress or
  publishable, while real publishing, install lifecycle, and marketplace
  distribution remain gated.

R2B deliberately still did not migrate:

- Studio Agent stage xterm ownership;
- Workflow execution-chain Agent process lifecycle;
- Obsidian vault file reading in the next shell;
- conversation delete/import ownership in the next shell;
- Workflow save/delete/dispatch/run/message-bus/execution chain.

## R2 Runtime Host Slice

The 2026-06-01 R2 runtime slice keeps the accepted R1.5 pages in place and only
fills their runtime slots:

- Workspace work windows now mount `@xterm/xterm` inside the existing terminal
  surface. Start/write/resize/kill still call the old preload/main IPC and
  `node-pty` chain.
- Workspace right-sidebar widgets now mount local `sidebar-widget` entries in
  the existing side-column card, with `meodesk:init`, `meodesk:theme`, and
  `meodesk:resize` postMessage payloads. Studio remains contract-only.
- Workspace sidebar manager can enable/disable indexed sidebar widgets through
  local layout storage; ready widgets remain enabled by default to preserve the
  R1.5 visible page.
- Access settings can run the existing command test chain for configured tools.

Still deliberately protected:

- Workflow save/delete/dispatch/run/message bus/execution chain.
- Studio Agent workshop terminal ownership.
- Remote login/auth, remote marketplace install/download, friends/social data,
  and profile authority.

## R3 Local Product Surfaces

The 2026-06-01 R3 slice keeps the R1.5 page shape and R2 runtime work stable,
then restores two old Meowdesk local product chains without adding preload/IPC:

- Conversations now read real local conversation mirror/import records from the
  existing agent interface summary, display message bodies in the route, expose
  agent grouping, and can delete managed local mirror files through the existing
  `conversations:deleteMirror` IPC.
- Obsidian now reads the saved local vault path, lists markdown files, loads note
  content, renders basic markdown, opens wiki links, and shows backlinks/tags
  through the existing `obsidian:*` IPC and typed renderer adapter.
- `smoke:renderer:r3-product-surfaces` seeds a local conversation JSON and a
  temporary vault, then verifies both routes read real local files.

Still deliberately protected:

- remote account/auth, friends, community marketplace download/install/publish,
  social permissions, and profile authority;
- Obsidian write-back, sync, graph editing, and vault mutation;
- native bulk conversation import UI ownership beyond the existing local summary;
- Workflow save/delete/dispatch/run/message bus/execution chain.

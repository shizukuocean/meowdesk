# Meowdesk Design System V1

> Draft design language for the T-S-G rebuild.

## North Star

Meowdesk is a customizable AI workbench where users create, run, manage, and
share Agent-built tools. The UI must make the user feel that they are operating
a serious local workbench, not browsing a marketing site or a loose demo.

## Stack Roles

```text
Tailwind  = design tokens and layout discipline
shadcn/ui = accessible component source and interaction grammar
GSAP      = controlled motion layer for state changes
```

Do not let the stack decide the product tone. Meowdesk's tone is decided by the
product rules below.

## Tone Rules

- Dense, but not cramped.
- Quiet, but not lifeless.
- Precise, but not cold.
- Friendly, but not childish.
- Extensible, but not chaotic.
- Desktop-native in structure, even when implemented with web technology.

## Color Roles

Use stable semantic roles instead of page-specific colors:

| Role | Meaning |
|---|---|
| `background` | app-level background |
| `surface` | primary panels and routes |
| `surface-raised` | popovers, menus, dialogs |
| `border` | structural separation |
| `muted` | secondary text and inactive controls |
| `primary` | current route, primary action, active focus |
| `success` | available, connected, complete |
| `warning` | pending, needs attention |
| `danger` | destructive or failed state |
| `agent` | Agent runtime and terminal-adjacent state |
| `plugin` | plugin, package, and extension objects |

The first theme pass should map these roles onto both `blackmeo` and
`whitemeo`. Layout must not change between themes.

## Spacing

Use a small spacing scale:

```text
4 / 8 / 12 / 16 / 24 / 32
```

Default UI density:

- control gap: 8px;
- compact panel padding: 12px;
- page section gap: 16px;
- major layout gap: 24px;
- avoid oversized hero spacing.

## Radius

Use radius as hierarchy, not decoration:

| Element | Radius |
|---|---|
| icon button | 6px |
| default button | 8px |
| input/select | 8px |
| card/item | 8px |
| major panel | 12px |
| modal/dialog | 12px |

Avoid soft, bubbly, or oversized rounded shapes unless the object is explicitly
pet/avatar related.

## Typography

Default font stack:

```css
system-ui, "Segoe UI", "Microsoft YaHei", sans-serif
```

Text scale:

| Token | Use |
|---|---|
| `text-xs` | metadata, timestamps, helper labels |
| `text-sm` | dense body, table rows, nav items |
| `text-base` | primary body and card titles |
| `text-lg` | route-level section title |
| `text-xl` | page title only |

No viewport-scaled text. No negative letter spacing. Text must fit inside its
container at 1280px width.

## Core Components

Phase one should define or wrap these components:

- `AppShell`
- `TopNav`
- `SideNav`
- `PageHeader`
- `Panel`
- `Toolbar`
- `Button`
- `IconButton`
- `Tabs`
- `Dialog`
- `DropdownMenu`
- `Tooltip`
- `Input`
- `Select`
- `Switch`
- `StatusBadge`
- `EmptyState`

Domain components:

- `AgentStation`
- `PluginCard`
- `WorkshopProjectCard`
- `SidebarWidgetCard`
- `TaskCard`
- `ProfileCard`
- `TerminalFrame`

## Layout Rules

Meowdesk routes should use repeatable shells:

```text
AppShell
  TopNav
  RouteSurface
    PageHeader
    MainWorkArea
    OptionalSidePanel
```

The main work area should always be visually dominant. Side panels support the
task; they are not decorative.

Desktop routes must be fullscreen-aware. Product/workbench routes such as
Lobby, Studio, task center, plugin marketplace, workflow, and future extension
pages should fill the available route surface instead of using article-style
`mx-auto max-w-*` containers. The layout may use fixed side-panel widths,
min/max column tracks, and internal scrolling, but the overall page geometry
must stay stable when the user maximizes the Electron window or moves between
different monitor sizes. Reserve narrow centered max-width layouts for modal,
document, onboarding, or single-card reading surfaces only.

Route roots should inherit the route surface height with `h-full`, `min-h-0`,
flex/grid tracks, and internal panel scrolling. Avoid fixed page-level
`min-height` values that add a second route scrollbar or push the Agent,
terminal, or side inspector below the visible work area. If content needs more
space than the route surface, scroll the specific panel or task list first.

Agent or terminal routes use a stricter rule: the terminal/Agent viewport is
the primary object. Navigation, project lists, metadata, package actions, and
detail inspectors should collapse or move behind compact toggles before they
compress the Agent reading area. If a user is expected to read CLI output inside
Meowdesk, the layout must preserve terminal width and height first.

For Agent or terminal routes, auxiliary tools should collect into one side
Inspector or side tray. Project types, project lists, manifest detail, package
actions, Agent config state, terminal session state, task summaries, and runtime
metadata should not appear as separate left, right, and bottom panels around the
Agent stage. The default page should keep a compact context header and reserve
the largest continuous area for the terminal/Agent viewport.

## Motion Rules

Motion is a state language, not spectacle.

| Motion Type | Duration | Tool |
|---|---:|---|
| hover/focus | 120-160ms | CSS/Tailwind |
| small disclosure | 160-220ms | CSS or GSAP |
| panel open/close | 180-260ms | GSAP when coordinated |
| route transition | 220-320ms | GSAP |
| Agent boot/install flow | 300-500ms | GSAP timeline |

Use `cubic-bezier(.2, .8, .2, 1)` as the default feel. Avoid bounce, spin, or
ornamental chained motion. Support reduced motion before finalizing the motion
layer.

## Visual Anti-Patterns

- card inside card;
- hero page inside a workbench;
- large decorative gradients or floating orbs;
- identical blue/purple wash everywhere;
- oversized marketing headings;
- button styles invented per page;
- status colors without semantics;
- route changes that move the entire app frame around.

## Acceptance Standard

A route passes the design-system standard when:

- the primary action is visible within 3 seconds;
- the layout remains stable at 1280px width;
- components come from the shared grammar;
- dark and light themes share structure;
- no text overflows controls;
- no panel exists only for decoration;
- the route feels like Meowdesk, not like a generic dashboard template.

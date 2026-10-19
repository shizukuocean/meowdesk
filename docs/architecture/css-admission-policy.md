# CSS Admission Policy

> Status: feature-admission guardrail for CSS after the maintenance cleanup.
> Scope: `src/renderer-app/src/styles/app.css` and future feature-local styles.

## Current Position

`app.css` is a large visual leaf file. It is not a runtime owner and must not
carry business rules, IPC policy, parser behavior, embedding behavior, or test
shortcuts.

The maintenance audit checks that it remains visual-only and does not contain
retired runtime terms. This does not mean global CSS can grow without review.

## Meaning Of Readiness

`readyForFeatureDevelopment=true` means CSS is safe enough to continue feature
work:

- no retired runtime/embedding terms in CSS
- body minimum-width regression remains guarded
- visible surfaces have renderer smokes

It does not mean `app.css` is physically split to its ideal final size.

## Admission Rules

For new feature work:

- Prefer component-local class groups in the feature owner directory when a new
  surface needs substantial styling.
- Use existing design tokens and existing shared surface classes before adding
  global selectors.
- Keep `app.css` edits small when they adjust an existing shared shell, panel,
  layout, or known feature selector.
- Do not add business, runtime, IPC, parser, or iframe permission semantics in
  CSS names or comments.
- Do not use a CSS change to hide a broken runtime state that should fail a
  smoke or contract test.

## Review Triggers

Write a short CSS plan before editing when any of these are true:

- A single feature would add a new selector family to `app.css`.
- The change affects shared shell, route body, top nav, sidebar, Workspace,
  Studio, Meow Viewer, terminal, iframe preview, or responsive layout.
- The change would add broad descendant selectors that can affect multiple
  routes.
- The change would add enough CSS that the new rules are easier to own in a
  feature-local stylesheet than in `app.css`.
- `app.css` grows toward another maintenance checkpoint and the change is not a
  small local fix.

Small direct edits are allowed when they:

- Adjust existing selectors for a touched surface.
- Fix overflow, wrapping, focus, contrast, or responsive bugs.
- Are covered by the affected surface smoke and `npm run build:renderer`.

## Do Not Add

- `getDisplayMedia`, `SetParent`, legacy renderer, desktop host, HWND, or
  embedding terms.
- New global visual systems during maintenance-only goals.
- Route behavior encoded through visibility hacks.
- Broad theme rewrites unless the task is explicitly a UI/design task.

## Minimum Gates

Use the narrowest matching visible-surface smoke:

```text
npm run build:renderer
npm run smoke:renderer:compact
npm run smoke:renderer:phase-six
npm run smoke:renderer:workspace-route-keepalive
npm run smoke:renderer:workspace-output-renderer
npm run smoke:renderer:studio
npm run smoke:renderer:runtime-boundary
npm run smoke:renderer:studio-meow-viewer
npm run smoke:renderer:lobby
npm run smoke:renderer:r3-product-surfaces
```

Run `npm run verify:renderer` before declaring a broad visual phase complete.

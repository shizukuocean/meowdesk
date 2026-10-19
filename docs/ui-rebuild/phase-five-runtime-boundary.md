# Phase Five Sidebar / Workflow Runtime Boundary

> Status: first batch verified
> Scope: right-sidebar iframe and Workflow Beta boundary migration
> Rule: describe protected runtime before mounting or executing it

Current cleanup note: this document records the original phase-five boundary.
The legacy renderer is now retired; references to `owner: legacy` are
compatibility descriptor values for older protected runtime services.

## Goal

Phase five extends the Studio runtime Inspector to show two more protected
runtime surfaces:

```text
React next shell
  -> reads sidebar-widget manifest summaries
  -> reads Workflow Beta draft summaries
  -> shows protected/deferred boundary state
  -> does not mount iframe widgets or execute workflow tasks
```

## Implemented Boundary

- `SidebarWidgetRuntimeDescriptor` describes right-sidebar widget candidates
  from `getAgentInterfaceInfo().workshopExtensions`.
- `WorkflowBoundaryDescriptor` describes Workflow Beta drafts from
  `readWorkflowDrafts()`, with `getAgentInterfaceInfo().workflows` as a
  fallback source.
- Studio runtime Inspector now includes protected rows and internal scroll
  lists for:
  - right-sidebar iframe boundary;
  - Workflow Beta boundary.
- Both descriptors mark `owner: legacy` as a compatibility value and show
  protected runtime labels.

## Verification

New smoke:

```text
npm run smoke:renderer:sidebar-workflow-boundary
```

The smoke uses a temporary Meodesk Home and verifies:

- a seeded sidebar-widget manifest appears as one loadable descriptor;
- the descriptor owner stays `legacy`;
- the descriptor marks iframe protection as `iframe-protected`;
- the next renderer does not mount an iframe in the boundary panel;
- a seeded Workflow Beta draft appears beside the builtin demo workflow;
- the Workflow descriptor owner stays `legacy`;
- node/edge counts are rendered;
- `saveWorkflowDraft`, `deleteWorkflowDraft`, and `dispatchWorkflowTask` are
  not called by the boundary panel.

The smoke is included in:

```text
npm run verify:renderer
```

## Do Not Do Yet

- Do not move sidebar widget iframe loading into React.
- Do not replace iframe resize, theme, message, or persistence bridges.
- Do not replace Workflow Beta canvas, message bus, Agent battery, or execution
  chain.
- Do not make Workflow write or dispatch calls from this boundary panel.
- Do not use the retired legacy renderer as a rollback path.

## Next Boundary Steps

1. Define a sidebar iframe host contract before embedding any real
   iframe surface into next.
2. Define a Workflow Beta read-only canvas contract before visualizing nodes in
   next.
3. Keep all future runtime steps covered by hidden Electron smoke scenarios
   that use temporary Meodesk Home fixtures.

# Meowdesk R2A Sidebar Iframe Host Contract

> Status: R2A contract-only boundary
> Scope: right-sidebar widget iframe host in the next renderer
> Worktree: `<PROJECT_ROOT>`

R2A prepares the right-sidebar iframe host contract without taking over the
protected runtime service.

## Current Boundary

- Next reads sidebar-widget manifests through typed descriptors.
- Next exposes `SidebarIframeHostDescriptor` as a contract-only host summary.
- Studio runtime Inspector shows mount/theme/resize/message/persistence status.
- No React route mounts the real sidebar widget iframe.
- Plugin marketplace cards still do not own iframe lifecycle.

## Typed Host Descriptor

Each sidebar widget host descriptor records:

- `id`, `name`, `runtime`, `target`, `entry`, `entryPath`, `manifestPath`;
- `owner: "legacy"` compatibility value;
- `previewOwner: "next-contract"`;
- `mountBoundary: "contract-only"`;
- `lifecycle: "not-mounted"`;
- `sandbox: "allow-scripts"`;
- `themeInit: "pending"`;
- `resize: "contract-pending"`;
- `messageBridge: "disabled"`;
- `persistence: "disabled"`;
- `risk: "protected-runtime"`.

## Risk List

- Do not add `allow-same-origin` until storage and origin isolation are decided.
- Do not open a parent message bridge until message schema and origin checks
  exist.
- Do not persist widget size/state from next until the owner and conflict rules
  are explicit.
- Do not let plugin marketplace detail panels mount or refresh iframes.
- Do not treat a loadable descriptor as an enabled runtime widget.
- Do not replace existing resize behavior without a smoke fixture.

## Smoke Coverage

`smoke:renderer:r15-r2a` seeds a temporary sidebar widget fixture and verifies:

- the typed host contract is visible in Studio runtime Inspector;
- mount remains `contract-only`;
- message bridge remains `disabled`;
- persistence remains `disabled`;
- lifecycle remains `not-mounted`;
- no `iframe` element is mounted by the next renderer.

## Next Step

R2B can add a minimal sandboxed iframe fixture only after the message bridge,
resize, theme init, and persistence ownership tests are specified. Real user
widgets should remain protected-runtime-owned until then.

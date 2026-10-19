# Runtime Safety And Permissions

> Status: current permission inventory for Engineering Governance Phase I.
> Scope: preload bridge, IPC handlers, filesystem access, external launches,
> plugin iframes, Agent commands, terminal lifecycle, and rejection tests.

## Purpose

Meowdesk is a local desktop workbench. That means convenience features can reach
files, tools, terminals, local plugins, and user notes. Future development must
not widen those powers casually.

This document records the current permission surface and the minimum evidence
needed before changing it.

## Current Bridge Surface

`src/preload.js` exposes 38 `window.workbench` methods. The contract is checked
by:

```text
npm run test:workbench-contract
```

High-pressure groups:

| Group | Methods | Primary owner |
|---|---|---|
| Storage | `readStorage`, `writeStorage`, `deleteStorage` | `src/main.js` storage helpers |
| Shell/opening | `openExternal`, `openPath` | `src/main/runtime-permission-service.js` plus `src/main.js` IPC binding |
| Obsidian | `pickObsidianVault`, `listObsidianFiles`, `readObsidianFile` | `src/main/obsidian-service.js` plus `src/main/runtime-permission-service.js` trust registry |
| Workshop/packages | `createWorkshopProject`, `markWorkshopProjectReady`, `exportMeowPackage`, `importMeowPackage` | `src/main/workshop-service.js` |
| Tools/commands | `getAgentPresets`, `testToolCommand`, `addUserTool`, `deleteUserTool` | command resolver and config persistence |
| Conversations | `mirrorConversation`, `deleteConversationMirror`, `onConversationsChanged` | `src/main/conversation-service.js` |
| Pets | `listPets`, `installPet`, `deletePet` | `src/main/pet-service.js` plus pet deletion confirmation |
| Terminal | `startTerminal`, `setTerminalSourceAdapter`, `writeTerminal`, `resizeTerminal`, `killTerminal`, terminal events | `src/main/terminal-runtime-service.js` |

Adding a method to this bridge requires updating the preload contract test and
the renderer adapter type together.

Workflow Beta bridge methods and `src/main/workflow-service.js` are archived
outside the current MVP baseline. Do not treat their historical documentation
or archive refs as an active permission surface.

Focused rejection coverage:

```text
npm run test:runtime-safety
```

This covers blocked external protocols, openPath roots, Obsidian markdown/vault
boundaries, `.meow` install target containment, package file path traversal, and
terminal start rejection for unknown tools or missing session ids.

## Existing Allow And Reject Rules

| Boundary | Allowed | Rejected or constrained |
|---|---|---|
| External URL | `http:`, `https:`, `mailto:`, `obsidian:`, and Windows AppsFolder targets matching the allowlist pattern | Any other protocol is blocked by `openExternalTarget` |
| Local open path | Paths inside trusted Meodesk Home or a selected/stored Obsidian vault | Paths outside those roots are rejected by `resolveOpenPathTarget` |
| Obsidian read | Markdown files inside a selected/stored trusted vault; raw read is capped | Non-markdown files and paths outside the trusted vault are rejected |
| Storage | Known storage keys mapped by `MEODESK_STORAGE_FILE_MAP` | Unknown or path-like keys must stay rejected by storage helpers |
| Workshop package import | `.meow` packages install under Meodesk Home `extensions/` or `install-tests/` | Renderer-supplied `targetPath` outside those roots and package file traversal paths are rejected |
| Plugin feature pages | Local `file://` iframe with sandbox and a narrow init `postMessage` | No unrestricted parent bridge, no same-origin inheritance, no persistence bridge by default |
| Sidebar widgets | Workspace host reads manifests and enables local widgets from indexed projects | Do not mount privileged widget bridges until sandbox, origin, resize, and persistence rules are specified |
| Terminal start | Tool id must resolve from known config/user tools; session id is required | Unknown tools and missing sessions are rejected |
| Desktop hosting | Retired desktop host IPC and HWND tokens are forbidden by contract test | Do not restore `SetParent`, raw HWND embedding, or `getDisplayMedia` projection |

## Required Evidence Before Widening

| Change type | Required evidence |
|---|---|
| New preload method | `npm run test:workbench-contract`; adapter type updated; handler owner documented |
| New IPC handler | Invalid payload rejection and owner-local validation |
| New filesystem root | Allowed-path and rejected-path coverage, plus documentation of why the root is trusted |
| New external protocol | Explicit allowlist entry, malicious/unknown protocol rejection, and user-facing reason |
| New plugin iframe capability | Sandbox/origin/message schema note and smoke or contract coverage |
| New command/terminal behavior | Start/fail/cleanup coverage and source adapter impact note |
| New package import/export behavior | Fixture package plus invalid manifest/path coverage |

## Pressure Points

These are not automatically broken, but they are the places where future debt is
most likely to re-enter:

```text
src/main.js
src/preload.js
src/main/workshop-service.js
src/main/command-resolver.js
src/main/terminal-runtime-service.js
src/main/terminal-source-adapter-service.js
src/renderer-app/src/app/App.tsx
src/renderer-app/src/features/workspace/workspace-route.tsx
src/renderer-app/src/features/studio/studio-route.tsx
```

## No-Go List

Do not approve a change that:

- Adds bridge access without updating the contract test.
- Opens arbitrary local paths from renderer input.
- Adds a plugin `postMessage` bridge using `"*"` without validating message
  type, extension id, and surface.
- Allows package import to write outside Meodesk Home.
- Adds terminal command execution from an unregistered tool descriptor.
- Swallows permission failures in smoke tests to keep the gate green.

## Current Follow-Ups

1. Keep `test:runtime-safety` in `verify:renderer` for permission rejection
   behavior.
2. Keep `test:workbench-contract` as the bridge shape gate.
3. Add service-level tests when IPC logic grows beyond shape checking.
4. Treat plugin iframe bridge work as a security/runtime phase, not as a UI
   feature toggle.

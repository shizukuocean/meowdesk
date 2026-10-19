# Desktop Agent Embedding Strategy

> Status: safety boundary after Claude desktop hosting incident
> Scope: third-party desktop Agent surfaces in Meowdesk
> Rule: no naked HWND reparenting for user-facing experiments

## Product Goal

Meowdesk should eventually let users work with desktop Agents without leaving the
workbench. The target experience is closer to "Claude is in my workstation" than
"Meowdesk opened another app for me".

Current product state:

- CLI Agents run inside Meowdesk through the existing terminal runtime.
- Claude desktop currently uses a safe external launch handoff.
- Desktop embedding is not shipped.

## What Is Blocked

Do not revive the old route:

```text
Electron main
  -> PowerShell / Win32 EnumWindows
  -> SetParent(third-party Claude HWND, Meowdesk HWND)
  -> MoveWindow on resize
```

This route already produced a user-visible failure: Claude desktop windows became
hidden or abnormal and had to be restored outside Meowdesk.

The Microsoft `SetParent` documentation also calls out cross-process and DPI
awareness hazards. Windows App SDK `AppWindow` is meant for app-owned windows,
not for safely swallowing arbitrary third-party Electron/UWP-style app windows.

## Allowed Tracks

### Track A: Safe External Launch

Ship now.

- Open or focus the desktop app through the OS.
- Copy Meowdesk project context for handoff.
- Do not claim the app is embedded.
- Keep the Studio workstation visually ready for future embedding, but label it
  as paused.

### Track B: Web-Backed Embedded Surface

Feasibility depends on provider support.

- Use WebView2 or Electron `BrowserView` for a web surface that the provider
  explicitly supports.
- Treat authentication, storage, permissions, and ToS as product/legal gates.
- This is not "desktop Claude embedded"; it is "supported web Claude-like
  surface embedded".

### Track C: Cooperative Native Helper

Feasibility depends on building a controlled host process.

- A native helper may manage app launch, foregrounding, window discovery, and
  UI Automation safely.
- It must not start by reparenting arbitrary third-party HWNDs.
- It needs a kill/release recovery path, crash isolation, telemetry, and a small
  allowlist per app.

### Track D: Companion Mode

Likely the safest medium-term desktop Agent route.

- Keep the third-party app outside Meowdesk.
- Add a Meowdesk-controlled companion panel with context copy, file/package
  handoff, active project state, and one-click focus.
- Reduce switching pain without pretending the foreign window is owned by
  Meowdesk.

## Engineering Guard

The workbench contract test now rejects the old dangerous route:

- `desktopHost:attach`
- `desktopHost:updateBounds`
- `desktopHost:detach`
- `attachDesktopWindow`
- `updateDesktopWindowBounds`
- `detachDesktopWindow`
- `runDesktopHostPowerShell`
- `MEOWDESK_DESKTOP_HOST_PAYLOAD`
- direct `SetParent` / `MoveWindow` helper tokens in `src/main.js`

If a future desktop embedding implementation is approved, it must introduce a
new explicit contract and update this document and the contract test in the same
commit.

## Decision For Next Build

For the release path, keep Track A and D. Track B/C can be researched, but they
should not block CLI Agent and workshop publishing work.

References:

- Microsoft SetParent API: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent
- Microsoft WebView2 Win32 getting started: https://learn.microsoft.com/en-us/microsoft-edge/webview2/get-started/win32
- Windows App SDK windowing overview: https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/windowing/windowing-overview

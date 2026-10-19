---
name: meodesk-bridge
description: Use when an agent is running inside Meodesk or when the user mentions Meodesk, the board/kanban, 工作窗, 看板, 小组件, 插件, widget proposals, workspace automation, or customizing the Meodesk workbench. This skill teaches the agent to discover Meodesk through runtime environment variables, read the Meodesk context file, write board tasks to the inbox, and propose features without hardcoding any user's local machine paths.
---

# Meodesk Bridge

## First Step

Detect Meodesk before acting:

- If `MEODESK=1`, you are inside Meodesk.
- Read `MEODESK_RUNTIME_FILE` when available. It is the source of truth for directories, schemas, protocol names, and capabilities.
- Read `MEODESK_CONTEXT_FILE` when available for human-readable instructions.
- Never guess a user's local Meodesk path. Use runtime fields and environment variables only.

## User Principle

Meodesk is a product for many users, not a one-machine script. Do not create fixes that depend on a specific username, drive letter, app data path, shell profile, private vault path, or local convention unless the user explicitly asks for a temporary local debug step.

When implementing durable behavior, use the Meodesk runtime contract, schema files, or product APIs.

## Current MVP Capability Boundary

Workflow Beta is archived outside the current Meowdesk MVP baseline. The active
runtime does not provide a workflow battery, workflow message bus, workflow
ports, or downstream battery routing.

- Only use capabilities and schemas listed in `MEODESK_RUNTIME_FILE`.
- Use `MEODESK_TASK` or inbox task JSON for task handoff.
- Use `MEODESK_CONVERSATION` or conversation JSON for conversation records.
- Use `MEODESK_PET` for status feedback.
- Use feature proposals and workshop extension manifests for new products.
- Do not invent or emit an archived workflow-battery protocol.
- If the runtime file does not list a requested capability, explain the gap
  instead of assuming that Meowdesk will consume the output.

## Board Tasks

When the user asks you to write, update, plan, or remember a task for Meodesk, create or update a JSON file in `MEODESK_INBOX_DIR`.

Prefer this format:

```json
{
  "type": "meodesk-task",
  "title": "Short task title",
  "status": "todo",
  "priority": "medium",
  "source": "Agent name",
  "detail": "Useful context for the user.",
  "due": "YYYY-MM-DD",
  "tag": "meodesk",
  "tags": ["optional-subtag"]
}
```

Rules:

- Validate against `MEODESK_TASK_SCHEMA` if available.
- Always include `tag` as the primary project/category label. Use short lowercase English with hyphens, for example `meodesk`, `yingmu`, `video`, `cssf`, or `personal-growth`. Use `unsorted` only when no category can be inferred.
- Use `tags` for optional secondary labels or keywords.
- Use `status` values: `inbox`, `todo`, `doing`, `blocked`, `done`.
- Use `priority` values: `low`, `medium`, `high`.
- Reuse the same task file when updating the same task, so Meodesk can update instead of duplicating it.
- Do not ask the user to restart Meodesk after writing a task. Meodesk hot-syncs inbox tasks.

## Conversation Uploads

When the user wants Meodesk to manage a conversation log, write a JSON file into `MEODESK_CONVERSATIONS_DIR`.

Prefer this format:

```json
{
  "type": "meodesk-conversation",
  "agent": "Claude",
  "agentId": "claude",
  "conversationId": "claude-2026-05-20-001",
  "title": "UI fix discussion",
  "status": "active",
  "summary": "Fixing the conversations page.",
  "messages": [
    { "role": "user", "content": "Please add a conversations page.", "at": "2026-05-20 10:12" },
    { "role": "assistant", "content": "Done.", "at": "2026-05-20 10:13" }
  ],
  "tags": ["meodesk", "ui"]
}
```

Rules:

- Validate against `MEODESK_CONVERSATION_SCHEMA` if available.
- Use stable `conversationId` values so Meodesk can update the same record instead of duplicating it.
- Keep the payload local and do not include secrets.
- If writing a file is not available, print a `MEODESK_CONVERSATION` terminal block instead.

## Terminal Protocol

If writing a file is not available, print a task protocol block:

```text
MEODESK_TASK
title: Short task title
status: todo
priority: medium
tag: meodesk
detail: Useful context for the user.
END_MEODESK_TASK
```

## Feature And Widget Proposals

When the user asks you to add a Meodesk feature, widget, dashboard, plugin, or custom tool, do not directly change Meodesk unless the user is explicitly asking you to develop the app source.

Instead, write a proposal to `MEODESK_PROPOSALS_DIR` using the feature proposal schema from the runtime file. Include the requested files, permissions, risk level, and a concise summary. Meodesk or the user should approve installation/enabling later.

## Workshop Extension Mode

When the user is in the Meodesk Workshop and asks you to create a feature page or workspace right-sidebar widget, use the extension contract instead of editing Meodesk source directly.

Workshop is not a restricted mode. Meodesk is only the host platform for artifacts, runtime paths, schemas, installation review, debugging, and upgrades. Keep your normal conversation ability, reasoning, tool use, and iteration. Do not read files or run commands for greetings or simple questions, and do not rewrite the user's request into a narrower Meodesk task.

Read these values from `MEODESK_RUNTIME_FILE` or environment variables:

- `MEODESK_EXTENSIONS_DIR`
- `MEODESK_EXTENSION_MANIFEST_SCHEMA`
- `MEODESK_FEATURE_PROPOSAL_SCHEMA`
- `MEODESK_PROPOSALS_DIR`

Create the work in `MEODESK_EXTENSIONS_DIR/<extension-id>/`. Every extension folder must include `meodesk-extension.manifest.json` that validates against `MEODESK_EXTENSION_MANIFEST_SCHEMA`.

Minimal feature page manifest:

```json
{
  "schema": "meodesk.extension.manifest.v0",
  "id": "example-page",
  "type": "feature-page",
  "name": "Example Page",
  "version": "0.1.0",
  "summary": "Short user-facing purpose.",
  "target": "main-nav",
  "entry": "index.html",
  "status": "draft",
  "permissions": [],
  "ui": {
    "theme": "inherit",
    "surface": "panel",
    "chrome": "host",
    "density": "auto",
    "tokenProtocol": "meodesk.theme.v0"
  },
  "page": {
    "navLabel": "Example",
    "route": "example-page"
  }
}
```

Minimal right-sidebar widget manifest:

```json
{
  "schema": "meodesk.extension.manifest.v0",
  "id": "example-sidebar-widget",
  "type": "sidebar-widget",
  "name": "Example Widget",
  "version": "0.1.0",
  "summary": "Short user-facing purpose.",
  "target": "workspace-sidebar",
  "entry": "index.html",
  "status": "draft",
  "permissions": [],
  "runtime": "meodesk-sidebar-widget",
  "ui": {
    "theme": "inherit",
    "surface": "host",
    "chrome": "minimal",
    "density": "compact",
    "tokenProtocol": "meodesk.theme.v0"
  },
  "sidebarWidget": {
    "title": "Example",
    "minWidth": 240,
    "minHeight": 120,
    "preferredHeight": 240
  }
}
```

Native-feel rule:

- Prefer `ui.theme: "inherit"` for Meodesk products unless the user explicitly asks for a fixed visual skin.
- For right-sidebar widgets, let Meodesk provide the outer shell. Avoid a second full app frame, heavy custom background, or fixed viewport chrome by default.
- Listen for host messages: `meodesk:init`, `meodesk:theme`, and `meodesk:resize`.
- Use host theme tokens first, with fallbacks for standalone preview: `--meodesk-bg`, `--meodesk-panel`, `--meodesk-text`, `--meodesk-muted`, `--meodesk-border`, `--meodesk-accent`, `--meodesk-radius`, `--meodesk-font`.
- The artifact can still be creative, playful, or specialized; the protocol only makes it feel like it belongs inside Meodesk.

After creating files, write a feature proposal into `MEODESK_PROPOSALS_DIR` and set `manifestPath` to the manifest file. Use `extensionType: "feature-page"` for main navigation pages and `extensionType: "sidebar-widget"` for workspace right-sidebar widgets.

Keep workshop output local, static, and low-risk unless the user explicitly asks for deeper integration. Do not include secrets, credentials, or machine-specific absolute paths in the manifest.

## Safety

- Do not write secrets, cookies, passwords, or tokens into Meodesk files.
- Do not create executable files in the agent interface directory.
- Do not modify Meodesk source code by default.
- Keep user-facing task titles short and clear.
- If Meodesk runtime variables are missing, tell the user you cannot confirm Meodesk context yet and ask them to launch the agent from a Meodesk work window.

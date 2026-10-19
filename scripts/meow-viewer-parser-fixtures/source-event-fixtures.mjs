import assert from "node:assert/strict";
import {
  workspaceRendererParseSourceSnapshot,
  workspaceRendererStripTerminalControls
} from "../../src/renderer-app/src/features/meow-viewer/meow-viewer-parser.ts";
import { now, textOf } from "./harness.mjs";

export function runSourceEventFixtures() {
  {
    const assistantText = [
      "# Meow Viewer 语义源验收",
      "",
      "html",
      "<!DOCTYPE html>",
      "<html>",
      "<body>",
      "  <section class=\"gate\">",
      "    <p>semantic source</p>",
      "  </section>",
      "</body>",
      "</html>",
      "",
      "bash",
      "#!/usr/bin/env bash",
      "cat <<EOF",
      "adapter event body",
      "EOF",
      "",
      "```sql",
      "SELECT tu.*,",
      "       v.session_count",
      "FROM tag_user tu;",
      "```",
      "",
      "```diff",
      "--- a/src/app.py",
      "+++ b/src/app.py",
      "@@ -1,3 +1,3 @@",
      " context",
      "-old",
      "+new",
      "```"
    ].join("\n");
    const result = workspaceRendererParseSourceSnapshot({
      profile: "hermes",
      sourceEvents: [
        { kind: "terminal_raw", text: "Welcome to Hermes Agent\nhtml\nbroken terminal echo", source: "terminal", createdAt: now - 50 },
        { kind: "user_message", text: "验收 prompt", source: "adapter", createdAt: now - 40 },
        { kind: "status", label: "阶段", status: "Hermes 正在整理回复", summary: "thinking", source: "adapter", createdAt: now - 30 },
        { kind: "assistant_message", text: assistantText, source: "adapter", createdAt: now - 20 }
      ],
      rawTranscript: "Welcome to Hermes Agent\nhtml\nbroken terminal echo",
      status: "running",
      now
    });
    const rendered = textOf(result);
    assert.equal(result.events.some((event) => event.kind === "assistant_message" && event.text.includes("SELECT tu.*,")), true);
    assert.equal(result.statusItems.some((item) => item.label === "阶段" && item.value === "Hermes 正在整理回复" && item.tone === "thinking"), true);
    assert.equal(rendered.includes("Welcome to Hermes Agent"), false);
    assert.equal(rendered.includes("broken terminal echo"), false);
    assert.equal(rendered.includes("adapter event body"), true);
    assert.equal(rendered.includes("SELECT tu.*,"), true);
  }

  {
    const raw = "hello\u001b[31m red\u001b[0m\r\nnext";
    assert.equal(workspaceRendererStripTerminalControls(raw), "hello red\nnext");
  }
}

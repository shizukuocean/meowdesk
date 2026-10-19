import type { OwnershipScope } from "@/lib/identity";

export type WorkspaceRendererPaneLike = {
  toolId?: string;
  name?: string;
  kind?: string;
  command?: string;
};

export type WorkspaceTerminalSubmitSource = "terminal" | "renderer";

export type WorkspaceTerminalUserTurn = {
  id: string;
  text: string;
  source: WorkspaceTerminalSubmitSource;
  createdAt: number;
};

export type WorkspaceRendererProfile = "claude" | "hermes" | "codex" | "terminal" | "other";
export type WorkspaceRenderedSegmentKind = "user" | "assistant" | "thinking" | "markdown" | "startup";
export type WorkspaceRendererToolTone = "read" | "write" | "edit" | "run" | "info";
export type WorkspaceRendererStatusTone = "model" | "context" | "thinking" | "info";

export type WorkspaceRendererSourceEventKind =
  | "terminal_display"
  | "terminal_raw"
  | "terminal_status"
  | "status"
  | "user_submit"
  | "user_message"
  | "assistant_message"
  | "markdown_document"
  | "thinking"
  | "startup"
  | "tool_call"
  | "tool_result";

export type WorkspaceRendererSourceEvent = OwnershipScope & {
  kind: WorkspaceRendererSourceEventKind;
  text?: string;
  summary?: string;
  tone?: WorkspaceRendererToolTone;
  label?: string;
  detail?: string;
  status?: string;
  source?: WorkspaceTerminalSubmitSource | "adapter";
  createdAt?: number;
};

export type WorkspaceRendererSourceSnapshot = OwnershipScope & {
  id?: string;
  profile: WorkspaceRendererProfile;
  sourceEvents?: WorkspaceRendererSourceEvent[];
  displayTranscript?: string;
  rawTranscript?: string;
  userTurns?: WorkspaceTerminalUserTurn[];
  status?: string;
  updatedAt?: number;
  now?: number;
};

export type WorkspaceRenderedSegment = {
  kind: WorkspaceRenderedSegmentKind;
  text: string;
  summary?: string;
};

export type WorkspaceRendererEventKind =
  | "user_message"
  | "assistant_message"
  | "thinking"
  | "markdown_document"
  | "startup"
  | "tool_call"
  | "tool_preview"
  | "tool_result";

export type WorkspaceRendererEvent = {
  kind: WorkspaceRendererEventKind;
  text: string;
  summary?: string;
  tone?: WorkspaceRendererToolTone;
  label?: string;
  detail?: string;
};

export type WorkspaceRendererPermissionPrompt = {
  title: string;
  detail: string;
  choices: Array<{
    label: string;
    value: string;
    tone: "primary" | "outline";
  }>;
};

export type WorkspaceRendererStatusItem = {
  label: string;
  value: string;
  tone: WorkspaceRendererStatusTone;
};

export type WorkspaceRendererParseInput = {
  raw: string;
  profile: WorkspaceRendererProfile;
  userTurns?: WorkspaceTerminalUserTurn[];
  now?: number;
};

export type WorkspaceRendererParseResult = {
  sourceEvents: WorkspaceRendererSourceEvent[];
  events: WorkspaceRendererEvent[];
  segments: WorkspaceRenderedSegment[];
  statusItems: WorkspaceRendererStatusItem[];
  permissionPrompt: WorkspaceRendererPermissionPrompt | null;
};

export function workspaceRendererProfileForPane(pane?: WorkspaceRendererPaneLike | null): WorkspaceRendererProfile {
  const text = `${pane?.toolId || ""} ${pane?.name || ""} ${pane?.kind || ""} ${pane?.command || ""}`.toLowerCase();
  if (text.includes("claude")) return "claude";
  if (text.includes("hermes")) return "hermes";
  if (text.includes("codex")) return "codex";
  if (text.includes("terminal") || text.includes("powershell") || text.includes("shell")) return "terminal";
  return "other";
}

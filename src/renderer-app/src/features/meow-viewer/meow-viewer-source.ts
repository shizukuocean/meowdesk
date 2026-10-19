import { Terminal as XtermTerminal } from "@xterm/xterm";
import {
  workspaceRendererStripTerminalControls
} from "./meow-viewer-parser";
import type { WorkspaceRendererSourceEvent } from "./meow-viewer-contract";

export function workspaceTerminalTranscript(term: XtermTerminal | null) {
  const buffer = term?.buffer?.active;
  if (!buffer) return "";
  const lines: string[] = [];
  const start = Math.max(0, buffer.length - 1200);
  for (let index = start; index < buffer.length; index += 1) {
    const bufferLine = buffer.getLine(index);
    if (!bufferLine) continue;
    const text = bufferLine.translateToString(true).replace(/\u00a0/g, " ");
    if (bufferLine.isWrapped && lines.length) {
      lines[lines.length - 1] = `${lines[lines.length - 1]}${text}`;
      continue;
    }
    lines.push(text);
  }
  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd();
}

export function workspaceRendererStatusPreviewFromTerminalData(data: string) {
  return workspaceRendererStripTerminalControls(data)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const normalized = line.replace(/[│┃]/g, "|");
      const hasContextMetric = /\bctx\b/i.test(normalized)
        || /\d+(?:\.\d+)?[KMG]?\/\d+(?:\.\d+)?[KMG]?/i.test(normalized);
      return (/^\$\s+/.test(normalized) && hasContextMetric)
        || (/^\|?\s*\$?\s*[\w.-]+/.test(normalized) && hasContextMetric)
        || /\b(?:Opus|Sonnet|Haiku)\s+[0-9]/i.test(normalized)
        || /\b(?:xhigh|high|medium|low)\b.*\/effort/i.test(normalized);
    })
    .map((line) => line.slice(0, 320))
    .join("\n");
}

export function workspaceRendererMergeStatusPreview(current: string, next: string) {
  if (!next.trim()) return current;
  return `${current}\n${next}`
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-60)
    .join("\n");
}

export function workspaceRendererDisplayTranscriptWithStatusPreview(statusPreview: string, displayTranscript: string) {
  return [statusPreview.trim(), displayTranscript.trim()].filter(Boolean).join("\n");
}

export function workspaceRendererTextHasStatusPreview(text: string) {
  return Boolean(workspaceRendererStatusPreviewFromTerminalData(text).trim());
}

function workspaceRendererSourceEventTextSignature(text: string | undefined) {
  const value = String(text || "");
  if (value.length <= 360) return value;
  return `${value.length}:${value.slice(0, 180)}:${value.slice(-120)}`;
}

export function workspaceRendererSourceEventSignature(event: WorkspaceRendererSourceEvent) {
  return [
    event.kind,
    event.source || "",
    Number.isFinite(event.createdAt) ? String(event.createdAt) : "",
    event.status || "",
    event.label || "",
    event.detail || "",
    event.summary || "",
    event.tone || "",
    workspaceRendererSourceEventTextSignature(event.text)
  ].join("\u0001");
}

export function workspaceRendererDedupeSourceEvents(events: WorkspaceRendererSourceEvent[], limit: number) {
  const seen = new Set<string>();
  const deduped: WorkspaceRendererSourceEvent[] = [];
  for (const event of events) {
    const key = workspaceRendererSourceEventSignature(event);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }
  return deduped.slice(-limit);
}

export function workspaceRendererNonRawSourceEvents(events: WorkspaceRendererSourceEvent[]) {
  return events.filter((event) => event.kind !== "terminal_raw" && event.kind !== "terminal_display");
}

export function workspaceRendererSourceEventListSignature(events: WorkspaceRendererSourceEvent[]) {
  return workspaceRendererNonRawSourceEvents(events)
    .map(workspaceRendererSourceEventSignature)
    .join("\u0002");
}

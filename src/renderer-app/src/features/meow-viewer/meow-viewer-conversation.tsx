import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import meowniGuideCommand from "@/assets/meowni/cutouts/meowni-guide-command.png";
import { optionalWorkbenchApi } from "@/lib/workbench-api";
import { cn } from "@/lib/utils";
import {
  workspaceRendererAsciiTable,
  workspaceRendererAsciiTableBlock,
  workspaceRendererCallout,
  workspaceRendererCodeBlock,
  workspaceRendererDiffLineTone,
  workspaceRendererHeadingLevel,
  workspaceRendererImplicitHeading,
  workspaceRendererInferCodeLanguage,
  workspaceRendererLabelledCodeBlock,
  workspaceRendererLineContinuesDiffBlock,
  workspaceRendererLineIsDiffHeader,
  workspaceRendererLineIsDiffHunk,
  workspaceRendererLineIsDiffLike,
  workspaceRendererLineIsMarkdownHr,
  workspaceRendererLineIsMarkdownTableSeparator,
  workspaceRendererLineIsTableBorder,
  workspaceRendererLooseAsciiTable,
  workspaceRendererNormalizeMarkdownTables,
  workspaceRendererRebuildFieldTableLines,
  workspaceRendererRebuildMarkdownTableLines,
  workspaceRendererShouldStartDiffBlock,
  workspaceRendererTable,
  workspaceRendererToolStatusFromMarker,
  workspaceRendererTreeBlock
} from "./meow-viewer-parser";
import type {
  WorkspaceRenderedSegment,
  WorkspaceRendererProfile,
  WorkspaceRendererStatusItem,
  WorkspaceRendererToolTone
} from "./meow-viewer-contract";

export type MeowViewerSourceStatus = "idle" | "starting" | "running" | "stopping" | "exited" | "error";

function workspaceRendererInline(text: string, keyPrefix: string): ReactNode[] {
  const filePattern = /((?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|[A-Za-z0-9_-]+[\\/])[\w .\\/:-]+\.(?:tsx?|jsx?|json|md|css|html|ya?ml|png|jpe?g|svg|ico|txt))/g;
  const parts = String(text || "").split(/(`[^`\n]+`|\*\*(?:.*?)\*\*|\*[^*\n]+?\*)/g);
  return parts.flatMap((part, index) => {
    if (!part) return [];
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return [<code key={`${keyPrefix}-code-${index}`}>{part.slice(1, -1)}</code>];
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const inner = part.slice(2, -2);
      return [<strong key={`${keyPrefix}-strong-${index}`}>{workspaceRendererInline(inner, `${keyPrefix}-inner-${index}`)}</strong>];
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2 && !part.startsWith("**")) {
      return [<em key={`${keyPrefix}-em-${index}`}>{part.slice(1, -1)}</em>];
    }
    return part.split(filePattern).filter(Boolean).map((chunk, chunkIndex) => {
      if (filePattern.test(chunk)) {
        filePattern.lastIndex = 0;
        return <code key={`${keyPrefix}-path-${index}-${chunkIndex}`} className="meowdesk-output-renderer-path">{chunk}</code>;
      }
      filePattern.lastIndex = 0;
      return <span key={`${keyPrefix}-text-${index}-${chunkIndex}`}>{chunk}</span>;
    });
  });
}

function WorkspaceRendererDiffBlock({ lines, title = "diff" }: { lines: string[]; title?: string }) {
  const caption = title === "meowdiff" ? "修改预览" : title;
  const diffText = lines.join("\n");
  return (
    <figure className="meowdesk-output-renderer-diff" data-r2-output-renderer-diff>
      <figcaption>
        <span>{caption}</span>
        <WorkspaceRendererCopyButton text={diffText} label="复制 diff" value="diff" />
      </figcaption>
      <div>
        {lines.map((line, index) => (
          <pre key={index} data-r2-output-renderer-diff-line={workspaceRendererDiffLineTone(line)}>{line}</pre>
        ))}
      </div>
    </figure>
  );
}

function WorkspaceRendererToolStatus({ tone, label, detail }: { tone: WorkspaceRendererToolTone; label: string; detail: string }) {
  return (
    <div className="meowdesk-output-renderer-tool" data-r2-output-renderer-tool={tone}>
      <strong>{label}</strong>
      {detail ? <span>{workspaceRendererInline(detail, `tool-${tone}-${label}`)}</span> : null}
    </div>
  );
}

function workspaceRendererActorLabel(profile: WorkspaceRendererProfile) {
  if (profile === "hermes") return "Hermes";
  if (profile === "claude") return "Claude";
  if (profile === "codex") return "Codex";
  return "Agent";
}

function workspaceRendererSegmentIsToolOnly(segment: WorkspaceRenderedSegment) {
  if (segment.kind !== "assistant") return false;
  const lines = segment.text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => Boolean(workspaceRendererToolStatusFromMarker(line)));
}

function workspaceRendererSegmentIsAssistantReply(segment: WorkspaceRenderedSegment) {
  if (segment.kind === "markdown") return true;
  return segment.kind === "assistant" && !workspaceRendererSegmentIsToolOnly(segment);
}

function workspaceRendererUserTurnIsPermissionResolution(segment: WorkspaceRenderedSegment) {
  if (segment.kind !== "user") return false;
  const text = segment.text.trim();
  if (/^[123]$/.test(text)) return true;
  return /request interrupted by user for tool use|user rejected/i.test(text);
}

export function workspaceRendererPendingReplyIndex(segments: WorkspaceRenderedSegment[], sourceStatus: MeowViewerSourceStatus) {
  if (sourceStatus !== "running" && sourceStatus !== "starting") return -1;
  let latestUserIndex = -1;
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (segments[index].kind === "user") {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex < 0) return -1;
  if (workspaceRendererUserTurnIsPermissionResolution(segments[latestUserIndex])) return -1;
  const hasReplyAfterUser = segments
    .slice(latestUserIndex + 1)
    .some((segment) => workspaceRendererSegmentIsAssistantReply(segment));
  return hasReplyAfterUser ? -1 : latestUserIndex;
}

function workspaceRendererPendingReplyDetail(
  segments: WorkspaceRenderedSegment[],
  items: WorkspaceRendererStatusItem[],
  sourceStatus: MeowViewerSourceStatus
) {
  const statusItem = [...items].reverse().find((item) => item.tone === "thinking");
  if (statusItem?.value) return statusItem.value;
  const thinkingSegment = [...segments].reverse().find((segment) => segment.kind === "thinking");
  const thinkingText = thinkingSegment?.summary || thinkingSegment?.text;
  if (thinkingText) return thinkingText;
  if (sourceStatus === "starting") return "正在启动";
  return "正在整理回复";
}

export function WorkspaceRendererStatusPanel({
  items
}: {
  items: WorkspaceRendererStatusItem[];
}) {
  if (!items.length) return null;
  return (
    <div className="meowdesk-output-renderer-status-strip" data-r2-output-renderer-status-strip>
      {items.map((item) => (
        <span key={`${item.label}-${item.value}`} data-r2-output-renderer-status-item={item.tone}>
          <strong>{item.label}</strong>
          <b>{item.value}</b>
        </span>
      ))}
    </div>
  );
}

function WorkspaceRendererPendingReply({
  detail,
  profile,
  sourceStatus
}: {
  detail: string;
  profile: WorkspaceRendererProfile;
  sourceStatus: MeowViewerSourceStatus;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAtRef = useRef(Date.now());
  const actor = workspaceRendererActorLabel(profile);
  const title = sourceStatus === "starting" ? "meowni启动中" : "meowni收集回复中";
  const elapsedLabel = `${Math.max(0, elapsedSeconds)}秒`;
  useEffect(() => {
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [profile, sourceStatus]);
  return (
    <section
      className="meowdesk-output-renderer-pending-reply"
      data-r2-output-renderer-activity-panel={profile}
      data-r2-output-renderer-activity-pending={profile}
      data-r2-output-renderer-activity-state={sourceStatus}
      data-r2-output-renderer-activity-detail={detail || undefined}
      aria-label={`${actor} ${title} ${elapsedLabel}`}
    >
      <span className="meowdesk-output-renderer-meowni" aria-hidden="true">
        <img src={meowniGuideCommand} alt="" />
      </span>
      <div>
        <strong>{title}</strong>
        <span>{elapsedLabel}</span>
      </div>
      <i aria-hidden="true" />
    </section>
  );
}

function WorkspaceRendererMessageAgentHeader({
  profile
}: {
  profile: WorkspaceRendererProfile;
}) {
  const actor = workspaceRendererActorLabel(profile);
  return (
    <div
      className="meowdesk-output-renderer-message-agent"
      data-r2-output-renderer-message-agent={profile}
      data-r2-output-renderer-activity-panel={profile}
      data-r2-output-renderer-activity-state="complete"
    >
      <span className="meowdesk-output-renderer-meowni" aria-hidden="true">
        <img src={meowniGuideCommand} alt="" />
      </span>
      <div>
        <strong>{actor} 已回复</strong>
        <span>回复完毕</span>
      </div>
      <Check size={14} aria-hidden="true" />
    </div>
  );
}

function WorkspaceRendererCopyButton({
  text,
  label,
  value,
  className
}: {
  text: string;
  label: string;
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const content = String(text || "");
    if (!content.trim()) return;
    const api = optionalWorkbenchApi();
    const operation = api?.writeClipboardText
      ? api.writeClipboardText(content)
      : typeof navigator !== "undefined" && navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(content)
        : Promise.resolve();
    void Promise.resolve(operation).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  };
  return (
    <button
      type="button"
      className={cn("meowdesk-output-renderer-copy-button", className)}
      title={copied ? "已复制" : label}
      aria-label={copied ? "已复制" : label}
      data-r2-output-renderer-copy={value}
      onClick={handleCopy}
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      <span>{copied ? "已复制" : "复制"}</span>
    </button>
  );
}

function workspaceRendererCodeTokenClass(token: string) {
  if (/^\/\//.test(token)) return "token-comment";
  if (/^["'`]/.test(token)) return "token-string";
  if (/^<\/?[A-Za-z]/.test(token)) return "token-tag";
  if (/^#[0-9a-fA-F]{3,8}\b/.test(token)) return "token-number";
  if (/^\b(?:function|const|let|var|return|if|else|import|from|export|class|def|async|await|for|while|switch|case|break|continue|type|interface|enum|new|try|catch|finally|throw|true|false|null|undefined)\b/.test(token)) return "token-keyword";
  if (/^\d/.test(token)) return "token-number";
  if (/^[{}()[\];,.:=+\-*/<>]$/.test(token)) return "token-punctuation";
  return "";
}

function workspaceRendererCodeInline(line: string, keyPrefix: string): ReactNode[] {
  const text = String(line || "");
  const hashComment = text.match(/^(\s*)(#.*)$/);
  if (hashComment && !/[{;}]/.test(hashComment[2]) && !/^#[0-9a-fA-F]{3,8}\b/.test(hashComment[2].trim())) {
    return [
      hashComment[1],
      <span key={`${keyPrefix}-comment`} className="token-comment">{hashComment[2]}</span>
    ];
  }
  const tokenPattern = /(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[A-Za-z][^>]*>|#[0-9a-fA-F]{3,8}\b|\b(?:function|const|let|var|return|if|else|import|from|export|class|def|async|await|for|while|switch|case|break|continue|type|interface|enum|new|try|catch|finally|throw|true|false|null|undefined)\b|\b\d+(?:\.\d+)?(?:px|rem|em|%)?\b|[{}()[\];,.:=+\-*/<>])/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const className = workspaceRendererCodeTokenClass(token);
    nodes.push(className
      ? <span key={`${keyPrefix}-token-${match.index}`} className={className}>{token}</span>
      : token);
    lastIndex = match.index + token.length;
    if (token.startsWith("//")) break;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length ? nodes : [text];
}

function WorkspaceRendererCodeBlock({ lang, code }: { lang: string; code: string }) {
  const label = lang || "text";
  const codeLines = String(code || "").split("\n");
  return (
    <figure className="meowdesk-output-renderer-code" data-r2-output-renderer-code={label}>
      <figcaption>
        <span>{label}</span>
        <WorkspaceRendererCopyButton text={code} label="复制代码" value="code" />
      </figcaption>
      <pre><code>{codeLines.map((line, index) => (
          <span key={index} className="meowdesk-output-renderer-code-line">
            {workspaceRendererCodeInline(line, `code-${label}-${index}`)}
          </span>
        ))}</code></pre>
    </figure>
  );
}

function workspaceRendererMarkdownTableCell(value: string) {
  return String(value || "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function workspaceRendererTableToMarkdown(table: { headers: string[]; rows: string[][] }) {
  const headers = table.headers.map(workspaceRendererMarkdownTableCell);
  const rows = table.rows.map((row) => row.map(workspaceRendererMarkdownTableCell));
  const width = Math.max(headers.length, ...rows.map((row) => row.length), 1);
  const pad = (items: string[]) => Array.from({ length: width }, (_, index) => items[index] || "");
  return [
    `| ${pad(headers).join(" | ")} |`,
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${pad(row).join(" | ")} |`)
  ].join("\n");
}

function WorkspaceRendererTableBlock({
  table,
  tableKey
}: {
  table: { headers: string[]; rows: string[][] };
  tableKey: string;
}) {
  const markdown = workspaceRendererTableToMarkdown(table);
  return (
    <div key={tableKey} className="meowdesk-output-renderer-table-wrap" data-r2-output-renderer-table>
      <div className="meowdesk-output-renderer-table-actions">
        <WorkspaceRendererCopyButton
          text={markdown}
          label="复制表格"
          value="table"
          className="meowdesk-output-renderer-table-copy"
        />
      </div>
      <table>
        <thead>
          <tr>{table.headers.map((cell, cellIndex) => <th key={cellIndex}>{workspaceRendererInline(cell, `${tableKey}-th-${cellIndex}`)}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} data-label={table.headers[cellIndex] || ""}>{workspaceRendererInline(cell, `${tableKey}-td-${rowIndex}-${cellIndex}`)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function workspaceRendererMarkdownFenceTables(lang: string, codeLines: string[]) {
  if (!/^(?:markdown|md)$/i.test(String(lang || "").trim())) return null;
  const lines = workspaceRendererRebuildFieldTableLines(
    workspaceRendererRebuildMarkdownTableLines(workspaceRendererNormalizeMarkdownTables(codeLines.join("\n")).split("\n"))
  );
  const nonEmptyLines = lines.filter((line) => line.trim());
  if (nonEmptyLines.length < 2) return null;
  const tables: { headers: string[]; rows: string[][] }[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }
    const table = workspaceRendererTable(lines, index);
    if (!table || table.headers.length < 2 || table.rows.length < 1) return null;
    const consumedLines = lines.slice(index, table.next);
    if (!consumedLines.some((line) => /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line.trim()))) return null;
    tables.push({ headers: table.headers, rows: table.rows });
    index = table.next;
  }
  return tables.length ? tables : null;
}

function workspaceRendererCodeOrMarkdownPreviewNode(key: string, lang: string, codeLines: string[]) {
  if (/^(?:diff|patch|meowdiff)$/i.test(lang)) {
    return <WorkspaceRendererDiffBlock key={key} lines={codeLines} title={lang} />;
  }
  const markdownTables = workspaceRendererMarkdownFenceTables(lang, codeLines);
  if (markdownTables) {
    return (
      <div key={key} className="meowdesk-output-renderer-markdown-preview" data-r2-output-renderer-markdown-preview="table">
        {markdownTables.map((table, tableIndex) => (
          <WorkspaceRendererTableBlock
            key={`${key}-table-${tableIndex}`}
            tableKey={`${key}-table-${tableIndex}`}
            table={table}
          />
        ))}
      </div>
    );
  }
  return <WorkspaceRendererCodeBlock key={key} lang={lang} code={codeLines.join("\n")} />;
}

function workspaceRendererBareLanguageLabel(line: string) {
  return String(line || "").trim().match(/^(python|py|javascript|js|typescript|ts|tsx|jsx|json|css|html|bash|shell|sh|yaml|yml|sql|rust|rs|java|go|golang|php|ruby|rb|swift|kotlin|kt|scala|dart|c|cpp|c\+\+|csharp|c#|cs|r|perl|powershell|ps1|diff|patch|meowdiff)\s*:?\s*$/i);
}

function workspaceRendererSectionLanguageLabel(line: string) {
  return String(line || "").trim().match(/^(?:\d+[.)]|[-*])\s+(python|py|javascript|js|typescript|ts|tsx|jsx|json|css|html|bash|shell|sh|yaml|yml|sql|rust|rs|java|go|golang|php|ruby|rb|swift|kotlin|kt|scala|dart|c|cpp|c\+\+|csharp|c#|cs|r|perl|powershell|ps1|diff|patch|meowdiff)\s*:?\s*$/i);
}

function workspaceRendererHeadingLanguageLabel(line: string) {
  return String(line || "").trim().match(/^(?:\d+[.)]\s*)?(python|py|javascript|js|typescript|ts|tsx|jsx|json|css|html|bash|shell|sh|yaml|yml|sql|rust|rs|java|go|golang|php|ruby|rb|swift|kotlin|kt|scala|dart|c|cpp|c\+\+|csharp|c#|cs|r|perl|powershell|ps1|diff|patch|meowdiff)\s*$/i);
}

function workspaceRendererNormalizeCodeLanguageLabel(label: string) {
  const normalized = String(label || "").toLowerCase();
  if (normalized === "py") return "python";
  if (normalized === "rb") return "ruby";
  if (normalized === "kt") return "kotlin";
  if (normalized === "rs") return "rust";
  if (normalized === "golang") return "go";
  if (normalized === "c++") return "cpp";
  if (normalized === "c#" || normalized === "csharp") return "cs";
  if (normalized === "ps1") return "powershell";
  return normalized;
}

function workspaceRendererNextContentIndex(lines: string[], start: number) {
  let index = start;
  while (index < lines.length && !String(lines[index] || "").trim()) index += 1;
  return index;
}

function workspaceRendererFencedCodeBlock(lines: string[], start: number) {
  const fence = String(lines[start] || "").trim().match(/^```([\w-]*)/);
  if (!fence) return null;
  const rawLang = fence[1] || "";
  const codeLines: string[] = [];
  let index = start + 1;
  while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
    codeLines.push(lines[index]);
    index += 1;
  }
  if (index < lines.length) index += 1;
  const normalizedLang = workspaceRendererNormalizeCodeLanguageLabel(rawLang);
  return {
    lang: normalizedLang || workspaceRendererInferCodeLanguage(codeLines),
    lines: codeLines,
    next: index
  };
}

function workspaceRendererDiffBlock(lines: string[], start: number) {
  if (!workspaceRendererShouldStartDiffBlock(lines, start)) return null;
  const diffLines: string[] = [];
  let index = start;
  let blankBudget = 1;
  let sawStructuredDiff = false;
  while (index < lines.length) {
    const value = lines[index].trim();
    if (!value) {
      const nextValue = lines[index + 1]?.trim() || "";
      const nextIsDiffMarked = workspaceRendererLineIsDiffHeader(nextValue)
        || workspaceRendererLineIsDiffHunk(nextValue)
        || workspaceRendererLineIsDiffLike(nextValue);
      if (blankBudget > 0 && workspaceRendererLineContinuesDiffBlock(nextValue, sawStructuredDiff) && (!sawStructuredDiff || nextIsDiffMarked)) {
        diffLines.push("");
        blankBudget -= 1;
        index += 1;
        continue;
      }
      break;
    }
    if (!workspaceRendererLineContinuesDiffBlock(lines[index], sawStructuredDiff)) break;
    if (workspaceRendererLineIsDiffHeader(value) || workspaceRendererLineIsDiffHunk(value) || workspaceRendererLineIsDiffLike(value)) {
      sawStructuredDiff = true;
    }
    diffLines.push(value);
    index += 1;
  }
  return diffLines.length ? { lines: diffLines, next: index } : null;
}

function WorkspaceRenderedMarkdown({ text }: { text: string }) {
  const lines = workspaceRendererRebuildFieldTableLines(
    workspaceRendererRebuildMarkdownTableLines(workspaceRendererNormalizeMarkdownTables(text).split("\n"))
  );
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }
    if (workspaceRendererLineIsMarkdownHr(trimmed)) {
      nodes.push(<hr key={`hr-${index}`} className="meowdesk-output-renderer-hr" data-r2-output-renderer-hr />);
      index += 1;
      continue;
    }
    const asciiTable = workspaceRendererAsciiTable(lines, index);
    if (asciiTable) {
      nodes.push(<WorkspaceRendererTableBlock key={`ascii-table-native-${index}`} tableKey={`ascii-table-native-${index}`} table={asciiTable} />);
      index = asciiTable.next;
      continue;
    }
    const looseAsciiTable = workspaceRendererLooseAsciiTable(lines, index);
    if (looseAsciiTable) {
      nodes.push(<WorkspaceRendererTableBlock key={`ascii-table-loose-${index}`} tableKey={`ascii-table-loose-${index}`} table={looseAsciiTable} />);
      index = looseAsciiTable.next;
      continue;
    }
    const asciiTableBlock = workspaceRendererAsciiTableBlock(lines, index);
    if (asciiTableBlock) {
      nodes.push(<WorkspaceRendererCodeBlock key={`ascii-table-${index}`} lang="table" code={asciiTableBlock.lines.join("\n")} />);
      index = asciiTableBlock.next;
      continue;
    }
    if (workspaceRendererLineIsTableBorder(trimmed) && !workspaceRendererLineIsMarkdownTableSeparator(trimmed)) {
      index += 1;
      continue;
    }
    const toolStatus = workspaceRendererToolStatusFromMarker(trimmed);
    if (toolStatus) {
      nodes.push(
        <WorkspaceRendererToolStatus
          key={`tool-${index}`}
          tone={toolStatus.tone}
          label={toolStatus.label}
          detail={toolStatus.detail}
        />
      );
      index += 1;
      continue;
    }
    const treeBlock = workspaceRendererTreeBlock(lines, index);
    if (treeBlock) {
      nodes.push(<WorkspaceRendererCodeBlock key={`tree-${index}`} lang="tree" code={treeBlock.lines.join("\n")} />);
      index = treeBlock.next;
      continue;
    }
    const shellBlock = workspaceRendererCodeBlock(lines, index);
    if (shellBlock?.lang === "shell") {
      nodes.push(<WorkspaceRendererCodeBlock key={`code-shell-${index}`} lang="shell" code={shellBlock.lines.join("\n")} />);
      index = shellBlock.next;
      continue;
    }
    const fence = trimmed.match(/^```([\w-]*)/);
    if (fence) {
      const fencedCode = workspaceRendererFencedCodeBlock(lines, index);
      if (!fencedCode) {
        index += 1;
        continue;
      }
      const lang = fencedCode.lang;
      nodes.push(workspaceRendererCodeOrMarkdownPreviewNode(`code-${index}`, lang, fencedCode.lines));
      index = fencedCode.next;
      continue;
    }
    const bareLanguage = workspaceRendererBareLanguageLabel(trimmed);
    if (bareLanguage) {
      const normalizedLang = workspaceRendererNormalizeCodeLanguageLabel(bareLanguage[1]);
      const contentIndex = workspaceRendererNextContentIndex(lines, index + 1);
      const fencedCode = workspaceRendererFencedCodeBlock(lines, contentIndex);
      if (fencedCode) {
        const fenceLang = workspaceRendererNormalizeCodeLanguageLabel(fencedCode.lang || normalizedLang);
        const renderLang = fenceLang === "text" ? normalizedLang : fenceLang;
        nodes.push(workspaceRendererCodeOrMarkdownPreviewNode(`code-labelled-fence-${index}`, renderLang, fencedCode.lines));
        index = fencedCode.next;
        continue;
      }
      if (/^(?:diff|patch|meowdiff)$/i.test(normalizedLang)) {
        const detectedDiff = workspaceRendererDiffBlock(lines, index + 1);
        if (detectedDiff) {
          nodes.push(<WorkspaceRendererDiffBlock key={`diff-labelled-${index}`} lines={detectedDiff.lines} title={normalizedLang} />);
          index = detectedDiff.next;
          continue;
        }
      }
      const detectedCode = workspaceRendererCodeBlock(lines, index + 1);
      const labelledCode = detectedCode || workspaceRendererLabelledCodeBlock(lines, index + 1, normalizedLang);
      if (labelledCode) {
        nodes.push(<WorkspaceRendererCodeBlock key={`code-labelled-${index}`} lang={normalizedLang} code={labelledCode.lines.join("\n")} />);
        index = labelledCode.next;
        continue;
      }
    }
    const sectionLanguage = workspaceRendererSectionLanguageLabel(trimmed);
    if (sectionLanguage) {
      const normalizedLang = workspaceRendererNormalizeCodeLanguageLabel(sectionLanguage[1]);
      const contentIndex = workspaceRendererNextContentIndex(lines, index + 1);
      const fencedCode = workspaceRendererFencedCodeBlock(lines, contentIndex);
      if (fencedCode) {
        const fenceLang = workspaceRendererNormalizeCodeLanguageLabel(fencedCode.lang || normalizedLang);
        const renderLang = fenceLang === "text" ? normalizedLang : fenceLang;
        nodes.push(workspaceRendererCodeOrMarkdownPreviewNode(`code-section-labelled-fence-${index}`, renderLang, fencedCode.lines));
        index = fencedCode.next;
        continue;
      }
      if (/^(?:diff|patch|meowdiff)$/i.test(normalizedLang)) {
        const detectedDiff = workspaceRendererDiffBlock(lines, index + 1);
        if (detectedDiff) {
          nodes.push(<WorkspaceRendererDiffBlock key={`diff-section-labelled-${index}`} lines={detectedDiff.lines} title={normalizedLang} />);
          index = detectedDiff.next;
          continue;
        }
      }
      const detectedCode = workspaceRendererCodeBlock(lines, index + 1);
      const labelledCode = detectedCode || workspaceRendererLabelledCodeBlock(lines, index + 1, normalizedLang);
      if (labelledCode) {
        nodes.push(<WorkspaceRendererCodeBlock key={`code-section-labelled-${index}`} lang={normalizedLang} code={labelledCode.lines.join("\n")} />);
        index = labelledCode.next;
        continue;
      }
    }
    const table = workspaceRendererTable(lines, index);
    if (table) {
      nodes.push(<WorkspaceRendererTableBlock key={`table-${index}`} tableKey={`table-${index}`} table={table} />);
      index = table.next;
      continue;
    }
    const detectedDiff = workspaceRendererDiffBlock(lines, index);
    if (detectedDiff) {
      nodes.push(<WorkspaceRendererDiffBlock key={`diff-${index}`} lines={detectedDiff.lines} />);
      index = detectedDiff.next;
      continue;
    }
    const detectedCode = workspaceRendererCodeBlock(lines, index);
    if (detectedCode) {
      nodes.push(<WorkspaceRendererCodeBlock key={`code-auto-${index}`} lang={detectedCode.lang} code={detectedCode.lines.join("\n")} />);
      index = detectedCode.next;
      continue;
    }
    const heading = workspaceRendererHeadingLevel(trimmed);
    if (heading) {
      const headingLanguage = workspaceRendererHeadingLanguageLabel(heading.text);
      if (headingLanguage) {
        const normalizedLang = workspaceRendererNormalizeCodeLanguageLabel(headingLanguage[1]);
        const contentIndex = workspaceRendererNextContentIndex(lines, index + 1);
        const fencedCode = workspaceRendererFencedCodeBlock(lines, contentIndex);
        if (fencedCode) {
          const fenceLang = workspaceRendererNormalizeCodeLanguageLabel(fencedCode.lang || normalizedLang);
          const renderLang = fenceLang === "text" ? normalizedLang : fenceLang;
          nodes.push(workspaceRendererCodeOrMarkdownPreviewNode(`code-heading-labelled-fence-${index}`, renderLang, fencedCode.lines));
          index = fencedCode.next;
          continue;
        }
        if (/^(?:diff|patch|meowdiff)$/i.test(normalizedLang)) {
          const detectedDiff = workspaceRendererDiffBlock(lines, index + 1);
          if (detectedDiff) {
            nodes.push(<WorkspaceRendererDiffBlock key={`diff-heading-labelled-${index}`} lines={detectedDiff.lines} title={normalizedLang} />);
            index = detectedDiff.next;
            continue;
          }
        }
        const detectedCode = workspaceRendererCodeBlock(lines, index + 1);
        const labelledCode = detectedCode || workspaceRendererLabelledCodeBlock(lines, index + 1, normalizedLang);
        if (labelledCode) {
          nodes.push(<WorkspaceRendererCodeBlock key={`code-heading-labelled-${index}`} lang={normalizedLang} code={labelledCode.lines.join("\n")} />);
          index = labelledCode.next;
          continue;
        }
      }
      nodes.push(
        <div key={`heading-${index}`} className={`meowdesk-output-renderer-heading level-${heading.level}`} data-r2-output-renderer-heading={heading.level}>
          {workspaceRendererInline(heading.text, `heading-${index}`)}
        </div>
      );
      index += 1;
      continue;
    }
    const implicitHeading = workspaceRendererImplicitHeading(lines, index);
    if (implicitHeading) {
      nodes.push(
        <div key={`heading-implicit-${index}`} className="meowdesk-output-renderer-heading level-inferred" data-r2-output-renderer-heading="inferred">
          {workspaceRendererInline(implicitHeading.text, `heading-implicit-${index}`)}
        </div>
      );
      index += 1;
      continue;
    }
    const callout = workspaceRendererCallout(trimmed);
    if (callout) {
      nodes.push(
        <div key={`callout-${index}`} className="meowdesk-output-renderer-callout" data-r2-output-renderer-callout={callout.label}>
          <strong>{callout.label}</strong>
          <span>{workspaceRendererInline(callout.text, `callout-${index}`)}</span>
        </div>
      );
      index += 1;
      continue;
    }
    if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const items: { text: string; checked: boolean }[] = [];
      while (index < lines.length && /^\s*[-*]\s+\[[ xX]\]\s+/.test(lines[index])) {
        const match = lines[index].match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
        if (match) items.push({ checked: match[1].toLowerCase() === "x", text: match[2] });
        index += 1;
      }
      nodes.push(
        <div key={`checks-${index}`} className="meowdesk-output-renderer-checks" data-r2-output-renderer-checks>
          {items.map((item, itemIndex) => (
            <div key={itemIndex} className="meowdesk-output-renderer-check">
              <span aria-hidden="true">{item.checked ? "✓" : ""}</span>
              <p>{workspaceRendererInline(item.text, `check-${index}-${itemIndex}`)}</p>
            </div>
          ))}
        </div>
      );
      continue;
    }
    if (/^\s*(?:[-*]|(?:\d+|[A-Za-z])\.)\s+/.test(line)) {
      const items: string[] = [];
      const orderedMatch = line.match(/^\s*(\d+|[A-Za-z])\.\s+/);
      const ordered = Boolean(orderedMatch);
      const orderedToken = orderedMatch?.[1] || "";
      const orderedType = /^[A-Za-z]$/.test(orderedToken) ? (orderedToken === orderedToken.toUpperCase() ? "A" : "a") : undefined;
      const orderedStart = /^\d+$/.test(orderedToken) ? Number(orderedToken) : undefined;
      const itemPattern = ordered ? /^\s*(?:\d+|[A-Za-z])\.\s+/ : /^\s*[-*]\s+/;
      while (index < lines.length && itemPattern.test(lines[index])) {
        items.push(lines[index].replace(itemPattern, ""));
        index += 1;
      }
      const ListTag = ordered ? "ol" : "ul";
      nodes.push(
        <ListTag
          key={`list-${index}`}
          className="meowdesk-output-renderer-list"
          data-r2-output-renderer-list={ordered ? "ordered" : "unordered"}
          {...(orderedStart ? { start: orderedStart } : {})}
          {...(orderedType ? { type: orderedType } : {})}
        >
          {items.map((item, itemIndex) => <li key={itemIndex}>{workspaceRendererInline(item, `li-${index}-${itemIndex}`)}</li>)}
        </ListTag>
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push(
        <blockquote key={`quote-${index}`} className="meowdesk-output-renderer-quote" data-r2-output-renderer-quote>
          <WorkspaceRenderedMarkdown text={quoteLines.join("\n")} />
        </blockquote>
      );
      continue;
    }
    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !workspaceRendererToolStatusFromMarker(lines[index].trim()) && !workspaceRendererLineIsMarkdownHr(lines[index].trim()) && !/^```/.test(lines[index].trim()) && !workspaceRendererBareLanguageLabel(lines[index]) && !workspaceRendererSectionLanguageLabel(lines[index]) && !workspaceRendererHeadingLevel(lines[index].trim()) && !workspaceRendererImplicitHeading(lines, index) && !workspaceRendererCallout(lines[index].trim()) && !workspaceRendererAsciiTableBlock(lines, index) && !workspaceRendererTreeBlock(lines, index) && !workspaceRendererCodeBlock(lines, index) && !/^\s*(?:[-*]|(?:\d+|[A-Za-z])\.)\s+/.test(lines[index]) && !/^>\s?/.test(lines[index]) && !workspaceRendererTable(lines, index) && !workspaceRendererShouldStartDiffBlock(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    nodes.push(
      <p key={`paragraph-${index}`} className="meowdesk-output-renderer-paragraph" data-r2-output-renderer-paragraph>
        {workspaceRendererInline(paragraph.join("\n"), `p-${index}`)}
      </p>
    );
  }

  return <>{nodes}</>;
}

export function WorkspaceRenderedConversation({
  segments,
  profile,
  statusItems,
  sourceStatus
}: {
  segments: WorkspaceRenderedSegment[];
  profile: WorkspaceRendererProfile;
  statusItems: WorkspaceRendererStatusItem[];
  sourceStatus: MeowViewerSourceStatus;
}) {
  const pendingAfterIndex = workspaceRendererPendingReplyIndex(segments, sourceStatus);
  const pendingDetail = pendingAfterIndex >= 0
    ? workspaceRendererPendingReplyDetail(segments, statusItems, sourceStatus)
    : "";
  const nodes: ReactNode[] = [];

  segments.forEach((segment, index) => {
    let node: ReactNode = null;
    if (segment.kind === "thinking") {
      node = null;
    } else if (segment.kind === "markdown") {
      node = (
        <section key={`markdown-${index}`} className="meowdesk-output-renderer-page" data-r2-output-renderer-page>
          <WorkspaceRendererCopyButton text={segment.text} label="复制内容" value="page" className="meowdesk-output-renderer-page-copy" />
          <WorkspaceRenderedMarkdown text={segment.text} />
        </section>
      );
    } else if (segment.kind === "startup") {
      const lines = segment.text.split("\n").map((item) => item.trim()).filter(Boolean);
      const title = lines.shift() || "CLI 已启动";
      node = (
        <section key={`startup-${index}`} className="meowdesk-output-renderer-startup" data-r2-output-renderer-startup={profile}>
          <strong>{title}</strong>
          {lines.length ? (
            <dl>
              {lines.map((item, itemIndex) => {
                const [label, ...rest] = item.split(" ");
                return (
                  <div key={itemIndex}>
                    <dt>{label}</dt>
                    <dd>{workspaceRendererInline(rest.join(" "), `startup-${index}-${itemIndex}`)}</dd>
                  </div>
                );
              })}
            </dl>
          ) : null}
        </section>
      );
    } else {
      const copyable = Boolean(segment.text.trim());
      const showAgentHeader = workspaceRendererSegmentIsAssistantReply(segment);
      const showFloatingCopy = copyable && segment.kind !== "assistant";
      node = (
        <article key={`${segment.kind}-${index}`} className={`meowdesk-output-renderer-message is-${segment.kind}`} data-r2-output-renderer-message={segment.kind}>
          {showFloatingCopy ? (
            <WorkspaceRendererCopyButton
              text={segment.text}
              label="复制消息"
              value="user-message"
              className="meowdesk-output-renderer-message-copy"
            />
          ) : null}
          {showAgentHeader ? <WorkspaceRendererMessageAgentHeader profile={profile} /> : null}
          <div className="meowdesk-output-renderer-message-body">
            <WorkspaceRenderedMarkdown text={segment.text} />
          </div>
          {copyable && segment.kind === "assistant" && showAgentHeader ? (
            <div className="meowdesk-output-renderer-message-footer">
              <WorkspaceRendererCopyButton
                text={segment.text}
                label="复制整段回复"
                value="assistant-message-bottom"
                className="meowdesk-output-renderer-message-copy-bottom"
              />
            </div>
          ) : null}
        </article>
      );
    }

    if (node) nodes.push(node);
    if (index === pendingAfterIndex) {
      nodes.push(
        <WorkspaceRendererPendingReply
          key={`pending-reply-${index}`}
          detail={pendingDetail}
          profile={profile}
          sourceStatus={sourceStatus}
        />
      );
    }
  });

  return (
    <div className="meowdesk-output-renderer-conversation" data-r2-output-renderer-conversation data-r2-output-renderer-conversation-profile={profile}>
      {nodes}
    </div>
  );
}

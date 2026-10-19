import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, FileText, FolderOpen } from "lucide-react";
import type { WorkbenchSummary } from "@/app/use-workbench-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { listObsidianFiles, pickObsidianVault, readObsidianFile, readObsidianVaultPath } from "@/lib/workbench-api";
import type { ObsidianNotePayload, ObsidianVaultFile, ObsidianVaultScanResult } from "@/lib/workbench-api";
import { cn } from "@/lib/utils";
import { RouteFrame, openExternalUrl } from "../readiness/readiness-shared";

function normalizeNoteName(value: string) {
  return value.trim().replace(/\\/g, "/").replace(/\.md$/i, "").toLowerCase();
}

type ObsidianNoteLookup = Map<string, ObsidianVaultFile>;

function addObsidianLookupEntry(lookup: ObsidianNoteLookup, key: string, file: ObsidianVaultFile) {
  const normalized = normalizeNoteName(key);
  if (normalized && !lookup.has(normalized)) lookup.set(normalized, file);
}

function buildObsidianNoteLookup(files: ObsidianVaultFile[]) {
  const lookup: ObsidianNoteLookup = new Map();
  for (const file of files) {
    addObsidianLookupEntry(lookup, file.title, file);
    addObsidianLookupEntry(lookup, file.name, file);
    addObsidianLookupEntry(lookup, file.relativePath, file);
    addObsidianLookupEntry(lookup, file.path, file);
  }
  return lookup;
}

function findNoteByWikiLink(noteLookup: ObsidianNoteLookup, link: string) {
  const target = normalizeNoteName(link.split("#")[0].split("|")[0] || "");
  if (!target) return undefined;
  return noteLookup.get(target);
}

function obsidianFolderLabel(file: ObsidianVaultFile) {
  const folder = String(file.folder || file.relativePath.split("/").slice(0, -1).join("/")).replace(/\\/g, "/");
  return folder.split("/").filter(Boolean)[0] || "根目录";
}

function obsidianFileSubpath(file: ObsidianVaultFile) {
  const group = obsidianFolderLabel(file);
  if (group === "根目录") return file.relativePath;
  return file.relativePath.replace(new RegExp(`^${group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?`), "") || file.name;
}

function groupObsidianFiles(files: ObsidianVaultFile[]) {
  const groups = new Map<string, ObsidianVaultFile[]>();
  for (const file of files) {
    const key = obsidianFolderLabel(file);
    groups.set(key, [...(groups.get(key) || []), file]);
  }
  return Array.from(groups.entries())
    .map(([folder, items]) => ({
      folder,
      files: [...items].sort((a, b) => a.relativePath.localeCompare(b.relativePath, "zh-Hans-CN"))
    }))
    .sort((a, b) => {
      if (a.folder === "根目录") return -1;
      if (b.folder === "根目录") return 1;
      return a.folder.localeCompare(b.folder, "zh-Hans-CN");
    });
}

function inlineMarkdown(text: string, noteLookup: ObsidianNoteLookup, onOpen: (path: string) => void) {
  const source = String(text || "");
  const pattern = /(\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\([^)]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*|#[\w\u4e00-\u9fff/-]+)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    if (match.index > cursor) nodes.push(<span key={`t-${cursor}`}>{source.slice(cursor, match.index)}</span>);
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith("[[")) {
      const raw = token.slice(2, -2);
      const label = raw.includes("|") ? raw.split("|").slice(1).join("|").trim() : raw;
      const file = findNoteByWikiLink(noteLookup, raw);
      nodes.push(file ? (
        <button
          key={key}
          type="button"
          className="meowdesk-obsidian-inline-link"
          data-r3-obsidian-wiki-link={file.path}
          onClick={() => onOpen(file.path)}
        >
          {label || file.title}
        </button>
      ) : (
        <span key={key} className="text-muted-foreground">[[{label}]]</span>
      ));
    } else if (token.startsWith("[") && token.includes("](")) {
      const label = token.slice(1, token.indexOf("]("));
      const href = token.slice(token.indexOf("](") + 2, -1);
      nodes.push(
        <button key={key} type="button" className="meowdesk-obsidian-inline-link" onClick={() => openExternalUrl(href)}>
          {label || href}
        </button>
      );
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key} className="meowdesk-obsidian-inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("#")) {
      nodes.push(<span key={key} className="meowdesk-obsidian-inline-tag">{token}</span>);
    }
    cursor = match.index + token.length;
  }
  if (cursor < source.length) nodes.push(<span key={`t-${cursor}`}>{source.slice(cursor)}</span>);
  return nodes.length ? nodes : source;
}

function renderMarkdownTable(lines: string[], key: string, noteLookup: ObsidianNoteLookup, onOpen: (path: string) => void) {
  const cleaned = lines
    .map((line) => line.trim())
    .filter((line) => /^\|.*\|$/.test(line))
    .map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()));
  const rows = cleaned.filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/.test(cell)));
  if (!rows.length) return null;
  const [head, ...body] = rows;
  return (
    <div key={key} className="meowdesk-obsidian-table-wrap">
      <table>
        <thead>
          <tr>{head.map((cell, index) => <th key={index}>{inlineMarkdown(cell, noteLookup, onOpen)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inlineMarkdown(cell, noteLookup, onOpen)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function markdownBlocks(raw: string, noteLookup: ObsidianNoteLookup, onOpen: (path: string) => void) {
  const lines = String(raw || "").replace(/^---[\s\S]*?---\s*/, "").split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let codeLines: string[] = [];
  let listItems: ReactNode[] = [];
  let orderedItems: ReactNode[] = [];
  let tableLines: string[] = [];
  let inCode = false;

  const flushCode = () => {
    if (!codeLines.length) return;
    blocks.push(
      <pre key={`code-${blocks.length}`} className="meowdesk-obsidian-code-block">
        <code>{codeLines.join("\n")}</code>
      </pre>
    );
    codeLines = [];
  };
  const flushLists = () => {
    if (listItems.length) {
      blocks.push(<ul key={`ul-${blocks.length}`} className="meowdesk-obsidian-list">{listItems}</ul>);
      listItems = [];
    }
    if (orderedItems.length) {
      blocks.push(<ol key={`ol-${blocks.length}`} className="meowdesk-obsidian-list list-decimal">{orderedItems}</ol>);
      orderedItems = [];
    }
  };
  const flushTable = () => {
    if (!tableLines.length) return;
    const table = renderMarkdownTable(tableLines, `table-${blocks.length}`, noteLookup, onOpen);
    if (table) blocks.push(table);
    tableLines = [];
  };
  const flushAll = () => {
    flushTable();
    flushLists();
  };

  lines.forEach((line, index) => {
    if (/^```/.test(line.trim())) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }
    if (!line.trim()) {
      flushAll();
      return;
    }
    if (/^\|.*\|$/.test(line.trim())) {
      flushLists();
      tableLines.push(line);
      return;
    }
    flushTable();
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushLists();
      const level = Math.min(heading[1].length, 4);
      const className = level === 1 ? "meowdesk-obsidian-h1" : level === 2 ? "meowdesk-obsidian-h2" : "meowdesk-obsidian-h3";
      blocks.push(<h2 key={`h-${index}`} className={className}>{inlineMarkdown(heading[2], noteLookup, onOpen)}</h2>);
      return;
    }
    const bullet = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/.exec(line) || /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      const checked = bullet.length > 2 && /x/i.test(bullet[1]);
      const content = bullet.length > 2 ? bullet[2] : bullet[1];
      listItems.push(
        <li key={`li-${index}`} className={cn(checked && "is-checked")}>
          {bullet.length > 2 ? <span className="meowdesk-obsidian-checkbox" data-checked={checked ? "true" : "false"} /> : null}
          <span>{inlineMarkdown(content, noteLookup, onOpen)}</span>
        </li>
      );
      return;
    }
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      orderedItems.push(<li key={`oli-${index}`}>{inlineMarkdown(ordered[1], noteLookup, onOpen)}</li>);
      return;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushLists();
      blocks.push(<blockquote key={`q-${index}`} className="meowdesk-obsidian-quote">{inlineMarkdown(quote[1], noteLookup, onOpen)}</blockquote>);
      return;
    }
    const hr = /^\s*---+\s*$/.test(line);
    if (hr) {
      flushLists();
      blocks.push(<hr key={`hr-${index}`} className="meowdesk-obsidian-hr" />);
      return;
    }
    flushLists();
    blocks.push(<p key={`p-${index}`} className="meowdesk-obsidian-paragraph">{inlineMarkdown(line, noteLookup, onOpen)}</p>);
  });
  if (inCode) flushCode();
  flushAll();
  return blocks.length ? blocks : [<p key="empty" className="text-muted-foreground">这篇笔记没有可显示正文。</p>];
}

function filterObsidianFiles(files: ObsidianVaultFile[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return files;
  return files.filter((file) => [
    file.name,
    file.title,
    file.relativePath,
    file.excerpt || "",
    ...(file.tags || [])
  ].join(" ").toLowerCase().includes(normalized));
}

export function ObsidianRoute({ summary }: { summary: WorkbenchSummary }) {
  const [vaultPath, setVaultPath] = useState(summary.obsidianVaultPath || "");
  const [vault, setVault] = useState<ObsidianVaultScanResult | null>(null);
  const [query, setQuery] = useState("");
  const [activePath, setActivePath] = useState("");
  const [note, setNote] = useState<ObsidianNotePayload | null>(null);
  const [status, setStatus] = useState("准备读取本地 vault。");
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const files = vault?.files || [];
  const noteLookup = useMemo(() => buildObsidianNoteLookup(files), [files]);
  const visibleFiles = useMemo(() => filterObsidianFiles(files, query), [files, query]);
  const visibleFileGroups = useMemo(() => groupObsidianFiles(visibleFiles), [visibleFiles]);
  const hasActiveQuery = Boolean(query.trim());
  const activeFile = useMemo(() => activePath ? files.find((file) => file.path === activePath) : undefined, [activePath, files]);

  const applyVault = useCallback((nextVault: ObsidianVaultScanResult) => {
    setVault(nextVault);
    setVaultPath(nextVault.path);
    setStatus(`已读取 ${nextVault.files.length} 篇笔记。`);
    setActivePath((current) => {
      if (current && nextVault.files.some((file) => file.path === current)) return current;
      return nextVault.files[0]?.path || "";
    });
  }, []);

  const refreshVault = useCallback(async () => {
    const targetPath = vaultPath || summary.obsidianVaultPath || await readObsidianVaultPath().catch(() => "");
    if (!targetPath) {
      setStatus("尚未选择 vault。");
      return;
    }
    setLoading(true);
    setStatus("正在刷新 vault...");
    try {
      applyVault(await listObsidianFiles(targetPath));
    } catch (error) {
      setStatus(`vault 读取失败：${error instanceof Error ? error.message : String(error)}`);
      setVault(null);
    } finally {
      setLoading(false);
    }
  }, [applyVault, summary.obsidianVaultPath, vaultPath]);

  const chooseVault = useCallback(async () => {
    setLoading(true);
    setStatus("正在选择 vault...");
    try {
      const nextVault = await pickObsidianVault();
      if (!nextVault) {
        setStatus("已取消选择。");
        return;
      }
      applyVault(nextVault);
    } catch (error) {
      setStatus(`选择失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [applyVault]);

  const openNote = useCallback((path: string) => {
    setActivePath(path);
  }, []);

  const toggleFolder = useCallback((folder: string) => {
    setExpandedFolders((current) => ({
      ...current,
      [folder]: !current[folder]
    }));
  }, []);

  const openCurrentInObsidian = useCallback(() => {
    if (!activeFile) return;
    openExternalUrl(`obsidian://open?path=${encodeURIComponent(activeFile.path)}`);
  }, [activeFile]);

  const markdownContent = useMemo(() => {
    return activeFile && note ? markdownBlocks(note.raw, noteLookup, openNote) : null;
  }, [activeFile, note, noteLookup, openNote]);

  useEffect(() => {
    let cancelled = false;
    async function hydrateVault() {
      const savedPath = summary.obsidianVaultPath || await readObsidianVaultPath().catch(() => "");
      if (cancelled || !savedPath) return;
      setVaultPath(savedPath);
      setLoading(true);
      try {
        const nextVault = await listObsidianFiles(savedPath);
        if (!cancelled) applyVault(nextVault);
      } catch (error) {
        if (!cancelled) setStatus(`vault 读取失败：${error instanceof Error ? error.message : String(error)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrateVault();
    return () => {
      cancelled = true;
    };
  }, [applyVault, summary.obsidianVaultPath]);

  useEffect(() => {
    let cancelled = false;
    async function loadNote() {
      if (!activePath) {
        setNote(null);
        return;
      }
      setLoading(true);
      setStatus("正在读取笔记...");
      try {
        const payload = await readObsidianFile(activePath);
        if (!cancelled) {
          setNote(payload);
          setStatus(payload.truncated ? "笔记已读取，因文件较大已截断显示。" : "笔记已读取。");
        }
      } catch (error) {
        if (!cancelled) {
          setNote(null);
          setStatus(`笔记读取失败：${error instanceof Error ? error.message : String(error)}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadNote();
    return () => {
      cancelled = true;
    };
  }, [activePath]);

  useEffect(() => {
    window.addEventListener("meowdesk:obsidian-pick-vault", chooseVault);
    window.addEventListener("meowdesk:obsidian-refresh", refreshVault);
    window.addEventListener("meowdesk:obsidian-open-current", openCurrentInObsidian);
    return () => {
      window.removeEventListener("meowdesk:obsidian-pick-vault", chooseVault);
      window.removeEventListener("meowdesk:obsidian-refresh", refreshVault);
      window.removeEventListener("meowdesk:obsidian-open-current", openCurrentInObsidian);
    };
  }, [chooseVault, openCurrentInObsidian, refreshVault]);

  return (
    <RouteFrame
      id="obsidian"
      eyebrow="Obsidian"
      title="Obsidian"
      copy="恢复本地 vault 阅读器入口：文件分类和正文阅读保持旧 Meowdesk 表达。"
      badge="local reader"
      compact
    >
      <div className="meowdesk-obsidian-route grid h-full min-h-0 gap-3 overflow-hidden min-[1120px]:grid-cols-[300px_minmax(0,1fr)]" data-r2-obsidian-route data-r3-obsidian-route>
        <Panel className="meowdesk-obsidian-panel grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden">
          <PanelHeader className="meowdesk-obsidian-library-head">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <FolderOpen size={15} aria-hidden="true" />
                <span className="truncate">文档分类</span>
              </div>
              <div className="max-w-48 truncate text-xs text-muted-foreground" data-r3-obsidian-vault-path>{vaultPath || "未选择 vault"}</div>
            </div>
            <span className="meowdesk-obsidian-count-badge">{visibleFileGroups.length} 类</span>
          </PanelHeader>
          <div className="border-b border-border px-3 py-2">
            <Input
              placeholder="搜索笔记"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              data-r2-obsidian-search
              data-r3-obsidian-search
            />
          </div>
          <PanelBody className="min-h-0 overflow-y-auto overflow-x-hidden p-3">
            <div className="grid gap-3 text-xs" data-r2-obsidian-tree>
              {visibleFileGroups.length ? visibleFileGroups.map((group) => {
                const folderExpanded = hasActiveQuery || Boolean(expandedFolders[group.folder]);
                const folderCollapsed = !folderExpanded;
                return (
                <section key={group.folder} className="meowdesk-obsidian-folder-group" data-r3-obsidian-folder={group.folder} data-r3-obsidian-folder-collapsed={folderCollapsed ? "true" : "false"}>
                  <button
                    type="button"
                    className="meowdesk-obsidian-folder-head"
                    aria-expanded={!folderCollapsed}
                    data-r3-obsidian-folder-toggle={group.folder}
                    onClick={() => toggleFolder(group.folder)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ChevronRight size={13} className={cn("meowdesk-obsidian-folder-chevron", !folderCollapsed && "is-open")} aria-hidden="true" />
                      <FolderOpen size={13} aria-hidden="true" />
                      <strong className="truncate">{group.folder}</strong>
                    </span>
                    <span>{group.files.length} 篇</span>
                  </button>
                  <div className="meowdesk-obsidian-file-list" data-r3-obsidian-file-list-collapsed={folderCollapsed ? "true" : "false"}>
                    {folderExpanded ? (
                    <div className="meowdesk-obsidian-file-list-inner">
                      {group.files.map((file) => (
                        <button
                          key={file.path}
                          type="button"
                          className={cn("meowdesk-obsidian-file-row", activePath === file.path && "is-active")}
                          data-r3-obsidian-file={file.relativePath}
                          data-r3-obsidian-file-active={activePath === file.path ? "true" : undefined}
                          onClick={() => openNote(file.path)}
                        >
                          <FileText size={13} aria-hidden="true" />
                          <span className="min-w-0">
                            <strong className="block truncate text-foreground">{file.title}</strong>
                            <span className="block truncate text-muted-foreground">{obsidianFileSubpath(file)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    ) : null}
                  </div>
                </section>
                );
              }) : (
                <div className="rounded-md border border-dashed border-border px-3 py-10 text-center text-xs text-muted-foreground">
                  {vaultPath ? "没有匹配的 markdown 笔记。" : "选择 Obsidian vault 后显示文件树。"}
                </div>
              )}
            </div>
          </PanelBody>
        </Panel>

        <Panel className="meowdesk-obsidian-panel meowdesk-obsidian-note-panel grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <PanelHeader>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{activeFile?.title || "未打开笔记"}</div>
              <div className="text-xs text-muted-foreground">{status}</div>
            </div>
          </PanelHeader>
          <PanelBody className="meowdesk-obsidian-note-body min-h-0 overflow-y-auto overflow-x-hidden p-4">
            <div className="grid min-w-0 gap-3 text-sm" data-r2-obsidian-note data-r3-obsidian-note={activeFile?.relativePath || ""}>
              {activeFile && note ? (
                <>
                  <header className="meowdesk-obsidian-note-header">
                    <p className="break-all text-xs text-muted-foreground">{activeFile.relativePath}</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">{activeFile.title}</h2>
                    {activeFile.tags?.length ? (
                      <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                        {activeFile.tags.slice(0, 8).map((tag) => (
                          <span key={tag} className="meowdesk-obsidian-inline-tag">#{tag.replace(/^#/, "")}</span>
                        ))}
                      </div>
                    ) : null}
                  </header>
                  <section className="meowdesk-obsidian-markdown-surface" data-r3-obsidian-markdown>
                    {markdownContent}
                  </section>
                  {note.truncated ? <p className="rounded-md border border-warning/35 bg-warning/10 p-2 text-xs text-warning">文件较大，当前只显示前半部分内容。</p> : null}
                </>
              ) : (
                <div className="grid min-h-60 place-items-center rounded-md border border-dashed border-border text-center text-xs leading-5 text-muted-foreground">
                  <div className="grid gap-3">
                    <span>{vaultPath ? "选择左侧笔记后显示正文、双链和标签。" : "尚未配置本地 vault。"}</span>
                    {!vaultPath ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => openExternalUrl("https://obsidian.md/download")}>
                        下载 Obsidian
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </PanelBody>
        </Panel>

      </div>
    </RouteFrame>
  );
}

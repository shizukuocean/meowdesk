import { useEffect, useMemo, useState } from "react";
import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import type { WorkbenchConversationMessage, WorkbenchConversationSummary, WorkbenchSummary } from "@/app/use-workbench-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import type { RuntimeSurfaceAttachmentSnapshot } from "@/features/open-surface/open-surface-runtime-attachments";
import { deleteConversationMirror } from "@/lib/workbench-api";
import { cn } from "@/lib/utils";
import { AccessAgentIcon, DetailTile, RouteFrame, openWorkbenchPath } from "../readiness/readiness-shared";
import { createConversationRecoveryDescriptor, type ConversationRecoveryTargetRoute } from "./conversation-recovery-contract";

function formatTimestamp(value?: number) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatFileSize(value?: number) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${Math.round(size)} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function conversationRoleLabel(role?: string) {
  const normalized = String(role || "").toLowerCase();
  if (["user", "human"].includes(normalized)) return "我";
  if (["assistant", "agent", "ai"].includes(normalized)) return "Agent";
  if (normalized === "system") return "System";
  return role || "Message";
}

function ConversationMessage({ message }: { message: WorkbenchConversationMessage }) {
  return (
    <div className="grid min-w-0 gap-1 overflow-hidden rounded-md border border-border bg-background/55 p-2.5 text-xs" data-r3-conversation-message={message.id}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Badge className="shrink-0" variant={message.role === "user" ? "primary" : "default"}>{conversationRoleLabel(message.role)}</Badge>
        <span className="min-w-0 truncate text-muted-foreground">{formatTimestamp(message.createdAt)}</span>
      </div>
      <p className="min-w-0 whitespace-pre-wrap break-words leading-5 text-foreground/90">{message.content}</p>
    </div>
  );
}

export function ConversationsRoute({
  summary,
  runtimeSurfaceAttachments,
  onRouteChange
}: {
  summary: WorkbenchSummary;
  runtimeSurfaceAttachments?: RuntimeSurfaceAttachmentSnapshot;
  onRouteChange?: (route: ConversationRecoveryTargetRoute) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("读取本地会话。");
  const conversations = summary.conversations;
  const groups = Array.from(new Set(conversations.map((item) => item.agent))).filter(Boolean).slice(0, 8);
  const filtered = selectedAgent === "all" ? conversations : conversations.filter((item) => item.agent === selectedAgent);
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || conversations[0];
  const liveRouteAttachments = useMemo(() => {
    return (runtimeSurfaceAttachments?.routeAttachments || [])
      .filter((attachment) => attachment.reattachableRuntimeCount > 0 && (attachment.routeId === "workspace" || attachment.routeId === "studio"));
  }, [runtimeSurfaceAttachments]);
  const selectedRecovery = useMemo(() => createConversationRecoveryDescriptor({
    conversation: selected,
    runtimeSurfaceAttachments
  }), [runtimeSurfaceAttachments, selected]);

  useEffect(() => {
    if (!selected && selectedId) setSelectedId("");
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    const refresh = () => {
      setStatus("正在刷新本地会话...");
      summary.refresh();
      window.setTimeout(() => setStatus("会话已刷新。"), 650);
    };
    window.addEventListener("meowdesk:conversations-refresh", refresh);
    return () => window.removeEventListener("meowdesk:conversations-refresh", refresh);
  }, [summary]);

  async function deleteSelectedConversation() {
    if (!selected) return;
    setStatus("正在删除本地镜像...");
    try {
      const result = await deleteConversationMirror({ conversationId: selected.id, path: selected.path });
      if (!result.ok) throw new Error(result.error || "删除失败。");
      setStatus("本地会话镜像已删除。");
      summary.refresh();
    } catch (error) {
      setStatus(`删除失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <RouteFrame
      id="conversations"
      eyebrow="Conversation"
      title="对话管理"
      copy="按 Agent 分组管理本地会话、工作窗镜像和导入历史，恢复旧 Meowdesk 的会话管理入口。"
      badge="local history"
      compact
    >
      <div className="grid h-full min-h-0 min-w-0 gap-3 overflow-x-hidden overflow-y-hidden min-[1080px]:grid-cols-[300px_minmax(0,1fr)]" data-r2-conversations-route data-r3-conversations-route>
        <Panel className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden">
          <PanelHeader>
            <div className="min-w-0">
              <div className="text-sm font-semibold">会话分组</div>
              <div className="text-xs text-muted-foreground">{summary.conversationCount ?? conversations.length} 条 · {summary.conversationHistoryMode || "light"}</div>
            </div>
            <Button variant="outline" size="sm" onClick={summary.refresh} data-r3-conversations-refresh>
              <RefreshCw size={14} aria-hidden="true" />
              刷新
            </Button>
          </PanelHeader>
          <div className="flex min-w-0 shrink-0 flex-wrap gap-2 overflow-x-hidden border-b border-border px-3 py-2" data-r2-conversation-agent-tabs>
            <button
              type="button"
              className={cn("rounded-md border border-border px-2 py-1 text-xs text-muted-foreground", selectedAgent === "all" && "border-primary/45 bg-primary/10 text-primary")}
              data-r3-conversation-agent-tab="all"
              data-r3-conversation-agent-active={selectedAgent === "all" ? "true" : undefined}
              onClick={() => setSelectedAgent("all")}
            >
              全部 {summary.conversationCount ?? conversations.length}
            </button>
            {groups.map((group) => (
              <button
                key={group}
                type="button"
                className={cn("inline-flex max-w-full items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground", selectedAgent === group && "border-primary/45 bg-primary/10 text-primary")}
                data-r3-conversation-agent-tab={group}
                data-r3-conversation-agent-active={selectedAgent === group ? "true" : undefined}
                onClick={() => setSelectedAgent(group)}
              >
                <AccessAgentIcon name={group} kind={group} size="sm" />
                <span className="min-w-0 truncate">{group}</span>
              </button>
            ))}
          </div>
          <PanelBody className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto p-3">
            <div className="grid min-w-0 gap-2" data-r2-conversation-list>
              {filtered.length ? filtered.map((item) => (
                <ConversationListItem key={item.id} item={item} active={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} />
              )) : (
                <div className="rounded-md border border-dashed border-border px-3 py-10 text-center text-xs text-muted-foreground">
                  Agent 写入 conversations 目录后会自动出现在这里。
                </div>
              )}
            </div>
          </PanelBody>
        </Panel>

        <Panel className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <PanelHeader className="min-w-0">
            <div className="min-w-0">
              <div className="text-sm font-semibold">会话详情</div>
              <div className="truncate text-xs text-muted-foreground">{selected?.source || "本地镜像"} · {status}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" disabled={!summary.conversationsDir} onClick={() => openWorkbenchPath(summary.conversationsDir)} data-r3-conversations-open-dir>
                <FolderOpen size={14} aria-hidden="true" />
                目录
              </Button>
              <Button variant="outline" size="sm" disabled={!selected?.path} onClick={deleteSelectedConversation} data-r3-conversation-delete>
                <Trash2 size={14} aria-hidden="true" />
                删除镜像
              </Button>
            </div>
          </PanelHeader>
          <PanelBody className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto p-3">
            {selected ? (
              <article className="grid min-w-0 gap-3 overflow-hidden rounded-md border border-border bg-background/55 p-3 text-xs" data-r2-conversation-detail={selected.id}>
                <div className="flex min-w-0 items-center gap-2">
                  <AccessAgentIcon name={selected.agent} kind={selected.agent} />
                  <h2 className="min-w-0 truncate text-base font-semibold">{selected.title}</h2>
                </div>
                <div className="grid min-w-0 gap-2 min-[760px]:grid-cols-3">
                  <DetailTile label="Agent" value={selected.agent} />
                  <DetailTile label="消息" value={`${selected.messageCount || 0}`} />
                  <DetailTile label="来源" value={selected.source || "conversation mirror"} />
                </div>
                <div className="grid min-w-0 gap-2 min-[760px]:grid-cols-3">
                  <DetailTile label="状态" value={selected.status || "active"} />
                  <DetailTile label="修改" value={formatTimestamp(selected.modifiedAt)} />
                  <DetailTile label="大小" value={formatFileSize(selected.size)} />
                </div>
                <div
                  className="grid min-w-0 gap-2 rounded-md border border-border bg-surface/60 p-3"
                  data-conversation-recovery={selected.id}
                  data-conversation-recovery-owner={selectedRecovery.owner}
                  data-conversation-recovery-mode={selectedRecovery.mode}
                  data-conversation-recovery-live-runtimes={selectedRecovery.liveRuntimeCount}
                  data-conversation-recovery-reattachable={selectedRecovery.reattachableRuntimeCount}
                >
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">会话接回</div>
                    <Badge variant={selectedRecovery.mode === "live-runtime" ? "success" : "default"}>
                      {selectedRecovery.mode === "live-runtime" ? "live runtime" : "preview only"}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {selectedRecovery.coldPreviewOnly
                      ? "当前只预览本地镜像；冷会话恢复和历史注入后续再接。"
                      : "检测到同 conversationId 的运行中 Agent，可回到对应页面继续看。"}
                  </div>
                  {liveRouteAttachments.length ? (
                    <div className="flex flex-wrap gap-2" data-conversation-live-runtime-routes>
                      {liveRouteAttachments.map((attachment) => (
                        <Button
                          key={attachment.routeId}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!onRouteChange}
                          data-conversation-live-reattach-route={attachment.routeId}
                          data-conversation-live-reattach-runtime-count={attachment.reattachableRuntimeCount}
                          onClick={() => onRouteChange?.(attachment.routeId as ConversationRecoveryTargetRoute)}
                        >
                          接回{attachment.title}
                          <Badge variant="success">{attachment.reattachableRuntimeCount}</Badge>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 whitespace-pre-wrap break-words rounded-md border border-border bg-surface/60 p-3 leading-5 text-muted-foreground">
                  {selected.preview || "暂无消息预览。"}
                </div>
                <div className="grid min-w-0 gap-2" data-r3-conversation-messages={selected.id}>
                  {selected.messages.length ? selected.messages.slice(-18).map((message) => (
                    <ConversationMessage key={message.id} message={message} />
                  )) : (
                    <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                      这条会话只有摘要，暂未带完整 messages。
                    </div>
                  )}
                </div>
              </article>
            ) : (
              <div className="grid h-full min-h-60 place-items-center rounded-md border border-dashed border-border text-center text-xs text-muted-foreground">
                选择左侧会话后查看详情。
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    </RouteFrame>
  );
}

function ConversationListItem({ item, active, onSelect }: { item: WorkbenchConversationSummary; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={cn("grid w-full min-w-0 gap-1 overflow-hidden rounded-md border border-border bg-background/55 px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent", active && "border-primary/45 bg-primary/10")}
      data-r2-conversation-item={item.id}
      data-r3-conversation-active={active ? "true" : undefined}
      onClick={onSelect}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <AccessAgentIcon name={item.agent} kind={item.agent} size="sm" />
          <strong className="min-w-0 truncate text-sm text-foreground">{item.title}</strong>
        </span>
        <Badge className="max-w-[96px] shrink-0 truncate">{item.agent}</Badge>
      </span>
      <span className="line-clamp-2 min-w-0 break-words leading-4 text-muted-foreground">{item.preview || item.source || "暂无预览"}</span>
      <span className="flex min-w-0 items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="shrink-0">{item.messageCount || 0} messages</span>
        <span className="min-w-0 truncate">{formatTimestamp(item.modifiedAt)}</span>
      </span>
    </button>
  );
}

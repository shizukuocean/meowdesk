import { useEffect, useState } from "react";
import { Monitor, Play, RefreshCw, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardActionMenu } from "@/components/ui/card-action-menu";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { optionalWorkbenchApi } from "@/lib/workbench-api";
import { cn } from "@/lib/utils";
import { AccessAgentIcon, DetailTile } from "./readiness-shared";

export type AccessTool = {
  id: string;
  name: string;
  kind?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  commandLine?: string;
};

type AccessAgentDraft = {
  id: string;
  name: string;
  kind: string;
  command: string;
  argsText: string;
  cwd: string;
};

function normalizeAccessToolPreset(value: unknown, index: number): AccessTool | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = String(record.id || record.name || `agent-${index + 1}`).trim();
  const name = String(record.name || id).trim();
  const command = String(record.command || "").trim();
  if (!id || !name) return null;
  const args = Array.isArray(record.args) ? record.args.map(String).filter(Boolean) : [];
  const kind = String(record.toolKind || record.kind || record.type || id).trim();
  const cwd = String(record.cwd || ".").trim() || ".";
  return {
    id,
    name,
    kind,
    command,
    args,
    cwd,
    commandLine: [command, ...args].filter(Boolean).join(" ")
  };
}

function agentDraftFromTool(tool: AccessTool): AccessAgentDraft {
  return {
    id: tool.id || "",
    name: tool.name || "",
    kind: tool.kind || "other",
    command: tool.command || "",
    argsText: (tool.args || []).join("\n"),
    cwd: tool.cwd || "."
  };
}

function agentDraftArgs(draft: AccessAgentDraft) {
  return draft.argsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function agentDraftPayload(draft: AccessAgentDraft) {
  const args = agentDraftArgs(draft);
  return {
    id: draft.id,
    name: draft.name,
    toolKind: draft.kind,
    command: draft.command,
    args,
    cwd: draft.cwd || "."
  };
}

function agentDraftTestSignature(draft: AccessAgentDraft) {
  return JSON.stringify({
    command: draft.command.trim(),
    args: agentDraftArgs(draft),
    cwd: (draft.cwd || ".").trim() || "."
  });
}

function accessToolIsTerminal(tool: AccessTool) {
  const normalized = `${tool.kind || ""} ${tool.id || ""} ${tool.name || ""} ${tool.command || ""}`.toLowerCase();
  return normalized.includes("terminal") || normalized.includes("powershell") || normalized.includes("shell");
}

function openStudio() {
  window.history.replaceState(null, "", "#studio");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function openWorkspace() {
  window.history.replaceState(null, "", "#workspace");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function WorkspaceSettingsPanel({ tools, onChanged }: { tools: AccessTool[]; onChanged: () => void }) {
  const agentTools = tools.filter((tool) => !accessToolIsTerminal(tool));
  const advancedTools = tools.filter(accessToolIsTerminal);
  const [presets, setPresets] = useState<AccessTool[]>([]);
  const agentPresets = presets.filter((tool) => !accessToolIsTerminal(tool));
  const customPreset = presets.find((tool) => tool.id === "custom");
  const defaultDraft = agentDraftFromTool(agentPresets[0] || customPreset || {
    id: "custom-agent",
    name: "自定义 Agent",
    kind: "other",
    command: "",
    args: [],
    cwd: "."
  });
  const [draft, setDraft] = useState<AccessAgentDraft>(defaultDraft);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [testingToolId, setTestingToolId] = useState("");
  const [toolTestResults, setToolTestResults] = useState<Record<string, string>>({});
  const [draftTestResult, setDraftTestResult] = useState<{ signature: string; ok: boolean }>({ signature: "", ok: false });
  const [connectionStatus, setConnectionStatus] = useState("选择一个 Agent 类型，测试通过后保存为本机 Agent 入口。");
  const [savedAgentReady, setSavedAgentReady] = useState(false);
  const draftSignature = agentDraftTestSignature(draft);
  const draftTestPassed = draftTestResult.ok && draftTestResult.signature === draftSignature;
  const canOpenAgentSurfaces = savedAgentReady || agentTools.length > 0;

  useEffect(() => {
    let cancelled = false;
    async function loadPresets() {
      const api = optionalWorkbenchApi();
      if (!api) return;
      try {
        const result = await api.getAgentPresets();
        const nextPresets = Array.isArray(result)
          ? result.map(normalizeAccessToolPreset).filter((item): item is AccessTool => Boolean(item))
          : [];
        if (cancelled) return;
        setPresets(nextPresets);
        const firstAgent = nextPresets.find((tool) => !accessToolIsTerminal(tool)) || nextPresets.find((tool) => tool.id === "custom");
        if (firstAgent) {
          setSelectedPresetId(firstAgent.id);
          setDraft(agentDraftFromTool(firstAgent));
        }
      } catch (error) {
        if (!cancelled) setConnectionStatus(`读取 Agent 模板失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    loadPresets();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateDraft = (patch: Partial<AccessAgentDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const selectPreset = (preset: AccessTool) => {
    setSelectedPresetId(preset.id);
    setDraft(agentDraftFromTool(preset));
    setDraftTestResult({ signature: "", ok: false });
    setConnectionStatus(`${preset.name} 模板已载入，请测试本机命令是否可用。`);
  };

  const testDraft = async () => {
    const api = optionalWorkbenchApi();
    if (!api) return;
    setTestingToolId("draft");
    setConnectionStatus("正在测试 Agent 启动命令...");
    try {
      const result = await api.testToolCommand({
        command: draft.command,
        args: agentDraftArgs(draft),
        cwd: draft.cwd || "."
      });
      const record = result && typeof result === "object" ? result as Record<string, unknown> : {};
      const ok = record.ok === true;
      const message = typeof record.message === "string" ? record.message : (ok ? "命令可运行。" : "命令不可用。");
      setDraftTestResult({ signature: agentDraftTestSignature(draft), ok });
      setConnectionStatus(ok ? `测试通过：${message}` : `测试未通过：${message}`);
    } catch (error) {
      setDraftTestResult({ signature: agentDraftTestSignature(draft), ok: false });
      setConnectionStatus(`测试失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTestingToolId("");
    }
  };

  const saveDraft = async () => {
    const api = optionalWorkbenchApi();
    if (!api) return;
    if (!draftTestPassed) {
      setConnectionStatus("请先测试当前 Agent 启动命令，测试通过后再保存。");
      return;
    }
    setTestingToolId("save");
    setConnectionStatus("正在保存 Agent 入口...");
    try {
      await api.addUserTool(agentDraftPayload(draft));
      setConnectionStatus(`${draft.name || "Agent"} 已接入 Meowdesk。现在可以去工作区少切窗使用，或去工坊制作 Meowdesk 作品。`);
      setSavedAgentReady(true);
      onChanged();
    } catch (error) {
      setConnectionStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTestingToolId("");
    }
  };

  const deleteTool = async (tool: AccessTool) => {
    const api = optionalWorkbenchApi();
    if (!api) return;
    setTestingToolId(`delete-${tool.id}`);
    setConnectionStatus(`正在删除 ${tool.name}...`);
    try {
      await api.deleteUserTool(tool.id);
      setConnectionStatus(agentTools.length <= 1
        ? `${tool.name} 已从 Meowdesk 移除。可以重新选择模板测试；桌面端 Agent 暂从工坊外部接力。`
        : `${tool.name} 已从 Meowdesk 移除。`);
      if (agentTools.length <= 1) setSavedAgentReady(false);
      onChanged();
    } catch (error) {
      setConnectionStatus(`删除失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTestingToolId("");
    }
  };

  const testAccessTool = async (tool: AccessTool) => {
    const api = optionalWorkbenchApi();
    if (!api) return;
    setTestingToolId(tool.id);
    setToolTestResults((current) => ({ ...current, [tool.id]: "测试中..." }));
    try {
      const result = await api.testToolCommand({
        command: tool.command || "",
        args: "args" in tool && Array.isArray(tool.args) ? tool.args : [],
        cwd: "cwd" in tool && tool.cwd ? tool.cwd : "."
      });
      const record = result && typeof result === "object" ? result as Record<string, unknown> : {};
      const ok = record.ok === true;
      const message = typeof record.message === "string" ? record.message : (ok ? "命令可运行。" : "命令不可用。");
      setToolTestResults((current) => ({ ...current, [tool.id]: message }));
    } catch (error) {
      setToolTestResults((current) => ({
        ...current,
        [tool.id]: error instanceof Error ? error.message : String(error)
      }));
    } finally {
      setTestingToolId("");
    }
  };

  return (
    <Panel className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" data-r2-access-section="workspace">
      <PanelHeader>
        <div>
          <div className="text-sm font-semibold">Agent 中心</div>
          <div className="text-xs text-muted-foreground">接入本机 Agent 启动入口；Meowdesk 只保存和启动用户确认的命令。</div>
        </div>
        <Badge>{agentTools.length} agents</Badge>
      </PanelHeader>
      <PanelBody className="min-h-0 overflow-y-auto p-3">
        <div className="grid gap-3" data-r2-access-agent-center>
          <section className="grid gap-3 rounded-md border border-border bg-background/55 p-3" data-r2-agent-connect>
            <div className="grid gap-1">
              <div className="text-sm font-semibold text-foreground">接入新 Agent</div>
              <div className="text-xs leading-5 text-muted-foreground">
                选择模板后测试本机命令。保存后的 CLI Agent 会同时进入工作区和工坊选择；命令不在 PATH 时请填写可执行文件完整路径。
              </div>
            </div>
            <div className="grid gap-2 text-xs text-muted-foreground min-[760px]:grid-cols-3" data-r2-agent-setup-path>
              {[
                ["1", "选模板", "先选 Claude、Codex、Hermes 或自定义入口。"],
                ["2", "测试连接", "Meowdesk 只确认这条本机命令能启动。"],
                ["3", "保存双落点", "保存后会出现在工作区和工坊；工作区少切窗使用，工坊制作组件/功能页。"]
              ].map(([step, title, copy]) => (
                <span key={step} className="flex min-w-0 gap-2">
                  <Badge className="h-5 shrink-0 px-1.5">{step}</Badge>
                  <span className="min-w-0">
                    <strong className="block text-foreground">{title}</strong>
                    <span className="block leading-5">{copy}</span>
                  </span>
                </span>
              ))}
            </div>
            <div className="grid gap-2 min-[920px]:grid-cols-4" data-r2-agent-presets>
              {agentPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    "meowdesk-card-surface vs-interactive-card grid min-w-0 gap-2 rounded-md border border-border bg-surface/55 p-3 text-left text-xs transition-colors hover:border-primary/40 hover:bg-surface/70",
                    selectedPresetId === preset.id && "border-primary/55 bg-primary/10"
                  )}
                  data-r2-agent-preset={preset.id}
                  data-r2-agent-preset-active={selectedPresetId === preset.id ? "true" : undefined}
                  onClick={() => selectPreset(preset)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <AccessAgentIcon name={preset.name} kind={preset.kind} />
                    <strong className="min-w-0 truncate text-sm text-foreground">{preset.name}</strong>
                  </span>
                  <span className="truncate text-muted-foreground">{preset.commandLine || preset.command || "手动填写命令"}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 min-[920px]:grid-cols-[1fr_1fr]">
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-foreground">显示名称</span>
                <Input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} data-r2-agent-draft-name />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-foreground">Agent 类型</span>
                <Input value={draft.kind} onChange={(event) => updateDraft({ kind: event.target.value })} data-r2-agent-draft-kind />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-foreground">启动命令</span>
                <Input value={draft.command} onChange={(event) => updateDraft({ command: event.target.value })} placeholder="claude / codex / wsl.exe" data-r2-agent-draft-command />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-foreground">工作目录</span>
                <Input value={draft.cwd} onChange={(event) => updateDraft({ cwd: event.target.value })} placeholder="." data-r2-agent-draft-cwd />
              </label>
              <label className="grid gap-1 text-xs min-[920px]:col-span-2">
                <span className="font-medium text-foreground">启动参数（一行一个）</span>
                <textarea
                  value={draft.argsText}
                  onChange={(event) => updateDraft({ argsText: event.target.value })}
                  className="min-h-20 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                  placeholder={"-e\nbash\n-lc\nhermes"}
                  data-r2-agent-draft-args
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs leading-5 text-muted-foreground" data-r2-agent-connect-status>{connectionStatus}</div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={testDraft} disabled={!draft.command || Boolean(testingToolId)} data-r2-agent-test-draft>
                  <RefreshCw size={13} className={cn(testingToolId === "draft" && "animate-spin")} aria-hidden="true" />
                  测试连接
                </Button>
                <Button type="button" size="sm" onClick={saveDraft} disabled={!draft.name.trim() || !draft.command.trim() || !draftTestPassed || Boolean(testingToolId)} data-r2-agent-save-draft>
                  <Save size={13} aria-hidden="true" />
                  保存 Agent
                </Button>
                {canOpenAgentSurfaces ? (
                  <Button type="button" variant="outline" size="sm" onClick={openWorkspace} data-r2-agent-open-workspace>
                    <Monitor size={13} aria-hidden="true" />
                    去工作区使用
                  </Button>
                ) : null}
                {canOpenAgentSurfaces ? (
                  <Button type="button" variant="outline" size="sm" onClick={openStudio} data-r2-agent-open-studio>
                    <Play size={13} aria-hidden="true" />
                    去工坊启动
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-2" data-r2-access-tool-list>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-foreground">我的 Agent</div>
                <div className="text-xs text-muted-foreground">保存后会出现在工作区和工坊的 Agent 选择里；工作区偏日常少切窗，工坊偏 Meowdesk 作品制作。</div>
              </div>
              <span className="flex items-center gap-2">
                {agentTools.length ? (
                  <Button type="button" variant="outline" size="sm" onClick={openWorkspace} data-r2-agent-list-open-workspace>
                    <Monitor size={13} aria-hidden="true" />
                    去工作区
                  </Button>
                ) : null}
                {agentTools.length ? (
                  <Button type="button" variant="outline" size="sm" onClick={openStudio} data-r2-agent-list-open-studio>
                    <Play size={13} aria-hidden="true" />
                    去工坊
                  </Button>
                ) : null}
                <Badge>{agentTools.length} 个</Badge>
              </span>
            </div>
          {agentTools.length ? agentTools.map((tool) => (
            <div key={tool.id} className="meowdesk-card-surface vs-interactive-card relative grid gap-2 rounded-md border border-border bg-background/55 p-3 pr-12 text-xs" data-r2-access-tool={tool.id}>
              <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3">
                <AccessAgentIcon name={tool.name} kind={tool.kind} />
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-foreground">{tool.name}</strong>
                  <span className="mt-1 block truncate text-muted-foreground">{tool.commandLine || tool.command || "未配置启动命令"}</span>
                  {toolTestResults[tool.id] ? (
                    <span className="mt-1 block truncate text-[11px] text-muted-foreground" data-r2-access-test-result={tool.id}>
                      {toolTestResults[tool.id]}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1.5">
                  <Badge>{tool.kind || "tool"}</Badge>
                </span>
                <CardActionMenu>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!tool.command || testingToolId === tool.id}
                    data-r2-access-test-tool={tool.id}
                    onClick={() => testAccessTool(tool)}
                  >
                    <RefreshCw size={13} className={cn(testingToolId === tool.id && "animate-spin")} aria-hidden="true" />
                    测试
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testingToolId === `delete-${tool.id}`}
                    data-r2-access-delete-tool={tool.id}
                    onClick={() => void deleteTool(tool)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    删除
                  </Button>
                </CardActionMenu>
              </div>
              <div className="grid gap-2 min-[980px]:grid-cols-2">
                <DetailTile label="启动命令" value={tool.commandLine || tool.command || "未配置"} />
                <DetailTile label="工作目录" value={tool.cwd || "."} />
              </div>
            </div>
          )) : (
            <div className="grid gap-3 rounded-md border border-dashed border-border px-3 py-10 text-center text-xs text-muted-foreground" data-r2-agent-empty-state>
              <div className="grid gap-1">
                <strong className="text-sm text-foreground">还没有接入 CLI Agent</strong>
                <span>可以先选择上方模板测试并保存为 CLI Agent；桌面端 Agent 暂从工坊外部接力，不会嵌入工作区。</span>
              </div>
              <span className="flex justify-center">
                <Button type="button" variant="outline" size="sm" onClick={openStudio} data-r2-agent-empty-open-studio>
                  <Play size={13} aria-hidden="true" />
                  去工坊接力桌面端
                </Button>
              </span>
            </div>
          )}
          </section>

          {advancedTools.length ? (
            <section className="grid gap-2 rounded-md border border-border bg-background/35 p-3 text-xs" data-r2-access-advanced-tools>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">高级工具</div>
                  <div className="text-xs text-muted-foreground">Terminal / Shell 保留给高级用户，不作为普通 Agent 接入入口。</div>
                </div>
                <Badge>{advancedTools.length} 个</Badge>
              </div>
              {advancedTools.map((tool) => (
                <div key={tool.id} className="meowdesk-card-surface vs-interactive-card grid gap-2 rounded-md border border-border bg-surface/50 p-2" data-r2-access-advanced-tool={tool.id}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <span className="min-w-0">
                      <strong className="block truncate text-foreground">{tool.name}</strong>
                      <span className="mt-1 block truncate text-muted-foreground">{tool.commandLine || tool.command || "未配置"}</span>
                      {toolTestResults[tool.id] ? (
                        <span className="mt-1 block truncate text-[11px] text-muted-foreground" data-r2-access-test-result={tool.id}>
                          {toolTestResults[tool.id]}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!tool.command || testingToolId === tool.id}
                      data-r2-access-advanced-test-tool={tool.id}
                      onClick={() => testAccessTool(tool)}
                    >
                      <RefreshCw size={13} className={cn(testingToolId === tool.id && "animate-spin")} aria-hidden="true" />
                      测试
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </PanelBody>
    </Panel>
  );
}

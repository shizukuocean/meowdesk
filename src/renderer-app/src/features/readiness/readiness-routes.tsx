import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { BookOpen, Database, FolderOpen, PawPrint, RefreshCw, Settings, Sparkles } from "lucide-react";
import type { WorkbenchSummary } from "@/app/use-workbench-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardActionMenu } from "@/components/ui/card-action-menu";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { listPets, pickObsidianVault, readPetDirectionFixes, readPetScales, writePetDirectionFixes, writePetScales } from "@/lib/workbench-api";
import type { PetDirectionFixMap, PetPackageDescriptor, PetScaleMap } from "@/lib/workbench-api";
import { cn } from "@/lib/utils";
import { DetailTile, RouteFrame, notifyPetSettingsChanged, openExternalUrl, openWorkbenchPath } from "./readiness-shared";
import { WorkspaceSettingsPanel, type AccessTool } from "./access-agent-settings";
import { WorkspacePetCanvas, petDirectionForPackage, petScaleForPackage } from "../workspace/workspace-route";

type AccessThemeMode = "light" | "dark";

export { WorkspaceRoute } from "../workspace/workspace-route";
export { readWorkspaceEnabledSidebarWidgetIds, sidebarBuiltins, writeWorkspaceEnabledSidebarWidgetIds, type WorkspaceHiddenPaneSummary, type WorkspaceTerminalStatus } from "../workspace/workspace-model";
export { ConversationsRoute } from "../conversations/conversations-route";
export { ObsidianRoute } from "../obsidian/obsidian-route";

type AccessSettingsSectionId = "appearance" | "workspace" | "pets" | "obsidian" | "advanced";

const accessSettingsSections: Array<{ id: AccessSettingsSectionId; label: string }> = [
  { id: "appearance", label: "外观" },
  { id: "workspace", label: "Agent 中心" },
  { id: "pets", label: "桌宠" },
  { id: "obsidian", label: "Obsidian" },
  { id: "advanced", label: "高级" }
];

function normalizeAccessSettingsSection(value: unknown): AccessSettingsSectionId {
  const section = String(value || "").trim().toLowerCase();
  if (section === "tools" || section === "agent" || section === "agents" || section === "workspace") return "workspace";
  if (section === "appearance" || section === "theme" || section === "themes") return "appearance";
  if (section === "pets" || section === "pet") return "pets";
  if (section === "obsidian" || section === "vault") return "obsidian";
  if (section === "advanced" || section === "storage" || section === "home") return "advanced";
  return "workspace";
}

function readAccessSettingsSectionFromHash(): AccessSettingsSectionId {
  if (typeof window === "undefined") return "workspace";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [, rawSection] = hash.match(/^(?:access|settings)(?:\/([^/?#]+))?/) || [];
  return normalizeAccessSettingsSection(rawSection);
}

function writeAccessSettingsSectionHash(section: AccessSettingsSectionId) {
  if (typeof window === "undefined") return;
  const nextHash = `#access/${section}`;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, "", nextHash);
}

export function AccessConfigRoute({
  summary,
  theme = "dark",
  onThemeChange
}: {
  summary: WorkbenchSummary;
  theme?: AccessThemeMode;
  onThemeChange?: (theme: AccessThemeMode) => void;
}) {
  const tools: AccessTool[] = [...summary.agentTools, ...summary.terminalSessions.map((session) => ({
    id: session.id,
    name: session.name,
    kind: session.toolKind,
    command: session.command,
    args: session.args,
    cwd: session.cwd,
    commandLine: [session.command, ...session.args].filter(Boolean).join(" ")
  }))];
  const [activeSection, setActiveSection] = useState<AccessSettingsSectionId>(() => readAccessSettingsSectionFromHash());

  useEffect(() => {
    const syncSectionFromHash = () => setActiveSection(readAccessSettingsSectionFromHash());
    window.addEventListener("hashchange", syncSectionFromHash);
    return () => window.removeEventListener("hashchange", syncSectionFromHash);
  }, []);

  useEffect(() => {
    const openSection = (event: Event) => {
      const section = normalizeAccessSettingsSection((event as CustomEvent<{ section?: string }>).detail?.section);
      setActiveSection(section);
      writeAccessSettingsSectionHash(section);
    };
    window.addEventListener("meowdesk:access-open-section", openSection);
    return () => window.removeEventListener("meowdesk:access-open-section", openSection);
  }, []);

  const selectSection = (section: AccessSettingsSectionId) => {
    setActiveSection(section);
    writeAccessSettingsSectionHash(section);
  };

  return (
    <RouteFrame
      id="access"
      eyebrow="Settings"
      title="设置"
      copy="管理本机 Agent 入口、工作台外观、桌宠、Obsidian 和本地数据。Agent 由用户确认命令后接入，Meowdesk 不自动扫描或代替登录。"
      badge="R2 contract"
      compact
    >
      <div className="grid h-full min-h-0 gap-3 overflow-hidden min-[1120px]:grid-cols-[260px_minmax(0,1fr)]" data-r2-access-route>
        <Panel className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <PanelHeader>
            <div>
              <div className="text-sm font-semibold">设置目录</div>
              <div className="text-xs text-muted-foreground">Local setup sections</div>
            </div>
            <Settings size={15} className="text-muted-foreground" aria-hidden="true" />
          </PanelHeader>
          <PanelBody className="min-h-0 overflow-y-auto p-3">
            <div className="grid gap-2 text-sm" data-r2-access-menu>
              {accessSettingsSections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "rounded-md border border-border bg-background/55 px-3 py-2 text-left text-muted-foreground transition-colors hover:border-primary/35 hover:bg-surface/70",
                    activeSection === item.id && "border-primary/45 bg-primary/10 text-primary"
                  )}
                  data-r2-access-menu-item={item.id}
                  data-r2-access-menu-active={activeSection === item.id ? "true" : undefined}
                  onClick={() => selectSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </PanelBody>
        </Panel>

        <div className="min-h-0 overflow-hidden">
          {activeSection === "appearance" ? (
            <AppearanceSettingsPanel theme={theme} onThemeChange={onThemeChange} />
          ) : null}

          {activeSection === "workspace" ? <WorkspaceSettingsPanel tools={tools} onChanged={summary.refresh} /> : null}
          {activeSection === "pets" ? <PetSettingsPanel /> : null}
          {activeSection === "obsidian" ? <ObsidianSettingsPanel summary={summary} /> : null}
          {activeSection === "advanced" ? <StorageSettingsPanel summary={summary} /> : null}
        </div>
      </div>
    </RouteFrame>
  );
}

function AppearanceSettingsPanel({
  theme,
  onThemeChange
}: {
  theme: AccessThemeMode;
  onThemeChange?: (theme: AccessThemeMode) => void;
}) {
  const options: Array<{ id: AccessThemeMode; label: string; detail: string }> = [
    { id: "light", label: "亮色", detail: "浅色 Meowdesk 工作台。" },
    { id: "dark", label: "暗色", detail: "深色 Meowdesk 工作台。" }
  ];
  return (
    <Panel className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" data-r2-access-section="appearance">
      <PanelHeader>
        <div>
          <div className="text-sm font-semibold">外观</div>
          <div className="text-xs text-muted-foreground">主题和视觉偏好</div>
        </div>
        <Sparkles size={15} className="text-muted-foreground" aria-hidden="true" />
      </PanelHeader>
      <PanelBody className="grid content-start gap-3 overflow-y-auto p-3 text-xs">
        <div className="grid gap-2" data-r2-access-theme-picker>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cn(
                "meowdesk-card-surface vs-interactive-card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-background/55 px-3 py-2 text-left transition-colors hover:border-primary/35 hover:bg-surface/70",
                theme === option.id && "border-primary/55 bg-primary/10"
              )}
              aria-pressed={theme === option.id}
              data-r2-access-theme-option={option.id}
              data-r2-access-theme-active={theme === option.id ? "true" : undefined}
              onClick={() => onThemeChange?.(option.id)}
            >
              <span
                className={cn(
                  "h-7 w-7 rounded-md border",
                  option.id === "light" ? "border-slate-300 bg-slate-100" : "border-slate-700 bg-slate-950"
                )}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <strong className="block text-sm text-foreground">{option.label}</strong>
                <span className="mt-1 block text-muted-foreground">{option.detail}</span>
              </span>
            </button>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}

function StorageSettingsPanel({ summary }: { summary: WorkbenchSummary }) {
  return (
    <Panel className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" data-r2-access-section="advanced">
      <PanelHeader>
        <div>
          <div className="text-sm font-semibold">本地数据目录</div>
          <div className="text-xs text-muted-foreground">Meowdesk Home</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!summary.homePath}
          data-r2-access-storage-open="home"
          data-r2-access-storage-open-target={summary.homePath || undefined}
          onClick={() => openWorkbenchPath(summary.homePath)}
        >
          打开
        </Button>
      </PanelHeader>
      <PanelBody className="grid content-start gap-2 overflow-y-auto p-3 text-xs" data-r2-access-storage>
        <DetailTile label="Home" value={summary.homePath || "读取中"} />
        <DetailTile label="Extensions" value={summary.extensionsDir || "读取中"} />
        <DetailTile label="Conversations" value={summary.conversationsDir || "读取中"} />
      </PanelBody>
    </Panel>
  );
}

function ObsidianSettingsPanel({ summary }: { summary: WorkbenchSummary }) {
  const [vaultPath, setVaultPath] = useState(summary.obsidianVaultPath || "");
  const [status, setStatus] = useState(summary.obsidianVaultPath ? "已读取保存的 vault。" : "未选择 vault。");

  useEffect(() => {
    setVaultPath(summary.obsidianVaultPath || "");
  }, [summary.obsidianVaultPath]);

  const chooseVault = async () => {
    setStatus("正在选择 vault...");
    try {
      const nextVault = await pickObsidianVault();
      if (!nextVault) {
        setStatus("已取消选择。");
        return;
      }
      setVaultPath(nextVault.path);
      setStatus(`已选择 ${nextVault.files.length} 篇笔记。`);
      summary.refresh();
    } catch (error) {
      setStatus(`选择失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openReader = () => {
    if (typeof window !== "undefined") window.location.hash = "#obsidian";
  };

  return (
    <Panel className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" data-r2-access-section="obsidian">
      <PanelHeader>
        <div>
          <div className="text-sm font-semibold">Obsidian</div>
          <div className="text-xs text-muted-foreground">本地 vault 配置和阅读器入口</div>
        </div>
        <Database size={15} className="text-muted-foreground" aria-hidden="true" />
      </PanelHeader>
      <PanelBody className="grid content-start gap-3 overflow-y-auto p-3 text-xs">
        <DetailTile label="当前 vault" value={vaultPath || "未选择 vault"} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={chooseVault} data-r2-access-obsidian-pick>
            <FolderOpen size={13} aria-hidden="true" />
            配置本地 Obsidian
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={openReader} data-r2-access-obsidian-open-reader>
            <BookOpen size={13} aria-hidden="true" />
            打开阅读器
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => openExternalUrl("https://obsidian.md/download")} data-r2-access-obsidian-download="https://obsidian.md/download">
            下载 Obsidian
          </Button>
        </div>
        <p className="rounded-md border border-border bg-background/55 p-3 leading-5 text-muted-foreground" data-r2-access-obsidian-status>
          {status}
        </p>
      </PanelBody>
    </Panel>
  );
}

function PetSettingsPanel() {
  const [pets, setPets] = useState<PetPackageDescriptor[]>([]);
  const [petDirectory, setPetDirectory] = useState("");
  const [petScales, setPetScales] = useState<PetScaleMap>({});
  const [petDirectionFixes, setPetDirectionFixes] = useState<PetDirectionFixMap>({});
  const [status, setStatus] = useState("读取本地宠物包。");

  const refreshPets = useCallback(async () => {
    try {
      const [petResult, scales, directionFixes] = await Promise.all([listPets(), readPetScales(), readPetDirectionFixes()]);
      setPets(petResult.pets);
      setPetDirectory(petResult.directory || "");
      setPetScales(scales);
      setPetDirectionFixes(directionFixes);
      setStatus(petResult.pets.length ? `已读取 ${petResult.pets.length} 个宠物包。` : "还没有安装宠物包。");
    } catch (error) {
      setPets([]);
      setStatus(`桌宠读取失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  useEffect(() => {
    void refreshPets();
  }, [refreshPets]);

  const persistScale = async (pet: PetPackageDescriptor, scale: number) => {
    const next = {
      ...petScales,
      [pet.id]: Math.max(0.6, Math.min(2.2, scale))
    };
    setPetScales(next);
    try {
      const saved = await writePetScales(next);
      setPetScales(saved);
      notifyPetSettingsChanged();
      setStatus(`${pet.displayName} 大小已调整。`);
    } catch (error) {
      setStatus(`大小保存失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const toggleDirection = async (pet: PetPackageDescriptor) => {
    const nextDirection = petDirectionForPackage(pet, petDirectionFixes) < 0 ? 1 : -1;
    const next = {
      ...petDirectionFixes,
      [pet.id]: nextDirection
    } as PetDirectionFixMap;
    setPetDirectionFixes(next);
    try {
      const saved = await writePetDirectionFixes(next);
      setPetDirectionFixes(saved);
      notifyPetSettingsChanged();
      setStatus(`${pet.displayName} 方向已${nextDirection < 0 ? "镜像" : "复位"}。`);
    } catch (error) {
      setStatus(`方向保存失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <Panel className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" data-r2-pet-settings data-r2-access-section="pets">
      <PanelHeader>
        <div>
          <div className="text-sm font-semibold">桌宠</div>
          <div className="text-xs text-muted-foreground">Petdex / 本地宠物包 / 大小与方向</div>
        </div>
        <PawPrint size={15} className="text-muted-foreground" aria-hidden="true" />
      </PanelHeader>
      <PanelBody className="grid content-start gap-3 overflow-y-auto p-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openExternalUrl("https://petdex-hazel.vercel.app/zh")} data-r2-pet-open-petdex="https://petdex-hazel.vercel.app/zh">
            Petdex
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!petDirectory} onClick={() => openWorkbenchPath(petDirectory)} data-r2-pet-open-folder data-r2-pet-open-folder-target={petDirectory || undefined}>
            <FolderOpen size={13} aria-hidden="true" />
            本地宠物包
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshPets()} data-r2-pet-refresh>
            <RefreshCw size={13} aria-hidden="true" />
            刷新
          </Button>
        </div>
        <div className="grid gap-2" data-r2-pet-list>
          {pets.length ? pets.map((pet) => {
            const scale = petScaleForPackage(pet, petScales);
            const direction = petDirectionForPackage(pet, petDirectionFixes);
            return (
              <div key={pet.id} className="meowdesk-card-surface vs-interactive-card relative grid gap-2 rounded-md border border-border bg-background/55 p-2 pr-12 text-xs" data-r2-pet-item={pet.id}>
                <div className="grid grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-2">
                  <span
                    className="meowdesk-pet-settings-preview"
                    style={{
                      "--r2-workspace-pet-scale": Math.min(1.25, scale),
                      "--r2-workspace-pet-direction": direction
                    } as CSSProperties}
                    aria-hidden="true"
                  >
                    <WorkspacePetCanvas pet={pet} status="idle" slot={1} label={pet.displayName} />
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm text-foreground">{pet.displayName}</strong>
                    <span className="block truncate text-muted-foreground">{pet.slug || pet.id}</span>
                  </div>
                  <Badge>{Math.round(scale * 100)}%</Badge>
                </div>
                <label className="grid grid-cols-[38px_minmax(0,1fr)_40px] items-center gap-2">
                  <span className="text-muted-foreground">大小</span>
                  <input
                    type="range"
                    min={60}
                    max={220}
                    step={5}
                    value={Math.round(scale * 100)}
                    data-r2-pet-scale={pet.id}
                    onChange={(event) => void persistScale(pet, Number(event.currentTarget.value) / 100)}
                  />
                  <strong className="text-right" data-r2-pet-scale-value={pet.id}>{Math.round(scale * 100)}%</strong>
                </label>
                <CardActionMenu>
                  <Button type="button" variant="outline" size="sm" data-r2-pet-scale-step={pet.id} data-r2-pet-delta="-0.1" onClick={() => void persistScale(pet, scale - 0.1)}>
                    缩小
                  </Button>
                  <Button type="button" variant="outline" size="sm" data-r2-pet-scale-step={pet.id} data-r2-pet-delta="0.1" onClick={() => void persistScale(pet, scale + 0.1)}>
                    放大
                  </Button>
                  <Button type="button" variant="outline" size="sm" data-r2-pet-scale-reset={pet.id} onClick={() => void persistScale(pet, 1)}>
                    复位
                  </Button>
                  <Button type="button" variant="outline" size="sm" data-r2-pet-direction-toggle={pet.id} onClick={() => void toggleDirection(pet)}>
                    {direction < 0 ? "取消镜像" : "镜像方向"}
                  </Button>
                </CardActionMenu>
              </div>
            );
          }) : (
            <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-muted-foreground">
              暂无宠物包，可从 Petdex 或本地宠物包目录安装。
            </div>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground" data-r2-pet-settings-status>{status}</div>
      </PanelBody>
    </Panel>
  );
}

export { ProfileRoute } from "../profile/profile-route";
export { PluginsRoute } from "../plugins/plugins-route";

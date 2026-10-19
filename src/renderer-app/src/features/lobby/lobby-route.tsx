import {
  ArrowRight,
  ArrowLeft,
  Archive,
  Bot,
  BookOpen,
  Download,
  FileText,
  Heart,
  MessageSquare,
  Pencil,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Terminal,
  Users
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import meowniGuideCommand from "@/assets/meowni/cutouts/meowni-guide-command.png";
import meowniGuideHelp from "@/assets/meowni/cutouts/meowni-guide-help.png";
import meowniGuideLaptop from "@/assets/meowni/cutouts/meowni-guide-laptop.png";
import meowniGuideSuccess from "@/assets/meowni/cutouts/meowni-guide-success.png";
import meowniGuideWarning from "@/assets/meowni/cutouts/meowni-guide-warning.png";
import type { WorkbenchExtensionSummary, WorkbenchProfileSummary, WorkbenchSummary } from "@/app/use-workbench-summary";
import { readStudioProjectPublishRecords, type StudioProjectPublishRecord } from "@/features/studio/studio-model";
import { cn } from "@/lib/utils";

type PluginGroupId = "sidebar" | "page" | "skill";
export type LobbySectionId = "plugins" | "friends" | "profile" | "guide";

type LobbyPublishRecord = StudioProjectPublishRecord;

const lobbySectionIds = new Set<LobbySectionId>(["plugins", "friends", "profile", "guide"]);

const pluginGroups: Array<{ id: PluginGroupId; title: string; copy: string; fallbackFeatured: string }> = [
  { id: "sidebar", title: "右侧栏组件", copy: "桌宠、番茄钟、看板等轻工具", fallbackFeatured: "番茄钟右侧栏" },
  { id: "page", title: "功能页", copy: "进入主导航的完整工作页", fallbackFeatured: "插件产品页" },
  { id: "skill", title: "Skill", copy: "给 Agent 使用的规则和能力包", fallbackFeatured: "工作流上下文包" }
];

const profileTitleLabels: Record<string, string> = {
  developer: "开发者",
  "round-table-1": "圆桌骑士1/150"
};

const profileLevelLabels: Record<number, string> = {
  1: "喵喵喵喵喵",
  2: "喵喵喵喵",
  3: "喵喵喵",
  4: "喵喵",
  5: "喵！"
};

function pluginGroupForExtension(item: WorkbenchExtensionSummary): PluginGroupId {
  if (item.type === "sidebar-widget") return "sidebar";
  if (item.type === "feature-page") return "page";
  if (item.type === "skill") return "skill";
  return "page";
}

function extensionsForGroup(extensions: WorkbenchExtensionSummary[], groupId: PluginGroupId) {
  return extensions.filter((item) => pluginGroupForExtension(item) === groupId);
}

function profileTitleLabel(id: string) {
  return profileTitleLabels[id] || id;
}

function profileGenderLabel(value?: string) {
  if (value === "male") return "男";
  if (value === "female") return "女";
  return "不显示";
}

function profileLevelLabel(value?: number) {
  const level = Number.isFinite(value) && value && value > 0 ? Math.min(99, Math.round(value)) : 1;
  return profileLevelLabels[Math.min(level, 5)] || profileLevelLabels[1];
}

function profileInitial(name?: string) {
  const value = String(name || "M").trim();
  return (value ? value.slice(0, 1) : "M").toUpperCase();
}

function isLobbySectionId(value: string): value is LobbySectionId {
  return lobbySectionIds.has(value as LobbySectionId);
}

function profileDisplay(summary: WorkbenchSummary): WorkbenchProfileSummary {
  return {
    displayName: summary.profile?.displayName || "Meowdesk 开发者",
    developerId: summary.profile?.developerId || "1",
    title: summary.profile?.title || "",
    bio: summary.profile?.bio || "",
    avatarDataUrl: summary.profile?.avatarDataUrl || "",
    level: summary.profile?.level || 1,
    email: summary.profile?.email || "",
    gender: summary.profile?.gender || "hidden",
    emailPublic: Boolean(summary.profile?.emailPublic),
    signedIn: Boolean(summary.profile?.signedIn),
    ownedTitleIds: summary.profile?.ownedTitleIds?.length ? summary.profile.ownedTitleIds : ["developer", "round-table-1"],
    wornTitleIds: summary.profile?.wornTitleIds?.length ? summary.profile.wornTitleIds : ["developer"]
  };
}

function openProfileEditor() {
  window.history.replaceState(null, "", "#profile");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function openSettings() {
  window.history.replaceState(null, "", "#access/workspace");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.dispatchEvent(new CustomEvent("meowdesk:access-open-section", { detail: { section: "workspace" } }));
}

function openStudio() {
  window.history.replaceState(null, "", "#studio");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function pluginMetricSeed(item: WorkbenchExtensionSummary) {
  return item.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pluginStats(item: WorkbenchExtensionSummary) {
  const seed = pluginMetricSeed(item);
  return {
    likes: 12 + (seed % 88),
    downloads: 40 + (seed % 360),
    rating: (4 + (seed % 9) / 10).toFixed(1),
    heat: seed % 3 === 0 ? "新作" : seed % 3 === 1 ? "热门" : "稳定"
  };
}

function readLobbyPublishRecords(): Record<string, LobbyPublishRecord> {
  return readStudioProjectPublishRecords();
}

function formatLobbyDate(value?: number) {
  return value ? new Date(value).toLocaleString() : "-";
}

export function LobbyRoute({
  summary,
  activeSection,
  onSectionChange
}: {
  summary: WorkbenchSummary;
  activeSection?: LobbySectionId;
  onSectionChange?: (section: LobbySectionId) => void;
}) {
  const profile = profileDisplay(summary);
  const [localSection, setLocalSection] = useState<LobbySectionId>("plugins");
  const wornTitles = profile.wornTitleIds?.length ? profile.wornTitleIds : ["developer"];
  const extensionCounts = {
    sidebar: extensionsForGroup(summary.workshopExtensions, "sidebar").length,
    page: extensionsForGroup(summary.workshopExtensions, "page").length,
    skill: extensionsForGroup(summary.workshopExtensions, "skill").length
  };
  const currentSection = activeSection || localSection;

  function selectLobbySection(value: string) {
    if (!isLobbySectionId(value)) return;
    if (onSectionChange) {
      onSectionChange(value);
      return;
    }
    setLocalSection(value);
  }

  useEffect(() => {
    const handleShowSection = () => {
      // The old welcome/login branch was removed from the live lobby. This
      // event now only keeps top-nav section buttons idempotent.
    };
    window.addEventListener("meowdesk:lobby-show-section", handleShowSection);
    return () => {
      window.removeEventListener("meowdesk:lobby-show-section", handleShowSection);
    };
  }, []);

  return (
    <div className="h-full min-h-0 w-full overflow-hidden" data-lobby-route data-lobby-name="大厅" data-lobby-auth-state="signed-in" data-lobby-active-section={currentSection} data-lobby-official>
      <Tabs value={currentSection} onValueChange={selectLobbySection} className="h-full min-h-0 overflow-hidden" data-lobby-section-tabs>
        <TabsContent className="mt-0 h-full min-h-0 overflow-hidden" value="plugins">
          <div className="grid h-full min-h-0 overflow-hidden">
            <MarketplacePanel summary={summary} extensionCounts={extensionCounts} />
          </div>
        </TabsContent>

        <TabsContent className="mt-0 h-full min-h-0 overflow-hidden" value="friends">
          <FriendsPanel />
        </TabsContent>

        <TabsContent className="mt-0 h-full min-h-0 overflow-hidden" value="profile">
          <ProfilePage profile={profile} wornTitles={wornTitles} summary={summary} />
        </TabsContent>

        <TabsContent className="mt-0 h-full min-h-0 overflow-hidden" value="guide">
          <StarterGuidePanel summary={summary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileCard({
  profile,
  wornTitles,
  summary,
  compact = false
}: {
  profile: WorkbenchProfileSummary;
  wornTitles: string[];
  summary: WorkbenchSummary;
  compact?: boolean;
}) {
  const avatarDataUrl = profile.avatarDataUrl?.startsWith("data:image/") ? profile.avatarDataUrl : "";
  return (
    <section className="rounded-md border border-border bg-background/55" data-lobby-profile-card>
      <div className={compact ? "h-10 rounded-t-md border-b border-border bg-[linear-gradient(135deg,rgba(59,130,246,0.28),rgba(16,185,129,0.12)_54%,rgba(15,23,42,0.4))]" : "h-16 rounded-t-md border-b border-border bg-[linear-gradient(135deg,rgba(59,130,246,0.3),rgba(16,185,129,0.12)_54%,rgba(15,23,42,0.46))]"} />
      <div className="grid gap-3 px-3 pb-3">
        <div className="-mt-7 flex items-end justify-between gap-3">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-primary/40 bg-primary/15 text-xl font-semibold text-primary shadow-sm">
            {avatarDataUrl ? <img className="h-full w-full object-cover" src={avatarDataUrl} alt="" /> : <span>{profileInitial(profile.displayName)}</span>}
          </div>
          <div className="mb-1 flex flex-wrap justify-end gap-2">
            <Badge variant="success">LV{profile.level || 1} · {profileLevelLabel(profile.level)}</Badge>
            <Badge>{profile.signedIn ? "本机已登录" : "本机资料"}</Badge>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold">{profile.displayName}</h2>
              <p className="mt-1 text-xs text-muted-foreground">ID {profile.developerId || "1"} · {profile.email && profile.emailPublic ? profile.email : "邮箱不公开"}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={openProfileEditor} data-lobby-profile-edit>
              <Pencil size={14} aria-hidden="true" />
              编辑
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {wornTitles.map((id) => (
              <span key={id} className="inline-flex h-7 items-center rounded-full border border-warning/35 bg-warning/10 px-3 text-xs font-medium text-warning">
                {profileTitleLabel(id)}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <MetricBox label="作品" value={String(summary.workshopExtensionCount ?? 0)} />
          <MetricBox label="称号" value={String(wornTitles.length)} />
          <MetricBox label="性别" value={profileGenderLabel(profile.gender)} />
        </div>
        <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
          {profile.bio || "这个本地资料还没有写简介。"}
        </p>
      </div>
    </section>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface/60 px-3 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <strong className="mt-1 block truncate text-base text-foreground">{value}</strong>
    </div>
  );
}

function MarketplacePanel({
  summary,
  extensionCounts
}: {
  summary: WorkbenchSummary;
  extensionCounts: Record<PluginGroupId, number>;
}) {
  const [activeGroupId, setActiveGroupId] = useState<PluginGroupId>("sidebar");
  const [selectedItemId, setSelectedItemId] = useState("");
  const activeGroup = pluginGroups.find((group) => group.id === activeGroupId) || pluginGroups[0];
  const items = extensionsForGroup(summary.workshopExtensions, activeGroup.id);
  const featured = items[0];
  const selectedItem = items.find((item) => item.id === selectedItemId);
  const publishRecords = readLobbyPublishRecords();

  useEffect(() => {
    setSelectedItemId("");
  }, [activeGroupId]);

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-background/35" data-lobby-marketplace data-lobby-plugin-subpage={activeGroup.id}>
      <header className="grid min-h-14 gap-3 border-b border-border px-4 py-3 min-[860px]:grid-cols-[minmax(0,1fr)_auto] min-[860px]:items-center">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{activeGroup.title}广场</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{activeGroup.copy}</div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-1 min-[860px]:justify-end" data-lobby-plugin-subpage-nav aria-label="社区分类">
          {pluginGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              aria-current={activeGroupId === group.id ? "page" : undefined}
              data-lobby-plugin-subpage-link={group.id}
              onClick={() => setActiveGroupId(group.id)}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-transparent px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-[current=page]:border-border aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
            >
              <span>{group.title}</span>
              <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[11px]">{extensionCounts[group.id]}</span>
            </button>
          ))}
          <Badge>{extensionCounts[activeGroup.id]} items</Badge>
        </div>
      </header>
      <div className="h-full min-h-0 overflow-y-auto" data-lobby-plugin-subpage-scroll>
        <div className="p-4" data-lobby-plugin-subpage-main>
          {selectedItem ? (
            <PluginMarketDetail
              item={selectedItem}
              group={activeGroup}
              profile={profileDisplay(summary)}
              publishRecord={publishRecords[selectedItem.id]}
              onBack={() => setSelectedItemId("")}
            />
          ) : (
          <div className="grid gap-3 min-[720px]:grid-cols-2 min-[1360px]:grid-cols-3" aria-label={`${activeGroup.title}社区`}>
            <PluginMarketCard item={featured} group={activeGroup} count={extensionCounts[activeGroup.id]} featured onOpen={setSelectedItemId} />
            {items.slice(featured ? 1 : 0, featured ? 9 : 8).map((item) => (
              <PluginMarketCard key={item.id} item={item} group={activeGroup} onOpen={setSelectedItemId} />
            ))}
            {!items.length ? (
              <div className="grid min-h-44 place-items-center rounded-md border border-dashed border-border bg-background/35 px-4 text-center text-xs text-muted-foreground">
                这个分类还没有本机作品。
              </div>
            ) : null}
          </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PluginMarketCard({
  item,
  group,
  count,
  featured = false,
  onOpen
}: {
  item?: WorkbenchExtensionSummary;
  group: (typeof pluginGroups)[number];
  count?: number;
  featured?: boolean;
  onOpen?: (id: string) => void;
}) {
  const stats = item ? pluginStats(item) : undefined;
  const title = item?.name || group.fallbackFeatured;
  const summary = item?.summary || group.copy;
  const status = item?.status || "preview";
  return (
    <button
      type="button"
      className={cn(
        "grid min-h-44 content-between gap-4 rounded-md border border-border bg-background/55 p-4 text-left text-xs transition-colors hover:border-primary/45 hover:bg-accent/65",
        featured && "border-primary/35 bg-primary/5"
      )}
      data-lobby-plugin-market-card={item?.id || `${group.id}-featured`}
      data-lobby-plugin-market-row={item?.id || `${group.id}-featured`}
      data-lobby-plugin-featured={featured ? group.id : undefined}
      data-lobby-plugin-card-interactive={item ? "true" : "false"}
      onClick={() => {
        if (item) onOpen?.(item.id);
      }}
    >
      <span className="grid gap-3">
        <span className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
            <Store size={18} aria-hidden="true" />
          </span>
          <span className="flex flex-wrap justify-end gap-1.5">
            {featured ? <Badge variant="primary">精选</Badge> : null}
            <Badge variant={status === "ready" ? "success" : status === "error" ? "danger" : "default"}>{stats?.heat || "预览"}</Badge>
          </span>
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-base text-foreground">{title}</strong>
          <span className="mt-1 block line-clamp-3 leading-5 text-muted-foreground">{summary}</span>
        </span>
      </span>
      <span className="grid gap-2">
        <span className="flex flex-wrap items-center gap-2 text-muted-foreground" data-lobby-plugin-count={featured ? group.id : undefined}>
          {featured ? <span>{count ?? 0} 个作品</span> : item ? <span>{item.runtime || "html"}</span> : <span>{group.title}</span>}
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12} aria-hidden="true" />本机索引</span>
        </span>
        <span className="flex flex-wrap items-center gap-3 text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Heart size={12} aria-hidden="true" />{stats?.likes ?? "-"}</span>
          <span className="inline-flex items-center gap-1"><Download size={12} aria-hidden="true" />{stats?.downloads ?? "-"}</span>
          <span className="inline-flex items-center gap-1"><Star size={12} aria-hidden="true" />{stats?.rating ?? "-"}</span>
        </span>
      </span>
    </button>
  );
}

function PluginMarketDetail({
  item,
  group,
  profile,
  publishRecord,
  onBack
}: {
  item: WorkbenchExtensionSummary;
  group: (typeof pluginGroups)[number];
  profile: WorkbenchProfileSummary;
  publishRecord?: LobbyPublishRecord;
  onBack: () => void;
}) {
  const stats = pluginStats(item);
  const versions = item.versions.length ? item.versions : [{
    key: item.version || "current",
    version: item.version,
    label: item.version || "当前版本",
    current: true,
    status: item.status,
    summary: item.summary,
    runtime: item.runtime,
    entry: item.entry,
    modifiedAt: item.modifiedAt
  }];
  const installed = Boolean(item.path && item.entryPath);
  const packagePath = publishRecord?.packagePath || "";

  return (
    <div className="grid gap-4" data-lobby-plugin-detail data-lobby-plugin-detail-id={item.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" size="sm" variant="outline" onClick={onBack} data-lobby-plugin-detail-back>
            <ArrowLeft size={14} aria-hidden="true" />
            返回社区
          </Button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">作品详情</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{group.title} · 本机社区预览</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={installed ? "success" : "default"}>{installed ? "已安装" : "未安装"}</Badge>
          <Badge>{item.version ? `v${item.version}` : "版本未知"}</Badge>
        </div>
      </div>

      <div className="grid gap-4 min-[1180px]:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <section className="grid gap-3 rounded-md border border-border bg-background/55 p-4" data-lobby-plugin-detail-main={item.id}>
          <div className="grid gap-3 min-[760px]:grid-cols-[64px_minmax(0,1fr)_auto] min-[760px]:items-start">
            <span className="grid h-16 w-16 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
              <Store size={26} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold">{publishRecord?.title || item.name}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{publishRecord?.summary || item.summary || group.copy}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Heart size={12} aria-hidden="true" />{stats.likes}</span>
                <span className="inline-flex items-center gap-1"><Download size={12} aria-hidden="true" />{stats.downloads}</span>
                <span className="inline-flex items-center gap-1"><Star size={12} aria-hidden="true" />{stats.rating}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-md border border-border bg-surface/60 p-3" data-lobby-plugin-demo={item.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">产品演示</span>
              <Badge>未填</Badge>
            </div>
            <div className="grid min-h-56 place-items-center rounded-md border border-dashed border-border bg-background/35 px-4 text-center text-xs leading-5 text-muted-foreground" data-lobby-plugin-demo-empty={item.id}>
              作者尚未上传产品演示截图。本地测试阶段只显示未填写状态，后续发布页补封面 / 截图上传后再展示。
            </div>
          </div>

          <div className="grid gap-2 rounded-md border border-border bg-surface/60 p-3 text-xs" data-lobby-plugin-changelog={item.id}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText size={14} aria-hidden="true" />
              更新记录
            </div>
            <p className="whitespace-pre-wrap leading-5 text-muted-foreground">
              {publishRecord?.changelog || "暂无更新记录。后续从工坊发布页填写的更新记录会显示在这里。"}
            </p>
          </div>
        </section>

        <aside className="grid content-start gap-3">
          <section className="grid gap-2 rounded-md border border-border bg-background/55 p-3 text-xs" data-lobby-plugin-author={item.id}>
            <div className="font-medium">作者</div>
            <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-3">
              <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-primary/25 bg-primary/10 text-primary">
                {profile.avatarDataUrl ? <img className="h-full w-full object-cover" src={profile.avatarDataUrl} alt="" /> : profileInitial(profile.displayName)}
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-sm text-foreground">{profile.displayName || "Meowdesk 开发者"}</strong>
                <span className="mt-1 block truncate text-muted-foreground">ID {profile.developerId || "1"} · {profileLevelLabel(profile.level)}</span>
              </span>
            </div>
          </section>

          <section className="grid gap-2 rounded-md border border-border bg-background/55 p-3 text-xs" data-lobby-plugin-version={item.id}>
            <div className="font-medium">版本信息</div>
            <DetailMiniRow label="当前版本" value={publishRecord?.version || item.version || "-"} />
            <DetailMiniRow label="类型" value={group.title} />
            <DetailMiniRow label="运行时" value={item.runtime || "-"} />
            <DetailMiniRow label="入口" value={item.entry || "-"} />
            <DetailMiniRow label="本地发布" value={formatLobbyDate(publishRecord?.publishedAt)} />
            <DetailMiniRow label="包路径" value={packagePath || "-"} muted />
          </section>

          <section className="grid gap-2 rounded-md border border-border bg-background/55 p-3 text-xs" data-lobby-plugin-snapshots={item.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">更新快照</span>
              <Badge>{versions.length}</Badge>
            </div>
            {versions.slice(0, 5).map((version) => (
              <div key={version.key} className="rounded border border-border bg-surface/60 px-2 py-1.5" data-lobby-plugin-snapshot={version.key}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{version.label || version.version || version.key}</span>
                  <Badge variant={version.current ? "success" : "default"}>{version.current ? "current" : version.status || "snapshot"}</Badge>
                </div>
                <div className="mt-1 truncate text-muted-foreground">
                  {version.entry || item.entry || "-"}
                  {version.modifiedAt ? ` · ${formatLobbyDate(version.modifiedAt)}` : ""}
                </div>
              </div>
            ))}
          </section>

          {publishRecord?.installTest ? (
            <section className="grid gap-2 rounded-md border border-border bg-background/55 p-3 text-xs" data-lobby-plugin-install-snapshot={item.id}>
              <div className="flex items-center gap-2 font-medium">
                <Archive size={14} aria-hidden="true" />
                最近安装测试
              </div>
              <DetailMiniRow label="时间" value={formatLobbyDate(publishRecord.installTest.testedAt)} />
              <DetailMiniRow label="模式" value={publishRecord.installTest.installMode || "-"} />
              <DetailMiniRow label="路径" value={publishRecord.installTest.testInstallPath || "-"} muted />
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function DetailMiniRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 rounded border border-border bg-surface/60 px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 truncate", muted && "text-muted-foreground")} title={value}>{value}</span>
    </div>
  );
}

function PluginWorkCard({ item }: { item: WorkbenchExtensionSummary }) {
  const stats = pluginStats(item);
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-md border border-border bg-background/55 px-3 py-2 text-xs">
      <span className="grid h-10 w-10 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
        <Store size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <strong className="truncate text-sm text-foreground">{item.name}</strong>
          <Badge variant={item.status === "ready" ? "success" : item.status === "error" ? "danger" : "default"}>{stats.heat}</Badge>
        </span>
        <span className="mt-1 block line-clamp-2 leading-5 text-muted-foreground">{item.summary || item.type}</span>
        <span className="mt-2 flex flex-wrap gap-2 text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Heart size={12} aria-hidden="true" />{stats.likes}</span>
          <span className="inline-flex items-center gap-1"><Download size={12} aria-hidden="true" />{stats.downloads}</span>
          <span className="inline-flex items-center gap-1"><Star size={12} aria-hidden="true" />{stats.rating}</span>
        </span>
      </span>
    </div>
  );
}

function FriendsPreviewPanel() {
  return (
    <Panel data-lobby-friends-preview>
      <PanelHeader>
        <div>
          <div className="text-sm font-semibold">好友</div>
          <div className="text-xs text-muted-foreground">关注、好友、协作工作区预留</div>
        </div>
        <Users size={15} className="text-muted-foreground" aria-hidden="true" />
      </PanelHeader>
      <PanelBody className="grid gap-2 p-3 text-xs">
        <div className="grid grid-cols-3 gap-2">
          <MetricBox label="关注" value="预留" />
          <MetricBox label="粉丝" value="预留" />
          <MetricBox label="协作" value="预留" />
        </div>
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-muted-foreground">
          后续这里承载好友、关注、收藏权限和共享工作区，不在 R1.5 接远端社交。
        </div>
      </PanelBody>
    </Panel>
  );
}

function FriendsPanel() {
  return (
    <div className="grid h-full min-h-0 gap-3 overflow-y-auto pr-1 min-[980px]:grid-cols-3" data-lobby-friends-panel>
      {[
        { icon: Users, title: "好友列表", copy: "未来显示已关注/互相关注的用户和 Agent 用户。" },
        { icon: MessageSquare, title: "消息与申请", copy: "未来承载好友申请、插件评论、协作邀请。" },
        { icon: Store, title: "收藏与喜欢", copy: "未来控制公开展示哪些喜欢、收藏和已安装作品。" }
      ].map((item) => {
        const Icon = item.icon;
        return (
          <Panel key={item.title}>
            <PanelBody className="grid min-h-40 content-start gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span>
                <strong className="block text-sm text-foreground">{item.title}</strong>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">{item.copy}</span>
              </span>
              <Badge>预留</Badge>
            </PanelBody>
          </Panel>
        );
      })}
    </div>
  );
}

function ProfilePage({
  profile,
  wornTitles,
  summary
}: {
  profile: WorkbenchProfileSummary;
  wornTitles: string[];
  summary: WorkbenchSummary;
}) {
  const featuredWorks = summary.workshopExtensions.slice(0, 6);
  const avatarDataUrl = profile.avatarDataUrl?.startsWith("data:image/") ? profile.avatarDataUrl : "";
  const displayWorks = featuredWorks.length
    ? featuredWorks
    : [
        {
          id: "empty-work",
          name: "还没有公开作品",
          summary: "后续发布的右侧栏组件、功能页和 Skill 会像 GitHub 作品列表一样展示在这里。",
          type: "feature-page",
          status: "idle",
          versions: []
        } as WorkbenchExtensionSummary
      ];
  return (
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden" data-lobby-profile-page>
      <main className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-6 min-[760px]:px-8">
        <section className="border-b border-border pb-7" data-lobby-profile-hero>
          <div className="grid gap-6 min-[920px]:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="grid content-start justify-items-center gap-3 text-center">
              <div className="relative grid h-36 w-36 place-items-center overflow-hidden rounded-full border border-primary/35 bg-primary/15 text-5xl font-semibold text-primary shadow-sm" data-lobby-profile-avatar>
                {avatarDataUrl ? <img className="h-full w-full object-cover" src={avatarDataUrl} alt="" /> : <span>{profileInitial(profile.displayName)}</span>}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={openProfileEditor} data-lobby-profile-edit>
                <Pencil size={14} aria-hidden="true" />
                编辑资料
              </Button>
            </aside>

            <div className="grid min-w-0 content-start gap-5">
              <div className="grid gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>大厅个人主页</span>
                    <span>ID {profile.developerId || "1"}</span>
                    <Badge variant="success">LV{profile.level || 1} · {profileLevelLabel(profile.level)}</Badge>
                  </div>
                  <h1 className="mt-3 truncate text-3xl font-semibold text-foreground">{profile.displayName}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{profile.email && profile.emailPublic ? profile.email : "邮箱不公开"}</span>
                    <span>{profileGenderLabel(profile.gender)}</span>
                    <span>{profile.signedIn ? "本机已登录" : "本机资料"}</span>
                  </div>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
                    {profile.bio || "这个本地资料还没有写简介。"}
                  </p>
                </div>
              </div>

              <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" data-lobby-profile-title-strip aria-label="称号标签">
                {wornTitles.map((id) => (
                  <span key={id} className="inline-flex h-8 shrink-0 items-center rounded-full border border-warning/35 bg-warning/10 px-3 text-xs font-medium text-warning">
                    {profileTitleLabel(id)}
                  </span>
                ))}
                {profile.ownedTitleIds?.filter((id) => !wornTitles.includes(id)).map((id) => (
                  <span key={id} className="inline-flex h-8 shrink-0 items-center rounded-full border border-border bg-surface/60 px-3 text-xs text-muted-foreground">
                    {profileTitleLabel(id)}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs min-[680px]:max-w-xl" data-lobby-profile-stats>
                <MetricBox label="作品" value={String(summary.workshopExtensionCount ?? 0)} />
                <MetricBox label="称号" value={String(profile.ownedTitleIds?.length || wornTitles.length)} />
                <MetricBox label="公开" value={profile.emailPublic ? "邮箱" : "资料"} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 pb-8" data-lobby-profile-works>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">已发布作品</h2>
              <p className="mt-1 text-sm text-muted-foreground">这里用作品展示条承载插件、功能页和 Skill。</p>
            </div>
            <Badge>{featuredWorks.length} 个展示</Badge>
          </div>
          <div className="border-y border-border" aria-label="个人作品">
            {displayWorks.map((item) => <ProfileWorkRow key={item.id} item={item} isPlaceholder={!featuredWorks.length} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

function ProfileWorkRow({ item, isPlaceholder = false }: { item: WorkbenchExtensionSummary; isPlaceholder?: boolean }) {
  const stats = pluginStats(item);
  return (
    <div className="meowdesk-lobby-profile-work-row" data-lobby-profile-work-row>
      <span className="meowdesk-lobby-profile-work-icon">
        <Store size={18} aria-hidden="true" />
      </span>
      <span className="meowdesk-lobby-profile-work-copy">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <strong className="min-w-0 truncate text-sm text-foreground">{item.name}</strong>
          <Badge variant={isPlaceholder ? "default" : item.status === "ready" ? "success" : item.status === "error" ? "danger" : "default"}>
            {isPlaceholder ? "预留" : stats.heat}
          </Badge>
        </span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary || item.type}</span>
      </span>
      <span className="meowdesk-lobby-profile-work-stats" data-lobby-profile-work-stats>
        <span className="inline-flex h-full items-center justify-center gap-1 whitespace-nowrap"><Heart size={12} aria-hidden="true" />{isPlaceholder ? "-" : stats.likes}</span>
        <span className="inline-flex h-full items-center justify-center gap-1 whitespace-nowrap"><Download size={12} aria-hidden="true" />{isPlaceholder ? "-" : stats.downloads}</span>
        <span className="inline-flex h-full items-center justify-center gap-1 whitespace-nowrap"><Star size={12} aria-hidden="true" />{isPlaceholder ? "-" : stats.rating}</span>
      </span>
    </div>
  );
}

function scrollStarterGuideSection(section: "has-agent" | "desktop-agent" | "no-agent") {
  document.querySelector(`[data-lobby-guide-section="${section}"]`)?.scrollIntoView({ behavior: "auto", block: "start" });
}

const cliSetupSteps = [
  {
    id: "template",
    title: "先选一个模板",
    copy: "从 Claude Code、Codex、Hermes 这些常用入口开始。大多数时候不用自己写命令，先让 Meowdesk 帮你带出默认配置。",
    asset: meowniGuideCommand,
    assetId: "command",
    badge: "choose"
  },
  {
    id: "settings",
    title: "点击测试连接",
    copy: "测试会确认这个入口能不能真的启动 CLI Agent。通过之前先别保存，这样不会把桌面 App 或快捷方式误当成 Agent。",
    asset: meowniGuideHelp,
    assetId: "help",
    badge: "test"
  },
  {
    id: "save",
    title: "测试通过再保存",
    copy: "保存后，这个 Agent 就会变成本机入口。以后你不用重复配置，只要在需要的地方选择它。",
    asset: meowniGuideSuccess,
    assetId: "success",
    badge: "save"
  },
  {
    id: "use",
    title: "保存配置完成",
    copy: "接好以后，Meowdesk 会记住这个 CLI Agent。后面你在需要 Agent 的地方，会自动看到这个入口。",
    asset: meowniGuideLaptop,
    assetId: "laptop",
    badge: "use"
  }
] as const;

function CliSetupGuideSection() {
  return (
    <section className="scroll-mt-6 border-b border-border pb-10" data-lobby-guide-section="has-agent" data-lobby-cli-setup-guide>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Path 01</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">已有 CLI Agent：跟着模板接入</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            这一段只处理“我已经有 CLI Agent”的用户。先选模板，测试通过后保存；只有测试不通过时，才需要再检查启动命令或路径。
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={openSettings} data-lobby-agent-settings-link>
          <Settings size={13} aria-hidden="true" />
          去 Agent 中心
        </Button>
      </div>

      <div className="mt-5 grid gap-4 min-[760px]:grid-cols-2 min-[1180px]:grid-cols-4" data-lobby-cli-setup-steps>
        {cliSetupSteps.map((step, index) => (
          <CliSetupStepCard key={step.id} index={index + 1} step={step} />
        ))}
      </div>

      <div className="mt-5 grid gap-4 rounded-lg border border-border bg-surface/70 p-4 min-[900px]:grid-cols-[minmax(0,1fr)_260px]" data-lobby-cli-command-tips>
        <div>
          <div className="text-sm font-semibold text-foreground">测试不通过时，再看这三个字段</div>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground min-[720px]:grid-cols-3">
            <span className="rounded-md border border-border bg-background/55 px-3 py-2"><strong className="text-foreground">启动命令</strong><br />CLI 的名字或完整路径</span>
            <span className="rounded-md border border-border bg-background/55 px-3 py-2"><strong className="text-foreground">启动参数</strong><br />模板需要时会带上</span>
            <span className="rounded-md border border-border bg-background/55 px-3 py-2"><strong className="text-foreground">工作目录</strong><br />Agent 打开的位置</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-3" data-lobby-cli-shortcut-warning>
          <img src={meowniGuideWarning} alt="" className="h-16 w-16 shrink-0 object-contain" data-lobby-guide-asset="shortcut-warning" />
          <p className="text-xs leading-5 text-muted-foreground">
            如果测试失败，不一定是你做错了：可能只是还没安装 CLI，或桌面版没有提供命令行入口。
          </p>
        </div>
      </div>
    </section>
  );
}

function CliSetupStepCard({
  index,
  step
}: {
  index: number;
  step: (typeof cliSetupSteps)[number];
}) {
  return (
    <article className="grid min-h-[250px] content-between gap-4 rounded-lg border border-border bg-surface/70 p-4 shadow-[0_18px_46px_rgba(0,0,0,0.1)]" data-lobby-cli-guide-step={step.id}>
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{index}</span>
        <span className="rounded-full border border-border bg-background/55 px-2.5 py-1 text-[11px] font-semibold uppercase text-muted-foreground">{step.badge}</span>
      </div>
      <img src={step.asset} alt="" className="mx-auto h-28 max-w-full object-contain" data-lobby-guide-asset={step.assetId} />
      <div>
        <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.copy}</p>
      </div>
    </article>
  );
}

function MeowniGuideMark({ size = 128 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label="Meowni"
      className="meowdesk-guide-meowni"
      data-lobby-guide-meowni
    >
      <defs>
        <filter id="guideMeowniGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#2367FF" floodOpacity="0.18" />
        </filter>
        <linearGradient id="guideMeowniBlue" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#2E83FF" />
          <stop offset="1" stopColor="#0A2E83" />
        </linearGradient>
      </defs>
      <g className="meowni-body" filter="url(#guideMeowniGlow)">
        <path d="M65 57 C74 52 86 52 95 57" fill="none" stroke="#071A44" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M68 55 C75 52 85 52 92 55" fill="none" stroke="#2F73F6" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 70 C27 56 36 50 50 48" fill="none" stroke="#071A44" strokeWidth="6" strokeLinecap="round" />
        <path d="M136 70 C133 56 124 50 110 48" fill="none" stroke="#071A44" strokeWidth="6" strokeLinecap="round" />
        <rect x="22" y="61" width="116" height="80" rx="38" fill="#fff" stroke="#071A44" strokeWidth="7" />
        <path className="meowni-ear" d="M36 69 C38 36 46 25 72 57 L60 70 Z" fill="#fff" />
        <path className="meowni-ear" d="M36 69 C38 36 46 25 72 57" fill="none" stroke="#071A44" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M49 47 L60 58 L45 60 Z" fill="#FF8FA8" opacity="0.92" />
        <path className="meowni-ear" d="M124 69 C122 36 114 25 88 57 L100 70 Z" fill="#fff" />
        <path className="meowni-ear" d="M124 69 C122 36 114 25 88 57" fill="none" stroke="#071A44" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M111 47 L100 58 L115 60 Z" fill="#FF8FA8" opacity="0.92" />
        <rect x="15" y="71" width="24" height="44" rx="12" fill="url(#guideMeowniBlue)" stroke="#071A44" strokeWidth="6" />
        <rect x="121" y="71" width="24" height="44" rx="12" fill="url(#guideMeowniBlue)" stroke="#071A44" strokeWidth="6" />
        <rect className="meowni-eye" x="56" y="83" width="12" height="32" rx="6" fill="#071A44" />
        <rect className="meowni-eye" x="93" y="83" width="12" height="32" rx="6" fill="#071A44" />
        <path d="M69 113 C73 122 80 122 80 114 C80 122 88 122 92 113" fill="none" stroke="#071A44" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="40" y="102" width="18" height="6" rx="3" fill="#73B6FF" />
        <rect x="102" y="102" width="18" height="6" rx="3" fill="#73B6FF" />
        <rect x="46" y="127" width="70" height="20" rx="6" fill="#0E3D9A" stroke="#071A44" strokeWidth="6" />
        <path d="M58 132 L68 138 L58 144 L58 140 L62 138 L58 136 Z" fill="#fff" />
        <rect x="78" y="139" width="15" height="4" rx="2" fill="#fff" />
        <rect x="101" y="134" width="7" height="7" rx="1.5" fill="#FFC64D" />
      </g>
      <g className="meowni-spark" fill="none" stroke="#5EB6FF" strokeWidth="6" strokeLinecap="round">
        <path d="M126 31 L132 21" />
        <path d="M138 44 L149 38" />
        <path d="M30 34 L22 27" />
      </g>
    </svg>
  );
}

function StarterGuidePanel({ summary }: { summary: WorkbenchSummary }) {
  const configuredAgents = summary.agentTools.length;
  const workshopCount = summary.workshopExtensionCount ?? 0;
  return (
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden" data-lobby-starter-center data-lobby-agent-tutorial>
      <main className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-8 min-[760px]:px-10">
        <section className="grid min-h-[430px] items-center gap-8 overflow-hidden rounded-lg border border-border px-6 py-8 min-[1080px]:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] min-[1080px]:px-8" data-lobby-guide-hero>
          <div className="min-w-0">
            <div className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-primary">
              <Sparkles size={16} aria-hidden="true" />
              Meowni Guide v0.1
            </div>
            <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[1.03] tracking-normal text-foreground min-[1180px]:text-6xl">
              <span className="block">让 Meowdesk</span>
              <span className="block">认识你的 Agent</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
              Meowni 会先判断你现在有什么：已经能运行的 CLI Agent、只有桌面端 Agent，或还没有 Agent。选对路径后，再进入 Agent 中心或工坊。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button type="button" onClick={() => scrollStarterGuideSection("has-agent")} data-lobby-guide-jump="has-agent">
                我有 CLI Agent
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" onClick={() => scrollStarterGuideSection("desktop-agent")} data-lobby-guide-jump="desktop-agent">
                我只有桌面端
              </Button>
              <Button type="button" variant="outline" onClick={() => scrollStarterGuideSection("no-agent")} data-lobby-guide-jump="no-agent">
                我还没有 Agent
              </Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-background/60 px-3 py-1">已配置 Agent：{configuredAgents}</span>
              <span className="rounded-full border border-border bg-background/60 px-3 py-1">本机作品：{workshopCount}</span>
            </div>
          </div>
          <div className="relative min-h-[340px] overflow-hidden px-2 py-4" data-lobby-guide-stage>
            <div className="absolute inset-x-8 top-10 h-24 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
            <div className="absolute bottom-8 left-8 right-8 h-16 rounded-[50%] bg-primary/10 blur-xl" aria-hidden="true" />
            <div className="relative flex h-full min-h-[300px] flex-col items-center justify-center gap-4" data-lobby-guide-stage-scene>
              <span className="grid shrink-0 place-items-center" data-lobby-guide-meowni-wrap>
                <MeowniGuideMark size={172} />
              </span>
              <div className="max-w-[320px] border-l-2 border-primary/60 bg-background/58 px-4 py-3 text-sm leading-6 text-foreground shadow-[0_14px_30px_rgba(0,0,0,0.08)] backdrop-blur" data-lobby-guide-tip>
                <div className="mb-1 text-xs font-bold uppercase text-primary">Meowni 提醒</div>
                CLI Agent 可以在工位内运行；桌面端 Agent 可以先从工坊外部唤起，也可以帮你补好 CLI。
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 min-[980px]:grid-cols-3" data-lobby-guide-paths>
          <GuidePathCard
            id="has-agent"
            icon={<Terminal size={20} aria-hidden="true" />}
            asset={meowniGuideCommand}
            assetId="command"
            title="我已有 CLI Agent"
            body="你已经能在本机用命令启动 Claude Code、Codex CLI、Hermes 或其他 Agent。下一步是测试命令并保存到 Meowdesk。"
            action="去连接"
          />
          <GuidePathCard
            id="desktop-agent"
            icon={<Bot size={20} aria-hidden="true" />}
            asset={meowniGuideHelp}
            assetId="help"
            title="我只有桌面端 Agent"
            body="你可以先从工坊外部唤起桌面端；想让它进入工位内运行时，再让它帮你安装或定位 CLI 命令。"
            action="看提示词"
          />
          <GuidePathCard
            id="no-agent"
            icon={<BookOpen size={20} aria-hidden="true" />}
            asset={meowniGuideWarning}
            assetId="warning"
            title="我还没有 Agent"
            body="先选择一个适合自己的 Agent，再安装 CLI。教程会把官网、命令和检查步骤拆开。"
            action="从零开始"
          />
        </section>

        <CliSetupGuideSection />

        <GuideSection
          id="desktop-agent"
          title="只有桌面端 Agent：先从工坊接力"
          eyebrow="Path 02"
          steps={[
            ["先从工坊启动桌面端", "它会作为外部应用打开或聚焦，不会把窗口嵌入 Meowdesk。"],
            ["需要工位内运行时再补 CLI", "让桌面端协助安装 Codex CLI、Claude Code CLI 或其他命令行入口，并确认可执行路径。"],
            ["回 Agent 中心保存命令", "把桌面端给出的命令填进 Meowdesk Agent 中心，测试通过后保存为 CLI Agent。"]
          ]}
          action={(
            <Button type="button" variant="outline" size="sm" onClick={openStudio} data-lobby-desktop-agent-studio-link>
              <Bot size={13} aria-hidden="true" />
              去工坊启动桌面端
            </Button>
          )}
          note="可直接让桌面端 Agent 使用这句话：我现在可以先从 Meowdesk 工坊外部唤起你；如果我想让你在工位内运行，请帮我安装或定位你的 CLI 启动命令。"
        />

        <GuideSection
          id="no-agent"
          title="完全没有 Agent：先选一个入口"
          eyebrow="Path 03"
          steps={[
            ["选择 Agent", "后续教程会按 Codex、Claude Code、Hermes 等入口拆开。桌面端可先外部唤起；工位内运行需要 CLI。"],
            ["安装或定位 CLI", "安装方式以后要按最新官方文档写；这里先保留产品路径，不编造过期命令。"],
            ["完成第一次测试", "安装后回到 Agent 中心测试命令，测试通过再保存。"]
          ]}
          action={(
            <Button type="button" variant="outline" size="sm" onClick={openSettings} data-lobby-no-agent-settings-link>
              <Settings size={13} aria-hidden="true" />
              去 Agent 中心
            </Button>
          )}
        />
      </main>
    </div>
  );
}

function GuideSection({
  id,
  title,
  eyebrow,
  steps,
  action,
  note
}: {
  id: "has-agent" | "desktop-agent" | "no-agent";
  title: string;
  eyebrow: string;
  steps: Array<[string, string]>;
  action?: ReactNode;
  note?: string;
}) {
  return (
    <section className="scroll-mt-6 border-b border-border pb-10 last:border-b-0" data-lobby-guide-section={id}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-primary">{eyebrow}</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-5 grid gap-0 overflow-hidden rounded-lg border border-border bg-surface/70 shadow-[0_18px_46px_rgba(0,0,0,0.1)]">
        {steps.map(([stepTitle, copy], index) => (
          <div key={stepTitle} className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 min-[760px]:grid-cols-[48px_minmax(0,1fr)]">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-primary/25 bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <span>
              <strong className="block text-sm text-foreground">{stepTitle}</strong>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">{copy}</span>
            </span>
          </div>
        ))}
      </div>
      {note ? (
        <div className="mt-4 rounded-md border-2 border-primary/70 bg-background/80 px-4 py-3 text-sm leading-6 text-foreground" data-lobby-guide-note={id}>
          <span className="font-semibold text-primary">Meowni 建议：</span>{note}
        </div>
      ) : null}
    </section>
  );
}

function GuidePathCard({
  id,
  icon,
  asset,
  assetId,
  title,
  body,
  action
}: {
  id: "has-agent" | "desktop-agent" | "no-agent";
  icon: ReactNode;
  asset: string;
  assetId: string;
  title: string;
  body: string;
  action: string;
}) {
  return (
    <button
      type="button"
      className="group grid min-h-[190px] content-between gap-5 rounded-lg p-5 text-left"
      onClick={() => scrollStarterGuideSection(id)}
      data-lobby-guide-path-card={id}
    >
      <span>
        <span className="mb-4 flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
            {icon}
          </span>
          <img src={asset} alt="" className="h-20 max-w-[120px] object-contain" data-lobby-guide-card-asset={assetId} />
        </span>
        <strong className="block text-lg font-semibold tracking-normal text-foreground">{title}</strong>
        <span className="mt-3 block text-sm leading-6 text-muted-foreground">{body}</span>
      </span>
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        {action}
        <ArrowRight size={15} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

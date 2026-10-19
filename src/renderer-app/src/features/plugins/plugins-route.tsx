import { useEffect, useMemo, useState } from "react";
import { Boxes, Download, Heart, Package, RefreshCw, Star, Store } from "lucide-react";
import type { WorkbenchExtensionSummary, WorkbenchSummary } from "@/app/use-workbench-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { CapabilityGrid, DetailRow, LegacyHandoff, Metric, RouteFrame } from "../readiness/readiness-shared";

function extensionCount(extensions: WorkbenchExtensionSummary[], type: string) {
  return extensions.filter((item) => item.type === type).length;
}

export function PluginsRoute({ summary }: { summary: WorkbenchSummary }) {
  const sidebarCount = extensionCount(summary.workshopExtensions, "sidebar-widget");
  const pageCount = extensionCount(summary.workshopExtensions, "feature-page");
  const [selectedPluginId, setSelectedPluginId] = useState("");

  useEffect(() => {
    if (!summary.workshopExtensions.length) {
      setSelectedPluginId("");
      return;
    }
    setSelectedPluginId((current) => (
      summary.workshopExtensions.some((item) => item.id === current) ? current : summary.workshopExtensions[0].id
    ));
  }, [summary.workshopExtensions]);

  const selectedPlugin = useMemo(
    () => summary.workshopExtensions.find((item) => item.id === selectedPluginId) || summary.workshopExtensions[0],
    [selectedPluginId, summary.workshopExtensions]
  );

  return (
    <RouteFrame
      id="plugins"
      eyebrow="Plugins"
      title="插件广场"
      copy="插件广场按市场生态页组织：分类列表、作者、版本、简介、README 摘要和更新记录先恢复展示。"
      badge="marketplace"
    >
      <div className="grid gap-4 min-[1120px]:grid-cols-[minmax(0,0.9fr)_minmax(380px,0.75fr)]">
        <div className="grid content-start gap-4">
          <div className="grid gap-3 min-[900px]:grid-cols-3">
            <Metric icon={Boxes} label="右侧栏组件" value={String(sidebarCount)} />
            <Metric icon={Package} label="功能页" value={String(pageCount)} />
            <Metric icon={Store} label="已索引作品" value={String(summary.workshopExtensionCount ?? 0)} />
          </div>
          <Panel>
            <PanelHeader>
              <div>
                <div className="text-sm font-semibold">本机插件作品</div>
                <div className="text-xs text-muted-foreground">点击作品查看 manifest / runtime / entry 详情</div>
              </div>
              <Button variant="outline" size="sm" onClick={summary.refresh} disabled={summary.refreshing}>
                <RefreshCw className={cn(summary.refreshing && "animate-spin")} size={14} aria-hidden="true" />
                刷新
              </Button>
            </PanelHeader>
            <PanelBody>
              <div className="grid gap-3 min-[760px]:grid-cols-2" data-plugin-readiness-list>
                {summary.workshopExtensions.length ? summary.workshopExtensions.map((item) => (
                  <PluginMarketplaceListItem
                    key={item.id}
                    item={item}
                    selected={selectedPlugin?.id === item.id}
                    onSelect={() => setSelectedPluginId(item.id)}
                  />
                )) : (
                  <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">暂无本机插件作品。</div>
                )}
              </div>
            </PanelBody>
          </Panel>
        </div>
        <div className="grid content-start gap-3">
          <PluginDetailPanel item={selectedPlugin} authorName={summary.profile?.displayName || "Meowdesk 开发者"} />
          <CapabilityGrid
            items={[
              { label: "插件分类", state: "next", detail: "右侧栏组件、功能页和 Skill 入口在 next 中保持可达。" },
              { label: "作品详情", state: "next", detail: "详情面板展示状态、运行时、entry、path 和版本摘要。" },
              { label: "安装与启用", state: "handoff", detail: ".meow 导入导出仍在 Studio 安全子集内执行。" },
              { label: "右侧栏 iframe", state: "protected", detail: "iframe host、resize、theme 和 message bridge 不在 R1 接管。" }
            ]}
          />
          <LegacyHandoff id="sidebar-iframe" title="Right sidebar iframe boundary" detail="真实 widget 宿主仍归 protected runtime，next 只保入口和状态。" />
        </div>
      </div>
    </RouteFrame>
  );
}

function pluginCategoryLabel(item: WorkbenchExtensionSummary) {
  if (item.type === "sidebar-widget") return "右侧栏组件";
  if (item.type === "feature-page") return "功能页";
  if (item.type === "skill") return "Skill";
  return item.type || "作品";
}

function pluginMarketStats(item: WorkbenchExtensionSummary) {
  const seed = item.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    likes: 12 + (seed % 88),
    downloads: 40 + (seed % 360),
    rating: (4 + (seed % 9) / 10).toFixed(1),
    heat: seed % 3 === 0 ? "新作" : seed % 3 === 1 ? "热门" : "稳定"
  };
}

function PluginIcon({ item }: { item: WorkbenchExtensionSummary }) {
  return (
    <span className={cn(
      "grid h-10 w-10 shrink-0 place-items-center rounded-md border",
      item.type === "sidebar-widget" && "border-primary/35 bg-primary/10 text-primary",
      item.type === "feature-page" && "border-success/35 bg-success/10 text-success",
      item.type === "skill" && "border-warning/35 bg-warning/10 text-warning",
      !["sidebar-widget", "feature-page", "skill"].includes(item.type) && "border-border bg-background/55 text-muted-foreground"
    )}>
      <Package size={18} aria-hidden="true" />
    </span>
  );
}

function PluginMarketplaceListItem({
  item,
  selected,
  onSelect
}: {
  item: WorkbenchExtensionSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const stats = pluginMarketStats(item);
  return (
    <button
      type="button"
      className={cn(
        "grid min-h-44 content-between gap-3 rounded-md border border-border bg-background/55 p-3 text-left transition-colors hover:bg-accent",
        selected && "border-primary/45 bg-primary/10"
      )}
      data-plugin-readiness-item={item.id}
      data-r1-plugin-select={item.id}
      data-r1-plugin-selected={selected ? "true" : undefined}
      onClick={onSelect}
    >
      <span className="flex items-start justify-between gap-3">
        <PluginIcon item={item} />
        <Badge variant={item.status === "ready" ? "success" : item.status === "error" ? "danger" : "default"}>{stats.heat}</Badge>
      </span>
      <span className="min-w-0 self-start">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <strong className="truncate text-base font-semibold">{item.name}</strong>
          {item.version ? <em className="shrink-0 not-italic text-[11px] text-muted-foreground">v{item.version}</em> : null}
        </span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
          {item.summary || `${pluginCategoryLabel(item)} · ${item.runtime || "html"}`}
        </span>
      </span>
      <span className="grid gap-2 text-xs text-muted-foreground">
        <span className="flex flex-wrap items-center gap-2">
          <span>{pluginCategoryLabel(item)}</span>
          <span>{item.runtime || "html"}</span>
          {item.entry ? <span>{item.entry}</span> : null}
        </span>
        <span className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1"><Heart size={12} aria-hidden="true" />{stats.likes}</span>
          <span className="inline-flex items-center gap-1"><Download size={12} aria-hidden="true" />{stats.downloads}</span>
          <span className="inline-flex items-center gap-1"><Star size={12} aria-hidden="true" />{stats.rating}</span>
        </span>
      </span>
    </button>
  );
}

function PluginDetailPanel({ item, authorName }: { item?: WorkbenchExtensionSummary; authorName: string }) {
  const stats = item ? pluginMarketStats(item) : undefined;
  return (
    <Panel data-r1-plugin-detail data-r1-plugin-detail-id={item?.id || ""}>
      <PanelHeader>
        <div>
          <div className="text-sm font-semibold">作品详情</div>
          <div className="text-xs text-muted-foreground">{item ? `${pluginCategoryLabel(item)} · ${authorName}` : "等待选择作品"}</div>
        </div>
        {item ? <Badge variant={item.status === "error" ? "danger" : "primary"}>{item.status}</Badge> : <Badge>empty</Badge>}
      </PanelHeader>
      <PanelBody>
        {!item ? (
          <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
            当前 Meowdesk Home 没有可索引插件作品。
          </div>
        ) : (
          <div className="grid gap-3 text-xs">
            <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-md border border-border bg-background/55 p-3">
              <PluginIcon item={item} />
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold" data-r1-plugin-detail-name>{item.name}</div>
                <div className="mt-1 text-muted-foreground">作者：{authorName} · {pluginCategoryLabel(item)}</div>
                {stats ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-muted-foreground" data-r15-plugin-market-stats>
                    <span className="inline-flex items-center gap-1"><Heart size={12} aria-hidden="true" />获赞 {stats.likes}</span>
                    <span className="inline-flex items-center gap-1"><Download size={12} aria-hidden="true" />下载 {stats.downloads}</span>
                    <span className="inline-flex items-center gap-1"><Star size={12} aria-hidden="true" />评分 {stats.rating}</span>
                    <Badge>{stats.heat}</Badge>
                  </div>
                ) : null}
                {item.summary ? <p className="mt-2 line-clamp-3 leading-5 text-muted-foreground">{item.summary}</p> : null}
              </div>
            </div>
            {item.type === "sidebar-widget" ? <PluginSidebarPreview item={item} /> : null}
            <div className="grid gap-3 rounded-md border border-border bg-background/55 p-3">
              <div>
                <div className="text-sm font-semibold text-foreground">README</div>
                <p className="mt-1 leading-5 text-muted-foreground">{item.summary || "这个作品还没有写 README 摘要。"}</p>
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-semibold text-foreground">发布信息</div>
                <div className="grid gap-2">
                  <DetailRow label="ID" value={item.id} />
                  <DetailRow label="类型" value={pluginCategoryLabel(item)} />
                  <DetailRow label="版本" value={item.version || "-"} />
                  <DetailRow label="运行时" value={item.runtime || "-"} />
                  <DetailRow label="入口" value={item.entry || "-"} />
                </div>
              </div>
            </div>
            <div className="grid gap-2 rounded-md border border-border bg-background/55 p-3">
              <div className="text-sm font-semibold text-foreground">本机路径</div>
              <DetailRow label="路径" value={item.path || "-"} muted />
              <DetailRow label="EntryPath" value={item.entryPath || "-"} muted />
              <DetailRow label="Manifest" value={item.manifestPath || "-"} muted />
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function PluginSidebarPreview({ item }: { item: WorkbenchExtensionSummary }) {
  return (
    <div className="meowdesk-plugin-sidebar-preview" data-r2-plugin-sidebar-preview={item.id}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span>
          <strong className="block text-sm text-foreground">工作区右侧栏预览</strong>
          <span className="text-muted-foreground">workspace-sidebar · host chrome</span>
        </span>
        <Badge variant={item.status === "ready" ? "success" : item.status === "error" ? "danger" : "default"}>{item.status}</Badge>
      </div>
      <div className="meowdesk-plugin-sidebar-preview-frame" data-r2-plugin-sidebar-preview-frame={item.id}>
        <header className="meowdesk-workspace-widget-head">
          <strong>
            {item.name}
            <span>{item.entry || "entry pending"} · {item.runtime || "html"}</span>
          </strong>
          <span className="flex shrink-0 items-center gap-1.5" data-r2-plugin-sidebar-preview-status>
            <Badge>预览</Badge>
            <Badge variant="default">只读</Badge>
          </span>
        </header>
        <div className="meowdesk-workspace-widget-body">
          <div className="meowdesk-workspace-widget-frame">
            <div className="grid max-w-52 gap-2 text-center text-xs">
              <strong className="text-foreground">{item.summary || "右侧栏组件内容区"}</strong>
              <span className="text-muted-foreground">插件内容应贴合 Meowdesk 外框，而不是再套一层完整网页壳。</span>
            </div>
          </div>
        </div>
        <div className="meowdesk-workspace-widget-resizer" />
      </div>
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactElement } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XtermTerminal } from "@xterm/xterm";
import { Activity, Archive, ArrowLeft, Bot, Boxes, CheckCircle2, ChevronDown, ClipboardList, ExternalLink, FileCode2, FolderOpen, GalleryVerticalEnd, Info, Play, Plus, Power, Save, Settings, Terminal, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardActionMenu } from "@/components/ui/card-action-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LaunchEmptyState } from "@/components/ui/launch-empty-state";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fileUrlFromPath } from "@/lib/file-url";
import { cn } from "@/lib/utils";
import {
  createWorkshopProject,
  exportMeowPackage,
  hasWorkbenchApi,
  importMeowPackage,
  markWorkshopProjectReady,
  optionalWorkbenchApi,
} from "@/lib/workbench-api";
import type { WorkbenchAgentToolSummary, WorkbenchExtensionSummary, WorkbenchSummary } from "@/app/use-workbench-summary";
import type { TerminalSourceEvent, WorkshopImportMeowPackagePayload, WorkshopPublishDraftPayload } from "@/lib/workbench-api";
import {
  workspaceRendererNormalizeUserText,
  workspaceRendererParseSourceSnapshot
} from "../meow-viewer/meow-viewer-parser";
import { workspaceRendererProfileForPane } from "../meow-viewer/meow-viewer-contract";
import {
  workspaceRendererDisplayTranscriptWithStatusPreview,
  workspaceRendererDedupeSourceEvents,
  workspaceRendererMergeStatusPreview,
  workspaceRendererStatusPreviewFromTerminalData,
  workspaceTerminalTranscript
} from "../meow-viewer/meow-viewer-source";
import type { WorkspaceTerminalStatus } from "../workspace/workspace-model";
import { WorkspaceRenderedConversation, WorkspaceRendererStatusPanel } from "../meow-viewer/meow-viewer-conversation";
import { MeowViewerComposer } from "../meow-viewer/meow-viewer-composer";
import {
  attachAgentRuntimeData,
  attachAgentRuntimeExit,
  createAgentRuntimeOwnership,
  detachAgentRuntime,
  listAgentRuntimes,
  reattachAgentRuntime,
  resizeAgentRuntime,
  setAgentRuntimeSourceAdapter,
  startAgentRuntime,
  stopAgentRuntime,
  writeAgentRuntime
} from "../agent-runtime/agent-runtime-manager";
import type { OwnershipScope } from "@/lib/identity";
import { WorkspaceRightSidebarOwner } from "../workspace/workspace-right-sidebar-owner";
import type {
  WorkspaceRenderedSegment,
  WorkspaceRendererPermissionPrompt,
  WorkspaceRendererProfile,
  WorkspaceRendererSourceEvent,
  WorkspaceRendererStatusItem,
  WorkspaceTerminalUserTurn
} from "../meow-viewer/meow-viewer-contract";
import {
  initialProjectDrafts,
  hydrateStudioModelStorage,
  readStudioEnabledFeaturePageIds,
  readStudioEnabledSidebarWidgetIds,
  readStudioProjectExportRecords,
  readStudioProjectPublishDrafts,
  readStudioProjectPublishRecords,
  readStudioRemovedWorkshopProjectIds,
  studioRemovedWorkshopProjectsChangedEvent,
  studioWorkshopTarget,
  workshopRuntimeForType,
  writeStudioEnabledFeaturePageIds,
  writeStudioEnabledSidebarWidgetIds,
  writeStudioProjectExportRecords,
  writeStudioProjectPublishDraft,
  writeStudioProjectPublishRecords,
  writeStudioRemovedWorkshopProjectIds,
  type ProjectDraft,
  type ProjectDraftType,
  type ProjectState,
  type ProjectType,
  type StudioAgentStatus,
  type StudioInspectorTab,
  type StudioPage,
  type StudioPendingOperation,
  type StudioProjectExportRecord,
  type StudioProjectInstallTestRecord,
  type StudioProjectPublishDraft,
  type StudioProjectPublishRecord
} from "./studio-model";

export type { StudioInspectorTab, StudioPage } from "./studio-model";

const projectTypes: Array<{ id: ProjectType; label: string }> = [
  { id: "feature-page", label: "功能页" },
  { id: "sidebar-widget", label: "右侧栏组件" }
];

const studioWorkshopTypes: Array<{ id: ProjectType; label: string; copy: string; icon: typeof GalleryVerticalEnd }> = [
  { id: "feature-page", label: "功能页", copy: "进入主导航的完整页面", icon: GalleryVerticalEnd },
  { id: "sidebar-widget", label: "右侧栏组件", copy: "挂载到工作区侧栏的小工具", icon: Boxes }
];

export const studioInspectorTabs: Array<{ id: StudioInspectorTab; label: string; icon: typeof Boxes }> = [
  { id: "types", label: "类型", icon: Boxes },
  { id: "projects", label: "作品", icon: GalleryVerticalEnd },
  { id: "detail", label: "详情", icon: Info },
  { id: "runtime", label: "运行时", icon: Activity }
];

type StudioRouteProps = {
  summary: WorkbenchSummary;
  studioPage: StudioPage;
  onStudioPageChange: (page: StudioPage) => void;
  inspectorOpen: boolean;
  inspectorTab: StudioInspectorTab;
  onInspectorOpenChange: (open: boolean) => void;
  onInspectorTabChange: (tab: StudioInspectorTab) => void;
};

export function StudioRoute({
  summary,
  studioPage,
  onStudioPageChange,
  inspectorOpen,
  inspectorTab,
  onInspectorOpenChange,
  onInspectorTabChange
}: StudioRouteProps) {
  const [drafts, setDrafts] = useState<ProjectDraft[]>(initialProjectDrafts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<ProjectType>("feature-page");
  const [markReady, setMarkReady] = useState(false);
  const [readyProjectIds, setReadyProjectIds] = useState<Set<string>>(() => new Set());
  const [removedProjectIds, setRemovedProjectIds] = useState<Set<string>>(() => new Set(readStudioRemovedWorkshopProjectIds()));
  const [projectPendingRemoval, setProjectPendingRemoval] = useState<ProjectDraft | null>(null);
  const [exportRecords, setExportRecords] = useState<Record<string, StudioProjectExportRecord>>(() => readStudioProjectExportRecords());
  const [publishRecords, setPublishRecords] = useState<Record<string, StudioProjectPublishRecord>>(() => readStudioProjectPublishRecords());
  const [workspaceExtensionStateRevision, setWorkspaceExtensionStateRevision] = useState(0);
  const [pendingProjectId, setPendingProjectId] = useState("");
  const [pendingOperation, setPendingOperation] = useState<StudioPendingOperation>("");
  const [operationStatus, setOperationStatus] = useState("");
  const [lastPackagePath, setLastPackagePath] = useState("");
  const [selectedRealProjectId, setSelectedRealProjectId] = useState("");
  const [workshopType, setWorkshopType] = useState<ProjectType>("feature-page");
  const visibleWorkshopExtensions = useMemo(
    () => summary.workshopExtensions.filter((item) => !removedProjectIds.has(item.id)),
    [removedProjectIds, summary.workshopExtensions]
  );
  const realProjects = useMemo(
    () => visibleWorkshopExtensions.map((item) => realExtensionToProject(item, readyProjectIds.has(item.id))),
    [readyProjectIds, visibleWorkshopExtensions]
  );
  const visibleProjects = useMemo(() => [...drafts, ...realProjects], [drafts, realProjects]);
  const readyDrafts = useMemo(() => visibleProjects.filter((item) => item.state === "ready"), [visibleProjects]);
  const selectedRealProject = useMemo(() => {
    const selected = visibleWorkshopExtensions.find((item) => item.id === selectedRealProjectId) || visibleWorkshopExtensions[0];
    if (!selected) return undefined;
    return readyProjectIds.has(selected.id) ? { ...selected, status: "ready" } : selected;
  }, [readyProjectIds, selectedRealProjectId, visibleWorkshopExtensions]);

  useEffect(() => {
    if (!visibleWorkshopExtensions.length) {
      setSelectedRealProjectId("");
      return;
    }
    setSelectedRealProjectId((current) => (
      visibleWorkshopExtensions.some((item) => item.id === current) ? current : visibleWorkshopExtensions[0].id
    ));
  }, [visibleWorkshopExtensions]);

  useEffect(() => {
    const refresh = () => {
      setRemovedProjectIds(new Set(readStudioRemovedWorkshopProjectIds()));
      setExportRecords(readStudioProjectExportRecords());
      setPublishRecords(readStudioProjectPublishRecords());
      setWorkspaceExtensionStateRevision((current) => current + 1);
    };
    const disposeHydration = hydrateStudioModelStorage(refresh);
    window.addEventListener("meowdesk:workspace-toggle-sidebar-widget", refresh);
    window.addEventListener("meowdesk:workspace-toggle-feature-page", refresh);
    window.addEventListener(studioRemovedWorkshopProjectsChangedEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      disposeHydration();
      window.removeEventListener("meowdesk:workspace-toggle-sidebar-widget", refresh);
      window.removeEventListener("meowdesk:workspace-toggle-feature-page", refresh);
      window.removeEventListener(studioRemovedWorkshopProjectsChangedEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    setDrafts((current) => [
      { name, type: draftType, state: markReady ? "ready" : "draft" },
      ...current
    ]);
    setDraftName("");
    setDraftType("feature-page");
    setMarkReady(false);
    setDialogOpen(false);
  }

  async function createRealProject() {
    const name = draftName.trim();
    if (!name) {
      setOperationStatus("先输入工程名称。");
      return;
    }
    if (!hasWorkbenchApi()) {
      setOperationStatus("当前环境还不能创建真实工坊工程。");
      return;
    }
    setPendingOperation("create");
    setOperationStatus("");
    setLastPackagePath("");
    try {
      const result = await createWorkshopProject({ name, type: draftType, folderName: name });
      setSelectedRealProjectId(result.project.id);
      summary.refresh();
      setDraftName("");
      setDraftType("feature-page");
      setMarkReady(false);
      setDialogOpen(false);
      setOperationStatus(`已创建「${result.project.name}」本机工程，等待 Agent 写入入口文件。`);
    } catch (error) {
      setOperationStatus(`创建失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPendingOperation("");
    }
  }

  async function importPackage(payload: WorkshopImportMeowPackagePayload = {}) {
    if (!hasWorkbenchApi()) {
      setOperationStatus("当前环境还不能安装 .meow 成品包。");
      return;
    }
    setPendingOperation("import");
    setPendingProjectId("");
    setOperationStatus("");
    setLastPackagePath("");
    try {
      const result = await importMeowPackage(payload);
      if (!result.ok) {
        setOperationStatus("已取消安装 .meow。");
        return;
      }
      setSelectedRealProjectId(result.project.id);
      summary.refresh();
      setOperationStatus(`已安装「${result.project.name || result.package?.name || "Meow 包"}」。`);
    } catch (error) {
      setOperationStatus(`安装失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPendingOperation("");
    }
  }

  async function markRealProjectReady(item: ProjectDraft) {
    if (!hasWorkbenchApi() || !item.id) {
      setOperationStatus("当前环境还不能标记真实工坊项目。");
      return;
    }
    const projectId = item.id;
    setPendingProjectId(projectId);
    setPendingOperation("mark-ready");
    setOperationStatus("");
    setLastPackagePath("");
    try {
      const result = await markWorkshopProjectReady({ id: projectId });
      setReadyProjectIds((current) => new Set(current).add(result.id));
      summary.refresh();
      setOperationStatus(`「${result.name || item.name}」已标记为可用。`);
    } catch (error) {
      setOperationStatus(`标记失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPendingProjectId("");
      setPendingOperation("");
    }
  }

  async function exportRealProjectPackage(item: ProjectDraft) {
    if (!hasWorkbenchApi() || !item.id) {
      setOperationStatus("当前环境还不能生成 .meow 成品包。");
      return;
    }
    const projectId = item.id;
    setPendingProjectId(projectId);
    setPendingOperation("export");
    setOperationStatus("");
    setLastPackagePath("");
    try {
      const result = await exportMeowPackage({ id: projectId });
      setLastPackagePath(result.packagePath);
      setExportRecords((current) => {
        const next = {
          ...current,
          [projectId]: {
            packagePath: result.packagePath,
            exportedAt: Date.now()
          }
        };
        writeStudioProjectExportRecords(next);
        return next;
      });
      setOperationStatus(`已生成「${result.package?.name || item.name}」.meow 成品包。`);
    } catch (error) {
      setOperationStatus(`生成 .meow 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPendingProjectId("");
      setPendingOperation("");
    }
  }

  async function runLocalPublishTest(item: WorkbenchExtensionSummary, draft: StudioProjectPublishDraft) {
    if (!hasWorkbenchApi() || !item.id) {
      setOperationStatus("当前环境还不能运行本地发布测试。");
      return;
    }
    const checks = projectPublishCheckMap(item);
    if (!Object.values(checks).every(Boolean)) {
      setOperationStatus("发布前检查未通过：请先补齐 manifest、入口、类型和预览条件。");
      return;
    }
    const projectId = item.id;
    setPendingProjectId(projectId);
    setPendingOperation("publish");
    setOperationStatus("");
    setLastPackagePath("");
    const publishDraft: WorkshopPublishDraftPayload = {
      title: draft.title.trim() || item.name,
      summary: draft.summary.trim(),
      changelog: draft.changelog.trim(),
      version: draft.version.trim() || item.version || "0.1.0"
    };
    try {
      const result = await exportMeowPackage({ id: projectId, publish: publishDraft });
      setLastPackagePath(result.packagePath);
      setExportRecords((current) => {
        const next = {
          ...current,
          [projectId]: {
            packagePath: result.packagePath,
            exportedAt: Date.now()
          }
        };
        writeStudioProjectExportRecords(next);
        return next;
      });
      const record: StudioProjectPublishRecord = {
        title: publishDraft.title || item.name,
        summary: publishDraft.summary || "",
        changelog: publishDraft.changelog || "",
        version: publishDraft.version || item.version || "0.1.0",
        type: item.type,
        packagePath: result.packagePath,
        publishedAt: Date.now(),
        checks
      };
      setPublishRecords((current) => {
        const next = { ...current, [projectId]: record };
        writeStudioProjectPublishRecords(next);
        return next;
      });
      setOperationStatus(`已完成「${record.title}」本地发布测试，生成 .meow 成品包。`);
    } catch (error) {
      setOperationStatus(`发布测试失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPendingProjectId("");
      setPendingOperation("");
    }
  }

  async function runLocalInstallTest(item: WorkbenchExtensionSummary) {
    if (!hasWorkbenchApi() || !item.id) {
      setOperationStatus("当前环境还不能运行安装测试。");
      return;
    }
    const publishRecord = publishRecords[item.id];
    const packagePath = publishRecord?.packagePath || exportRecords[item.id]?.packagePath || "";
    if (!packagePath) {
      setOperationStatus("请先完成本地发布测试并生成 .meow 包。");
      return;
    }
    setPendingProjectId(item.id);
    setPendingOperation("install-test");
    setOperationStatus("");
    try {
      const dryRun = await importMeowPackage({ packagePath, dryRun: true });
      if (!dryRun.ok) {
        setOperationStatus("安装测试已取消。");
        return;
      }
      const result = await importMeowPackage({ packagePath, testInstall: true });
      if (!result.ok) {
        setOperationStatus("安装测试已取消。");
        return;
      }
      const installTest: StudioProjectInstallTestRecord = {
        testedAt: Date.now(),
        packagePath,
        installMode: dryRun.installMode || result.installMode || "new-install",
        testInstallPath: result.project.path || "",
        existingProjectName: dryRun.existingProject?.name
      };
      setPublishRecords((current) => {
        const base = current[item.id] || {
          title: item.name,
          summary: item.summary || "",
          changelog: "",
          version: item.version || "0.1.0",
          type: item.type,
          packagePath,
          publishedAt: Date.now(),
          checks: projectPublishCheckMap(item)
        };
        const next = { ...current, [item.id]: { ...base, installTest } };
        writeStudioProjectPublishRecords(next);
        return next;
      });
      const updateHint = installTest.existingProjectName ? "；正式安装会进入更新/覆盖确认" : "";
      setOperationStatus(`安装测试通过，已解包到隔离测试目录${updateHint}。`);
    } catch (error) {
      setOperationStatus(`安装测试失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPendingProjectId("");
      setPendingOperation("");
    }
  }

  function confirmRemoveProject(item: ProjectDraft) {
    setProjectPendingRemoval(item);
  }

  function restoreRemovedProjects() {
    if (!removedProjectIds.size) return;
    setRemovedProjectIds(new Set());
    writeStudioRemovedWorkshopProjectIds([]);
    summary.refresh();
    setOperationStatus("已恢复从作品管理移除的本机作品。");
  }

  function removeProject(item: ProjectDraft) {
    if (item.source === "real" && item.id) {
      const next = new Set(removedProjectIds);
      next.add(item.id);
      setRemovedProjectIds(next);
      writeStudioRemovedWorkshopProjectIds([...next]);
      if (selectedRealProjectId === item.id) {
        const nextSelected = visibleWorkshopExtensions.find((project) => project.id !== item.id);
        setSelectedRealProjectId(nextSelected?.id || "");
      }
      setOperationStatus(`已从作品管理移除「${item.name}」。本机目录没有删除。`);
      setProjectPendingRemoval(null);
      return;
    }

    setDrafts((current) => current.filter((draft) => {
      if (draft.id && item.id) return draft.id !== item.id;
      return !(draft.name === item.name && draft.type === item.type && draft.state === item.state);
    }));
    setOperationStatus(`已删除草稿「${item.name}」。`);
    setProjectPendingRemoval(null);
  }

  async function openProjectFolder(item: ProjectDraft) {
    if (!item.path) {
      setOperationStatus("当前作品没有可打开的本机目录。");
      return;
    }
    try {
      await optionalWorkbenchApi()?.openPath(item.path);
      setOperationStatus(`已打开「${item.name}」本机目录。`);
    } catch (error) {
      setOperationStatus(`打开目录失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function openProjectPublishPage(item: ProjectDraft | WorkbenchExtensionSummary) {
    if (!item.id) {
      setOperationStatus("只有本机作品可以进入发布页。");
      return;
    }
    setSelectedRealProjectId(item.id);
    onStudioPageChange("publish");
    onInspectorTabChange("detail");
  }

  useEffect(() => {
    const handleNewDraft = () => setDialogOpen(true);
    const handleImport = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === "object" ? event.detail : {};
      const packagePath = "packagePath" in detail && typeof detail.packagePath === "string" ? detail.packagePath : undefined;
      void importPackage(packagePath ? { packagePath } : {});
    };

    window.addEventListener("meowdesk:studio-new-draft", handleNewDraft);
    window.addEventListener("meowdesk:studio-import", handleImport);
    return () => {
      window.removeEventListener("meowdesk:studio-new-draft", handleNewDraft);
      window.removeEventListener("meowdesk:studio-import", handleImport);
    };
  });

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden" data-studio-route data-studio-project-state-revision={workspaceExtensionStateRevision}>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form className="grid gap-4" onSubmit={createDraft}>
            <DialogHeader>
              <DialogTitle>新建作品草稿</DialogTitle>
              <DialogDescription>本地草稿用于快速占位；本机工程会写入 Meowdesk Home，等待 Agent 继续开发。</DialogDescription>
            </DialogHeader>

            <label className="grid gap-2">
              <span className="text-xs font-medium text-muted-foreground">作品名称</span>
              <Input
                data-studio-draft-name
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="例如：会议纪要右侧栏"
                maxLength={32}
              />
            </label>

            <div className="grid gap-2">
              <span className="text-xs font-medium text-muted-foreground">作品类型</span>
              <div className="grid grid-cols-2 gap-2">
                {projectTypes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-studio-draft-type={item.id}
                    onClick={() => setDraftType(item.id)}
                    className={cn(
                      "h-9 rounded-md border border-border bg-background/60 px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      draftType === item.id && "border-primary/50 bg-primary/10 text-primary"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/55 px-3 py-2">
              <span>
                <span className="block text-sm font-medium">标记为可发布</span>
                <span className="mt-1 block text-xs text-muted-foreground">只影响当前样板页内的草稿状态。</span>
              </span>
              <Switch data-studio-draft-ready checked={markReady} onCheckedChange={setMarkReady} />
            </label>

            <DialogFooter>
              <Button
                data-studio-create-real-project
                type="button"
                variant="outline"
                onClick={createRealProject}
                disabled={!draftName.trim() || !hasWorkbenchApi() || pendingOperation === "create"}
              >
                {pendingOperation === "create" ? "创建中" : "创建本机工程"}
              </Button>
              <Button data-studio-create-draft type="submit" disabled={!draftName.trim()}>
                创建草稿
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(projectPendingRemoval)} onOpenChange={(open) => {
        if (!open) setProjectPendingRemoval(null);
      }}>
        <DialogContent className="w-[min(440px,calc(100vw-32px))]" data-studio-remove-project-dialog>
          <DialogHeader>
            <DialogTitle>{projectPendingRemoval?.source === "real" ? "移除本机作品？" : "删除草稿？"}</DialogTitle>
            <DialogDescription>
              {projectPendingRemoval?.source === "real"
                ? "当前不会删除本机工程目录，只会从 Meowdesk 作品管理列表中移除。"
                : "会从当前工坊样板列表中删除这个草稿。"}
            </DialogDescription>
          </DialogHeader>
          {projectPendingRemoval ? (
            <div className="rounded-md border border-border bg-background/55 px-3 py-2 text-sm" data-studio-remove-project-name>
              {projectPendingRemoval.name}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setProjectPendingRemoval(null)} data-studio-remove-project-cancel>
              取消
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-danger hover:text-danger"
              onClick={() => {
                if (projectPendingRemoval) removeProject(projectPendingRemoval);
              }}
              data-studio-remove-project-confirm
            >
              {projectPendingRemoval?.source === "real" ? "移除" : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {studioPage === "manage" ? (
        <WorkshopManagementPage
          visibleProjects={visibleProjects}
          readyProjects={readyDrafts}
          selectedProjectId={selectedRealProjectId}
          pendingProjectId={pendingProjectId}
          pendingOperation={pendingOperation}
          exportRecords={exportRecords}
          removedProjectCount={removedProjectIds.size}
          onMarkReady={markRealProjectReady}
          onExportMeow={exportRealProjectPackage}
          onRemoveProject={confirmRemoveProject}
          onOpenProjectFolder={(item) => void openProjectFolder(item)}
          onRestoreRemovedProjects={restoreRemovedProjects}
          onOpenPublishPage={openProjectPublishPage}
          onContinueProject={(item) => {
            if (item.id) setSelectedRealProjectId(item.id);
            onStudioPageChange("make");
            onInspectorTabChange("detail");
            onInspectorOpenChange(true);
          }}
        />
      ) : studioPage === "publish" ? (
        <WorkshopPublishPage
          item={selectedRealProject}
          pendingProjectId={pendingProjectId}
          pendingOperation={pendingOperation}
          exportRecord={selectedRealProject ? exportRecords[selectedRealProject.id] : undefined}
          publishRecord={selectedRealProject ? publishRecords[selectedRealProject.id] : undefined}
          operationStatus={operationStatus}
          lastPackagePath={lastPackagePath}
          onBackToManage={() => onStudioPageChange("manage")}
          onBackToDetail={() => {
            onStudioPageChange("make");
            onInspectorTabChange("detail");
            onInspectorOpenChange(true);
          }}
          onRunPublishTest={(item, draft) => void runLocalPublishTest(item, draft)}
          onRunInstallTest={(item) => void runLocalInstallTest(item)}
        />
      ) : (
        <div
          className={cn(
            "meowdesk-studio-make-layout flex min-h-0 flex-1 items-stretch overflow-auto min-[1180px]:overflow-hidden"
          )}
          data-studio-make-layout
          data-studio-inspector-open={inspectorOpen ? "true" : "false"}
        >
          <AgentRuntimeStage summary={summary} workshopType={workshopType} selectedProject={selectedRealProject} />

          <WorkspaceRightSidebarOwner
            page="studio"
            collapsed={!inspectorOpen}
            width={340}
            className="meowdesk-studio-inspector-owner"
            data-studio-right-sidebar-owner
          >
            <StudioInspector
              layout="side"
              open={inspectorOpen}
              tab={inspectorTab}
              onTabChange={onInspectorTabChange}
              onClose={() => onInspectorOpenChange(false)}
              onOpen={() => onInspectorOpenChange(true)}
              summary={summary}
              realProjectCount={realProjects.length}
              operationStatus={operationStatus}
              lastPackagePath={lastPackagePath}
              visibleProjects={visibleProjects}
              readyProjects={readyDrafts}
              selectedProjectId={selectedRealProjectId}
              selectedProject={selectedRealProject}
              workshopType={workshopType}
              pendingProjectId={pendingProjectId}
              pendingOperation={pendingOperation}
              exportRecords={exportRecords}
              publishRecords={publishRecords}
              onWorkshopTypeChange={setWorkshopType}
              onMarkReady={markRealProjectReady}
              onExportMeow={exportRealProjectPackage}
              onRemoveProject={confirmRemoveProject}
              onOpenProjectFolder={(item) => void openProjectFolder(item)}
              onOpenPublishPage={openProjectPublishPage}
              onContinueProject={(item) => {
                if (item.id) setSelectedRealProjectId(item.id);
                onStudioPageChange("make");
                onInspectorTabChange("detail");
                onInspectorOpenChange(true);
                setOperationStatus(`已选择「${item.name}」，工坊 Agent 会优先继续这个作品。`);
              }}
              onSelectProject={(item) => {
                if (!item.id) return;
                setSelectedRealProjectId(item.id);
                onInspectorTabChange("detail");
              }}
            />
          </WorkspaceRightSidebarOwner>
        </div>
      )}
    </div>
  );
}

function WorkshopManagementPage({
  visibleProjects,
  readyProjects,
  selectedProjectId,
  pendingProjectId,
  pendingOperation,
  exportRecords,
  removedProjectCount,
  onMarkReady,
  onExportMeow,
  onRemoveProject,
  onOpenProjectFolder,
  onRestoreRemovedProjects,
  onOpenPublishPage,
  onContinueProject
}: {
  visibleProjects: ProjectDraft[];
  readyProjects: ProjectDraft[];
  selectedProjectId: string;
  pendingProjectId: string;
  pendingOperation: StudioPendingOperation;
  exportRecords: Record<string, StudioProjectExportRecord>;
  removedProjectCount: number;
  onMarkReady: (item: ProjectDraft) => void;
  onExportMeow: (item: ProjectDraft) => void;
  onRemoveProject: (item: ProjectDraft) => void;
  onOpenProjectFolder: (item: ProjectDraft) => void;
  onRestoreRemovedProjects: () => void;
  onOpenPublishPage: (item: ProjectDraft) => void;
  onContinueProject: (item: ProjectDraft) => void;
}) {
  const [filter, setFilter] = useState<"in-progress" | "published">("in-progress");
  const [typeFilter, setTypeFilter] = useState<"all" | ProjectType>("all");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const inProgressProjects = visibleProjects.filter((item) => item.state !== "ready" && item.state !== "error");
  const errorProjects = visibleProjects.filter((item) => item.state === "error");
  const baseProjects = filter === "published" ? readyProjects : inProgressProjects;
  const filteredProjects = typeFilter === "all" ? baseProjects : baseProjects.filter((item) => item.type === typeFilter);
  const sidebarProjectCount = visibleProjects.filter((item) => item.type === "sidebar-widget").length;
  const featurePageProjectCount = visibleProjects.filter((item) => item.type === "feature-page").length;
  const typeFilterLabel = typeFilter === "sidebar-widget" ? "右侧栏组件" : typeFilter === "feature-page" ? "功能页" : "全部类型";
  const typeOptions: Array<{ id: "all" | ProjectType; label: string; count: number }> = [
    { id: "all", label: "全部类型", count: visibleProjects.length },
    { id: "sidebar-widget", label: "右侧栏组件", count: sidebarProjectCount },
    { id: "feature-page", label: "功能页", count: featurePageProjectCount }
  ];
  return (
    <div className="min-h-0 flex-1 overflow-hidden" data-studio-workshop-management>
      <Panel className="h-full min-h-0 overflow-hidden">
        <PanelBody className="min-h-0 overflow-hidden p-0">
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3">
              <div className="flex flex-wrap items-center gap-2" data-studio-management-toolbar>
                <Button
                  type="button"
                  size="sm"
                  variant={filter === "in-progress" ? "primary" : "outline"}
                  data-studio-project-bucket="in-progress"
                  data-studio-project-bucket-active={filter === "in-progress" ? "true" : undefined}
                  onClick={() => setFilter("in-progress")}
                >
                  制作中
                  <Badge>{inProgressProjects.length}</Badge>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filter === "published" ? "primary" : "outline"}
                  data-studio-project-bucket="published"
                  data-studio-project-bucket-active={filter === "published" ? "true" : undefined}
                  onClick={() => setFilter("published")}
                >
                  已发布
                  <Badge variant="success">{readyProjects.length}</Badge>
                </Button>
                {errorProjects.length ? <Badge variant="danger" data-studio-project-bucket="error">异常 {errorProjects.length}</Badge> : null}
                {removedProjectCount ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-studio-restore-removed-projects
                    onClick={onRestoreRemovedProjects}
                  >
                    已移除
                    <Badge>{removedProjectCount}</Badge>
                    恢复
                  </Button>
                ) : null}
                <div className="relative ml-auto" data-studio-project-type-filter>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-studio-project-type-filter-button
                    data-studio-project-type-filter-value={typeFilter}
                    aria-expanded={typeMenuOpen}
                    onClick={() => setTypeMenuOpen((open) => !open)}
                  >
                    类型：{typeFilterLabel}
                    <ChevronDown size={14} aria-hidden="true" />
                  </Button>
                  {typeMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+6px)] z-20 grid w-44 gap-1 rounded-md border border-border bg-surface p-1 shadow-lg" data-studio-project-type-filter-menu>
                      {typeOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={cn(
                            "flex h-8 items-center justify-between gap-2 rounded px-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground",
                            typeFilter === option.id && "bg-accent text-foreground"
                          )}
                          data-studio-project-type-filter-option={option.id}
                          data-studio-project-type-filter-option-active={typeFilter === option.id ? "true" : undefined}
                          onClick={() => {
                            setTypeFilter(option.id);
                            setTypeMenuOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          <Badge>{option.count}</Badge>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="min-h-0 overflow-y-auto pr-1" data-studio-management-project-feed>
                <ProjectList
                  layout="management"
                  items={filteredProjects}
                  empty={typeFilter === "all" ? (filter === "published" ? "暂无可发布作品" : "暂无制作中作品") : `暂无${typeFilterLabel}作品`}
                  onMarkReady={onMarkReady}
                  onExportMeow={onExportMeow}
                  onRemoveProject={onRemoveProject}
                  onOpenProjectFolder={onOpenProjectFolder}
                  onOpenPublishPage={onOpenPublishPage}
                  onSelectRealProject={onContinueProject}
                  exportRecords={exportRecords}
                  selectLabel="继续开发"
                  pendingProjectId={pendingProjectId}
                  pendingOperation={pendingOperation}
                  selectedProjectId={selectedProjectId}
                />
              </div>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}

function WorkshopPublishPage({
  item,
  pendingProjectId,
  pendingOperation,
  exportRecord,
  publishRecord,
  operationStatus,
  lastPackagePath,
  onBackToManage,
  onBackToDetail,
  onRunPublishTest,
  onRunInstallTest
}: {
  item?: WorkbenchExtensionSummary;
  pendingProjectId: string;
  pendingOperation: StudioPendingOperation;
  exportRecord?: StudioProjectExportRecord;
  publishRecord?: StudioProjectPublishRecord;
  operationStatus: string;
  lastPackagePath: string;
  onBackToManage: () => void;
  onBackToDetail: () => void;
  onRunPublishTest: (item: WorkbenchExtensionSummary, draft: StudioProjectPublishDraft) => void;
  onRunInstallTest: (item: WorkbenchExtensionSummary) => void;
}) {
  const checks = item ? projectPublishChecks(item) : [];
  const readyCount = checks.filter((check) => check.ready).length;

  return (
    <div className="min-h-0 flex-1 overflow-hidden" data-studio-workshop-publish-page>
      <Panel className="h-full min-h-0 overflow-hidden">
        <PanelBody className="h-full min-h-0 overflow-hidden p-0">
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3" data-studio-publish-header>
              <div className="flex min-w-0 items-center gap-3">
                <Button type="button" size="sm" variant="outline" onClick={onBackToManage} data-studio-publish-back-manage>
                  <ArrowLeft size={14} aria-hidden="true" />
                  作品管理
                </Button>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">作品发布编辑</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {item ? item.name : "先从作品管理选择一个本机作品"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item ? <Badge>{studioProjectTypeLabel(item.type as ProjectDraftType)}</Badge> : null}
                {item ? <Badge variant={readyCount === checks.length ? "success" : item.error ? "danger" : "warning"}>{readyCount}/{checks.length}</Badge> : null}
                <Button type="button" size="sm" variant="outline" onClick={onBackToDetail} disabled={!item} data-studio-publish-back-detail>
                  详情
                </Button>
              </div>
            </div>

            {!item ? (
              <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                暂无可发布本机作品。返回作品管理后选择作品，再进入发布编辑页。
              </div>
            ) : (
              <div className="min-h-0 overflow-y-auto pr-1" data-studio-project-publish-page={item.id}>
                <div className="grid gap-3 min-[1180px]:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
                  <ProjectPublishDraftPanel
                    item={item}
                    pendingProjectId={pendingProjectId}
                    pendingOperation={pendingOperation}
                    publishRecord={publishRecord}
                    onRunPublishTest={onRunPublishTest}
                    onRunInstallTest={onRunInstallTest}
                  />

                  <div className="grid content-start gap-3" data-studio-publish-side-summary={item.id}>
                    {operationStatus ? (
                      <div
                        className="rounded-md border border-border bg-background/55 px-3 py-2 text-xs leading-5 text-muted-foreground"
                        data-studio-operation-status
                        data-studio-last-package-path={lastPackagePath || undefined}
                      >
                        {operationStatus}
                        {lastPackagePath ? <div className="mt-1 break-all">{lastPackagePath}</div> : null}
                      </div>
                    ) : null}
                    <div className="grid gap-2 rounded-md border border-border bg-background/55 p-3 text-xs" data-studio-project-publish-target={item.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">发布对象</span>
                        <Badge variant={item.error ? "danger" : "default"}>{item.status}</Badge>
                      </div>
                      <DetailRow label="ID" value={item.id} />
                      <DetailRow label="类型" value={studioProjectTypeLabel(item.type as ProjectDraftType)} />
                      <DetailRow label="版本" value={item.version || "-"} />
                      <DetailRow label="入口" value={item.entry || "-"} />
                      <DetailRow label="路径" value={item.path || "-"} muted />
                    </div>
                    <div className="grid gap-2 rounded-md border border-border bg-background/55 p-3 text-xs" data-studio-project-publish-readiness={item.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">发布前状态</span>
                        <Badge variant={readyCount === checks.length ? "success" : "warning"}>{readyCount}/{checks.length}</Badge>
                      </div>
                      {checks.map((check) => (
                        <div key={check.id} className="flex items-center justify-between gap-2 rounded border border-border bg-surface/60 px-2 py-1.5">
                          <span>{check.label}</span>
                          <span className="min-w-0 truncate text-muted-foreground">{check.detail}</span>
                        </div>
                      ))}
                    </div>
                    {exportRecord ? (
                      <div className="rounded-md border border-border bg-background/55 px-3 py-2 text-xs text-muted-foreground" data-studio-project-publish-export-record={item.id}>
                        最近导出：{new Date(exportRecord.exportedAt).toLocaleString()}
                        <div className="mt-1 break-all">{exportRecord.packagePath}</div>
                      </div>
                    ) : null}
                    <ProjectPreviewPanel item={item} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}

function studioTerminalTheme() {
  return {
    background: "#05070a",
    foreground: "#dce6f4",
    cursor: "#60a5fa",
    selectionBackground: "#1d4ed866",
    black: "#0f172a",
    red: "#f87171",
    green: "#34d399",
    yellow: "#fbbf24",
    blue: "#60a5fa",
    magenta: "#c084fc",
    cyan: "#22d3ee",
    white: "#e2e8f0",
    brightBlack: "#475569",
    brightRed: "#fb7185",
    brightGreen: "#86efac",
    brightYellow: "#fde68a",
    brightBlue: "#93c5fd",
    brightMagenta: "#d8b4fe",
    brightCyan: "#67e8f9",
    brightWhite: "#f8fafc"
  };
}

function studioWorkshopTypeLabel(type: ProjectType) {
  return studioWorkshopTypes.find((item) => item.id === type)?.label || "功能页";
}

function studioAgentStatusText(status: StudioAgentStatus) {
  if (status === "running") return "运行中";
  if (status === "starting") return "开机中";
  if (status === "exited") return "已退出";
  if (status === "error") return "异常";
  if (status === "selected") return "待开机";
  return "待选择";
}

function agentCommandSummary(tool?: WorkbenchAgentToolSummary) {
  if (!tool) return "选择 Claude、Codex、Hermes 或其他 Agent。";
  const args = tool.args?.length ? ` ${tool.args.join(" ")}` : "";
  return `${tool.command || tool.kind || tool.id}${args}`;
}

function studioLaunchMeta(tool?: WorkbenchAgentToolSummary) {
  if (!tool) return "选择一个 CLI Agent 后启动工坊。";
  return `${tool.name} 已连接到工坊，开机后会在工位内运行。`;
}

function studioAgentRendererProfile(tool?: WorkbenchAgentToolSummary): WorkspaceRendererProfile {
  if (!tool) return "other";
  return workspaceRendererProfileForPane({
    toolId: tool.id,
    name: tool.name,
    kind: tool.kind,
    command: tool.command
  });
}

function studioWorkshopSessionId(toolId = "agent") {
  const safeToolId = String(toolId || "agent").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "agent";
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `studio-workshop-${safeToolId}-${Date.now().toString(36)}-${randomPart}`;
}

function studioViewerTerminalSubmitText(text: string) {
  return workspaceRendererNormalizeUserText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function studioTerminalSourceEvent(event: TerminalSourceEvent): WorkspaceRendererSourceEvent {
  return {
    kind: event.kind,
    text: event.text,
    summary: event.summary,
    tone: event.tone,
    label: event.label,
    detail: event.detail,
    status: event.status,
    source: event.source,
    createdAt: event.createdAt
  };
}

function studioRuntimeOwnershipFromDescriptor(descriptor: OwnershipScope): OwnershipScope {
  return {
    runtimeId: descriptor.runtimeId,
    sessionId: descriptor.sessionId,
    surfaceId: descriptor.surfaceId,
    conversationId: descriptor.conversationId,
    agentId: descriptor.agentId,
    sourceId: descriptor.sourceId,
    projectId: descriptor.projectId
  };
}

function studioRecordTerminalUserInput(
  data: string,
  draftRef: MutableRefObject<string>,
  turnsRef: MutableRefObject<WorkspaceTerminalUserTurn[]>,
  sessionId: string
) {
  if (!data || data.includes("\u001b")) return;
  let draft = draftRef.current;
  for (const char of Array.from(data)) {
    if (char === "\r" || char === "\n") {
      const text = workspaceRendererNormalizeUserText(draft);
      if (text) {
        const createdAt = Date.now();
        turnsRef.current = [
          ...turnsRef.current,
          { id: `${sessionId}-${createdAt}-${turnsRef.current.length + 1}`, text, source: "terminal" as const, createdAt }
        ].slice(-80);
      }
      draft = "";
      continue;
    }
    if (char === "\u007f" || char === "\b") {
      draft = draft.slice(0, -1);
      continue;
    }
    if (char >= " ") draft += char;
  }
  draftRef.current = draft.slice(-2000);
}

function StudioMeowViewerOverlay({
  profile,
  rawOutput,
  segments,
  status,
  statusItems,
  permissionPrompt,
  selectedToolName,
  onSendText
}: {
  profile: WorkspaceRendererProfile;
  rawOutput: string;
  segments: WorkspaceRenderedSegment[];
  status: StudioAgentStatus;
  statusItems: Array<{ label: string; value: string; tone: string }>;
  permissionPrompt: WorkspaceRendererPermissionPrompt | null;
  selectedToolName: string;
  onSendText: (text: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);
  const viewerStatus: WorkspaceTerminalStatus =
    status === "starting" || status === "running" || status === "exited" || status === "error"
      ? status
      : "idle";
  const viewerStatusItems = statusItems as WorkspaceRendererStatusItem[];
  const permissionKey = permissionPrompt
    ? `${permissionPrompt.title}:${permissionPrompt.detail}:${permissionPrompt.choices.map((choice) => choice.value).join("|")}`
    : "";

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (autoFollowRef.current) body.scrollTop = body.scrollHeight;
  }, [rawOutput.length, segments.length, statusItems.length, status, permissionKey]);

  const handleBodyScroll = () => {
    const body = bodyRef.current;
    if (!body) return;
    autoFollowRef.current = body.scrollHeight - body.scrollTop - body.clientHeight <= 56;
  };

  const sendPermissionChoice = (value: string) => {
    autoFollowRef.current = true;
    onSendText(value);
  };

  return (
    <div
      className="meowdesk-output-renderer meowdesk-studio-meow-viewer"
      data-r2-output-renderer="studio"
      data-r2-output-renderer-source={selectedToolName}
      data-r2-output-renderer-profile={profile}
      data-r2-output-renderer-status={viewerStatus}
      data-studio-meow-viewer-overlay
      data-studio-meow-viewer-profile={profile}
      data-studio-meow-viewer-status={status}
    >
      {statusItems.length ? (
        <WorkspaceRendererStatusPanel items={viewerStatusItems} />
      ) : null}
      <div ref={bodyRef} className="meowdesk-output-renderer-body" data-studio-meow-viewer-body data-r2-output-renderer-content onScroll={handleBodyScroll}>
        {segments.length ? (
          <div className="meowdesk-output-renderer-stream" data-studio-meow-viewer-stream>
            <WorkspaceRenderedConversation
              segments={segments}
              profile={profile}
              statusItems={viewerStatusItems}
              sourceStatus={viewerStatus}
            />
          </div>
        ) : (
          <div className="meowdesk-output-renderer-empty" data-studio-meow-viewer-empty>
            <strong>{rawOutput.trim() ? "正在整理输出" : "等待 Agent 输出"}</strong>
            <span>Agent 原始工位在下层继续运行，关闭 Meow Viewer 可回到终端。</span>
          </div>
        )}
      </div>
      <MeowViewerComposer
        surface="studio"
        profile={profile}
        targetName={selectedToolName}
        running={status === "running"}
        className="meowdesk-studio-meow-viewer-composer"
        onSendText={onSendText}
        permissionSlot={permissionPrompt ? (
          <section className="meowdesk-output-renderer-permission" aria-label={permissionPrompt.title} data-studio-meow-viewer-permission data-r2-output-renderer-permission>
            <div className="meowdesk-output-renderer-permission-head">
              <strong>{permissionPrompt.title}</strong>
              <span>{permissionPrompt.detail}</span>
            </div>
            <div className="meowdesk-output-renderer-permission-actions">
              {permissionPrompt.choices.map((choice) => (
                <Button
                  key={choice.value}
                  type="button"
                  variant={choice.tone}
                  size="sm"
                  onClick={() => sendPermissionChoice(choice.value)}
                  data-studio-meow-viewer-permission-choice={choice.value}
                  data-r2-output-renderer-permission-choice={choice.value}
                >
                  {choice.label}
                </Button>
              ))}
            </div>
          </section>
        ) : null}
      />
    </div>
  );
}

function studioAgentIconPathFromText(name: string, kind?: string) {
  const text = `${name} ${kind || ""}`.toLowerCase();
  if (/codex/.test(text)) return "../../assets/tool-icons/codex.png";
  if (/hermes|wsl/.test(text)) return "../../assets/tool-icons/hermes.png";
  if (/claude/.test(text)) return "../../assets/tool-icons/claude.ico";
  if (/chatgpt|openai/.test(text)) return "../../assets/tool-icons/chatgpt.svg";
  if (/deepseek/.test(text)) return "../../assets/tool-icons/deepseek.svg";
  if (/gemini/.test(text)) return "../../assets/tool-icons/gemini.svg";
  return "";
}

function StudioAgentIcon({
  name,
  kind,
  size = "md",
  chrome = "tile"
}: {
  name: string;
  kind?: string;
  size?: "md" | "lg";
  chrome?: "tile" | "none";
}) {
  const normalized = `${name} ${kind || ""}`.toLowerCase();
  const label = /claude/.test(normalized) ? "C" : /hermes/.test(normalized) ? "H" : /codex/.test(normalized) ? "X" : "A";
  const iconPath = studioAgentIconPathFromText(name, kind);
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden font-semibold text-primary",
        chrome === "none"
          ? cn("border-0 bg-transparent", size === "lg" ? "h-9 w-9 text-base" : "h-5 w-5 text-sm")
          : cn("rounded-md border border-primary/35 bg-primary/10", size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-sm")
      )}
      data-studio-agent-icon={label}
      data-studio-agent-icon-chrome={chrome}
      aria-hidden="true"
    >
      {iconPath ? <img className={cn("object-contain", size === "lg" ? "h-8 w-8" : "h-5 w-5")} src={iconPath} alt="" /> : <Bot size={size === "lg" ? 22 : 16} aria-hidden="true" />}
    </span>
  );
}

function AgentRuntimeStage({
  summary,
  workshopType,
  selectedProject
}: {
  summary: WorkbenchSummary;
  workshopType: ProjectType;
  selectedProject?: WorkbenchExtensionSummary;
}) {
  const agentTools = summary.agentTools;
  const agentToolKey = agentTools.map((tool) => tool.id).join("|");
  const [selectedToolId, setSelectedToolId] = useState("");
  const [selectedToolSnapshot, setSelectedToolSnapshot] = useState<WorkbenchAgentToolSummary | null>(null);
  const [status, setStatus] = useState<StudioAgentStatus>("empty");
  const [message, setMessage] = useState("选择一个 Agent 后启动工坊。");
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [confirmingStopAgent, setConfirmingStopAgent] = useState(false);
  const [meowViewerOpen, setMeowViewerOpen] = useState(false);
  const [runtimeOwnershipOverride, setRuntimeOwnershipOverride] = useState<OwnershipScope | null>(null);
  const [outputTick, setOutputTick] = useState(0);
  const [outputSample, setOutputSample] = useState("");
  const sessionIdRef = useRef(studioWorkshopSessionId());
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XtermTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sizeKeyRef = useRef("");
  const rawOutputRef = useRef("");
  const displayTranscriptRef = useRef("");
  const statusPreviewRef = useRef("");
  const sourceEventsRef = useRef<WorkspaceRendererSourceEvent[]>([]);
  const userTurnsRef = useRef<WorkspaceTerminalUserTurn[]>([]);
  const inputDraftRef = useRef("");
  const statusRef = useRef<StudioAgentStatus>("empty");
  const manualStopRef = useRef(false);
  const startupRequestRef = useRef(0);
  const reattachedRuntimeKeyRef = useRef("");
  const timersRef = useRef<number[]>([]);
  const selectedTool = agentTools.find((tool) => tool.id === selectedToolId) || (selectedToolSnapshot?.id === selectedToolId ? selectedToolSnapshot : undefined);
  const workstationMode = selectedTool ? "cli" : "empty";
  const busy = status === "starting";
  const running = status === "running";
  const hasCliAgent = Boolean(selectedTool);
  const controlsVisible = hasCliAgent;
  const canStopAgent = hasCliAgent && (running || busy);
  const canStart = Boolean(selectedTool && hasWorkbenchApi() && !busy && !running);
  const rendererProfile = studioAgentRendererProfile(selectedTool);
  const currentOwnership = useCallback(() => runtimeOwnershipOverride || createAgentRuntimeOwnership({
    surfaceKind: "studio-agent",
    surfaceLocalId: "workshop-agent",
    sessionId: sessionIdRef.current,
    agentId: selectedToolId || "agent",
    sourceLocalId: "studio-agent",
    projectId: selectedProject?.id
  }), [runtimeOwnershipOverride, selectedProject?.id, selectedToolId]);
  const studioViewerParsed = useMemo(() => selectedTool
    ? workspaceRendererParseSourceSnapshot({
      id: sessionIdRef.current,
      ...currentOwnership(),
      profile: rendererProfile,
      sourceEvents: sourceEventsRef.current,
      displayTranscript: displayTranscriptRef.current || rawOutputRef.current,
      rawTranscript: rawOutputRef.current,
      userTurns: userTurnsRef.current,
      status,
      updatedAt: outputTick
    })
    : { sourceEvents: [], events: [], segments: [], statusItems: [], permissionPrompt: null },
  [currentOwnership, outputTick, rendererProfile, status, selectedTool?.id]);

  const clearFitTimers = useCallback(() => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];
  }, []);

  const fitTerminal = useCallback(() => {
    const host = hostRef.current;
    const term = termRef.current;
    const fit = fitRef.current;
    if (!host || !term || !fit) return;
    const box = host.getBoundingClientRect();
    if (box.width < 40 || box.height < 40) return;
    try {
      fit.fit();
      const cols = Math.max(20, term.cols || 0);
      const rows = Math.max(8, term.rows || 0);
      host.dataset.studioAgentTerminalCols = String(cols);
      host.dataset.studioAgentTerminalRows = String(rows);
      const sizeKey = `${cols}x${rows}`;
      if (sizeKeyRef.current !== sizeKey) {
        sizeKeyRef.current = sizeKey;
        if (statusRef.current === "running" || statusRef.current === "starting") {
          resizeAgentRuntime(sessionIdRef.current, cols, rows);
        }
      }
      term.refresh(0, Math.max(0, rows - 1));
    } catch {
      // Route transitions can briefly leave xterm with a zero-sized host.
    }
  }, []);

  const scheduleFit = useCallback(() => {
    if (typeof window === "undefined") return;
    clearFitTimers();
    for (const delay of [0, 16, 80, 180, 360, 700]) {
      const timer = window.setTimeout(() => window.requestAnimationFrame(fitTerminal), delay);
      timersRef.current.push(timer);
    }
  }, [clearFitTimers, fitTerminal]);

  useEffect(() => {
    setSelectedToolId((current) => {
      if (current && agentTools.some((tool) => tool.id === current)) return current;
      if (current && statusRef.current === "running") return current;
      if (current && selectedToolSnapshot?.id === current) return current;
      return "";
    });
  }, [agentToolKey, agentTools, selectedToolSnapshot?.id]);

  useEffect(() => {
    if (!selectedToolId) {
      setSelectedToolSnapshot(null);
      return;
    }
    const latest = agentTools.find((tool) => tool.id === selectedToolId);
    if (latest) setSelectedToolSnapshot(latest);
  }, [agentToolKey, agentTools, selectedToolId]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    scheduleFit();
  }, [scheduleFit, controlsVisible, meowViewerOpen, selectedToolId]);

  useEffect(() => {
    if (!selectedToolId) {
      setStatus("empty");
      setMessage(agentTools.length ? "选择一个 Agent 后启动工坊。" : "还没有可用 Agent。");
      return;
    }
    if (statusRef.current === "empty") {
      setStatus("selected");
      setMessage("已选择，等待开机。");
    }
  }, [agentTools.length, selectedToolId]);

  useEffect(() => {
    if (!selectedProject?.id || selectedToolId || agentTools.length !== 1 || statusRef.current !== "empty") return;
    const [onlyTool] = agentTools;
    setSelectedToolId(onlyTool.id);
    setSelectedToolSnapshot(onlyTool);
    setRuntimeOwnershipOverride(null);
    setStatus("selected");
    setMessage("已选择，等待开机。");
  }, [agentTools, selectedProject?.id, selectedToolId]);

  useEffect(() => {
    let disposed = false;
    if (!hasWorkbenchApi() || reattachedRuntimeKeyRef.current || statusRef.current === "running" || statusRef.current === "starting") {
      return () => {
        disposed = true;
      };
    }
    const studioSurfaceId = createAgentRuntimeOwnership({
      surfaceKind: "studio-agent",
      surfaceLocalId: "workshop-agent",
      sessionId: "workshop-agent",
      agentId: "agent",
      sourceLocalId: "studio-agent",
      projectId: selectedProject?.id
    }).surfaceId;
    void listAgentRuntimes().then((runtimes) => {
      const descriptor = runtimes
        .filter((runtime) => runtime.surfaceId === studioSurfaceId && runtime.status === "running")
        .sort((left, right) => Number(right.startedAt || 0) - Number(left.startedAt || 0))[0];
      if (!descriptor) return { ok: false as const, reason: "missing" as const };
      return reattachAgentRuntime(descriptor.runtimeKey, { sourceAdapter: true });
    }).then((result) => {
      if (disposed || !result.ok) return;
      const descriptor = result.descriptor;
      reattachedRuntimeKeyRef.current = descriptor.runtimeKey;
      sessionIdRef.current = descriptor.runtimeKey;
      setRuntimeOwnershipOverride(studioRuntimeOwnershipFromDescriptor(descriptor));
      if (descriptor.toolId) {
        setSelectedToolId(descriptor.toolId);
        const reattachedTool = agentTools.find((tool) => tool.id === descriptor.toolId);
        if (reattachedTool) setSelectedToolSnapshot(reattachedTool);
      }
      statusRef.current = "running";
      setStatus("running");
      setMessage("已接回运行中的工坊 Agent runtime。");
      termRef.current?.writeln("\r\n[reattached live workshop runtime]");
      scheduleFit();
      window.dispatchEvent(new CustomEvent("meowdesk:agent-runtime-refresh"));
    }).catch(() => {});
    return () => {
      disposed = true;
    };
  }, [scheduleFit, selectedProject?.id]);

  useEffect(() => {
    const active = Boolean(selectedTool && (status === "running" || status === "starting"));
    void setAgentRuntimeSourceAdapter(sessionIdRef.current, active).catch(() => {});
    return () => {
      void setAgentRuntimeSourceAdapter(sessionIdRef.current, false).catch(() => {});
    };
  }, [selectedTool?.id, status]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new XtermTerminal({
      cursorBlink: true,
      convertEol: true,
      scrollback: 4000,
      windowsMode: true,
      fontFamily: "Cascadia Mono, Consolas, ui-monospace, monospace",
      fontSize: 12,
      letterSpacing: 0,
      lineHeight: 1.12,
      theme: studioTerminalTheme()
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      const key = String(event.key || "").toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return true;
      if (key === "c") {
        const selection = term.getSelection();
        if (selection) {
          void optionalWorkbenchApi()?.writeClipboardText(selection);
          return false;
        }
        return Boolean(event.shiftKey);
      }
      if (key === "v") {
        void optionalWorkbenchApi()?.readClipboardText().then((text) => {
          if (text) writeAgentRuntime(sessionIdRef.current, text);
        });
        return false;
      }
      return true;
    });
    const dataDisposable = term.onData((data) => {
      if (statusRef.current === "running" || statusRef.current === "starting") {
        studioRecordTerminalUserInput(data, inputDraftRef, userTurnsRef, sessionIdRef.current);
        writeAgentRuntime(sessionIdRef.current, data);
      }
    });
    termRef.current = term;
    fitRef.current = fit;
    const observer = window.ResizeObserver ? new ResizeObserver(scheduleFit) : null;
    observer?.observe(host);
    window.addEventListener("resize", scheduleFit);
    scheduleFit();

    return () => {
      dataDisposable.dispose();
      observer?.disconnect();
      window.removeEventListener("resize", scheduleFit);
      clearFitTimers();
      if (statusRef.current === "running" || statusRef.current === "starting") {
        try {
          void detachAgentRuntime(sessionIdRef.current).catch(() => {});
        } catch {
          // The bridge may already be gone during renderer teardown.
        }
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      sizeKeyRef.current = "";
    };
  }, [clearFitTimers, scheduleFit]);

  useEffect(() => {
    if (!hasWorkbenchApi()) return () => {};
    return attachAgentRuntimeData(() => sessionIdRef.current, (event) => {
      if (statusRef.current !== "running") {
        setStatus("running");
        setMessage("Agent 已在工坊待命。");
      }
      fitTerminal();
      statusPreviewRef.current = workspaceRendererMergeStatusPreview(
        statusPreviewRef.current,
        workspaceRendererStatusPreviewFromTerminalData(event.data)
      );
      rawOutputRef.current = `${rawOutputRef.current}${event.data}`.slice(-128000);
      if (event.sourceEvents?.length) {
        sourceEventsRef.current = workspaceRendererDedupeSourceEvents([
          ...sourceEventsRef.current,
          ...event.sourceEvents.map((sourceEvent) => ({
            ...currentOwnership(),
            ...studioTerminalSourceEvent(sourceEvent)
          }))
        ], 400);
      }
      termRef.current?.write(event.data, () => {
        displayTranscriptRef.current = workspaceRendererDisplayTranscriptWithStatusPreview(
          statusPreviewRef.current,
          workspaceTerminalTranscript(termRef.current)
        );
        scheduleFit();
        setOutputTick((current) => current + 1);
      });
      if (!termRef.current) {
        displayTranscriptRef.current = workspaceRendererDisplayTranscriptWithStatusPreview(
          statusPreviewRef.current,
          displayTranscriptRef.current
        );
        setOutputTick((current) => current + 1);
      }
      setOutputSample((current) => `${current}${event.data}`.slice(-600));
    }, currentOwnership);
  }, [currentOwnership, fitTerminal, scheduleFit]);

  useEffect(() => {
    if (!hasWorkbenchApi()) return () => {};
    return attachAgentRuntimeExit(() => sessionIdRef.current, (event) => {
      if (manualStopRef.current) {
        manualStopRef.current = false;
        setStatus("selected");
        setMessage("Agent 已关机，仍可重新启动。");
        termRef.current?.writeln("\r\n[workshop agent stopped]");
        return;
      }
      setStatus(event.exitCode ? "error" : "exited");
      setMessage(event.exitCode ? `Agent 进程已退出：${event.exitCode}` : "Agent 已关机。");
      termRef.current?.writeln(`\r\n[process exited: ${event.exitCode}]`);
    }, currentOwnership);
  }, [currentOwnership]);

  const startAgent = async () => {
    if (!selectedTool) {
      setStatus("empty");
      setMessage("先选择一个 Agent。");
      return;
    }
    if (!hasWorkbenchApi()) {
      setStatus("error");
      setMessage("当前环境没有 preload bridge，无法启动 Agent。");
      return;
    }
    statusRef.current = "starting";
    setStatus("starting");
    manualStopRef.current = false;
    reattachedRuntimeKeyRef.current = "";
    setMessage("正在通过旧 terminal IPC 启动工坊 Agent。");
    const startupRequest = startupRequestRef.current + 1;
    startupRequestRef.current = startupRequest;
    const startupSessionId = studioWorkshopSessionId(selectedTool.id);
    sessionIdRef.current = startupSessionId;
    const nextOwnership = createAgentRuntimeOwnership({
      surfaceKind: "studio-agent",
      surfaceLocalId: "workshop-agent",
      sessionId: startupSessionId,
      agentId: selectedTool.id,
      sourceLocalId: "studio-agent",
      projectId: selectedProject?.id
    });
    setRuntimeOwnershipOverride(nextOwnership);
    setOutputTick(0);
    setOutputSample("");
    rawOutputRef.current = "";
    displayTranscriptRef.current = "";
    statusPreviewRef.current = "";
    sourceEventsRef.current = [];
    userTurnsRef.current = [];
    inputDraftRef.current = "";
    sizeKeyRef.current = "";
    termRef.current?.reset();
    const activeWorkshopType = selectedProject && ["feature-page", "sidebar-widget"].includes(selectedProject.type)
      ? selectedProject.type as ProjectType
      : workshopType;
    termRef.current?.writeln(`${selectedTool.name} 正在进入工坊...`);
    scheduleFit();
    try {
      await startAgentRuntime({
        sessionId: startupSessionId,
        toolId: selectedTool.id,
        ownership: nextOwnership,
        toolOverride: {
          name: `${selectedTool.name} · 工坊`,
          args: selectedTool.args || [],
          cwd: selectedTool.cwd || ".",
          replaceExisting: true
        },
        workshop: {
          enabled: true,
          type: activeWorkshopType,
          label: studioWorkshopTypeLabel(activeWorkshopType),
          target: studioWorkshopTarget(activeWorkshopType),
          projectId: selectedProject?.id,
          projectName: selectedProject?.name,
          projectPath: selectedProject?.path,
          manifestPath: selectedProject?.manifestPath,
          entryPath: selectedProject?.entryPath,
          entry: selectedProject?.entry,
          status: selectedProject?.status,
          version: selectedProject?.version,
          runtime: selectedProject?.runtime
        },
        sourceAdapter: true
      });
      if (startupRequestRef.current !== startupRequest || manualStopRef.current || statusRef.current !== "starting") {
        try {
          stopAgentRuntime(startupSessionId);
        } catch {
          // The late-starting process may already have exited or failed to spawn.
        }
        return;
      }
      statusRef.current = "running";
      setStatus("running");
      setMessage("Agent 已在工坊待命。");
      scheduleFit();
    } catch (error) {
      if (startupRequestRef.current !== startupRequest || manualStopRef.current) {
        statusRef.current = "selected";
        setStatus("selected");
        setMessage("Agent 已关机，仍可重新启动。");
        return;
      }
      const text = error instanceof Error ? error.message : String(error);
      statusRef.current = "error";
      setStatus("error");
      setMessage(`启动失败：${text}`);
      termRef.current?.writeln(`\r\n启动失败：${text}`);
    }
  };

  const stopAgent = () => {
    if (!selectedTool || !hasWorkbenchApi() || !canStopAgent) return;
    setConfirmingStopAgent(false);
    startupRequestRef.current += 1;
    manualStopRef.current = true;
    try {
      stopAgentRuntime(sessionIdRef.current);
    } catch {
      // The process may already have exited.
    }
    statusRef.current = "selected";
    setStatus("selected");
    setMessage("Agent 已关机，仍可重新启动。");
    termRef.current?.writeln("\r\n[workshop agent stopped]");
  };

  const sendStudioText = (value: string) => {
    if (!selectedTool || statusRef.current !== "running") return;
    const text = workspaceRendererNormalizeUserText(value);
    if (!text) return;
    const terminalText = studioViewerTerminalSubmitText(text);
    if (!terminalText) return;
    const createdAt = Date.now();
    userTurnsRef.current = [
      ...userTurnsRef.current,
      { id: `${sessionIdRef.current}-${createdAt}-${userTurnsRef.current.length + 1}`, text, source: "renderer" as const, createdAt }
    ].slice(-80);
    writeAgentRuntime(sessionIdRef.current, terminalText);
    window.setTimeout(() => writeAgentRuntime(sessionIdRef.current, "\r"), 18);
    setOutputTick((current) => current + 1);
  };

  const selectAgent = (tool: WorkbenchAgentToolSummary) => {
    setSelectedToolId(tool.id);
    setSelectedToolSnapshot(tool);
    setRuntimeOwnershipOverride(null);
    reattachedRuntimeKeyRef.current = "";
    setStatus("selected");
    setMessage("已选择，等待开机。");
    setMeowViewerOpen(false);
    setAgentPickerOpen(false);
  };

  const openWorkspaceConfig = () => {
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", "#access/workspace");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.dispatchEvent(new CustomEvent("meowdesk:access-open-section", { detail: { section: "workspace" } }));
  };

  const renderOwnership = currentOwnership();

  return (
    <>
      <Dialog open={confirmingStopAgent} onOpenChange={setConfirmingStopAgent}>
        <DialogContent
          className="meowdesk-confirm-dialog meowdesk-surface-close-family-dialog vs-surface-close-panel"
          data-studio-agent-stop-dialog
          data-vs-surface-close-family="studio-agent"
          data-meow-warning-card
          data-meow-warning-owner="meowdesk-warning-dialog"
          data-meow-warning-family="flip-confirm-card"
          data-meow-warning-variant="studio-agent-stop"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <span className="vs-surface-close-warning" data-meow-warning-icon aria-hidden="true" />
          <div className="vs-surface-close-content" data-meow-warning-content>
            <DialogHeader>
              <DialogTitle>关闭工坊 Agent？</DialogTitle>
              <DialogDescription>
                会停止「{selectedTool?.name || "当前 Agent"}」对应的 Agent 进程。未保存或尚未写入作品目录的输出可能会丢失。
              </DialogDescription>
            </DialogHeader>
            <p className="meowdesk-surface-close-note">
              如果只是暂时不看终端，可以先收起辅助面板或停留在当前工位。确认关机会结束当前工坊 Agent，尚未保存的输出可能会丢失。
            </p>
            <DialogFooter className="vs-surface-close-actions" data-meow-warning-actions>
              <Button type="button" variant="outline" onClick={() => setConfirmingStopAgent(false)} className="vs-surface-close-cancel" data-studio-agent-stop-cancel>
                取消
              </Button>
              <Button
                type="button"
                variant="outline"
                className="vs-surface-close-confirm"
                disabled={!selectedTool}
                onClick={stopAgent}
                data-studio-agent-stop-confirm
              >
                确认关机
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={agentPickerOpen} onOpenChange={setAgentPickerOpen}>
        <DialogContent
          className="meowdesk-picker-dialog w-[min(560px,calc(100vw-32px))]"
          data-studio-agent-picker-dialog
          data-meow-picker-dialog="studio-agent"
          data-meow-picker-family="agent-tool-picker"
          data-meow-picker-live="native-content"
        >
          <DialogHeader>
            <DialogTitle>选择工坊 Agent</DialogTitle>
            <DialogDescription>
              CLI 会在工位内启动；Claude 桌面版入口开发中，暂不可打开。
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1" data-studio-agent-choice-list>
            <div className="grid gap-1 px-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">CLI Agent</div>
              <div className="text-[11px] leading-4 text-muted-foreground" data-studio-agent-choice-note="cli">
                适合可直接运行的本机命令：启动后会进入工位终端。
              </div>
            </div>
            {agentTools.length ? agentTools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className={cn(
                  "grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-background/55 px-3 py-2 text-left text-xs transition hover:border-primary/45 hover:bg-primary/10",
                  selectedToolId === tool.id && "border-primary/55 bg-primary/10"
                )}
                data-studio-agent-choice={tool.id}
                data-studio-agent-choice-active={selectedToolId === tool.id ? "true" : undefined}
                onClick={() => selectAgent(tool)}
              >
                <StudioAgentIcon name={tool.name} kind={tool.kind || tool.id} />
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-foreground">{tool.name}</strong>
                  <span className="mt-1 block truncate text-muted-foreground">{agentCommandSummary(tool)}</span>
                </span>
                <Badge variant={studioAgentRendererProfile(tool) === "hermes" ? "warning" : "default"}>
                  {studioAgentRendererProfile(tool) === "hermes" ? "Beta" : tool.kind || "agent"}
                </Badge>
              </button>
            )) : (
              <div className="rounded-md border border-dashed border-border bg-background/45 px-3 py-6 text-center text-xs text-muted-foreground">
                还没有可用 CLI Agent。可以去 Agent 中心保存本机命令。
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={openWorkspaceConfig} data-studio-agent-open-config>
              <Settings size={14} aria-hidden="true" />
              Agent 中心
            </Button>
            <Button type="button" variant="outline" onClick={() => setAgentPickerOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Panel
        className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
        data-studio-agent-panel
        data-studio-agent-stage-current="workstation"
        data-studio-agent-workstation-mode={workstationMode}
        data-studio-workshop-agent-status={status}
        data-studio-agent-selected={selectedToolId || undefined}
        data-studio-agent-selected-project={selectedProject?.id || undefined}
      >
        <PanelHeader data-studio-agent-panel-header>
          <div>
            <div className="text-sm font-semibold">Agent 工位</div>
            <div className="text-xs text-muted-foreground">
              {`${studioWorkshopTypeLabel(workshopType)} · ${message}`}
            </div>
          </div>
          <div className="meowdesk-studio-agent-header-controls" data-studio-agent-header-controls>
            {selectedTool && !running && !busy ? (
              <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => setAgentPickerOpen(true)} data-studio-agent-change>
                更换
              </Button>
            ) : null}
            {controlsVisible ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => setMeowViewerOpen((current) => !current)}
                  data-studio-agent-meow-viewer-toggle
                  data-studio-agent-meow-viewer-toggle-state={meowViewerOpen ? "open" : "closed"}
                  data-studio-agent-control-owner="header"
                >
                  <FileCode2 size={13} aria-hidden="true" />
                  {meowViewerOpen ? "关闭 Meow Viewer" : "打开 Meow Viewer"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs text-danger"
                  disabled={!canStopAgent}
                  onClick={() => setConfirmingStopAgent(true)}
                  data-studio-agent-stop
                  data-studio-agent-control-owner="header"
                  title={canStopAgent ? "关闭工坊 Agent" : "Agent 未开机"}
                >
                  <Power size={13} aria-hidden="true" />
                  关机
                </Button>
              </>
            ) : null}
            <Badge variant={running ? "success" : status === "error" ? "danger" : status === "starting" ? "warning" : "default"}>
              {studioAgentStatusText(status)}
            </Badge>
          </div>
        </PanelHeader>
        <PanelBody className="flex min-h-0 flex-1 p-3">
          <div
            className="grid min-h-[360px] flex-1 overflow-hidden rounded-lg border border-border bg-background/60 min-[1180px]:min-h-0"
            data-studio-agent-stage
            data-studio-agent-stage-mode="workstation"
          >
            <div
              className="meowdesk-studio-terminal-runtime"
              data-studio-agent-terminal-runtime={sessionIdRef.current}
              data-runtime-id={renderOwnership.runtimeId}
              data-session-id={renderOwnership.sessionId}
              data-surface-id={renderOwnership.surfaceId}
              data-conversation-id={renderOwnership.conversationId}
              data-agent-id={renderOwnership.agentId}
              data-source-id={renderOwnership.sourceId}
              data-project-id={renderOwnership.projectId}
              data-studio-agent-terminal-status={status}
              data-studio-agent-terminal-output-tick={outputTick}
              data-studio-agent-terminal-output-sample={outputSample}
            >
              <div className="meowdesk-studio-xterm-host" ref={hostRef} data-studio-agent-terminal-host={sessionIdRef.current} />
              {selectedTool && meowViewerOpen ? (
                <StudioMeowViewerOverlay
                  profile={rendererProfile}
                  rawOutput={rawOutputRef.current}
                  segments={studioViewerParsed.segments}
                  status={status}
                  statusItems={studioViewerParsed.statusItems}
                  permissionPrompt={studioViewerParsed.permissionPrompt}
                  selectedToolName={selectedTool.name}
                  onSendText={sendStudioText}
                />
              ) : null}
              {!selectedTool ? (
                <div className="meowdesk-studio-agent-standby" data-studio-agent-standby data-studio-agent-standby-mode="empty">
                  <LaunchEmptyState
                    variant="studio-agent"
                    icon={(
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="meowdesk-studio-agent-add-button meowdesk-workspace-launch-button"
                        onClick={() => setAgentPickerOpen(true)}
                        data-studio-agent-add
                        data-meow-launch-action="primary"
                        aria-label="添加工坊 Agent"
                        title="添加工坊 Agent"
                      >
                        <Plus size={24} aria-hidden="true" />
                      </Button>
                    )}
                    iconChrome="action"
                    title={<strong>添加 Agent</strong>}
                    meta="从这里选择 CLI Agent；启动后会在工位内运行，并保留 Meow Viewer 与关机控制。"
                  />
                </div>
              ) : !running && !busy ? (
                <div className="meowdesk-studio-agent-standby" data-studio-agent-standby data-studio-agent-standby-mode="selected">
                  <LaunchEmptyState
                    variant="studio-agent"
                    icon={<StudioAgentIcon name={selectedTool.name} kind={selectedTool.kind || selectedTool.id} size="lg" chrome="none" />}
                    iconChrome="tile"
                    title={(
                      <>
                        <strong>{selectedTool.name}</strong>
                        {rendererProfile === "hermes" ? <Badge variant="warning">Hermes Beta</Badge> : null}
                      </>
                    )}
                    meta={studioLaunchMeta(selectedTool)}
                    primaryAction={(
                      <Button type="button" variant="outline" className="meowdesk-workspace-launch-button" disabled={!canStart} onClick={() => void startAgent()} data-studio-agent-start>
                        <Play size={16} aria-hidden="true" />
                        启动工坊 Agent
                      </Button>
                    )}
                  />
                </div>
              ) : null}
              {selectedTool && status === "starting" ? (
                <div className="meowdesk-agent-starting-overlay" data-studio-agent-starting>
                  <span className="meowdesk-agent-startup-spinner" aria-hidden="true" />
                  <strong>{selectedTool.name} 正在启动</strong>
                  <span>{rendererProfile === "hermes" ? "Hermes 首次连接可能会多等一会。" : "正在连接本机 Agent runtime。"}</span>
                </div>
              ) : null}
            </div>
          </div>
        </PanelBody>
      </Panel>
    </>
  );
}

function StudioInspector({
  layout,
  open = true,
  tab,
  onTabChange,
  onClose,
  onOpen,
  summary,
  realProjectCount,
  operationStatus,
  lastPackagePath,
  visibleProjects,
  readyProjects,
  selectedProjectId,
  selectedProject,
  workshopType,
  pendingProjectId,
  pendingOperation,
  exportRecords,
  publishRecords,
  onWorkshopTypeChange,
  onMarkReady,
  onExportMeow,
  onRemoveProject,
  onOpenProjectFolder,
  onOpenPublishPage,
  onContinueProject,
  onSelectProject
}: {
  layout: "primary" | "side";
  open?: boolean;
  tab: StudioInspectorTab;
  onTabChange: (tab: StudioInspectorTab) => void;
  onClose: () => void;
  onOpen: () => void;
  summary: WorkbenchSummary;
  realProjectCount: number;
  operationStatus: string;
  lastPackagePath: string;
  visibleProjects: ProjectDraft[];
  readyProjects: ProjectDraft[];
  selectedProjectId: string;
  selectedProject?: WorkbenchExtensionSummary;
  workshopType: ProjectType;
  pendingProjectId: string;
  pendingOperation: StudioPendingOperation;
  exportRecords: Record<string, StudioProjectExportRecord>;
  publishRecords: Record<string, StudioProjectPublishRecord>;
  onWorkshopTypeChange: (type: ProjectType) => void;
  onMarkReady: (item: ProjectDraft) => void;
  onExportMeow: (item: ProjectDraft) => void;
  onRemoveProject: (item: ProjectDraft) => void;
  onOpenProjectFolder: (item: ProjectDraft) => void;
  onOpenPublishPage: (item: ProjectDraft | WorkbenchExtensionSummary) => void;
  onContinueProject: (item: ProjectDraft) => void;
  onSelectProject: (item: ProjectDraft) => void;
}) {
  const sideLayout = layout === "side";

  return (
    <Panel
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        sideLayout && "meowdesk-studio-inspector-side",
        sideLayout && !open && "is-collapsed"
      )}
      data-studio-inspector
      data-studio-inspector-active={tab}
      data-studio-inspector-layout={layout}
      data-studio-inspector-open={open ? "true" : "false"}
      aria-hidden={sideLayout && !open ? "true" : undefined}
    >
      <PanelHeader className={cn("shrink-0", sideLayout && !open && "meowdesk-studio-inspector-hidden-header")}>
        <div>
          <div className="text-sm font-semibold">{sideLayout ? "辅助面板" : "工坊工作区"}</div>
        </div>
      </PanelHeader>
      <PanelBody
        className={cn("min-h-0 flex-1", sideLayout ? "meowdesk-studio-inspector-content flex flex-col overflow-hidden" : "overflow-visible")}
        data-studio-inspector-content
        aria-hidden={sideLayout && !open ? "true" : undefined}
      >
        <Tabs
          className={cn(sideLayout && "flex h-full min-h-0 flex-col")}
          value={tab}
          onValueChange={(value) => onTabChange(value as StudioInspectorTab)}
        >
          <TabsList
            className={cn("grid grid-cols-4", sideLayout ? "w-full shrink-0" : "w-full min-[760px]:w-[520px]")}
            data-studio-inspector-panel-tabs
            data-meow-segment-owner="studio-inspector"
            data-meow-segment-family="studio-inspector-side"
          >
            {studioInspectorTabs.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                data-studio-inspector-panel-tab={item.id}
                data-studio-inspector-panel-tab-active={tab === item.id ? "true" : undefined}
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent forceMount className={cn(sideLayout && "min-h-0 flex-1 overflow-y-auto pr-1")} value="types" data-studio-inspector-panel="types">
            <div className={cn("grid gap-2", !sideLayout && "min-[900px]:grid-cols-3")} data-studio-project-types>
              {studioWorkshopTypes.map((item) => (
                <StudioType
                  key={item.id}
                  icon={item.icon}
                  title={item.label}
                  copy={item.copy}
                  active={workshopType === item.id}
                  onClick={() => onWorkshopTypeChange(item.id)}
                />
              ))}
            </div>
          </TabsContent>
          <TabsContent forceMount className={cn(sideLayout && "min-h-0 flex-1 overflow-y-auto pr-1")} value="projects" data-studio-inspector-panel="projects">
            <div data-studio-project-list>
              <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span data-studio-real-project-count={realProjectCount}>
                  {summary.status === "ready" ? `已索引 ${realProjectCount} 个本机作品` : "本机工坊项目"}
                </span>
              </div>
              {operationStatus ? (
                <div
                  className="mb-3 rounded-md border border-border bg-background/55 px-3 py-2 text-xs text-muted-foreground"
                  data-studio-operation-status
                  data-studio-last-package-path={lastPackagePath || undefined}
                >
                  {operationStatus}
                  {lastPackagePath ? <div className="mt-1 break-all text-muted-foreground">{lastPackagePath}</div> : null}
                </div>
              ) : null}
              <Tabs defaultValue="all">
                <TabsList
                  className={cn("grid grid-cols-2", sideLayout ? "w-full" : "w-full min-[640px]:w-[360px]")}
                  data-studio-project-filter-tabs
                  data-meow-segment-owner="studio-inspector"
                  data-meow-segment-family="studio-inspector-side"
                >
                  <TabsTrigger value="all" data-studio-project-filter-tab="all">全部</TabsTrigger>
                  <TabsTrigger value="ready" data-studio-project-filter-tab="ready">可发布</TabsTrigger>
                </TabsList>
                <TabsContent forceMount value="all" data-studio-project-list-panel="all">
                  <ProjectList
                    layout={layout}
                    items={visibleProjects}
                    onMarkReady={onMarkReady}
                    onExportMeow={onExportMeow}
                    onRemoveProject={onRemoveProject}
                    onOpenProjectFolder={onOpenProjectFolder}
                    onSelectRealProject={onSelectProject}
                    exportRecords={exportRecords}
                    pendingProjectId={pendingProjectId}
                    pendingOperation={pendingOperation}
                    selectedProjectId={selectedProjectId}
                  />
                </TabsContent>
                <TabsContent forceMount value="ready" data-studio-project-list-panel="ready">
                  <ProjectList
                    layout={layout}
                    items={readyProjects}
                    empty="暂无可发布作品"
                    onMarkReady={onMarkReady}
                    onExportMeow={onExportMeow}
                    onRemoveProject={onRemoveProject}
                    onOpenProjectFolder={onOpenProjectFolder}
                    onSelectRealProject={onSelectProject}
                    exportRecords={exportRecords}
                    pendingProjectId={pendingProjectId}
                    pendingOperation={pendingOperation}
                    selectedProjectId={selectedProjectId}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
          <TabsContent forceMount className={cn(sideLayout && "min-h-0 flex-1 overflow-y-auto pr-1")} value="detail" data-studio-inspector-panel="detail">
            <ProjectDetailPanel
              item={selectedProject}
              lastLoadedAt={summary.lastLoadedAt}
              pendingProjectId={pendingProjectId}
              pendingOperation={pendingOperation}
              exportRecord={selectedProject ? exportRecords[selectedProject.id] : undefined}
              publishRecord={selectedProject ? publishRecords[selectedProject.id] : undefined}
              onMarkReady={onMarkReady}
              onExportMeow={onExportMeow}
              onOpenProjectFolder={onOpenProjectFolder}
              onOpenPublishPage={onOpenPublishPage}
              onContinueProject={onContinueProject}
              embedded
            />
          </TabsContent>
          <TabsContent forceMount className={cn(sideLayout && "min-h-0 flex-1 overflow-y-auto pr-1")} value="runtime" data-studio-inspector-panel="runtime">
            <RuntimeBoundaryPanel summary={summary} />
          </TabsContent>
        </Tabs>
      </PanelBody>
    </Panel>
  );
}

function RuntimeBoundaryPanel({ summary }: { summary: WorkbenchSummary }) {
  const terminalSummary = summary.terminalSessions.length
    ? summary.terminalSessions.slice(0, 2).map((session) => session.name).join(" / ")
    : "未发现 terminal 配置，protected runtime 仍保留默认回退。";
  const sidebarLoadableCount = summary.sidebarWidgetRuntimes.filter((item) => item.readiness === "loadable").length;
  const sidebarEntryCount = summary.sidebarWidgetRuntimes.filter((item) => item.entry && item.entryPath).length;
  const sidebarHostCount = summary.sidebarIframeHosts.length;
  const rows = [
    {
      icon: Bot,
      label: "Agent 配置",
      value: `${summary.agentTools.length} 个`,
      detail: summary.agentTools.length ? summary.agentTools.slice(0, 3).map((tool) => tool.name).join(" / ") : "暂无已配置 Agent",
      status: summary.agentTools.length ? "ready" : "empty",
      kind: "agent"
    },
    {
      icon: Terminal,
      label: "Terminal runtime",
      value: summary.terminalSessions.length ? `${summary.terminalSessions.length} descriptor` : "deferred",
      detail: terminalSummary,
      status: "protected",
      kind: "terminal"
    },
    {
      icon: Boxes,
      label: "Right sidebar iframe",
      value: sidebarHostCount ? `${sidebarHostCount} host contract` : "deferred",
      detail: sidebarHostCount
        ? `${sidebarLoadableCount} loadable · ${sidebarEntryCount} entry · contract-only`
        : "右侧栏 iframe 宿主仍由 protected runtime 持有，next 只读取 manifest 摘要。",
      status: "protected",
      kind: "sidebar"
    },
    {
      icon: ClipboardList,
      label: "任务中心",
      value: "deferred",
      detail: "任务持久化和状态流后移，先保留旧模块作为真实运行源。",
      status: "protected",
      kind: "task-center"
    }
  ];

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-surface/70 p-3" data-studio-runtime-boundary>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Activity size={14} className="text-primary" aria-hidden="true" />
          Runtime boundary
        </div>
        <Badge variant="warning">protected runtime</Badge>
      </div>
      <div className="grid gap-2">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.label}
              className="min-w-0 rounded-md border border-border bg-background/55 px-3 py-2"
              data-studio-runtime-boundary-item={row.label}
              data-studio-runtime-boundary-status={row.status}
              data-studio-terminal-session-count={row.kind === "terminal" ? summary.terminalSessions.length : undefined}
              data-studio-terminal-descriptor-status={row.kind === "terminal" && summary.terminalSessions.length ? "contract" : undefined}
              data-studio-sidebar-runtime-count={row.kind === "sidebar" ? summary.sidebarWidgetRuntimes.length : undefined}
              data-studio-sidebar-runtime-loadable-count={row.kind === "sidebar" ? sidebarLoadableCount : undefined}
              data-studio-sidebar-runtime-entry-count={row.kind === "sidebar" ? sidebarEntryCount : undefined}
              data-studio-sidebar-runtime-protection={row.kind === "sidebar" ? "iframe-protected" : undefined}
              data-r2a-sidebar-iframe-host-count={row.kind === "sidebar" ? sidebarHostCount : undefined}
              data-r2a-sidebar-iframe-mount={row.kind === "sidebar" ? "contract-only" : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate text-xs font-medium">{row.label}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{row.value}</span>
              </div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{row.detail}</div>
            </div>
          );
        })}
      </div>
      <div
        className="grid gap-2 rounded-md border border-border bg-background/45 px-3 py-2 text-xs leading-5 text-muted-foreground"
        data-studio-sidebar-runtime-boundary
        data-studio-sidebar-runtime-protection="iframe-protected"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-foreground">Right sidebar iframe boundary</div>
          <Badge variant="warning">protected runtime</Badge>
        </div>
        <div className="max-h-44 overflow-y-auto pr-1">
          {summary.sidebarWidgetRuntimes.length ? (
            <div className="grid gap-2">
              {summary.sidebarWidgetRuntimes.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-border bg-surface/60 px-3 py-2"
                  data-studio-sidebar-runtime-item={item.id}
                  data-studio-sidebar-runtime-readiness={item.readiness}
                  data-studio-sidebar-runtime-owner={item.owner}
                  data-studio-sidebar-runtime-iframe={item.protection}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-foreground">{item.name}</span>
                    <Badge variant={item.readiness === "loadable" ? "success" : item.readiness === "invalid" ? "danger" : "default"}>
                      {item.readiness}
                    </Badge>
                  </div>
                  <div className="mt-1 break-all">
                    {item.runtime} · {item.target}
                    {item.entry ? ` · ${item.entry}` : ""}
                  </div>
                  {item.preferredHeight || item.minHeight || item.resizeMode ? (
                    <div className="mt-1">
                      {item.preferredHeight ? `preferred ${item.preferredHeight}px` : "preferred -"}
                      {item.minHeight ? ` · min ${item.minHeight}px` : ""}
                      {item.resizeMode ? ` · ${item.resizeMode}` : ""}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div>暂无可索引右侧栏组件；legacy iframe 宿主仍保留默认回退。</div>
          )}
        </div>
      </div>
      <div
        className="grid gap-2 rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-xs leading-5 text-muted-foreground"
        data-r2a-sidebar-iframe-host-contract
        data-r2a-sidebar-iframe-mount="contract-only"
        data-r2a-sidebar-iframe-message-bridge="disabled"
        data-r2a-sidebar-iframe-persistence="disabled"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-foreground">R2A iframe host contract</div>
          <Badge variant="warning">not mounted</Badge>
        </div>
        <div className="grid gap-2">
          {summary.sidebarIframeHosts.length ? summary.sidebarIframeHosts.map((host) => (
            <div
              key={host.id}
              className="rounded-md border border-border bg-surface/60 px-3 py-2"
              data-r2a-sidebar-iframe-host={host.id}
              data-r2a-sidebar-iframe-readiness={host.readiness}
              data-r2a-sidebar-iframe-theme-init={host.themeInit}
              data-r2a-sidebar-iframe-resize={host.resize}
              data-r2a-sidebar-iframe-lifecycle={host.lifecycle}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-foreground">{host.name}</span>
                <Badge variant={host.readiness === "loadable" ? "success" : host.readiness === "invalid" ? "danger" : "default"}>{host.readiness}</Badge>
              </div>
              <div className="mt-1 break-all">
                sandbox={host.sandbox} · theme {host.themeInit} · resize {host.resize} · bridge {host.messageBridge} · persistence {host.persistence}
              </div>
              {host.entryPath ? <div className="mt-1 break-all">entryPath: {host.entryPath}</div> : null}
            </div>
          )) : (
            <div>暂无 iframe host descriptor；真实 iframe mount 仍只允许 protected runtime。</div>
          )}
        </div>
        <div className="rounded-md border border-border bg-background/45 px-3 py-2">
          风险清单：不继承同源权限、不接管 resize、不写入 widget persistence、不开放 parent message bridge、不替代现有启用状态。
        </div>
      </div>
      <div
        className="grid gap-2 rounded-md border border-border bg-background/45 px-3 py-2 text-xs leading-5 text-muted-foreground"
        data-studio-terminal-mount-contract
      >
        <div className="font-medium text-foreground">Terminal mount contract</div>
        <div>工坊 Agent 工位和工作区只挂接旧 terminal IPC；xterm mount / fit / stdin / stdout 走现有 bridge，Agent 进程仍由 protected runtime 拥有。</div>
      </div>
    </div>
  );
}

function ProjectList({
  layout = "side",
  items,
  empty = "暂无作品",
  onMarkReady,
  onExportMeow,
  onRemoveProject,
  onOpenProjectFolder,
  onOpenPublishPage,
  onSelectRealProject,
  exportRecords = {},
  selectLabel = "详情",
  pendingProjectId = "",
  pendingOperation = "",
  selectedProjectId = ""
}: {
  layout?: "primary" | "side" | "management";
  items: ProjectDraft[];
  empty?: string;
  onMarkReady?: (item: ProjectDraft) => void;
  onExportMeow?: (item: ProjectDraft) => void;
  onRemoveProject?: (item: ProjectDraft) => void;
  onOpenProjectFolder?: (item: ProjectDraft) => void;
  onOpenPublishPage?: (item: ProjectDraft) => void;
  onSelectRealProject?: (item: ProjectDraft) => void;
  exportRecords?: Record<string, StudioProjectExportRecord>;
  selectLabel?: string;
  pendingProjectId?: string;
  pendingOperation?: StudioPendingOperation;
  selectedProjectId?: string;
}) {
  if (!items.length) {
    return <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">{empty}</div>;
  }

  return (
    <div
      className={cn("grid gap-2", layout === "primary" && "min-[900px]:grid-cols-2")}
      data-studio-project-list-items={layout}
    >
      {items.map((item) => {
        const sidebarEnabled = item.id ? readStudioEnabledSidebarWidgetIds().includes(item.id) : false;
        const featurePageEnabled = item.id ? readStudioEnabledFeaturePageIds().includes(item.id) : false;
        const enabled = item.type === "sidebar-widget" ? sidebarEnabled : item.type === "feature-page" ? featurePageEnabled : false;
        const exported = Boolean(item.id && exportRecords[item.id]);
        const actionNodes = [
          item.source === "real" && onSelectRealProject ? (
            <Button
              key="select"
              size="sm"
              variant={selectedProjectId === item.id ? "primary" : "outline"}
              data-studio-select-project={item.id}
              onClick={() => onSelectRealProject(item)}
            >
              <Info size={14} aria-hidden="true" />
              {selectLabel}
            </Button>
          ) : null,
          item.source === "real" && onOpenProjectFolder ? (
            <Button
              key="open-folder"
              size="sm"
              variant="outline"
              data-studio-open-project-folder={item.id}
              disabled={!item.path}
              onClick={() => onOpenProjectFolder(item)}
            >
              <FolderOpen size={14} aria-hidden="true" />
              打开目录
            </Button>
          ) : null,
          item.source === "real" && item.state !== "ready" && item.state !== "error" && onMarkReady ? (
            <Button
              key="mark-ready"
              size="sm"
              variant="outline"
              data-studio-mark-ready={item.id}
              disabled={pendingProjectId === item.id && pendingOperation === "mark-ready"}
              onClick={() => onMarkReady(item)}
            >
              {pendingProjectId === item.id && pendingOperation === "mark-ready" ? "处理中" : "标记可用"}
            </Button>
          ) : null,
          item.source === "real" && item.state !== "error" && onExportMeow ? (
            <Button
              key="export-meow"
              size="sm"
              variant="outline"
              data-studio-export-meow={item.id}
              disabled={pendingProjectId === item.id && pendingOperation === "export"}
              onClick={() => onExportMeow(item)}
            >
              <Archive size={14} aria-hidden="true" />
              {pendingProjectId === item.id && pendingOperation === "export" ? "生成中" : "生成 .meow"}
            </Button>
          ) : null,
          item.source === "real" && item.state !== "error" && onOpenPublishPage ? (
            <Button
              key="publish"
              size="sm"
              variant="primary"
              data-studio-project-publish-entry={item.id}
              onClick={() => onOpenPublishPage(item)}
            >
              <Upload size={14} aria-hidden="true" />
              发布
            </Button>
          ) : null,
          onRemoveProject ? (
            <Button
              key="remove"
              size="sm"
              variant="outline"
              className="text-danger hover:text-danger"
              data-studio-remove-project={item.id || item.name}
              onClick={() => onRemoveProject(item)}
            >
              <Trash2 size={14} aria-hidden="true" />
              {item.source === "real" ? "移除" : "删除"}
            </Button>
          ) : null
        ].filter((node): node is ReactElement => Boolean(node));
        const collapseActions = actionNodes.length > 1;
        return (
          <div
            key={item.id || item.name}
            data-studio-project-item={item.name}
            data-studio-real-project-item={item.source === "real" ? item.name : undefined}
            data-studio-selected-project={item.id && selectedProjectId === item.id ? item.id : undefined}
            data-studio-project-enabled={enabled ? "true" : undefined}
            data-studio-project-exported={exported ? "true" : undefined}
            className={cn(
              "relative rounded-md border border-border bg-background/55 px-3 py-2",
              collapseActions && "meowdesk-card-action-menu-card",
              layout === "management" && "bg-surface/70 px-4 py-3",
              item.id && selectedProjectId === item.id && "border-primary/45 bg-primary/10",
              item.state === "error" && "border-danger/45 bg-danger/10"
            )}
          >
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-medium">{item.name}</div>
            <Badge
              data-studio-project-state={item.id || item.name}
              variant={projectStateBadgeVariant(item.state)}
            >
              {item.state}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {studioProjectTypeLabel(item.type)}
            {item.source === "real" ? " · 本机项目" : ""}
            {item.version ? ` · v${item.version}` : ""}
          </div>
          {item.source === "real" ? (
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs" data-studio-project-state-strip={item.id || item.name}>
              <Badge variant={item.entryPath ? "success" : "default"}>{item.entryPath ? "入口可加载" : "待写入口"}</Badge>
              <Badge variant={enabled ? "primary" : "default"}>{enabled ? "已启用" : "未启用"}</Badge>
              <Badge variant={exported ? "success" : "default"}>{exported ? "已导出" : "未导出"}</Badge>
            </div>
          ) : null}
          {item.summary ? <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.summary}</div> : null}
          {item.error ? (
            <div className="mt-2 rounded-md border border-danger/35 bg-danger/10 px-2 py-1.5 text-xs leading-5 text-danger" data-studio-project-error={item.id || item.name}>
              {item.error}
            </div>
          ) : null}
          {actionNodes.length ? (
            collapseActions ? (
              <CardActionMenu className="meowdesk-studio-project-card-action-menu" contentClassName="meowdesk-studio-project-card-action-menu-content">
                {actionNodes}
              </CardActionMenu>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {actionNodes}
              </div>
            )
          ) : null}
        </div>
        );
      })}
    </div>
  );
}

function ProjectDetailPanel({
  item,
  lastLoadedAt,
  pendingProjectId = "",
  pendingOperation = "",
  exportRecord,
  publishRecord,
  onMarkReady,
  onExportMeow,
  onOpenProjectFolder,
  onOpenPublishPage,
  onContinueProject,
  embedded = false
}: {
  item?: WorkbenchExtensionSummary;
  lastLoadedAt?: number;
  pendingProjectId?: string;
  pendingOperation?: StudioPendingOperation;
  exportRecord?: StudioProjectExportRecord;
  publishRecord?: StudioProjectPublishRecord;
  onMarkReady?: (item: ProjectDraft) => void;
  onExportMeow?: (item: ProjectDraft) => void;
  onOpenProjectFolder?: (item: ProjectDraft) => void;
  onOpenPublishPage?: (item: WorkbenchExtensionSummary) => void;
  onContinueProject?: (item: ProjectDraft) => void;
  embedded?: boolean;
}) {
  const body = (
    <>
      {!item ? (
        <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          暂无本机工坊项目。刷新后仍为空时，说明当前 Meowdesk Home 还没有可索引作品。
        </div>
      ) : (
        <div className="grid gap-3 text-xs" data-studio-project-detail-id={item.id}>
          <div>
            <div className="text-sm font-medium" data-studio-project-detail-name>{item.name}</div>
            {item.summary ? <p className="mt-2 leading-5 text-muted-foreground">{item.summary}</p> : null}
            {item.error ? (
              <div className="mt-3 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-danger" data-studio-project-detail-error>
                <div className="font-medium">清单读取失败</div>
                <div className="mt-1 leading-5">{item.error}</div>
              </div>
            ) : null}
          </div>
          <div className="grid gap-2 rounded-md border border-border bg-background/55 p-3">
            <DetailRow label="ID" value={item.id} />
            <DetailRow label="类型" value={item.type} />
            <DetailRow label="版本" value={item.version || "-"} />
            <DetailRow label="状态" value={item.status} />
            <DetailRow label="运行时" value={item.runtime || "-"} />
            <DetailRow label="入口" value={item.entry || "-"} />
            <DetailRow label="路径" value={item.path || "-"} muted />
            <DetailRow label="入口文件" value={item.entryPath || "-"} muted />
            <DetailRow label="Manifest" value={item.manifestPath || "-"} muted />
            <DetailRow label="修改时间" value={formatModifiedAt(item.modifiedAt)} />
            <DetailRow label="创建时间" value={formatModifiedAt(item.createdAt)} />
            {item.error ? <DetailRow label="错误" value={item.error} muted /> : null}
          </div>
          <ProjectArtifactReadiness item={item} />
          <ProjectDetailActions
            item={item}
            pendingProjectId={pendingProjectId}
            pendingOperation={pendingOperation}
            exportRecord={exportRecord}
            onMarkReady={onMarkReady}
            onExportMeow={onExportMeow}
            onOpenProjectFolder={onOpenProjectFolder}
            onContinueProject={onContinueProject}
          />
          <ProjectPublishSummaryPanel
            item={item}
            publishRecord={publishRecord}
            onOpenPublishPage={onOpenPublishPage}
          />
          <ProjectPreviewPanel item={item} />
          {item.versions.length ? (
            <div className="grid gap-2 rounded-md border border-border bg-background/55 p-3" data-studio-project-version-list>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">版本历史</span>
                <Badge>{item.versions.length}</Badge>
              </div>
              <div className="grid gap-2">
                {item.versions.map((version) => (
                  <div
                    key={version.key}
                    className="rounded-md border border-border bg-surface/60 px-3 py-2"
                    data-studio-project-version-item={version.key}
                    data-studio-project-version-current={version.current ? "true" : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{version.label || version.version || version.key}</span>
                      <Badge variant={version.current ? "success" : "default"}>{version.current ? "current" : version.status || "snapshot"}</Badge>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {version.runtime || "-"}
                      {version.entry ? ` · ${version.entry}` : ""}
                      {version.modifiedAt ? ` · ${formatModifiedAt(version.modifiedAt)}` : ""}
                    </div>
                    {version.summary ? <div className="mt-2 line-clamp-2 leading-5 text-muted-foreground">{version.summary}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="grid gap-3" data-studio-project-detail>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">本机项目详情</div>
            <div className="text-xs text-muted-foreground">
              {lastLoadedAt ? `上次读取 ${new Date(lastLoadedAt).toLocaleTimeString()}` : "等待本机工坊摘要"}
            </div>
          </div>
          {item ? (
            <Badge data-studio-project-detail-status variant={item.error || item.status === "error" ? "danger" : "default"}>
              {item.status}
            </Badge>
          ) : (
            <Badge variant="warning">empty</Badge>
          )}
        </div>
        {body}
      </div>
    );
  }

  return (
    <Panel data-studio-project-detail>
      <PanelHeader>
        <div>
          <div className="text-sm font-semibold">本机项目详情</div>
          <div className="text-xs text-muted-foreground">
            {lastLoadedAt ? `上次读取 ${new Date(lastLoadedAt).toLocaleTimeString()}` : "等待本机工坊摘要"}
          </div>
        </div>
        {item ? (
          <Badge data-studio-project-detail-status variant={item.error || item.status === "error" ? "danger" : "default"}>
            {item.status}
          </Badge>
        ) : (
          <Badge variant="warning">empty</Badge>
        )}
      </PanelHeader>
      <PanelBody>{body}</PanelBody>
    </Panel>
  );
}

function ProjectArtifactReadiness({ item }: { item: WorkbenchExtensionSummary }) {
  const expectedTarget = item.type === "sidebar-widget" ? "workspace-sidebar" : "main-nav";
  const expectedRuntime = workshopRuntimeForType(item.type === "sidebar-widget" ? "sidebar-widget" : "feature-page");
  const rows = [
    {
      id: "manifest",
      label: "Manifest",
      value: item.manifestPath ? "已索引" : "缺失",
      ready: Boolean(item.manifestPath) && !item.error
    },
    {
      id: "entry",
      label: "入口文件",
      value: item.entryPath ? "可加载" : "未生成",
      ready: Boolean(item.entryPath)
    },
    {
      id: "target",
      label: "目标位置",
      value: item.target || "-",
      ready: !item.target || item.target === expectedTarget
    },
    {
      id: "runtime",
      label: "运行时",
      value: item.runtime || "-",
      ready: !item.runtime || item.runtime === expectedRuntime || item.runtime === "html"
    },
    {
      id: "ready",
      label: "可用状态",
      value: item.status,
      ready: item.status === "ready" || item.status === "enabled" || item.status === "published"
    }
  ];
  return (
    <div className="grid gap-2 rounded-md border border-border bg-background/55 p-3" data-studio-project-readiness={item.id}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
          作品可用性
        </div>
      </div>
      <div className="grid gap-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[minmax(0,92px)_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-surface/60 px-2 py-1.5"
            data-studio-project-readiness-item={row.id}
            data-studio-project-readiness-state={row.ready ? "ready" : "pending"}
          >
            <span className="truncate text-muted-foreground">{row.label}</span>
            <span className="truncate">{row.value}</span>
            <Badge variant={row.ready ? "success" : "default"}>{row.ready ? "ok" : "wait"}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function projectPublishCheckMap(item: WorkbenchExtensionSummary): Record<string, boolean> {
  return {
    manifest: Boolean(item.manifestPath) && !item.error,
    entry: Boolean(item.entryPath) && !item.error,
    type: item.type === "sidebar-widget" || item.type === "feature-page",
    preview: Boolean(item.entryPath) && !item.error
  };
}

function projectPublishChecks(item: WorkbenchExtensionSummary) {
  const checks = projectPublishCheckMap(item);
  return [
    { id: "manifest", label: "Manifest", ready: checks.manifest, detail: item.manifestPath ? "已索引" : "缺失" },
    { id: "entry", label: "入口", ready: checks.entry, detail: item.entryPath ? "可加载" : "待写入口" },
    { id: "type", label: "类型", ready: checks.type, detail: studioProjectTypeLabel(item.type as ProjectDraftType) },
    { id: "preview", label: "预览", ready: checks.preview, detail: item.entryPath ? "可做本地预览" : "等待入口文件" }
  ];
}

function ProjectDetailActions({
  item,
  pendingProjectId,
  pendingOperation,
  exportRecord,
  onMarkReady,
  onExportMeow,
  onOpenProjectFolder,
  onContinueProject
}: {
  item: WorkbenchExtensionSummary;
  pendingProjectId: string;
  pendingOperation: StudioPendingOperation;
  exportRecord?: StudioProjectExportRecord;
  onMarkReady?: (item: ProjectDraft) => void;
  onExportMeow?: (item: ProjectDraft) => void;
  onOpenProjectFolder?: (item: ProjectDraft) => void;
  onContinueProject?: (item: ProjectDraft) => void;
}) {
  const [sidebarEnabled, setSidebarEnabled] = useState(() => readStudioEnabledSidebarWidgetIds().includes(item.id));
  const [featurePageEnabled, setFeaturePageEnabled] = useState(() => readStudioEnabledFeaturePageIds().includes(item.id));
  const project = realExtensionToProject(item);
  const isReady = item.status === "ready" || item.status === "enabled" || item.status === "published";
  const canEnableSidebar = item.type === "sidebar-widget" && Boolean(item.entryPath) && !item.error;
  const canEnableFeaturePage = item.type === "feature-page" && Boolean(item.entryPath) && !item.error;
  const markingReady = pendingProjectId === item.id && pendingOperation === "mark-ready";
  const exporting = pendingProjectId === item.id && pendingOperation === "export";

  useEffect(() => {
    const refresh = () => setSidebarEnabled(readStudioEnabledSidebarWidgetIds().includes(item.id));
    refresh();
    window.addEventListener("meowdesk:workspace-toggle-sidebar-widget", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("meowdesk:workspace-toggle-sidebar-widget", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [item.id]);

  useEffect(() => {
    const refresh = () => setFeaturePageEnabled(readStudioEnabledFeaturePageIds().includes(item.id));
    refresh();
    window.addEventListener("meowdesk:workspace-toggle-feature-page", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("meowdesk:workspace-toggle-feature-page", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [item.id]);

  const toggleSidebarEnabled = () => {
    if (!canEnableSidebar) return;
    const current = readStudioEnabledSidebarWidgetIds();
    const nextEnabled = !current.includes(item.id);
    const nextIds = nextEnabled ? [...current, item.id] : current.filter((id) => id !== item.id);
    writeStudioEnabledSidebarWidgetIds(nextIds);
    setSidebarEnabled(nextEnabled);
    window.dispatchEvent(new CustomEvent("meowdesk:workspace-toggle-sidebar-widget", {
      detail: { id: item.id, enabled: nextEnabled }
    }));
  };

  const toggleFeaturePageEnabled = () => {
    if (!canEnableFeaturePage) return;
    const current = readStudioEnabledFeaturePageIds();
    const nextEnabled = !current.includes(item.id);
    const nextIds = nextEnabled ? [...current, item.id] : current.filter((id) => id !== item.id);
    writeStudioEnabledFeaturePageIds(nextIds);
    setFeaturePageEnabled(nextEnabled);
    window.dispatchEvent(new CustomEvent("meowdesk:workspace-toggle-feature-page", {
      detail: { id: item.id, enabled: nextEnabled }
    }));
  };

  return (
    <div className="meowdesk-card-surface relative grid gap-2 rounded-md border border-border bg-background/55 p-3 pr-12" data-studio-project-action-bar={item.id}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">作品动作</div>
        <Badge variant={isReady ? "success" : item.error ? "danger" : "warning"}>{isReady ? "ready" : item.status}</Badge>
      </div>
      <CardActionMenu>
        {onContinueProject ? (
          <Button
            size="sm"
            variant="primary"
            data-studio-project-continue-agent={item.id}
            disabled={Boolean(item.error)}
            onClick={() => onContinueProject(project)}
          >
            <Bot size={14} aria-hidden="true" />
            Agent 继续制作
          </Button>
        ) : null}
        {onOpenProjectFolder ? (
          <Button
            size="sm"
            variant="outline"
            data-studio-project-open-folder={item.id}
            disabled={!item.path}
            onClick={() => onOpenProjectFolder(project)}
          >
            <FolderOpen size={14} aria-hidden="true" />
            打开目录
          </Button>
        ) : null}
        {onMarkReady ? (
          <Button
            size="sm"
            variant="outline"
            data-studio-project-detail-mark-ready={item.id}
            disabled={isReady || Boolean(item.error) || markingReady}
            onClick={() => onMarkReady(project)}
          >
            <CheckCircle2 size={14} aria-hidden="true" />
            {markingReady ? "处理中" : isReady ? "已可用" : "标记可用"}
          </Button>
        ) : null}
        {item.type === "sidebar-widget" ? (
          <Button
            size="sm"
            variant={sidebarEnabled ? "primary" : "outline"}
            data-studio-project-enable-sidebar={item.id}
            data-studio-project-enable-sidebar-state={sidebarEnabled ? "enabled" : "disabled"}
            disabled={!canEnableSidebar}
            onClick={toggleSidebarEnabled}
          >
            <Boxes size={14} aria-hidden="true" />
            {sidebarEnabled ? "已启用到工作区" : "启用到工作区"}
          </Button>
        ) : null}
        {item.type === "feature-page" ? (
          <Button
            size="sm"
            variant={featurePageEnabled ? "primary" : "outline"}
            data-studio-project-enable-feature-page={item.id}
            data-studio-project-enable-feature-page-state={featurePageEnabled ? "enabled" : "disabled"}
            disabled={!canEnableFeaturePage}
            onClick={toggleFeaturePageEnabled}
          >
            <GalleryVerticalEnd size={14} aria-hidden="true" />
            {featurePageEnabled ? "已启用为功能页" : "启用为功能页"}
          </Button>
        ) : null}
        {onExportMeow ? (
          <Button
            size="sm"
            variant="outline"
            data-studio-project-detail-export-meow={item.id}
            disabled={Boolean(item.error) || exporting}
            onClick={() => onExportMeow(project)}
          >
            <Archive size={14} aria-hidden="true" />
            {exporting ? "生成中" : "生成 .meow"}
          </Button>
        ) : null}
      </CardActionMenu>
      {exportRecord ? (
        <div className="rounded-md border border-border bg-surface/60 px-3 py-2 text-xs text-muted-foreground" data-studio-project-export-record={item.id}>
          最近导出：{new Date(exportRecord.exportedAt).toLocaleString()}
          <div className="mt-1 break-all">{exportRecord.packagePath}</div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectPublishSummaryPanel({
  item,
  publishRecord,
  onOpenPublishPage
}: {
  item: WorkbenchExtensionSummary;
  publishRecord?: StudioProjectPublishRecord;
  onOpenPublishPage?: (item: WorkbenchExtensionSummary) => void;
}) {
  const checks = projectPublishChecks(item);
  return (
    <div className="meowdesk-card-surface relative grid gap-2 rounded-md border border-border bg-background/55 p-3 pr-12 text-xs" data-studio-project-publish-status-card={item.id}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">发布状态</div>
      </div>
      <CardActionMenu>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={!onOpenPublishPage || Boolean(item.error)}
          onClick={() => onOpenPublishPage?.(item)}
          data-studio-project-open-publish={item.id}
        >
          <Upload size={14} aria-hidden="true" />
          去发布
        </Button>
      </CardActionMenu>
    </div>
  );
}

function ProjectPublishDraftActions({
  item,
  publishRecord,
  allChecksReady,
  publishing,
  installing,
  saveDraft,
  runPublishTest,
  onRunPublishTest,
  onRunInstallTest
}: {
  item: WorkbenchExtensionSummary;
  publishRecord?: StudioProjectPublishRecord;
  allChecksReady: boolean;
  publishing: boolean;
  installing: boolean;
  saveDraft: () => StudioProjectPublishDraft;
  runPublishTest: () => void;
  onRunPublishTest?: (item: WorkbenchExtensionSummary, draft: StudioProjectPublishDraft) => void;
  onRunInstallTest?: (item: WorkbenchExtensionSummary) => void;
}) {
  return (
    <CardActionMenu>
      <Button type="button" size="sm" variant="outline" onClick={saveDraft} data-studio-project-publish-save={item.id}>
        <Save size={14} aria-hidden="true" />
        保存草稿
      </Button>
      <Button
        type="button"
        size="sm"
        variant="primary"
        disabled={!allChecksReady || !onRunPublishTest || publishing || installing}
        onClick={runPublishTest}
        data-studio-project-publish-test={item.id}
      >
        <Archive size={14} aria-hidden="true" />
        {publishing ? "发布中" : "发布测试"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!publishRecord?.packagePath || !onRunInstallTest || publishing || installing}
        onClick={() => onRunInstallTest?.(item)}
        data-studio-project-install-test={item.id}
      >
        <CheckCircle2 size={14} aria-hidden="true" />
        {installing ? "测试中" : "安装测试"}
      </Button>
    </CardActionMenu>
  );
}

function ProjectPublishDraftPanel({
  item,
  pendingProjectId = "",
  pendingOperation = "",
  publishRecord,
  onRunPublishTest,
  onRunInstallTest
}: {
  item: WorkbenchExtensionSummary;
  pendingProjectId?: string;
  pendingOperation?: StudioPendingOperation;
  publishRecord?: StudioProjectPublishRecord;
  onRunPublishTest?: (item: WorkbenchExtensionSummary, draft: StudioProjectPublishDraft) => void;
  onRunInstallTest?: (item: WorkbenchExtensionSummary) => void;
}) {
  const initialDraft = () => {
    const saved = readStudioProjectPublishDrafts()[item.id];
    return {
      title: saved?.title || item.name || "",
      summary: saved?.summary || item.summary || "",
      changelog: saved?.changelog || "",
      version: saved?.version || item.version || "0.1.0"
    };
  };
  const [draft, setDraft] = useState<StudioProjectPublishDraft>(initialDraft);
  const [savedAt, setSavedAt] = useState<number>(0);
  const checks = projectPublishChecks(item);
  const allChecksReady = checks.every((check) => check.ready);
  const publishing = pendingProjectId === item.id && pendingOperation === "publish";
  const installing = pendingProjectId === item.id && pendingOperation === "install-test";

  useEffect(() => {
    const saved = readStudioProjectPublishDrafts()[item.id];
    setDraft({
      title: saved?.title || item.name || "",
      summary: saved?.summary || item.summary || "",
      changelog: saved?.changelog || "",
      version: saved?.version || item.version || "0.1.0"
    });
    setSavedAt(0);
  }, [item.id, item.name, item.summary, item.version]);

  const normalizedDraft = () => ({
    title: draft.title.trim() || item.name,
    summary: draft.summary.trim(),
    changelog: draft.changelog.trim(),
    version: draft.version.trim() || item.version || "0.1.0"
  });

  const saveDraft = () => {
    const next = normalizedDraft();
    writeStudioProjectPublishDraft(item.id, next);
    setDraft(next);
    setSavedAt(Date.now());
    return next;
  };

  const runPublishTest = () => {
    const next = normalizedDraft();
    writeStudioProjectPublishDraft(item.id, next);
    setDraft(next);
    setSavedAt(Date.now());
    onRunPublishTest?.(item, next);
  };

  return (
    <div className="meowdesk-card-surface relative grid gap-3 rounded-md border border-border bg-background/55 p-3 pr-12 text-xs" data-studio-project-publish-draft={item.id}>
      <ProjectPublishDraftActions
        item={item}
        publishRecord={publishRecord}
        allChecksReady={allChecksReady}
        publishing={publishing}
        installing={installing}
        saveDraft={saveDraft}
        runPublishTest={runPublishTest}
        onRunPublishTest={onRunPublishTest}
        onRunInstallTest={onRunInstallTest}
      />
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">本地发布测试</div>
          <div className="mt-1 text-muted-foreground">填写发布信息，生成本机 .meow 包并做隔离安装测试。</div>
        </div>
        {savedAt ? <Badge variant="success" data-studio-project-publish-draft-saved={item.id}>已保存</Badge> : <Badge>local</Badge>}
      </div>
      <label className="grid gap-1">
        <span className="font-medium text-muted-foreground">标题</span>
        <Input
          value={draft.title}
          maxLength={64}
          data-studio-project-publish-title={item.id}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
        />
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
        <label className="grid gap-1">
          <span className="font-medium text-muted-foreground">类型</span>
          <div className="flex h-9 items-center rounded-md border border-border bg-background/45 px-3 text-sm" data-studio-project-publish-type={item.id}>
            {studioProjectTypeLabel(item.type as ProjectDraftType)}
          </div>
        </label>
        <label className="grid gap-1">
          <span className="font-medium text-muted-foreground">版本</span>
          <Input
            value={draft.version}
            maxLength={40}
            data-studio-project-publish-version={item.id}
            onChange={(event) => setDraft((current) => ({ ...current, version: event.target.value }))}
          />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="font-medium text-muted-foreground">简介</span>
        <textarea
          className="min-h-20 resize-y rounded-md border border-border bg-background/60 px-3 py-2 text-sm leading-5 outline-none transition focus:border-primary/55"
          value={draft.summary}
          maxLength={500}
          data-studio-project-publish-summary={item.id}
          onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
        />
      </label>
      <label className="grid gap-1">
        <span className="font-medium text-muted-foreground">更新记录</span>
        <textarea
          className="min-h-24 resize-y rounded-md border border-border bg-background/60 px-3 py-2 text-sm leading-5 outline-none transition focus:border-primary/55"
          value={draft.changelog}
          maxLength={1200}
          data-studio-project-publish-changelog={item.id}
          onChange={(event) => setDraft((current) => ({ ...current, changelog: event.target.value }))}
        />
      </label>
      <div className="grid gap-2 rounded-md border border-border bg-surface/55 p-2" data-studio-project-publish-checks={item.id}>
        <div className="font-medium">发布前检查</div>
        {checks.map((check) => (
          <div
            key={check.id}
            className="flex items-center justify-between gap-2 rounded border border-border bg-background/45 px-2 py-1.5"
            data-studio-project-publish-check={check.id}
            data-studio-project-publish-check-state={check.ready ? "ready" : "wait"}
          >
            <span>{check.label}</span>
            <span className="min-w-0 truncate text-muted-foreground">{check.detail}</span>
            <Badge variant={check.ready ? "success" : "default"}>{check.ready ? "ok" : "wait"}</Badge>
          </div>
        ))}
      </div>
      {publishRecord ? (
        <div className="rounded-md border border-border bg-surface/60 px-3 py-2 text-muted-foreground" data-studio-project-publish-record={item.id}>
          本地发布：{new Date(publishRecord.publishedAt).toLocaleString()} · v{publishRecord.version || "-"}
          <div className="mt-1 break-all">{publishRecord.packagePath}</div>
          {publishRecord.installTest ? (
            <div className="mt-2 rounded border border-border bg-background/45 px-2 py-1.5" data-studio-project-install-test-record={item.id}>
              安装测试：{new Date(publishRecord.installTest.testedAt).toLocaleString()} · {publishRecord.installTest.installMode}
              {publishRecord.installTest.existingProjectName ? ` · 已存在 ${publishRecord.installTest.existingProjectName}` : ""}
              <div className="mt-1 break-all">{publishRecord.installTest.testInstallPath}</div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">正式社区发布后续由联网生态接管；当前只做本机发布演练。</span>
      </div>
    </div>
  );
}

function ProjectPreviewPanel({ item }: { item: WorkbenchExtensionSummary }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const src = useMemo(() => {
    const url = fileUrlFromPath(item.entryPath);
    if (!url) return "";
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}meowdeskStudioPreview=${encodeURIComponent(item.id)}`;
  }, [item.entryPath, item.id]);
  const isSidebarWidget = item.type === "sidebar-widget";

  const syncPreviewFrame = useCallback(() => {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    try {
      frame.contentWindow.postMessage({
        source: "meodesk",
        type: "meodesk:init",
        protocol: "meodesk.host.v0",
        host: {
          app: "Meowdesk",
          surface: isSidebarWidget ? "workspace-sidebar" : "feature-page",
          chrome: isSidebarWidget ? "minimal" : "host",
          themeMode: "inherit",
          tokenProtocol: "meodesk.theme.v0"
        },
        extension: {
          id: item.id,
          name: item.name,
          type: item.type,
          target: item.target || (isSidebarWidget ? "workspace-sidebar" : "main-nav"),
          version: item.version || "",
          runtime: item.runtime || workshopRuntimeForType(isSidebarWidget ? "sidebar-widget" : "feature-page")
        },
        container: {
          width: Math.round(frame.getBoundingClientRect().width || 0),
          height: Math.round(frame.getBoundingClientRect().height || 0),
          devicePixelRatio: window.devicePixelRatio || 1
        }
      }, "*");
    } catch {
      // Preview frames may still be navigating or sandboxed.
    }
  }, [isSidebarWidget, item.id, item.name, item.runtime, item.target, item.type, item.version]);

  useEffect(() => {
    if (!src) return;
    for (const delay of [80, 240, 600]) {
      window.setTimeout(syncPreviewFrame, delay);
    }
  }, [src, syncPreviewFrame]);

  return (
    <div
      className="grid gap-2 rounded-md border border-border bg-background/55 p-3"
      data-studio-project-preview={item.id}
      data-studio-project-preview-state={src ? "loadable" : "missing-entry"}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <FileCode2 size={14} className="text-primary" aria-hidden="true" />
          本机预览
        </div>
        <Badge variant={src ? "success" : "default"}>{src ? "loadable" : "pending"}</Badge>
      </div>
      {src ? (
        <div
          className={cn(
            "overflow-hidden rounded-md border border-border bg-surface/70",
            isSidebarWidget ? "h-[280px]" : "h-[340px]"
          )}
          data-studio-project-preview-frame={item.id}
          data-studio-project-preview-kind={isSidebarWidget ? "sidebar-widget" : "feature-page"}
        >
          <iframe
            ref={frameRef}
            className="h-full w-full bg-background"
            src={src}
            title={`${item.name} 预览`}
            sandbox="allow-scripts allow-forms"
            data-studio-project-preview-iframe={item.id}
            onLoad={syncPreviewFrame}
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground" data-studio-project-preview-empty={item.id}>
          入口文件未生成，等待 Agent 写入 manifest.entry 对应文件。
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid gap-1 min-[560px]:grid-cols-[64px_minmax(0,1fr)]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("break-all", muted && "text-muted-foreground")}>{value}</span>
    </div>
  );
}

function formatModifiedAt(value?: number) {
  return value ? new Date(value).toLocaleString() : "-";
}

function normalizeProjectType(type: string): ProjectDraftType {
  if (type === "sidebar-widget" || type === "feature-page") return type;
  return "other";
}

function normalizeProjectState(status: string): ProjectState {
  if (status === "ready" || status === "enabled" || status === "published") return "ready";
  if (status === "review") return "review";
  if (status === "error") return "error";
  return "draft";
}

function projectStateBadgeVariant(state: ProjectState): "success" | "primary" | "danger" | "default" {
  if (state === "ready") return "success";
  if (state === "review") return "primary";
  if (state === "error") return "danger";
  return "default";
}

function realExtensionToProject(item: WorkbenchExtensionSummary, forceReady = false): ProjectDraft {
  return {
    id: item.id,
    name: item.name,
    type: normalizeProjectType(item.type),
    state: item.error ? "error" : forceReady ? "ready" : normalizeProjectState(item.status),
    summary: item.summary,
    version: item.version,
    error: item.error,
    source: "real",
    path: item.path,
    entryPath: item.entryPath
  };
}

function studioProjectTypeLabel(type: ProjectDraftType) {
  if (type === "sidebar-widget") return "右侧栏组件";
  if (type === "feature-page") return "功能页";
  return "其他扩展";
}

function StudioType({
  icon: Icon,
  title,
  copy,
  active = false,
  onClick
}: {
  icon: typeof GalleryVerticalEnd;
  title: string;
  copy: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-background/55 p-3 text-left transition-colors hover:bg-accent",
        active && "border-primary/45 bg-primary/10"
      )}
    >
      <Icon size={18} className={cn("mt-0.5 text-muted-foreground", active && "text-primary")} aria-hidden="true" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{copy}</span>
      </span>
    </button>
  );
}

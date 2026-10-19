import { useEffect, useMemo, useState } from "react";
import type * as React from "react";
import { Activity, Bot, CalendarDays, ChevronLeft, ChevronRight, Clock, Columns3, Hash, Pencil, RefreshCw, RotateCcw, Save, Sparkles, Tags, Trash2, User } from "lucide-react";
import type { WorkbenchSummary } from "@/app/use-workbench-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardActionMenu } from "@/components/ui/card-action-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { readTaskCenterTasks, writeTaskCenterTasks } from "@/lib/workbench-api";
import type { TaskCenterTask, TaskCenterTaskStatus } from "@/lib/workbench-api";
import { cn } from "@/lib/utils";
import { LegacyHandoff, RouteFrame } from "../readiness/readiness-shared";

export const taskStatusLabels: Record<TaskCenterTaskStatus, string> = {
  inbox: "待确认",
  todo: "待办",
  doing: "进行中",
  blocked: "阻塞",
  done: "完成"
};

export const taskStatusOrder: TaskCenterTaskStatus[] = ["inbox", "todo", "doing", "blocked", "done"];

export function nowStamp() {
  return Date.now();
}

export function nextTaskId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `task-${Date.now().toString(36)}`;
}

export function todayKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function nextTaskStatus(status: TaskCenterTaskStatus): TaskCenterTaskStatus {
  if (status === "done") return "todo";
  if (status === "doing") return "done";
  if (status === "blocked") return "doing";
  return "doing";
}

export function taskStatusBadge(status: TaskCenterTaskStatus): "success" | "primary" | "warning" | "danger" | "default" {
  if (status === "done") return "success";
  if (status === "doing") return "primary";
  if (status === "blocked") return "danger";
  if (status === "todo") return "warning";
  return "default";
}

export function priorityBadge(priority?: string): "danger" | "primary" | "default" {
  if (priority === "high") return "danger";
  if (priority === "medium") return "primary";
  return "default";
}

export function priorityLabel(priority?: string) {
  if (priority === "high") return "高";
  if (priority === "low") return "低";
  return "中";
}

export function taskTimeValue(task: TaskCenterTask) {
  const date = task.scheduledDate || "";
  const time = task.scheduledTime || "";
  if (!date && !time) return "未安排";
  return [date, time].filter(Boolean).join(" ");
}

export function sortTasks(tasks: TaskCenterTask[]) {
  return [...tasks].sort((a, b) => {
    const aStatus = taskStatusOrder.indexOf(a.status);
    const bStatus = taskStatusOrder.indexOf(b.status);
    if (aStatus !== bStatus) return aStatus - bStatus;
    return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
  });
}

export type TaskCenterTab = "ai" | "mine" | "calendar" | "week" | "today" | "matrix" | "habits";

export type TaskAction = "accept" | "start" | "done" | "block" | "archive" | "today" | "schedule" | "delete";
type TaskDialogMode = "create" | "edit" | null;

type TaskTagGroup = {
  tag: string;
  label: string;
  tasks: TaskCenterTask[];
  firstCreatedAt: number;
};

export const TASK_CENTER_TASKS_CHANGED_EVENT = "meowdesk:task-center-tasks-changed";

export const taskCenterTabs: Array<{ id: TaskCenterTab; label: string; icon: typeof Sparkles }> = [
  { id: "ai", label: "AI任务", icon: Sparkles },
  { id: "mine", label: "我的任务", icon: User },
  { id: "calendar", label: "月视图", icon: CalendarDays },
  { id: "week", label: "周视图", icon: CalendarDays },
  { id: "today", label: "日程", icon: Clock },
  { id: "matrix", label: "四象限", icon: Columns3 },
  { id: "habits", label: "每日打卡", icon: RotateCcw }
];

export function dateKeyFromDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function monthKeyFromDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function parseDateKey(value: string) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function parseMonthKey(value: string) {
  const normalized = /^\d{4}-\d{2}$/.test(value) ? value : monthKeyFromDate();
  const [year, month] = normalized.split("-").map(Number);
  return { key: normalized, year, month };
}

export function shiftDateKey(value: string, delta: number) {
  const date = parseDateKey(value || todayKey());
  date.setDate(date.getDate() + delta);
  return dateKeyFromDate(date);
}

export function shiftMonthKey(value: string, delta: number) {
  const { year, month } = parseMonthKey(value || monthKeyFromDate());
  return monthKeyFromDate(new Date(year, month - 1 + delta, 1));
}

export function normalizeTaskOrigin(task: TaskCenterTask): "ai" | "user" {
  const raw = String(task.origin || "").trim().toLowerCase();
  if (["user", "mine", "manual", "personal", "me", "我的", "用户", "手动"].includes(raw)) return "user";
  return "ai";
}

export function taskOriginLabel(task: TaskCenterTask) {
  return normalizeTaskOrigin(task) === "user" ? "我的任务" : "AI任务";
}

export function taskSourceLabel(task: TaskCenterTask) {
  return String(task.source || (normalizeTaskOrigin(task) === "user" ? "我" : "Meowdesk")).trim() || "Meowdesk";
}

export function taskSourceInitial(task: TaskCenterTask) {
  const label = taskSourceLabel(task);
  if (/claude/i.test(label)) return "C";
  if (/hermes/i.test(label)) return "H";
  if (/codex/i.test(label)) return "X";
  if (/meow|meodesk|workflow|agent/i.test(label)) return "M";
  return label.slice(0, 1).toUpperCase();
}

export function taskSourceTone(task: TaskCenterTask) {
  const label = taskSourceLabel(task).toLowerCase();
  if (normalizeTaskOrigin(task) === "user") return "border-muted-foreground/25 bg-muted/45 text-muted-foreground";
  if (label.includes("claude")) return "border-warning/35 bg-warning/10 text-warning";
  if (label.includes("hermes")) return "border-primary/35 bg-primary/10 text-primary";
  if (label.includes("codex")) return "border-success/35 bg-success/10 text-success";
  return "border-primary/35 bg-primary/10 text-primary";
}

export function TaskSourceIcon({ task, size = "md" }: { task: TaskCenterTask; size?: "sm" | "md" }) {
  const isAi = normalizeTaskOrigin(task) === "ai";
  const label = taskSourceLabel(task);
  const compact = size === "sm";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md border font-semibold",
        compact ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs",
        taskSourceTone(task)
      )}
      title={label}
      aria-label={`来源：${label}`}
      data-r15-task-source-icon={task.id}
    >
      {isAi ? <Bot size={compact ? 13 : 15} aria-hidden="true" /> : taskSourceInitial(task)}
    </span>
  );
}

export function taskIsDone(task: TaskCenterTask) {
  return task.status === "done" || Boolean(task.archived);
}

export function taskIsActive(task: TaskCenterTask) {
  return !taskIsDone(task);
}

export function normalizePrimaryTaskTag(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "unsorted";
  return raw.replace(/^#+/, "").trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "") || "unsorted";
}

export function taskPrimaryTag(task: TaskCenterTask) {
  return normalizePrimaryTaskTag(task.tag || task.tags?.[0] || "unsorted");
}

export function taskTagDisplayName(tag: string) {
  const normalized = normalizePrimaryTaskTag(tag);
  if (normalized === "unsorted") return "未分类";
  if (normalized === "personal") return "个人";
  if (normalized === "workflow") return "工作流";
  if (normalized === "studio") return "工坊";
  return normalized;
}

export function taskTagBadgeLabel(tag: string) {
  const normalized = normalizePrimaryTaskTag(tag);
  return normalized === "unsorted" ? "未分类" : `#${normalized}`;
}

export function taskPriorityRank(priority?: string) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  if (priority === "low") return 1;
  return 0;
}

export function sortTasksForBoard(tasks: TaskCenterTask[]) {
  return [...tasks].sort((a, b) => {
    const priorityDelta = taskPriorityRank(b.priority) - taskPriorityRank(a.priority);
    if (priorityDelta) return priorityDelta;
    return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
  });
}

export function groupTasksByStatus(tasks: TaskCenterTask[]) {
  return {
    inbox: sortTasksForBoard(tasks.filter((task) => task.status === "inbox" && !task.archived)),
    todo: sortTasksForBoard(tasks.filter((task) => task.status === "todo" && !task.archived)),
    doing: sortTasksForBoard(tasks.filter((task) => task.status === "doing" && !task.archived)),
    blocked: sortTasksForBoard(tasks.filter((task) => task.status === "blocked" && !task.archived)),
    done: sortTasksForBoard(tasks.filter(taskIsDone))
  } satisfies Record<TaskCenterTaskStatus, TaskCenterTask[]>;
}

export function groupTasksByPrimaryTag(tasks: TaskCenterTask[]) {
  const groups = new Map<string, TaskTagGroup>();
  for (const task of tasks) {
    const tag = taskPrimaryTag(task);
    if (!groups.has(tag)) {
      groups.set(tag, {
        tag,
        label: taskTagDisplayName(tag),
        tasks: [],
        firstCreatedAt: Number(task.createdAt || task.updatedAt || 0)
      });
    }
    const group = groups.get(tag);
    if (!group) continue;
    group.tasks.push(task);
    const createdAt = Number(task.createdAt || task.updatedAt || 0);
    if (!group.firstCreatedAt || (createdAt && createdAt < group.firstCreatedAt)) group.firstCreatedAt = createdAt;
  }
  return [...groups.values()].sort((a, b) => {
    if (a.tag === "unsorted" && b.tag !== "unsorted") return 1;
    if (b.tag === "unsorted" && a.tag !== "unsorted") return -1;
    return (a.firstCreatedAt || 0) - (b.firstCreatedAt || 0)
      || a.label.localeCompare(b.label, "zh-Hans-CN", { numeric: true })
      || a.tag.localeCompare(b.tag);
  });
}

export function visibleTasksForTab(tasks: TaskCenterTask[], tab: TaskCenterTab) {
  if (tab === "mine") return tasks.filter((task) => normalizeTaskOrigin(task) === "user");
  if (tab === "ai") return tasks.filter((task) => normalizeTaskOrigin(task) === "ai");
  return tasks;
}

export function dayScheduleSortValue(task: TaskCenterTask) {
  const match = String(task.scheduledTime || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 24 * 60 + (4 - taskPriorityRank(task.priority));
  return Number(match[1]) * 60 + Number(match[2]);
}

export function sortDayScheduleTasks(tasks: TaskCenterTask[]) {
  return [...tasks].sort((a, b) => {
    const timeDelta = dayScheduleSortValue(a) - dayScheduleSortValue(b);
    if (timeDelta) return timeDelta;
    const priorityDelta = taskPriorityRank(b.priority) - taskPriorityRank(a.priority);
    if (priorityDelta) return priorityDelta;
    return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
  });
}

export function taskActions(task: TaskCenterTask): Array<[TaskAction, string]> {
  const scheduleActions: Array<[TaskAction, string]> = [["today", "加入今日"], ["schedule", "安排日期"]];
  if (task.archived) return [["delete", "删除"]];
  if (task.status === "inbox") return [["accept", "接收"], ...scheduleActions, ["delete", "忽略"]];
  if (task.status === "todo") return [["start", "开始"], ["done", "完成"], ...scheduleActions, ["delete", "删除"]];
  if (task.status === "doing") return [["done", "完成"], ["block", "阻塞"], ...scheduleActions, ["delete", "删除"]];
  if (task.status === "blocked") return [["start", "继续"], ...scheduleActions, ["delete", "删除"]];
  if (task.status === "done") return [["archive", "归档"], ...scheduleActions, ["delete", "删除"]];
  return [["delete", "删除"]];
}

export function primaryTaskAction(task: TaskCenterTask): TaskAction {
  if (task.status === "inbox") return "accept";
  if (task.status === "todo") return "start";
  if (task.status === "doing") return "done";
  if (task.status === "blocked") return "start";
  return "start";
}

export function taskActionText(action: TaskAction, scheduleDate = todayKey()) {
  const actionText: Record<TaskAction, string> = {
    accept: "已接收",
    start: "已开始",
    done: "已完成",
    block: "已阻塞",
    archive: "已归档",
    today: "已加入今日",
    schedule: `已安排到 ${scheduleDate}`,
    delete: "已删除"
  };
  return actionText[action];
}

export function tasksAfterAction(tasks: TaskCenterTask[], action: TaskAction, task: TaskCenterTask, scheduleDate = todayKey()) {
  if (action === "delete") return tasks.filter((item) => item.id !== task.id);
  const updatedAt = nowStamp();
  return tasks.map((item) => {
    if (item.id !== task.id) return item;
    if (action === "accept") return { ...item, status: "todo" as const, archived: false, updatedAt };
    if (action === "start") return { ...item, status: "doing" as const, archived: false, updatedAt };
    if (action === "done") return { ...item, status: "done" as const, archived: false, completedAt: updatedAt, updatedAt };
    if (action === "block") return { ...item, status: "blocked" as const, archived: false, updatedAt };
    if (action === "archive") return { ...item, status: "done" as const, archived: true, completedAt: item.completedAt || updatedAt, updatedAt };
    if (action === "today") return { ...item, scheduledDate: todayKey(), updatedAt };
    if (action === "schedule") return { ...item, scheduledDate: scheduleDate, updatedAt };
    return item;
  });
}

export function notifyTaskCenterTasksChanged(tasks: TaskCenterTask[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TASK_CENTER_TASKS_CHANGED_EVENT, {
    detail: { count: tasks.length, updatedAt: nowStamp() }
  }));
}

export function formatTaskTagForStorage(value: string) {
  return normalizePrimaryTaskTag(value || "unsorted");
}

export function TaskCenterRoute({
  summary,
  activeTab,
  onActiveTabChange
}: {
  summary: WorkbenchSummary;
  activeTab: TaskCenterTab;
  onActiveTabChange: (tab: TaskCenterTab) => void;
}) {
  const [tasks, setTasks] = useState<TaskCenterTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("准备读取任务中心。");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [calendarMonth, setCalendarMonth] = useState(monthKeyFromDate());
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskDialogMode, setTaskDialogMode] = useState<TaskDialogMode>(null);
  const [createForm, setCreateForm] = useState({
    title: "",
    detail: "",
    scheduledDate: "",
    scheduledTime: "",
    priority: "medium",
    tag: "personal"
  });
  const [editForm, setEditForm] = useState({
    title: "",
    detail: "",
    scheduledDate: "",
    scheduledTime: "",
    priority: "medium",
    tag: "personal"
  });
  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId), [selectedTaskId, tasks]);
  const activeTasks = tasks.filter((task) => task.status !== "done" && !task.archived);
  const todayTasks = sortDayScheduleTasks(tasks.filter((task) => task.scheduledDate === todayKey()));
  const doneTasks = tasks.filter((task) => task.status === "done" || task.archived);
  const tabTasks = useMemo(() => visibleTasksForTab(tasks, activeTab), [activeTab, tasks]);
  const tagGroups = useMemo(() => {
    const ordered = [
      ...tabTasks.filter(taskIsActive),
      ...tabTasks.filter((task) => !taskIsActive(task))
    ];
    return groupTasksByPrimaryTag(ordered);
  }, [tabTasks]);
  const effectiveSelectedTag = selectedTag === "all" || tagGroups.some((group) => group.tag === selectedTag) ? selectedTag : "all";
  const boardTasks = effectiveSelectedTag === "all"
    ? tabTasks
    : tagGroups.find((group) => group.tag === effectiveSelectedTag)?.tasks || [];
  const selectedDayTasks = sortDayScheduleTasks(tasks.filter((task) => task.scheduledDate === selectedDay));

  async function loadTasks() {
    setLoading(true);
    try {
      const loaded = sortTasks(await readTaskCenterTasks());
      setTasks(loaded);
      setSelectedTaskId((current) => (loaded.some((task) => task.id === current) ? current : loaded[0]?.id || ""));
      setStatus(loaded.length ? `已读取 ${loaded.length} 个任务。` : "任务中心为空，可以新建任务。");
    } catch (error) {
      setStatus(`任务读取失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    const openCreateDialog = () => setTaskDialogMode("create");
    window.addEventListener("meowdesk:task-new", openCreateDialog);
    return () => window.removeEventListener("meowdesk:task-new", openCreateDialog);
  }, []);

  useEffect(() => {
    if (!selectedTask) return;
    setEditForm({
      title: selectedTask.title,
      detail: selectedTask.detail || "",
      scheduledDate: selectedTask.scheduledDate || "",
      scheduledTime: selectedTask.scheduledTime || "",
      priority: selectedTask.priority || "medium",
      tag: taskPrimaryTag(selectedTask)
    });
  }, [selectedTask]);

  async function persistTasks(nextTasks: TaskCenterTask[], message: string) {
    setSaving(true);
    try {
      const sorted = sortTasks(nextTasks);
      await writeTaskCenterTasks(sorted);
      setTasks(sorted);
      notifyTaskCenterTasksChanged(sorted);
      summary.refresh();
      setStatus(message);
      return true;
    } catch (error) {
      setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openTaskEditor(taskId: string) {
    setSelectedTaskId(taskId);
    setTaskDialogMode("edit");
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = createForm.title.trim();
    if (!title) {
      setStatus("任务标题不能为空。");
      return;
    }
    const createdAt = nowStamp();
    const task: TaskCenterTask = {
      id: nextTaskId(),
      title,
      status: "todo",
      detail: createForm.detail.trim(),
      scheduledDate: createForm.scheduledDate,
      scheduledTime: createForm.scheduledTime,
      priority: createForm.priority,
      source: "我",
      origin: "user",
      tag: formatTaskTagForStorage(createForm.tag),
      tags: [formatTaskTagForStorage(createForm.tag)],
      archived: false,
      completedAt: 0,
      createdAt,
      updatedAt: createdAt
    };
    setSelectedTaskId(task.id);
    onActiveTabChange("mine");
    setSelectedTag(task.tag || "all");
    const persisted = await persistTasks([task, ...tasks], `已创建任务「${task.title}」。`);
    if (persisted) {
      setCreateForm({ title: "", detail: "", scheduledDate: "", scheduledTime: "", priority: "medium", tag: "personal" });
      setTaskDialogMode(null);
    }
  }

  async function updateTaskStatus(task: TaskCenterTask) {
    const statusValue = nextTaskStatus(task.status);
    await persistTasks(tasks.map((item) => item.id === task.id ? {
      ...item,
      status: statusValue,
      archived: statusValue === "done",
      completedAt: statusValue === "done" ? nowStamp() : 0,
      updatedAt: nowStamp()
    } : item), `「${task.title}」已切到${taskStatusLabels[statusValue]}。`);
  }

  async function saveSelectedTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask) return;
    const title = editForm.title.trim();
    if (!title) {
      setStatus("任务标题不能为空。");
      return;
    }
    const persisted = await persistTasks(tasks.map((task) => task.id === selectedTask.id ? {
      ...task,
      title,
      detail: editForm.detail.trim(),
      scheduledDate: editForm.scheduledDate,
      scheduledTime: editForm.scheduledTime,
      priority: editForm.priority,
      tag: formatTaskTagForStorage(editForm.tag),
      tags: [formatTaskTagForStorage(editForm.tag)],
      updatedAt: nowStamp()
    } : task), `「${title}」已保存。`);
    if (persisted) {
      setTaskDialogMode(null);
    }
  }

  async function runTaskAction(action: TaskAction, task: TaskCenterTask) {
    if (action === "delete") {
      await deleteTask(task);
      return;
    }
    const scheduleDate = selectedDay || todayKey();
    await persistTasks(tasksAfterAction(tasks, action, task, scheduleDate), `「${task.title}」${taskActionText(action, scheduleDate)}。`);
  }

  async function deleteTask(task: TaskCenterTask) {
    const nextTasks = tasksAfterAction(tasks, "delete", task);
    setSelectedTaskId(nextTasks[0]?.id || "");
    await persistTasks(nextTasks, `已删除任务「${task.title}」。`);
  }

  return (
    <RouteFrame
      id="tasks"
      eyebrow="Tasks"
      title="任务中心"
      copy="任务中心 R1.5 恢复旧版主形态：AI任务、我的任务、日任务、月历、标签分区和状态列；工作流投递仍保持 legacy 边界。"
      badge="R1.5 task board"
      compact
    >
      <div className="grid h-full min-h-0 gap-3" data-r15-task-center>
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)] gap-3">
          <Panel className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
            <PanelHeader>
              <div>
                <div className="text-sm font-semibold">任务看板</div>
                <div className="text-xs text-muted-foreground">{tasks.length} 项 / {activeTasks.length} 待处理 / {doneTasks.length} 完成 / 今日 {todayTasks.length}</div>
              </div>
              <Badge variant="primary">{taskCenterTabs.find((tab) => tab.id === activeTab)?.label || "任务"}</Badge>
            </PanelHeader>
            <PanelBody className="min-h-0 overflow-hidden">
              {activeTab === "calendar" ? (
                <TaskCalendarView
                  monthKey={calendarMonth}
                  selectedDay={selectedDay}
                  tasks={tasks}
                  onMonthChange={setCalendarMonth}
                  onPickDay={(dateKey) => {
                    setSelectedDay(dateKey);
                    onActiveTabChange("today");
                  }}
                />
              ) : activeTab === "week" ? (
                <TaskWeekView
                  dateKey={selectedDay}
                  tasks={tasks}
                  onDateChange={setSelectedDay}
                  onPickDay={(dateKey) => {
                    setSelectedDay(dateKey);
                    onActiveTabChange("today");
                  }}
                />
              ) : activeTab === "today" ? (
                <TaskDaySchedule
                  dateKey={selectedDay}
                  tasks={selectedDayTasks}
                  onDateChange={setSelectedDay}
                  onSelect={openTaskEditor}
                  onAction={runTaskAction}
                />
              ) : activeTab === "matrix" ? (
                <TaskMatrixView
                  tasks={tasks}
                  selectedTaskId={selectedTaskId}
                  onSelect={openTaskEditor}
                  onAction={runTaskAction}
                />
              ) : activeTab === "habits" ? (
                <TaskHabitView
                  tasks={tasks}
                  onSelect={openTaskEditor}
                  onAction={runTaskAction}
                />
              ) : (
                <div className="grid h-full min-h-0 gap-3 min-[980px]:grid-cols-[180px_minmax(0,1fr)]">
                  <TaskTagNavigator
                    groups={tagGroups}
                    selectedTag={effectiveSelectedTag}
                    totalCount={tabTasks.length}
                    onSelect={setSelectedTag}
                  />
                  <TaskStatusBoard
                    tasks={boardTasks}
                    selectedTaskId={selectedTaskId}
                    onSelect={openTaskEditor}
                    onAction={runTaskAction}
                  />
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
      <Dialog open={taskDialogMode === "create"} onOpenChange={(open) => setTaskDialogMode(open ? "create" : null)}>
        <DialogContent className="w-[min(560px,calc(100vw-32px))]" data-r15-task-dialog="create">
          <DialogHeader>
            <DialogTitle>新建任务</DialogTitle>
            <DialogDescription>写入本机任务中心，创建后回到「我的任务」。</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={createTask}>
            <Input
              data-r1-task-title
              value={createForm.title}
              maxLength={80}
              placeholder="写下任务标题"
              onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
            />
            <textarea
              data-r1-task-detail
              className="min-h-20 resize-none rounded-md border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
              value={createForm.detail}
              maxLength={360}
              placeholder="任务说明"
              onChange={(event) => setCreateForm((current) => ({ ...current, detail: event.target.value }))}
            />
            <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-2">
              <Input
                data-r1-task-date
                type="date"
                value={createForm.scheduledDate}
                onChange={(event) => setCreateForm((current) => ({ ...current, scheduledDate: event.target.value }))}
              />
              <Input
                data-r1-task-time
                type="time"
                value={createForm.scheduledTime}
                onChange={(event) => setCreateForm((current) => ({ ...current, scheduledTime: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
              <Input
                data-r15-task-create-tag
                value={createForm.tag}
                maxLength={40}
                placeholder="标签"
                onChange={(event) => setCreateForm((current) => ({ ...current, tag: event.target.value }))}
              />
              <select
                data-r1-task-priority
                className="h-9 rounded-md border border-border bg-background/70 px-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                value={createForm.priority}
                onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value }))}
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <DialogFooter className="items-center justify-between">
              <span className="min-w-0 text-xs text-muted-foreground" data-r1-task-status>{status}</span>
              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={loadTasks} disabled={loading || saving}>
                  <RefreshCw className={cn(loading && "animate-spin")} size={14} aria-hidden="true" />
                  刷新
                </Button>
                <Button data-r1-task-create type="submit" size="sm" disabled={saving || !createForm.title.trim()}>
                  <Save size={14} aria-hidden="true" />
                  {saving ? "保存中" : "创建"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={taskDialogMode === "edit"} onOpenChange={(open) => setTaskDialogMode(open ? "edit" : null)}>
        <DialogContent className="w-[min(560px,calc(100vw-32px))]" data-r1-task-editor data-r15-task-dialog="edit">
          <DialogHeader>
            <DialogTitle>任务编辑</DialogTitle>
            <DialogDescription>调整标题、说明、日期、标签和优先级。</DialogDescription>
          </DialogHeader>
          {selectedTask ? (
            <form className="grid gap-3" onSubmit={saveSelectedTask}>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="flex min-w-0 items-center gap-2">
                  <TaskSourceIcon task={selectedTask} size="sm" />
                  <span className="min-w-0 truncate">{taskOriginLabel(selectedTask)} · {taskSourceLabel(selectedTask)}</span>
                </span>
                <Badge variant={taskStatusBadge(selectedTask.status)}>{taskStatusLabels[selectedTask.status]}</Badge>
              </div>
              <Input
                data-r1-task-edit-title
                value={editForm.title}
                maxLength={80}
                onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
              />
              <textarea
                data-r1-task-edit-detail
                className="min-h-20 max-h-40 resize-y rounded-md border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                value={editForm.detail}
                maxLength={360}
                onChange={(event) => setEditForm((current) => ({ ...current, detail: event.target.value }))}
              />
              <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-2">
                <Input
                  data-r1-task-edit-date
                  type="date"
                  value={editForm.scheduledDate}
                  onChange={(event) => setEditForm((current) => ({ ...current, scheduledDate: event.target.value }))}
                />
                <Input
                  data-r1-task-edit-time
                  type="time"
                  value={editForm.scheduledTime}
                  onChange={(event) => setEditForm((current) => ({ ...current, scheduledTime: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                <Input
                  data-r15-task-edit-tag
                  value={editForm.tag}
                  maxLength={40}
                  onChange={(event) => setEditForm((current) => ({ ...current, tag: event.target.value }))}
                />
                <select
                  data-r1-task-edit-priority
                  className="h-9 rounded-md border border-border bg-background/70 px-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                  value={editForm.priority}
                  onChange={(event) => setEditForm((current) => ({ ...current, priority: event.target.value }))}
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
              <DialogFooter className="items-center justify-between">
                <span className="min-w-0 text-xs text-muted-foreground" data-r1-task-edit-status>{status}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => updateTaskStatus(selectedTask)}>
                    <Activity size={15} aria-hidden="true" />
                    切状态
                  </Button>
                  <Button data-r1-task-save-selected type="submit" size="sm" disabled={saving || !editForm.title.trim()}>
                    <Save size={15} aria-hidden="true" />
                    保存任务
                  </Button>
                </div>
              </DialogFooter>
            </form>
          ) : (
            <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
              选择任务后可编辑。
            </div>
          )}
        </DialogContent>
      </Dialog>
      <div className="sr-only">
        <LegacyHandoff id="task-center" title="Task board advanced handoff" detail="拖拽看板、AI 投递合并和 workflow board picker 不混入 R1。" />
      </div>
    </RouteFrame>
  );
}

function TaskTagNavigator({
  groups,
  selectedTag,
  totalCount,
  onSelect
}: {
  groups: TaskTagGroup[];
  selectedTag: string;
  totalCount: number;
  onSelect: (tag: string) => void;
}) {
  const activeTotal = groups.reduce((sum, group) => sum + group.tasks.filter(taskIsActive).length, 0);
  const allGroups = [
    { tag: "all", label: "全部", tasks: [], firstCreatedAt: 0, count: totalCount, activeCount: activeTotal },
    ...groups.map((group) => ({
      ...group,
      count: group.tasks.length,
      activeCount: group.tasks.filter(taskIsActive).length
    }))
  ];
  return (
    <aside className="grid min-h-0 content-start gap-2 overflow-y-auto pr-1" aria-label="看板标签" data-r15-task-tag-list>
      {allGroups.map((group) => {
        const active = selectedTag === group.tag;
        return (
          <button
            key={group.tag}
            type="button"
            className={cn(
              "grid gap-1 rounded-md border border-border bg-background/55 px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
              active && "border-primary/45 bg-primary/10"
            )}
            data-r15-task-tag={group.tag}
            data-r15-task-tag-active={active ? "true" : undefined}
            onClick={() => onSelect(group.tag)}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
                <Hash size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{group.label}</span>
              </span>
              <span className="text-muted-foreground">{group.count}</span>
            </span>
            <span className="text-muted-foreground">{group.tag === "all" ? "全部" : taskTagBadgeLabel(group.tag)} · {group.activeCount} 待处理</span>
          </button>
        );
      })}
    </aside>
  );
}

function TaskStatusBoard({
  tasks,
  selectedTaskId,
  onSelect,
  onAction
}: {
  tasks: TaskCenterTask[];
  selectedTaskId: string;
  onSelect: (taskId: string) => void;
  onAction: (action: TaskAction, task: TaskCenterTask) => void;
}) {
  const grouped = groupTasksByStatus(tasks);
  return (
    <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-hidden pb-1" data-r1-task-list>
      <div className="grid min-h-full min-w-0 grid-cols-1 gap-2 min-[760px]:grid-cols-[repeat(5,minmax(0,1fr))]">
        {taskStatusOrder.map((statusKey) => (
          <section
            key={statusKey}
            className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-background/45"
            data-r15-task-status-section={statusKey}
          >
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border px-2 py-1.5">
              <span className="min-w-0 truncate text-xs font-medium">{taskStatusLabels[statusKey]}</span>
              <Badge className="shrink-0" variant={taskStatusBadge(statusKey)}>{grouped[statusKey].length}</Badge>
            </div>
            <div className="grid min-h-0 min-w-0 content-start gap-1.5 overflow-x-hidden overflow-y-auto p-1.5">
              {grouped[statusKey].length ? grouped[statusKey].map((task) => (
                <TaskBoardCard
                  key={task.id}
                  task={task}
                  selected={selectedTaskId === task.id}
                  onSelect={onSelect}
                  onAction={onAction}
                />
              )) : (
                <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground" data-task-readiness-summary>
                  空
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function TaskBoardCard({
  task,
  selected,
  onSelect,
  onAction
}: {
  task: TaskCenterTask;
  selected: boolean;
  onSelect: (taskId: string) => void;
  onAction: (action: TaskAction, task: TaskCenterTask) => void;
}) {
  const primary = primaryTaskAction(task);
  const actionNodes = [
    <Button key="edit" type="button" size="sm" variant="outline" className="h-7 px-2" data-r1-task-edit={task.id} onClick={() => onSelect(task.id)}>
      <Pencil size={14} aria-hidden="true" />
      编辑
    </Button>,
    ...taskActions(task).map(([action, label]) => (
      <Button
        key={action}
        type="button"
        size="sm"
        variant={action === "delete" ? "danger" : "outline"}
        className="h-7 px-2"
        data-r15-task-action={action}
        data-r1-task-status-toggle={action === primary ? task.id : undefined}
        data-r1-task-delete={action === "delete" ? task.id : undefined}
        onClick={() => onAction(action, task)}
      >
        {action === "delete" ? <Trash2 size={14} aria-hidden="true" /> : <Activity size={14} aria-hidden="true" />}
        {label}
      </Button>
    ))
  ];
  return (
    <article
      className={cn(
        "meowdesk-card-action-menu-card relative min-w-0 overflow-visible rounded-md border border-border bg-surface/70 px-2 py-1.5 text-xs",
        selected && "border-primary/45 bg-primary/10"
      )}
      data-r1-task-item={task.id}
      data-r15-task-card={task.id}
    >
      <div className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-1.5">
        <TaskSourceIcon task={task} size="sm" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-1.5">
            <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onSelect(task.id)}>
              <div className="line-clamp-2 break-words text-[13px] font-medium leading-5">{task.title}</div>
            </button>
            <Badge className="shrink-0" data-r1-task-status-value={task.id} variant={taskStatusBadge(task.status)}>{taskStatusLabels[task.status]}</Badge>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex shrink-0 items-center gap-1"><Clock size={12} aria-hidden="true" />{taskTimeValue(task)}</span>
            <span className="min-w-0 truncate">{taskSourceLabel(task)}</span>
          </div>
        </div>
      </div>
      {task.detail ? <p className="mt-1.5 line-clamp-3 min-w-0 break-words leading-4 text-muted-foreground">{task.detail}</p> : null}
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span>{taskOriginLabel(task)}</span>
        <span className="inline-flex items-center gap-1"><Tags size={12} aria-hidden="true" />{taskTagBadgeLabel(taskPrimaryTag(task))}</span>
        <span>优先级 {priorityLabel(task.priority)}</span>
      </div>
      <CardActionMenu>{actionNodes}</CardActionMenu>
    </article>
  );
}

function TaskCalendarView({
  monthKey,
  selectedDay,
  tasks,
  onMonthChange,
  onPickDay
}: {
  monthKey: string;
  selectedDay: string;
  tasks: TaskCenterTask[];
  onMonthChange: (monthKey: string) => void;
  onPickDay: (dateKey: string) => void;
}) {
  const { key, year, month } = parseMonthKey(monthKey);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = firstDay.getDay();
  const today = todayKey();
  const monthTasks = tasks.filter((item) => String(item.scheduledDate || "").startsWith(key));
  const byDate = new Map<string, TaskCenterTask[]>();
  for (const task of monthTasks) {
    const date = task.scheduledDate || "";
    byDate.set(date, [...(byDate.get(date) || []), task]);
  }
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3" data-r15-task-calendar>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{year} 年 {month} 月</div>
          <div className="text-xs text-muted-foreground">{monthTasks.length} 项已安排</div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onMonthChange(shiftMonthKey(key, -1))}>
            <ChevronLeft size={14} aria-hidden="true" />
            上月
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onMonthChange(monthKeyFromDate())}>本月</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onMonthChange(shiftMonthKey(key, 1))}>
            下月
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </header>
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="grid min-h-0 grid-cols-7 gap-2 overflow-y-auto pr-1">
        {Array.from({ length: startOffset }).map((_, index) => (
          <div key={`blank-${index}`} className="min-h-24 rounded-md border border-border/55 bg-background/25" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const dateKey = `${key}-${String(day).padStart(2, "0")}`;
          const dayTasks = sortTasksForBoard(byDate.get(dateKey) || []);
          const doneCount = dayTasks.filter(taskIsDone).length;
          return (
            <button
              key={dateKey}
              type="button"
              className={cn(
                "grid min-h-24 content-start gap-1 rounded-md border border-border bg-background/55 px-2 py-2 text-left text-xs transition-colors hover:bg-accent",
                dateKey === today && "border-primary/45",
                dateKey === selectedDay && "bg-primary/10"
              )}
              data-r15-task-calendar-day={dateKey}
              onClick={() => onPickDay(dateKey)}
            >
              <span className="font-medium text-foreground">{day}</span>
              <strong className="text-primary">{dayTasks.length ? `${dayTasks.length} 项` : ""}</strong>
              {dayTasks.slice(0, 3).map((task) => <em key={task.id} className="truncate not-italic text-muted-foreground">{task.title}</em>)}
              {dayTasks.length > 3 ? <small className="text-muted-foreground">另 {dayTasks.length - 3} 项</small> : null}
              {dayTasks.length ? <small className="text-muted-foreground">{doneCount}/{dayTasks.length} 完成</small> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function weekDateKeys(dateKey: string) {
  const start = parseDateKey(dateKey || todayKey());
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return dateKeyFromDate(date);
  });
}

function TaskWeekView({
  dateKey,
  tasks,
  onDateChange,
  onPickDay
}: {
  dateKey: string;
  tasks: TaskCenterTask[];
  onDateChange: (dateKey: string) => void;
  onPickDay: (dateKey: string) => void;
}) {
  const days = weekDateKeys(dateKey);
  const today = todayKey();
  const weekTasks = tasks.filter((task) => days.includes(task.scheduledDate || ""));
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3" data-r15-task-week-view>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">周视图</div>
          <div className="text-xs text-muted-foreground">{days[0]} - {days[6]} · {weekTasks.length} 项</div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onDateChange(shiftDateKey(dateKey, -7))}>
            <ChevronLeft size={14} aria-hidden="true" />
            上周
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onDateChange(todayKey())}>本周</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onDateChange(shiftDateKey(dateKey, 7))}>
            下周
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </header>
      <div className="grid min-h-0 gap-2 overflow-y-auto pr-1 min-[900px]:grid-cols-7">
        {days.map((day) => {
          const dayTasks = sortDayScheduleTasks(tasks.filter((task) => task.scheduledDate === day));
          return (
            <button
              key={day}
              type="button"
              className={cn(
                "grid min-h-44 content-start gap-2 rounded-md border border-border bg-background/55 px-2 py-2 text-left text-xs transition-colors hover:bg-accent",
                day === today && "border-primary/45 bg-primary/10"
              )}
              data-r15-task-week-day={day}
              onClick={() => onPickDay(day)}
            >
              <span className="font-medium text-foreground">{day.slice(5)}</span>
              <Badge variant={dayTasks.length ? "primary" : "default"}>{dayTasks.length} 项</Badge>
              {dayTasks.slice(0, 4).map((task) => (
                <span key={task.id} className="grid gap-1 rounded border border-border bg-surface/60 px-2 py-1">
                  <span className="truncate text-foreground">{task.title}</span>
                  <span className="text-muted-foreground">{task.scheduledTime || "待定"} · {priorityLabel(task.priority)}</span>
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function matrixBucket(task: TaskCenterTask) {
  const urgent = Boolean(task.scheduledDate && task.scheduledDate <= todayKey()) || task.status === "doing" || task.status === "blocked";
  const important = task.priority === "high";
  if (urgent && important) return "important-urgent";
  if (!urgent && important) return "important";
  if (urgent && !important) return "urgent";
  return "later";
}

function TaskMatrixView({
  tasks,
  selectedTaskId,
  onSelect,
  onAction
}: {
  tasks: TaskCenterTask[];
  selectedTaskId: string;
  onSelect: (taskId: string) => void;
  onAction: (action: TaskAction, task: TaskCenterTask) => void;
}) {
  const activeTasks = tasks.filter(taskIsActive);
  const buckets = [
    { id: "important-urgent", title: "重要且紧急", copy: "今天要处理 / 高优先级" },
    { id: "important", title: "重要不紧急", copy: "推进型任务" },
    { id: "urgent", title: "紧急不重要", copy: "待清理与跟进" },
    { id: "later", title: "不紧急不重要", copy: "可延后或整理" }
  ];
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3" data-r15-task-matrix>
      <header>
        <div className="text-sm font-semibold">四象限</div>
        <div className="text-xs text-muted-foreground">R1.5 只按日期、状态和优先级做本地可读分区；不引入新任务规则引擎。</div>
      </header>
      <div className="grid min-h-0 gap-2 overflow-y-auto pr-1 min-[900px]:grid-cols-2">
        {buckets.map((bucket) => {
          const bucketTasks = activeTasks.filter((task) => matrixBucket(task) === bucket.id);
          return (
            <section key={bucket.id} className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-md border border-border bg-background/45" data-r15-task-matrix-bucket={bucket.id}>
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <span>
                  <strong className="block text-sm text-foreground">{bucket.title}</strong>
                  <span className="text-xs text-muted-foreground">{bucket.copy}</span>
                </span>
                <Badge>{bucketTasks.length}</Badge>
              </div>
              <div className="grid content-start gap-2 overflow-y-auto p-2">
                {bucketTasks.length ? bucketTasks.map((task) => (
                  <TaskBoardCard key={task.id} task={task} selected={selectedTaskId === task.id} onSelect={onSelect} onAction={onAction} />
                )) : (
                  <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">空</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function isHabitTask(task: TaskCenterTask) {
  const text = `${task.title} ${task.detail || ""} ${task.tag || ""} ${(task.tags || []).join(" ")}`.toLowerCase();
  return /(habit|daily|routine|打卡|每日|阅读|锻炼|复盘)/.test(text);
}

function TaskHabitView({
  tasks,
  onSelect,
  onAction
}: {
  tasks: TaskCenterTask[];
  onSelect: (taskId: string) => void;
  onAction: (action: TaskAction, task: TaskCenterTask) => void;
}) {
  const habitTasks = tasks.filter(isHabitTask);
  const candidates = habitTasks.length ? habitTasks : tasks.filter(taskIsActive).slice(0, 5);
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3" data-r15-task-habits>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">每日打卡</div>
          <div className="text-xs text-muted-foreground">用于锻炼、阅读、复盘等重复行为；真实重复规则和提醒后续接管。</div>
        </div>
        <Badge variant="warning">R1.5 view only</Badge>
      </header>
      <div className="grid content-start gap-2 overflow-y-auto pr-1">
        {candidates.length ? candidates.map((task) => (
          <article key={task.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-background/55 px-3 py-2 text-xs" data-r15-task-habit-item={task.id}>
            <button
              type="button"
              className={cn(
                "grid h-7 w-7 place-items-center rounded-md border",
                taskIsDone(task) ? "border-success/40 bg-success/15 text-success" : "border-border bg-surface/70 text-muted-foreground"
              )}
              onClick={() => onAction(taskIsDone(task) ? "start" : "done", task)}
              aria-label={taskIsDone(task) ? "取消完成" : "完成打卡"}
            >
              {taskIsDone(task) ? "✓" : ""}
            </button>
            <span className="min-w-0">
              <button type="button" className="block max-w-full truncate text-left text-sm font-medium text-foreground" onClick={() => onSelect(task.id)}>
                {task.title}
              </button>
              <span className="mt-1 block truncate text-muted-foreground">{taskTagBadgeLabel(taskPrimaryTag(task))} · {task.scheduledDate || "未安排"}</span>
            </span>
            <Badge variant={taskIsDone(task) ? "success" : "default"}>{taskIsDone(task) ? "已打卡" : "未打卡"}</Badge>
          </article>
        )) : (
          <div className="rounded-md border border-dashed border-border px-3 py-10 text-center text-xs text-muted-foreground">
            暂无可作为每日打卡的任务。
          </div>
        )}
      </div>
    </section>
  );
}

function TaskDaySchedule({
  dateKey,
  tasks,
  onDateChange,
  onSelect,
  onAction
}: {
  dateKey: string;
  tasks: TaskCenterTask[];
  onDateChange: (dateKey: string) => void;
  onSelect: (taskId: string) => void;
  onAction: (action: TaskAction, task: TaskCenterTask) => void;
}) {
  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3" data-r15-task-day-schedule>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{dateKey === todayKey() ? "今日任务" : "日任务"}</div>
          <div className="text-xs text-muted-foreground">{dateKey}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onDateChange(shiftDateKey(dateKey, -1))}>
            <ChevronLeft size={14} aria-hidden="true" />
            前一天
          </Button>
          <Badge variant="primary">{tasks.length} 项</Badge>
          <Button type="button" size="sm" variant="outline" onClick={() => onDateChange(shiftDateKey(dateKey, 1))}>
            后一天
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </header>
      <div className="grid content-start gap-2 overflow-y-auto pr-1">
        {tasks.length ? tasks.map((task) => (
          <article key={task.id} className={cn("meowdesk-card-action-menu-card relative grid grid-cols-[64px_24px_minmax(0,1fr)] gap-3 overflow-visible rounded-md border border-border bg-background/55 px-3 py-3 text-xs", taskIsDone(task) && "opacity-70")}>
            <div className="font-medium text-primary">{task.scheduledTime || "待定"}</div>
            <TaskSourceIcon task={task} size="sm" />
            <div className="min-w-0">
              <button type="button" className="block max-w-full truncate text-left text-sm font-medium" onClick={() => onSelect(task.id)}>
                {task.title}
              </button>
              {task.detail ? <p className="mt-1 line-clamp-2 leading-5 text-muted-foreground">{task.detail}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
                <Badge variant={taskStatusBadge(task.status)}>{taskStatusLabels[task.status]}</Badge>
                <span>{taskOriginLabel(task)}</span>
                <span>{taskSourceLabel(task)}</span>
                <span>{taskTagBadgeLabel(taskPrimaryTag(task))}</span>
                <span>优先级 {priorityLabel(task.priority)}</span>
              </div>
              <CardActionMenu>
                {taskActions(task).filter(([action]) => !["today", "schedule"].includes(action)).map(([action, label]) => (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant={action === "delete" ? "danger" : "outline"}
                    data-r15-task-action={action}
                    onClick={() => onAction(action, task)}
                  >
                    {label}
                  </Button>
                ))}
              </CardActionMenu>
            </div>
          </article>
        )) : (
          <div className="rounded-md border border-dashed border-border px-3 py-10 text-center text-xs text-muted-foreground">
            这一天还没有安排任务。
          </div>
        )}
      </div>
    </section>
  );
}

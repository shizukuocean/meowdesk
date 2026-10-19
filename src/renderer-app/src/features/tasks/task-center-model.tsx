import { Bot } from "lucide-react";
import type { TaskCenterTask, TaskCenterTaskStatus } from "@/lib/workbench-api";
import { cn } from "@/lib/utils";

export const taskStatusLabels: Record<TaskCenterTaskStatus, string> = {
  inbox: "待确认",
  todo: "待办",
  doing: "进行中",
  blocked: "阻塞",
  done: "完成"
};

export const taskStatusOrder: TaskCenterTaskStatus[] = ["inbox", "todo", "doing", "blocked", "done"];

export type TaskAction = "accept" | "start" | "done" | "block" | "archive" | "today" | "schedule" | "delete";

export const TASK_CENTER_TASKS_CHANGED_EVENT = "meowdesk:task-center-tasks-changed";

export function nowStamp() {
  return Date.now();
}

export function todayKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function sortTasks(tasks: TaskCenterTask[]) {
  return [...tasks].sort((a, b) => {
    const aStatus = taskStatusOrder.indexOf(a.status);
    const bStatus = taskStatusOrder.indexOf(b.status);
    if (aStatus !== bStatus) return aStatus - bStatus;
    return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0);
  });
}

export function taskStatusBadge(status: TaskCenterTaskStatus): "success" | "primary" | "warning" | "danger" | "default" {
  if (status === "done") return "success";
  if (status === "doing") return "primary";
  if (status === "blocked") return "danger";
  if (status === "todo") return "warning";
  return "default";
}

export function taskTimeValue(task: TaskCenterTask) {
  const date = task.scheduledDate || "";
  const time = task.scheduledTime || "";
  if (!date && !time) return "未安排";
  return [date, time].filter(Boolean).join(" ");
}

export function normalizeTaskOrigin(task: TaskCenterTask): "ai" | "user" {
  const raw = String(task.origin || "").trim().toLowerCase();
  if (["user", "mine", "manual", "personal", "me", "我的", "用户", "手动"].includes(raw)) return "user";
  return "ai";
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

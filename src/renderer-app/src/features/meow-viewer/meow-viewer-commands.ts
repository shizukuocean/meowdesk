import type { WorkspaceRendererProfile } from "./meow-viewer-contract";

export type MeowViewerCommand = {
  command: string;
  label: string;
  description: string;
};

const CLAUDE_COMMANDS: MeowViewerCommand[] = [
  { command: "/help", label: "帮助", description: "显示 Claude Code 帮助信息" },
  { command: "/clear", label: "清屏", description: "清除对话历史" },
  { command: "/reset", label: "重置", description: "重置当前会话状态" },
  { command: "/cost", label: "费用", description: "查看 token 用量和费用" },
  { command: "/config", label: "配置", description: "打开主题、模型等配置" },
  { command: "/fast", label: "快速模式", description: "切换快速输出模式" },
  { command: "/doctor", label: "诊断", description: "诊断当前环境问题" },
  { command: "/workflows", label: "工作流", description: "查看 workflow 运行进度" },
  { command: "/tasks", label: "任务", description: "查看后台任务列表" }
];

const HERMES_COMMANDS: MeowViewerCommand[] = [
  { command: "/help", label: "帮助", description: "显示 Hermes 帮助信息" },
  { command: "/clear", label: "清屏", description: "清除当前屏幕或上下文显示" },
  { command: "/queue", label: "队列", description: "查看或管理排队消息" },
  { command: "/bg", label: "后台", description: "查看后台任务或后台模式" },
  { command: "/steer", label: "引导", description: "调整当前 Agent 行为方向" },
  { command: "/tools", label: "工具", description: "查看可用工具" },
  { command: "/skills", label: "技能", description: "查看可用 skills" }
];

const DEFAULT_COMMANDS: MeowViewerCommand[] = [
  { command: "/help", label: "帮助", description: "显示当前 Agent 帮助信息" },
  { command: "/clear", label: "清屏", description: "清除当前显示或上下文" }
];

export function meowViewerCommandsForProfile(profile: WorkspaceRendererProfile): MeowViewerCommand[] {
  if (profile === "claude") return CLAUDE_COMMANDS;
  if (profile === "hermes") return HERMES_COMMANDS;
  return DEFAULT_COMMANDS;
}

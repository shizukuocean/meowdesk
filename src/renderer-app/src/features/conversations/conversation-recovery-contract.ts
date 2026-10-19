import type { WorkbenchConversationSummary } from "@/app/use-workbench-summary";
import type {
  RuntimeSurfaceAttachmentSnapshot,
  RuntimeSurfaceRouteAttachment
} from "@/features/open-surface/open-surface-runtime-attachments";

export type ConversationRecoveryMode = "live-runtime" | "cold-preview";
export type ConversationRecoveryTargetRoute = "workspace" | "studio";

export type ConversationRecoveryDescriptor = {
  owner: "conversation-recovery";
  conversationId: string;
  mode: ConversationRecoveryMode;
  liveRouteIds: string[];
  targetRoutes: ConversationRecoveryTargetRoute[];
  coldPreviewOnly: boolean;
  liveRuntimeCount: number;
  reattachableRuntimeCount: number;
};

function cleanConversationToken(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function runtimeConversationMatches(conversationId: string, runtimeConversationId?: string) {
  const expected = cleanConversationToken(conversationId);
  const runtimeId = cleanConversationToken(runtimeConversationId);
  if (!expected || !runtimeId) return false;
  return runtimeId === expected || runtimeId.endsWith(`:${expected}`);
}

function liveAttachmentsForConversation(
  conversation: Pick<WorkbenchConversationSummary, "id"> | null | undefined,
  runtimeSurfaceAttachments?: RuntimeSurfaceAttachmentSnapshot
) {
  if (!conversation || !runtimeSurfaceAttachments) return [];
  return runtimeSurfaceAttachments.routeAttachments.filter((attachment) => {
    return attachment.runtimes.some((runtime) => runtimeConversationMatches(conversation.id, runtime.conversationId));
  });
}

function supportedTargetRoutes(attachments: RuntimeSurfaceRouteAttachment[]): ConversationRecoveryTargetRoute[] {
  const routeIds = attachments
    .map((attachment) => attachment.routeId)
    .filter((routeId): routeId is ConversationRecoveryTargetRoute => routeId === "workspace" || routeId === "studio");
  return [...new Set(routeIds)];
}

export function createConversationRecoveryDescriptor(input: {
  conversation: Pick<WorkbenchConversationSummary, "id"> | null | undefined;
  runtimeSurfaceAttachments?: RuntimeSurfaceAttachmentSnapshot;
}): ConversationRecoveryDescriptor {
  const conversationId = String(input.conversation?.id || "");
  const liveAttachments = liveAttachmentsForConversation(input.conversation, input.runtimeSurfaceAttachments);
  const liveRuntimeCount = liveAttachments.reduce((total, attachment) => total + attachment.runtimeCount, 0);
  const reattachableRuntimeCount = liveAttachments.reduce((total, attachment) => total + attachment.reattachableRuntimeCount, 0);
  const targetRoutes = supportedTargetRoutes(liveAttachments);
  return {
    owner: "conversation-recovery",
    conversationId,
    mode: reattachableRuntimeCount ? "live-runtime" : "cold-preview",
    liveRouteIds: liveAttachments.map((attachment) => attachment.routeId),
    targetRoutes: targetRoutes.length ? targetRoutes : ["workspace", "studio"],
    coldPreviewOnly: reattachableRuntimeCount === 0,
    liveRuntimeCount,
    reattachableRuntimeCount
  };
}

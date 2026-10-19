import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type LaunchEmptyStateVariant = "workspace-agent" | "meow-viewer-bind" | "studio-agent";

type LaunchEmptyStateProps = {
  variant: LaunchEmptyStateVariant;
  icon: ReactNode;
  iconChrome?: "tile" | "none" | "action";
  title: ReactNode;
  meta?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
};

export function LaunchEmptyState({
  variant,
  icon,
  iconChrome = "tile",
  title,
  meta,
  primaryAction,
  secondaryAction,
  className
}: LaunchEmptyStateProps) {
  return (
    <div
      className={cn("meowdesk-launch-empty-state", className)}
      data-meow-launch-family="agent-work-surface"
      data-meow-launch-variant={variant}
    >
      <span className="meowdesk-launch-empty-state-icon" data-meow-launch-icon-chrome={iconChrome} aria-hidden={iconChrome === "action" ? undefined : "true"}>
        {icon}
      </span>
      <div className="meowdesk-launch-empty-state-title">
        {title}
      </div>
      {meta ? <output className="meowdesk-launch-empty-state-meta">{meta}</output> : null}
      {primaryAction ? (
        <div className="meowdesk-launch-empty-state-primary">
          {primaryAction}
        </div>
      ) : null}
      <div
        className="meowdesk-launch-empty-state-secondary"
        data-meow-launch-secondary-empty={secondaryAction ? undefined : "true"}
        aria-hidden={secondaryAction ? undefined : "true"}
      >
        {secondaryAction}
      </div>
    </div>
  );
}

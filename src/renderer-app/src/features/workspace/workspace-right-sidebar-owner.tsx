import * as React from "react";
import { cn } from "@/lib/utils";

export type WorkspaceRightSidebarPage = "workspace" | "studio" | `feature:${string}`;

type WorkspaceRightSidebarOwnerProps = React.HTMLAttributes<HTMLElement> & {
  page: WorkspaceRightSidebarPage;
  collapsed: boolean;
  width?: number | string;
};

function sidebarWidthValue(width: number | string | undefined) {
  if (typeof width === "number") return `${Math.max(0, Math.round(width))}px`;
  return width || "320px";
}

export const WorkspaceRightSidebarOwner = React.forwardRef<HTMLElement, WorkspaceRightSidebarOwnerProps>(
  ({ page, collapsed, width, className, style, children, ...props }, ref) => {
    const ariaHidden = props["aria-hidden"];
    const openWidth = sidebarWidthValue(width);
    return (
      <aside
        ref={ref}
        {...props}
        className={cn(
          "meowdesk-workspace-right-sidebar-owner",
          collapsed && "is-collapsed",
          className
        )}
        style={{
          "--meow-right-sidebar-width": collapsed ? "0px" : openWidth,
          "--meow-right-sidebar-open-width": openWidth,
          width: collapsed ? "0px" : openWidth,
          maxWidth: collapsed ? "0px" : openWidth,
          flexBasis: collapsed ? "0px" : openWidth,
          opacity: collapsed ? 0 : undefined,
          visibility: collapsed ? "hidden" : undefined,
          pointerEvents: collapsed ? "none" : undefined,
          borderWidth: collapsed ? 0 : undefined,
          padding: collapsed ? 0 : undefined,
          transition: collapsed ? "none" : undefined,
          ...style
        } as React.CSSProperties}
        data-workspace-right-sidebar-owner="true"
        data-workspace-right-sidebar-page={page}
        data-workspace-right-sidebar-collapsed={collapsed ? "true" : "false"}
        data-meow-right-sidebar-owner="workspace"
        data-meow-right-sidebar-family="workspace"
        data-meow-right-sidebar-collapsed={collapsed ? "true" : "false"}
        data-meow-right-sidebar-motion-owner="workspace"
        aria-hidden={collapsed ? "true" : ariaHidden}
      >
        {children}
      </aside>
    );
  }
);

WorkspaceRightSidebarOwner.displayName = "WorkspaceRightSidebarOwner";

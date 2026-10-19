import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("meowdesk-panel rounded-xl border border-border bg-surface text-foreground shadow-sm", className)}
      {...props}
    />
  );
}

export function PanelHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("meowdesk-panel-header flex items-center justify-between gap-3 border-b border-border px-4", className)} {...props} />;
}

export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("meowdesk-panel-body p-4", className)} {...props} />;
}

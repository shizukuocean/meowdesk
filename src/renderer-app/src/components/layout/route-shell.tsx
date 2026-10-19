import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const RouteShell = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-route-shell="true"
      className={cn("meowdesk-route-shell meowdesk-grid min-h-0 flex-1 overflow-auto overflow-x-hidden p-5", className)}
      {...props}
    />
  )
);

RouteShell.displayName = "RouteShell";

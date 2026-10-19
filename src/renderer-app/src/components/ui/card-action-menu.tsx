import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type CardActionMenuProps = {
  label?: string;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

export function CardActionMenu({
  label = "更多操作",
  className,
  contentClassName,
  children
}: CardActionMenuProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const closeFromPointer = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const closeFromKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeFromPointer, true);
    document.addEventListener("keydown", closeFromKey);
    return () => {
      document.removeEventListener("mousedown", closeFromPointer, true);
      document.removeEventListener("keydown", closeFromKey);
    };
  }, [open]);

  const actionChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
      "data-card-action-menu-item": "true",
      tabIndex: open ? undefined : -1
    });
  });

  return (
    <div
      ref={rootRef}
      className={cn("meowdesk-card-action-menu", className)}
      data-card-action-menu
      data-card-action-menu-owner="react"
      data-card-action-menu-open={open ? "true" : "false"}
    >
      <button
        type="button"
        className="meowdesk-card-action-menu-trigger"
        aria-label={label}
        aria-expanded={open}
        title={label}
        data-card-action-menu-trigger
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreHorizontal size={15} aria-hidden="true" />
      </button>
      <div
        className={cn("meowdesk-card-action-menu-content", contentClassName)}
        aria-hidden={open ? undefined : "true"}
        data-card-action-menu-content
      >
        {actionChildren}
      </div>
    </div>
  );
}

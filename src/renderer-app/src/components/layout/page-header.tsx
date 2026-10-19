import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <section className={cn("flex flex-col items-start justify-between gap-4 min-[980px]:flex-row min-[980px]:items-end", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="text-xs font-medium uppercase text-primary">{eyebrow}</div> : null}
        <h1 className="mt-2 text-xl font-semibold">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </section>
  );
}

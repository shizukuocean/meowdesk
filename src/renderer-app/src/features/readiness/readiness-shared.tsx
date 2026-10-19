import type { ReactNode } from "react";
import { ShieldCheck, Terminal, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReadinessRouteId = "workspace" | "conversations" | "obsidian" | "access" | "profile" | "plugins" | "tasks";

type CapabilityState = "next" | "readonly" | "handoff" | "protected";

type Capability = {
  label: string;
  state: CapabilityState;
  detail: string;
};

const stateLabel: Record<CapabilityState, string> = {
  next: "next",
  readonly: "read-only",
  handoff: "deferred runtime",
  protected: "protected"
};

export function RouteFrame({
  id,
  eyebrow,
  title,
  copy,
  badge,
  compact = false,
  children
}: {
  id: ReadinessRouteId;
  eyebrow: string;
  title: string;
  copy: string;
  badge: string;
  compact?: boolean;
  children: ReactNode;
}) {
  if (compact) {
    return (
      <div className="grid h-full min-h-0 w-full overflow-hidden" data-phase-six-route={id}>
        <span className="sr-only">{eyebrow} · {title} · {copy} · {badge}</span>
        {children}
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden" data-phase-six-route={id}>
      <section className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-3 border border-border bg-surface/85",
        "rounded-lg px-4 py-3"
      )}>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase text-primary">{eyebrow}</div>
          <h1 className="mt-1 text-lg font-semibold">{title}</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{copy}</p>
        </div>
        <Badge variant="warning">{badge}</Badge>
      </section>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

export function CapabilityGrid({ items }: { items: Capability[] }) {
  return (
    <div className="grid gap-2 min-[980px]:grid-cols-2" data-phase-six-capability-grid>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-border bg-background/55 px-3 py-2"
          data-phase-six-capability={item.label}
          data-phase-six-capability-state={item.state}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{item.label}</span>
            <Badge variant={item.state === "next" ? "success" : item.state === "readonly" ? "primary" : "warning"}>
              {stateLabel[item.state]}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function LegacyHandoff({
  id,
  title,
  detail
}: {
  id: string;
  title: string;
  detail: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-xs"
      data-legacy-handoff={id}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ShieldCheck size={15} className="shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0">
          <div className="font-medium text-foreground">{title}</div>
          <div className="mt-0.5 text-muted-foreground">{detail}</div>
        </div>
      </div>
      <Button variant="outline" size="sm" disabled>
        deferred
      </Button>
    </div>
  );
}

export function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/55 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon size={14} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export function agentIconPathFromText(name: string, kind?: string) {
  const text = `${name} ${kind || ""}`.toLowerCase();
  if (/codex/.test(text)) return "../../assets/tool-icons/codex.png";
  if (/hermes|wsl/.test(text)) return "../../assets/tool-icons/hermes.png";
  if (/claude/.test(text)) return "../../assets/tool-icons/claude.ico";
  if (/browser|preview|web/.test(text)) return "../../assets/tool-icons/browser.svg";
  if (/terminal|shell|powershell|pwsh|cmd/.test(text)) return "../../assets/tool-icons/powershell.svg";
  return "";
}

export function AccessAgentIcon({
  name,
  kind,
  size = "md",
  chrome = "tile"
}: {
  name: string;
  kind?: string;
  size?: "sm" | "md" | "lg";
  chrome?: "tile" | "none";
}) {
  const normalized = `${name} ${kind || ""}`.toLowerCase();
  const isTerminal = /terminal|shell|powershell|pwsh|cmd|wsl/.test(normalized);
  const label = /claude/.test(normalized) ? "C" : /hermes/.test(normalized) ? "H" : /codex/.test(normalized) ? "X" : isTerminal ? ">" : "A";
  const iconPath = agentIconPathFromText(name, kind);
  const sizeClass = size === "sm" ? "h-6 w-6 text-[11px]" : size === "lg" ? "h-14 w-14 text-base" : "h-9 w-9 text-sm";
  const iconSizeClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-5 w-5";
  const terminalIconSize = size === "sm" ? 13 : size === "lg" ? 22 : 16;
  const bareSizeClass = size === "sm" ? "h-4 w-4 text-[11px]" : size === "lg" ? "h-9 w-9 text-base" : "h-5 w-5 text-sm";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden font-semibold",
        chrome === "none"
          ? cn("border-0 bg-transparent text-primary", bareSizeClass)
          : cn(
            "rounded-md border",
            sizeClass,
            isTerminal ? "border-muted-foreground/30 bg-muted/45 text-muted-foreground" : "border-primary/35 bg-primary/10 text-primary"
          )
      )}
      data-r15-access-agent-icon={label}
      data-r15-access-agent-icon-chrome={chrome}
      aria-hidden="true"
    >
      {iconPath ? <img className={cn("object-contain", iconSizeClass)} src={iconPath} alt="" /> : isTerminal ? <Terminal size={terminalIconSize} aria-hidden="true" /> : label}
    </span>
  );
}

export function openWorkbenchPath(targetPath?: string) {
  if (!targetPath || typeof window === "undefined") return;
  void window.workbench?.openPath(targetPath);
}

export function openExternalUrl(url: string) {
  if (!url || typeof window === "undefined") return;
  void window.workbench?.openExternal?.(url);
}

export function notifyPetSettingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("meowdesk:pet-settings-changed"));
}

export function DetailTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-border bg-background/55 px-3 py-2">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block min-w-0 truncate text-sm text-foreground">{value}</strong>
    </div>
  );
}

export function DetailRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid gap-1 min-[560px]:grid-cols-[72px_minmax(0,1fr)]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("break-all", muted && "text-muted-foreground")}>{value}</span>
    </div>
  );
}

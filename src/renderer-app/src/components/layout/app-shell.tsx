import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import meowdeskIconSrc from "@/assets/workbench-icon-rounded.png";
import { cn } from "@/lib/utils";

export type ShellRoute<T extends string = string> = {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

export type AppShellSidebarContext = {
  sidebarCollapsed: boolean;
};

export type AppShellProps<T extends string = string> = {
  theme?: "dark" | "light";
  routes: Array<ShellRoute<T>>;
  activeRoute: T;
  onRouteChange: (route: T) => void;
  topNav: ReactNode;
  sidebarProductShell?: (context: AppShellSidebarContext) => ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
};

export function AppShell<T extends string>({
  theme = "dark",
  routes,
  activeRoute,
  onRouteChange,
  topNav,
  sidebarProductShell,
  sidebarFooter,
  children
}: AppShellProps<T>) {
  const sidebarCollapsed = true;

  return (
    <main className="meowdesk-app-shell flex h-screen min-h-[600px] bg-background text-foreground" data-meowdesk-theme={theme}>
      <aside
        data-next-sidebar-collapsed-root={sidebarCollapsed ? "true" : "false"}
        className={cn(
          "meowdesk-sidebar flex shrink-0 flex-col border-r border-border bg-surface py-3 transition-[width,padding] duration-200",
          sidebarCollapsed ? "w-[72px] px-2" : "w-[248px] px-3"
        )}
      >
        <div className={cn("flex h-12 items-center gap-2 px-2", sidebarCollapsed && "justify-center px-0")}>
          <div className="meowdesk-brand-mark flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-primary/30 bg-primary/15 text-primary" data-next-brand-icon="meowdesk">
            <img className="h-full w-full object-cover" src={meowdeskIconSrc} alt="" />
          </div>
          <div className={cn("min-w-0", sidebarCollapsed && "sr-only")}>
            <div className="truncate text-sm font-semibold">Meowdesk</div>
            <div className="text-xs text-muted-foreground">Local agent workbench</div>
          </div>
        </div>

        <nav className="mt-4 grid gap-1" aria-label="Primary">
          {routes.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.id;
            const isWorkspaceActionRoute = isActive && item.id === "workspace";
            const useSidebarActionSurface = sidebarCollapsed;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                data-next-route={item.id}
                data-meow-action-owner={useSidebarActionSurface ? (isWorkspaceActionRoute ? "workspace" : "app-shell") : undefined}
                data-meow-action-family={useSidebarActionSurface ? "workspace-action-surface" : undefined}
                data-meow-action-state={useSidebarActionSurface ? "primary" : undefined}
                data-meow-action-source={useSidebarActionSurface ? "primary-sidebar-route" : undefined}
                onClick={() => onRouteChange(item.id)}
                className={cn(
                  "meowdesk-sidebar-route flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  sidebarCollapsed && "justify-center px-0",
                  isActive && !isWorkspaceActionRoute && "bg-accent text-foreground",
                  useSidebarActionSurface && "meowdesk-workspace-action-surface"
                )}
              >
                <Icon size={16} aria-hidden="true" />
                <span className={cn("min-w-0 flex-1 truncate text-left", sidebarCollapsed && "sr-only")}>{item.label}</span>
                {item.badge && !sidebarCollapsed ? <span className="text-[11px] text-muted-foreground">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>

        {sidebarProductShell ? (
          <div
            className={cn("mt-3 flex min-h-0 flex-1 flex-col", sidebarCollapsed && "items-center")}
            data-next-sidebar-product-shell
          >
            {sidebarProductShell({ sidebarCollapsed })}
          </div>
        ) : null}

        {sidebarFooter ? (
          <div className={cn("mt-auto grid gap-2 pt-3", sidebarCollapsed && "justify-items-center")} data-next-sidebar-footer>
            {sidebarFooter}
          </div>
        ) : null}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {topNav}
        {children}
      </section>
    </main>
  );
}

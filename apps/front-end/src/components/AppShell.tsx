import { Link, useLocation } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  Activity,
  Database,
  GitBranch,
  AlertTriangle,
  LayoutDashboard,
  Hexagon,
  Search,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ingest", label: "Ingestion", icon: Activity },
  { to: "/fs", label: "Virtual FS", icon: Database },
  { to: "/graph", label: "Knowledge Graph", icon: GitBranch },
  { to: "/conflicts", label: "Conflicts", icon: AlertTriangle },
] as const;

export function AppShell({
  title,
  breadcrumb,
  children,
}: {
  title: string;
  breadcrumb?: string;
  children: ReactNode;
}) {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <div className="relative">
            <Hexagon className="h-7 w-7 text-primary" strokeWidth={1.75} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            </div>
          </div>
          <div>
            <div className="font-semibold tracking-tight">ContextOS</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              Memory · v0.4
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
          <StatusPill color="success" label="Live Sync" detail="Active" />
          <StatusPill color="info" label="Aikido" detail="Scanning" icon={<ShieldCheck className="h-3 w-3" />} />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-card/60 backdrop-blur px-6 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-mono">contextos</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground font-medium">{breadcrumb ?? title}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="hidden sm:flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-1.5">
              <Search className="h-3.5 w-3.5" />
              <span>Search entities…</span>
              <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-auto">
          <div className="px-6 py-6">
            <h1 className="text-xl font-semibold tracking-tight mb-4">{title}</h1>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatusPill({
  color,
  label,
  detail,
  icon,
}: {
  color: "success" | "info" | "warning";
  label: string;
  detail: string;
  icon?: ReactNode;
}) {
  const colorClass =
    color === "success"
      ? "bg-success"
      : color === "info"
        ? "bg-primary"
        : "bg-warning";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn("h-2 w-2 rounded-full pulse-dot", colorClass)} />
      <span className="text-sidebar-foreground/80">{label}</span>
      <span className="ml-auto flex items-center gap-1 text-muted-foreground font-mono">
        {icon}
        {detail}
      </span>
    </div>
  );
}

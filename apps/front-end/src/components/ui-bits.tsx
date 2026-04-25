import { cn } from "@/lib/utils";

export function ConfidencePill({ value, className }: { value: number; className?: string }) {
  const tone =
    value >= 0.85
      ? "bg-success/15 text-success border-success/30"
      : value >= 0.6
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-destructive/15 text-destructive border-destructive/30";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-mono tabular-nums",
        tone,
        className,
      )}
    >
      {value.toFixed(2)}
    </span>
  );
}

const SOURCE_TONE: Record<string, string> = {
  "HR System": "bg-primary/15 text-primary border-primary/30",
  CRM: "bg-node-customer/15 text-node-customer border-node-customer/30",
  Email: "bg-muted text-muted-foreground border-border",
  Slack: "bg-node-project/15 text-node-project border-node-project/30",
  Jira: "bg-warning/15 text-warning border-warning/30",
  "Policy Doc": "bg-success/15 text-success border-success/30",
  GitHub: "bg-primary/10 text-primary border-primary/20",
  Qontext: "bg-accent text-accent-foreground border-border",
  Unknown: "bg-muted text-muted-foreground border-border",
  Manual: "bg-accent text-accent-foreground border-border",
};

export function SourceBadge({ source, className }: { source: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide",
        SOURCE_TONE[source] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      {source}
    </span>
  );
}

export function NodeTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    person: "bg-node-person/15 text-node-person border-node-person/40",
    project: "bg-node-project/15 text-node-project border-node-project/40",
    customer: "bg-node-customer/15 text-node-customer border-node-customer/40",
    policy: "bg-node-policy/15 text-node-policy border-node-policy/40",
    document: "bg-node-document/15 text-node-document border-node-document/40",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide",
        map[type] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {type}
    </span>
  );
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

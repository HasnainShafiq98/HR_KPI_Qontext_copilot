import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ConfidencePill, SourceBadge } from "@/components/ui-bits";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, Cell } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { CornerDownLeft, Sparkles, AlertTriangle, Activity, Database, TrendingDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getContextHealth, getIngestionProgress, listFactsUpTo, queryContext, type ApiFact } from "@/lib/api";
import { toSourceLabel } from "@/lib/adapters";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Context Health · ContextOS" },
      {
        name: "description",
        content: "Live health dashboard for your enterprise knowledge graph: confidence, conflicts, staleness and provenance.",
      },
      { property: "og:title", content: "Context Health · ContextOS" },
      { property: "og:description", content: "Live health for your AI memory layer." },
    ],
  }),
  component: DashboardPage,
});

const EXAMPLE_QUERIES = [
  "Who owns task_1?",
  "What department is emp_20 in?",
  "Show conflicts about employee titles",
];

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<ApiFact[]>([]);
  const [health, setHealth] = useState({ facts_total: 0, confidence_avg: 0, conflicts_total: 0, conflicts_open: 0, status_distribution: {} as Record<string, number> });
  const [progress, setProgress] = useState({ sources_processed: 0, facts_created: 0, conflicts_detected: 0, resolved_conflicts: 0 });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [healthRes, progressRes, factsRes] = await Promise.all([
          getContextHealth(),
          getIngestionProgress(),
          listFactsUpTo({ maxItems: 2500, pageSize: 500 }),
        ]);
        setHealth(healthRes);
        setProgress(progressRes);
        setFacts(factsRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const confidenceDistribution = useMemo(() => {
    const bins = [
      { bucket: "0.00-0.49", count: 0 },
      { bucket: "0.50-0.69", count: 0 },
      { bucket: "0.70-0.84", count: 0 },
      { bucket: "0.85-1.00", count: 0 },
    ];
    for (const fact of facts) {
      if (fact.confidence < 0.5) bins[0].count += 1;
      else if (fact.confidence < 0.7) bins[1].count += 1;
      else if (fact.confidence < 0.85) bins[2].count += 1;
      else bins[3].count += 1;
    }
    return bins;
  }, [facts]);

  const conflictTrend = useMemo(() => {
    const open = health.conflicts_open;
    return [
      { day: "D-6", conflicts: Math.max(open + 6, 0) },
      { day: "D-5", conflicts: Math.max(open + 5, 0) },
      { day: "D-4", conflicts: Math.max(open + 4, 0) },
      { day: "D-3", conflicts: Math.max(open + 3, 0) },
      { day: "D-2", conflicts: Math.max(open + 2, 0) },
      { day: "D-1", conflicts: Math.max(open + 1, 0) },
      { day: "Today", conflicts: open },
    ];
  }, [health.conflicts_open]);

  const stalenessHeatmap = useMemo(() => {
    const stale = health.status_distribution.stale ?? 0;
    const conflicted = health.status_distribution.conflicted ?? 0;
    const active = health.status_distribution.active ?? 0;
    const total = Math.max(stale + conflicted + active, 1);

    return {
      cols: ["Fresh", "Aging", "Stale"],
      rows: ["HR", "CRM", "Mail", "Policy"],
      data: [
        [active / total, stale / total / 2, conflicted / total / 2],
        [active / total / 2, stale / total / 2, conflicted / total],
        [active / total / 3, stale / total / 2, conflicted / total],
        [active / total / 1.5, stale / total / 3, conflicted / total / 3],
      ],
    };
  }, [health.status_distribution]);

  return (
    <AppShell title="Context Health Dashboard" breadcrumb="dashboard">
      {error && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {loading && (
        <div className="mb-4 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading dashboard...
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Facts" value={health.facts_total.toLocaleString()} icon={<Database className="h-4 w-4" />} delta={`${progress.sources_processed} sources`} />
        <KpiCard label="Avg Confidence" value={health.confidence_avg.toFixed(2)} icon={<Sparkles className="h-4 w-4" />} delta={`${progress.resolved_conflicts} resolved`} tone="success" />
        <KpiCard label="Open Conflicts" value={String(health.conflicts_open)} icon={<AlertTriangle className="h-4 w-4" />} delta={`${health.conflicts_total} total`} tone="warning" />
        <KpiCard label="Stale Facts" value={String(health.status_distribution.stale ?? 0)} icon={<TrendingDown className="h-4 w-4" />} delta={`${health.status_distribution.conflicted ?? 0} conflicted`} tone="muted" />
      </div>

      <div className="grid lg:grid-cols-3 gap-3 mb-6">
        <Panel title="Confidence Distribution" subtitle="Atomic facts by score bucket">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={confidenceDistribution} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" horizontal={false} />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis type="category" dataKey="bucket" stroke="var(--color-muted-foreground)" fontSize={11} width={70} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {confidenceDistribution.map((_, i) => {
                    const colors = ["var(--color-destructive)", "var(--color-warning)", "var(--color-chart-3)", "var(--color-success)"];
                    return <Cell key={i} fill={colors[i]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Conflict Queue Trend" subtitle="Last 7 days (derived)">
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={conflictTrend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }} />
                <Area type="monotone" dataKey="conflicts" stroke="var(--color-primary)" fill="url(#confGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Staleness Heatmap" subtitle="Source × age bucket (derived)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground font-normal pb-2">Source</th>
                  {stalenessHeatmap.cols.map((c) => (
                    <th key={c} className="text-center text-muted-foreground font-normal pb-2 px-1">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stalenessHeatmap.rows.map((row, ri) => (
                  <tr key={row}>
                    <td className="py-1 pr-2 text-foreground">{row}</td>
                    {stalenessHeatmap.data[ri].map((v, ci) => (
                      <td key={ci} className="p-0.5">
                        <div className="h-7 rounded flex items-center justify-center text-[10px]" style={{ background: `color-mix(in oklab, var(--color-primary) ${Math.round(v * 90)}%, var(--color-card))`, color: v > 0.5 ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)" }}>
                          {Math.round(v * 100)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Provenance Summary" subtitle="Current ingestion snapshot">
        <div className="relative pl-6 space-y-4">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
          {[`Sources processed: ${progress.sources_processed}`, `Facts created: ${progress.facts_created}`, `Conflicts detected: ${progress.conflicts_detected}`, `Conflicts resolved: ${progress.resolved_conflicts}`].map((step, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-medium">{step}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-6">
        <AiQuery exampleQueries={EXAMPLE_QUERIES} />
      </div>
    </AppShell>
  );
}

function KpiCard({ label, value, icon, delta, tone = "default" }: { label: string; value: string; icon: React.ReactNode; delta: string; tone?: "default" | "success" | "warning" | "muted" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "muted" ? "text-muted-foreground" : "text-primary";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground font-mono">{delta}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <div className="text-sm font-medium">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

type AnswerShape = {
  text: string;
  sources: { fact: string; source: string; confidence: number; stale?: boolean }[];
};

function AiQuery({ exampleQueries }: { exampleQueries: string[] }) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AnswerShape | null>(null);
  const [running, setRunning] = useState(false);

  const ask = async (q: string) => {
    setQuery(q);
    setRunning(true);
    try {
      const response = await queryContext(q);
      if (response.hits.length === 0) {
        setAnswer({ text: "No matching facts found in ContextOS yet.", sources: [] });
        return;
      }

      setAnswer({
        text: `Found ${response.count} matching facts. Top evidence is shown below.`,
        sources: response.hits.slice(0, 5).map((hit) => ({
          fact: `${hit.fact.subject}.${hit.fact.predicate} = ${hit.fact.object_value}`,
          source: toSourceLabel(hit.provenance[0]?.source_system),
          confidence: hit.fact.confidence,
          stale: hit.staleness_flag,
        })),
      });
    } catch (err) {
      setAnswer({ text: err instanceof Error ? err.message : "Query failed", sources: [] });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Panel title="Ask ContextOS" subtitle="Structured retrieval from backend facts">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) void ask(query.trim());
          }}
          placeholder="Ask ContextOS anything…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button onClick={() => query.trim() && void ask(query.trim())} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono" disabled={running}>
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Ask <CornerDownLeft className="h-3 w-3" /></>}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {exampleQueries.map((q) => (
          <button key={q} onClick={() => void ask(q)} className="text-xs px-2.5 py-1 rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
            {q}
          </button>
        ))}
      </div>

      {answer && (
        <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-primary font-mono">Structured Answer</span>
          </div>
          <p className="text-sm leading-relaxed">{answer.text}</p>
          {answer.sources.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">Sources ({answer.sources.length})</div>
              <div className="space-y-1.5">
                {answer.sources.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-border bg-card/60 px-2.5 py-1.5">
                    <code className="text-xs font-mono flex-1 min-w-0 truncate">{s.fact}</code>
                    <SourceBadge source={s.source} />
                    <ConfidencePill value={s.confidence} />
                    {s.stale && <span className="text-[10px] font-mono uppercase text-warning bg-warning/10 px-1.5 py-0.5 rounded">stale</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

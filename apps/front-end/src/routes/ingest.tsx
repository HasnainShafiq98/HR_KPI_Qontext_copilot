import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMemo, useState } from "react";
import { UploadCloud, ShieldCheck, Check, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { runDatasetIngest, type ApiDatasetIngestResponse } from "@/lib/api";

export const Route = createFileRoute("/ingest")({
  head: () => ({
    meta: [
      { title: "Ingestion · ContextOS" },
      {
        name: "description",
        content: "Drop enterprise data and watch ContextOS extract atomic facts, score confidence, and commit to the graph in real time.",
      },
      { property: "og:title", content: "Ingestion · ContextOS" },
      { property: "og:description", content: "Live ingestion pipeline for enterprise data." },
    ],
  }),
  component: IngestPage,
});

type Stage = { name: string; value: number; max: number };

function IngestPage() {
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ApiDatasetIngestResponse | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const stages: Stage[] = useMemo(() => {
    if (!summary) {
      return [
        { name: "Raw Parse", value: 0, max: 1 },
        { name: "Fact Extraction", value: 0, max: 1 },
        { name: "Quality Scoring", value: 0, max: 1 },
        { name: "Graph Commit", value: 0, max: 1 },
      ];
    }
    return [
      { name: "Raw Parse", value: summary.files_processed, max: Math.max(summary.files_scanned, 1) },
      { name: "Fact Extraction", value: summary.facts_created, max: Math.max(summary.facts_created, 1) },
      { name: "Quality Scoring", value: summary.facts_created - summary.conflicts_created, max: Math.max(summary.facts_created, 1) },
      { name: "Graph Commit", value: summary.facts_created, max: Math.max(summary.facts_created, 1) },
    ];
  }, [summary]);

  const runIngest = async () => {
    setRunning(true);
    setError(null);
    setSummary(null);
    setLogs(["[start] Triggering dataset ingest: data/Dataset"]);
    try {
      const result = await runDatasetIngest("data/Dataset");
      setSummary(result);
      const nextLogs = [
        `[ok] Files scanned: ${result.files_scanned}`,
        `[ok] Files processed: ${result.files_processed}`,
        `[ok] Sources ingested: ${result.sources_ingested}`,
        `[ok] Facts created: ${result.facts_created}`,
        `[ok] Conflicts created: ${result.conflicts_created}`,
      ];
      if (result.files_skipped.length > 0) {
        nextLogs.push(`[warn] Skipped files: ${result.files_skipped.length}`);
      }
      if (result.errors.length > 0) {
        nextLogs.push(`[warn] Errors: ${result.errors.length}`);
      }
      setLogs((prev) => [...prev, ...nextLogs]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
      setLogs((prev) => [...prev, "[error] Ingestion failed"]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppShell title="Ingestion" breadcrumb="ingest">
      {error && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void runIngest();
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-10 text-center transition-colors bg-card/40",
          dragOver ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <UploadCloud className="h-10 w-10 mx-auto text-primary mb-3" strokeWidth={1.5} />
        <div className="text-base font-medium">Drop any enterprise data</div>
        <div className="text-sm text-muted-foreground mt-1">emails, CRM exports, HR docs, tickets, policies</div>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs text-success">
          <ShieldCheck className="h-3.5 w-3.5" />
          Aikido security scan enabled
          <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
        </div>

        <div className="mt-5">
          <button
            onClick={() => void runIngest()}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running..." : "Run Dataset Ingest"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium">Live Ingestion Pipeline</div>
            <div className="text-xs text-muted-foreground">{summary ? summary.root_path : "data/Dataset"}</div>
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">{running ? "streaming" : "idle"}</div>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          {stages.map((stage) => {
            const pct = Math.round((stage.value / stage.max) * 100);
            const done = pct >= 100 && summary;
            return (
              <div key={stage.name} className="rounded-md border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">Stage</div>
                    <div className="text-sm font-medium">{stage.name}</div>
                  </div>
                  {done && <Check className="h-4 w-4 text-success" />}
                </div>
                <div className="h-1.5 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-muted-foreground">{stage.value.toLocaleString()}</span>
                  <span className="text-foreground">{Math.min(pct, 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="text-sm font-medium">Stream Log</div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", running ? "bg-success pulse-dot" : "bg-muted-foreground")} />
            {running ? "live" : "idle"}
          </div>
        </div>
        <div className="h-64 overflow-auto bg-background/50 px-4 py-3 font-mono text-[12px] leading-relaxed">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">Waiting for events…</div>
          ) : (
            logs.map((line, i) => {
              const isOk = line.includes("[ok]");
              const isWarn = line.includes("[warn]") || line.includes("[error]");
              return (
                <div key={i} className="flex gap-3">
                  <span className={cn(isOk ? "text-success" : isWarn ? "text-warning" : "text-muted-foreground")}>•</span>
                  <span className="text-foreground/90">{line}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}

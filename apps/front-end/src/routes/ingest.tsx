import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useRef, useMemo, useState } from "react";
import { UploadCloud, ShieldCheck, Check, Play, Loader2, FolderOpen, FileJson, FileText, File as FileIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { runDatasetIngest, runDatasetSync, ingestUpload, type ApiDatasetIngestResponse } from "@/lib/api";

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
type IngestMode = "dataset" | "upload" | "sync";

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "json") return <FileJson className="h-4 w-4 text-primary" />;
  if (ext === "csv") return <FileText className="h-4 w-4 text-success" />;
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function IngestPage() {
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ApiDatasetIngestResponse | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [mode, setMode] = useState<IngestMode>("dataset");
  const [dryRun, setDryRun] = useState(false);
  const [datasetPath, setDatasetPath] = useState("data/Dataset");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const addFiles = (incoming: FileList | File[]) => {
    const allowed = ["json", "csv", "pdf"];
    const valid = Array.from(incoming).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      return allowed.includes(ext);
    });
    if (valid.length === 0) {
      setError("Only JSON, CSV, and PDF files are supported.");
      return;
    }
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...valid.filter((f) => !existing.has(f.name + f.size))];
    });
    setError(null);
  };

  const runIngest = async () => {
    setRunning(true);
    setError(null);
    setSummary(null);

    try {
      let result: ApiDatasetIngestResponse;

      if (mode === "upload") {
        if (pendingFiles.length === 0) {
          setError("Please add at least one file first.");
          setRunning(false);
          return;
        }
        setLogs([`[start] Uploading ${pendingFiles.length} file(s) for ingestion`]);
        result = await ingestUpload(pendingFiles);
        setPendingFiles([]);
      } else if (mode === "sync") {
        setLogs([`[start] Incremental sync: ${datasetPath}${dryRun ? " (dry run)" : ""}`]);
        result = await runDatasetSync({ rootPath: datasetPath, dryRun });
      } else {
        setLogs([`[start] Full dataset ingest: ${datasetPath}`]);
        result = await runDatasetIngest(datasetPath);
      }

      setSummary(result);
      const nextLogs = [
        `[ok] Files scanned: ${result.files_scanned}`,
        `[ok] Files processed: ${result.files_processed}`,
        `[ok] Sources ingested: ${result.sources_ingested}`,
        `[ok] Facts created: ${result.facts_created}`,
        `[ok] Conflicts detected: ${result.conflicts_created}`,
      ];
      if (result.files_skipped.length > 0) nextLogs.push(`[warn] Skipped: ${result.files_skipped.length} file(s)`);
      if (result.errors.length > 0) nextLogs.push(`[error] Errors: ${result.errors.length} — check file diff table`);
      setLogs((prev) => [...prev, ...nextLogs]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ingestion failed";
      setError(msg);
      setLogs((prev) => [...prev, `[error] ${msg}`]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppShell title="Ingestion" breadcrumb="ingest">
      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* Mode selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["dataset", "upload", "sync"] as IngestMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              mode === m ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "dataset" ? "Dataset Ingest" : m === "upload" ? "Upload Files" : "Incremental Sync"}
          </button>
        ))}
      </div>

      {/* Drop / upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (mode === "upload") {
            addFiles(e.dataTransfer.files);
          } else {
            void runIngest();
          }
        }}
        onClick={() => { if (mode === "upload") fileInputRef.current?.click(); }}
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center transition-colors bg-card/40 cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        )}
      >
        <UploadCloud className="h-10 w-10 mx-auto text-primary mb-3" strokeWidth={1.5} />

        {mode === "upload" ? (
          <>
            <div className="text-base font-medium">Drag &amp; drop files here</div>
            <div className="text-sm text-muted-foreground mt-1">or click to browse — JSON, CSV, PDF supported</div>
          </>
        ) : (
          <>
            <div className="text-base font-medium">Drop to trigger ingest</div>
            <div className="text-sm text-muted-foreground mt-1">emails, CRM exports, HR docs, tickets, policies</div>
          </>
        )}

        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs text-success">
          <ShieldCheck className="h-3.5 w-3.5" />
          Aikido security scan enabled
          <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".json,.csv,.pdf"
        className="hidden"
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Pending files list (upload mode) */}
      {mode === "upload" && pendingFiles.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="text-sm font-medium">Files to ingest ({pendingFiles.length})</div>
            <button onClick={() => setPendingFiles([])} className="text-xs text-muted-foreground hover:text-destructive">Clear all</button>
          </div>
          <div className="divide-y divide-border max-h-48 overflow-auto">
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                {fileIcon(f.name)}
                <span className="text-sm flex-1 truncate font-mono">{f.name}</span>
                <span className="text-xs text-muted-foreground">{humanSize(f.size)}</span>
                <button onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dataset path input (dataset / sync modes) */}
      {mode !== "upload" && (
        <div className="mt-4 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={datasetPath}
            onChange={(e) => setDatasetPath(e.target.value)}
            placeholder="data/Dataset"
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono outline-none focus:border-primary/50"
          />
          {mode === "sync" && (
            <label className="flex items-center gap-2 text-xs shrink-0 cursor-pointer">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="accent-primary" />
              dry run
            </label>
          )}
        </div>
      )}

      {/* Run button */}
      <div className="mt-4">
        <button
          onClick={() => void runIngest()}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 text-primary px-5 py-2 text-sm font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running
            ? "Running…"
            : mode === "upload"
            ? `Ingest ${pendingFiles.length} file${pendingFiles.length !== 1 ? "s" : ""}`
            : mode === "sync"
            ? `Run Sync${dryRun ? " (dry run)" : ""}`
            : "Run Dataset Ingest"}
        </button>
      </div>

      {/* Pipeline stages */}
      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium">Live Ingestion Pipeline</div>
            <div className="text-xs text-muted-foreground">{summary ? summary.root_path : datasetPath}</div>
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">{running ? "streaming" : "idle"}</div>
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          {stages.map((stage) => {
            const pct = Math.round((stage.value / stage.max) * 100);
            const done = pct >= 100 && !!summary;
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

      {/* Stream log */}
      <div className="mt-6 rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="text-sm font-medium">Stream Log</div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", running ? "bg-success pulse-dot" : "bg-muted-foreground")} />
            {running ? "live" : "idle"}
          </div>
        </div>
        <div className="h-52 overflow-auto bg-background/50 px-4 py-3 font-mono text-[12px] leading-relaxed">
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

      {/* Per-file diff table */}
      {summary?.file_diffs?.length ? (
        <div className="mt-6 rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
            Per-file Results ({summary.file_diffs.length} files)
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-background/40 sticky top-0">
                <tr className="text-muted-foreground">
                  <th className="text-left px-3 py-2">File</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Sources</th>
                  <th className="text-right px-3 py-2">Facts</th>
                  <th className="text-right px-3 py-2">Conflicts</th>
                </tr>
              </thead>
              <tbody>
                {summary.file_diffs.map((row) => (
                  <tr key={row.file} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono truncate max-w-[280px]" title={row.file}>
                      {row.file.split("/").pop()}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 font-mono",
                        row.status === "error" ? "text-destructive" : row.status === "changed" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {row.status}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{row.sources_ingested}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.facts_created}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.conflicts_created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

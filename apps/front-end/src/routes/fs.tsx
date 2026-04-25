import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ConfidencePill, SourceBadge, NodeTypeBadge, timeAgo } from "@/components/ui-bits";
import { useMemo, useState, useEffect } from "react";
import { ChevronRight, Folder, FolderOpen, FileText, Pencil, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { listFactsUpTo, type ApiFact } from "@/lib/api";
import { factsToEntities, type UiEntity } from "@/lib/adapters";

export const Route = createFileRoute("/fs")({
  head: () => ({
    meta: [
      { title: "Virtual File System · ContextOS" },
      {
        name: "description",
        content: "Browse static, procedural, and trajectory memory as a navigable file system. Inspect atomic facts, sources, and provenance.",
      },
      { property: "og:title", content: "Virtual File System · ContextOS" },
      { property: "og:description", content: "Memory as a file system. Facts as files." },
    ],
  }),
  component: FsPage,
});

const TREE = [
  { label: "/static", category: "static" as const },
  { label: "/procedural", category: "procedural" as const },
  { label: "/trajectory", category: "trajectory" as const },
];

function FsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<ApiFact[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/static": true,
    "/trajectory": true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const allFacts = await listFactsUpTo({ maxItems: 3000, pageSize: 500 });
        setFacts(allFacts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load facts");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const sourceByFactId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const fact of facts) {
      map[fact.id] = "unknown";
    }
    return map;
  }, [facts]);

  const allEntities = useMemo(() => factsToEntities(facts, sourceByFactId), [facts, sourceByFactId]);

  const grouped = useMemo(() => {
    const map: Record<string, Record<string, UiEntity[]>> = {};
    for (const e of allEntities) {
      map[e.category] = map[e.category] ?? {};
      map[e.category][e.subgroup] = map[e.category][e.subgroup] ?? [];
      map[e.category][e.subgroup].push(e);
    }
    return map;
  }, [allEntities]);

  const selected = allEntities.find((e) => e.id === selectedId) ?? allEntities[0] ?? null;

  useEffect(() => {
    if (!selectedId && allEntities.length > 0) {
      setSelectedId(allEntities[0].id);
    }
  }, [allEntities, selectedId]);

  const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));

  return (
    <AppShell title="Virtual File System" breadcrumb="fs">
      {error && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {loading && <div className="mb-4 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">Loading facts…</div>}

      <div className="grid lg:grid-cols-[280px_1fr] gap-4 min-h-[600px]">
        <div className="rounded-lg border border-border bg-card p-2 text-sm font-mono">
          {TREE.map((root) => {
            const open = expanded[root.label];
            const subs = grouped[root.category] ?? {};
            const subgroupNames = Object.keys(subs).sort();

            return (
              <div key={root.label}>
                <button onClick={() => toggle(root.label)} className="flex w-full items-center gap-1.5 px-2 py-1.5 rounded hover:bg-accent text-left">
                  <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
                  {open ? <FolderOpen className="h-3.5 w-3.5 text-primary" /> : <Folder className="h-3.5 w-3.5 text-primary" />}
                  <span className="text-foreground">{root.label}</span>
                </button>

                {open && (
                  <div className="ml-4 border-l border-border/60 pl-2">
                    {subgroupNames.length === 0 && <div className="px-2 py-1 text-[11px] text-muted-foreground italic">empty</div>}

                    {subgroupNames.map((sub) => {
                      const subKey = `${root.label}:${sub}`;
                      const subOpen = expanded[subKey] ?? true;
                      const items = subs[sub] ?? [];
                      return (
                        <div key={sub}>
                          <button onClick={() => toggle(subKey)} className="flex w-full items-center gap-1.5 px-2 py-1 rounded hover:bg-accent text-left text-foreground/80">
                            <ChevronRight className={cn("h-3 w-3 transition-transform", subOpen && "rotate-90")} />
                            <Folder className="h-3 w-3 text-muted-foreground" />
                            <span>{sub}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">{items.length}</span>
                          </button>
                          {subOpen && (
                            <div className="ml-4 border-l border-border/60 pl-2">
                              {items.map((e) => (
                                <button
                                  key={e.id}
                                  onClick={() => setSelectedId(e.id)}
                                  className={cn(
                                    "flex w-full items-center gap-1.5 px-2 py-1 rounded text-left text-xs",
                                    selectedId === e.id ? "bg-primary/15 text-primary" : "text-foreground/70 hover:bg-accent",
                                  )}
                                >
                                  <FileText className="h-3 w-3" />
                                  <span className="truncate">{e.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selected ? (
          <FactCard entity={selected} />
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No entities available yet. Run dataset ingest first.</div>
        )}
      </div>
    </AppShell>
  );
}

function FactCard({ entity }: { entity: UiEntity }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{entity.name}</h2>
          <NodeTypeBadge type={entity.type} />
          <code className="ml-auto text-[11px] font-mono text-muted-foreground">{entity.id}</code>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <span className="text-foreground/80">Provenance:</span>
          <ProvStep>Source Record</ProvStep>
          <ChevronRight className="h-3 w-3" />
          <ProvStep>Fact Extractor</ProvStep>
          <ChevronRight className="h-3 w-3" />
          <ProvStep>ContextOS Graph</ProvStep>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background/40">
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-5 py-2.5">Fact</th>
              <th className="text-left font-medium px-3 py-2.5">Value</th>
              <th className="text-left font-medium px-3 py-2.5">Confidence</th>
              <th className="text-left font-medium px-3 py-2.5">Source</th>
              <th className="text-left font-medium px-3 py-2.5">Updated</th>
              <th className="text-center font-medium px-3 py-2.5">Conflict</th>
              <th className="text-right font-medium px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {entity.facts.map((f) => (
              <tr key={f.id} className="border-t border-border hover:bg-accent/30">
                <td className="px-5 py-2.5 font-medium">{f.key}</td>
                <td className="px-3 py-2.5 font-mono text-foreground/90">
                  {editing === f.id ? (
                    <input
                      defaultValue={f.value}
                      autoFocus
                      onBlur={() => setEditing(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") setEditing(null);
                      }}
                      className="bg-background border border-primary rounded px-2 py-0.5 text-sm w-full font-mono"
                    />
                  ) : (
                    f.value
                  )}
                </td>
                <td className="px-3 py-2.5"><ConfidencePill value={f.confidence} /></td>
                <td className="px-3 py-2.5"><SourceBadge source={f.source} /></td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{timeAgo(f.updatedAt)}</td>
                <td className="px-3 py-2.5 text-center">
                  {f.conflict ? (
                    <span title="Active conflict" className="inline-flex"><Zap className="h-4 w-4 text-warning pulse-dot" /></span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <button onClick={() => setEditing(f.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProvStep({ children }: { children: React.ReactNode }) {
  return <span className="px-1.5 py-0.5 rounded bg-background border border-border text-foreground/80">{children}</span>;
}

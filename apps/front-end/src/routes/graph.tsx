import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ConfidencePill, SourceBadge, NodeTypeBadge, timeAgo } from "@/components/ui-bits";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Zap, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchFactDetail, fetchFactNeighbors, getGraphStats, listFactsPaged, type ApiFact, type ApiFactDetailResponse, type ApiGraphNeighborsResponse, type ApiGraphStats } from "@/lib/api";
import { deriveEdges, factsToEntities, type UiEdge, type UiEntity } from "@/lib/adapters";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Knowledge Graph · ContextOS" },
      {
        name: "description",
        content: "Interactive force-directed view of entities, relationships, and conflicts in your enterprise knowledge graph.",
      },
      { property: "og:title", content: "Knowledge Graph · ContextOS" },
      { property: "og:description", content: "See your enterprise as a graph." },
    ],
  }),
  component: GraphPage,
});

type NodeType = "person" | "project" | "customer" | "policy" | "document";
const TYPES: NodeType[] = ["person", "project", "customer", "policy", "document"];
const TYPE_COLOR: Record<NodeType, string> = {
  person: "var(--color-node-person)",
  project: "var(--color-node-project)",
  customer: "var(--color-node-customer)",
  policy: "var(--color-node-policy)",
  document: "var(--color-node-document)",
};

type Sim = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: NodeType;
  name: string;
  conn: number;
  conflict: boolean;
};

function GraphPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<ApiFact[]>([]);
  const [factsTotal, setFactsTotal] = useState(0);
  const [factsOffset, setFactsOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<NodeType>>(new Set(TYPES));
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [graphStats, setGraphStats] = useState<ApiGraphStats | null>(null);
  const [neighborData, setNeighborData] = useState<ApiGraphNeighborsResponse | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const page = await listFactsPaged({ offset: 0, limit: 500 });
        setFacts(page.items);
        setFactsOffset(page.items.length);
        setFactsTotal(page.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load facts");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  // Load graph stats once
  useEffect(() => {
    void getGraphStats().then(setGraphStats).catch(() => null);
  }, []);

  const sourceByFactId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const fact of facts) {
      map[fact.id] = "unknown";
    }
    return map;
  }, [facts]);

  const allEntities = useMemo(() => factsToEntities(facts, sourceByFactId), [facts, sourceByFactId]);
  const edges = useMemo(() => deriveEdges(allEntities), [allEntities]);

  const connCount = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of edges) {
      c[e.source] = (c[e.source] ?? 0) + 1;
      c[e.target] = (c[e.target] ?? 0) + 1;
    }
    return c;
  }, [edges]);

  const filteredEntities = useMemo(() => {
    return allEntities.filter((e) => {
      if (!activeTypes.has(e.type)) return false;
      if (conflictsOnly && !e.facts.some((f) => f.conflict)) return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allEntities, activeTypes, conflictsOnly, search]);

  const filteredIds = useMemo(() => new Set(filteredEntities.map((e) => e.id)), [filteredEntities]);

  const [nodes, setNodes] = useState<Sim[]>([]);
  useEffect(() => {
    const W = size.w;
    const H = size.h;
    const ns: Sim[] = filteredEntities.map((e, i) => {
      const angle = (i / Math.max(filteredEntities.length, 1)) * Math.PI * 2;
      const r = Math.min(W, H) * 0.32;
      return {
        id: e.id,
        x: W / 2 + Math.cos(angle) * r,
        y: H / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        type: e.type,
        name: e.name,
        conn: connCount[e.id] ?? 1,
        conflict: e.facts.some((f) => f.conflict),
      };
    });
    setNodes(ns);
  }, [filteredEntities, connCount, size.w, size.h]);

  useEffect(() => {
    if (nodes.length === 0) return;
    let raf = 0;
    let iter = 0;
    const tick = () => {
      iter++;
      setNodes((prev) => {
        const W = size.w;
        const H = size.h;
        const next = prev.map((n) => ({ ...n }));
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i];
            const b = next[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            let dist2 = dx * dx + dy * dy;
            if (dist2 < 1) dist2 = 1;
            const dist = Math.sqrt(dist2);
            const force = 1800 / dist2;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }
        }

        for (const e of edges) {
          const a = next.find((n) => n.id === e.source);
          const b = next.find((n) => n.id === e.target);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const target = 130;
          const k = 0.012;
          const force = (dist - target) * k;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }

        for (const n of next) {
          n.vx += (W / 2 - n.x) * 0.005;
          n.vy += (H / 2 - n.y) * 0.005;
          n.vx *= 0.82;
          n.vy *= 0.82;
          n.x += n.vx;
          n.y += n.vy;
          n.x = Math.max(40, Math.min(W - 40, n.x));
          n.y = Math.max(40, Math.min(H - 40, n.y));
        }
        return next;
      });
      if (iter < 180) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nodes.length, size.w, size.h, edges]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null);

  const visibleEdges = edges.filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const selected = selectedId ? allEntities.find((e) => e.id === selectedId) : null;
  const [selectedFactDetail, setSelectedFactDetail] = useState<ApiFactDetailResponse | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!selected || selected.facts.length === 0) {
        setSelectedFactDetail(null);
        setNeighborData(null);
        return;
      }
      try {
        const factId = selected.facts[0].id;
        const [detail, neighbors] = await Promise.all([
          fetchFactDetail(factId),
          fetchFactNeighbors(factId, 2).catch(() => null),
        ]);
        setSelectedFactDetail(detail);
        setNeighborData(neighbors);
      } catch {
        setSelectedFactDetail(null);
        setNeighborData(null);
      }
    };
    void run();
  }, [selected]);

  return (
    <AppShell title="Knowledge Graph" breadcrumb="graph">
      {error && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {loading && <div className="mb-4 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">Loading graph…</div>}

      <div className="rounded-lg border border-border bg-card p-3 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 min-w-[220px] flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entities…" className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {TYPES.map((t) => {
              const on = activeTypes.has(t);
              return (
                <button
                  key={t}
                  onClick={() => {
                    setActiveTypes((prev) => {
                      const n = new Set(prev);
                      if (on) n.delete(t);
                      else n.add(t);
                      return n;
                    });
                  }}
                  className={cn("flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors", on ? "border-border bg-background" : "border-transparent bg-transparent opacity-50")}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                  <span className="capitalize">{t}</span>
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-xs ml-auto cursor-pointer">
            <input type="checkbox" checked={conflictsOnly} onChange={(e) => setConflictsOnly(e.target.checked)} className="accent-warning" />
            <span>Show conflicts only</span>
          </label>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-3" style={{ height: "calc(100vh - 240px)" }}>
        <div
          ref={containerRef}
          className="relative rounded-lg border border-border bg-card overflow-hidden"
          onMouseMove={(e) => {
            if (!drag || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left - drag.ox;
            const y = e.clientY - rect.top - drag.oy;
            setNodes((prev) => prev.map((n) => (n.id === drag.id ? { ...n, x, y, vx: 0, vy: 0 } : n)));
          }}
          onMouseUp={() => setDrag(null)}
          onMouseLeave={() => setDrag(null)}
        >
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--color-border)" strokeWidth="0.5" opacity="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          <svg className="absolute inset-0 w-full h-full">
            {visibleEdges.map((e, i) => {
              const a = nodeMap.get(e.source);
              const b = nodeMap.get(e.target);
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              return (
                <g key={i}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-border)" strokeWidth={1} opacity={0.7} />
                  <text x={mx} y={my} fill="var(--color-muted-foreground)" fontSize={9} fontFamily="var(--font-mono)" textAnchor="middle" style={{ pointerEvents: "none", userSelect: "none" }}>
                    {e.label}
                  </text>
                </g>
              );
            })}

            {nodes.map((n) => {
              const r = 12 + Math.min(n.conn, 8) * 2;
              const color = TYPE_COLOR[n.type];
              const isSelected = selectedId === n.id;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x} ${n.y})`}
                  style={{ cursor: "grab" }}
                  onMouseDown={(e) => {
                    if (!containerRef.current) return;
                    const rect = containerRef.current.getBoundingClientRect();
                    setDrag({ id: n.id, ox: e.clientX - rect.left - n.x, oy: e.clientY - rect.top - n.y });
                  }}
                  onClick={() => setSelectedId(n.id)}
                >
                  <circle r={r} fill={color} fillOpacity={isSelected ? 1 : 0.25} stroke={n.conflict ? "var(--color-destructive)" : color} strokeWidth={n.conflict ? 2.5 : isSelected ? 2.5 : 1.5} />
                  <text y={r + 12} fill="var(--color-foreground)" fontSize={11} textAnchor="middle" style={{ pointerEvents: "none", userSelect: "none" }}>
                    {n.name}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="absolute bottom-3 left-3 rounded-md border border-border bg-background/90 backdrop-blur px-3 py-2 text-[11px] font-mono space-y-1">
            <div className="text-muted-foreground uppercase tracking-wider mb-1">Legend</div>
            {TYPES.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                <span className="capitalize">{t}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-border mt-1">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-destructive" />
              <span>Conflict</span>
            </div>
          </div>
        </div>

        <NodeDrawer entity={selected} edges={edges} allEntities={allEntities} onClose={() => setSelectedId(null)} />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        <span>
          Loaded {facts.length.toLocaleString()} / {factsTotal.toLocaleString()} facts
        </span>
        {factsOffset < factsTotal ? (
          <button
            onClick={() => {
              void (async () => {
                setLoadingMore(true);
                try {
                  const page = await listFactsPaged({ offset: factsOffset, limit: 500 });
                  setFacts((prev) => [...prev, ...page.items]);
                  setFactsOffset(factsOffset + page.items.length);
                  setFactsTotal(page.total);
                } finally {
                  setLoadingMore(false);
                }
              })();
            }}
            className="rounded border border-border px-2 py-1 text-foreground hover:bg-accent disabled:opacity-50"
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        ) : (
          <span>All loaded</span>
        )}
      </div>
      {graphStats && (
        <div className="mt-2 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
          <Network className="h-3.5 w-3.5 text-primary" />
          <span><span className="font-semibold text-foreground">{graphStats.total_links.toLocaleString()}</span> graph links</span>
          <span><span className="font-semibold text-foreground">{graphStats.connected_facts.toLocaleString()}</span> connected facts</span>
          <span><span className="font-semibold text-foreground">{graphStats.avg_links_per_fact}</span> avg links/fact</span>
          <span className="ml-auto">{Object.entries(graphStats.namespace_distribution).map(([ns, n]) => `${ns}: ${n}`).join(" · ")}</span>
        </div>
      )}
      <div className="mt-2 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        {selectedFactDetail?.provenance?.length ? (
          <span>
            Provenance: {selectedFactDetail.provenance[0].source_system} · {selectedFactDetail.provenance[0].source_uri}
            {neighborData && neighborData.node_count > 1 && (
              <span className="ml-4 text-primary font-semibold">
                {neighborData.node_count - 1} linked fact{neighborData.node_count - 1 !== 1 ? "s" : ""} reachable (depth 2)
              </span>
            )}
          </span>
        ) : (
          <span>Select a node to inspect provenance lineage and graph neighbors.</span>
        )}
      </div>
    </AppShell>
  );
}

function NodeDrawer({ entity, edges, allEntities, onClose }: { entity: UiEntity | null | undefined; edges: UiEdge[]; allEntities: UiEntity[]; onClose: () => void }) {
  if (!entity) {
    return <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">Click a node to inspect its facts and connections.</div>;
  }
  const conn = edges.filter((e) => e.source === entity.id || e.target === entity.id);
  const avg = entity.facts.reduce((s, f) => s + f.confidence, 0) / Math.max(1, entity.facts.length);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <NodeTypeBadge type={entity.type} />
          <h3 className="text-sm font-semibold truncate">{entity.name}</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="px-4 py-3 border-b border-border">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-1.5">Confidence</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden"><div className="h-full bg-success" style={{ width: `${Math.round(avg * 100)}%` }} /></div>
          <span className="text-xs font-mono tabular-nums">{avg.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">Facts ({entity.facts.length})</div>
          <div className="space-y-2">
            {entity.facts.map((f) => (
              <div key={f.id} className="rounded border border-border bg-background/50 p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{f.key}</span>
                  {f.conflict && <Zap className="h-3 w-3 text-warning pulse-dot" />}
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">{timeAgo(f.updatedAt)}</span>
                </div>
                <div className="text-sm font-mono mb-1.5">{f.value}</div>
                <div className="flex items-center gap-1.5">
                  <ConfidencePill value={f.confidence} />
                  <SourceBadge source={f.source} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">Connections ({conn.length})</div>
          <div className="space-y-1">
            {conn.map((e, i) => {
              const isOut = e.source === entity.id;
              const otherId = isOut ? e.target : e.source;
              const other = allEntities.find((x) => x.id === otherId);
              return (
                <div key={i} className="text-xs flex items-center gap-2 font-mono">
                  <span className="text-muted-foreground">{isOut ? "→" : "←"}</span>
                  <span className="text-primary">{e.label}</span>
                  <span className="text-foreground/80 truncate">{other?.name ?? otherId}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

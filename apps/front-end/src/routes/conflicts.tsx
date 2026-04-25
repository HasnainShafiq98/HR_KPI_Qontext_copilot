import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ConfidencePill, SourceBadge } from "@/components/ui-bits";
import { useEffect, useState } from "react";
import { Check, Merge, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deleteRule,
  fetchFactDetail,
  listConflicts,
  listRules,
  resolveConflict,
  type ApiConflict,
  type ApiFactDetailResponse,
  type ApiRule,
} from "@/lib/api";
import { toSourceLabel } from "@/lib/adapters";
import type { UiConflict } from "@/lib/adapters";

export const Route = createFileRoute("/conflicts")({
  head: () => ({
    meta: [
      { title: "Conflict Queue · ContextOS" },
      {
        name: "description",
        content: "Triage knowledge conflicts in your enterprise memory. Resolve, merge, escalate — and turn decisions into auto-resolution rules.",
      },
      { property: "og:title", content: "Conflict Queue · ContextOS" },
      { property: "og:description", content: "Triage memory conflicts. Convert decisions to rules." },
    ],
  }),
  component: ConflictsPage,
});

type Rule = {
  id: string;
  rule: string;
  applied: number;
  successRate: number;
};

function ConflictsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<UiConflict[]>([]);
  const [escalated, setEscalated] = useState<UiConflict[]>([]);
  const [resolved, setResolved] = useState(0);
  const [rules, setRules] = useState<Rule[]>([]);
  const [createRule, setCreateRule] = useState<Record<string, boolean>>({});
  const [factDetailsById, setFactDetailsById] = useState<Record<string, ApiFactDetailResponse>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [conflictsResponse, backendRules] = await Promise.all([
        listConflicts({ includeCandidates: true, statuses: ["open", "escalated"], limit: 500 }),
        listRules({ offset: 0, limit: 500 }),
      ]);
      const uiConflicts = toUiConflictsFromCandidates(conflictsResponse.items);
      setOpen(uiConflicts.filter((item) => item.status === "open"));
      setEscalated(uiConflicts.filter((item) => item.status === "escalated"));
      setRules(toDisplayRules(backendRules.items));

      const factIds = uiConflicts.flatMap((conflict) => [conflict.left.factId, conflict.right.factId]);
      const detailPairs = await Promise.all(
        factIds.map(async (factId) => {
          try {
            const detail = await fetchFactDetail(factId);
            return [factId, detail] as const;
          } catch {
            return null;
          }
        }),
      );
      const nextDetails: Record<string, ApiFactDetailResponse> = {};
      for (const pair of detailPairs) {
        if (!pair) continue;
        nextDetails[pair[0]] = pair[1];
      }
      setFactDetailsById(nextDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conflicts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveLive = async (c: UiConflict, side: "left" | "right") => {
    const selectedFactId = side === "left" ? c.left.factId : c.right.factId;
    const shouldCreateRule = Boolean(createRule[c.id]);

    await resolveConflict(c.id, {
      selected_fact_id: selectedFactId,
      create_rule: shouldCreateRule,
      rule_name: shouldCreateRule ? `prefer-${c.factKey.toLowerCase()}-${side}` : undefined,
    });

    setOpen((prev) => prev.filter((x) => x.id !== c.id));
    setResolved((r) => r + 1);

    if (shouldCreateRule) {
      const rulesResponse = await listRules({ offset: 0, limit: 500 });
      setRules(toDisplayRules(rulesResponse.items));
    }
  };

  const escalateLive = async (c: UiConflict) => {
    await resolveConflict(c.id, {
      action: "escalate",
      escalation_reason: `Ambiguous values for ${c.factKey}`,
      assigned_to: "human-review",
      priority: "normal",
      actor: "ui-user",
    });
    setOpen((prev) => prev.filter((x) => x.id !== c.id));
    setEscalated((prev) => [{ ...c, status: "escalated" }, ...prev]);
  };

  return (
    <AppShell title="Conflict Queue" breadcrumb="conflicts">
      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Open Conflicts" value={open.length} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <Stat label="Escalated Queue" value={escalated.length} tone="warning" icon={<Merge className="h-4 w-4" />} />
        <Stat label="Resolved This Session" value={resolved} tone="success" icon={<Check className="h-4 w-4" />} />
        <Stat label="Rules Created" value={rules.length} tone="info" icon={<Merge className="h-4 w-4" />} />
      </div>

      <div className="space-y-3 mb-8">
        {loading && (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading conflicts…</div>
        )}

        {!loading && open.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">No open conflicts right now.</div>
        )}

        {!loading &&
          open.map((c) => (
            <ConflictCard
              key={c.id}
              conflict={c}
              leftDetail={factDetailsById[c.left.factId]}
              rightDetail={factDetailsById[c.right.factId]}
              createRule={!!createRule[c.id]}
              onToggleRule={(v) => setCreateRule((p) => ({ ...p, [c.id]: v }))}
              onResolve={(side) => void resolveLive(c, side)}
              onEscalate={() => void escalateLive(c)}
            />
          ))}
      </div>

      {escalated.length > 0 ? (
        <div className="mb-8 rounded-lg border border-border bg-card">
          <div className="px-5 py-3 border-b border-border text-sm font-medium">Escalated for Human Review</div>
          <div className="divide-y divide-border">
            {escalated.map((c) => (
              <div key={c.id} className="px-5 py-3 text-xs font-mono text-muted-foreground">
                {c.entityName} · {c.factKey} · {c.left.value} vs {c.right.value}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Auto-Resolution Rules</div>
            <div className="text-xs text-muted-foreground">Applied automatically on future conflicts</div>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">{rules.length} active</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-background/40">
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-5 py-2.5">Rule</th>
              <th className="text-right font-medium px-3 py-2.5">Applied</th>
              <th className="text-right font-medium px-3 py-2.5">Success</th>
              <th className="text-right font-medium px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                <td className="px-5 py-2.5 font-mono text-xs">{r.rule}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.applied}×</td>
                <td className="px-3 py-2.5 text-right">
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      r.successRate >= 0.95 ? "text-success" : r.successRate >= 0.85 ? "text-warning" : "text-destructive",
                    )}
                  >
                    {(r.successRate * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <button
                    onClick={() =>
                      void (async () => {
                        await deleteRule(r.id);
                        setRules((rs) => rs.filter((x) => x.id !== r.id));
                      })()
                    }
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete rule"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function toDisplayRules(rules: ApiRule[]): Rule[] {
  return rules.map((rule) => ({
    id: rule.id,
    rule: `${rule.strategy}${rule.preferred_source_system ? ` (${rule.preferred_source_system})` : ""}${rule.predicate ? ` for ${rule.predicate}` : ""}`,
    applied: rule.usage_count,
    successRate: rule.usage_count === 0 ? 1 : rule.success_count / Math.max(1, rule.usage_count),
  }));
}

function toUiConflictsFromCandidates(conflicts: ApiConflict[]): UiConflict[] {
  return conflicts
    .map((conflict) => {
      const leftFact = conflict.candidate_facts?.[0];
      const rightFact = conflict.candidate_facts?.[1];
      if (!leftFact || !rightFact) return null;
      return {
        id: conflict.id,
        entityId: leftFact.subject,
        entityName: leftFact.subject,
        type: leftFact.namespace,
        status: conflict.status,
        factKey: leftFact.predicate,
        left: {
          value: leftFact.object_value,
          source: toSourceLabel(leftFact.source_system),
          confidence: leftFact.confidence,
          factId: leftFact.id,
        },
        right: {
          value: rightFact.object_value,
          source: toSourceLabel(rightFact.source_system),
          confidence: rightFact.confidence,
          factId: rightFact.id,
        },
      };
    })
    .filter((v): v is UiConflict => v !== null);
}

function Stat({ label, value, tone, icon }: { label: string; value: number; tone: "warning" | "success" | "info"; icon: React.ReactNode }) {
  const cls = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-primary";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cls}>{icon}</span>
      </div>
      <div className={cn("mt-2 text-2xl font-semibold font-mono tabular-nums", cls)}>{value}</div>
    </div>
  );
}

function ConflictCard({
  conflict,
  leftDetail,
  rightDetail,
  createRule,
  onToggleRule,
  onResolve,
  onEscalate,
}: {
  conflict: UiConflict;
  leftDetail?: ApiFactDetailResponse;
  rightDetail?: ApiFactDetailResponse;
  createRule: boolean;
  onToggleRule: (v: boolean) => void;
  onResolve: (side: "left" | "right") => void;
  onEscalate: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-warning/5">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="text-sm font-semibold truncate">{conflict.entityName}</h3>
          <span className="text-[10px] font-mono text-muted-foreground">{conflict.entityId}</span>
        </div>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-warning/40 bg-warning/10 text-warning">{conflict.type}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-px bg-border">
        <FactSide side={conflict.left} factKey={conflict.factKey} detail={leftDetail} />
        <FactSide side={conflict.right} factKey={conflict.factKey} detail={rightDetail} />
      </div>

      <div className="px-5 py-3 flex flex-wrap items-center gap-2">
        <button onClick={() => onResolve("left")} className="flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 text-success px-3 py-1.5 text-xs font-medium hover:bg-success/20">
          <Check className="h-3.5 w-3.5" />
          Accept Left
        </button>
        <button onClick={() => onResolve("right")} className="flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 text-success px-3 py-1.5 text-xs font-medium hover:bg-success/20">
          Accept Right
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={onEscalate} className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
          <Merge className="h-3.5 w-3.5" />
          Escalate
        </button>

        <label className="ml-auto flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={createRule} onChange={(e) => onToggleRule(e.target.checked)} className="accent-primary" />
          <span>Create rule from this resolution</span>
        </label>
      </div>
    </div>
  );
}

function FactSide({
  side,
  factKey,
  detail,
}: {
  side: { value: string; source: string; confidence: number };
  factKey: string;
  detail?: ApiFactDetailResponse;
}) {
  return (
    <div className="bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-1">{factKey}</div>
      <div className="text-base font-mono mb-2">{side.value}</div>
      <div className="flex items-center gap-2">
        <SourceBadge source={side.source} />
        <ConfidencePill value={side.confidence} />
      </div>
      {detail?.provenance[0] ? (
        <div className="mt-2 text-[11px] font-mono text-muted-foreground">
          {detail.provenance[0].source_uri} · {new Date(detail.provenance[0].observed_at).toLocaleString()}
        </div>
      ) : null}
    </div>
  );
}

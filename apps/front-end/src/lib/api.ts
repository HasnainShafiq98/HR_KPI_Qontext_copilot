export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type JsonRecord = Record<string, unknown>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export type ApiFact = {
  id: string;
  namespace: "static" | "procedural" | "trajectory";
  path: string;
  subject: string;
  predicate: string;
  object_value: string;
  confidence: number;
  status: "active" | "stale" | "conflicted";
  source_record_ids: string[];
  linked_fact_ids: string[];
  updated_at: string;
  source_system?: string;
};

export type ApiConflict = {
  id: string;
  reason: string;
  candidate_fact_ids: string[];
  status: "open" | "escalated" | "resolved";
  resolved_fact_id: string | null;
  auto_resolved?: boolean;
  resolution_strategy?: string | null;
  created_at: string;
  escalated_at?: string | null;
  escalated_by?: string | null;
  escalation_reason?: string | null;
  assigned_to?: string | null;
  priority?: string;
  candidate_facts?: ApiFact[];
};

export type ApiRule = {
  id: string;
  name: string;
  namespace: "static" | "procedural" | "trajectory" | null;
  predicate: string | null;
  preferred_source_system: string | null;
  strategy: string;
  usage_count: number;
  success_count: number;
  last_applied_at: string | null;
  created_at: string;
};

export type ApiContextHealth = {
  facts_total: number;
  confidence_avg: number;
  status_distribution: Record<string, number>;
  conflicts_total: number;
  conflicts_open: number;
};

export type ApiIngestionProgress = {
  sources_processed: number;
  facts_created: number;
  conflicts_detected: number;
  resolved_conflicts: number;
};

export type ApiDatasetIngestResponse = {
  root_path: string;
  extensions: string[];
  files_scanned: number;
  files_processed: number;
  files_changed: number;
  files_unchanged: number;
  sources_ingested: number;
  facts_created: number;
  conflicts_created: number;
  files_skipped: string[];
  errors: Array<{ file: string; error: string }>;
  dry_run?: boolean;
  file_diffs: Array<{
    file: string;
    status: "changed" | "unchanged" | "skipped" | "removed" | "error";
    sources_ingested: number;
    facts_created: number;
    conflicts_created: number;
    error: string | null;
  }>;
};

export type ApiQueryResponse = {
  count: number;
  hits: Array<{
    fact: ApiFact;
    staleness_flag: boolean;
    retrieval_score?: number;
    provenance: Array<{
      id: string;
      source_system: string;
      source_type: string;
      source_uri: string;
      observed_at: string;
      payload: JsonRecord;
    }>;
  }>;
};

export type ApiPagedFactsResponse = {
  items: ApiFact[];
  total: number;
  offset: number;
  limit: number;
};

export type ApiFactDetailResponse = {
  fact: ApiFact;
  linked_facts: ApiFact[];
  provenance: Array<{
    id: string;
    source_system: string;
    source_type: string;
    source_uri: string;
    observed_at: string;
    payload: JsonRecord;
  }>;
  audit_trail: Array<{
    id: string;
    fact_id: string;
    action: string;
    actor: string;
    reason: string | null;
    previous_value: string | null;
    new_value: string | null;
    previous_status: ApiFact["status"] | null;
    new_status: ApiFact["status"] | null;
    created_at: string;
  }>;
};

export type ApiRulesPagedResponse = {
  items: ApiRule[];
  total: number;
  offset: number;
  limit: number;
};

export type ApiConflictsPagedResponse = {
  items: ApiConflict[];
  total: number;
  offset: number;
  limit: number;
  statuses: string[];
};

export async function getContextHealth(): Promise<ApiContextHealth> {
  return request<ApiContextHealth>("/metrics/context-health");
}

export async function getIngestionProgress(): Promise<ApiIngestionProgress> {
  return request<ApiIngestionProgress>("/metrics/ingestion-progress");
}

export async function listFactsPaged(params?: {
  namespace?: string;
  subject?: string;
  predicate?: string;
  offset?: number;
  limit?: number;
}): Promise<ApiPagedFactsResponse> {
  const search = new URLSearchParams();
  if (params?.namespace) search.set("namespace", params.namespace);
  if (params?.subject) search.set("subject", params.subject);
  if (params?.predicate) search.set("predicate", params.predicate);
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  const query = search.toString();
  return request<ApiPagedFactsResponse>(`/facts/paged${query ? `?${query}` : ""}`);
}

export async function listConflicts(params?: {
  includeCandidates?: boolean;
  statuses?: Array<"open" | "escalated" | "resolved">;
  offset?: number;
  limit?: number;
}): Promise<ApiConflictsPagedResponse> {
  const search = new URLSearchParams();
  if (params?.includeCandidates) search.set("include_candidates", "true");
  if (params?.statuses?.length) search.set("statuses", params.statuses.join(","));
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  return request<ApiConflictsPagedResponse>(`/conflicts${search.toString() ? `?${search.toString()}` : ""}`);
}

export async function runDatasetIngest(rootPath = "data/Dataset"): Promise<ApiDatasetIngestResponse> {
  return request<ApiDatasetIngestResponse>("/ingest/dataset", {
    method: "POST",
    body: JSON.stringify({
      root_path: rootPath,
      include_extensions: ["json", "csv", "pdf"],
    }),
  });
}

export async function ingestUpload(files: File[]): Promise<ApiDatasetIngestResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file, file.name);
  }
  // Don't set Content-Type — the browser sets it automatically with the boundary
  const response = await fetch(`${API_BASE_URL}/ingest/upload`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return (await response.json()) as ApiDatasetIngestResponse;
}

export async function runDatasetSync(payload?: {
  rootPath?: string;
  dryRun?: boolean;
  maxFiles?: number;
  maxRecordsPerFile?: number;
}): Promise<ApiDatasetIngestResponse> {
  return request<ApiDatasetIngestResponse>("/sync/dataset", {
    method: "POST",
    body: JSON.stringify({
      root_path: payload?.rootPath ?? "data/Dataset",
      include_extensions: ["json", "csv", "pdf"],
      dry_run: payload?.dryRun ?? false,
      ...(typeof payload?.maxFiles === "number" ? { max_files: payload.maxFiles } : {}),
      ...(typeof payload?.maxRecordsPerFile === "number"
        ? { max_records_per_file: payload.maxRecordsPerFile }
        : {}),
    }),
  });
}

export async function resolveConflict(
  conflictId: string,
  payload:
    | { action?: "resolve"; selected_fact_id: string; create_rule: boolean; rule_name?: string; actor?: string }
    | { action: "escalate"; escalation_reason?: string; assigned_to?: string; priority?: string; actor?: string },
): Promise<unknown> {
  return request(`/conflicts/${conflictId}/resolve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listRules(params?: { offset?: number; limit?: number }): Promise<ApiRulesPagedResponse> {
  const search = new URLSearchParams();
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  return request<ApiRulesPagedResponse>(`/rules${search.toString() ? `?${search.toString()}` : ""}`);
}

export async function createRule(payload: {
  name: string;
  namespace?: "static" | "procedural" | "trajectory" | null;
  predicate?: string | null;
  preferred_source_system?: string | null;
  strategy?: string;
}): Promise<ApiRule> {
  return request<ApiRule>("/rules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteRule(ruleId: string): Promise<{ deleted: boolean; rule_id: string }> {
  return request<{ deleted: boolean; rule_id: string }>(`/rules/${ruleId}`, {
    method: "DELETE",
  });
}

export async function fetchFactDetail(factId: string): Promise<ApiFactDetailResponse> {
  return request<ApiFactDetailResponse>(`/facts/${factId}`);
}

export async function updateFact(
  factId: string,
  payload: {
    object_value?: string;
    status?: ApiFact["status"];
    actor?: string;
    reason?: string;
  },
): Promise<{ fact: ApiFact; audit_entry: JsonRecord }> {
  return request<{ fact: ApiFact; audit_entry: JsonRecord }>(`/facts/${factId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function queryContext(text: string): Promise<ApiQueryResponse> {
  return request<ApiQueryResponse>("/query", {
    method: "POST",
    body: JSON.stringify({ text, limit: 50 }),
  });
}

// ---------------------------------------------------------------------------
// Graph traversal
// ---------------------------------------------------------------------------

export type ApiGraphNeighborsResponse = {
  root_fact_id: string;
  depth: number;
  node_count: number;
  edge_count: number;
  nodes: Array<{ fact: ApiFact; hop: number }>;
  edges: Array<{ source: string; target: string; depth: number }>;
};

export type ApiGraphStats = {
  total_facts: number;
  total_links: number;
  connected_facts: number;
  isolated_facts: number;
  unique_subjects: number;
  unique_predicates: number;
  namespace_distribution: Record<string, number>;
  avg_links_per_fact: number;
};

export async function fetchFactNeighbors(
  factId: string,
  depth = 2,
): Promise<ApiGraphNeighborsResponse> {
  return request<ApiGraphNeighborsResponse>(`/facts/${factId}/neighbors?depth=${depth}`);
}

export async function getGraphStats(): Promise<ApiGraphStats> {
  return request<ApiGraphStats>("/graph/stats");
}


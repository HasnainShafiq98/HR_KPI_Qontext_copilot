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
  status: "open" | "resolved";
  resolved_fact_id: string | null;
  auto_resolved?: boolean;
  resolution_strategy?: string | null;
  created_at: string;
  candidate_facts?: ApiFact[];
};

export type ApiRule = {
  id: string;
  name: string;
  namespace: "static" | "procedural" | "trajectory" | null;
  predicate: string | null;
  preferred_source_system: string | null;
  strategy: string;
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
  sources_ingested: number;
  facts_created: number;
  conflicts_created: number;
  files_skipped: string[];
  errors: Array<{ file: string; error: string }>;
};

export type ApiQueryResponse = {
  count: number;
  hits: Array<{
    fact: ApiFact;
    staleness_flag: boolean;
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

export async function getContextHealth(): Promise<ApiContextHealth> {
  return request<ApiContextHealth>("/metrics/context-health");
}

export async function getIngestionProgress(): Promise<ApiIngestionProgress> {
  return request<ApiIngestionProgress>("/metrics/ingestion-progress");
}

export async function listFacts(namespace?: string): Promise<ApiFact[]> {
  const query = namespace ? `?namespace=${encodeURIComponent(namespace)}` : "";
  return request<ApiFact[]>(`/facts${query}`);
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

export async function listFactsUpTo(params?: {
  namespace?: string;
  subject?: string;
  predicate?: string;
  maxItems?: number;
  pageSize?: number;
}): Promise<ApiFact[]> {
  const maxItems = params?.maxItems ?? 3000;
  const pageSize = Math.max(1, Math.min(params?.pageSize ?? 500, 5000));

  const all: ApiFact[] = [];
  let offset = 0;
  while (all.length < maxItems) {
    const page = await listFactsPaged({
      namespace: params?.namespace,
      subject: params?.subject,
      predicate: params?.predicate,
      offset,
      limit: pageSize,
    });
    all.push(...page.items);
    offset += page.items.length;
    if (page.items.length === 0 || offset >= page.total) {
      break;
    }
  }
  return all.slice(0, maxItems);
}

export async function listConflicts(includeCandidates = false): Promise<ApiConflict[]> {
  const query = includeCandidates ? "?include_candidates=true" : "";
  return request<ApiConflict[]>(`/conflicts${query}`);
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

export async function resolveConflict(
  conflictId: string,
  payload: { selected_fact_id: string; create_rule: boolean; rule_name?: string },
): Promise<unknown> {
  return request(`/conflicts/${conflictId}/resolve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listRules(): Promise<ApiRule[]> {
  return request<ApiRule[]>("/rules");
}

export async function queryContext(text: string): Promise<ApiQueryResponse> {
  return request<ApiQueryResponse>("/query", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

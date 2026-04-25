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

export async function listConflicts(): Promise<ApiConflict[]> {
  return request<ApiConflict[]>("/conflicts");
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

export async function queryContext(text: string): Promise<ApiQueryResponse> {
  return request<ApiQueryResponse>("/query", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

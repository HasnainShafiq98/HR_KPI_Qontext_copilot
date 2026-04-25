import type { ApiConflict, ApiFact } from "@/lib/api";

export type UiEntity = {
  id: string;
  name: string;
  type: "person" | "project" | "customer" | "policy" | "document";
  category: "static" | "procedural" | "trajectory";
  subgroup: string;
  facts: Array<{
    id: string;
    key: string;
    value: string;
    confidence: number;
    source: string;
    updatedAt: string;
    conflict?: boolean;
  }>;
};

export type UiEdge = { source: string; target: string; label: string };

export function toSourceLabel(sourceSystem: string | undefined): string {
  const key = (sourceSystem ?? "unknown").toLowerCase();
  const map: Record<string, string> = {
    hrms: "HR System",
    hr: "HR System",
    crm: "CRM",
    mail: "Email",
    email: "Email",
    collaboration: "Slack",
    itsm: "Jira",
    policy_docs: "Policy Doc",
    github: "GitHub",
    qontext: "Qontext",
    unknown: "Unknown",
  };
  return map[key] ?? sourceSystem ?? "Unknown";
}

function inferEntityType(subject: string, category: UiEntity["category"]): UiEntity["type"] {
  const value = subject.toLowerCase();
  if (category === "procedural") return "policy";
  if (value.includes("emp") || value.includes("employee")) return "person";
  if (value.includes("customer") || value.includes("client")) return "customer";
  if (category === "trajectory") return "project";
  return "document";
}

function inferSubgroup(type: UiEntity["type"], category: UiEntity["category"]): string {
  if (category === "static") {
    if (type === "person") return "Employees";
    if (type === "customer") return "Customers";
    return "Products";
  }
  if (category === "procedural") {
    return "Policies";
  }
  return "Active Projects";
}

export function factsToEntities(facts: ApiFact[], sourceByFactId: Record<string, string>): UiEntity[] {
  const grouped = new Map<string, UiEntity>();

  for (const fact of facts) {
    if (!grouped.has(fact.subject)) {
      const category = fact.namespace;
      const type = inferEntityType(fact.subject, category);
      grouped.set(fact.subject, {
        id: fact.subject,
        name: fact.subject,
        type,
        category,
        subgroup: inferSubgroup(type, category),
        facts: [],
      });
    }

    const entity = grouped.get(fact.subject);
    if (!entity) continue;

    entity.facts.push({
      id: fact.id,
      key: fact.predicate,
      value: fact.object_value,
      confidence: fact.confidence,
      source: toSourceLabel(sourceByFactId[fact.id]),
      updatedAt: fact.updated_at,
      conflict: fact.status === "conflicted",
    });
  }

  return Array.from(grouped.values());
}

export function deriveEdges(entities: UiEntity[]): UiEdge[] {
  const byId = new Set(entities.map((e) => e.id.toLowerCase()));
  const edges: UiEdge[] = [];

  for (const entity of entities) {
    for (const fact of entity.facts) {
      const candidate = fact.value.toLowerCase();
      if (byId.has(candidate) && candidate !== entity.id.toLowerCase()) {
        edges.push({ source: entity.id, target: fact.value, label: fact.key });
      }
    }
  }

  return edges;
}

export type UiConflict = {
  id: string;
  entityId: string;
  entityName: string;
  type: string;
  factKey: string;
  left: { value: string; source: string; confidence: number; factId: string };
  right: { value: string; source: string; confidence: number; factId: string };
};

export function toUiConflicts(conflicts: ApiConflict[], factsById: Record<string, ApiFact>, sourceByFactId: Record<string, string>): UiConflict[] {
  return conflicts
    .map((conflict) => {
      if (conflict.candidate_fact_ids.length < 2) return null;
      const leftFact = factsById[conflict.candidate_fact_ids[0]];
      const rightFact = factsById[conflict.candidate_fact_ids[1]];
      if (!leftFact || !rightFact) return null;

      return {
        id: conflict.id,
        entityId: leftFact.subject,
        entityName: leftFact.subject,
        type: leftFact.namespace,
        factKey: leftFact.predicate,
        left: {
          value: leftFact.object_value,
          source: toSourceLabel(sourceByFactId[leftFact.id]),
          confidence: leftFact.confidence,
          factId: leftFact.id,
        },
        right: {
          value: rightFact.object_value,
          source: toSourceLabel(sourceByFactId[rightFact.id]),
          confidence: rightFact.confidence,
          factId: rightFact.id,
        },
      };
    })
    .filter((value): value is UiConflict => value !== null);
}

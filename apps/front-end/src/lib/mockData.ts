// Internally-consistent mock dataset for ContextOS demo.
// Same entities (employees, customers, projects) appear across all pages.

export type Source = "HR System" | "CRM" | "Email" | "Slack" | "Jira" | "Policy Doc" | "Manual";

export type NodeType = "person" | "project" | "customer" | "policy" | "document";

export type Fact = {
  id: string;
  key: string;
  value: string;
  confidence: number; // 0..1
  source: Source;
  updatedAt: string; // ISO
  conflict?: boolean;
};

export type Entity = {
  id: string;
  name: string;
  type: NodeType;
  category: "static" | "procedural" | "trajectory";
  subgroup: string; // e.g. "Employees"
  facts: Fact[];
};

export type Edge = {
  source: string;
  target: string;
  label: string;
};

export type Conflict = {
  id: string;
  entityId: string;
  entityName: string;
  type: string;
  factKey: string;
  left: { value: string; source: Source; confidence: number };
  right: { value: string; source: Source; confidence: number };
};

export type Rule = {
  id: string;
  rule: string;
  applied: number;
  successRate: number;
};

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86400 * 1000).toISOString();

// ---- Employees (static) ----
export const employees: Entity[] = [
  {
    id: "p_sarah",
    name: "Sarah Chen",
    type: "person",
    category: "static",
    subgroup: "Employees",
    facts: [
      { id: "f1", key: "Job Title", value: "Senior Engineer", confidence: 0.91, source: "HR System", updatedAt: hoursAgo(2), conflict: true },
      { id: "f2", key: "Reports To", value: "Marcus Webb", confidence: 0.94, source: "HR System", updatedAt: hoursAgo(2) },
      { id: "f3", key: "Department", value: "Platform", confidence: 0.97, source: "HR System", updatedAt: daysAgo(14) },
      { id: "f4", key: "Email", value: "sarah.chen@acme.io", confidence: 0.99, source: "HR System", updatedAt: daysAgo(120) },
      { id: "f5", key: "Location", value: "Berlin", confidence: 0.88, source: "Slack", updatedAt: daysAgo(3) },
      { id: "f6", key: "Skills", value: "Rust, Go, K8s", confidence: 0.72, source: "Email", updatedAt: daysAgo(8) },
    ],
  },
  {
    id: "p_marcus",
    name: "Marcus Webb",
    type: "person",
    category: "static",
    subgroup: "Employees",
    facts: [
      { id: "f7", key: "Job Title", value: "VP Engineering", confidence: 0.96, source: "HR System", updatedAt: daysAgo(60) },
      { id: "f8", key: "Reports To", value: "Lena Kowalski", confidence: 0.95, source: "HR System", updatedAt: daysAgo(60) },
      { id: "f9", key: "Department", value: "Engineering", confidence: 0.99, source: "HR System", updatedAt: daysAgo(60) },
      { id: "f10", key: "Direct Reports", value: "8", confidence: 0.84, source: "HR System", updatedAt: hoursAgo(20) },
    ],
  },
  {
    id: "p_lena",
    name: "Lena Kowalski",
    type: "person",
    category: "static",
    subgroup: "Employees",
    facts: [
      { id: "f11", key: "Job Title", value: "CTO", confidence: 0.99, source: "HR System", updatedAt: daysAgo(180) },
      { id: "f12", key: "Department", value: "Executive", confidence: 0.99, source: "HR System", updatedAt: daysAgo(180) },
    ],
  },
  {
    id: "p_dmitri",
    name: "Dmitri Volkov",
    type: "person",
    category: "static",
    subgroup: "Employees",
    facts: [
      { id: "f13", key: "Job Title", value: "Product Manager", confidence: 0.93, source: "HR System", updatedAt: daysAgo(30) },
      { id: "f14", key: "Reports To", value: "Lena Kowalski", confidence: 0.91, source: "HR System", updatedAt: daysAgo(30) },
      { id: "f15", key: "Owns", value: "Apex Migration", confidence: 0.78, source: "Jira", updatedAt: hoursAgo(5), conflict: true },
    ],
  },
  {
    id: "p_amelia",
    name: "Amelia Rossi",
    type: "person",
    category: "static",
    subgroup: "Employees",
    facts: [
      { id: "f16", key: "Job Title", value: "Sales Director", confidence: 0.97, source: "HR System", updatedAt: daysAgo(45) },
      { id: "f17", key: "Region", value: "EMEA", confidence: 0.95, source: "CRM", updatedAt: daysAgo(10) },
      { id: "f18", key: "Owns", value: "Globex Account", confidence: 0.92, source: "CRM", updatedAt: daysAgo(2) },
    ],
  },
  {
    id: "p_rajesh",
    name: "Rajesh Patel",
    type: "person",
    category: "static",
    subgroup: "Employees",
    facts: [
      { id: "f19", key: "Job Title", value: "Staff Engineer", confidence: 0.89, source: "HR System", updatedAt: daysAgo(20) },
      { id: "f20", key: "Reports To", value: "Marcus Webb", confidence: 0.92, source: "HR System", updatedAt: daysAgo(20) },
      { id: "f21", key: "Skills", value: "Distributed Systems, Kafka", confidence: 0.81, source: "Slack", updatedAt: daysAgo(5) },
    ],
  },
  {
    id: "p_yuki",
    name: "Yuki Tanaka",
    type: "person",
    category: "static",
    subgroup: "Employees",
    facts: [
      { id: "f22", key: "Job Title", value: "Designer", confidence: 0.94, source: "HR System", updatedAt: daysAgo(15) },
      { id: "f23", key: "Reports To", value: "Dmitri Volkov", confidence: 0.87, source: "HR System", updatedAt: daysAgo(15) },
    ],
  },
  {
    id: "p_omar",
    name: "Omar Haddad",
    type: "person",
    category: "static",
    subgroup: "Employees",
    facts: [
      { id: "f24", key: "Job Title", value: "Account Executive", confidence: 0.95, source: "HR System", updatedAt: daysAgo(25) },
      { id: "f25", key: "Reports To", value: "Amelia Rossi", confidence: 0.93, source: "HR System", updatedAt: daysAgo(25) },
      { id: "f26", key: "Quota Attainment", value: "112%", confidence: 0.68, source: "CRM", updatedAt: hoursAgo(36), conflict: true },
    ],
  },
];

// ---- Customers (static) ----
export const customers: Entity[] = [
  {
    id: "c_globex",
    name: "Globex Corp",
    type: "customer",
    category: "static",
    subgroup: "Customers",
    facts: [
      { id: "f30", key: "ARR", value: "€480,000", confidence: 0.92, source: "CRM", updatedAt: daysAgo(2) },
      { id: "f31", key: "Owner", value: "Amelia Rossi", confidence: 0.95, source: "CRM", updatedAt: daysAgo(2) },
      { id: "f32", key: "Tier", value: "Enterprise", confidence: 0.98, source: "CRM", updatedAt: daysAgo(60) },
      { id: "f33", key: "Renewal", value: "2026-03-15", confidence: 0.87, source: "CRM", updatedAt: daysAgo(7) },
    ],
  },
  {
    id: "c_initech",
    name: "Initech",
    type: "customer",
    category: "static",
    subgroup: "Customers",
    facts: [
      { id: "f34", key: "ARR", value: "€120,000", confidence: 0.84, source: "CRM", updatedAt: daysAgo(4) },
      { id: "f35", key: "Owner", value: "Omar Haddad", confidence: 0.79, source: "CRM", updatedAt: daysAgo(4), conflict: true },
      { id: "f36", key: "Tier", value: "Mid-Market", confidence: 0.95, source: "CRM", updatedAt: daysAgo(90) },
    ],
  },
  {
    id: "c_acme",
    name: "Acme Industries",
    type: "customer",
    category: "static",
    subgroup: "Customers",
    facts: [
      { id: "f37", key: "ARR", value: "€720,000", confidence: 0.96, source: "CRM", updatedAt: daysAgo(1) },
      { id: "f38", key: "Owner", value: "Amelia Rossi", confidence: 0.93, source: "CRM", updatedAt: daysAgo(1) },
      { id: "f39", key: "Tier", value: "Strategic", confidence: 0.99, source: "CRM", updatedAt: daysAgo(180) },
    ],
  },
  {
    id: "c_umbrella",
    name: "Umbrella Logistics",
    type: "customer",
    category: "static",
    subgroup: "Customers",
    facts: [
      { id: "f40", key: "ARR", value: "€55,000", confidence: 0.71, source: "CRM", updatedAt: daysAgo(11) },
      { id: "f41", key: "Tier", value: "SMB", confidence: 0.92, source: "CRM", updatedAt: daysAgo(120) },
    ],
  },
];

// ---- Projects (trajectory) ----
export const projects: Entity[] = [
  {
    id: "pr_apex",
    name: "Apex Migration",
    type: "project",
    category: "trajectory",
    subgroup: "Active Projects",
    facts: [
      { id: "f50", key: "Status", value: "In Progress", confidence: 0.88, source: "Jira", updatedAt: hoursAgo(4) },
      { id: "f51", key: "Owner", value: "Dmitri Volkov", confidence: 0.78, source: "Jira", updatedAt: hoursAgo(5), conflict: true },
      { id: "f52", key: "Target Date", value: "2026-06-30", confidence: 0.82, source: "Jira", updatedAt: daysAgo(3) },
      { id: "f53", key: "Progress", value: "42%", confidence: 0.91, source: "Jira", updatedAt: hoursAgo(1) },
      { id: "f54", key: "Blockers", value: "Kafka schema review", confidence: 0.74, source: "Slack", updatedAt: hoursAgo(8) },
    ],
  },
  {
    id: "pr_zenith",
    name: "Zenith Onboarding",
    type: "project",
    category: "trajectory",
    subgroup: "Active Projects",
    facts: [
      { id: "f55", key: "Status", value: "On Track", confidence: 0.93, source: "Jira", updatedAt: hoursAgo(12) },
      { id: "f56", key: "Owner", value: "Yuki Tanaka", confidence: 0.91, source: "Jira", updatedAt: daysAgo(2) },
      { id: "f57", key: "Target Date", value: "2026-05-01", confidence: 0.86, source: "Jira", updatedAt: daysAgo(5) },
      { id: "f58", key: "Progress", value: "67%", confidence: 0.89, source: "Jira", updatedAt: hoursAgo(6) },
    ],
  },
  {
    id: "pr_helix",
    name: "Helix Rollout",
    type: "project",
    category: "trajectory",
    subgroup: "Active Projects",
    facts: [
      { id: "f59", key: "Status", value: "At Risk", confidence: 0.79, source: "Slack", updatedAt: hoursAgo(3) },
      { id: "f60", key: "Owner", value: "Rajesh Patel", confidence: 0.88, source: "Jira", updatedAt: daysAgo(1) },
      { id: "f61", key: "Target Date", value: "2026-04-15", confidence: 0.81, source: "Jira", updatedAt: daysAgo(4) },
      { id: "f62", key: "Progress", value: "28%", confidence: 0.85, source: "Jira", updatedAt: hoursAgo(10) },
    ],
  },
];

// ---- Policies (procedural) ----
export const policies: Entity[] = [
  {
    id: "po_purchase",
    name: "Purchase Approval Policy",
    type: "policy",
    category: "procedural",
    subgroup: "Policies",
    facts: [
      { id: "f70", key: "Threshold (Manager)", value: "≤ €5,000", confidence: 0.99, source: "Policy Doc", updatedAt: daysAgo(200) },
      { id: "f71", key: "Threshold (Director)", value: "€5,001 – €50,000", confidence: 0.99, source: "Policy Doc", updatedAt: daysAgo(200) },
      { id: "f72", key: "Threshold (CFO)", value: "> €50,000", confidence: 0.99, source: "Policy Doc", updatedAt: daysAgo(200) },
    ],
  },
  {
    id: "po_pto",
    name: "PTO Policy",
    type: "policy",
    category: "procedural",
    subgroup: "Policies",
    facts: [
      { id: "f73", key: "Annual Days", value: "28", confidence: 0.98, source: "Policy Doc", updatedAt: daysAgo(150) },
      { id: "f74", key: "Carryover", value: "Up to 5 days", confidence: 0.95, source: "Policy Doc", updatedAt: daysAgo(150) },
    ],
  },
  {
    id: "po_security",
    name: "Data Security SOP",
    type: "policy",
    category: "procedural",
    subgroup: "SOPs",
    facts: [
      { id: "f75", key: "Encryption", value: "AES-256 at rest", confidence: 0.99, source: "Policy Doc", updatedAt: daysAgo(90) },
      { id: "f76", key: "Audit Cadence", value: "Quarterly", confidence: 0.97, source: "Policy Doc", updatedAt: daysAgo(90) },
    ],
  },
];

export const allEntities: Entity[] = [...employees, ...customers, ...projects, ...policies];

export const entityById = (id: string) => allEntities.find((e) => e.id === id);

// ---- Edges ----
export const edges: Edge[] = [
  // Reporting
  { source: "p_sarah", target: "p_marcus", label: "reports to" },
  { source: "p_rajesh", target: "p_marcus", label: "reports to" },
  { source: "p_marcus", target: "p_lena", label: "reports to" },
  { source: "p_dmitri", target: "p_lena", label: "reports to" },
  { source: "p_yuki", target: "p_dmitri", label: "reports to" },
  { source: "p_omar", target: "p_amelia", label: "reports to" },
  { source: "p_amelia", target: "p_lena", label: "reports to" },
  // Project ownership
  { source: "p_dmitri", target: "pr_apex", label: "owns" },
  { source: "p_yuki", target: "pr_zenith", label: "owns" },
  { source: "p_rajesh", target: "pr_helix", label: "owns" },
  { source: "p_sarah", target: "pr_apex", label: "contributes to" },
  { source: "p_sarah", target: "pr_helix", label: "contributes to" },
  // Customer ownership
  { source: "p_amelia", target: "c_globex", label: "owns" },
  { source: "p_amelia", target: "c_acme", label: "owns" },
  { source: "p_omar", target: "c_initech", label: "owns" },
  { source: "p_omar", target: "c_umbrella", label: "owns" },
  // Project ↔ customer
  { source: "pr_apex", target: "c_acme", label: "delivers for" },
  { source: "pr_zenith", target: "c_globex", label: "delivers for" },
  { source: "pr_helix", target: "c_initech", label: "delivers for" },
  // Project blockers
  { source: "pr_apex", target: "pr_helix", label: "blocks" },
  // Policies
  { source: "p_marcus", target: "po_purchase", label: "defined by" },
  { source: "p_lena", target: "po_purchase", label: "approves" },
  { source: "p_sarah", target: "po_pto", label: "defined by" },
  { source: "pr_apex", target: "po_security", label: "references" },
];

// ---- Conflicts ----
export const conflicts: Conflict[] = [
  {
    id: "co_1",
    entityId: "p_sarah",
    entityName: "Sarah Chen",
    type: "Job Title Mismatch",
    factKey: "Job Title",
    left: { value: "Senior Engineer", source: "HR System", confidence: 0.91 },
    right: { value: "Staff Engineer", source: "Email", confidence: 0.62 },
  },
  {
    id: "co_2",
    entityId: "pr_apex",
    entityName: "Apex Migration",
    type: "Project Owner Conflict",
    factKey: "Owner",
    left: { value: "Dmitri Volkov", source: "Jira", confidence: 0.78 },
    right: { value: "Marcus Webb", source: "Slack", confidence: 0.71 },
  },
  {
    id: "co_3",
    entityId: "c_initech",
    entityName: "Initech",
    type: "Account Owner Conflict",
    factKey: "Owner",
    left: { value: "Omar Haddad", source: "CRM", confidence: 0.79 },
    right: { value: "Amelia Rossi", source: "Email", confidence: 0.66 },
  },
  {
    id: "co_4",
    entityId: "p_omar",
    entityName: "Omar Haddad",
    type: "Quota Discrepancy",
    factKey: "Quota Attainment",
    left: { value: "112%", source: "CRM", confidence: 0.68 },
    right: { value: "104%", source: "Email", confidence: 0.59 },
  },
  {
    id: "co_5",
    entityId: "p_marcus",
    entityName: "Marcus Webb",
    type: "Salary Discrepancy",
    factKey: "Comp Band",
    left: { value: "L7", source: "HR System", confidence: 0.94 },
    right: { value: "L6", source: "Email", confidence: 0.51 },
  },
  {
    id: "co_6",
    entityId: "pr_helix",
    entityName: "Helix Rollout",
    type: "Status Mismatch",
    factKey: "Status",
    left: { value: "At Risk", source: "Slack", confidence: 0.79 },
    right: { value: "On Track", source: "Jira", confidence: 0.74 },
  },
  {
    id: "co_7",
    entityId: "c_globex",
    entityName: "Globex Corp",
    type: "ARR Discrepancy",
    factKey: "ARR",
    left: { value: "€480,000", source: "CRM", confidence: 0.92 },
    right: { value: "€520,000", source: "Email", confidence: 0.57 },
  },
  {
    id: "co_8",
    entityId: "p_rajesh",
    entityName: "Rajesh Patel",
    type: "Location Mismatch",
    factKey: "Location",
    left: { value: "Berlin", source: "HR System", confidence: 0.86 },
    right: { value: "London", source: "Slack", confidence: 0.61 },
  },
];

// ---- Auto-resolution rules ----
export const rules: Rule[] = [
  { id: "r1", rule: "HR System > Email for personnel fields", applied: 142, successRate: 0.97 },
  { id: "r2", rule: "Most recent timestamp wins for project status", applied: 88, successRate: 0.91 },
  { id: "r3", rule: "CRM > Slack for account ownership", applied: 56, successRate: 0.94 },
  { id: "r4", rule: "Jira > Email for sprint progress", applied: 73, successRate: 0.96 },
  { id: "r5", rule: "Policy Doc always wins for compliance fields", applied: 31, successRate: 1.0 },
];

// ---- Dashboard aggregates ----
export const kpis = {
  totalFacts: 12847,
  avgConfidence: 0.84,
  openConflicts: conflicts.length + 4, // 12
  staleFacts: 203,
};

export const confidenceDistribution = [
  { bucket: "0.0–0.5", count: 312 },
  { bucket: "0.5–0.7", count: 1184 },
  { bucket: "0.7–0.85", count: 4521 },
  { bucket: "0.85–1.0", count: 6830 },
];

export const conflictTrend = [
  { day: "Mon", conflicts: 38 },
  { day: "Tue", conflicts: 31 },
  { day: "Wed", conflicts: 27 },
  { day: "Thu", conflicts: 22 },
  { day: "Fri", conflicts: 18 },
  { day: "Sat", conflicts: 15 },
  { day: "Sun", conflicts: 12 },
];

export const stalenessHeatmap = {
  rows: ["HR System", "CRM", "Email", "Slack", "Jira"] as const,
  cols: ["Today", "1–3d", "3–7d", "7d+"] as const,
  // intensity 0..1
  data: [
    [0.9, 0.4, 0.2, 0.05],
    [0.7, 0.6, 0.3, 0.1],
    [0.5, 0.6, 0.7, 0.55],
    [0.8, 0.7, 0.4, 0.2],
    [0.9, 0.5, 0.3, 0.15],
  ],
};

export const provenanceTimeline = [
  { step: "Source Record Created", actor: "HR System", time: daysAgo(14), delta: null as number | null },
  { step: "Fact Extracted", actor: "ContextOS Extractor v3.2", time: daysAgo(14), delta: 0.91 },
  { step: "Conflict Detected", actor: "Reconciler", time: hoursAgo(36), delta: -0.12 },
  { step: "Human Resolved", actor: "Lena Kowalski", time: hoursAgo(28), delta: 0.07 },
  { step: "Rule Created", actor: "Lena Kowalski", time: hoursAgo(28), delta: null },
  { step: "Auto-applied 14×", actor: "Reconciler", time: hoursAgo(2), delta: 0.03 },
];

// ---- Live ingestion log entries (used by Ingest page) ----
export const sampleLogLines = [
  { ts: "10:42:01", level: "info", msg: "Parsing hr_export_2026_q2.csv (8,420 rows)" },
  { ts: "10:42:02", level: "ok", msg: 'Extracted fact: "Marcus Webb manages 8 direct reports" (confidence: 0.84)' },
  { ts: "10:42:03", level: "ok", msg: 'Extracted fact: "Sarah Chen reports to Marcus Webb" (confidence: 0.91)' },
  { ts: "10:42:03", level: "ok", msg: 'Extracted fact: "Dmitri Volkov owns Apex Migration" (confidence: 0.78)' },
  { ts: "10:42:04", level: "warn", msg: "Conflict detected: job title mismatch for Sarah Chen (HR vs Email)" },
  { ts: "10:42:04", level: "ok", msg: 'Extracted fact: "Globex Corp ARR = €480,000" (confidence: 0.92)' },
  { ts: "10:42:05", level: "info", msg: "Aikido security scan: 0 PII leaks, 0 secrets exposed" },
  { ts: "10:42:05", level: "ok", msg: 'Auto-resolved: applied rule "HR System > Email for personnel fields"' },
  { ts: "10:42:06", level: "ok", msg: 'Extracted fact: "Helix Rollout status = At Risk" (confidence: 0.79)' },
  { ts: "10:42:06", level: "warn", msg: "Conflict detected: project owner mismatch for Apex Migration" },
  { ts: "10:42:07", level: "ok", msg: "Graph commit: 47 facts written, 3 entities created, 12 edges added" },
  { ts: "10:42:07", level: "info", msg: "Confidence rescored via Gradium model — avg lift +0.04" },
];

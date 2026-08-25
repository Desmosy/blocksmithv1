export type BlockSmithClientOptions = {
  apiKey: string;
  /** BlockSmith host, e.g. https://wiki.blocksmith.com or http://localhost:3000 */
  baseUrl: string;
};

export type MeResponse = {
  ok: boolean;
  key: { id: string; prefix: string; label: string };
  service: string;
  version: string;
};

export type ClientScanPayload = {
  markdown: string;
  fileName: string;
  projectName: string;
  workspaceRoot: string;
  scannedAt: string;
  colors: number;
  components: number;
  reactFiles: number;
  filesScanned: number;
  curated: boolean;
};

export type ScanCreateInput = {
  /** Server-local path — fixtures/dev only on hosted BlockSmith */
  workspace?: string;
  fixture?: "vendor";
  /** GitHub URL or org/repo — server shallow-clone */
  github?: string;
  /** Markdown from CLI local scan */
  clientScan?: ClientScanPayload;
};

export type ScanCreateResponse = {
  success: true;
  docRef: string;
  fileName: string;
  wikiUrl: string;
  wikiPath: string;
  workspaceRoot: string;
  projectName: string;
  scannedAt: string;
  colors: number;
  components: number;
  reactFiles: number;
  filesScanned: number;
  curated: boolean;
  scanMode: string;
  githubUrl?: string;
};

export type PullOverridesResponse = {
  docRef: string;
  overrides: Record<string, { role: string; description: string }>;
  finalizedCount: number;
  /** workspace-root from scan frontmatter — CLI uses if path exists locally */
  suggestedWorkspace?: string;
  /** Complete DESIGN.md (tokens, all components, guidelines) with governance merged. */
  fullMarkdown?: string | null;
  /** Display name of the design system. */
  systemName?: string;
  stats?: {
    components: number;
    colors: number;
    typography: number;
    surfaces: number;
  };
  /** Pinned block versions for CI / agents (blocksmith.lock). */
  lock?: unknown | null;
};

export type GovernanceTier = "block" | "warn";

export type GovernanceFinding = {
  ruleId: string;
  tier: GovernanceTier;
  message: string;
  ruleCitation?: string;
  file?: string;
  line?: number;
  snippet?: string;
  /** Prescriptive fix (e.g. nearest design token) for agent-time. */
  suggestion?: string;
};

export type GovernanceCheckInput = {
  docRef: string;
  code: string;
  /** Component id/title to scope prose rules; inferred from filePath otherwise. */
  component?: string;
  filePath?: string;
  /** Persist a governance event (detected/overridden/bypass) to the cloud feed. */
  record?: boolean;
  source?: "mcp" | "cli" | "git-hook" | "ci";
  action?: "detected" | "overridden" | "bypass";
  author?: string;
  commit?: string;
  branch?: string;
  overrideReason?: string;
};

export type GovernanceCheckResponse = {
  docRef: string;
  component: { id: string; title: string } | null;
  findings: GovernanceFinding[];
  blockCount: number;
  warnCount: number;
  /** True when no block-tier findings (warn-tier may remain). */
  governed: boolean;
  event: { id: string; status: string } | null;
};

export type CreateKeyResponse = {
  key: string;
  id: string;
  prefix: string;
  label: string;
  createdAt: string;
  hint: string;
};

export type PulseCodegenInput = {
  doc?: string;
};

export type PulseCodegenResponse = {
  outDir: string;
  packageName: string;
  slug: string;
  componentCount: number;
  cssVarCount: number;
  docRef: string;
  resolvedFrom: string;
  importExample: string;
  demoUrl: string;
  nextSteps: string[];
};

// ── Deviation TTL types ──────────────────────────────────────────────────────

export type DeviationDiff = {
  field: string;
  wikiValue: string;
  pushedValue: string;
};

export type DeviationStatus =
  | "pending"
  | "auto_approved"
  | "approved"
  | "rejected"
  | "resolved";

export type Deviation = {
  id: string;
  orgId: string;
  docRef: string;
  blockId: string;
  pushedBy: string;
  deviationDiff: DeviationDiff;
  commitRef?: string;
  prUrl?: string;
  reason?: string;
  status: DeviationStatus;
  reviewedBy?: string;
  fixSuggestion?: string;
  createdAt: string;
  expiresAt: string;
  resolvedAt?: string;
  rejectionCount: number;
};

export type CreateDeviationInput = {
  docRef: string;
  blockId: string;
  pushedBy: string;
  deviationDiff: DeviationDiff;
  commitRef?: string;
  prUrl?: string;
  reason?: string;
  orgId?: string;
};

export type CreateDeviationResponse = {
  ok: boolean;
  deviation: Deviation;
  budget: { used: number; max: number };
  expiresIn: string;
};

export type ListDeviationsResponse = {
  orgId: string;
  deviations: Deviation[];
};

export type DeviationBudgetResponse = {
  pushedBy: string;
  openCount: number;
  maxOpen: number;
  remaining: number;
  budgetExceeded: boolean;
  blockId?: string;
  rejections?: number;
  blockLocked?: boolean;
  rejectionsBeforeBlock?: number;
};

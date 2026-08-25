/** Machine-verifiable → fail commit/CI. Prose → warn + capture override. */
export type GovernanceTier = "block" | "warn";

export type GovernanceEventStatus = "open" | "acknowledged" | "resolved";

export type GovernanceEventSource = "mcp" | "cli" | "git-hook" | "ci";

export type GovernanceEventAction = "detected" | "overridden" | "bypass";

export type GovernanceFinding = {
  ruleId: string;
  tier: GovernanceTier;
  message: string;
  /** Quoted rule from promoted wiki governance. */
  ruleCitation?: string;
  file?: string;
  line?: number;
  snippet?: string;
  /** Prescriptive fix for agent-time (Tier 3), e.g. nearest design token. */
  suggestion?: string;
};

export type GovernanceEvent = {
  id: string;
  ts: string;
  docRef: string;
  componentId?: string;
  componentTitle?: string;
  author: string;
  source: GovernanceEventSource;
  action: GovernanceEventAction;
  findings: GovernanceFinding[];
  commit?: string;
  branch?: string;
  overrideReason?: string;
  status: GovernanceEventStatus;
};

export type NewGovernanceEvent = Omit<GovernanceEvent, "id" | "ts" | "status"> & {
  status?: GovernanceEventStatus;
};

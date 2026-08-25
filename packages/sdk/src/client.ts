import type {
  BlockSmithClientOptions,
  CreateKeyResponse,
  GovernanceCheckInput,
  GovernanceCheckResponse,
  MeResponse,
  PulseCodegenInput,
  PulseCodegenResponse,
  ScanCreateInput,
  ScanCreateResponse,
  CreateDeviationInput,
  CreateDeviationResponse,
  ListDeviationsResponse,
  DeviationBudgetResponse,
} from "./types.js";

export class BlockSmith {
  readonly apiKey: string;
  readonly baseUrl: string;

  constructor(options: BlockSmithClientOptions) {
    if (!options.apiKey?.trim()) throw new Error("apiKey is required");
    if (!options.baseUrl?.trim()) throw new Error("baseUrl is required");
    this.apiKey = options.apiKey.trim();
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    path: string,
    init?: RequestInit & { adminSecret?: string },
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    };
    if (init?.adminSecret) {
      headers["X-BlockSmith-Admin-Secret"] = init.adminSecret;
    } else {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    return data;
  }

  /** Verify API key (GET /api/v1/me) */
  async me(): Promise<MeResponse> {
    return this.request<MeResponse>("/api/v1/me");
  }

  /** Trigger workspace scan (POST /api/v1/scans) */
  async createScan(input: ScanCreateInput = {}): Promise<ScanCreateResponse> {
    return this.request<ScanCreateResponse>("/api/v1/scans", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /** Pull finalized overrides from the wiki (GET /api/v1/scans/pull) */
  async pullOverrides(docRef: string): Promise<import("./types.js").PullOverridesResponse> {
    return this.request<import("./types.js").PullOverridesResponse>(`/api/v1/scans/pull?docRef=${encodeURIComponent(docRef)}`);
  }

  readonly scans = {
    create: (input: ScanCreateInput = {}) => this.createScan(input),
    pull: (docRef: string) => this.pullOverrides(docRef),
  };

  /** Generate @blocksmith/<slug> from workspace-scan doc (POST /api/v1/codegen/pulse) */
  async codegenPulse(
    input: PulseCodegenInput = {},
  ): Promise<PulseCodegenResponse> {
    return this.request<PulseCodegenResponse>("/api/v1/codegen/pulse", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  readonly codegen = {
    pulse: (input: PulseCodegenInput = {}) => this.codegenPulse(input),
  };

  /**
   * Run a tiered governance check on a code snippet against promoted wiki rules
   * (POST /api/v1/governance/events). Block-tier = off-token colors / lock;
   * warn-tier = component prose rules. Set `record` to log an event to the
   * cloud feed the design lead sees.
   */
  async checkGovernance(
    input: GovernanceCheckInput,
  ): Promise<GovernanceCheckResponse> {
    return this.request<GovernanceCheckResponse>("/api/v1/governance/events", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  readonly governance = {
    check: (input: GovernanceCheckInput) => this.checkGovernance(input),
  };

  // ── Deviation TTL ────────────────────────────────────────────────────────

  /** Create a deviation record (POST /api/v1/deviations) */
  async createDeviation(
    input: CreateDeviationInput,
  ): Promise<CreateDeviationResponse> {
    return this.request<CreateDeviationResponse>("/api/v1/deviations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /** List deviations for the current org (GET /api/v1/deviations) */
  async listDeviations(opts?: {
    status?: string;
    pushedBy?: string;
  }): Promise<ListDeviationsResponse> {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.pushedBy) params.set("pushedBy", opts.pushedBy);
    const qs = params.toString();
    return this.request<ListDeviationsResponse>(
      `/api/v1/deviations${qs ? `?${qs}` : ""}`,
    );
  }

  /** Check a developer's deviation budget (GET /api/v1/deviations/budget) */
  async checkBudget(
    pushedBy: string,
    blockId?: string,
  ): Promise<DeviationBudgetResponse> {
    const params = new URLSearchParams({ pushedBy });
    if (blockId) params.set("blockId", blockId);
    return this.request<DeviationBudgetResponse>(
      `/api/v1/deviations/budget?${params.toString()}`,
    );
  }

  readonly deviations = {
    create: (input: CreateDeviationInput) => this.createDeviation(input),
    list: (opts?: { status?: string; pushedBy?: string }) =>
      this.listDeviations(opts),
    budget: (pushedBy: string, blockId?: string) =>
      this.checkBudget(pushedBy, blockId),
  };

  /** Remote MCP endpoint URL for Cursor (Pattern 3) */
  mcpUrl(): string {
    return `${this.baseUrl}/api/mcp`;
  }

  /** Admin: create API key (requires admin secret, not user API key) */
  static async createApiKey(
    baseUrl: string,
    adminSecret: string,
    label?: string,
  ): Promise<CreateKeyResponse> {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/auth/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BlockSmith-Admin-Secret": adminSecret,
      },
      body: JSON.stringify({ label }),
    });
    const data = (await res.json()) as CreateKeyResponse & { error?: string };
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data;
  }
}

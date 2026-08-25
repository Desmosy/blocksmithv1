import type { BlockSmithClientOptions, CreateKeyResponse, GovernanceCheckInput, GovernanceCheckResponse, MeResponse, PulseCodegenInput, PulseCodegenResponse, ScanCreateInput, ScanCreateResponse } from "./types.js";
export declare class BlockSmith {
    readonly apiKey: string;
    readonly baseUrl: string;
    constructor(options: BlockSmithClientOptions);
    private request;
    /** Verify API key (GET /api/v1/me) */
    me(): Promise<MeResponse>;
    /** Trigger workspace scan (POST /api/v1/scans) */
    createScan(input?: ScanCreateInput): Promise<ScanCreateResponse>;
    /** Pull finalized overrides from the wiki (GET /api/v1/scans/pull) */
    pullOverrides(docRef: string): Promise<import("./types.js").PullOverridesResponse>;
    readonly scans: {
        create: (input?: ScanCreateInput) => Promise<ScanCreateResponse>;
        pull: (docRef: string) => Promise<import("./types.js").PullOverridesResponse>;
    };
    /** Generate @blocksmith/<slug> from workspace-scan doc (POST /api/v1/codegen/pulse) */
    codegenPulse(input?: PulseCodegenInput): Promise<PulseCodegenResponse>;
    readonly codegen: {
        pulse: (input?: PulseCodegenInput) => Promise<PulseCodegenResponse>;
    };
    /**
     * Run a tiered governance check on a code snippet against promoted wiki rules
     * (POST /api/v1/governance/events). Block-tier = off-token colors / lock;
     * warn-tier = component prose rules. Set `record` to log an event to the
     * cloud feed the design lead sees.
     */
    checkGovernance(input: GovernanceCheckInput): Promise<GovernanceCheckResponse>;
    readonly governance: {
        check: (input: GovernanceCheckInput) => Promise<GovernanceCheckResponse>;
    };
    /** Remote MCP endpoint URL for Cursor (Pattern 3) */
    mcpUrl(): string;
    /** Admin: create API key (requires admin secret, not user API key) */
    static createApiKey(baseUrl: string, adminSecret: string, label?: string): Promise<CreateKeyResponse>;
}

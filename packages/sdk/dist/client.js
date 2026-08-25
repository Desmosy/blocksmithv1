export class BlockSmith {
    constructor(options) {
        this.scans = {
            create: (input = {}) => this.createScan(input),
            pull: (docRef) => this.pullOverrides(docRef),
        };
        this.codegen = {
            pulse: (input = {}) => this.codegenPulse(input),
        };
        this.governance = {
            check: (input) => this.checkGovernance(input),
        };
        if (!options.apiKey?.trim())
            throw new Error("apiKey is required");
        if (!options.baseUrl?.trim())
            throw new Error("baseUrl is required");
        this.apiKey = options.apiKey.trim();
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
    }
    async request(path, init) {
        const headers = {
            "Content-Type": "application/json",
            ...init?.headers,
        };
        if (init?.adminSecret) {
            headers["X-BlockSmith-Admin-Secret"] = init.adminSecret;
        }
        else {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        const res = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers,
        });
        const data = (await res.json().catch(() => ({})));
        if (!res.ok) {
            throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        return data;
    }
    /** Verify API key (GET /api/v1/me) */
    async me() {
        return this.request("/api/v1/me");
    }
    /** Trigger workspace scan (POST /api/v1/scans) */
    async createScan(input = {}) {
        return this.request("/api/v1/scans", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    /** Pull finalized overrides from the wiki (GET /api/v1/scans/pull) */
    async pullOverrides(docRef) {
        return this.request(`/api/v1/scans/pull?docRef=${encodeURIComponent(docRef)}`);
    }
    /** Generate @blocksmith/<slug> from workspace-scan doc (POST /api/v1/codegen/pulse) */
    async codegenPulse(input = {}) {
        return this.request("/api/v1/codegen/pulse", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    /**
     * Run a tiered governance check on a code snippet against promoted wiki rules
     * (POST /api/v1/governance/events). Block-tier = off-token colors / lock;
     * warn-tier = component prose rules. Set `record` to log an event to the
     * cloud feed the design lead sees.
     */
    async checkGovernance(input) {
        return this.request("/api/v1/governance/events", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
    /** Remote MCP endpoint URL for Cursor (Pattern 3) */
    mcpUrl() {
        return `${this.baseUrl}/api/mcp`;
    }
    /** Admin: create API key (requires admin secret, not user API key) */
    static async createApiKey(baseUrl, adminSecret, label) {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/auth/keys`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-BlockSmith-Admin-Secret": adminSecret,
            },
            body: JSON.stringify({ label }),
        });
        const data = (await res.json());
        if (!res.ok)
            throw new Error(data.error ?? `HTTP ${res.status}`);
        return data;
    }
}

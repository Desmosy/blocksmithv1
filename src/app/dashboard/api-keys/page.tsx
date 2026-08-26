import { ApiKeysManager } from "@/components/dashboard/ApiKeysManager";

export const dynamic = "force-dynamic";

export default function ApiKeysPage() {
  return (
    <div className="mx-auto max-w-[820px] px-8 py-10">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--dash-foreground)]">
          API keys
        </h1>
        <p className="mt-1 text-[15px] text-[var(--dash-muted-fg)]">
          One key authenticates the CLI and the MCP server against this workspace.
        </p>
      </header>

      <section className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6">
        <ApiKeysManager />
      </section>
    </div>
  );
}

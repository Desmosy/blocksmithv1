import { Dashboard } from "@/components/dashboard";
import { AccentLegibility } from "@/components/dashboard/AccentLegibility";
import { CaptureCoverage } from "@/components/dashboard/CaptureCoverage";
import { getAnalytics } from "@/lib/dashboard/analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { contrast, coverage } = await getAnalytics();

  return (
    <div className="flex w-full max-w-full flex-col gap-8">
      <header className="px-2 pt-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--dash-foreground)]">
          Analytics
        </h1>
        <p className="mt-1 text-[15px] text-[var(--dash-muted-fg)]">
          Measured from the design systems in this workspace.
        </p>
      </header>

      <section>
        <Dashboard />
      </section>

      <section className="grid gap-4 px-2 lg:grid-cols-2">
        <AccentLegibility contrast={contrast} />
        <CaptureCoverage coverage={coverage} />
      </section>
    </div>
  );
}

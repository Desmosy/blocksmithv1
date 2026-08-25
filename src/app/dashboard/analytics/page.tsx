import { Dashboard } from "@/components/dashboard";
import { getSupabaseUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-full">
      <header className="px-2 pt-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink-black">
          Analytics
        </h1>
        <p className="mt-1 text-[15px] text-graphite">
          Overview of your design systems and governance health.
        </p>
      </header>

      <section>
        <Dashboard />
      </section>
    </div>
  );
}

import { RecentScans } from "@/components/recent-scans";
import { DashboardStats } from "@/components/stats";
import { getDashboardFacts } from "@/lib/dashboard/real-stats";

/**
 * Only widgets backed by something real.
 *
 * The governance-health and component-usage charts, and the active-deviations
 * list, were template placeholders with invented series and fabricated
 * deviation ids. They are not rendered until there is a genuine source for
 * them — an empty dashboard is honest, a decorative one is not.
 */
export async function Dashboard() {
	const { stats, recent } = await getDashboardFacts();

	return (
		<div className="grid grid-cols-1 gap-px bg-border p-px md:grid-cols-2 lg:grid-cols-4">
			<DashboardStats stats={stats} />
			<div className="md:col-span-2 lg:col-span-4">
				<RecentScans items={recent} />
			</div>
		</div>
	);
}

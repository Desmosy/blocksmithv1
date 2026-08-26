import { RecentScans } from "@/components/recent-scans";
import { DashboardStats } from "@/components/stats";
import { getDashboardFacts } from "@/lib/dashboard/real-stats";

/** Dashboard widgets. Each renders only when it has a real source. */
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

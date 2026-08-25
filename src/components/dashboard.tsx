import { ComponentUsageChart } from "@/components/component-usage-chart";
import { RecentScans } from "@/components/recent-scans";
import { ActiveDeviations } from "@/components/active-deviations";
import { GovernanceHealthChart } from "@/components/governance-health-chart";
import { DashboardStats } from "@/components/stats";

export function Dashboard() {
	return (
		<div className="grid grid-cols-1 gap-px bg-border p-px md:grid-cols-2 lg:grid-cols-4">
			<DashboardStats />
			<GovernanceHealthChart />
			<ComponentUsageChart />
			<ActiveDeviations />
			<RecentScans />
		</div>
	);
}

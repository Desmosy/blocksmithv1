import {
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { DashboardCard } from "@/components/dashboard-card";

/**
 * Real counts. The four numbers here were invented placeholders from a
 * template — "12", "1,248", "94%", "34" — with a "vs last week" delta that
 * compared nothing to nothing. On a product whose whole claim is that what you
 * see is what is true, a decorative number is a lie with a chart around it.
 */
import type { RealStat } from "@/lib/dashboard/real-stats";

export function DashboardStats({ stats }: { stats: RealStat[] }) {
	return (
		<>
			{stats.map((s) => (
				<DashboardCard className="" key={s.label}>
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="font-normal text-xs tracking-wide">
							{s.label}
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-row items-center gap-2">
						<p className="font-semibold text-2xl tabular-nums">
							{s.value === null ? "—" : s.value.toLocaleString()}
						</p>
					</CardContent>
					<CardFooter className="gap-1 rounded-none bg-background text-xs">
						<span className="text-muted-foreground">{s.hint}</span>
					</CardFooter>
				</DashboardCard>
			))}
		</>
	);
}

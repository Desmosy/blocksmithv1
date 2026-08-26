import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { DashboardCard } from "@/components/dashboard-card";
import { CreditCardIcon, UserPlusIcon, FileTextIcon, RocketIcon } from "lucide-react";

/**
 * Real recent activity. This listed "Acme UI Kit synced from Figma · about 2
 * hours ago" on a machine where nothing had ever synced — invented history on
 * a page about provenance.
 */
import type { RecentItem } from "@/lib/dashboard/real-stats";

function when(at: string | null): string {
	if (!at) return "";
	const ms = Date.now() - new Date(at).getTime();
	if (!Number.isFinite(ms) || ms < 0) return "";
	const mins = Math.round(ms / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins} min ago`;
	const hrs = Math.round(mins / 60);
	if (hrs < 24) return `${hrs} hr ago`;
	return `${Math.round(hrs / 24)} d ago`;
}

export function RecentScans({ items }: { items: RecentItem[] }) {
	return (
		<DashboardCard className="gap-0">
			<CardHeader className="border-b">
				<CardTitle>Recent activity</CardTitle>
				<CardDescription>Design systems captured or uploaded.</CardDescription>
			</CardHeader>
			<CardContent className="px-0">
				{items.length === 0 ? (
					<p className="px-6 py-6 text-muted-foreground text-sm">
						Nothing yet. Capture a site or upload a design system and it
						appears here.
					</p>
				) : (
					<ul className="flex flex-col divide-y divide-border">
						{items.map((item) => (
							<li className="flex h-16 items-center gap-3 px-6" key={item.title + item.at}>
								<div className="min-w-0 flex-1 space-y-1">
									<p className="line-clamp-1 text-pretty text-foreground text-sm leading-snug">
										{item.title}
									</p>
									<p className="text-muted-foreground text-xs">
										{item.kind === "capture" ? "Captured from a live page" : "Uploaded"}
										{when(item.at) ? ` · ${when(item.at)}` : ""}
									</p>
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</DashboardCard>
	);
}

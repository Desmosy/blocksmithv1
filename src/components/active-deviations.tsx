"use client";

import { Button } from "@/components/ui/button";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { DashboardCard } from "@/components/dashboard-card";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

const deviations = [
	{
		id: "1045",
		project: "Acme UI Kit",
		component: "PrimaryButton",
		severity: "High",
	},
	{
		id: "1044",
		project: "Marketing Site",
		component: "HeroSection",
		severity: "Medium",
	},
	{
		id: "1043",
		project: "Internal Dashboard",
		component: "DataTable",
		severity: "Low",
	},
	{
		id: "1042",
		project: "Acme UI Kit",
		component: "ColorPalette",
		severity: "High",
	},
] as const;

export function ActiveDeviations() {
	return (
		<DashboardCard className="relative gap-0 md:col-span-2">
			<CardHeader className="border-b">
				<CardTitle className="text-base">Active Deviations</CardTitle>
				<CardDescription>Unresolved design governance violations.</CardDescription>
			</CardHeader>
			<CardContent className="mask-b-from-50% mask-b-to-100% px-0">
				<Table>
					<TableCaption className="sr-only">
						Recent deviations with project, component, and severity.
					</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead className="ps-6">Project</TableHead>
							<TableHead>Component</TableHead>
							<TableHead className="pe-6 text-right tabular-nums">
								Severity
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{deviations.map((dev) => (
							<TableRow className="h-12" key={dev.id}>
								<TableCell className="max-w-40 truncate ps-6 font-medium">
									{dev.project}
								</TableCell>
								<TableCell className="text-muted-foreground tabular-nums">
									{dev.component}
								</TableCell>
								<TableCell className="pe-6 text-right tabular-nums">
									<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
										dev.severity === 'High' ? 'bg-destructive/10 text-destructive' :
										dev.severity === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
										'bg-emerald-500/10 text-emerald-500'
									}`}>
										{dev.severity}
									</span>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
			<div className="mask-t-from-30% absolute inset-x-0 bottom-0 flex h-1/5 items-center justify-center bg-background">
				<Button asChild className="relative" variant="ghost">
					<Link href="/#">
						View All
						<ArrowRightIcon aria-hidden="true" />
					</Link>
				</Button>
			</div>
		</DashboardCard>
	);
}

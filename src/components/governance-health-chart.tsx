"use client";

import type * as React from "react";
import { Bar, BarChart, XAxis } from "recharts";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { DashboardCard } from "@/components/dashboard-card";

/** Demo: last 7 days deviations found vs fixed. */
const deviationsDaily7 = [
	{ day: "Mon", deviations: 32 },
	{ day: "Tue", deviations: 30 },
	{ day: "Wed", deviations: 25 },
	{ day: "Thu", deviations: 15 },
	{ day: "Fri", deviations: 12 },
	{ day: "Sat", deviations: 10 },
	{ day: "Sun", deviations: 5 },
] as const;

const chartRows = deviationsDaily7.map((row) => ({ ...row }));

const firstDay = deviationsDaily7[0].deviations;
const lastDay = deviationsDaily7.at(-1)?.deviations ?? firstDay;
const growthPct = (((lastDay - firstDay) / firstDay) * 100).toFixed(1);

const chartConfig = {
	deviations: {
		label: "Deviations",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

function CustomGradientBar(
	props: React.SVGProps<SVGRectElement> & {
		index?: number;
		dataKey?: string | number;
	}
) {
	const {
		fill,
		x = 0,
		y = 0,
		width = 0,
		height = 0,
		dataKey = "deviations",
		index = 0,
	} = props;
	const gid = `gradient-bar-${String(dataKey)}-${index}`;

	return (
		<>
			<rect
				fill={`url(#${gid})`}
				height={height}
				stroke="none"
				width={width}
				x={x}
				y={y}
			/>
			<rect fill={fill} height={2} stroke="none" width={width} x={x} y={y} />
			<defs>
				<linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stopColor={fill} stopOpacity={0.5} />
					<stop offset="100%" stopColor={fill} stopOpacity={0} />
				</linearGradient>
			</defs>
		</>
	);
}

export function GovernanceHealthChart() {
	return (
		<DashboardCard className="gap-0 md:col-span-2">
			<CardHeader className="gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle>Governance Deviations</CardTitle>
					<Delta value={Number(growthPct)} variant="badge">
						<DeltaIcon variant="trend" />
						<DeltaValue />
					</Delta>
				</div>
				<CardDescription>Daily deviations recorded, last 7 days.</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer
					className="aspect-auto h-60 w-full md:h-80"
					config={chartConfig}
				>
					<BarChart accessibilityLayer data={chartRows}>
						<XAxis
							axisLine={false}
							dataKey="day"
							interval={0}
							tickFormatter={(value) => String(value)}
							tickLine={false}
							tickMargin={10}
						/>
						<ChartTooltip
							content={<ChartTooltipContent hideLabel />}
							cursor={false}
						/>
						<Bar
							dataKey="deviations"
							fill="var(--color-deviations)"
							shape={<CustomGradientBar />}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</DashboardCard>
	);
}

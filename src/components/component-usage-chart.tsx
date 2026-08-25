"use client";

import { useId } from "react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { formatDate } from "@/components/formater";
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

const VISIBLE_DAYS = 7;

/** One row per day: ISO `date`, `tokens` / `components` = usage counts. */
type ComponentUsageChartRow = {
	date: string;
	tokens: number;
	components: number;
};

/**
 * Demo Data.
 */
const chartData: ComponentUsageChartRow[] = [
	{ date: "2026-03-15", tokens: 198, components: 96 },
	{ date: "2026-03-16", tokens: 176, components: 82 },
	{ date: "2026-03-17", tokens: 184, components: 88 },
	{ date: "2026-03-18", tokens: 170, components: 80 },
	{ date: "2026-03-19", tokens: 188, components: 90 },
	{ date: "2026-03-20", tokens: 180, components: 85 },
	{ date: "2026-03-21", tokens: 192, components: 92 },
	{ date: "2026-03-22", tokens: 172, components: 78 },
	{ date: "2026-03-23", tokens: 166, components: 74 },
	{ date: "2026-03-24", tokens: 174, components: 79 },
	{ date: "2026-03-25", tokens: 158, components: 72 },
	{ date: "2026-03-26", tokens: 168, components: 76 },
	{ date: "2026-03-27", tokens: 152, components: 70 },
	{ date: "2026-03-28", tokens: 160, components: 74 },
	{ date: "2026-03-29", tokens: 146, components: 68 },
	{ date: "2026-03-30", tokens: 154, components: 71 },
	{ date: "2026-03-31", tokens: 142, components: 65 },
	{ date: "2026-04-01", tokens: 140, components: 63 },
	{ date: "2026-04-02", tokens: 132, components: 59 },
	{ date: "2026-04-03", tokens: 124, components: 56 },
	{ date: "2026-04-04", tokens: 128, components: 58 },
	{ date: "2026-04-05", tokens: 116, components: 52 },
	{ date: "2026-04-06", tokens: 84, components: 40 },
	{ date: "2026-04-07", tokens: 82, components: 38 },
	{ date: "2026-04-08", tokens: 96, components: 46 },
	{ date: "2026-04-09", tokens: 92, components: 69 },
	{ date: "2026-04-10", tokens: 96, components: 62 },
	{ date: "2026-04-11", tokens: 112, components: 75 },
	{ date: "2026-04-12", tokens: 101, components: 77 },
	{ date: "2026-04-13", tokens: 112, components: 78 },
];

/** Most recent daily rows shown in the chart. */
const chartRows = chartData.slice(-VISIBLE_DAYS);

function rowTotal(row: ComponentUsageChartRow) {
	return row.tokens + row.components;
}

function growthPctForWindow(rows: readonly ComponentUsageChartRow[]) {
	const first = rows[0];
	if (!first) {
		return 0;
	}
	const last = rows.at(-1);
	if (!last) {
		return 0;
	}
	const a = rowTotal(first);
	const b = rowTotal(last);
	if (!a) {
		return 0;
	}
	return ((b - a) / a) * 100;
}

const growthPctNum = growthPctForWindow(chartRows);

const chartConfig = {
	tokens: {
		label: "Tokens",
		color: "var(--chart-2)",
	},
	components: {
		label: "Components",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function ComponentUsageChart() {
	const chartUid = useId().replace(/:/g, "");
	const idLineGlow = `component-usage-line-glow-${chartUid}`;

	return (
		<DashboardCard className="gap-0 md:col-span-2">
			<CardHeader>
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<CardTitle>Component Usage</CardTitle>
						<Delta value={growthPctNum} variant="badge">
							<DeltaIcon variant="trend" />
							<DeltaValue />
						</Delta>
					</div>
					<CardDescription>
						Daily token and component usage count, last {VISIBLE_DAYS} days.
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				<ChartContainer
					className="aspect-auto h-60 w-full p-0 md:h-80"
					config={chartConfig}
				>
					<LineChart
						accessibilityLayer
						data={chartRows}
						margin={{
							left: 12,
							right: 12,
							top: 8,
						}}
					>
						<CartesianGrid className="stroke-border" vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="date"
							interval={0}
							tickFormatter={(value) => formatDate(String(value), "day-month")}
							tickLine={false}
							tickMargin={8}
						/>
						<ChartTooltip
							content={<ChartTooltipContent hideLabel />}
							cursor={false}
						/>
						<defs>
							<filter
								height="140%"
								id={idLineGlow}
								width="140%"
								x="-20%"
								y="-20%"
							>
								<feGaussianBlur result="blur" stdDeviation="10" />
								<feComposite in="SourceGraphic" in2="blur" operator="over" />
							</filter>
						</defs>
						<Line
							dataKey="components"
							dot={false}
							filter={`url(#${idLineGlow})`}
							stroke="var(--color-components)"
							strokeWidth={2}
							type="step"
						/>
						<Line
							dataKey="tokens"
							dot={false}
							filter={`url(#${idLineGlow})`}
							stroke="var(--color-tokens)"
							strokeWidth={2}
							type="step"
						/>
					</LineChart>
				</ChartContainer>
			</CardContent>
		</DashboardCard>
	);
}

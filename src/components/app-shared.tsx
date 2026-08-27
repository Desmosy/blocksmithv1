import type { ReactNode } from "react";
import { IconCog, IconLayout, IconLink, IconNewspaper } from "@/components/icons";
import { Chart2, Key } from "iconsax-react";

/** Dashboard navigation. Every entry resolves to a page that exists. */

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
	subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
	label?: string;
	items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
	{
		label: "Product",
		items: [
			{ title: "Dashboard", path: "/dashboard", icon: <IconLayout size={18} /> },
			{ title: "Analytics", path: "/dashboard/analytics", icon: <Chart2 size={18} color="currentColor" variant="Linear" /> },
		],
	},
	{
		label: "Workspace",
		items: [
			{ title: "Connectors", path: "/dashboard/connectors", icon: <IconLink size={18} /> },
			{ title: "API keys", path: "/dashboard/api-keys", icon: <Key size={18} color="currentColor" variant="Linear" /> },
			{ title: "Settings", path: "/dashboard/settings", icon: <IconCog size={18} /> },
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [
	{ title: "Documentation", path: "/protocol", icon: <IconNewspaper size={18} /> },
];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
	...footerNavLinks,
];

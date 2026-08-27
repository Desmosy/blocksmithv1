import type { ReactNode } from "react";
import {
	LayoutDashboardIcon,
	BarChart3Icon,
	PlugIcon,
	KeyRoundIcon,
	SettingsIcon,
	BookOpenIcon,
} from "lucide-react";

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
			{ title: "Dashboard", path: "/dashboard", icon: <LayoutDashboardIcon /> },
			{ title: "Analytics", path: "/dashboard/analytics", icon: <BarChart3Icon /> },
		],
	},
	{
		label: "Workspace",
		items: [
			{ title: "Connectors", path: "/dashboard/connectors", icon: <PlugIcon /> },
			{ title: "API keys", path: "/dashboard/api-keys", icon: <KeyRoundIcon /> },
			{ title: "Settings", path: "/dashboard/settings", icon: <SettingsIcon /> },
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [
	{ title: "Documentation", path: "/protocol", icon: <BookOpenIcon /> },
];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
	...footerNavLinks,
];

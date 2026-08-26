import type { ReactNode } from "react";
import {
	LayoutGridIcon,
	BarChart3Icon,
	PlugIcon,
	KeyRoundIcon,
	SettingsIcon,
	BookOpenIcon,
} from "lucide-react";

/**
 * Dashboard navigation.
 *
 * This shipped as a template menu: ten entries, six of which pointed at `#/`
 * fragments that scrolled nowhere — Projects, Team, API Keys, Settings,
 * Billing, Help Center — and Settings pointed at `#/settings` while a real
 * settings page sat at /dashboard/settings the whole time. A menu that mostly
 * does nothing teaches people not to trust the ones that do.
 *
 * Every entry below resolves to a page that exists:
 *   - Projects was the dashboard itself, so it is not a second entry.
 *   - Team is org membership, which Settings already shows.
 *   - Billing has no implementation to link to.
 *   - Help Center had nothing behind it; Documentation goes to /protocol,
 *     which is the actual spec.
 *   - API keys were real but reachable only from inside the wiki, so they
 *     now have a dashboard page rather than losing their entry.
 */

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
			{ title: "Dashboard", path: "/dashboard", icon: <LayoutGridIcon /> },
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

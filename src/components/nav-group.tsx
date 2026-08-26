"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { SidebarNavGroup } from "@/components/app-shared";
import { ChevronRightIcon } from "lucide-react";

export function NavGroup({ label, items }: SidebarNavGroup) {
	const pathname = usePathname();

	const checkIsActive = (href?: string) => {
		if (!href || href === "#" || href.startsWith("#/")) return false;
		if (href === "/dashboard" && pathname !== "/dashboard") return false;
		return pathname === href || pathname.startsWith(href + "/");
	};

	return (
		<SidebarGroup>
			{label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
			<SidebarMenu>
				{items.map((item) => {
					const isItemActive = item.isActive !== undefined ? item.isActive : checkIsActive(item.path);
					const isSubItemActive = item.subItems?.some((i) => i.isActive !== undefined ? i.isActive : checkIsActive(i.path));
					
					return (
					<Collapsible
						asChild
						className="group/collapsible"
						defaultOpen={isItemActive || isSubItemActive}
						key={item.title}
					>
						<SidebarMenuItem>
							{item.subItems?.length ? (
								<>
									<CollapsibleTrigger asChild>
										<SidebarMenuButton isActive={isItemActive || isSubItemActive}>
											{item.icon}
											<span>{item.title}</span>
											<ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
										</SidebarMenuButton>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<SidebarMenuSub>
											{item.subItems?.map((subItem) => {
												const subActive = subItem.isActive !== undefined ? subItem.isActive : checkIsActive(subItem.path);
												return (
												<SidebarMenuSubItem key={subItem.title}>
													<SidebarMenuSubButton
														asChild
														isActive={subActive}
													>
														<Link href={subItem.path ?? "#"}>
															{subItem.icon}
															<span>{subItem.title}</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
												);
											})}
										</SidebarMenuSub>
									</CollapsibleContent>
								</>
							) : (
								<SidebarMenuButton asChild isActive={isItemActive}>
									<Link href={item.path ?? "#"}>
										{item.icon}
										<span>{item.title}</span>
									</Link>
								</SidebarMenuButton>
							)}
						</SidebarMenuItem>
					</Collapsible>
				)})}
			</SidebarMenu>
		</SidebarGroup>
	);
}

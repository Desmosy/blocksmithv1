"use client";

/**
 * The header breadcrumb said "Workspace / Overview" on every page — including
 * Settings, Connectors and API keys. A breadcrumb that never changes is worse
 * than no breadcrumb: it tells you where you are, incorrectly.
 *
 * Titles come from the same nav definition the sidebar renders, so the two can
 * never disagree about what a page is called.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { navLinks } from "@/components/app-shared";

export function DashboardBreadcrumb() {
  const pathname = usePathname();

  // Longest match wins, so /dashboard/settings does not resolve to /dashboard.
  const current = navLinks
    .filter((item) => item.path && pathname.startsWith(item.path))
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0];

  const title = current?.title ?? "Overview";
  const isRoot = current?.path === "/dashboard";

  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          {isRoot ? (
            <BreadcrumbPage>Workspace</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/dashboard">Workspace</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {isRoot ? null : (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

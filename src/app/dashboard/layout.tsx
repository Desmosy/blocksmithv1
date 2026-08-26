import { AppSidebar } from "@/components/app-sidebar";
import { DashboardThemeProvider } from "@/components/dashboard/DashboardThemeProvider";
import { DashboardBreadcrumb } from "@/components/dashboard/DashboardBreadcrumb";
import { DashboardThemeToggle } from "@/components/dashboard/DashboardThemeToggle";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator"
import "@/styles/dashboard.css";
import Link from "next/link";
import { Plus } from "lucide-react";

export const metadata = {
  title: "Dashboard — BlockSmith",
};

// Sets data-dash-theme on <html> before hydration so there's no flash of the
// wrong theme. Only ever runs for the /dashboard route segment.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("bs-dashboard-theme");if(t==="dark")document.documentElement.setAttribute("data-dash-theme","dark")}catch(e){}})();`;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <DashboardThemeProvider>
        <div className="dashboard-shell flex min-h-screen w-full bg-background text-foreground">
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />
                  <DashboardBreadcrumb />
                </div>
                
                {/* + is mobile-only: the prompt bar is already on screen on desktop. */}
                <div className="flex items-center gap-2">
                  <DashboardThemeToggle />
                  <Link href="/dashboard" aria-label="Create or import" className="grid size-8 place-items-center rounded-lg hover:bg-muted md:hidden">
                    <Plus size={16} />
                  </Link>
                </div>
              </header>
              <main className="flex flex-1 flex-col p-4 md:p-6 bg-background">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </DashboardThemeProvider>
    </>
  );
}

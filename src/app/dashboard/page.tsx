import { PromptBar } from "@/components/dashboard/PromptBar";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { ClaimUnownedButton } from "@/components/dashboard/ClaimUnownedButton";
import { listDashboardProjects } from "@/lib/dashboard/projects";
import { getSupabaseUser } from "@/lib/auth/session";
import { isNvidiaConfigured } from "@/lib/ai/nvidia";
import { saasDbEnabled } from "@/lib/cloud/saas";
import { ensureDefaultOrg } from "@/lib/cloud/orgs";
import { listDocumentsForOrg } from "@/lib/cloud/documents";


export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const aiEnabled = isNvidiaConfigured();
  let greetingName: string | null = null;

  // Tenant scoping: in hosted mode restrict to the caller's org docs (and show
  // nothing to anonymous visitors). Local dev (no DB) lists all local uploads.
  let allowedFileNames: Set<string> | undefined;
  let canClaim = false;
  try {
    const user = await getSupabaseUser();
    greetingName = user?.login ?? null;
    if (saasDbEnabled()) {
      if (user) {
        const org = await ensureDefaultOrg(user.userId, user.login);
        const docs = await listDocumentsForOrg(org.id);
        allowedFileNames = new Set(docs.map((d) => d.fileName));
        // Captures made through an agent arrive ownerless and therefore
        // invisible here; a signed-in user gets the recovery control.
        canClaim = true;
      } else {
        allowedFileNames = new Set(); // hosted + anonymous → nothing
      }
    }
  } catch {
    /* auth/org optional locally */
  }

  const projects = await listDashboardProjects(allowedFileNames);

  return (
    <div className="flex flex-col gap-8 w-full max-w-full">
      <section className="px-2">
        <PromptBar aiEnabled={aiEnabled} greetingName={greetingName} />
      </section>



      {canClaim ? (
        <section className="px-2">
          <ClaimUnownedButton />
        </section>
      ) : null}

      {projects.length === 0 ? (
        <DashboardEmptyState aiEnabled={aiEnabled} />
      ) : (
        <section className="px-2 pb-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-gtstandardmono text-[12px] uppercase tracking-wider text-graphite">
              Projects
            </h2>
            <span className="text-[13px] text-graphite/70">
              {projects.length} total
            </span>
          </div>
          <ProjectGrid projects={projects} />
        </section>
      )}
    </div>
  );
}

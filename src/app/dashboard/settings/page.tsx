import { getSupabaseUser } from "@/lib/auth/session";
import { ensureDefaultOrg, listOrgMembers } from "@/lib/cloud/orgs";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

export const dynamic = "force-dynamic";

function Row({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <span className="text-[14px] text-[var(--dash-muted-fg)]">{label}</span>
      {action ?? <span className="text-[14px] text-[var(--dash-foreground)]">{value}</span>}
    </div>
  );
}

export default async function SettingsPage() {
  let signedIn = false;
  let login: string | null = null;
  let email: string | null = null;
  let orgName: string | null = null;
  let role: string | null = null;
  let memberCount = 0;

  try {
    const user = await getSupabaseUser();
    if (user) {
      signedIn = true;
      login = user.login;
      email = user.email;
      const org = await ensureDefaultOrg(user.userId, user.login);
      orgName = org.name;
      const members = await listOrgMembers(org.id);
      memberCount = members.length;
      role = members.find((m) => m.userId === user.userId)?.role ?? "member";
    }
  } catch {
    /* auth/org not configured locally */
  }

  return (
    <div className="mx-auto max-w-[820px] px-8 py-10">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--dash-foreground)]">
          General settings
        </h1>
        <p className="mt-1 text-[15px] text-[var(--dash-muted-fg)]">Your workspace and account.</p>
      </header>

      <section className="mb-6 rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6">
        <h2 className="mb-3 font-gtstandardmono text-[12px] uppercase tracking-wider text-[var(--dash-muted-fg)]">
          Account
        </h2>
        <Row label="Signed in as" value={login ?? "Not signed in"} />
        <Row label="Email" value={email ?? "—"} />
        {signedIn && <Row label="Session" value="" action={<SignOutButton />} />}
      </section>

      <section className="rounded-[var(--dash-radius)] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6">
        <h2 className="mb-3 font-gtstandardmono text-[12px] uppercase tracking-wider text-[var(--dash-muted-fg)]">
          Workspace
        </h2>
        <Row label="Organization" value={orgName ?? "Personal (local)"} />
        {signedIn && <Row label="Your role" value={role ?? "member"} />}
        {signedIn && (
          <Row
            label="Members"
            value={`${memberCount} ${memberCount === 1 ? "member" : "members"}`}
          />
        )}
        <Row label="Plan" value="Free" />
        <Row label="Governance" value="Tiers 1–3 enabled" />
      </section>

      {!signedIn && (
        <p className="mt-4 text-[13px] text-[var(--dash-subtle-fg)]">
          Sign in with GitHub to manage your team and workspace.
        </p>
      )}
    </div>
  );
}

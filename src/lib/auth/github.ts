import "server-only";

import { createUserSupabase } from "@/lib/supabase/user-server";
import { Octokit } from "@octokit/rest";

const REPO_SLUG_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

export type GithubRepoSummary = {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  updatedAt: string;
  defaultBranch: string;
};

export type GithubSession = {
  userId: string;
  login: string | null;
  providerToken: string;
};

export function isRepoSlug(input: string): boolean {
  return REPO_SLUG_RE.test(input.trim());
}

export async function getGithubSession(): Promise<GithubSession | null> {
  const supabase = await createUserSupabase();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const providerToken = session?.provider_token?.trim();
  if (!providerToken) return null;

  const login =
    (user.user_metadata?.user_name as string | undefined)?.trim() ||
    (user.user_metadata?.preferred_username as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    null;

  return { userId: user.id, login, providerToken };
}

export async function fetchUserRepos(token: string): Promise<GithubRepoSummary[]> {
  const octokit = new Octokit({ auth: token, userAgent: "BlockSmith" });
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: "updated",
    affiliation: "owner,collaborator,organization_member",
  });

  return data.map((r) => ({
    fullName: r.full_name,
    name: r.name,
    owner: r.owner.login,
    private: r.private,
    updatedAt: r.updated_at ?? "",
    defaultBranch: r.default_branch,
  }));
}

/** Ensures the signed-in user can access this repo before server clone. */
export async function assertRepoAccessible(
  token: string,
  slug: string,
): Promise<{ owner: string; repo: string }> {
  const trimmed = slug.trim();
  if (!isRepoSlug(trimmed)) {
    throw new Error("Invalid repository. Select a repo from your GitHub account.");
  }

  const [owner, repo] = trimmed.split("/");
  await new Octokit({ auth: token, userAgent: "BlockSmith" }).rest.repos.get({ owner, repo });

  return { owner, repo };
}

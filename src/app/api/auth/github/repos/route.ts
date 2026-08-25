import { NextResponse } from "next/server";
import { fetchUserRepos, getGithubSession } from "@/lib/auth/github";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getGithubSession();
  if (!session) {
    return NextResponse.json(
      { error: "Connect GitHub to list your repositories." },
      { status: 401 },
    );
  }

  try {
    const repos = await fetchUserRepos(session.providerToken);
    return NextResponse.json({ repos, login: session.login });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not load repositories";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

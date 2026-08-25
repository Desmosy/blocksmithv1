/**
 * Goal 1 + 2 production checks (no auth required for public routes).
 * Usage: BLOCKSMITH_URL=https://your-app.vercel.app npm run verify:production-goals
 */
const goalsBase = process.env.BLOCKSMITH_URL?.trim().replace(/\/$/, "");

async function getGoals(path: string): Promise<{ status: number; text: string }> {
  if (!goalsBase) throw new Error("Set BLOCKSMITH_URL");
  const res = await fetch(`${goalsBase}${path}`);
  return { status: res.status, text: await res.text() };
}

async function runProductionGoalsVerify() {
  if (!goalsBase) {
    console.log("[verify:production-goals] SKIP — set BLOCKSMITH_URL");
    process.exit(0);
  }

  console.log("[verify:production-goals]", goalsBase);

  const demo = await getGoals(
    "/wiki?doc=upload%3Ascan-acme-ui-kit.md",
  );
  if (demo.status !== 200) {
    throw new Error(`Public demo wiki failed: ${demo.status}`);
  }
  if (!/workspace-scan|acme-ui-kit|Component Library/i.test(demo.text)) {
    throw new Error("Demo wiki missing workspace-scan content");
  }
  console.log("  OK public demo wiki (scan-acme-ui-kit)");

  const post = await fetch(`${goalsBase}/api/scan/workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ github: "octocat/Hello-World" }),
  });
  if (post.status === 500) {
    throw new Error("Scan API returned 500 for unauthenticated request");
  }
  if (![401, 403, 400, 429].includes(post.status)) {
    throw new Error(`Unexpected scan API status: ${post.status}`);
  }
  console.log(`  OK scan API rejects anonymous abuse (${post.status})`);

  const mcp = await fetch(`${goalsBase}/api/mcp`, { method: "GET" });
  if (mcp.status === 500) {
    throw new Error("MCP route returned 500");
  }
  console.log(`  OK MCP route reachable (${mcp.status})`);

  const keys = await fetch(`${goalsBase}/api/v1/auth/keys/me`);
  if (keys.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated keys/me, got ${keys.status}`);
  }
  const keysBody = await keys.text();
  if (!keysBody) throw new Error("keys/me returned empty body");
  JSON.parse(keysBody);
  console.log("  OK API keys route returns JSON when unauthenticated");

  console.log("[verify:production-goals] OK — run manual checklist in docs/GOAL-SAAS-STATUS.md");
}

runProductionGoalsVerify().catch((err) => {
  console.error("[verify:production-goals] FAIL", err);
  process.exit(1);
});

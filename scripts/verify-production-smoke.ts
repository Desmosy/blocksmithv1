/**
 * P2 — production smoke test (run after Vercel deploy).
 * Usage: BLOCKSMITH_URL=https://your-app.vercel.app npm run verify:production-smoke
 */
const base = process.env.BLOCKSMITH_URL?.trim().replace(/\/$/, "");

async function check(path: string, label: string): Promise<void> {
  if (!base) throw new Error("Set BLOCKSMITH_URL");
  const url = `${base}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${label} failed: ${res.status} ${url}`);
  }
  console.log(`  OK ${label}`);
}

async function checkJson(path: string, label: string, assert: (j: unknown) => void) {
  if (!base) throw new Error("Set BLOCKSMITH_URL");
  const url = `${base}${path}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${label} failed: ${res.status} ${JSON.stringify(json)}`);
  }
  assert(json);
  console.log(`  OK ${label}`);
}

async function main() {
  if (!base) {
    console.log("[verify:production-smoke] SKIP — set BLOCKSMITH_URL");
    process.exit(0);
  }

  console.log("[verify:production-smoke]", base);

  await check("/", "home page");
  await check("/wiki", "wiki");
  await checkJson("/api/supabase/health", "supabase health", (j) => {
    const o = j as { storage?: { ok?: boolean } };
    if (!o.storage?.ok) throw new Error("storage not ok");
  });

  console.log("[verify:production-smoke] OK — run manual: Connect GitHub → scan → Sync → API key");
}

main().catch((err) => {
  console.error("[verify:production-smoke] FAIL", err);
  process.exit(1);
});

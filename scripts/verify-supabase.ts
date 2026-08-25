/**
 * Supabase storage smoke test.
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, bucket from setup.sql
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const { supabaseStorageEnabled } = await import("../src/lib/supabase/env");
  const { supabaseStorageHealth, supabaseUploadMarkdown, supabaseDownloadMarkdown } =
    await import("../src/lib/supabase/storage");

  if (!supabaseStorageEnabled()) {
    console.error(
      "FAILED: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    console.error("  Dashboard → Project Settings → API → service_role (secret)");
    process.exit(1);
  }

  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (svc.includes("publishable")) {
    console.error(
      "FAILED: SUPABASE_SERVICE_ROLE_KEY looks like the publishable key.",
    );
    console.error(
      "  Use service_role (secret) from Dashboard → API — NOT the publishable/anon key.",
    );
    process.exit(1);
  }

  const health = await supabaseStorageHealth();
  if (!health.ok) {
    console.error(`FAILED: ${health.message}`);
    console.error("  Run supabase/setup.sql in Supabase SQL Editor");
    process.exit(1);
  }

  const testName = `verify-supabase-${Date.now()}.md`;
  const body = `---\nblocksmith-source: verify\n---\n\n# Supabase verify\n`;
  await supabaseUploadMarkdown(testName, body);
  const roundtrip = await supabaseDownloadMarkdown(testName);

  if (!roundtrip.includes("Supabase verify")) {
    console.error("FAILED: roundtrip content mismatch");
    process.exit(1);
  }

  console.log("Supabase verification");
  console.log(`  URL:     ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`  Bucket:  ${health.bucket}`);
  console.log(`  Test:    uploads/${testName}`);
  console.log("\nOK — Supabase storage read/write works.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

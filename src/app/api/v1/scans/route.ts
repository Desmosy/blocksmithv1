import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/cloud/auth";
import { registerScanOwnership } from "@/lib/cloud/register-scan";
import { scanRateLimitForApiKey } from "@/lib/cloud/rate-limit";
import { runScanApi, type ScanApiBody } from "@/lib/cloud/scan-api";
import type { Actor } from "@/lib/cloud/types";

export const dynamic = "force-dynamic";

/**
 * Pattern 2/4 — unified scan backend.
 *
 * - fixture: vendor — demo on server
 * - github — shallow clone on server
 * - clientScan — markdown from CLI local scan
 * - workspace — server-local path (fixtures only in production)
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  const limited = await scanRateLimitForApiKey(auth.key.id);
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Scan rate limit exceeded for this API key. Try again in ${limited.retryAfterSec}s.`,
      },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as ScanApiBody;
    const origin =
      request.headers.get("origin") ??
      (request.headers.get("x-forwarded-host")?.trim()
        ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("x-forwarded-host")}`
        : new URL(request.url).origin);

    const result = await runScanApi(body, origin);

    const actor: Actor = {
      kind: "apiKey",
      userId: auth.key.userId,
      keyId: auth.key.id,
      prefix: auth.key.prefix,
      label: auth.key.label,
      isAdmin: auth.key.isAdmin,
    };
    await registerScanOwnership(
      result,
      actor,
      result.scanMode,
      body.github?.trim(),
    );

    return NextResponse.json({ ...result, key: auth.key.prefix });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

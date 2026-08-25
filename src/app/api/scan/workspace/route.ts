import { NextRequest, NextResponse } from "next/server";
import {
  assertRepoAccessible,
  getGithubSession,
  isRepoSlug,
} from "@/lib/auth/github";
import { authenticateApiKey } from "@/lib/cloud/api-keys";
import { bearerFromRequest } from "@/lib/cloud/auth";
import {
  scanRateLimitForRequest,
  scanRateLimitForUser,
} from "@/lib/cloud/rate-limit";
import { resolveActor } from "@/lib/cloud/actor";
import { registerScanOwnership } from "@/lib/cloud/register-scan";
import { parseScanRequest, runScanService } from "@/lib/scan/service";

export const dynamic = "force-dynamic";
/** GitHub tarball + scan can exceed default 10s on Vercel */
export const maxDuration = 60;

/**
 * Public home-page scan route.
 * - fixture:vendor — demo, no auth
 * - github — requires GitHub OAuth + repo access verification
 * - workspace paths — rejected (use CLI client scan instead)
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      workspace?: string;
      fixture?: string;
      github?: string;
    };

    const apiKeyAuth = await authenticateApiKey(bearerFromRequest(request));
    const hasApiKey = !!apiKeyAuth;
    const githubSlug = body.github?.trim();
    const isGithubScan = !!githubSlug;
    const isFixtureOnly =
      body.workspace?.trim() === "fixture:vendor" || body.fixture === "vendor";

    if (body.workspace?.trim() && body.workspace.trim() !== "fixture:vendor") {
      return NextResponse.json(
        {
          error:
            "Server cannot scan local paths from the browser. Connect GitHub and pick a repository, use Try demo, or run `blocksmith scan /path` from your machine.",
        },
        { status: 403 },
      );
    }

    let githubSession: Awaited<ReturnType<typeof getGithubSession>> = null;

    if (isGithubScan) {
      if (!isRepoSlug(githubSlug!)) {
        return NextResponse.json(
          {
            error:
              "Paste arbitrary repo URLs is disabled. Connect GitHub and select a repository you have access to.",
          },
          { status: 403 },
        );
      }

      if (!hasApiKey) {
        githubSession = await getGithubSession();
        if (!githubSession) {
          return NextResponse.json(
            {
              error:
                "Connect GitHub to scan a repository. Public repo URLs are not accepted.",
            },
            { status: 401 },
          );
        }

        const userLimited = await scanRateLimitForUser(githubSession.userId);
        if (!userLimited.ok) {
          return NextResponse.json(
            {
              error: `Scan limit reached for your account. Try again in ${userLimited.retryAfterSec}s.`,
            },
            { status: 429, headers: { "Retry-After": String(userLimited.retryAfterSec) } },
          );
        }

        const ipLimited = await scanRateLimitForRequest(request);
        if (!ipLimited.ok) {
          return NextResponse.json(
            {
              error: `Scan rate limit exceeded. Try again in ${ipLimited.retryAfterSec}s.`,
            },
            { status: 429, headers: { "Retry-After": String(ipLimited.retryAfterSec) } },
          );
        }

        await assertRepoAccessible(githubSession.providerToken, githubSlug!);
      } else {
        const limited = await scanRateLimitForRequest(request);
        if (!limited.ok) {
          return NextResponse.json(
            {
              error: `Scan rate limit exceeded. Try again in ${limited.retryAfterSec}s.`,
            },
            { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
          );
        }
      }
    }

    const origin = new URL(request.url).origin;

    const fixture =
      body.workspace?.trim() === "fixture:vendor" ? "vendor" : body.fixture;
    const requestParsed = parseScanRequest({
      workspace: isFixtureOnly ? undefined : body.workspace,
      fixture,
      github: githubSlug,
    });

    const result = await runScanService(
      requestParsed.mode === "github" && githubSession
        ? { ...requestParsed, token: githubSession.providerToken }
        : requestParsed,
      origin,
    );

    const actor =
      hasApiKey && apiKeyAuth
        ? {
            kind: "apiKey" as const,
            userId: apiKeyAuth.userId,
            keyId: apiKeyAuth.id,
            prefix: apiKeyAuth.prefix,
            label: apiKeyAuth.label,
            isAdmin: apiKeyAuth.isAdmin,
          }
        : githubSession
          ? {
              kind: "user" as const,
              userId: githubSession.userId,
              login: githubSession.login,
            }
          : await resolveActor(request);

    const githubRepo =
      requestParsed.mode === "github" && githubSlug ? githubSlug : undefined;
    try {
      await registerScanOwnership(
        result,
        actor,
        result.scanMode,
        githubRepo,
      );
    } catch (ownErr) {
      console.warn("[api/scan/workspace] ownership registration failed", ownErr);
    }

    return NextResponse.json({
      success: true,
      docRef: result.docRef,
      fileName: result.fileName,
      wikiUrl: result.wikiUrl,
      workspaceRoot: result.workspaceRoot,
      projectName: result.projectName,
      reactFiles: result.reactFiles,
      featured: result.components,
      scanMode: result.scanMode,
      githubUrl: result.githubUrl,
      scanMs: result.scanMs,
      cloneMs: result.cloneMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "scan failed";
    console.error("[api/scan/workspace]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

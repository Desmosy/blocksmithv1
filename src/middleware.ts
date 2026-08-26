import { NextResponse, type NextRequest } from "next/server";

/**
 * One front door (S7 of SECURITY-RELEASE-GATE.md).
 *
 * This is a coarse, defense-in-depth session gate — it removes the
 * "someone forgot to call requireDocumentAccess on a new route" class of bug.
 * Fine-grained ownership / org-role checks still live in the route handlers and
 * in canAccessDocument (default-deny). Middleware only asks "is there any
 * credential at all?" so it never needs the database on the edge.
 *
 * It intentionally does NOT block public reads (the named demo + bundled
 * samples), which the read handlers already authorize via isPublicContent.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Doc params that are public content and must render without a session.
// Kept in sync with isPublicContent() in src/lib/cloud/saas.ts.
const PUBLIC_DOC_PARAMS = new Set([
  "apollo.md",
  "docs.md",
  "portfolio.md",
  "saas.md",
  "scan-acme-ui-kit.md",
  "upload:scan-acme-ui-kit.md",
]);

/** Mirror of saasStrictMode() — cannot import server-only code into middleware. */
function strictMode(): boolean {
  if (process.env.BLOCKSMITH_SAAS_STRICT === "0") return false;
  if (process.env.BLOCKSMITH_SAAS_STRICT === "1") return true;
  return process.env.NODE_ENV === "production";
}

function hasCredential(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) return true;
  // Supabase SSR auth cookies: sb-<project-ref>-auth-token(.<n>)
  return request.cookies
    .getAll()
    .some((c) => /^sb-.*-auth-token/.test(c.name) && c.value);
}

function unauthorizedJson(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized — sign in or provide Authorization: Bearer bs_live_…" },
    { status: 401 },
  );
}

function securedNext(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co https://*.upstash.io https://*.sentry.io https://api.github.com https://api.figma.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export function middleware(request: NextRequest): NextResponse {
  if (!strictMode()) return securedNext(request);

  const { pathname, search, searchParams } = request.nextUrl;
  const credentialed = hasCredential(request);

  // API surface: every /api/v1/* call and every mutating /api/wiki/* call needs
  // a credential. Public GET reads pass through to handlers that authorize them.
  const isV1 = pathname.startsWith("/api/v1/");
  const isWikiApi = pathname.startsWith("/api/wiki/");
  if (isV1 || isWikiApi) {
    const needsCredential =
      isV1 || MUTATING_METHODS.has(request.method) || pathname === "/api/wiki/import";
    if (needsCredential && !credentialed) {
      return unauthorizedJson();
    }
    return securedNext(request);
  }

  // Wiki pages: send logged-out visitors of a private doc to sign-in instead of
  // a bare 404. Public demo + bundled samples still render anonymously.
  if (pathname === "/wiki" || pathname.startsWith("/wiki/")) {
    if (credentialed) return securedNext(request);
    const doc = searchParams.get("doc");
    // `?site=` links come from a published org site — let them through; the
    // wiki handler still authorizes via canAccessDocument (published flag), so
    // forging this param grants no access to unpublished docs.
    const fromPublicSite = searchParams.has("site");
    // A system captured from a public website is public content: it holds
    // nothing but values already served by that site. Gating it would put a
    // sign-in wall in the middle of the one flow a visitor comes here to try.
    const isCapture = /^upload:capture-[a-z0-9-]+\.md$/i.test(doc ?? "");
    const isPublic =
      fromPublicSite || !doc || isCapture || PUBLIC_DOC_PARAMS.has(doc);
    if (!isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = `?auth=required&next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  return securedNext(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

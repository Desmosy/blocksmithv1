import { NextResponse } from "next/server";

/**
 * The routes the "any site" script calls from other origins.
 *
 * A bookmarklet on cohere.com posting to /api/capture is a cross-origin
 * request, so the browser asks first. These routes hold nothing private —
 * capture reads public pages, invoke runs read-only tools — so any origin may
 * call them. Credentials are never involved: the header is `*`, which the
 * browser refuses to combine with cookies.
 */
export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

export function withCors<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

/** The preflight answer. */
export function corsPreflight(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}

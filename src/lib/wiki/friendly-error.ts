/**
 * friendly-error — turn an HTTP status + raw API message into customer copy.
 *
 * The Pipeline and release surfaces face non-technical operators. A raw 500 or
 * "Unauthorized" string is a dead end; this maps the common failure modes to a
 * next action ("Sign in", "Pin the lock first") instead of a stack-trace vibe.
 */
export function friendlyError(
  status: number,
  rawMessage?: string | null,
): string {
  const msg = rawMessage?.trim() || "";

  if (status === 401) {
    return "Sign in with GitHub to do this — your session expired. Refresh and sign in again.";
  }
  if (status === 403) {
    // Access layer already returns a human role message; pass it through.
    return msg || "You don't have write access to this workspace.";
  }
  if (status === 404) {
    return "This document isn't on the server yet — re-scan the repo from the home page first.";
  }
  if (status === 409 || /\bpin(ned)?\b|\block\b/i.test(msg)) {
    return msg || "Pin the lock first, then promote.";
  }
  if (status === 429) {
    return "Too many requests — wait a moment and try again.";
  }
  if (status >= 500) {
    return "Something broke on the server. Give it a moment and retry — if it keeps failing, re-scan the repo.";
  }
  return msg || "Something went wrong. Try again.";
}

/** Read a fetch Response into { ok, message } with friendly copy on failure. */
export async function readFriendly(
  res: Response,
): Promise<{ ok: boolean; body: unknown; message: string | null }> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (res.ok) return { ok: true, body, message: null };
  const raw =
    body && typeof body === "object" && "error" in body
      ? String((body as { error?: unknown }).error ?? "")
      : "";
  return { ok: false, body, message: friendlyError(res.status, raw) };
}

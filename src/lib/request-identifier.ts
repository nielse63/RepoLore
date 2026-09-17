import { headers } from "next/headers";

const UNKNOWN_IDENTIFIER = "unknown";

/**
 * Best-effort caller identifier for rate-limiting a Server Action, read from
 * `X-Forwarded-For` — set by Render's proxy in front of this app
 * (render.yaml) to the address it received the connection from. Only used to
 * key a rate-limit cooldown (src/analysis/submission-rate-limit.ts), never
 * for anything security-sensitive like access control: a caller can send
 * its own `X-Forwarded-For`, and this reads the first (leftmost) entry
 * without verifying how many trusted hops actually prepended one, so it's
 * not a hardened identity — just enough to slow a scripted single-source
 * burst of repository submissions, which is this limiter's actual goal.
 * Falls back to one shared bucket when the header is absent (e.g. a direct,
 * unproxied local connection), which still rate-limits that traffic — just
 * as a single caller rather than by individual address.
 */
export async function requestIdentifier(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (!forwardedFor) return UNKNOWN_IDENTIFIER;

  const first = forwardedFor.split(",")[0]?.trim();
  return first || UNKNOWN_IDENTIFIER;
}

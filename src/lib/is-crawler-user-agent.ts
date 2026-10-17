import { userAgentFromString } from "next/server";

/**
 * Generic self-identifying crawler tokens Next's own `isBot` list doesn't
 * name (e.g. AhrefsBot, SemrushBot, ClaudeBot, PerplexityBot).
 */
const GENERIC_CRAWLER_PATTERN = /bot\b|crawler|spider|crawling/i;

/**
 * Whether a request's `User-Agent` looks like a crawler rather than a
 * person, so a crawler's page view doesn't count as the "actual page view"
 * that pull-triggers a background re-analysis (ADR-0013, amended by ADR-0017). A missing
 * `User-Agent` is treated as a crawler too: real browsers always send one.
 * Best-effort — a crawler that disguises itself as a browser still
 * triggers one rate-limited attempt, exactly as a human visit would.
 */
export function isCrawlerUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return (
    userAgentFromString(userAgent).isBot ||
    GENERIC_CRAWLER_PATTERN.test(userAgent)
  );
}

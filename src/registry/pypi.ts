/**
 * Fetches a package's short summary and keywords from the public PyPI JSON
 * API — no authentication required (ADR-0011). `info.summary` (a one-line
 * summary) is used rather than `info.description` (often a full README/rst
 * dump). PyPI reports keywords as a single free-form string (commonly
 * comma- or whitespace-delimited, at the publisher's discretion), split into
 * a list here for consistency with the npm registry's array form. Failure of
 * any kind (network error, timeout, non-2xx, missing field) resolves to
 * `undefined` fields rather than throwing: missing metadata is never fatal
 * to analysis.
 */

const REGISTRY_BASE = "https://pypi.org/pypi";
const DEFAULT_TIMEOUT_MS = 5000;

interface PypiProjectResponse {
  info?: { summary?: unknown; keywords?: unknown };
}

export interface PypiPackageMetadata {
  description?: string;
  keywords?: string[];
}

function splitKeywords(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const keywords = raw
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  return keywords.length > 0 ? keywords : undefined;
}

export async function fetchPypiPackageMetadata(
  name: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PypiPackageMetadata | undefined> {
  try {
    const res = await fetch(
      `${REGISTRY_BASE}/${encodeURIComponent(name)}/json`,
      {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json" },
      }
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as PypiProjectResponse;
    const summary = body.info?.summary;
    const description =
      typeof summary === "string" && summary.trim() ? summary : undefined;
    const keywords = splitKeywords(body.info?.keywords);
    if (description === undefined && !keywords) return undefined;
    return { description, keywords };
  } catch {
    return undefined;
  }
}

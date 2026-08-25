/**
 * Fetches a package's short description and keywords from the public npm
 * registry — no authentication required (ADR-0011). Failure of any kind
 * (network error, timeout, non-2xx, missing field) resolves to `undefined`
 * fields rather than throwing: missing metadata is never fatal to analysis.
 */

const REGISTRY_BASE = "https://registry.npmjs.org";
const DEFAULT_TIMEOUT_MS = 5000;

interface NpmPackument {
  description?: unknown;
  keywords?: unknown;
}

export interface NpmPackageMetadata {
  description?: string;
  keywords?: string[];
}

export async function fetchNpmPackageMetadata(
  name: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<NpmPackageMetadata | undefined> {
  try {
    const res = await fetch(`${REGISTRY_BASE}/${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as NpmPackument;
    const description =
      typeof body.description === "string" ? body.description : undefined;
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((k): k is string => typeof k === "string")
      : undefined;
    if (description === undefined && (!keywords || keywords.length === 0)) {
      return undefined;
    }
    return { description, keywords };
  } catch {
    return undefined;
  }
}

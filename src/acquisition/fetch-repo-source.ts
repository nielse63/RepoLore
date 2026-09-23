/**
 * Orchestrates the full source-acquisition path (ADR-0002, MVP core user
 * journey steps 3–5): resolve the default branch + HEAD SHA, fetch the
 * tarball at that SHA, and safely extract it into a temp directory. This is
 * the single entry point the analyzer should call for a real GitHub
 * repository — everything downstream (`extractJsTsProject`, etc.) then
 * operates on the returned directory exactly as it already does for local
 * fixtures.
 */

import { fetchRepositoryTarball, resolveRepositoryHead } from "@/github/client";
import { AcquisitionError } from "./errors";
import {
  acquireTarballSource,
  DEFAULT_EXTRACTION_LIMITS,
  type ExtractionLimits,
  type SkippedEntry,
} from "./extract-tarball";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface AcquiredRepository {
  /** The extracted source directory, ready for a language analyzer. */
  dir: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  headSha: string;
  fileCount: number;
  /** Tarball entries skipped because they weren't a regular file or directory (e.g. symlinks). */
  skippedEntries: SkippedEntry[];
  /** Removes the temp work directory. Callers must always invoke this. */
  cleanup: () => Promise<void>;
}

export interface AcquireRepositorySourceOptions {
  limits?: ExtractionLimits;
  /** Wall-clock budget for the tarball download (ADR-0002). */
  timeoutMs?: number;
}

/**
 * The wall-clock limit covers the download, which is network-bound and
 * attacker-paceable (e.g. a deliberately slow-drip response). Extraction
 * itself operates on an already-downloaded, size-capped local file and is
 * additionally bounded by the file-count/extracted-size limits enforced
 * per-entry as they're read, so it isn't separately wrapped in the same
 * timeout — node-tar's synchronous extraction doesn't support cooperative
 * cancellation via `AbortSignal`.
 */
export async function acquireRepositorySource(
  owner: string,
  repo: string,
  options: AcquireRepositorySourceOptions = {}
): Promise<AcquiredRepository> {
  const { limits = DEFAULT_EXTRACTION_LIMITS, timeoutMs = DEFAULT_TIMEOUT_MS } =
    options;

  const { defaultBranch, headSha } = await resolveRepositoryHead(owner, repo);

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(
      new AcquisitionError(
        "timeout",
        `Fetching ${owner}/${repo}@${headSha} took longer than ${timeoutMs}ms.`
      )
    );
  }, timeoutMs);

  try {
    const tarballRes = await fetchRepositoryTarball(
      owner,
      repo,
      headSha,
      controller.signal
    );
    if (!tarballRes.body) {
      throw new AcquisitionError(
        "github-error",
        `GitHub returned an empty tarball body for ${owner}/${repo}@${headSha}.`
      );
    }

    const { dir, fileCount, skippedEntries, cleanup } =
      await acquireTarballSource(tarballRes.body, limits, controller.signal);

    return {
      dir,
      owner,
      repo,
      defaultBranch,
      headSha,
      fileCount,
      skippedEntries,
      cleanup,
    };
  } catch (error) {
    if (
      controller.signal.aborted &&
      controller.signal.reason instanceof AcquisitionError
    ) {
      throw controller.signal.reason;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

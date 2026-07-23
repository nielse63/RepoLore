/**
 * Downloads a GitHub repository tarball and extracts it into a fresh temp
 * directory, enforcing the extraction safety limits ADR-0002 treats as part
 * of the acquisition decision itself, not later hardening: a hard cap on
 * compressed download size, a hard cap on total extracted (uncompressed)
 * size, a hard cap on file count, and path sanitization that rejects any
 * entry resolving outside the target directory. Repository content is
 * untrusted third-party input, so every limit fails the whole acquisition
 * loudly rather than silently truncating — a partial extraction would mean
 * a partial, misleading analysis.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar';
import { AcquisitionError } from './errors';

export interface ExtractionLimits {
  /** Hard cap on the gzip-compressed tarball download, in bytes. */
  maxCompressedBytes: number;
  /** Hard cap on total extracted (uncompressed) size on disk, in bytes. */
  maxExtractedBytes: number;
  /** Hard cap on the number of files extracted. */
  maxFileCount: number;
}

/**
 * Conservative defaults for a solo-maintainer MVP analyzing conventional
 * TypeScript/JavaScript/Python application and library repositories (see
 * docs/product/non-goals.md — deep enterprise monorepos are explicitly out
 * of scope). Tunable without a redesign: this is a reversible decision, not
 * a load-bearing architectural one.
 */
export const DEFAULT_EXTRACTION_LIMITS: ExtractionLimits = {
  maxCompressedBytes: 50 * 1024 * 1024,
  maxExtractedBytes: 300 * 1024 * 1024,
  maxFileCount: 20_000,
};

const ALLOWED_ENTRY_TYPES = new Set(['File', 'Directory']);

function byteLimiter(maxBytes: number, buildError: () => Error): Transform {
  let total = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.length;
      if (total > maxBytes) {
        callback(buildError());
        return;
      }
      callback(null, chunk);
    },
  });
}

/**
 * Streams the tarball response body to a local temp file, aborting as soon
 * as the compressed-size cap is exceeded (GitHub doesn't reliably send a
 * usable Content-Length up front, so the cap is enforced against bytes
 * actually received rather than checked once after the fact).
 */
async function downloadTarball(
  body: ReadableStream<Uint8Array>,
  destPath: string,
  maxBytes: number,
  signal?: AbortSignal
): Promise<void> {
  const source = Readable.fromWeb(
    body as Parameters<typeof Readable.fromWeb>[0]
  );
  const limiter = byteLimiter(
    maxBytes,
    () =>
      new AcquisitionError(
        'tarball-too-large',
        `Tarball download exceeded the ${maxBytes}-byte limit.`
      )
  );
  const dest = fs.createWriteStream(destPath);

  try {
    await pipeline(source, limiter, dest, { signal });
  } catch (error) {
    await fsp.rm(destPath, { force: true });
    if (
      error instanceof Error &&
      error.name === 'AbortError' &&
      signal?.reason instanceof Error
    ) {
      throw signal.reason;
    }
    throw error;
  }
}

interface ExtractionOutcome {
  fileCount: number;
}

/**
 * Extracts the downloaded tarball into `destDir`. `node-tar`'s `filter`
 * isn't documented as safe to throw from mid-stream, so a violation is
 * recorded and every remaining entry is skipped (no further disk I/O)
 * rather than raised immediately; the caller checks the recorded violation
 * once extraction finishes and fails the whole acquisition. `strip: 1`
 * drops the single top-level `{owner}-{repo}-{sha}/` directory GitHub
 * wraps every tarball entry in.
 */
async function extractSafely(
  tarballPath: string,
  destDir: string,
  limits: ExtractionLimits
): Promise<ExtractionOutcome> {
  let fileCount = 0;
  let extractedBytes = 0;
  let violation: AcquisitionError | undefined;

  await tar.x({
    file: tarballPath,
    cwd: destDir,
    strip: 1,
    // `tar.x`'s filter always passes a ReadEntry (the `fs.Stats` half of
    // this option's shared type is only relevant to `tar.c`/create).
    filter: (entryPath, rawEntry) => {
      if (violation) return false;
      const entry = rawEntry as unknown as { type?: string; size?: number };

      if (!ALLOWED_ENTRY_TYPES.has(entry.type ?? '')) {
        violation = new AcquisitionError(
          'unsafe-entry',
          `Tarball entry "${entryPath}" has an unsupported type (${entry.type}); only regular files and directories are allowed.`
        );
        return false;
      }

      const resolved = path.resolve(destDir, entryPath);
      if (resolved !== destDir && !resolved.startsWith(destDir + path.sep)) {
        violation = new AcquisitionError(
          'unsafe-entry',
          `Tarball entry "${entryPath}" resolves outside the extraction directory.`
        );
        return false;
      }

      if (entry.type === 'File') {
        fileCount += 1;
        extractedBytes += entry.size ?? 0;
        if (fileCount > limits.maxFileCount) {
          violation = new AcquisitionError(
            'too-many-files',
            `Repository has more than ${limits.maxFileCount} files.`
          );
          return false;
        }
        if (extractedBytes > limits.maxExtractedBytes) {
          violation = new AcquisitionError(
            'extracted-too-large',
            `Repository's extracted size exceeds ${limits.maxExtractedBytes} bytes.`
          );
          return false;
        }
      }

      return true;
    },
  });

  if (violation) throw violation;
  return { fileCount };
}

export interface AcquiredSource {
  /** The extracted source directory (repo root, `strip: 1` already applied). */
  dir: string;
  fileCount: number;
  /** Removes the entire temp work directory, including any partial state. */
  cleanup: () => Promise<void>;
}

/**
 * Downloads and safely extracts a repository tarball response body into a
 * fresh temp directory. Always returns a `cleanup()` the caller must invoke
 * once done with the directory; also invoked internally on any failure so a
 * rejected/adversarial repository never leaks disk.
 */
export async function acquireTarballSource(
  tarballBody: ReadableStream<Uint8Array>,
  limits: ExtractionLimits = DEFAULT_EXTRACTION_LIMITS,
  signal?: AbortSignal
): Promise<AcquiredSource> {
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'repolore-'));
  const destDir = path.join(workDir, 'source');
  const tarballPath = path.join(workDir, 'repo.tar.gz');
  const cleanup = () => fsp.rm(workDir, { recursive: true, force: true });

  try {
    await fsp.mkdir(destDir, { recursive: true });
    await downloadTarball(
      tarballBody,
      tarballPath,
      limits.maxCompressedBytes,
      signal
    );
    const { fileCount } = await extractSafely(tarballPath, destDir, limits);
    await fsp.rm(tarballPath, { force: true });
    return { dir: destDir, fileCount, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

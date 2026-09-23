import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import * as tar from "tar";
import {
  acquireTarballSource,
  DEFAULT_EXTRACTION_LIMITS,
} from "../extract-tarball";

/**
 * Builds a real gzip tarball (mirroring GitHub's layout: a single top-level
 * `{owner}-{repo}-{sha}/` wrapper directory) and returns it as the
 * `ReadableStream<Uint8Array>` shape `acquireTarballSource` expects.
 */
async function buildTarballStream(
  files: Record<string, string>,
  topLevelDir = "owner-repo-abc123"
): Promise<ReadableStream<Uint8Array>> {
  const srcDir = await fsp.mkdtemp(path.join(os.tmpdir(), "repolore-fixture-"));
  const wrapped = path.join(srcDir, topLevelDir);
  await fsp.mkdir(wrapped, { recursive: true });

  for (const [relPath, content] of Object.entries(files)) {
    const dest = path.join(wrapped, relPath);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, content);
  }

  const nodeStream = tar.create({ gzip: true, cwd: srcDir }, [topLevelDir]);
  const chunks: Buffer[] = [];
  for await (const chunk of nodeStream) {
    chunks.push(chunk as Buffer);
  }
  await fsp.rm(srcDir, { recursive: true, force: true });

  const buffer = Buffer.concat(chunks);
  return Readable.toWeb(Readable.from(buffer)) as ReadableStream<Uint8Array>;
}

describe("acquireTarballSource", () => {
  it("extracts files and strips the single top-level directory", async () => {
    const stream = await buildTarballStream({
      "file.txt": "hello",
      "nested/other.txt": "world",
    });

    const result = await acquireTarballSource(stream);
    try {
      expect(result.fileCount).toBe(2);
      const contents = await fsp.readFile(
        path.join(result.dir, "file.txt"),
        "utf8"
      );
      expect(contents).toBe("hello");
      const nested = await fsp.readFile(
        path.join(result.dir, "nested/other.txt"),
        "utf8"
      );
      expect(nested).toBe("world");
    } finally {
      await result.cleanup();
    }

    expect(fs.existsSync(result.dir)).toBe(false);
  });

  it("throws tarball-too-large when the compressed download exceeds the limit", async () => {
    const stream = await buildTarballStream({ "file.txt": "x".repeat(1000) });

    await expect(
      acquireTarballSource(stream, {
        ...DEFAULT_EXTRACTION_LIMITS,
        maxCompressedBytes: 10,
      })
    ).rejects.toMatchObject({ code: "tarball-too-large" });
  });

  it("throws too-many-files when the file count exceeds the limit", async () => {
    const stream = await buildTarballStream({ "a.txt": "a", "b.txt": "b" });

    await expect(
      acquireTarballSource(stream, {
        ...DEFAULT_EXTRACTION_LIMITS,
        maxFileCount: 1,
      })
    ).rejects.toMatchObject({ code: "too-many-files" });
  });

  it("throws extracted-too-large when the uncompressed size exceeds the limit", async () => {
    const stream = await buildTarballStream({ "file.txt": "x".repeat(1000) });

    await expect(
      acquireTarballSource(stream, {
        ...DEFAULT_EXTRACTION_LIMITS,
        maxExtractedBytes: 10,
      })
    ).rejects.toMatchObject({ code: "extracted-too-large" });
  });

  it("skips a symlink entry (unsupported type) rather than failing the whole extraction", async () => {
    const srcDir = await fsp.mkdtemp(
      path.join(os.tmpdir(), "repolore-fixture-")
    );
    const topLevelDir = "owner-repo-abc123";
    const wrapped = path.join(srcDir, topLevelDir);
    await fsp.mkdir(wrapped, { recursive: true });
    await fsp.writeFile(path.join(wrapped, "real.txt"), "hi");
    await fsp.symlink("real.txt", path.join(wrapped, "link.txt"));

    const nodeStream = tar.create({ gzip: true, cwd: srcDir, follow: false }, [
      topLevelDir,
    ]);
    const chunks: Buffer[] = [];
    for await (const chunk of nodeStream) {
      chunks.push(chunk as Buffer);
    }
    await fsp.rm(srcDir, { recursive: true, force: true });
    const stream = Readable.toWeb(
      Readable.from(Buffer.concat(chunks))
    ) as ReadableStream<Uint8Array>;

    const result = await acquireTarballSource(stream);
    try {
      expect(result.fileCount).toBe(1);
      expect(result.skippedEntries).toEqual([
        { path: "owner-repo-abc123/link.txt", type: "SymbolicLink" },
      ]);
      expect(fs.existsSync(path.join(result.dir, "real.txt"))).toBe(true);
      expect(fs.existsSync(path.join(result.dir, "link.txt"))).toBe(false);
    } finally {
      await result.cleanup();
    }
  });

  it("throws unsafe-entry when an entry resolves outside the extraction directory", async () => {
    const stream = await buildTarballStream({ "file.txt": "hello" });

    const xSpy = jest
      .spyOn(tar, "x")
      .mockImplementation(async (opts: unknown) => {
        const { filter } = opts as {
          filter: (p: string, entry: { type: string; size: number }) => boolean;
        };
        filter("../../evil.txt", { type: "File", size: 3 });
      });

    try {
      await expect(acquireTarballSource(stream)).rejects.toMatchObject({
        code: "unsafe-entry",
      });
    } finally {
      xSpy.mockRestore();
    }
  });

  it("removes the entire work directory (including the raw tarball) on failure", async () => {
    const stream = await buildTarballStream({ "a.txt": "a", "b.txt": "b" });

    let capturedDestDir: string | undefined;
    const xSpy = jest.spyOn(tar, "x");
    xSpy.mockImplementationOnce(async (opts: unknown) => {
      capturedDestDir = (opts as { cwd: string }).cwd;
      throw new Error("extraction blew up");
    });

    await expect(
      acquireTarballSource(stream, {
        ...DEFAULT_EXTRACTION_LIMITS,
        maxFileCount: 1,
      })
    ).rejects.toThrow("extraction blew up");

    xSpy.mockRestore();

    expect(capturedDestDir).toBeDefined();
    const workDir = path.dirname(capturedDestDir as string);
    expect(fs.existsSync(workDir)).toBe(false);
  });
});

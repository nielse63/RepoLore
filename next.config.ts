import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `web-tree-sitter`/`tree-sitter-python` (ADR-0006) load a wasm binary at
   * runtime via filesystem paths resolved with `require.resolve`. Left to
   * Turbopack's default bundling, those `require.resolve` calls get
   * rewritten into Turbopack's own internal module representation (a
   * numeric id at build time, a virtual `[project]/...` path in dev)
   * instead of a real, readable absolute path — found wiring the Python
   * fixture pages into `/fixtures/[name]` in implementation session 13.
   * Marking both packages external keeps them as plain `require()`s
   * resolved by real Node module resolution at runtime.
   */
  serverExternalPackages: ["web-tree-sitter", "tree-sitter-python"],
};

export default nextConfig;

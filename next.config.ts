import type { NextConfig } from "next";
import { latestGitTag } from "./src/lib/app-version";

/**
 * Baseline security headers, applied to every route. The CSP is
 * deliberately permissive rather than nonce-based (`'unsafe-inline'` for
 * scripts/styles) since the app has no middleware today to thread a
 * per-request nonce through Next's own injected hydration/RSC scripts —
 * everything served is same-origin (fonts are self-hosted via `next/font`)
 * except Google Analytics (`gtag.js`), explicitly allowlisted below, so
 * this still closes off cross-origin script/asset injection to anything
 * else while leaving room to tighten to a nonce-based policy later.
 * `frame-ancestors 'none'` (plus the legacy
 * `X-Frame-Options` for older browsers) blocks this app from being framed
 * anywhere, since every mutating action here (analyze, re-analyze, refresh
 * history) is a plain POST form with no confirmation step of its own.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // `unsafe-eval` is added only outside production: React's development
      // mode uses eval() for debugging features (reconstructing
      // cross-environment call stacks, etc.) that it never uses in a
      // production build, so a production-strength policy here would break
      // `next dev` without reflecting anything a real deployment (which
      // always runs `next build`/`next start`) hits.
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  /**
   * The latest git tag (e.g. `v0.0.1`), inlined at build time for the site
   * footer. Empty when the build's clone has no tags, which hides it.
   */
  env: { APP_VERSION: latestGitTag() ?? "" },

  /**
   * `web-tree-sitter`/`tree-sitter-python` (ADR-0006) load a wasm binary at
   * runtime via filesystem paths resolved with `require.resolve`. Left to
   * Turbopack's default bundling, those `require.resolve` calls get
   * rewritten into Turbopack's own internal module representation (a
   * numeric id at build time, a virtual `[project]/...` path in dev)
   * instead of a real, readable absolute path — found wiring the Python
   * analyzer into a real page route in implementation session 13.
   * Marking both packages external keeps them as plain `require()`s
   * resolved by real Node module resolution at runtime.
   */
  serverExternalPackages: ["web-tree-sitter", "tree-sitter-python"],

  /**
   * The e2e suite runs against a production build (`.bin/serve-prod`), and
   * its V8 coverage report (`npm run test:e2e:coverage`) can only map
   * chunks back to `src/` through browser source maps — so emit them for
   * that build only, never for a deployed one.
   */
  productionBrowserSourceMaps: process.env.E2E_COVERAGE === "true",

  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;

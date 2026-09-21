import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readJsTsProjectConfig } from "../project-config";

async function makeRootDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), "repolore-js-ts-config-"));
}

describe("readJsTsProjectConfig", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await makeRootDir();
  });

  afterEach(async () => {
    await fsp.rm(rootDir, { recursive: true, force: true });
  });

  it("returns no aliases and no gaps when no config file is present", async () => {
    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([]);
    expect(config.gaps).toEqual([]);
  });

  it("reads a wildcard alias from tsconfig.json paths", async () => {
    await fsp.writeFile(
      path.join(rootDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } },
      })
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      {
        pattern: "@/",
        target: "src",
        matchType: "prefix",
        source: {
          filePath: "tsconfig.json",
          configKey: "compilerOptions.paths",
        },
      },
    ]);
    expect(config.gaps).toEqual([]);
  });

  it("follows a tsconfig.json extends chain", async () => {
    await fsp.writeFile(
      path.join(rootDir, "tsconfig.base.json"),
      JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } },
      })
    );
    await fsp.writeFile(
      path.join(rootDir, "tsconfig.json"),
      JSON.stringify({ extends: "./tsconfig.base.json" })
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({ pattern: "@/", target: "src" }),
    ]);
  });

  it("prefers tsconfig.json over jsconfig.json when both are present", async () => {
    await fsp.writeFile(
      path.join(rootDir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["from-ts/*"] } } })
    );
    await fsp.writeFile(
      path.join(rootDir, "jsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["from-js/*"] } } })
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({ target: "from-ts" }),
    ]);
  });

  it("reads jsconfig.json when tsconfig.json is absent", async () => {
    await fsp.writeFile(
      path.join(rootDir, "jsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["src/*"] } } })
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({
        target: "src",
        source: expect.objectContaining({ filePath: "jsconfig.json" }),
      }),
    ]);
  });

  it("reports a gap and no aliases for a malformed tsconfig.json", async () => {
    await fsp.writeFile(path.join(rootDir, "tsconfig.json"), "{not json");

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([]);
    expect(config.gaps.length).toBeGreaterThanOrEqual(1);
  });

  it("reads package.json's imports field as exact-match subpath aliases", async () => {
    await fsp.writeFile(
      path.join(rootDir, "package.json"),
      JSON.stringify({ imports: { "#utils/*": "./src/utils/*" } })
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      {
        pattern: "#utils/",
        target: "src/utils",
        matchType: "prefix",
        source: { filePath: "package.json", configKey: "imports" },
      },
    ]);
  });

  it("reads a vite.config.ts object-literal resolve.alias", async () => {
    await fsp.writeFile(
      path.join(rootDir, "vite.config.ts"),
      `
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
`
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({
        pattern: "@",
        target: "src",
        matchType: "prefix",
        source: expect.objectContaining({ filePath: "vite.config.ts" }),
      }),
    ]);
  });

  it("reads a webpack.config.js exact-match ($-suffixed) alias and an array-form vite alias", async () => {
    await fsp.writeFile(
      path.join(rootDir, "webpack.config.js"),
      `
module.exports = {
  resolve: {
    alias: {
      "@components$": "./src/components",
    },
  },
};
`
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({
        pattern: "@components",
        target: "src/components",
        matchType: "exact",
      }),
    ]);
  });

  it("reads a rollup.config.js @rollup/plugin-alias entries array", async () => {
    await fsp.writeFile(
      path.join(rootDir, "rollup.config.js"),
      `
import alias from "@rollup/plugin-alias";
import path from "node:path";

export default {
  plugins: [
    alias({
      entries: [{ find: "@", replacement: path.resolve(__dirname, "src") }],
    }),
  ],
};
`
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({ pattern: "@", target: "src" }),
    ]);
  });

  it("reads a nuxt.config.ts top-level alias", async () => {
    await fsp.writeFile(
      path.join(rootDir, "nuxt.config.ts"),
      `
export default defineNuxtConfig({
  alias: {
    "@": "./src",
  },
});
`
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({ pattern: "@", target: "src" }),
    ]);
  });

  it("reads a next.config.js webpack() function's config.resolve.alias mutation", async () => {
    await fsp.writeFile(
      path.join(rootDir, "next.config.js"),
      `
module.exports = {
  webpack(config) {
    config.resolve.alias = {
      "@": "./src",
    };
    return config;
  },
};
`
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({ pattern: "@", target: "src" }),
    ]);
  });

  it("reads a .babelrc's module-resolver alias option", async () => {
    await fsp.writeFile(
      path.join(rootDir, ".babelrc"),
      JSON.stringify({
        plugins: [["module-resolver", { alias: { "@": "./src" } }]],
      })
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({ pattern: "@", target: "src" }),
    ]);
  });

  it("reads a babel.config.js module-resolver alias option", async () => {
    await fsp.writeFile(
      path.join(rootDir, "babel.config.js"),
      `
module.exports = {
  plugins: [
    ["module-resolver", { alias: { "@": "./src" } }],
  ],
};
`
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({ pattern: "@", target: "src" }),
    ]);
  });

  it("reports a gap for a computed alias target it cannot statically resolve", async () => {
    await fsp.writeFile(
      path.join(rootDir, "vite.config.ts"),
      `
const base = process.env.SRC_DIR;

export default {
  resolve: {
    alias: {
      "@": base,
    },
  },
};
`
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([]);
    expect(config.gaps).toHaveLength(1);
    expect(config.gaps[0].certainty).toBe("unknown");
    expect(config.gaps[0].description).toContain("@");
  });

  it("gives a bundler config precedence over tsconfig.json for the same alias key", async () => {
    await fsp.writeFile(
      path.join(rootDir, "vite.config.ts"),
      `
export default {
  resolve: {
    alias: {
      "@": "./from-vite",
    },
  },
};
`
    );
    await fsp.writeFile(
      path.join(rootDir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@": ["from-ts"] } } })
    );

    const config = readJsTsProjectConfig(rootDir);

    expect(config.aliases).toEqual([
      expect.objectContaining({ pattern: "@", target: "from-vite" }),
    ]);
  });
});

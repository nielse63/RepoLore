import { Project } from "ts-morph";
import {
  buildModuleResolutionIndex,
  isRelativeSpecifier,
  looksLikeAssetImport,
  looksLikePathAlias,
  matchAlias,
} from "../module-resolution";
import type { PathAlias } from "../project-config";

function makeProject() {
  return new Project({ useInMemoryFileSystem: true });
}

function makeAlias(overrides: Partial<PathAlias> = {}): PathAlias {
  return {
    pattern: "@/",
    target: "src/",
    matchType: "prefix",
    source: { filePath: "tsconfig.json", configKey: "compilerOptions.paths" },
    ...overrides,
  };
}

describe("buildModuleResolutionIndex", () => {
  it("resolves a specifier to an exact file path match", () => {
    const project = makeProject();
    const target = project.createSourceFile("/root/src/math.ts", "");
    project.createSourceFile("/root/src/index.ts", "");
    const index = buildModuleResolutionIndex(project.getSourceFiles(), "/root");

    expect(index.resolve("/root/src/index.ts", "./math.ts")).toBe(target);
  });

  it("resolves a specifier missing its extension", () => {
    const project = makeProject();
    const target = project.createSourceFile("/root/src/math.ts", "");
    project.createSourceFile("/root/src/index.ts", "");
    const index = buildModuleResolutionIndex(project.getSourceFiles(), "/root");

    expect(index.resolve("/root/src/index.ts", "./math")).toBe(target);
  });

  it("resolves a directory specifier to its index file", () => {
    const project = makeProject();
    const target = project.createSourceFile("/root/src/utils/index.ts", "");
    project.createSourceFile("/root/src/index.ts", "");
    const index = buildModuleResolutionIndex(project.getSourceFiles(), "/root");

    expect(index.resolve("/root/src/index.ts", "./utils")).toBe(target);
  });

  it("resolves a parent-directory specifier", () => {
    const project = makeProject();
    const target = project.createSourceFile("/root/src/math.ts", "");
    project.createSourceFile("/root/src/nested/file.ts", "");
    const index = buildModuleResolutionIndex(project.getSourceFiles(), "/root");

    expect(index.resolve("/root/src/nested/file.ts", "../math")).toBe(target);
  });

  it("returns undefined for a specifier that does not resolve to any discovered file", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/index.ts", "");
    const index = buildModuleResolutionIndex(project.getSourceFiles(), "/root");

    expect(index.resolve("/root/src/index.ts", "./missing")).toBeUndefined();
  });

  it("resolves a prefix-matched alias specifier", () => {
    const project = makeProject();
    const target = project.createSourceFile(
      "/root/src/components/Header.tsx",
      ""
    );
    project.createSourceFile("/root/src/index.ts", "");
    const index = buildModuleResolutionIndex(
      project.getSourceFiles(),
      "/root",
      [makeAlias()]
    );

    expect(index.resolve("/root/src/index.ts", "@/components/Header")).toBe(
      target
    );
  });

  it("resolves an exact-matched alias specifier", () => {
    const project = makeProject();
    const target = project.createSourceFile("/root/src/legacy.ts", "");
    project.createSourceFile("/root/src/index.ts", "");
    const index = buildModuleResolutionIndex(
      project.getSourceFiles(),
      "/root",
      [
        makeAlias({
          pattern: "@legacy",
          target: "src/legacy",
          matchType: "exact",
        }),
      ]
    );

    expect(index.resolve("/root/src/index.ts", "@legacy")).toBe(target);
    expect(
      index.resolve("/root/src/index.ts", "@legacy/nested")
    ).toBeUndefined();
  });

  it("returns undefined for a non-relative specifier with no matching alias", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/index.ts", "");
    const index = buildModuleResolutionIndex(
      project.getSourceFiles(),
      "/root",
      [makeAlias()]
    );

    expect(index.resolve("/root/src/index.ts", "react")).toBeUndefined();
  });
});

describe("isRelativeSpecifier", () => {
  it("is true for ./ and ../ specifiers", () => {
    expect(isRelativeSpecifier("./foo")).toBe(true);
    expect(isRelativeSpecifier("../foo")).toBe(true);
  });

  it("is false for bare and alias specifiers", () => {
    expect(isRelativeSpecifier("react")).toBe(false);
    expect(isRelativeSpecifier("@/components/Header")).toBe(false);
  });
});

describe("looksLikePathAlias", () => {
  it("is true for @/ prefixed specifiers", () => {
    expect(looksLikePathAlias("@/components/Header")).toBe(true);
  });

  it("is false for relative and bare specifiers", () => {
    expect(looksLikePathAlias("./foo")).toBe(false);
    expect(looksLikePathAlias("react")).toBe(false);
  });
});

describe("looksLikeAssetImport", () => {
  it("is true for known static asset extensions, case-insensitively", () => {
    expect(looksLikeAssetImport("./logo.svg")).toBe(true);
    expect(looksLikeAssetImport("./photo.PNG")).toBe(true);
    expect(looksLikeAssetImport("./styles.css")).toBe(true);
  });

  it("is false for source file extensions", () => {
    expect(looksLikeAssetImport("./math.ts")).toBe(false);
    expect(looksLikeAssetImport("./math")).toBe(false);
  });
});

describe("matchAlias", () => {
  it("picks the longest matching pattern when more than one matches", () => {
    const broad = makeAlias({ pattern: "@/", target: "src/" });
    const specific = makeAlias({
      pattern: "@/components/",
      target: "src/ui/components/",
    });

    expect(matchAlias("@/components/Header", [specific, broad])).toBe(specific);
  });

  it("returns undefined when no alias matches", () => {
    expect(matchAlias("react", [makeAlias()])).toBeUndefined();
  });
});

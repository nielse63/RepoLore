import { extractExternalDependencies } from "../external-dependencies";
import type { DeclaredDependency } from "../project-config";

function declared(
  overrides: Partial<DeclaredDependency> = {}
): DeclaredDependency {
  return {
    name: "requests",
    versionSpec: ">=2.31",
    scope: "direct",
    sourceFile: "pyproject.toml",
    configKey: "project.dependencies",
    ...overrides,
  };
}

describe("extractExternalDependencies (Python)", () => {
  it("declares one dependency per manifest entry, with detected declaration evidence", () => {
    const deps = extractExternalDependencies([declared()], [], "python");
    expect(deps).toHaveLength(1);
    expect(deps[0]).toMatchObject({
      name: "requests",
      declaredVersion: ">=2.31",
      scope: "direct",
      registry: "pypi",
    });
    expect(deps[0].evidence[0]).toMatchObject({
      kind: "pyproject-dependency-declaration",
      certainty: "detected",
    });
  });

  it("matches an import by normalized (case/punctuation-insensitive) name and records inferred usage evidence", () => {
    const deps = extractExternalDependencies(
      [declared({ name: "PyYAML" })],
      [{ topLevelName: "pyyaml", importerPath: "pkg/main.py", line: 4 }],
      "python"
    );
    const usages = deps[0].evidence.filter(
      (e) => e.kind === "import-reference"
    );
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({
      certainty: "inferred",
      location: { filePath: "pkg/main.py", startLine: 4 },
    });
    expect(deps[0].gaps).toEqual([]);
  });

  it("records an honest 'no usage detected' gap, not 'unused', when nothing matches", () => {
    const deps = extractExternalDependencies([declared()], [], "python");
    expect(deps[0].gaps).toHaveLength(1);
    expect(deps[0].gaps[0].certainty).toBe("unknown");
    expect(deps[0].gaps[0].description).toContain("doesn't necessarily mean");
    expect(deps[0].gaps[0].description).toContain("requests");
  });

  it("does not create a dependency for a reference that matches nothing declared", () => {
    const deps = extractExternalDependencies(
      [],
      [{ topLevelName: "numpy", importerPath: "pkg/main.py", line: 1 }],
      "python"
    );
    expect(deps).toEqual([]);
  });
});

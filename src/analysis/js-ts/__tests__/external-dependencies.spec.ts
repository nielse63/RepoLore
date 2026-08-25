import {
  extractExternalDependencies,
  packageNameFromSpecifier,
} from "../external-dependencies";

describe("packageNameFromSpecifier", () => {
  it("returns the whole specifier for an unscoped package with no subpath", () => {
    expect(packageNameFromSpecifier("lodash")).toBe("lodash");
  });

  it("strips the subpath from an unscoped package", () => {
    expect(packageNameFromSpecifier("lodash/get")).toBe("lodash");
  });

  it("keeps the scope segment for a scoped package", () => {
    expect(packageNameFromSpecifier("@scope/pkg/sub/path")).toBe("@scope/pkg");
  });
});

describe("extractExternalDependencies (JS/TS)", () => {
  it("returns nothing when no package.json was found", () => {
    expect(extractExternalDependencies(undefined, [], "js-ts")).toEqual([]);
  });

  it("declares one dependency per package.json field, with detected manifest evidence", () => {
    const deps = extractExternalDependencies(
      {
        dependencies: { axios: "^1.6.0" },
        devDependencies: { jest: "^29.0.0" },
      },
      [],
      "js-ts"
    );

    expect(deps).toHaveLength(2);
    const axios = deps.find((d) => d.name === "axios")!;
    expect(axios).toMatchObject({
      scope: "direct",
      declaredVersion: "^1.6.0",
      registry: "npm",
    });
    expect(axios.evidence).toHaveLength(1);
    expect(axios.evidence[0]).toMatchObject({
      kind: "package-json-dependency-field",
      certainty: "detected",
      location: { filePath: "package.json", configKey: "dependencies.axios" },
    });
  });

  it("first-seen field wins when a name appears in more than one dependency field", () => {
    const deps = extractExternalDependencies(
      {
        dependencies: { axios: "^1.0.0" },
        devDependencies: { axios: "^0.9.0" },
      },
      [],
      "js-ts"
    );
    expect(deps).toHaveLength(1);
    expect(deps[0].scope).toBe("direct");
  });

  it("matches a bare-specifier reference to its declared package name and records detected usage evidence", () => {
    const deps = extractExternalDependencies(
      { dependencies: { axios: "^1.6.0" } },
      [
        { specifier: "axios", importerPath: "src/api.ts", line: 3 },
        { specifier: "axios/dist/node", importerPath: "src/other.ts", line: 5 },
      ],
      "js-ts"
    );

    const axios = deps.find((d) => d.name === "axios")!;
    const usages = axios.evidence.filter((e) => e.kind === "import-reference");
    expect(usages).toHaveLength(2);
    expect(usages[0]).toMatchObject({
      certainty: "detected",
      location: { filePath: "src/api.ts", startLine: 3 },
    });
  });

  it("does not create a dependency for a reference that matches nothing declared", () => {
    const deps = extractExternalDependencies(
      { dependencies: {} },
      [{ specifier: "left-pad", importerPath: "src/index.ts", line: 1 }],
      "js-ts"
    );
    expect(deps).toEqual([]);
  });
});

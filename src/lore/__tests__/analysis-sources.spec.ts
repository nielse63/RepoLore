import { analysisSources } from "../analysis-sources";
import type { Evidence, ExternalDependency, Language, Project } from "../model";

const project = (languages: Language[], frameworks: string[] = []) =>
  ({ languages, frameworks }) as Project;

const evidence = (kind: string, filePath?: string): Evidence => ({
  kind,
  certainty: "detected",
  description: kind,
  location: filePath ? { filePath } : undefined,
});

const dependency = (...entries: Evidence[]) =>
  ({ evidence: entries }) as ExternalDependency;

describe("analysisSources", () => {
  it("merges languages and frameworks across every project, de-duplicated and sorted", () => {
    expect(
      analysisSources({
        projects: [
          project(["typescript", "javascript"], ["react"]),
          project(["python"]),
          project(["typescript"], ["next", "react"]),
        ],
        externalDependencies: [],
      })
    ).toEqual({
      languages: ["javascript", "python", "typescript"],
      frameworks: ["next", "react"],
      manifests: [],
    });
  });

  it("lists the manifests that declared dependencies, not the files that import them", () => {
    expect(
      analysisSources({
        projects: [],
        externalDependencies: [
          dependency(
            evidence("package-json-dependency-field", "package.json"),
            evidence("import-reference", "src/index.ts")
          ),
          dependency(
            evidence("package-json-dependency-field", "package.json"),
            evidence("pyproject-dependency", "tool/pyproject.toml")
          ),
        ],
      }).manifests
    ).toEqual(["package.json", "tool/pyproject.toml"]);
  });

  it("skips declaration evidence that has no location", () => {
    expect(
      analysisSources({
        projects: [],
        externalDependencies: [
          dependency(evidence("package-json-dependency-field")),
        ],
      }).manifests
    ).toEqual([]);
  });
});

import type { JsTsExtraction } from "@/analysis/js-ts/extract-project";
import type { JsTsViews } from "@/analysis/js-ts/derive-views";
import { START_HERE_MIN_ITEMS } from "../model";
import { buildJsTsLore, type BuildJsTsLoreInput } from "../build-lore";

function minimalExtraction(
  overrides: Partial<JsTsExtraction> = {}
): JsTsExtraction {
  return {
    project: {
      id: ".",
      name: "widgets",
      kind: "application",
      languages: ["typescript"],
      rootPath: ".",
      frameworks: [],
      evidence: [],
      gaps: [],
    },
    sourceFilePaths: ["src/index.ts"],
    relationships: [],
    entryPoints: [],
    publicContracts: [],
    testRelationships: [],
    reactComponents: [],
    gaps: [],
    ...overrides,
  };
}

function minimalViews(overrides: Partial<JsTsViews> = {}): JsTsViews {
  return {
    structuralAreas: [],
    startHere: [],
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<BuildJsTsLoreInput> = {}
): BuildJsTsLoreInput {
  return {
    owner: "acme",
    repo: "widgets",
    defaultBranch: "main",
    commitSha: "sha123",
    analyzerVersion: "js-ts-v2",
    analyzedAt: "2026-01-01T00:00:00Z",
    extraction: minimalExtraction(),
    views: minimalViews(),
    ...overrides,
  };
}

describe("buildJsTsLore", () => {
  it("assembles the repository identity and snapshot metadata", () => {
    const lore = buildJsTsLore(baseInput({ description: "A widget factory" }));

    expect(lore.snapshot).toMatchObject({
      id: "acme/widgets@sha123:js-ts-v2",
      commitSha: "sha123",
      analyzedAt: "2026-01-01T00:00:00Z",
      analyzerVersion: "js-ts-v2",
      repository: {
        owner: "acme",
        name: "widgets",
        description: "A widget factory",
        defaultBranch: "main",
        url: "https://github.com/acme/widgets",
      },
    });
  });

  it("omits the repository description when not provided", () => {
    const lore = buildJsTsLore(baseInput());
    expect(lore.snapshot.repository.description).toBeUndefined();
  });

  it("carries extraction and view data through into the Lore shape", () => {
    const extraction = minimalExtraction({
      entryPoints: [
        {
          id: "entry-1",
          kind: "runtime",
          location: { filePath: "src/index.ts" },
          certainty: "inferred",
          evidence: [],
        },
      ],
    });
    const views = minimalViews({
      structuralAreas: [
        {
          id: "area:src",
          projectId: ".",
          name: "src",
          location: { filePath: "src" },
          rationale: "grouped",
          importantLocations: [],
          entryPointIds: [],
          directDependencyIds: [],
          directDependentIds: [],
          testRelationshipIds: [],
          evidence: [],
          gaps: [],
        },
      ],
    });

    const lore = buildJsTsLore(baseInput({ extraction, views }));

    expect(lore.projects).toEqual([extraction.project]);
    expect(lore.entryPoints).toEqual(extraction.entryPoints);
    expect(lore.structuralAreas).toEqual(views.structuralAreas);
    expect(lore.findings).toEqual([]);
  });

  it('marks status "partial" when the minimum value contract is not met', () => {
    const lore = buildJsTsLore(baseInput());
    expect(lore.snapshot.status).toBe("partial");
  });

  it('marks status "completed" when the minimum value contract is fully satisfied', () => {
    const evidence = {
      kind: "test-evidence",
      certainty: "detected" as const,
      location: { filePath: "src/index.ts" },
      description: "evidence",
    };

    const extraction = minimalExtraction({
      project: {
        id: ".",
        name: "widgets",
        kind: "application",
        languages: ["typescript"],
        rootPath: ".",
        frameworks: [],
        evidence: [evidence],
        gaps: [],
      },
      entryPoints: [
        {
          id: "entry-1",
          kind: "bootstrap",
          location: { filePath: "src/index.ts" },
          certainty: "detected",
          evidence: [evidence],
        },
      ],
      relationships: [
        {
          id: "rel-1",
          kind: "depends-on",
          fromId: "src/index.ts",
          toId: "src/app.ts",
          certainty: "detected",
          evidence: [evidence],
        },
      ],
    });

    const views = minimalViews({
      structuralAreas: [
        {
          id: "area:src",
          projectId: ".",
          name: "src",
          location: { filePath: "src" },
          rationale: "grouped",
          importantLocations: [],
          entryPointIds: [],
          directDependencyIds: [],
          directDependentIds: [],
          testRelationshipIds: [],
          evidence: [evidence],
          gaps: [],
        },
      ],
      startHere: Array.from({ length: START_HERE_MIN_ITEMS }, (_, i) => ({
        id: `start-here-${i}`,
        order: i + 1,
        location: { filePath: "src/index.ts" },
        whatItRepresents: "thing",
        rationale: "because",
        certainty: "detected" as const,
        evidence: [evidence],
      })),
    });

    const lore = buildJsTsLore(baseInput({ extraction, views }));
    expect(lore.snapshot.status).toBe("completed");
  });
});

import type { JsTsExtraction } from "@/analysis/js-ts/extract-project";
import type { JsTsViews } from "@/analysis/js-ts/derive-views";
import type { Recommendation } from "../model";
import { START_HERE_MAX_ITEMS, START_HERE_MIN_ITEMS } from "../model";
import { buildLore, type BuildLoreInput } from "../build-lore";

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

function baseInput(overrides: Partial<BuildLoreInput> = {}): BuildLoreInput {
  return {
    owner: "acme",
    repo: "widgets",
    defaultBranch: "main",
    isPrivate: false,
    commitSha: "sha123",
    analyzerVersion: "js-ts-v2",
    analyzedAt: "2026-01-01T00:00:00Z",
    extractions: [{ extraction: minimalExtraction(), views: minimalViews() }],
    ...overrides,
  };
}

describe("buildLore", () => {
  it("assembles the repository identity and snapshot metadata", () => {
    const lore = buildLore(baseInput({ description: "A widget factory" }));

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
    const lore = buildLore(baseInput());
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

    const lore = buildLore(baseInput({ extractions: [{ extraction, views }] }));

    expect(lore.projects).toEqual([extraction.project]);
    expect(lore.entryPoints).toEqual(extraction.entryPoints);
    expect(lore.structuralAreas).toEqual(views.structuralAreas);
    expect(lore.findings).toEqual([]);
  });

  it('marks status "partial" when the minimum value contract is not met', () => {
    const lore = buildLore(baseInput());
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

    const lore = buildLore(baseInput({ extractions: [{ extraction, views }] }));
    expect(lore.snapshot.status).toBe("completed");
  });

  describe("merging multiple extractions (ADR-0007 mixed-language dispatch)", () => {
    function recommendation(
      overrides: Partial<Recommendation> = {}
    ): Recommendation {
      return {
        id: "unused",
        order: 0,
        location: { filePath: "unused" },
        whatItRepresents: "thing",
        rationale: "because",
        certainty: "detected",
        evidence: [],
        ...overrides,
      };
    }

    function extractionFor(
      language: "typescript" | "python",
      rootPath: string
    ) {
      return minimalExtraction({
        project: {
          id: language,
          name: language,
          kind: "application",
          languages: [language],
          rootPath,
          frameworks: [],
          evidence: [],
          gaps: [],
        },
      });
    }

    it("includes one project per extraction", () => {
      const jsExtraction = extractionFor("typescript", "web");
      const pyExtraction = extractionFor("python", "api");

      const lore = buildLore(
        baseInput({
          extractions: [
            { extraction: jsExtraction, views: minimalViews() },
            { extraction: pyExtraction, views: minimalViews() },
          ],
        })
      );

      expect(lore.projects).toEqual([
        jsExtraction.project,
        pyExtraction.project,
      ]);
    });

    it("concatenates entry points, relationships, and gaps across extractions rather than inventing cross-language links", () => {
      const jsExtraction = extractionFor("typescript", "web");
      jsExtraction.entryPoints = [
        {
          id: "js-entry",
          kind: "bootstrap",
          location: { filePath: "web/index.ts" },
          certainty: "detected",
          evidence: [],
        },
      ];
      const pyExtraction = extractionFor("python", "api");
      pyExtraction.entryPoints = [
        {
          id: "py-entry",
          kind: "bootstrap",
          location: { filePath: "api/main.py" },
          certainty: "detected",
          evidence: [],
        },
      ];

      const lore = buildLore(
        baseInput({
          extractions: [
            { extraction: jsExtraction, views: minimalViews() },
            { extraction: pyExtraction, views: minimalViews() },
          ],
        })
      );

      expect(lore.entryPoints).toEqual([
        ...jsExtraction.entryPoints,
        ...pyExtraction.entryPoints,
      ]);
      expect(lore.relationships).toEqual([]);
    });

    it("interleaves each extraction's Start Here list rather than concatenating it", () => {
      const jsStartHere = [
        recommendation({ location: { filePath: "js-1" } }),
        recommendation({ location: { filePath: "js-2" } }),
      ];
      const pyStartHere = [
        recommendation({ location: { filePath: "py-1" } }),
        recommendation({ location: { filePath: "py-2" } }),
      ];

      const lore = buildLore(
        baseInput({
          extractions: [
            {
              extraction: extractionFor("typescript", "web"),
              views: minimalViews({ startHere: jsStartHere }),
            },
            {
              extraction: extractionFor("python", "api"),
              views: minimalViews({ startHere: pyStartHere }),
            },
          ],
        })
      );

      expect(lore.startHere.map((item) => item.location.filePath)).toEqual([
        "js-1",
        "py-1",
        "js-2",
        "py-2",
      ]);
      expect(lore.startHere.map((item) => item.order)).toEqual([1, 2, 3, 4]);
    });

    it("caps the merged Start Here at START_HERE_MAX_ITEMS even when extractions together exceed it", () => {
      const manyItems = (prefix: string) =>
        Array.from({ length: START_HERE_MAX_ITEMS }, (_, i) =>
          recommendation({ location: { filePath: `${prefix}-${i}` } })
        );

      const lore = buildLore(
        baseInput({
          extractions: [
            {
              extraction: extractionFor("typescript", "web"),
              views: minimalViews({ startHere: manyItems("js") }),
            },
            {
              extraction: extractionFor("python", "api"),
              views: minimalViews({ startHere: manyItems("py") }),
            },
          ],
        })
      );

      expect(lore.startHere).toHaveLength(START_HERE_MAX_ITEMS);
      expect(lore.startHere.map((item) => item.order)).toEqual(
        Array.from({ length: START_HERE_MAX_ITEMS }, (_, i) => i + 1)
      );
    });
  });
});

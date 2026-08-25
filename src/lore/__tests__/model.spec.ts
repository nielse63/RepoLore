import {
  countEvidence,
  evaluateMinimumValueContract,
  START_HERE_MAX_ITEMS,
  START_HERE_MIN_ITEMS,
  type Evidence,
  type Lore,
} from "../model";

const evidence: Evidence = {
  kind: "test-evidence",
  certainty: "detected",
  location: { filePath: "src/index.ts" },
  description: "test evidence",
};

function emptyLore(): Lore {
  return {
    snapshot: {
      id: "snap-1",
      repository: {
        owner: "acme",
        name: "widgets",
        defaultBranch: "main",
        url: "https://github.com/acme/widgets",
        isPrivate: false,
      },
      commitSha: "sha123",
      analyzedAt: "2026-01-01T00:00:00Z",
      analyzerVersion: "v1",
      status: "partial",
    },
    projects: [],
    structuralAreas: [],
    entryPoints: [],
    relationships: [],
    publicContracts: [],
    testRelationships: [],
    externalDependencies: [],
    callableSignatures: [],
    callEdges: [],
    startHere: [],
    findings: [],
    gaps: [],
  };
}

function recommendation(id: string, hasEvidence = true) {
  return {
    id,
    order: 1,
    location: { filePath: "src/index.ts" },
    whatItRepresents: "thing",
    rationale: "because",
    certainty: "detected" as const,
    evidence: hasEvidence ? [evidence] : [],
  };
}

describe("evaluateMinimumValueContract", () => {
  it("reports all false for a completely empty Lore", () => {
    const contract = evaluateMinimumValueContract(emptyLore());
    expect(contract).toEqual({
      hasRepositoryOrientation: false,
      hasMeaningfulStartHere: false,
      hasMajorAreaModel: false,
      hasProbableEntryPoints: false,
      hasDirectRelationships: false,
      hasTraceableEvidence: true,
    });
  });

  it("hasRepositoryOrientation is true when there is at least one project", () => {
    const lore = emptyLore();
    lore.projects.push({
      id: ".",
      name: "widgets",
      kind: "application",
      languages: ["typescript"],
      rootPath: ".",
      frameworks: [],
      evidence: [],
      gaps: [],
    });
    expect(evaluateMinimumValueContract(lore).hasRepositoryOrientation).toBe(
      true
    );
  });

  it("hasMeaningfulStartHere requires between MIN and MAX items, each with evidence", () => {
    const lore = emptyLore();
    lore.startHere = Array.from({ length: START_HERE_MIN_ITEMS - 1 }, (_, i) =>
      recommendation(`item-${i}`)
    );
    expect(evaluateMinimumValueContract(lore).hasMeaningfulStartHere).toBe(
      false
    );

    lore.startHere = Array.from({ length: START_HERE_MIN_ITEMS }, (_, i) =>
      recommendation(`item-${i}`)
    );
    expect(evaluateMinimumValueContract(lore).hasMeaningfulStartHere).toBe(
      true
    );
  });

  it("hasMeaningfulStartHere is false when any item lacks evidence", () => {
    const lore = emptyLore();
    lore.startHere = Array.from({ length: START_HERE_MIN_ITEMS }, (_, i) =>
      recommendation(`item-${i}`, i !== 0)
    );
    expect(evaluateMinimumValueContract(lore).hasMeaningfulStartHere).toBe(
      false
    );
  });

  it("hasMeaningfulStartHere is false above START_HERE_MAX_ITEMS", () => {
    const lore = emptyLore();
    lore.startHere = Array.from({ length: START_HERE_MAX_ITEMS + 1 }, (_, i) =>
      recommendation(`item-${i}`)
    );
    expect(evaluateMinimumValueContract(lore).hasMeaningfulStartHere).toBe(
      false
    );
  });

  it("hasMajorAreaModel, hasProbableEntryPoints, hasDirectRelationships each reflect their own arrays", () => {
    const lore = emptyLore();
    lore.structuralAreas.push({
      id: "area:1",
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
    });
    lore.entryPoints.push({
      id: "entry-1",
      kind: "runtime",
      location: { filePath: "src/index.ts" },
      certainty: "inferred",
      evidence: [],
    });
    lore.relationships.push({
      id: "rel-1",
      kind: "depends-on",
      fromId: "a",
      toId: "b",
      certainty: "detected",
      evidence: [],
    });

    const contract = evaluateMinimumValueContract(lore);
    expect(contract.hasMajorAreaModel).toBe(true);
    expect(contract.hasProbableEntryPoints).toBe(true);
    expect(contract.hasDirectRelationships).toBe(true);
  });

  it("hasTraceableEvidence is false when any evidence item across the Lore lacks a location", () => {
    const lore = emptyLore();
    lore.projects.push({
      id: ".",
      name: "widgets",
      kind: "application",
      languages: [],
      rootPath: ".",
      frameworks: [],
      evidence: [
        { kind: "x", certainty: "detected", description: "no location" },
      ],
      gaps: [],
    });

    expect(evaluateMinimumValueContract(lore).hasTraceableEvidence).toBe(false);
  });
});

describe("countEvidence", () => {
  it("is 0 for a completely empty Lore", () => {
    expect(countEvidence(emptyLore())).toBe(0);
  });

  it("sums evidence across projects, areas, entry points, relationships, and startHere", () => {
    const lore = emptyLore();
    lore.projects.push({
      id: ".",
      name: "widgets",
      kind: "application",
      languages: [],
      rootPath: ".",
      frameworks: [],
      evidence: [evidence],
      gaps: [],
    });
    lore.structuralAreas.push({
      id: "area:1",
      projectId: ".",
      name: "src",
      location: { filePath: "src" },
      rationale: "grouped",
      importantLocations: [],
      entryPointIds: [],
      directDependencyIds: [],
      directDependentIds: [],
      testRelationshipIds: [],
      evidence: [evidence, evidence],
      gaps: [],
    });
    lore.entryPoints.push({
      id: "entry-1",
      kind: "runtime",
      location: { filePath: "src/index.ts" },
      certainty: "inferred",
      evidence: [evidence],
    });
    lore.relationships.push({
      id: "rel-1",
      kind: "depends-on",
      fromId: "a",
      toId: "b",
      certainty: "detected",
      evidence: [evidence],
    });
    lore.startHere.push(recommendation("item-1"));

    expect(countEvidence(lore)).toBe(6);
  });
});

import type { CommitFileChange, CommitSummary } from "@/github/commits";
import type { Lore, StructuralArea } from "@/lore/model";
import {
  buildHistoryEntries,
  classifyCommitFiles,
  describeEntry,
  groupIntoEntries,
  resolveAreaForPath,
  type ClassifiedCommit,
} from "../classify";

function area(id: string, name: string, filePath: string): StructuralArea {
  return {
    id,
    projectId: "project-1",
    name,
    location: { filePath },
    rationale: "test",
    importantLocations: [],
    entryPointIds: [],
    directDependencyIds: [],
    directDependentIds: [],
    testRelationshipIds: [],
    evidence: [],
    gaps: [],
    productionFilePaths: [],
  };
}

function makeLore(structuralAreas: StructuralArea[]): Lore {
  return {
    snapshot: {
      id: "snap-1",
      repository: {
        owner: "acme",
        name: "payments-service",
        defaultBranch: "main",
        url: "https://github.com/acme/payments-service",
        isPrivate: false,
      },
      commitSha: "headsha",
      analyzedAt: "2026-08-01T00:00:00Z",
      analyzerVersion: "v1",
      status: "completed",
    },
    projects: [],
    structuralAreas,
    entryPoints: [],
    relationships: [],
    publicContracts: [],
    testRelationships: [],
    externalDependencies: [],
    callableSignatures: [],
    callEdges: [],
    behaviorNodes: [],
    behaviorEdges: [],
    functionImportance: [],
    startHere: [],
    findings: [],
    gaps: [],
  };
}

const worker = area("area-worker", "Worker", "worker");
const paymentService = area(
  "area-payment",
  "Payment Service",
  "service/payment"
);
const lore = makeLore([worker, paymentService]);

function file(overrides: Partial<CommitFileChange>): CommitFileChange {
  return {
    filePath: "unspecified.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    ...overrides,
  };
}

function commit(sha: string, authoredAt: string): CommitSummary {
  return {
    sha,
    message: `commit ${sha}`,
    authorName: "Ava Singh",
    authorLogin: "ava",
    authoredAt,
  };
}

describe("resolveAreaForPath", () => {
  it("matches the longest area prefix", () => {
    expect(resolveAreaForPath(lore, "worker/tasks.py")?.name).toBe("Worker");
    expect(resolveAreaForPath(lore, "service/payment/service.py")?.name).toBe(
      "Payment Service"
    );
  });

  it("returns undefined when no area matches", () => {
    expect(resolveAreaForPath(lore, "README.md")).toBeUndefined();
  });
});

describe("classifyCommitFiles", () => {
  it("detects an added dependency in package.json", () => {
    const facts = classifyCommitFiles(
      [
        file({
          filePath: "package.json",
          patch:
            '@@ -10,3 +10,4 @@\n   "dependencies": {\n+    "celery": "^5.3.0",\n     "react": "^19.0.0"',
        }),
      ],
      lore
    );
    expect(facts).toContainEqual(
      expect.objectContaining({
        kind: "dependency",
        certainty: "inferred",
        description: "celery added in package.json",
      })
    );
  });

  it("ignores string lines inside visible non-dependency objects of package.json", () => {
    const facts = classifyCommitFiles(
      [
        file({
          filePath: "package.json",
          patch: [
            "@@ -5,9 +5,9 @@",
            '   "scripts": {',
            '-    "build": "next build",',
            '+    "build": "next build --turbo",',
            '     "start": "next start"',
            "   },",
            '   "engines": {',
            '-    "node": ">=18"',
            '+    "node": ">=20"',
            "   },",
          ].join("\n"),
        }),
      ],
      lore
    );
    expect(facts).toEqual([]);
  });

  it("ignores scripts and top-level fields of package.json when no enclosing object is visible", () => {
    const facts = classifyCommitFiles(
      [
        file({
          filePath: "package.json",
          patch: [
            "@@ -8,6 +8,6 @@",
            '     "dev": "next dev",',
            '-    "build": "next build",',
            '+    "build": "next build --turbo",',
            '     "lint": "eslint"',
            "@@ -40,3 +40,6 @@",
            '     "react": "^19.0.0"',
            "   },",
            '+  "type": "module",',
            '+  "packageManager": "pnpm@9.0.0",',
            '+  "homepage": "https://example.test"',
          ].join("\n"),
        }),
      ],
      lore
    );
    expect(facts).toEqual([]);
  });

  it("detects a package.json dependency only inside a dependency section", () => {
    const facts = classifyCommitFiles(
      [
        file({
          filePath: "package.json",
          patch: [
            "@@ -10,8 +10,10 @@",
            '     "jest": "^29.0.0",',
            '+    "vitest": "^2.0.0",',
            "   },",
            '   "scripts": {',
            '+    "test": "vitest",',
            "   },",
            '   "dependencies": {',
            '-    "lodash": "^4.17.0",',
            '     "react": "^19.0.0"',
          ].join("\n"),
        }),
      ],
      lore
    );
    expect(facts.map((f) => f.description)).toEqual([
      "vitest added in package.json",
      "lodash removed from package.json",
    ]);
  });

  it("summarizes a package-lock.json diff as one fact counting changed package entries", () => {
    const facts = classifyCommitFiles(
      [
        file({
          filePath: "package-lock.json",
          patch: [
            "@@ -100,24 +100,22 @@",
            '     "node_modules/express": {',
            '-      "version": "5.2.1",',
            '-      "resolved": "https://registry.npmjs.org/express/-/express-5.2.1.tgz",',
            '-      "integrity": "sha512-old",',
            '+      "version": "5.3.0",',
            '+      "resolved": "https://registry.npmjs.org/express/-/express-5.3.0.tgz",',
            '+      "integrity": "sha512-new",',
            '       "dev": true,',
            '       "license": "MIT",',
            '       "dependencies": {',
            '         "accepts": "^2.0.0",',
            '-        "body-parser": "^2.2.1"',
            '+        "body-parser": "^2.3.0"',
            "       }",
            "     },",
            '-    "node_modules/express/node_modules/content-type": {',
            '-      "version": "1.0.5",',
            '-      "license": "MIT",',
            '-      "engines": {',
            '-        "node": ">= 0.6"',
            "-      }",
            "-    },",
            '+    "node_modules/left-pad": {',
            '+      "version": "1.3.0",',
            '+      "license": "WTFPL"',
            "+    },",
            '     "node_modules/qs": {',
            '       "version": "6.14.0",',
            "@@ -300,6 +298,6 @@",
            '       "optionalDependencies": {',
            '-        "@rollup/rollup-android-arm64": "4.64.1"',
            '+        "@rollup/rollup-android-arm64": "4.64.6"',
            "       }",
          ].join("\n"),
        }),
      ],
      lore
    );
    expect(facts).toEqual([
      {
        kind: "dependency",
        certainty: "inferred",
        description: "at least 3 packages changed in package-lock.json",
        filePath: "package-lock.json",
      },
    ]);
  });

  it("keeps package-lock.json entries attributed across anonymous objects and the root entry", () => {
    const facts = classifyCommitFiles(
      [
        file({
          filePath: "package-lock.json",
          patch: [
            "@@ -10,30 +10,30 @@",
            '     "": {',
            '       "name": "app",',
            '-      "version": "1.0.0"',
            '+      "version": "1.1.0"',
            "     },",
            '     "node_modules/foo": {',
            '       "version": "1.0.0",',
            '       "funding": [',
            "         {",
            '           "type": "github",',
            '           "url": "https://github.com/sponsors/foo"',
            "         }",
            "       ],",
            '       "engines": {',
            '-        "node": ">=16"',
            '+        "node": ">=18"',
            "       }",
            "     },",
            '     "node_modules/bar": {',
            '-      "version": "2.0.0",',
            '+      "version": "2.1.0",',
          ].join("\n"),
        }),
      ],
      lore
    );
    expect(facts.map((f) => f.description)).toEqual([
      "2 packages changed in package-lock.json",
    ]);
  });

  it("marks a package-lock.json diff with no identifiable package entry as unknown", () => {
    const facts = classifyCommitFiles(
      [
        file({
          filePath: "package-lock.json",
          patch: [
            "@@ -1,6 +1,6 @@",
            " {",
            '   "name": "app",',
            '-  "lockfileVersion": 1,',
            '+  "lockfileVersion": 3,',
            '   "requires": true,',
          ].join("\n"),
        }),
      ],
      lore
    );
    expect(facts).toEqual([
      expect.objectContaining({
        kind: "dependency",
        certainty: "unknown",
        description:
          "package-lock.json changed (no package entries identified in the diff)",
      }),
    ]);
  });

  it.each(["yarn.lock", "pnpm-lock.yaml"])(
    "marks a %s change as one unknown fact instead of parsing its lines",
    (filePath) => {
      const facts = classifyCommitFiles(
        [
          file({
            filePath,
            patch:
              '@@ -1,3 +1,3 @@\n "accepts@^2.0.0":\n-  version "2.0.0"\n+  version "2.0.1"\n-  "resolved": "https://example.test/a.tgz"',
          }),
        ],
        lore
      );
      expect(facts).toEqual([
        expect.objectContaining({
          kind: "dependency",
          certainty: "unknown",
          description: `${filePath} changed (lockfile contents not inspected)`,
        }),
      ]);
    }
  );

  it("marks a manifest change with no patch as unknown certainty", () => {
    const facts = classifyCommitFiles(
      [file({ filePath: "package.json" })],
      lore
    );
    expect(facts).toEqual([
      expect.objectContaining({ kind: "dependency", certainty: "unknown" }),
    ]);
  });

  it("detects a new cross-area relative import as an architecture fact", () => {
    const facts = classifyCommitFiles(
      [
        file({
          filePath: "worker/tasks.ts",
          patch:
            "@@ -1,1 +1,2 @@\n+import { chargeCard } from '../service/payment/service';",
        }),
      ],
      lore
    );
    expect(facts).toContainEqual(
      expect.objectContaining({
        kind: "architecture",
        certainty: "inferred",
        description: "Worker now depends on Payment Service",
        areaName: "Worker",
      })
    );
  });

  it("does not emit an architecture fact for an import within the same area", () => {
    const facts = classifyCommitFiles(
      [
        file({
          filePath: "worker/tasks.ts",
          patch: "@@ -1,1 +1,2 @@\n+import { retry } from './retry';",
        }),
      ],
      lore
    );
    expect(facts.filter((f) => f.kind === "architecture")).toHaveLength(0);
  });

  it("detects a data-layer path as a data-flow fact", () => {
    const facts = classifyCommitFiles(
      [file({ filePath: "service/payment/models/order.py" })],
      lore
    );
    expect(facts).toContainEqual(
      expect.objectContaining({
        kind: "data-flow",
        description: "Data-layer file changed: service/payment/models/order.py",
      })
    );
  });
});

describe("groupIntoEntries", () => {
  it("groups consecutive same-day, same-area commits into one entry", () => {
    const classified: ClassifiedCommit[] = [
      {
        commit: commit("sha1", "2026-08-20T10:00:00Z"),
        facts: [
          {
            kind: "architecture",
            certainty: "inferred",
            description: "Worker now depends on Payment Service",
            filePath: "worker/tasks.ts",
            areaName: "Worker",
          },
        ],
      },
      {
        commit: commit("sha2", "2026-08-20T09:00:00Z"),
        facts: [
          {
            kind: "architecture",
            certainty: "inferred",
            description: "Worker now depends on Payment Service",
            filePath: "worker/tasks.ts",
            areaName: "Worker",
          },
        ],
      },
      {
        commit: commit("sha3", "2026-08-19T09:00:00Z"),
        facts: [
          {
            kind: "dependency",
            certainty: "inferred",
            description: "redis added in package.json",
            filePath: "package.json",
          },
        ],
      },
    ];

    const groups = groupIntoEntries(classified);
    expect(groups).toHaveLength(2);
    expect(groups[0].commits.map((c) => c.commit.sha)).toEqual([
      "sha1",
      "sha2",
    ]);
    expect(groups[1].commits.map((c) => c.commit.sha)).toEqual(["sha3"]);
  });

  it("drops commits with no classifiable facts", () => {
    const classified: ClassifiedCommit[] = [
      { commit: commit("sha1", "2026-08-20T10:00:00Z"), facts: [] },
    ];
    expect(groupIntoEntries(classified)).toEqual([]);
  });
});

describe("describeEntry", () => {
  it("builds title/summary/whatChanged/whyNoticed from grouped facts", () => {
    const group = {
      groupKey: "2026-08-20::Worker",
      commits: [
        {
          commit: commit("sha1", "2026-08-20T10:00:00Z"),
          facts: [
            {
              kind: "architecture" as const,
              certainty: "inferred" as const,
              description: "Worker now depends on Payment Service",
              filePath: "worker/tasks.ts",
              areaName: "Worker",
            },
          ],
        },
        {
          commit: commit("sha2", "2026-08-20T09:00:00Z"),
          facts: [
            {
              kind: "architecture" as const,
              certainty: "inferred" as const,
              description: "Worker now depends on Payment Service",
              filePath: "worker/tasks.ts",
              areaName: "Worker",
            },
          ],
        },
      ],
    };

    const entry = describeEntry(group);
    expect(entry.kind).toBe("architecture");
    expect(entry.title).toBe("Worker now depends on Payment Service");
    expect(entry.whatChanged).toEqual([
      "Worker now depends on Payment Service",
    ]);
    expect(entry.whyNoticed).toBe(
      "Detected 2 architecture-related changes across 2 commits."
    );
    expect(entry.affectedAreas).toEqual(["Worker"]);
    expect(entry.occurredAt).toBe("2026-08-20T10:00:00Z");
    expect(entry.commits).toHaveLength(2);
  });
});

describe("buildHistoryEntries", () => {
  it("combines classification, grouping, and description end to end", () => {
    const entries = buildHistoryEntries(
      [
        {
          commit: commit("sha1", "2026-08-20T10:00:00Z"),
          detail: {
            sha: "sha1",
            files: [
              file({
                filePath: "worker/tasks.ts",
                patch:
                  "@@ -1,1 +1,2 @@\n+import { chargeCard } from '../service/payment/service';",
              }),
            ],
          },
        },
        {
          commit: commit("sha2", "2026-08-01T10:00:00Z"),
          detail: {
            sha: "sha2",
            files: [file({ filePath: "README.md" })],
          },
        },
      ],
      lore
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].commits.map((c) => c.sha)).toEqual(["sha1"]);
  });
});

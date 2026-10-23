import {
  type AtAGlanceLine,
  type AtAGlancePart,
  buildAtAGlance,
} from "../at-a-glance";
import type {
  EntryPoint,
  Evidence,
  ExternalDependency,
  Gap,
  Lore,
  Project,
  StructuralArea,
} from "../model";

const KIND_EVIDENCE: Evidence = {
  kind: "package-json-entry-field-shape",
  certainty: "inferred",
  location: { filePath: "package.json" },
  description: 'package.json declares "main" and/or "exports".',
};

const project = (overrides: Partial<Project> = {}): Project => ({
  id: "js-ts",
  name: "axios",
  kind: "library",
  languages: ["javascript", "typescript"],
  rootPath: ".",
  frameworks: [],
  evidence: [KIND_EVIDENCE],
  gaps: [],
  ...overrides,
});

const entry = (
  kind: EntryPoint["kind"],
  filePath: string,
  certainty: EntryPoint["certainty"] = "detected"
): EntryPoint => ({
  id: `${kind}:${filePath}`,
  kind,
  location: { filePath },
  certainty,
  evidence: [],
});

const area = (
  name: string,
  {
    dependencies = 0,
    dependents = 0,
    responsibility,
    projectId = "js-ts",
    entryPointIds = [],
  }: {
    dependencies?: number;
    dependents?: number;
    responsibility?: string;
    projectId?: string;
    entryPointIds?: string[];
  } = {}
) =>
  ({
    id: name,
    projectId,
    name,
    location: { filePath: name },
    responsibility,
    entryPointIds,
    directDependencyIds: Array.from(
      { length: dependencies },
      (_, i) => `d${i}`
    ),
    directDependentIds: Array.from({ length: dependents }, (_, i) => `r${i}`),
  }) as unknown as StructuralArea;

const dependency = (scope: ExternalDependency["scope"]) =>
  ({ scope }) as ExternalDependency;

const lore = (overrides: Partial<Lore> = {}) =>
  ({
    snapshot: { repository: { owner: "axios", name: "axios" } },
    projects: [project()],
    structuralAreas: [],
    entryPoints: [],
    externalDependencies: [],
    gaps: [],
    ...overrides,
  }) as Lore;

/** Parts flattened to readable text: badges as `[certainty]`, locations as their path, each project row on its own line. */
function renderParts(parts: AtAGlancePart[]): string {
  return parts
    .map((part): string => {
      switch (part.type) {
        case "text":
        case "strong":
        case "anchor":
          return part.text;
        case "certainty":
          return `[${part.certainty}]`;
        case "location":
          return part.location.filePath;
        case "group":
          return `\n${renderParts(part.parts)}`;
      }
    })
    .join("");
}

const render = (line: AtAGlanceLine | undefined) =>
  renderParts(line?.parts ?? []);

const line = (l: Lore, id: AtAGlanceLine["id"]) =>
  render(buildAtAGlance(l).find((x) => x.id === id));

/** ADR-0007's mixed-language shape: a JS/TS library and a Python CLI sharing the repository root. */
const MIXED_PROJECTS = [
  project({ id: "js-ts", name: "source", languages: ["typescript"] }),
  project({
    id: "python",
    name: "source",
    kind: "application",
    languages: ["python"],
    evidence: [
      {
        kind: "entry-point-shape",
        certainty: "inferred",
        location: { filePath: "tool/cli.py" },
        description:
          "A runtime bootstrap or console-script entry point was detected.",
      },
    ],
  }),
];

describe("buildAtAGlance", () => {
  it("returns at most four lines, in kind → entry → areas → counts order", () => {
    expect(buildAtAGlance(lore()).map((l) => l.id)).toEqual([
      "kind",
      "entry",
      "areas",
      "counts",
    ]);
  });

  describe("kind line", () => {
    it('names a single project by the repository, not its placeholder "source" name', () => {
      expect(
        line(lore({ projects: [project({ name: "source" })] }), "kind")
      ).toBe(
        'axios is a JavaScript/TypeScript library [inferred], because package.json declares "main" or "exports" and no bootstrap, CLI, UI framework dependency, or React components were found'
      );
    });

    it("states a library's kind as Inferred, citing the kind evidence's source (issue #59's axios layout)", () => {
      expect(line(lore(), "kind")).toBe(
        'axios is a JavaScript/TypeScript library [inferred], because package.json declares "main" or "exports" and no bootstrap, CLI, UI framework dependency, or React components were found'
      );
    });

    it("never labels the kind with framework detection's Detected certainty", () => {
      const app = project({
        name: "web",
        kind: "application",
        languages: ["typescript"],
        frameworks: ["react"],
        evidence: [
          {
            kind: "react-component-detection",
            certainty: "detected",
            location: { filePath: "src/App.tsx" },
            description: "Detected 3 React component(s).",
          },
          {
            kind: "entry-point-shape",
            certainty: "inferred",
            location: { filePath: "src/index.tsx" },
            description: "A runtime bootstrap or CLI entry point was detected.",
          },
        ],
      });
      expect(line(lore({ projects: [app] }), "kind")).toBe(
        "axios is a TypeScript application [inferred], because a bootstrap or command-line entry point was found at src/index.tsx"
      );
    });

    it.each<[string, Project["kind"], Evidence, string]>([
      [
        "an application assumed from a manifest with no library entry fields",
        "application",
        {
          kind: "package-json-entry-field-shape",
          certainty: "inferred",
          location: { filePath: "package.json" },
          description:
            'package.json declares neither "main" nor "exports", so no library entry point is declared; assumed to be an application.',
        },
        'axios is a JavaScript/TypeScript application [inferred], assumed because package.json declares neither "main" nor "exports"',
      ],
      [
        "a Python library from the package its project name resolves to",
        "library",
        {
          kind: "entry-point-shape",
          certainty: "inferred",
          location: { filePath: "src/lib/__init__.py" },
          description:
            "A package's __init__.py was declared as its public entry point, with no runtime bootstrap detected.",
        },
        "axios is a JavaScript/TypeScript library [inferred], because src/lib/__init__.py is the package its declared project name resolves to, and no bootstrap or console-script entry point was found",
      ],
      [
        "an application from a UI framework dependency",
        "application",
        {
          kind: "framework-dependency",
          certainty: "inferred",
          location: { filePath: "package.json" },
          description:
            'package.json declares "main"/"exports" but depends on "vue", a UI framework; assumed to be an application rather than a library.',
        },
        'axios is a JavaScript/TypeScript application [inferred], because package.json declares "main" or "exports" but depends on a UI framework',
      ],
      [
        "an application from detected React components",
        "application",
        {
          kind: "react-component-detection",
          certainty: "inferred",
          location: { filePath: "src/App.tsx" },
          description: "3 React component(s) were detected in source.",
        },
        "axios is a JavaScript/TypeScript application [inferred], because React components were found (e.g. src/App.tsx)",
      ],
      [
        "an unrecognized evidence kind, by its stored description",
        "package",
        {
          kind: "some-future-signal",
          certainty: "inferred",
          description: "A future signal suggested a package.",
        },
        "axios is a JavaScript/TypeScript package [inferred] (A future signal suggested a package.)",
      ],
    ])("gives the reason for %s", (_, kind, evidence, expected) => {
      expect(
        line(
          lore({ projects: [project({ kind, evidence: [evidence] })] }),
          "kind"
        )
      ).toBe(expected);
    });

    it("says an unknown kind is Unknown instead of omitting the line", () => {
      const unknown = project({
        name: "scripts",
        kind: "unknown",
        languages: ["python"],
        evidence: [],
      });
      expect(line(lore({ projects: [unknown] }), "kind")).toBe(
        "axios (Python): whether it is an application or a library could not be determined [unknown]"
      );
    });

    it("lists every language project of a mixed repository, by language, rather than picking one", () => {
      expect(line(lore({ projects: MIXED_PROJECTS }), "kind")).toBe(
        'Analyzed as 2 language projects:\nThe TypeScript project is a library [inferred], because package.json declares "main" or "exports" and no bootstrap, CLI, UI framework dependency, or React components were found\nThe Python project is an application [inferred], because a bootstrap or command-line entry point was found at tool/cli.py'
      );
      const kind = buildAtAGlance(lore({ projects: MIXED_PROJECTS }))[0];
      expect(kind.parts.filter((p) => p.type === "group")).toHaveLength(2);
    });

    it("says no project was identified when there is none", () => {
      expect(line(lore({ projects: [] }), "kind")).toBe(
        "No project could be identified in this repository [unknown]"
      );
    });
  });

  describe("entry line", () => {
    it("names a library's declared public entry point with that entry point's certainty", () => {
      expect(
        line(lore({ entryPoints: [entry("library", "index.js")] }), "entry")
      ).toBe("Its declared public entry point is index.js [detected]");
    });

    it("prefers an application bootstrap over library entries, as Start Here's seed does", () => {
      const entryPoints = [
        entry("library", "src/lib.ts"),
        entry("bootstrap", "src/index.tsx", "inferred"),
      ];
      expect(line(lore({ entryPoints }), "entry")).toBe(
        "Its application bootstrap entry point is src/index.tsx [inferred]"
      );
    });

    it("counts additional starting entry points instead of dropping them", () => {
      const entryPoints = [
        entry("cli", "src/pyapp/cli.py"),
        entry("cli", "src/pyapp/__main__.py"),
        entry("library", "src/pyapp/__init__.py"),
      ];
      expect(line(lore({ entryPoints }), "entry")).toBe(
        "Its command-line entry points include src/pyapp/cli.py [detected] and 1 more"
      );
    });

    it("uses a neutral label when the starting entry points are of mixed kinds", () => {
      const entryPoints = [entry("bootstrap", "a.ts"), entry("cli", "b.ts")];
      expect(line(lore({ entryPoints }), "entry")).toBe(
        "Its application entry points include a.ts [detected] and 1 more"
      );
    });

    it("says no starting entry point was detected, pointing at the other kinds that were", () => {
      const entryPoints = [
        entry("route", "src/app/page.tsx"),
        entry("route", "src/app/layout.tsx"),
        entry("http-handler", "src/app/api/health/route.ts"),
      ];
      expect(line(lore({ entryPoints }), "entry")).toBe(
        "No bootstrap, command-line, library, or runtime entry point was detected [unknown]; 3 other entry points (route, http-handler) were found."
      );
    });

    it("says no entry point was detected at all", () => {
      expect(line(lore(), "entry")).toBe(
        "No bootstrap, command-line, library, or runtime entry point was detected [unknown]"
      );
    });

    it("links further starting entry points to the Entry Points list, badging only the one it names", () => {
      const entryPoints = Array.from({ length: 300 }, (_, i) =>
        entry("bootstrap", `scripts/s${i}.py`)
      );
      const parts = buildAtAGlance(lore({ entryPoints })).find(
        (x) => x.id === "entry"
      )!.parts;
      expect(render({ id: "entry", parts })).toBe(
        "Its application bootstrap entry points include scripts/s0.py [detected] and 299 more"
      );
      expect(parts.at(-1)).toEqual({
        type: "anchor",
        href: "#entry-points",
        text: "299 more",
      });
    });

    it("seeds each language project separately, as Start Here does, so one project's CLI doesn't hide another's library entry", () => {
      const l = lore({
        projects: MIXED_PROJECTS,
        entryPoints: [
          entry("library", "src/index.ts"),
          entry("cli", "tool/cli.py"),
        ],
        structuralAreas: [
          area("src", { entryPointIds: ["library:src/index.ts"] }),
          area("tool", {
            projectId: "python",
            entryPointIds: ["cli:tool/cli.py"],
          }),
        ],
      });
      expect(line(l, "entry")).toBe(
        "\nThe TypeScript project's declared public entry point is src/index.ts [detected]\nThe Python project's command-line entry point is tool/cli.py [detected]"
      );
    });

    it("says which language project has no starting entry point", () => {
      const l = lore({
        projects: MIXED_PROJECTS,
        entryPoints: [entry("library", "src/index.ts")],
        structuralAreas: [
          area("src", { entryPointIds: ["library:src/index.ts"] }),
        ],
      });
      expect(line(l, "entry")).toBe(
        "\nThe TypeScript project's declared public entry point is src/index.ts [detected]\nThe Python project: no bootstrap, command-line, library, or runtime entry point was detected [unknown]"
      );
    });
  });

  describe("areas line", () => {
    it("names the top three implementation areas by detected relationships, with their counts", () => {
      const structuralAreas = [
        area("."),
        area("docs"),
        area("lib", { dependencies: 6, dependents: 6 }),
        area("lib/adapters", { dependencies: 7, dependents: 1 }),
        area("lib/core", { dependencies: 4, dependents: 9 }),
        area("lib/helpers", { dependencies: 2, dependents: 9 }),
        area("test", { dependencies: 20, responsibility: "Tests" }),
      ];
      expect(line(lore({ structuralAreas }), "areas")).toBe(
        "The areas with the most detected direct relationships (depends on + imported by) are lib/core (13), lib (12) and lib/helpers (11)."
      );
    });

    it("doesn't name an area with no detected relationships", () => {
      const structuralAreas = [area("src", { dependents: 1 }), area("docs")];
      expect(line(lore({ structuralAreas }), "areas")).toBe(
        "The area with the most detected direct relationships (depends on + imported by) is src (1)."
      );
    });

    it("says no relationships were detected rather than ranking unrelated areas", () => {
      const structuralAreas = [area("src"), area("lib")];
      expect(line(lore({ structuralAreas }), "areas")).toBe(
        "No direct relationships between major areas were detected [unknown]"
      );
    });

    it("doesn't claim no relationships were detected when only test areas have them", () => {
      const structuralAreas = [
        area("src"),
        area("test", { dependencies: 3, responsibility: "Tests" }),
      ];
      expect(line(lore({ structuralAreas }), "areas")).toBe(
        "No direct relationships of implementation areas were detected [unknown]"
      );
    });

    it("says no major areas were identified when only the root area exists", () => {
      expect(line(lore({ structuralAreas: [area(".")] }), "areas")).toBe(
        "No major areas were identified [unknown]"
      );
    });
  });

  describe("counts line", () => {
    it("counts major areas, external dependencies by production scope, and gaps", () => {
      const l = lore({
        structuralAreas: [area("."), area("lib"), area("test")],
        externalDependencies: [
          dependency("direct"),
          dependency("dev"),
          dependency("dev"),
          dependency("peer"),
        ],
        gaps: [{} as Gap, {} as Gap],
      });
      expect(line(l, "counts")).toBe(
        "2 major areas · 4 external dependencies (1 production) · 2 recorded gaps View gaps"
      );
      expect(
        buildAtAGlance(l)
          .find((x) => x.id === "counts")!
          .parts.find((p) => p.type === "anchor")
      ).toEqual({ type: "anchor", href: "#gaps", text: "View gaps" });
    });

    it("uses singular forms and omits the gaps link when there are no gaps", () => {
      const l = lore({
        structuralAreas: [area("lib")],
        externalDependencies: [dependency("direct")],
      });
      expect(line(l, "counts")).toBe(
        "1 major area · 1 external dependency (1 production) · 0 recorded gaps"
      );
    });
  });
});

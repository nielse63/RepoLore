import { majorAreasOf, rankMajorAreas } from "./major-areas";
import type {
  CertaintyCategory,
  EntryPoint,
  Evidence,
  Language,
  Lore,
  Project,
  SourceLocation,
  StructuralArea,
} from "./model";
import { classifySystem } from "./system-classification";

/**
 * One piece of an "At a glance" line (GitHub issue #59). Lines are returned
 * as structured parts rather than prose strings so the Overview renders
 * certainty badges, source links, and area links the same way it does
 * everywhere else, and so each claim stays attached to its own certainty.
 */
export type AtAGlancePart =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "certainty"; certainty: CertaintyCategory }
  /** A file supporting a claim, linked to source (`kind: "source"`) or to the area subview (`kind: "area"`). */
  | { type: "location"; location: SourceLocation; kind: "source" | "area" }
  /** An in-page anchor to the Overview section holding the full list. */
  | { type: "anchor"; href: string; text: string }
  /**
   * One language project's clause, rendered on its own row so a
   * mixed-language repository's line (ADR-0007) stays readable instead of
   * running several projects together in one sentence.
   */
  | { type: "group"; parts: AtAGlancePart[] };

export interface AtAGlanceLine {
  id: "kind" | "entry" | "areas" | "counts";
  parts: AtAGlancePart[];
}

const LANGUAGE_NAMES: Record<Language, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
};

/** Mirrors Start Here's seed step (`src/analysis/shared/derive-views.ts`). */
const STARTING_ENTRY_KINDS: ReadonlyArray<EntryPoint["kind"]> = [
  "bootstrap",
  "cli",
];
const PUBLIC_ENTRY_KINDS: ReadonlyArray<EntryPoint["kind"]> = [
  "library",
  "runtime",
];

const ENTRY_KIND_LABELS: Partial<Record<EntryPoint["kind"], string>> = {
  bootstrap: "application bootstrap entry point",
  cli: "command-line entry point",
  library: "declared public entry point",
  runtime: "conventional runtime entry point",
};

const MAX_LISTED_AREAS = 3;

const text = (value: string): AtAGlancePart => ({ type: "text", text: value });
const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/** "A, B and C" over already-built part groups. */
function joinParts(groups: AtAGlancePart[][]): AtAGlancePart[] {
  return groups.flatMap((group, i) => [
    ...(i === 0 ? [] : [text(i === groups.length - 1 ? " and " : ", ")]),
    ...group,
  ]);
}

/** Capitalizes a clause's first word, for a clause that starts a sentence or row. */
function capitalized(parts: AtAGlancePart[]): AtAGlancePart[] {
  const [lead, ...rest] = parts;
  if (lead?.type !== "text" && lead?.type !== "strong") return parts;
  return [
    { ...lead, text: lead.text.charAt(0).toUpperCase() + lead.text.slice(1) },
    ...rest,
  ];
}

const languagesOf = (project: Project) =>
  project.languages.map((language) => LANGUAGE_NAMES[language]).join("/");

/**
 * How a clause names a project. A project's own `name` falls back to the
 * extraction directory's basename when its manifest declares none — always
 * the internal literal "source" (`extract-tarball.ts`) — so, as on the
 * Architecture page, a single project is named by the repository. ADR-0007's
 * per-language projects all share the repository root, so several are named
 * by language rather than as if they were separate packages.
 */
function projectSubject(project: Project, projects: Project[], repo: string) {
  if (projects.length === 1) return repo;
  return `the ${languagesOf(project) || "unknown-language"} project`;
}

const location = (loc: SourceLocation): AtAGlancePart => ({
  type: "location",
  location: loc,
  kind: "source",
});

/**
 * Why the extractor classified the project this way, from its kind
 * evidence (`inferProjectKind` in `src/analysis/js-ts/extract-project.ts`
 * and `src/analysis/python/extract-project.ts`), in a few words so the
 * reader can judge the guess. The no-"main"/"exports" fallback is a default
 * assumption rather than a positive signal, and says so. Any other or future
 * evidence kind falls back to the evidence's own stored description.
 */
function kindReason(project: Project, evidence: Evidence): AtAGlancePart[] {
  const loc = evidence.location;
  const isApplication = project.kind === "application";
  if (loc) {
    switch (evidence.kind) {
      case "entry-point-shape":
        return isApplication
          ? [
              text(
                ", because a bootstrap or command-line entry point was found at "
              ),
              location(loc),
            ]
          : [
              text(", because "),
              location(loc),
              text(
                " is the package its declared project name resolves to, and no bootstrap or console-script entry point was found"
              ),
            ];
      case "package-json-entry-field-shape":
        return isApplication
          ? [
              text(", assumed because "),
              location(loc),
              text(' declares neither "main" nor "exports"'),
            ]
          : [
              text(", because "),
              location(loc),
              text(
                ' declares "main" or "exports" and no bootstrap, CLI, UI framework dependency, or React components were found'
              ),
            ];
      case "framework-dependency":
        return [
          text(", because "),
          location(loc),
          text(' declares "main" or "exports" but depends on a UI framework'),
        ];
      case "react-component-detection":
        return [
          text(", because React components were found (e.g. "),
          location(loc),
          text(")"),
        ];
    }
  }
  return [text(` (${evidence.description})`)];
}

/**
 * The project's kind claim. Both extractors' kind classification is a
 * heuristic over entry-point and manifest shape whose evidence is always
 * recorded as `inferred` (framework detection evidence is `detected` and
 * isn't about kind), so the claim is labeled Inferred, gives that
 * evidence's reason (`kindReason`), and is `unknown` when no kind was
 * established — never `detected`.
 */
function projectClause(
  project: Project,
  projects: Project[],
  repo: string
): AtAGlancePart[] {
  const single = projects.length === 1;
  const subject = projectSubject(project, projects, repo);
  const languages = languagesOf(project);
  if (project.kind === "unknown") {
    return [
      { type: "strong", text: subject },
      text(
        `${single && languages ? ` (${languages})` : ""}: whether it is an application or a library could not be determined `
      ),
      { type: "certainty", certainty: "unknown" },
    ];
  }

  const kindEvidence = project.evidence.find((e) => e.certainty === "inferred");
  const noun =
    single && languages ? `${languages} ${project.kind}` : project.kind;
  const article = /^[aeiou]/i.test(noun) ? "an" : "a";
  return [
    { type: "strong", text: subject },
    text(` is ${article} ${noun} `),
    { type: "certainty", certainty: "inferred" },
    ...(kindEvidence ? kindReason(project, kindEvidence) : []),
  ];
}

function kindLine(projects: Project[], repo: string): AtAGlanceLine {
  if (projects.length === 0) {
    return {
      id: "kind",
      parts: [
        text("No project could be identified in this repository "),
        { type: "certainty", certainty: "unknown" },
      ],
    };
  }
  if (projects.length === 1) {
    return { id: "kind", parts: projectClause(projects[0], projects, repo) };
  }
  // ADR-0007 runs one analyzer per language over the same root; list every
  // resulting project rather than silently picking one.
  return {
    id: "kind",
    parts: [
      text(`Analyzed as ${projects.length} language projects:`),
      ...projects.map((project): AtAGlancePart => ({
        type: "group",
        parts: capitalized(projectClause(project, projects, repo)),
      })),
    ],
  };
}

/** Start Here's seed step, applied to one project's entry points. */
function seedEntriesOf(entryPoints: EntryPoint[]) {
  const applicationEntries = entryPoints.filter((ep) =>
    STARTING_ENTRY_KINDS.includes(ep.kind)
  );
  return applicationEntries.length > 0
    ? applicationEntries
    : entryPoints.filter((ep) => PUBLIC_ENTRY_KINDS.includes(ep.kind));
}

const NO_SEED_ENTRY =
  "no bootstrap, command-line, library, or runtime entry point was detected ";

/**
 * One project's starting entry point. The badge follows the named file — it
 * is that entry point's own certainty — and any further seeds are counted
 * with a link to the full Entry Points list rather than implied to share it.
 */
function entryClause(seeds: EntryPoint[], possessive: string): AtAGlancePart[] {
  const [first] = seeds;
  const sameKind = seeds.every((ep) => ep.kind === first.kind);
  const label = sameKind
    ? ENTRY_KIND_LABELS[first.kind]!
    : STARTING_ENTRY_KINDS.includes(first.kind)
      ? "application entry point"
      : "public entry point";
  const more = seeds.length - 1;
  return [
    text(
      more === 0
        ? `${possessive} ${label} is `
        : `${possessive} ${label}s include `
    ),
    { type: "location", location: first.location, kind: "source" },
    text(" "),
    { type: "certainty", certainty: first.certainty },
    ...(more > 0
      ? [
          text(" and "),
          {
            type: "anchor" as const,
            href: "#entry-points",
            text: `${more} more`,
          },
        ]
      : []),
  ];
}

/**
 * Entry points carry no project id, so a project's entry points are the ones
 * its own structural areas own — the same per-project grouping Start Here's
 * seed step runs over before `mergeStartHere` combines projects.
 */
function entryPointsOfProject(project: Project, lore: Lore): EntryPoint[] {
  const ids = new Set(
    lore.structuralAreas
      .filter((area) => area.projectId === project.id)
      .flatMap((area) => area.entryPointIds)
  );
  return lore.entryPoints.filter((ep) => ids.has(ep.id));
}

function entryLine(lore: Lore): AtAGlanceLine {
  const { projects, entryPoints } = lore;
  const perProject =
    projects.length > 1
      ? projects.map((project) => ({
          project,
          seeds: seedEntriesOf(entryPointsOfProject(project, lore)),
        }))
      : [{ project: projects[0], seeds: seedEntriesOf(entryPoints) }];

  if (perProject.every(({ seeds }) => seeds.length === 0)) {
    const others = [...new Set(entryPoints.map((ep) => ep.kind))];
    return {
      id: "entry",
      parts: [
        text(NO_SEED_ENTRY.charAt(0).toUpperCase() + NO_SEED_ENTRY.slice(1)),
        { type: "certainty", certainty: "unknown" },
        ...(entryPoints.length > 0
          ? [
              text("; "),
              {
                type: "anchor" as const,
                href: "#entry-points",
                text: plural(
                  entryPoints.length,
                  "other entry point",
                  "other entry points"
                ),
              },
              text(
                ` (${others.join(", ")}) ${entryPoints.length === 1 ? "was" : "were"} found.`
              ),
            ]
          : []),
      ],
    };
  }

  if (perProject.length === 1) {
    return { id: "entry", parts: entryClause(perProject[0].seeds, "Its") };
  }
  return {
    id: "entry",
    parts: perProject.map(({ project, seeds }): AtAGlancePart => {
      const subject = projectSubject(project, projects, "");
      return {
        type: "group",
        parts: capitalized(
          seeds.length > 0
            ? entryClause(seeds, `${subject}'s`)
            : [
                text(`${subject}: ${NO_SEED_ENTRY}`),
                { type: "certainty", certainty: "unknown" },
              ]
        ),
      };
    }),
  };
}

const relationshipCount = (area: StructuralArea) =>
  area.directDependencyIds.length + area.directDependentIds.length;

/**
 * The top implementation areas by the same detected-relationship ranking the
 * Major Areas list uses (GitHub issue #48), with each area's count shown so
 * the claim is checkable against its card. Only areas with at least one
 * detected relationship are named; a 0 can mean "unresolved", not "none".
 */
function areasLine(areas: StructuralArea[]): AtAGlanceLine {
  const majorAreas = majorAreasOf(areas);
  if (majorAreas.length === 0) {
    return {
      id: "areas",
      parts: [
        text("No major areas were identified "),
        { type: "certainty", certainty: "unknown" },
      ],
    };
  }
  const connected = rankMajorAreas(majorAreas)
    .filter(
      (area) =>
        classifySystem(area) === "Implementation area" &&
        relationshipCount(area) > 0
    )
    .slice(0, MAX_LISTED_AREAS);
  if (connected.length === 0) {
    return {
      id: "areas",
      parts: [
        text(
          majorAreas.some((area) => relationshipCount(area) > 0)
            ? "No direct relationships of implementation areas were detected "
            : "No direct relationships between major areas were detected "
        ),
        { type: "certainty", certainty: "unknown" },
      ],
    };
  }
  return {
    id: "areas",
    parts: [
      text(
        connected.length === 1
          ? "The area with the most detected direct relationships (depends on + imported by) is "
          : "The areas with the most detected direct relationships (depends on + imported by) are "
      ),
      ...joinParts(
        connected.map((area) => [
          { type: "location", location: area.location, kind: "area" },
          text(` (${relationshipCount(area)})`),
        ])
      ),
      text("."),
    ],
  };
}

function countsLine(lore: Lore): AtAGlanceLine {
  const majorAreaCount = majorAreasOf(lore.structuralAreas).length;
  const dependencies = lore.externalDependencies;
  const production = dependencies.filter((d) => d.scope === "direct").length;
  const gaps = lore.gaps.length;
  return {
    id: "counts",
    parts: [
      text(
        [
          plural(majorAreaCount, "major area", "major areas"),
          `${plural(dependencies.length, "external dependency", "external dependencies")} (${production} production)`,
          plural(gaps, "recorded gap", "recorded gaps"),
        ].join(" · ")
      ),
      ...(gaps > 0
        ? [
            text(" "),
            { type: "anchor" as const, href: "#gaps", text: "View gaps" },
          ]
        : []),
    ],
  };
}

/**
 * The Overview's "At a glance" block (GitHub issue #59): answers "what kind
 * of system is this?" and "where does execution probably begin?" in at most
 * four lines, as templates over facts already in the stored Lore — no AI,
 * no new analysis. Missing facts are stated with the Unknown category
 * rather than omitted.
 */
export function buildAtAGlance(lore: Lore): AtAGlanceLine[] {
  return [
    kindLine(lore.projects, lore.snapshot.repository.name),
    entryLine(lore),
    areasLine(lore.structuralAreas),
    countsLine(lore),
  ];
}

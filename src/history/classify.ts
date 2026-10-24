/**
 * Deterministic (non-AI) classification of commit diffs into `HistoryEntry`
 * facts, per ADR-0010.
 * Everything here is regex/path-convention matching over commit patch text —
 * not real parsing (the ts-morph/tree-sitter analyzers own that) — so every
 * fact this module produces carries `certainty: "inferred"` or `"unknown"`,
 * never `"detected"`. Under-detecting (missing a multi-line or aliased
 * import, an unusual manifest format) is the accepted failure mode; a false
 * positive that overclaims a relationship is not.
 */

import type {
  CommitDetail,
  CommitFileChange,
  CommitSummary,
} from "@/github/commits";
import type { Lore, StructuralArea } from "@/lore/model";
import type {
  HistoryChangeFact,
  HistoryChangeKind,
  HistoryCommitRef,
  HistoryEntry,
} from "./model";

const DEPENDENCY_MANIFEST_RE =
  /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|requirements[\w.-]*\.txt|pyproject\.toml|poetry\.lock|go\.mod|go\.sum)$/;

const PACKAGE_JSON_RE = /(^|\/)package\.json$/;

const NPM_LOCKFILE_RE = /(^|\/)package-lock\.json$/;

/** JS lockfiles whose line formats this module doesn't parse. */
const UNPARSED_LOCKFILE_RE = /(^|\/)(pnpm-lock\.yaml|yarn\.lock)$/;

const PACKAGE_JSON_DEPENDENCY_SECTIONS = new Set([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]);

/** An object opening line: keyed (`"name": {`, `""` for npm's root entry) or anonymous (`{`, as in a `funding` array). */
const JSON_OBJECT_OPEN_RE = /^\s*(?:"([^"]*)":\s*)?\{\s*$/;
const JSON_OBJECT_CLOSE_RE = /^\s*\},?\s*$/;

/**
 * Shapes of a `package.json` dependency value (semver range, dist-tag,
 * protocol). Only consulted when no enclosing object is visible, to keep
 * `scripts` commands and top-level fields out.
 */
const DEPENDENCY_SPEC_RE =
  /^(?:[\^~<>=*]|\d|v\d|x(?:\.|$)|latest$|next$|workspace:|npm:|file:|link:|git[+:]|github:)/;

const DATA_LAYER_PATH_RE =
  /(^|\/)(models?|migrations?|schema\w*|db|database)(\/|$)/i;

const PACKAGE_JSON_IGNORED_KEYS = new Set([
  "name",
  "version",
  "description",
  "main",
  "module",
  "types",
  "scripts",
  "license",
  "private",
  "author",
  "repository",
  "engines",
]);

/** Longest-prefix match of a changed file's path against known `StructuralArea` locations. */
export function resolveAreaForPath(
  lore: Lore,
  filePath: string
): StructuralArea | undefined {
  let best: StructuralArea | undefined;
  let bestLength = -1;
  for (const area of lore.structuralAreas) {
    const areaPath = area.location.filePath;
    const isRoot = areaPath === ".";
    const matches = isRoot || filePath.startsWith(`${areaPath}/`);
    if (matches && areaPath.length > bestLength) {
      best = area;
      bestLength = areaPath.length;
    }
  }
  return best;
}

function patchLines(patch: string): { sign: "+" | "-"; body: string }[] {
  return patch
    .split("\n")
    .filter(
      (line) =>
        (line.startsWith("+") || line.startsWith("-")) && !line.startsWith("@@")
    )
    .map((line) => ({ sign: line[0] as "+" | "-", body: line.slice(1) }));
}

/**
 * Changed lines of a JSON file's patch, each with the keys of the JSON
 * objects enclosing it, outermost first, as far as the hunk's context shows
 * them. The old (`-`) and new (`+`) sides are tracked separately, both
 * reading context lines. Anonymous objects are `null`. An empty `enclosing`
 * means no enclosing object was visible in the hunk, not that the line is
 * at the top level.
 */
function jsonPatchLines(
  patch: string
): { sign: "+" | "-"; body: string; enclosing: (string | null)[] }[] {
  const results: {
    sign: "+" | "-";
    body: string;
    enclosing: (string | null)[];
  }[] = [];
  let oldStack: (string | null)[] = [];
  let newStack: (string | null)[] = [];
  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      oldStack = [];
      newStack = [];
      continue;
    }
    if (line.startsWith("\\")) continue;
    const sign = line[0];
    const body = line.slice(1);
    const stacks =
      sign === "+"
        ? [newStack]
        : sign === "-"
          ? [oldStack]
          : [oldStack, newStack];
    if (sign === "+" || sign === "-") {
      results.push({ sign, body, enclosing: [...stacks[0]] });
    }
    const open = body.match(JSON_OBJECT_OPEN_RE);
    for (const stack of stacks) {
      if (open) stack.push(open[1] ?? null);
      else if (JSON_OBJECT_CLOSE_RE.test(body)) stack.pop();
    }
  }
  return results;
}

function unknownDependencyFact(
  file: CommitFileChange,
  reason: string
): HistoryChangeFact {
  return {
    kind: "dependency",
    certainty: "unknown",
    description: `${file.filePath} changed (${reason})`,
    filePath: file.filePath,
  };
}

/**
 * One summary fact per `package-lock.json` diff: the number of distinct
 * `node_modules/…` package entries containing a changed line. Every other
 * line (`resolved`, `integrity`, nested `engines`/`dependencies` ranges) is
 * lockfile detail, not a dependency change in its own right. A changed line
 * whose entry header falls outside its hunk can't be attributed, so the
 * count is then a lower bound ("at least N"); lines inside the root `""`
 * entry are the project's own, not a package's.
 */
function scanNpmLockfileFacts(
  file: CommitFileChange,
  patch: string
): HistoryChangeFact[] {
  const entries = new Set<string>();
  let unattributed = false;
  for (const { body, enclosing } of jsonPatchLines(patch)) {
    const open = body.match(JSON_OBJECT_OPEN_RE);
    const entry = [...enclosing, open?.[1] ?? null]
      .reverse()
      .find((key) => key?.startsWith("node_modules/"));
    if (entry) entries.add(entry);
    else if (!enclosing.includes("")) unattributed = true;
  }
  if (entries.size === 0) {
    return [
      unknownDependencyFact(file, "no package entries identified in the diff"),
    ];
  }
  return [
    {
      kind: "dependency",
      certainty: "inferred",
      description: `${unattributed ? "at least " : ""}${entries.size} package${
        entries.size === 1 ? "" : "s"
      } changed in ${file.filePath}`,
      filePath: file.filePath,
    },
  ];
}

function scanDependencyFacts(file: CommitFileChange): HistoryChangeFact[] {
  if (!file.patch) {
    return [unknownDependencyFact(file, "diff too large to inspect")];
  }
  if (UNPARSED_LOCKFILE_RE.test(file.filePath)) {
    return [unknownDependencyFact(file, "lockfile contents not inspected")];
  }
  if (NPM_LOCKFILE_RE.test(file.filePath)) {
    return scanNpmLockfileFacts(file, file.patch);
  }

  const isPackageJson = PACKAGE_JSON_RE.test(file.filePath);
  const isPoetryLock = /(^|\/)poetry\.lock$/.test(file.filePath);
  const facts: HistoryChangeFact[] = [];
  const lines = isPackageJson
    ? jsonPatchLines(file.patch)
    : patchLines(file.patch).map((line) => ({ ...line, enclosing: [] }));
  for (const { sign, body, enclosing } of lines) {
    let name: string | undefined;
    if (isPackageJson) {
      // A visible enclosing object must be a dependency section; with none
      // visible (a hunk starting mid-section), fall back to the key list
      // and a dependency-shaped value.
      const sectionVisible = enclosing.length > 0;
      const inDependencySection =
        enclosing.length === 1 &&
        PACKAGE_JSON_DEPENDENCY_SECTIONS.has(enclosing[0] ?? "");
      if (sectionVisible && !inDependencySection) continue;
      const m = body.match(/^\s*"([^"]+)":\s*"([^"]+)"\s*,?\s*$/);
      if (
        m &&
        !PACKAGE_JSON_IGNORED_KEYS.has(m[1]) &&
        (sectionVisible || DEPENDENCY_SPEC_RE.test(m[2]))
      ) {
        name = m[1];
      }
    } else if (isPoetryLock) {
      const m = body.match(/^\s*name\s*=\s*"([^"]+)"/);
      if (m) name = m[1];
    } else {
      const m = body.match(/^\s*([A-Za-z0-9][A-Za-z0-9_.-]*)/);
      if (m && m[1].length > 1) name = m[1];
    }
    if (!name) continue;
    facts.push({
      kind: "dependency",
      certainty: "inferred",
      description:
        sign === "+"
          ? `${name} added in ${file.filePath}`
          : `${name} removed from ${file.filePath}`,
      filePath: file.filePath,
    });
  }
  return facts;
}

function resolveRelativeImportPath(
  fromFilePath: string,
  specifier: string
): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const dir = fromFilePath.includes("/")
    ? fromFilePath.slice(0, fromFilePath.lastIndexOf("/"))
    : "";
  const parts = dir.split("/").filter(Boolean);
  for (const segment of specifier.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

function scanImportSpecifiers(
  patch: string
): { sign: "+" | "-"; specifier: string }[] {
  const results: { sign: "+" | "-"; specifier: string }[] = [];
  for (const { sign, body } of patchLines(patch)) {
    const js =
      body.match(/import\s[\s\S]*?from\s+['"]([^'"]+)['"]/) ??
      body.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
    if (js) {
      results.push({ sign, specifier: js[1] });
      continue;
    }
    const py =
      body.match(/^\s*from\s+(\.[\w.]*)\s+import/) ??
      body.match(/^\s*import\s+(\.[\w.]*)/);
    if (py) results.push({ sign, specifier: py[1] });
  }
  return results;
}

function scanArchitectureFacts(
  file: CommitFileChange,
  lore: Lore
): HistoryChangeFact[] {
  if (!file.patch) return [];
  const fromArea = resolveAreaForPath(lore, file.filePath);
  if (!fromArea) return [];

  const facts: HistoryChangeFact[] = [];
  for (const { sign, specifier } of scanImportSpecifiers(file.patch)) {
    const targetPath = resolveRelativeImportPath(file.filePath, specifier);
    if (!targetPath) continue;
    const toArea = resolveAreaForPath(lore, targetPath);
    if (!toArea || toArea.id === fromArea.id) continue;
    facts.push({
      kind: "architecture",
      certainty: "inferred",
      description:
        sign === "+"
          ? `${fromArea.name} now depends on ${toArea.name}`
          : `${fromArea.name} no longer depends on ${toArea.name}`,
      filePath: file.filePath,
      areaName: fromArea.name,
    });
  }
  return facts;
}

function scanDataFlowFacts(
  file: CommitFileChange,
  lore: Lore
): HistoryChangeFact[] {
  if (!DATA_LAYER_PATH_RE.test(file.filePath)) return [];
  const area = resolveAreaForPath(lore, file.filePath);
  return [
    {
      kind: "data-flow",
      certainty: "inferred",
      description: `Data-layer file changed: ${file.filePath}`,
      filePath: file.filePath,
      areaName: area?.name,
    },
  ];
}

/** All facts this commit's changed files support, across every `HistoryChangeKind`. */
export function classifyCommitFiles(
  files: CommitFileChange[],
  lore: Lore
): HistoryChangeFact[] {
  const facts: HistoryChangeFact[] = [];
  for (const file of files) {
    if (DEPENDENCY_MANIFEST_RE.test(file.filePath)) {
      facts.push(...scanDependencyFacts(file));
    }
    facts.push(...scanArchitectureFacts(file, lore));
    facts.push(...scanDataFlowFacts(file, lore));
  }
  return facts;
}

export interface ClassifiedCommit {
  commit: CommitSummary;
  facts: HistoryChangeFact[];
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

const KIND_PRIORITY: HistoryChangeKind[] = [
  "architecture",
  "dependency",
  "data-flow",
];

function primaryKind(facts: HistoryChangeFact[]): HistoryChangeKind {
  const counts = new Map<HistoryChangeKind, number>();
  for (const fact of facts)
    counts.set(fact.kind, (counts.get(fact.kind) ?? 0) + 1);
  return KIND_PRIORITY.find((kind) => counts.has(kind)) ?? "architecture";
}

function primaryArea(facts: HistoryChangeFact[]): string {
  const counts = new Map<string, number>();
  for (const fact of facts) {
    if (!fact.areaName) continue;
    counts.set(fact.areaName, (counts.get(fact.areaName) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = -1;
  for (const [area, count] of counts) {
    if (count > bestCount) {
      best = area;
      bestCount = count;
    }
  }
  return best ?? facts[0]?.filePath ?? "repository";
}

/**
 * Groups consecutive same-day commits (in the newest-first order the GitHub
 * API returns) that share a primary affected area into one entry. Commits
 * with no classifiable fact are dropped, not erroring the whole compute.
 */
export function groupIntoEntries(classified: ClassifiedCommit[]): {
  groupKey: string;
  commits: ClassifiedCommit[];
}[] {
  const withFacts = classified.filter((c) => c.facts.length > 0);
  const groups: { groupKey: string; commits: ClassifiedCommit[] }[] = [];

  for (const entry of withFacts) {
    const key = `${dateKey(entry.commit.authoredAt)}::${primaryArea(entry.facts)}`;
    const last = groups[groups.length - 1];
    if (last && last.groupKey === key) {
      last.commits.push(entry);
    } else {
      groups.push({ groupKey: key, commits: [entry] });
    }
  }
  return groups;
}

function toTitle(description: string): string {
  return description.charAt(0).toUpperCase() + description.slice(1);
}

/** Builds the human-readable `HistoryEntry` fields from a group's structured facts — fixed templates, no free-form prose. */
export function describeEntry(group: {
  groupKey: string;
  commits: ClassifiedCommit[];
}): HistoryEntry {
  const allFacts = group.commits.flatMap((c) => c.facts);
  const kind = primaryKind(allFacts);
  const kindFacts = allFacts.filter((f) => f.kind === kind);
  const leadFact = kindFacts[0] ?? allFacts[0];

  const whatChanged = [...new Set(allFacts.map((f) => toTitle(f.description)))];
  const affectedAreas = [
    ...new Set(allFacts.map((f) => f.areaName).filter((a): a is string => !!a)),
  ];

  const kindLabel: Record<HistoryChangeKind, string> = {
    architecture: "architecture-related",
    dependency: "dependency",
    "data-flow": "data-layer",
  };

  const commits: HistoryCommitRef[] = group.commits.map((c) => ({
    sha: c.commit.sha,
    message: c.commit.message,
    authorName: c.commit.authorName,
    authorLogin: c.commit.authorLogin,
    authoredAt: c.commit.authoredAt,
  }));
  const occurredAt = commits.reduce(
    (latest, c) => (c.authoredAt > latest ? c.authoredAt : latest),
    commits[0].authoredAt
  );

  return {
    id: group.commits[0].commit.sha,
    kind,
    title: toTitle(leadFact.description),
    summary: toTitle(leadFact.description),
    whatChanged,
    whyNoticed: `Detected ${kindFacts.length} ${kindLabel[kind]} change${
      kindFacts.length === 1 ? "" : "s"
    } across ${commits.length} commit${commits.length === 1 ? "" : "s"}.`,
    affectedAreas,
    occurredAt,
    commits,
    primaryFilePath: leadFact.filePath,
    facts: allFacts,
  };
}

/** Convenience wrapper combining classification, grouping, and description for one repo's fetched commits. */
export function buildHistoryEntries(
  commitDetails: { commit: CommitSummary; detail: CommitDetail }[],
  lore: Lore
): HistoryEntry[] {
  const classified: ClassifiedCommit[] = commitDetails.map(
    ({ commit, detail }) => ({
      commit,
      facts: classifyCommitFiles(detail.files, lore),
    })
  );
  return groupIntoEntries(classified).map(describeEntry);
}

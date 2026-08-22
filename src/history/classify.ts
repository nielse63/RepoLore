/**
 * Deterministic (non-AI) classification of commit diffs into `HistoryEntry`
 * facts, per docs/architecture/decisions/0010-history-page-real-data-scope.md.
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

const PACKAGE_JSON_RE =
  /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock)$/;

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

function scanDependencyFacts(file: CommitFileChange): HistoryChangeFact[] {
  if (!file.patch) {
    return [
      {
        kind: "dependency",
        certainty: "unknown",
        description: `${file.filePath} changed (diff too large to inspect)`,
        filePath: file.filePath,
      },
    ];
  }

  const isPackageJson = PACKAGE_JSON_RE.test(file.filePath);
  const isPoetryLock = /(^|\/)poetry\.lock$/.test(file.filePath);
  const facts: HistoryChangeFact[] = [];
  for (const { sign, body } of patchLines(file.patch)) {
    let name: string | undefined;
    if (isPackageJson) {
      const m = body.match(/^\s*"([^"]+)":\s*"[^"]+"\s*,?\s*$/);
      if (m && !PACKAGE_JSON_IGNORED_KEYS.has(m[1])) name = m[1];
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

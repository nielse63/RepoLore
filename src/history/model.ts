/**
 * The History page's data model — deliberately separate from
 * `src/lore/model.ts`. That model represents ts-morph/tree-sitter
 * deterministic syntactic analysis; this one represents heuristic
 * classification of commit patch text (regex-based import detection,
 * manifest-diff parsing, path-convention matching). Keeping the two apart
 * preserves the certainty distinction the app makes everywhere else —
 * nothing here should be presented with the same rigor as the core `Lore`
 * model. See docs/architecture/decisions/0010-history-page-real-data-scope.md.
 */

import type { CertaintyCategory } from "@/lore/model";

export type HistoryChangeKind = "architecture" | "dependency" | "data-flow";

/** A single commit contributing to a `HistoryEntry`. */
export interface HistoryCommitRef {
  sha: string;
  message: string;
  authorName: string;
  authorLogin?: string;
  authoredAt: string;
}

/** One structured fact a `HistoryEntry` is built from — the evidence behind its narrative. */
export interface HistoryChangeFact {
  kind: HistoryChangeKind;
  certainty: CertaintyCategory;
  /** Plain-language statement of the detected fact, e.g. "celery added to worker". */
  description: string;
  filePath: string;
  areaName?: string;
}

/** One grouped, human-readable entry in the History timeline. */
export interface HistoryEntry {
  id: string;
  kind: HistoryChangeKind;
  title: string;
  summary: string;
  whatChanged: string[];
  whyNoticed: string;
  affectedAreas: string[];
  occurredAt: string;
  commits: HistoryCommitRef[];
  primaryFilePath: string;
  facts: HistoryChangeFact[];
}

/**
 * Assembles a full `Lore` (the durable, persisted unit — see
 * `docs/architecture/decisions/0005-analysis-result-keying.md`) from JS/TS
 * extraction output (`@/analysis/js-ts/extract-project`) and derived views
 * (`@/analysis/js-ts/derive-views`), plus the repository/commit identity
 * that only exists once a real GitHub repository has been resolved and
 * fetched. Used both for a real analysis run and for the local `/fixtures`
 * pages, so both render through the same `Lore` shape.
 */

import type { JsTsExtraction } from '@/analysis/js-ts/extract-project';
import type { JsTsViews } from '@/analysis/js-ts/derive-views';
import {
  evaluateMinimumValueContract,
  type AnalysisSnapshot,
  type Lore,
  type Repository,
} from './model';

export interface BuildJsTsLoreInput {
  owner: string;
  repo: string;
  defaultBranch: string;
  description?: string;
  commitSha: string;
  analyzerVersion: string;
  analyzedAt: string;
  extraction: JsTsExtraction;
  views: JsTsViews;
}

/**
 * `snapshot.status` is computed from the assembled `Lore` itself — a run is
 * only `'completed'` if it actually satisfies the MVP's minimum value
 * contract (`evaluateMinimumValueContract`), not merely because extraction
 * didn't throw. Anything short of that (e.g. an unsupported/near-empty
 * project) is honestly `'partial'` rather than dressed up as a full result.
 */
export function buildJsTsLore(input: BuildJsTsLoreInput): Lore {
  const {
    owner,
    repo,
    defaultBranch,
    description,
    commitSha,
    analyzerVersion,
    analyzedAt,
    extraction,
    views,
  } = input;

  const repository: Repository = {
    owner,
    name: repo,
    description,
    defaultBranch,
    url: `https://github.com/${owner}/${repo}`,
  };

  const snapshot: AnalysisSnapshot = {
    id: `${owner}/${repo}@${commitSha}:${analyzerVersion}`,
    repository,
    commitSha,
    analyzedAt,
    analyzerVersion,
    status: 'partial',
  };

  const lore: Lore = {
    snapshot,
    projects: [extraction.project],
    structuralAreas: views.structuralAreas,
    entryPoints: extraction.entryPoints,
    relationships: extraction.relationships,
    publicContracts: extraction.publicContracts,
    testRelationships: extraction.testRelationships,
    startHere: views.startHere,
    findings: [],
    gaps: extraction.gaps,
  };

  const contract = evaluateMinimumValueContract(lore);
  const meetsContract = Object.values(contract).every(Boolean);
  snapshot.status = meetsContract ? 'completed' : 'partial';

  return lore;
}

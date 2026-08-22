import { notFound } from "next/navigation";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import {
  getHistoryEntriesForRepoByName,
  saveHistoryEntries,
} from "@/db/history-entries";
import { upsertRepo } from "@/db/repos";
import { computeHistory } from "@/history/compute-history";
import { FailedRunPanel } from "@/components/lore-shell/FailedRunPanel";
import { HistoryContent } from "@/components/lore-shell/HistoryContent";
import { relativeTime } from "@/lib/relative-time";

/**
 * Real History view (ADR-0010) — same fetch/render pattern as the real
 * Overview/Architecture pages: always reads the latest persisted analysis
 * run for repo identity and area resolution, and a failed or resultless run
 * renders honestly via `FailedRunPanel`. History entries are cached
 * separately (`history_entries`) since computing them means new GitHub API
 * calls, not a re-run of the structural analyzer — a repo with no cached
 * entries yet gets them computed synchronously on this first view (the same
 * "compute on first need" precedent as the initial analysis run), then
 * every later view reads the cache until a manual "Refresh history".
 */
export default async function HistoryPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const run = await getLatestAnalysisRunForRepo(owner, repo);
  if (!run) notFound();

  if (run.status === "failed" || !run.result) {
    return <FailedRunPanel owner={owner} repo={repo} run={run} />;
  }

  const lore = run.result;

  let cached = await getHistoryEntriesForRepoByName(owner, repo);
  let truncated = false;
  if (!cached) {
    const repoRow = await upsertRepo(owner, repo);
    const computed = await computeHistory(owner, repo);
    truncated = computed.truncated;
    cached = await saveHistoryEntries({
      repoId: repoRow.id,
      computedThroughSha: computed.computedThroughSha,
      entries: computed.entries,
    });
  }

  const languages = [
    ...new Set(lore.projects.flatMap((p) => p.languages)),
  ].join(", ");

  return (
    <HistoryContent
      owner={owner}
      repo={repo}
      entries={cached.entries}
      truncated={truncated}
      repoIdentity={{
        statusLabel:
          lore.snapshot.status === "completed"
            ? "Analysis current"
            : "Analysis partial",
        statusTone: lore.snapshot.status === "completed" ? "success" : "alert",
        updatedLabel: `Analyzed ${relativeTime(lore.snapshot.analyzedAt)}`,
        branch: lore.snapshot.repository.defaultBranch,
        language: languages,
      }}
      commitSha={lore.snapshot.commitSha}
    />
  );
}

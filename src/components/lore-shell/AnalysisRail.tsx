import Link from 'next/link';
import type { AnalysisSnapshot, Gap } from '@/lore/model';
import { RightRailShell } from '@/components/lore-shell/RightRailShell';
import { relativeTime } from '@/lib/relative-time';

export function AnalysisRail({
  snapshot,
  gaps,
}: {
  snapshot: AnalysisSnapshot;
  gaps: Gap[];
}) {
  return (
    <RightRailShell title="Analysis">
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Status</dt>
          <dd className="text-foreground">{snapshot.status}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Commit</dt>
          <dd className="truncate font-mono text-xs text-foreground">
            {snapshot.commitSha}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Analyzed</dt>
          <dd className="text-foreground">
            {relativeTime(snapshot.analyzedAt)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Analyzer version</dt>
          <dd className="text-foreground">{snapshot.analyzerVersion}</dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-sm text-muted">
          {gaps.length === 0
            ? 'No gaps or limitations were recorded for this analysis.'
            : `This analysis recorded ${gaps.length} gap${gaps.length === 1 ? '' : 's'} or limitation${gaps.length === 1 ? '' : 's'}.`}
        </p>
        {gaps.length > 0 && (
          <Link
            href="#gaps"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            View gaps →
          </Link>
        )}
      </div>
    </RightRailShell>
  );
}

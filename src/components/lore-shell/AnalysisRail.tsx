import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { Badge } from "@/components/ui/Badge";
import { relativeTime } from "@/lib/relative-time";
import type { AnalysisSnapshot, Gap, Project } from "@/lore/model";
import startCase from "lodash.startcase";
import Link from "next/link";

export function AnalysisRail({
  snapshot,
  project,
  gaps,
}: {
  snapshot: AnalysisSnapshot;
  project?: Project;
  gaps: Gap[];
}) {
  return (
    <RightRailShell title="Analysis">
      {project && (
        <dl className="space-y-3 text-sm border-b border-border pb-4">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">
              <strong>Kind</strong>
            </dt>
            <dd className="text-foreground">{startCase(project.kind)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">
              <strong>Languages</strong>
            </dt>
            <dd className="truncate font-mono text-xs text-foreground">
              {project.languages.length > 0 ? (
                project.languages.map((lang) => (
                  <Badge key={lang}>{lang}</Badge>
                ))
              ) : (
                <span className="text-foreground">None Detected</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">
              <strong>Frameworks</strong>
            </dt>
            <dd className="text-foreground">
              {project.frameworks.length > 0 ? (
                project.frameworks.map((fw) => <Badge key={fw}>{fw}</Badge>)
              ) : (
                <span className="text-foreground">None Detected</span>
              )}
            </dd>
          </div>
        </dl>
      )}

      <dl className={`space-y-3 text-sm ${project ? "pt-4" : ""}`}>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            <strong>Status</strong>
          </dt>
          <dd className="text-foreground">{startCase(snapshot.status)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            <strong>Commit</strong>
          </dt>
          <dd className="truncate font-mono text-xs text-foreground">
            {snapshot.commitSha.slice(0, 7)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            <strong>Analyzed</strong>
          </dt>
          <dd className="text-foreground">
            {relativeTime(snapshot.analyzedAt)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            <strong>Analyzer version</strong>
          </dt>
          <dd className="text-foreground">{snapshot.analyzerVersion}</dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-sm text-muted">
          {gaps.length === 0
            ? "No gaps or limitations were recorded for this analysis."
            : `This analysis recorded ${gaps.length} gap${gaps.length === 1 ? "" : "s"} or limitation${gaps.length === 1 ? "" : "s"}.`}
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

import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { Badge } from "@/components/ui/Badge";
import { relativeTime } from "@/lib/relative-time";
import type { AnalysisSnapshot, Gap, Project } from "@/lore/model";
import startCase from "lodash.startcase";
import Link from "next/link";

export function AnalysisRail({
  snapshot,
  projects,
  gaps,
}: {
  snapshot: AnalysisSnapshot;
  /** One entry per detected project (ADR-0007 — a mixed-language repository can have more than one). */
  projects: Project[];
  gaps: Gap[];
}) {
  return (
    <RightRailShell title="Analysis">
      {projects.length > 0 && (
        <div className="space-y-4 border-b border-border pb-4">
          {projects.map((project) => (
            <dl key={project.id} className="space-y-3 text-sm">
              {projects.length > 1 && (
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {project.languages.join(", ") || "Unknown language"} project
                </div>
              )}
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
                <dd className="truncate font-mono text-sm text-foreground">
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
          ))}
        </div>
      )}

      <dl className={`space-y-3 text-sm ${projects.length > 0 ? "pt-4" : ""}`}>
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
          <dd className="truncate font-mono text-sm text-foreground">
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

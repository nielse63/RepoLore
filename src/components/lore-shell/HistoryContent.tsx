"use client";

import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { RepoIdentity } from "@/components/lore-shell/RepoIdentity";
import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { TopBar } from "@/components/lore-shell/TopBar";
import { RefreshHistoryButton } from "@/components/RefreshHistoryButton";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  type DateRange,
  TimeframePicker,
} from "@/components/ui/TimeframePicker";
import { HISTORY_LOOKBACK_DAYS } from "@/github/commits";
import { githubBlobUrl } from "@/github/urls";
import type { HistoryChangeKind, HistoryEntry } from "@/history/model";
import { formatPath } from "@/lib/format-path";
import type { Lore } from "@/lore/model";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

const KIND_FILTERS: { value: HistoryChangeKind | "all"; label: string }[] = [
  { value: "all", label: "All changes" },
  { value: "architecture", label: "Architecture" },
  { value: "dependency", label: "Dependencies" },
  { value: "data-flow", label: "Data flow" },
];

const KIND_LABEL: Record<HistoryChangeKind, string> = {
  architecture: "Architectural change",
  dependency: "Dependency change",
  "data-flow": "Data flow change",
};

function bucketFor(occurredAt: string, now: Date): string {
  const date = new Date(occurredAt);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) return "This week";
  if (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return "Earlier this month";
  }
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : name.slice(0, 2);
  return initials.toUpperCase();
}

export interface HistoryContentProps {
  owner: string;
  repo: string;
  entries: HistoryEntry[];
  truncated: boolean;
  repoIdentity: {
    statusLabel: string;
    statusTone?: "success" | "alert";
    updatedLabel: string;
    branch: string;
    language: string;
  };
  /** The analyzed commit SHA — used to build GitHub source links client-side (`githubBlobUrl` is a pure string builder, safe here). */
  commitSha?: string;
  lore: Lore;
  /**
   * Reference "now" as an ISO string computed once, server-side, in
   * `history/page.tsx`. Constructing `new Date()` directly in this Client
   * Component would run once during SSR and again during hydration with a
   * different (client) clock value, which is exactly the non-deterministic
   * render React's hydration diffing can't tolerate (minified error #418).
   * Deriving `now` from a value the server already committed to the HTML
   * keeps the SSR and hydration renders identical.
   */
  nowIso: string;
}

export function HistoryContent({
  owner,
  repo,
  entries,
  truncated,
  repoIdentity,
  commitSha,
  lore,
  nowIso,
}: HistoryContentProps) {
  const [kind, setKind] = useState<HistoryChangeKind | "all">("all");
  const [selectedId, setSelectedId] = useState(entries[0]?.id);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const defaultRange = useMemo<DateRange>(
    () => ({
      from: new Date(now.getTime() - HISTORY_LOOKBACK_DAYS * 86_400_000),
      to: now,
    }),
    [now]
  );
  const [range, setRange] = useState<DateRange>(defaultRange);

  const filtered = useMemo(() => {
    const from = startOfDay(range.from).getTime();
    const to = endOfDay(range.to).getTime();
    return entries.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      const occurred = new Date(e.occurredAt).getTime();
      return occurred >= from && occurred <= to;
    });
  }, [entries, kind, range]);
  const selected = filtered.find((e) => e.id === selectedId) ?? filtered[0];

  const groupOrder = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const entry of filtered) {
      const bucket = bucketFor(entry.occurredAt, now);
      if (!seen.has(bucket)) {
        seen.add(bucket);
        order.push(bucket);
      }
    }
    return order;
  }, [filtered, now]);

  return (
    <LorePageFrame
      topBar={
        <TopBar
          left={
            <RepoIdentity
              owner={owner}
              repo={repo}
              statusLabel={repoIdentity.statusLabel}
              statusTone={repoIdentity.statusTone}
              updatedLabel={repoIdentity.updatedLabel}
              branch={repoIdentity.branch}
              language={repoIdentity.language}
              visibility={
                lore.snapshot.repository.isPrivate ? "Private" : "Public"
              }
            />
          }
          actions={<RefreshHistoryButton owner={owner} repo={repo} />}
        />
      }
      rightRail={
        selected ? (
          <RightRailShell title={selected.title}>
            <Badge variant="primary">{KIND_LABEL[selected.kind]}</Badge>
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground">Summary</p>
              <p className="mt-1 text-sm text-muted">{selected.summary}</p>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground">
                What changed
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                {selected.whatChanged.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground">
                Why Repo Lore noticed
              </p>
              <p className="mt-1 text-sm text-muted">{selected.whyNoticed}</p>
            </div>
            {selected.affectedAreas.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground">
                  Affected systems
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selected.affectedAreas.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
              <div>
                <p className="text-muted">Source</p>
                {commitSha ? (
                  <a
                    href={githubBlobUrl(owner, repo, commitSha, {
                      filePath: selected.primaryFilePath,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-sm text-primary underline"
                  >
                    {formatPath(selected.primaryFilePath)}
                    <ExternalLink
                      className="h-3 w-3 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <p className="font-mono text-sm text-foreground">
                    {formatPath(selected.primaryFilePath)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-muted">Commits</p>
                <p className="text-foreground">{selected.commits.length}</p>
              </div>
            </div>
          </RightRailShell>
        ) : undefined
      }
    >
      <div className="max-w-4xl">
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          History
        </h1>
        <p className="mt-2 text-base text-muted">
          Meaningful changes to the system&apos;s structure and behavior,
          detected from commit diffs on the default branch.
        </p>

        <div className="mb-4 mt-6 flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as HistoryChangeKind | "all")
              }
              className="appearance-none rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label="Filter by change type"
              id="git-history-type-select"
            >
              {KIND_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          </div>
          <TimeframePicker
            id="git-history-timeframe"
            range={range}
            defaultRange={defaultRange}
            minDate={defaultRange.from}
            maxDate={now}
            onChange={setRange}
          />
        </div>

        {truncated && (
          <p className="mb-4 text-sm text-muted">
            More commits exist in this window than could be inspected — showing
            the most recent commits only.
          </p>
        )}

        {entries.length === 0 && (
          <Card className="p-6 text-sm text-muted">
            No meaningful changes were detected in the last{" "}
            {HISTORY_LOOKBACK_DAYS} days on the default branch.
          </Card>
        )}

        {entries.length > 0 && filtered.length === 0 && (
          <Card className="p-6 text-sm text-muted">
            No meaningful changes were detected in the selected timeframe.
          </Card>
        )}

        {groupOrder.map((group) => {
          const groupEntries = filtered.filter(
            (e) => bucketFor(e.occurredAt, now) === group
          );
          if (groupEntries.length === 0) return null;
          return (
            <section key={group} className="mb-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                {group}
              </h2>
              <Card className="p-0">
                <ul className="divide-y divide-border">
                  {groupEntries.map((entry) => {
                    const active = entry.id === selected?.id;
                    const date = new Date(entry.occurredAt);
                    const authorCommit =
                      entry.commits.find(
                        (c) => c.authoredAt === entry.occurredAt
                      ) ?? entry.commits[0];
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(entry.id)}
                          aria-current={active ? "true" : undefined}
                          className={
                            "flex w-full items-start gap-4 px-6 py-4 text-left transition-colors " +
                            (active
                              ? "bg-tile-core-bg/40"
                              : "hover:bg-border/10")
                          }
                        >
                          <div className="w-24 shrink-0">
                            <p className="text-sm font-medium text-foreground">
                              {date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-sm text-muted">
                              {date.toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">
                              {entry.title}
                            </p>
                            <p className="mt-0.5 text-sm text-muted">
                              {entry.summary}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-border/60 text-[10px] font-semibold text-foreground">
                                {authorInitials(authorCommit.authorName)}
                              </span>
                              {authorCommit.authorName}
                              <span aria-hidden="true">·</span>
                              {entry.commits.length}{" "}
                              {entry.commits.length === 1
                                ? "commit"
                                : "commits"}
                              {entry.affectedAreas.length > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  {entry.affectedAreas.join(", ")}
                                </>
                              )}
                            </div>
                          </div>
                          <ChevronRight
                            className="mt-1 h-4 w-4 shrink-0 text-muted"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          );
        })}
        {filtered.length > 0 && (
          <p className="text-center text-sm text-muted">End of results</p>
        )}
      </div>
    </LorePageFrame>
  );
}

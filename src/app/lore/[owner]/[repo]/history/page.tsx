'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { TopBar } from '@/components/lore-shell/TopBar';
import { RepoIdentity } from '@/components/lore-shell/RepoIdentity';
import { LorePageFrame } from '@/components/lore-shell/LorePageFrame';
import { RightRailShell } from '@/components/lore-shell/RightRailShell';
import { PreviewBanner } from '@/components/lore-shell/PreviewBanner';
import { PreviewActions } from '@/components/lore-shell/PreviewActions';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  HISTORY_ENTRIES,
  type HistoryEntry,
} from '@/lib/fixtures/payments-service';

const KIND_FILTERS = [
  { value: 'all', label: 'All changes' },
  { value: 'Architectural change', label: 'Architecture' },
  { value: 'Dependency change', label: 'Dependencies' },
  { value: 'Data flow change', label: 'Data flow' },
];

const GROUPS: HistoryEntry['group'][] = [
  'This week',
  'Earlier this month',
  'June 2026',
];

export default function HistoryPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [kind, setKind] = useState('all');
  const [selected, setSelected] = useState(HISTORY_ENTRIES[0]);

  const filtered = useMemo(
    () => HISTORY_ENTRIES.filter((e) => kind === 'all' || e.kind === kind),
    [kind]
  );

  return (
    <LorePageFrame
      topBar={
        <TopBar
          left={
            <RepoIdentity
              owner={owner}
              repo={repo}
              statusLabel="Analysis current"
              updatedLabel="Analyzed 2 hours ago"
              branch="main"
              language="Python"
            />
          }
          actions={<PreviewActions />}
        />
      }
      rightRail={
        <RightRailShell title={selected.title}>
          <Badge variant="primary">{selected.kind}</Badge>
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground">Summary</p>
            <p className="mt-1 text-sm text-muted">{selected.description}</p>
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
          <div className="mt-4">
            <p className="text-sm font-semibold text-foreground">
              Affected systems
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {selected.systems.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
            <div>
              <p className="text-muted">Source</p>
              <p className="font-mono text-xs text-foreground">
                {selected.source}{' '}
                <span className="text-muted">{selected.lineRange}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted">Commits</p>
              <p className="text-foreground">{selected.commitCount}</p>
            </div>
          </div>
        </RightRailShell>
      }
    >
      <div className="max-w-4xl">
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          History
        </h1>
        <p className="mt-2 text-base text-muted">
          Meaningful changes to the system&apos;s structure and behavior.
        </p>

        <PreviewBanner>
          Showing example data for illustration. Commit-history analysis
          isn&apos;t implemented yet — see docs/product/mvp.md&apos;s MVP
          exclusions.
        </PreviewBanner>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label="Filter by change type"
            >
              {KIND_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            May 25 – Jun 22, 2026
          </span>
        </div>

        {GROUPS.map((group) => {
          const entries = filtered.filter((e) => e.group === group);
          if (entries.length === 0) return null;
          return (
            <section key={group} className="mb-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                {group}
              </h2>
              <Card className="p-0">
                <ul className="divide-y divide-border">
                  {entries.map((entry) => {
                    const active = entry.id === selected.id;
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(entry)}
                          aria-current={active ? 'true' : undefined}
                          className={
                            'flex w-full items-start gap-4 px-6 py-4 text-left transition-colors ' +
                            (active
                              ? 'bg-tile-core-bg/40'
                              : 'hover:bg-border/10')
                          }
                        >
                          <div className="w-24 shrink-0">
                            <p className="text-sm font-medium text-foreground">
                              {entry.date}
                            </p>
                            <p className="text-xs text-muted">{entry.time}</p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">
                              {entry.title}
                            </p>
                            <p className="mt-0.5 text-sm text-muted">
                              {entry.description}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-border/60 text-[10px] font-semibold text-foreground">
                                {entry.authorInitials}
                              </span>
                              {entry.author}
                              <span aria-hidden="true">·</span>
                              {entry.commitCount} commits
                              <span aria-hidden="true">·</span>
                              {entry.systems.join(', ')}
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">
                                {entry.lineRange}
                              </span>
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
        <p className="text-center text-sm text-muted">End of results</p>
      </div>
    </LorePageFrame>
  );
}

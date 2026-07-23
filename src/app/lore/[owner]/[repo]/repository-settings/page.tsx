'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { TopBar } from '@/components/lore-shell/TopBar';
import { RepoIdentity } from '@/components/lore-shell/RepoIdentity';
import { LorePageFrame } from '@/components/lore-shell/LorePageFrame';
import { RightRailShell } from '@/components/lore-shell/RightRailShell';
import { PreviewBanner } from '@/components/lore-shell/PreviewBanner';
import { PreviewActions } from '@/components/lore-shell/PreviewActions';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/cn';

const SECTIONS = ['General', 'Analysis', 'Branches', 'Access'] as const;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  defaultChecked,
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

export default function RepositorySettingsPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [section, setSection] = useState<(typeof SECTIONS)[number]>('General');
  const [displayName, setDisplayName] = useState(`${owner}/${repo}`);
  const [description, setDescription] = useState('');

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
        <RightRailShell title="Analysis summary">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Last completed</dt>
              <dd className="text-foreground">2 hours ago</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Next check</dt>
              <dd className="text-foreground">In ~22 hours</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Analyzed files</dt>
              <dd className="text-foreground">1,248</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Excluded files</dt>
              <dd className="text-foreground">142</dd>
            </div>
          </dl>
          <a
            href="#"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View analysis log <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </RightRailShell>
      }
    >
      <div className="max-w-4xl">
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          Repository settings
        </h1>
        <p className="mt-2 text-base text-muted">
          Manage how Repo Lore analyzes and presents this repository.
        </p>

        <PreviewBanner>
          Showing example data for illustration. Repository settings aren&apos;t
          implemented yet — see docs/product/mvp.md&apos;s MVP exclusions (no
          scheduled or automatic refresh).
        </PreviewBanner>

        <div className="flex gap-8">
          <nav className="w-40 shrink-0" aria-label="Settings sections">
            <ul className="space-y-0.5">
              {SECTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setSection(s)}
                    className={cn(
                      'w-full rounded-md border-l-2 px-3 py-1.5 text-left text-sm font-medium',
                      section === s
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted hover:text-foreground'
                    )}
                  >
                    {s}
                  </button>
                </li>
              ))}
              <li className="pt-2">
                <button
                  type="button"
                  className="w-full rounded-md border-l-2 border-transparent px-3 py-1.5 text-left text-sm font-medium text-tile-alert-fg"
                >
                  Danger zone
                </button>
              </li>
            </ul>
          </nav>

          <div className="min-w-0 flex-1">
            {section === 'General' && (
              <div className="flex flex-col gap-6">
                <Card>
                  <h2 className="text-base font-semibold text-foreground">
                    Repository
                  </h2>
                  <div className="mt-2 divide-y divide-border">
                    <Field label="GitHub URL">
                      <a
                        href={`https://github.com/${owner}/${repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        github.com/{owner}/{repo}{' '}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Field>
                    <Field label="Default branch">main</Field>
                    <Field label="Visibility">
                      <Badge variant="primary">Public</Badge>
                    </Field>
                    <Field label="Analysis state">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />{' '}
                        Current
                      </span>
                    </Field>
                  </div>
                </Card>

                <Card>
                  <h2 className="text-base font-semibold text-foreground">
                    Automatic analysis
                  </h2>
                  <div className="mt-2 divide-y divide-border">
                    <ToggleRow
                      title="Keep analysis current"
                      description="Repo Lore checks for repository changes automatically."
                      defaultChecked
                    />
                  </div>
                </Card>

                <Card>
                  <h2 className="text-base font-semibold text-foreground">
                    Content
                  </h2>
                  <div className="mt-2 divide-y divide-border">
                    <ToggleRow
                      title="Include version-control history"
                      description="Use commit history to improve insights and traceability."
                      defaultChecked
                    />
                    <ToggleRow
                      title="Include tests as supporting evidence"
                      description="Use tests to validate behavior and strengthen insights."
                      defaultChecked
                    />
                    <ToggleRow
                      title="Show generated files"
                      description="Include generated or build output files in analysis."
                    />
                  </div>
                </Card>

                <Card>
                  <h2 className="text-base font-semibold text-foreground">
                    Display
                  </h2>
                  <div className="mt-4 flex flex-col gap-4">
                    <label className="block">
                      <span className="text-sm text-muted">
                        Repository display name
                      </span>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm text-muted">
                        Repository description
                      </span>
                      <textarea
                        value={description}
                        onChange={(e) =>
                          setDescription(e.target.value.slice(0, 200))
                        }
                        rows={3}
                        className="mt-1.5 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                      <span className="mt-1 block text-xs text-muted">
                        {description.length}/200
                      </span>
                    </label>
                  </div>
                </Card>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    disabled
                    title="Not available in preview"
                  >
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled
                    title="Not available in preview"
                  >
                    Re-analyze now
                  </Button>
                </div>
              </div>
            )}

            {section !== 'General' && (
              <Card>
                <p className="text-sm text-muted">
                  {section} settings aren&apos;t implemented yet.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </LorePageFrame>
  );
}

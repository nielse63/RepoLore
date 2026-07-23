import { ArrowRight, FileText } from 'lucide-react';
import { TopBar } from '@/components/lore-shell/TopBar';
import { RepoIdentity } from '@/components/lore-shell/RepoIdentity';
import { LorePageFrame } from '@/components/lore-shell/LorePageFrame';
import { RightRailShell } from '@/components/lore-shell/RightRailShell';
import { PreviewBanner } from '@/components/lore-shell/PreviewBanner';
import { PreviewActions } from '@/components/lore-shell/PreviewActions';
import { Card } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/IconTile';
import {
  ARCHITECTURAL_BOUNDARIES,
  ARCHITECTURE_LAYERS,
} from '@/lib/fixtures/payments-service';
import { ICONS } from '@/lib/fixtures/icons';

export default async function ArchitecturePage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

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
        <RightRailShell title="About this architecture">
          <p className="text-sm text-muted">
            This architecture represents the current structure of an example
            repository as implemented on its main branch.
          </p>
          <p className="mt-3 text-sm text-muted">
            It focuses on the major components and their interactions across
            request handling, core services, background processing, and data
            persistence.
          </p>

          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4 text-muted" aria-hidden="true" />
              Evidence coverage
            </div>
            <p className="mt-1 text-2xl font-semibold text-primary">
              42 references
            </p>
            <p className="mt-1 text-xs text-muted">
              These references support the components, connections, and
              boundaries shown.
            </p>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Last verified</p>
            <p className="mt-1 text-sm text-muted">2 hours ago</p>
          </div>
        </RightRailShell>
      }
    >
      <div className="max-w-4xl">
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          Architecture
        </h1>
        <p className="mt-2 text-base text-muted">
          How the major parts of this repository work together.
        </p>

        <PreviewBanner>
          Showing example data for illustration. Architecture detection
          isn&apos;t implemented yet for this repository.
        </PreviewBanner>

        <Card className="mt-2">
          <div className="flex flex-col divide-y divide-border">
            {ARCHITECTURE_LAYERS.map((layer) => {
              const LayerIcon = ICONS[layer.icon];
              return (
                <div
                  key={layer.label}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="flex w-48 shrink-0 items-center gap-2 text-sm font-medium text-foreground">
                    <LayerIcon
                      className="h-4 w-4 text-muted"
                      aria-hidden="true"
                    />
                    {layer.label}
                  </div>
                  <div className="flex flex-1 flex-wrap gap-3">
                    {layer.nodes.map((node) => {
                      const [name, subtitle] = node.split(' · ');
                      return (
                        <div
                          key={node}
                          className="rounded-lg border border-border bg-background px-4 py-2.5"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {name}
                          </p>
                          {subtitle && (
                            <p className="text-xs text-muted">{subtitle}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Architectural boundaries
          </h2>
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {ARCHITECTURAL_BOUNDARIES.map((boundary, i) => {
                const BoundaryIcon = ICONS[boundary.icon];
                return (
                  <li
                    key={boundary.title}
                    className="flex items-start gap-4 px-6 py-4"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-border/50 text-sm font-semibold text-foreground">
                      {i + 1}
                    </span>
                    <IconTile icon={BoundaryIcon} variant="core" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {boundary.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {boundary.description}
                      </p>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-sm text-muted">
                      Supported by{' '}
                      <span className="font-medium text-primary">
                        {boundary.referenceCount} references
                      </span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
          <a
            href="#"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all {ARCHITECTURAL_BOUNDARIES.length} boundaries{' '}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </section>
      </div>
    </LorePageFrame>
  );
}

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { TopBar } from '@/components/lore-shell/TopBar';
import { RepoIdentity } from '@/components/lore-shell/RepoIdentity';
import { LorePageFrame } from '@/components/lore-shell/LorePageFrame';
import { RightRailShell } from '@/components/lore-shell/RightRailShell';
import { PreviewBanner } from '@/components/lore-shell/PreviewBanner';
import { PreviewActions } from '@/components/lore-shell/PreviewActions';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IconTile } from '@/components/ui/IconTile';
import { SearchInput } from '@/components/ui/SearchInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import {
  DEPENDENCIES,
  type DependencyRow,
} from '@/lib/fixtures/payments-service';
import { ICONS } from '@/lib/fixtures/icons';

export default function DependenciesPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<DependencyRow>(
    DEPENDENCIES.find((d) => d.name === 'Celery') ?? DEPENDENCIES[0]
  );

  const filtered = DEPENDENCIES.filter((d) =>
    d.name.toLowerCase().includes(query.trim().toLowerCase())
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
        <RightRailShell title={selected.name}>
          <Badge variant="primary">{selected.scope} dependency</Badge>
          <p className="mt-3 text-sm text-muted">{selected.purpose}</p>

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Used by</p>
            <ul className="mt-2 space-y-2">
              {selected.usedBy.map((name) => (
                <li key={name} className="text-sm text-muted">
                  {name}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4" aria-hidden="true" /> Evidence
            </p>
            <p className="mt-1 text-sm text-muted">
              {`${selected.evidenceCount} references support this dependency's usage.`}
            </p>
          </div>
        </RightRailShell>
      }
    >
      <div className="max-w-4xl">
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          Dependencies
        </h1>
        <p className="mt-2 text-base text-muted">
          What this repository relies on, and where those dependencies are used.
        </p>

        <PreviewBanner>
          Showing example data for illustration. Dependency extraction
          isn&apos;t implemented yet for this repository.
        </PreviewBanner>

        <Tabs defaultValue="packages">
          <TabsList>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="internal">Internal</TabsTrigger>
            <TabsTrigger value="external">External services</TabsTrigger>
          </TabsList>

          <TabsContent value="packages">
            <details className="group mb-4 rounded-xl border border-border bg-surface p-4 open:pb-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <IconTile icon={ICONS.shield} variant="core" size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Background processing depends on Celery and Redis.
                    </p>
                    <p className="text-sm text-muted">
                      Supported by{' '}
                      <span className="font-medium text-primary">
                        9 references
                      </span>
                      .
                    </p>
                  </div>
                </div>
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 pl-11 text-sm text-muted">
                Worker and Payment Service both depend on Celery for background
                task execution, and Redis serves as its broker and result
                backend.
              </p>
            </details>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput
                placeholder="Search dependencies…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery('')}
                className="sm:max-w-xs"
              />
              <p className="text-sm text-muted">
                {filtered.length} dependencies
              </p>
            </div>

            <Card className="p-0">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Dependency</Th>
                    <Th>Purpose</Th>
                    <Th>Used by</Th>
                    <Th>Version</Th>
                    <Th>Evidence</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {filtered.map((dep) => {
                    const Icon = ICONS[dep.icon];
                    const active = dep.name === selected.name;
                    return (
                      <Tr
                        key={dep.name}
                        onClick={() => setSelected(dep)}
                        aria-current={active ? 'true' : undefined}
                        className={
                          'cursor-pointer ' +
                          (active ? 'bg-tile-core-bg/40' : 'hover:bg-border/10')
                        }
                      >
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <IconTile icon={Icon} variant="neutral" size="sm" />
                            <div>
                              <p className="font-medium text-foreground">
                                {dep.name}
                              </p>
                              <Badge variant="primary">{dep.scope}</Badge>
                            </div>
                          </div>
                        </Td>
                        <Td className="text-muted">{dep.purpose}</Td>
                        <Td className="text-muted">{dep.usedBy.join(', ')}</Td>
                        <Td className="font-mono text-xs">{dep.version}</Td>
                        <Td>
                          <span className="inline-flex items-center gap-1 text-primary">
                            {dep.evidenceCount} references{' '}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="internal">
            <Card>
              <p className="text-sm text-muted">
                Internal module dependency mapping isn&apos;t implemented yet
                for this repository.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="external">
            <Card>
              <p className="text-sm text-muted">
                External service dependency mapping isn&apos;t implemented yet
                for this repository.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LorePageFrame>
  );
}

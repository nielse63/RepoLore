import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeftRight,
  Compass,
  Database,
  Target,
} from 'lucide-react';
import { TopBar } from '@/components/lore-shell/TopBar';
import { LorePageFrame } from '@/components/lore-shell/LorePageFrame';
import { RightRailShell } from '@/components/lore-shell/RightRailShell';
import { PreviewBanner } from '@/components/lore-shell/PreviewBanner';
import { PreviewActions } from '@/components/lore-shell/PreviewActions';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/IconTile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { SYSTEMS, getSystemDetail } from '@/lib/fixtures/payments-service';
import { ICONS } from '@/lib/fixtures/icons';

export default async function SystemDetailPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; system: string }>;
}) {
  const { owner, repo, system: slug } = await params;
  const system = SYSTEMS.find((s) => s.slug === slug);
  const detail = getSystemDetail(slug);
  if (!system || !detail) notFound();

  const base = `/lore/${owner}/${repo}`;

  return (
    <LorePageFrame
      topBar={
        <TopBar
          left={
            <Breadcrumbs
              items={[
                { label: 'Systems', href: `${base}/systems` },
                { label: system.name },
              ]}
            />
          }
          actions={<PreviewActions />}
        />
      }
      rightRail={
        <RightRailShell title="Evidence">
          <p className="text-sm text-muted">
            {system.evidence} references · Last verified 2 hours ago
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {detail.owns.map((owned) => (
              <li key={owned.path}>
                <p className="font-mono text-xs text-foreground">
                  {owned.path}
                </p>
                <p className="text-xs text-muted">{owned.description}</p>
              </li>
            ))}
          </ul>
        </RightRailShell>
      }
    >
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-4xl font-semibold text-foreground">
            {system.name}
          </h1>
          <Badge variant={system.variant}>{system.kind} system</Badge>
        </div>
        <p className="mt-2 text-base text-muted">{system.description}</p>

        <PreviewBanner>
          Showing example data for illustration. This system view isn&apos;t
          implemented yet for this repository.
        </PreviewBanner>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="responsibilities">Responsibilities</TabsTrigger>
            <TabsTrigger value="relationships">Relationships</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <div className="flex items-start gap-3">
                  <IconTile icon={Target} variant="core" size="sm" />
                  <div>
                    <CardTitle>Responsibilities</CardTitle>
                    <CardDescription>
                      Evidence-backed statements about what this system does.
                    </CardDescription>
                  </div>
                </div>
                <ol className="mt-4 space-y-2 text-sm text-foreground">
                  {detail.responsibilities.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted">{i + 1}.</span> {r}
                    </li>
                  ))}
                </ol>
              </Card>
              <Card>
                <div className="flex items-start gap-3">
                  <IconTile icon={Database} variant="data" size="sm" />
                  <div>
                    <CardTitle>Owns</CardTitle>
                    <CardDescription>
                      Data models owned and versioned by this system.
                    </CardDescription>
                  </div>
                </div>
                <ul className="mt-4 space-y-3">
                  {detail.owns.map((owned) => (
                    <li key={owned.path}>
                      <p className="font-mono text-xs text-foreground">
                        {owned.path}
                      </p>
                      <p className="text-sm text-muted">{owned.description}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <Card>
              <div className="flex items-start gap-3">
                <IconTile
                  icon={ArrowLeftRight}
                  variant="supporting"
                  size="sm"
                />
                <div>
                  <CardTitle>Relationships</CardTitle>
                  <CardDescription>
                    How this system connects with other systems and
                    infrastructure.
                  </CardDescription>
                </div>
              </div>
              <ul className="mt-4 divide-y divide-border">
                {detail.relationships.map((rel) => {
                  const RelIcon = ICONS[rel.icon];
                  return (
                    <li
                      key={rel.name}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <IconTile icon={RelIcon} variant="neutral" size="sm" />
                      <span className="flex-1 text-sm text-foreground">
                        {rel.name}
                      </span>
                      <span className="text-xs text-muted">{rel.label}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {detail.entryPoints.length > 0 && (
              <Card className="p-0">
                <div className="flex items-start gap-3 p-6 pb-0">
                  <IconTile icon={Compass} variant="core" size="sm" />
                  <div>
                    <CardTitle>Key entry points</CardTitle>
                    <CardDescription>
                      Public interfaces exposed by this system.
                    </CardDescription>
                  </div>
                </div>
                <Table className="mt-4">
                  <Thead>
                    <Tr>
                      <Th>Endpoint</Th>
                      <Th>Method</Th>
                      <Th>Description</Th>
                      <Th>Defined in</Th>
                    </Tr>
                  </Thead>
                  <tbody>
                    {detail.entryPoints.map((ep) => (
                      <Tr key={ep.endpoint}>
                        <Td className="font-mono text-xs">{ep.endpoint}</Td>
                        <Td>{ep.method}</Td>
                        <Td>{ep.description}</Td>
                        <Td className="font-mono text-xs text-muted">
                          {ep.definedIn}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            )}

            {detail.flows.length > 0 && (
              <Card>
                <CardTitle>Appears in these flows</CardTitle>
                <CardDescription>
                  Business and technical flows this system participates in.
                </CardDescription>
                <ul className="mt-4 divide-y divide-border">
                  {detail.flows.map((flow) => (
                    <li
                      key={flow.name}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {flow.name}
                        </p>
                        <p className="text-xs text-muted">{flow.description}</p>
                      </div>
                      <Badge>Flow</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Link
              href={`${base}/systems/${system.slug}/change-impact`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View change impact <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </TabsContent>

          <TabsContent value="responsibilities">
            <Card>
              <ol className="space-y-2 text-sm text-foreground">
                {detail.responsibilities.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted">{i + 1}.</span> {r}
                  </li>
                ))}
              </ol>
            </Card>
          </TabsContent>

          <TabsContent value="relationships">
            <Card>
              <ul className="divide-y divide-border">
                {detail.relationships.map((rel) => {
                  const RelIcon = ICONS[rel.icon];
                  return (
                    <li
                      key={rel.name}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <IconTile icon={RelIcon} variant="neutral" size="sm" />
                      <span className="flex-1 text-sm text-foreground">
                        {rel.name}
                      </span>
                      <span className="text-xs text-muted">{rel.label}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="evidence">
            <Card>
              <ul className="space-y-3">
                {detail.owns.map((owned) => (
                  <li key={owned.path} className="text-sm">
                    <p className="font-mono text-xs text-foreground">
                      {owned.path}
                    </p>
                    <p className="text-muted">{owned.description}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LorePageFrame>
  );
}

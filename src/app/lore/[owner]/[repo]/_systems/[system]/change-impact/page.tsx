import { notFound } from "next/navigation";
import { AlertTriangle, Ban, Copy, Download, Eye } from "lucide-react";
import { TopBar } from "@/components/lore-shell/TopBar";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { PreviewBanner } from "@/components/lore-shell/PreviewBanner";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SYSTEMS, getSystemDetail } from "@/lib/fixtures/payments-service";

const LIKELY_AFFECTED = [
  {
    name: "Worker",
    description: "Payment Service enqueues jobs consumed by Worker.",
    evidence: 3,
  },
  {
    name: "Auth Service",
    description:
      "Payment Service calls Auth Service to validate and issue JWTs.",
    evidence: 2,
  },
  {
    name: "Notification Service",
    description: "Payment Service sends email and SMS notifications.",
    evidence: 2,
  },
  {
    name: "API routes",
    description: "HTTP endpoints route requests to Payment Service.",
    evidence: 6,
  },
];

const REVIEW_RECOMMENDED = [
  {
    name: "PostgreSQL",
    description:
      "Payment Service reads from and writes to the primary database.",
    evidence: 4,
  },
  {
    name: "Redis",
    description: "Payment Service uses Redis for caching and queuing.",
    evidence: 3,
  },
  {
    name: "Other services",
    description: "Indirect integrations that may be affected.",
    evidence: 1,
  },
];

export default async function ChangeImpactPage({
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
                { label: "Systems", href: `${base}/systems` },
                { label: system.name, href: `${base}/systems/${system.slug}` },
                { label: "Change impact" },
              ]}
            />
          }
          actions={
            <>
              <Button
                variant="secondary"
                disabled
                title="Not available in preview"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export review checklist
              </Button>
              <Button
                variant="secondary"
                disabled
                title="Not available in preview"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy link
              </Button>
            </>
          }
        />
      }
      rightRail={
        <RightRailShell title="Impact evidence">
          <p className="text-sm font-medium text-foreground">
            Selected relationship
          </p>
          <p className="mt-1 text-sm text-muted">
            Worker — downstream (indirect reach)
          </p>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">
              Why this could be affected
            </p>
            <p className="mt-1 text-sm text-muted">
              {system.name} enqueues jobs consumed by Worker.
            </p>
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">
              Understanding impact
            </p>
            <p className="mt-1 text-sm text-muted">
              This impact is based on static analysis of code, configuration,
              and infrastructure.
            </p>
          </div>
        </RightRailShell>
      }
    >
      <div className="max-w-4xl">
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          Change impact
        </h1>
        <p className="mt-2 text-base text-muted">
          What could be affected if the {system.name} changes.{" "}
          <Badge variant="primary">Evidence-based estimate</Badge>
        </p>

        <PreviewBanner>
          Showing example data for illustration. Change-impact analysis
          isn&apos;t implemented yet — see docs/product/mvp.md&apos;s MVP
          exclusions.
        </PreviewBanner>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Likely
            affected
          </h2>
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {LIKELY_AFFECTED.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-4 px-6 py-3.5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.name}
                    </p>
                    <p className="text-sm text-muted">{item.description}</p>
                  </div>
                  <span className="shrink-0 text-sm text-primary">
                    {item.evidence}{" "}
                    {item.evidence === 1 ? "reference" : "references"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <Eye className="h-4 w-4" aria-hidden="true" /> Review recommended
          </h2>
          <p className="-mt-2 mb-3 text-sm text-muted">
            Lower-confidence or indirect relationships.
          </p>
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {REVIEW_RECOMMENDED.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-4 px-6 py-3.5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.name}
                    </p>
                    <p className="text-sm text-muted">{item.description}</p>
                  </div>
                  <span className="shrink-0 text-sm text-primary">
                    {item.evidence}{" "}
                    {item.evidence === 1 ? "reference" : "references"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <Ban className="h-4 w-4" aria-hidden="true" /> Unrelated in current
            evidence
          </h2>
          <Card>
            <p className="text-sm text-muted">No relevant connections found.</p>
          </Card>
        </section>
      </div>
    </LorePageFrame>
  );
}

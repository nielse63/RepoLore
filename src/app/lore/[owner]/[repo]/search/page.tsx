"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Package,
  ShieldCheck,
  Star,
} from "lucide-react";
import { TopBar } from "@/components/lore-shell/TopBar";
import { RepoIdentity } from "@/components/lore-shell/RepoIdentity";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { PreviewBanner } from "@/components/lore-shell/PreviewBanner";
import { PreviewActions } from "@/components/lore-shell/PreviewActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/IconTile";
import { SearchInput } from "@/components/ui/SearchInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { SYSTEMS } from "@/lib/fixtures/payments-service";
import { ICONS } from "@/lib/fixtures/icons";
import { formatPath } from "@/lib/format-path";

const FACETS = [
  { label: "All", count: 18 },
  { label: "Systems", count: 2 },
  { label: "Flows", count: 1 },
  { label: "Claims", count: 1 },
  { label: "Files", count: 8 },
  { label: "History", count: 1 },
];

const FILE_RESULTS = [
  {
    file: "workers/tasks.py",
    lines: "L10-L67",
    code: 'def process_payment_retry(self, payment_id):\n    """Process a payment retry asynchronously."""',
  },
  {
    file: "service/payment/checkout.py",
    lines: "L42-L128",
    code: 'process_payment_retry.delay(payment_id)\nreturn Accepted(), {"status": "retry_queued"}',
  },
];

export default function SearchPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [query, setQuery] = useState("payment retry");
  const [facet, setFacet] = useState("All");
  const paymentService = SYSTEMS.find((s) => s.slug === "payment-service")!;
  const worker = SYSTEMS.find((s) => s.slug === "worker")!;
  const [detailTab, setDetailTab] = useState("details");

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
        <RightRailShell title="Payment retries are processed asynchronously">
          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList>
              <TabsTrigger
                value="details"
                tabIndex={detailTab === "details" ? 0 : -1}
              >
                Details
              </TabsTrigger>
              <TabsTrigger
                value="references"
                tabIndex={detailTab === "references" ? 0 : -1}
              >
                References (7)
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              <p className="text-sm font-medium text-foreground">Explanation</p>
              <p className="mt-1 text-sm text-muted">
                Payment retry attempts are not handled in the request path. They
                are enqueued and processed by background workers using Celery.
              </p>
              <p className="mt-4 text-sm font-medium text-foreground">
                Related systems
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge>Payment Service</Badge>
                <Badge>Worker</Badge>
              </div>
              <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
                <Button type="button" disabled title="Not available in preview">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open
                  claim
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled
                  title="Not available in preview"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" /> Copy link
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="references">
              <ul className="space-y-3">
                {FILE_RESULTS.map((r) => (
                  <li key={r.file}>
                    <p className="font-mono text-xs text-foreground">
                      {formatPath(r.file)}{" "}
                      <span className="text-muted">{r.lines}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </RightRailShell>
      }
    >
      <div className="max-w-4xl">
        <label htmlFor="repo-search" className="sr-only">
          Search this repository
        </label>
        <SearchInput
          id="repo-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="Search this repository…"
        />
        <h1 className="mt-6 font-serif text-4xl font-semibold text-foreground">
          Search
        </h1>
        <p className="mt-2 text-base text-muted">
          18 results across systems, flows, evidence, and history.
        </p>

        <PreviewBanner>
          Showing example results for illustration. Search isn&apos;t
          implemented yet for this repository.
        </PreviewBanner>

        <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
          <nav
            className="-mx-4 shrink-0 overflow-x-auto px-4 lg:mx-0 lg:w-36 lg:overflow-visible lg:px-0"
            aria-label="Search facets"
          >
            <ul className="flex gap-1.5 lg:block lg:space-y-0.5">
              {FACETS.map((f) => (
                <li key={f.label} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setFacet(f.label)}
                    className={
                      "flex items-center justify-between gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-sm font-medium lg:w-full " +
                      (facet === f.label
                        ? "bg-tile-core-bg text-tile-core-fg"
                        : "text-muted hover:text-foreground")
                    }
                  >
                    {f.label}
                    <span className="text-xs">{f.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 flex-1">
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <Star className="h-4 w-4" aria-hidden="true" /> Best match
              </h2>
              <Card>
                <div className="flex items-start gap-3">
                  <IconTile icon={ShieldCheck} variant="core" size="sm" />
                  <div className="flex-1">
                    <p className="text-base font-semibold text-foreground">
                      Payment retries are processed asynchronously
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Payment retry attempts are not handled in the request
                      path. They are enqueued and processed by background
                      workers using Celery.
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      Supported by{" "}
                      <span className="font-medium text-primary">
                        7 references
                      </span>
                    </p>
                  </div>
                </div>
              </Card>
            </section>

            <section className="mt-6">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <Package className="h-4 w-4" aria-hidden="true" /> Systems (2)
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[paymentService, worker].map((system) => {
                  const Icon = ICONS[system.icon];
                  return (
                    <Card key={system.slug}>
                      <div className="flex items-start gap-3">
                        <IconTile
                          icon={Icon}
                          variant={system.variant}
                          size="sm"
                        />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {system.name}
                          </p>
                          <p className="mt-0.5 text-sm text-muted">
                            {system.description}
                          </p>
                          <p className="mt-1.5 font-mono text-xs text-primary">
                            {formatPath(system.ownedPaths)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>

            <section className="mt-6">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                <FileText className="h-4 w-4" aria-hidden="true" /> Evidence (8)
              </h2>
              <div className="flex flex-col gap-3">
                {FILE_RESULTS.map((r) => (
                  <Card key={r.file} className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs text-foreground">
                        {formatPath(r.file)}
                      </p>
                      <span className="text-xs text-muted">{r.lines}</span>
                    </div>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-background p-3 font-mono text-xs text-foreground">
                      {r.code}
                    </pre>
                  </Card>
                ))}
              </div>
              <button className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View 6 more files <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </section>
          </div>
        </div>
      </div>
    </LorePageFrame>
  );
}

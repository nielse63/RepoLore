"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/lore-shell/TopBar";
import { RepoIdentity } from "@/components/lore-shell/RepoIdentity";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { PreviewBanner } from "@/components/lore-shell/PreviewBanner";
import { PreviewActions } from "@/components/lore-shell/PreviewActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconTile } from "@/components/ui/IconTile";
import { FilterPills } from "@/components/ui/FilterPills";
import { DATA_FLOW_STEPS } from "@/lib/fixtures/payments-service";
import { ICONS } from "@/lib/fixtures/icons";
import { formatPath } from "@/lib/format-path";

const JOURNEYS = [
  { value: "create-payment", label: "Create payment" },
  { value: "authenticate-request", label: "Authenticate request" },
  { value: "send-notification", label: "Send notification" },
  { value: "process-retry", label: "Process retry" },
];

const VIEWS = [
  { value: "journey", label: "Journey" },
  { value: "diagram", label: "Diagram" },
  { value: "list", label: "List" },
];

export default function DataFlowPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [journey, setJourney] = useState("create-payment");
  const [view, setView] = useState("journey");
  const [activeStep, setActiveStep] = useState(3);

  const step = DATA_FLOW_STEPS[activeStep];

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
        <RightRailShell title="Evidence">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {step.title}
            </p>
            <span className="shrink-0 text-xs text-muted">
              Step {activeStep + 1} of {DATA_FLOW_STEPS.length}
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Involved system
            </p>
            <Badge className="mt-1">{step.system}</Badge>
          </div>

          {step.inputs && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Inputs
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                {step.inputs.map((input) => (
                  <li key={input}>{input}</li>
                ))}
              </ul>
            </div>
          )}

          {step.outputs && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Outputs
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                {step.outputs.map((output) => (
                  <li key={output}>{output}</li>
                ))}
              </ul>
            </div>
          )}

          {step.stateChange && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                State change
              </p>
              <p className="mt-1 text-sm text-muted">{step.stateChange}</p>
            </div>
          )}

          {step.evidence && (
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">
                Evidence ({step.evidence.length})
              </p>
              <ul className="mt-3 space-y-3">
                {step.evidence.map((e) => (
                  <li key={e.location}>
                    <p className="font-mono text-xs text-foreground">
                      {formatPath(e.location)}{" "}
                      <span className="text-muted">{e.lines}</span>
                    </p>
                    <p className="text-sm text-muted">{e.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </RightRailShell>
      }
    >
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-semibold text-foreground">
              Data flow
            </h1>
            <p className="mt-2 text-base text-muted">
              Follow information through the system, from entry point to side
              effect.
            </p>
          </div>
          <FilterPills
            aria-label="View mode"
            options={VIEWS}
            value={view}
            onChange={setView}
          />
        </div>

        <PreviewBanner>
          Showing example data for illustration. Data-flow tracing isn&apos;t
          implemented yet — see docs/product/mvp.md&apos;s MVP exclusions.
        </PreviewBanner>

        <FilterPills
          aria-label="Journey"
          options={JOURNEYS}
          value={journey}
          onChange={setJourney}
        />

        <Card className="mt-4 p-0">
          <ol className="divide-y divide-border">
            {DATA_FLOW_STEPS.map((s, i) => {
              const Icon = ICONS[s.icon];
              const active = i === activeStep;
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(i)}
                    aria-current={active ? "step" : undefined}
                    className={
                      "flex w-full items-center gap-4 px-6 py-4 text-left transition-colors " +
                      (active ? "bg-tile-core-bg/40" : "hover:bg-border/10")
                    }
                  >
                    <span
                      className={
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold " +
                        (active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted")
                      }
                    >
                      {i + 1}
                    </span>
                    <IconTile
                      icon={Icon}
                      variant={active ? "core" : "neutral"}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {s.title}
                      </p>
                      <p className="text-sm text-muted">{s.description}</p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-xs text-muted">Involved system</p>
                      <Badge>{s.system}</Badge>
                    </div>
                    <span className="shrink-0 text-sm text-muted">
                      {s.referenceCount} references
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="border-t border-border px-6 py-4 text-center text-sm text-muted">
            End of journey
          </p>
        </Card>
      </div>
    </LorePageFrame>
  );
}

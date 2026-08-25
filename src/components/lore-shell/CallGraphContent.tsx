"use client";

import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { CallGraphDiagram } from "@/components/lore-shell/CallGraphDiagram";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { RepoIdentity } from "@/components/lore-shell/RepoIdentity";
import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { TopBar } from "@/components/lore-shell/TopBar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import { FilterPills } from "@/components/ui/FilterPills";
import { IconTile } from "@/components/ui/IconTile";
import { SearchInput } from "@/components/ui/SearchInput";
import { SourceLink } from "@/components/ui/SourceLink";
import { githubBlobUrl } from "@/github/urls";
import { formatPath } from "@/lib/format-path";
import {
  deriveCallGraphLayout,
  MAX_CALL_GRAPH_NODES,
} from "@/lore/call-graph-layout";
import type { CallableSignature, EntityId, Evidence, Lore } from "@/lore/model";
import { Braces, Component, Layers, Zap, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

const KIND_LABEL: Record<CallableSignature["kind"], string> = {
  function: "Function",
  method: "Method",
  arrow: "Arrow function",
  "function-expression": "Function expression",
};

const KIND_ICON: Record<CallableSignature["kind"], LucideIcon> = {
  function: Braces,
  method: Component,
  arrow: Zap,
  "function-expression": Layers,
};

const VIEWS = [
  { value: "chain", label: "Chain" },
  { value: "diagram", label: "Diagram" },
  { value: "list", label: "List" },
];

const LIST_CAP = 200;
const SEARCH_MATCH_CAP = 20;

export interface CallGraphContentProps {
  owner: string;
  repo: string;
  lore: Lore;
  repoIdentity: {
    statusLabel: string;
    statusTone?: "success" | "alert";
    updatedLabel: string;
    branch: string;
    language: string;
  };
}

/**
 * Real Data Flow view (ADR-0012) — for a chosen function, shows what
 * statically calls it and what it calls, with argument/return types where
 * explicitly annotated in source. Laid out to mirror `docs/designs/data-flow.png`'s
 * numbered-step list / evidence right-rail pattern, but every step, badge,
 * and evidence entry here is read from `lore.callableSignatures`/`callEdges`
 * — there is no journey narrative or system-boundary content, since the
 * analyzer has no basis to produce one (see ADR-0012's rationale for why
 * this page isn't the mockup's literal service-journey content). Search
 * picks the focus function; clicking any step, list row, or diagram node
 * re-focuses (the "drilldown" requirement) rather than navigating away.
 */
export function CallGraphContent({
  owner,
  repo,
  lore,
  repoIdentity,
}: CallGraphContentProps) {
  const { callableSignatures, callEdges } = lore;
  const [query, setQuery] = useState("");
  const [view, setView] = useState("chain");
  const [focusId, setFocusId] = useState<EntityId | undefined>(
    callableSignatures[0]?.id
  );

  const byId = useMemo(
    () => new Map(callableSignatures.map((s) => [s.id, s])),
    [callableSignatures]
  );
  const focus = focusId ? byId.get(focusId) : undefined;

  const edgeCountById = useMemo(() => {
    const counts = new Map<EntityId, number>();
    for (const edge of callEdges) {
      counts.set(edge.callerId, (counts.get(edge.callerId) ?? 0) + 1);
      counts.set(edge.calleeId, (counts.get(edge.calleeId) ?? 0) + 1);
    }
    return counts;
  }, [callEdges]);
  const referencesFor = (id: EntityId) => 1 + (edgeCountById.get(id) ?? 0);

  const totalReferences = callableSignatures.length + callEdges.length;

  const layout = useMemo(
    () =>
      focusId
        ? deriveCallGraphLayout(focusId, callableSignatures, callEdges)
        : null,
    [focusId, callableSignatures, callEdges]
  );
  const chainNodes = useMemo(
    () =>
      layout ? [...layout.nodes].sort((a, b) => a.x - b.x || a.y - b.y) : [],
    [layout]
  );
  const chainIndex = focusId
    ? chainNodes.findIndex((n) => n.id === focusId)
    : -1;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return callableSignatures
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, SEARCH_MATCH_CAP);
  }, [callableSignatures, query]);

  const listItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? callableSignatures.filter((s) => s.name.toLowerCase().includes(q))
      : callableSignatures;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [callableSignatures, query]);

  const callerEdges = useMemo(
    () => callEdges.filter((e) => e.calleeId === focusId),
    [callEdges, focusId]
  );
  const calleeEdges = useMemo(
    () => callEdges.filter((e) => e.callerId === focusId),
    [callEdges, focusId]
  );
  const callers = useMemo(
    () =>
      callerEdges
        .map((e) => byId.get(e.callerId))
        .filter((s): s is CallableSignature => s !== undefined),
    [callerEdges, byId]
  );
  const callees = useMemo(
    () =>
      calleeEdges
        .map((e) => byId.get(e.calleeId))
        .filter((s): s is CallableSignature => s !== undefined),
    [calleeEdges, byId]
  );
  const focusEvidence: Evidence[] = useMemo(
    () =>
      focus
        ? [
            ...focus.evidence,
            ...callerEdges.flatMap((e) => e.evidence),
            ...calleeEdges.flatMap((e) => e.evidence),
          ]
        : [],
    [focus, callerEdges, calleeEdges]
  );

  const commitSha = lore.snapshot.commitSha;
  const sourceUrl = (location: Parameters<typeof githubBlobUrl>[3]) =>
    githubBlobUrl(owner, repo, commitSha, location);

  function selectFocus(id: EntityId) {
    setFocusId(id);
    setQuery("");
  }

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
          actions={<ReanalyzeButton owner={owner} repo={repo} />}
        />
      }
      rightRail={
        focus ? (
          <RightRailShell
            title={
              <div className="flex w-full items-center justify-between gap-3">
                <span className="truncate">{focus.name}</span>
                {chainIndex >= 0 && (
                  <span className="shrink-0 text-xs font-normal text-muted">
                    Step {chainIndex + 1} of {chainNodes.length}
                  </span>
                )}
              </div>
            }
          >
            <Badge variant="primary">{KIND_LABEL[focus.kind]}</Badge>

            <div className="mt-3">
              <SourceLink location={focus.location} sourceUrl={sourceUrl} />
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">Parameters</p>
              {focus.parameters.length === 0 ? (
                <p className="mt-1 text-sm text-muted">No parameters.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {focus.parameters.map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <code className="font-mono text-xs text-foreground">
                        {p.name}
                      </code>
                      {p.typeAnnotation ? (
                        <code className="font-mono text-xs text-muted">
                          : {p.typeAnnotation}
                        </code>
                      ) : (
                        <CertaintyBadge certainty="unknown" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">Return type</p>
              <div className="mt-1">
                {focus.returnType ? (
                  <code className="font-mono text-xs text-foreground">
                    {focus.returnType}
                  </code>
                ) : (
                  <CertaintyBadge certainty="unknown" />
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">
                Called by ({callers.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {callers.map((c) => (
                  <li key={c.id} className="text-sm">
                    <button
                      type="button"
                      onClick={() => selectFocus(c.id)}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.name}
                    </button>{" "}
                    <span className="text-xs text-muted">
                      {formatPath(c.location.filePath)}
                    </span>
                  </li>
                ))}
                {callers.length === 0 && (
                  <li className="text-sm text-muted">
                    No statically resolvable callers were found.
                  </li>
                )}
              </ul>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">
                Calls ({callees.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {callees.map((c) => (
                  <li key={c.id} className="text-sm">
                    <button
                      type="button"
                      onClick={() => selectFocus(c.id)}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.name}
                    </button>{" "}
                    <span className="text-xs text-muted">
                      {formatPath(c.location.filePath)}
                    </span>
                  </li>
                ))}
                {callees.length === 0 && (
                  <li className="text-sm text-muted">
                    No statically resolvable calls were found.
                  </li>
                )}
              </ul>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">
                Evidence ({focusEvidence.length})
              </p>
              <ul className="mt-3 space-y-3">
                {focusEvidence.map((e, i) => (
                  <li key={i}>
                    {e.location && (
                      <p className="font-mono text-xs">
                        <SourceLink
                          location={e.location}
                          sourceUrl={sourceUrl}
                        />
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted">{e.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </RightRailShell>
        ) : undefined
      }
    >
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-semibold text-foreground">
              Data Flow
            </h1>
            <p className="mt-2 text-base text-muted">
              Statically resolved calls between named functions and methods —
              which function mechanically calls which, not the values passed
              between them.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <FilterPills
              aria-label="View mode"
              options={VIEWS}
              value={view}
              onChange={setView}
            />
            <span className="text-xs text-muted">
              Derived from {totalReferences} references
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted">
          Method calls, callbacks, and dynamic dispatch aren&apos;t resolved —
          real repositories dominated by these call shapes will show sparser
          graphs than reading the code directly would suggest.
        </p>

        <div className="mt-6">
          <SearchInput
            placeholder="Search functions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
          />
        </div>

        {view === "list" ? (
          <Card className="mt-4 p-0">
            <ul className="divide-y divide-border">
              {listItems.slice(0, LIST_CAP).map((s) => {
                const Icon = KIND_ICON[s.kind];
                const active = s.id === focusId;
                const refs = referencesFor(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => selectFocus(s.id)}
                      className={
                        "flex w-full items-center gap-4 px-6 py-4 text-left transition-colors " +
                        (active ? "bg-tile-core-bg/40" : "hover:bg-border/10")
                      }
                    >
                      <IconTile
                        icon={Icon}
                        variant={active ? "core" : "neutral"}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {s.name}
                        </p>
                        <p className="truncate text-sm text-muted">
                          {formatPath(s.location.filePath)}
                        </p>
                      </div>
                      <Badge>{KIND_LABEL[s.kind]}</Badge>
                      <span className="shrink-0 text-sm text-muted">
                        {refs} reference{refs === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                );
              })}
              {listItems.length === 0 && (
                <li className="px-6 py-4 text-sm text-muted">
                  No functions match &quot;{query}&quot;.
                </li>
              )}
            </ul>
            {listItems.length > LIST_CAP && (
              <p className="border-t border-border px-6 py-3 text-center text-xs text-muted">
                Showing the first {LIST_CAP} of {listItems.length} matching
                functions — refine your search to narrow the list.
              </p>
            )}
          </Card>
        ) : query.trim() ? (
          <Card className="mt-3 p-0">
            {matches.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">
                No functions match &quot;{query}&quot;.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => selectFocus(m.id)}
                      className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-border/10"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {m.name}
                      </span>
                      <span className="text-xs text-muted">
                        {formatPath(m.location.filePath)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : !focus ? (
          <Card className="mt-6 p-6 text-center text-sm text-muted">
            No named functions were detected. Call graph analysis currently
            covers JavaScript and TypeScript projects only.
          </Card>
        ) : view === "diagram" ? (
          <div className="mt-6">
            <CallGraphDiagram
              focusId={focus.id}
              signatures={callableSignatures}
              edges={callEdges}
              onSelect={selectFocus}
            />
          </div>
        ) : (
          <Card className="mt-4 p-0">
            <ol className="divide-y divide-border">
              {chainNodes.map((node, i) => {
                const Icon = KIND_ICON[node.kind];
                const active = node.id === focusId;
                const refs = referencesFor(node.id);
                return (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => selectFocus(node.id)}
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
                          {node.name}
                        </p>
                        <p className="truncate text-sm text-muted">
                          {formatPath(node.location.filePath)}
                        </p>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-xs text-muted">Kind</p>
                        <Badge>{KIND_LABEL[node.kind]}</Badge>
                      </div>
                      <span className="shrink-0 text-sm text-muted">
                        {refs} reference{refs === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {layout?.truncated && (
              <p className="border-t border-border px-6 py-4 text-center text-xs text-muted">
                This function&apos;s full call chain has more than{" "}
                {MAX_CALL_GRAPH_NODES} related functions — showing direct
                callers and callees only.
              </p>
            )}
          </Card>
        )}
      </div>
    </LorePageFrame>
  );
}

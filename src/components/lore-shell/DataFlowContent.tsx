"use client";

import { ReanalyzeButton } from "@/components/ReanalyzeButton";
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
  buildCalleesIndex,
  deriveCallTreeRootIds,
  resolveUniqueSignatures,
} from "@/lore/call-tree";
import { describeImportanceReason } from "@/lore/describe-importance";
import type {
  CallableSignature,
  EntityId,
  Evidence,
  FunctionImportance,
  Lore,
} from "@/lore/model";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Component,
  Layers,
  Zap,
  type LucideIcon,
} from "lucide-react";
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

const ROLE_LABEL: Record<FunctionImportance["roles"][number], string> = {
  ENTRY_POINT: "Entry point",
  ORCHESTRATOR: "Orchestrator",
  STATE_CONTROLLER: "State controller",
  DATA_TRANSFORMER: "Data transformer",
  BOUNDARY: "Boundary",
  EVENT_HANDLER: "Event handler",
  RENDERER: "Renderer",
  UTILITY: "Utility",
};

const VECTOR_LABEL: Record<keyof FunctionImportance["vector"], string> = {
  reachability: "Reachability",
  orchestration: "Orchestration",
  dataInfluence: "Data influence",
  stateAuthority: "State authority",
  boundaryInfluence: "Boundary influence",
  structuralCentrality: "Structural centrality",
};

const VIEWS = [
  { value: "chain", label: "Chain" },
  { value: "list", label: "List" },
];

const SORTS = [
  { value: "name", label: "Name" },
  { value: "importance", label: "Importance" },
];

const LIST_CAP = 200;
const SEARCH_MATCH_CAP = 20;
const MAX_CHAIN_INDENT_DEPTH = 4;

export interface DataFlowContentProps {
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
export function DataFlowContent({
  owner,
  repo,
  lore,
  repoIdentity,
}: DataFlowContentProps) {
  const { callableSignatures, callEdges, functionImportance, behaviorNodes } =
    lore;
  const [query, setQuery] = useState("");
  const [view, setView] = useState("chain");
  const [sort, setSort] = useState("name");
  const [focusId, setFocusId] = useState<EntityId | undefined>(
    callableSignatures[0]?.id
  );

  const byId = useMemo(
    () => new Map(callableSignatures.map((s) => [s.id, s])),
    [callableSignatures]
  );
  const focus = focusId ? byId.get(focusId) : undefined;

  const importanceById = useMemo(
    () => new Map(functionImportance.map((fi) => [fi.functionId, fi])),
    [functionImportance]
  );
  const focusImportance = focusId ? importanceById.get(focusId) : undefined;
  const stateNameById = useMemo(
    () =>
      new Map(
        behaviorNodes
          .filter((n) => n.kind === "state")
          .map((n) => [n.id, n.name])
      ),
    [behaviorNodes]
  );

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

  const chainRootIds = useMemo(
    () =>
      deriveCallTreeRootIds(
        callableSignatures,
        callEdges,
        lore.publicContracts,
        lore.entryPoints
      ),
    [callableSignatures, callEdges, lore.publicContracts, lore.entryPoints]
  );
  const calleesOf = useMemo(() => buildCalleesIndex(callEdges), [callEdges]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  function toggleExpanded(pathKey: string) {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  }

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
    return [...filtered].sort((a, b) =>
      sort === "importance"
        ? (importanceById.get(b.id)?.score ?? 0) -
          (importanceById.get(a.id)?.score ?? 0)
        : a.name.localeCompare(b.name)
    );
  }, [callableSignatures, query, sort, importanceById]);

  const callerEdges = useMemo(
    () => callEdges.filter((e) => e.calleeId === focusId),
    [callEdges, focusId]
  );
  const calleeEdges = useMemo(
    () => callEdges.filter((e) => e.callerId === focusId),
    [callEdges, focusId]
  );
  const callers = useMemo(
    () => resolveUniqueSignatures(callerEdges, (e) => e.callerId, byId),
    [callerEdges, byId]
  );
  const callees = useMemo(
    () => resolveUniqueSignatures(calleeEdges, (e) => e.calleeId, byId),
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
          <RightRailShell title={focus.name}>
            <Badge variant="primary">{KIND_LABEL[focus.kind]}</Badge>

            <div className="mt-3">
              <SourceLink location={focus.location} sourceUrl={sourceUrl} />
            </div>

            {focusImportance && (
              <div className="mt-6 border-t border-border pt-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-foreground">
                    Importance
                  </p>
                  <span className="text-2xl font-semibold text-foreground">
                    {focusImportance.score}
                  </span>
                </div>
                {focusImportance.roles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {focusImportance.roles.map((role) => (
                      <Badge key={role}>{ROLE_LABEL[role]}</Badge>
                    ))}
                  </div>
                )}
                <ul className="mt-3 space-y-1">
                  {(
                    Object.entries(focusImportance.vector) as [
                      keyof typeof focusImportance.vector,
                      number,
                    ][]
                  ).map(([dimension, value]) => (
                    <li
                      key={dimension}
                      className="flex items-center gap-2 text-xs text-muted"
                    >
                      <span className="w-36 shrink-0">
                        {VECTOR_LABEL[dimension]}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${value}%` }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right text-foreground">
                        {value}
                      </span>
                    </li>
                  ))}
                </ul>
                {focusImportance.reasons.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-muted">
                    {focusImportance.reasons.map((reason, i) => (
                      <li key={i}>
                        • {describeImportanceReason(reason, stateNameById)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex flex-wrap items-center gap-2 w-full justify-between">
              <FilterPills
                aria-label="View mode"
                options={VIEWS}
                value={view}
                onChange={setView}
              />
              {view === "list" && (
                <FilterPills
                  aria-label="Sort by"
                  options={SORTS}
                  value={sort}
                  onChange={setSort}
                />
              )}
            </div>
            <span className="text-sm text-muted">
              Derived from {totalReferences} references
            </span>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          Method calls, callbacks, and dynamic dispatch aren&apos;t resolved —
          real repositories dominated by these call shapes will show sparser
          graphs than reading the code directly would suggest.
        </p>

        <div className="mt-6">
          <label htmlFor="function-search" className="sr-only">
            Search functions
          </label>
          <SearchInput
            id="function-search"
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
                const importance = importanceById.get(s.id);
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
                      {importance && importance.roles[0] && (
                        <Badge variant="primary">
                          {ROLE_LABEL[importance.roles[0]]}
                        </Badge>
                      )}
                      <Badge>{KIND_LABEL[s.kind]}</Badge>
                      {importance && (
                        <span className="shrink-0 text-sm font-semibold text-foreground">
                          {importance.score}
                        </span>
                      )}
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
              <p className="border-t border-border px-6 py-3 text-center text-sm text-muted">
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
            No named functions were detected. Data Flow analysis currently
            covers JavaScript and TypeScript projects only.
          </Card>
        ) : (
          <Card className="mt-4 p-0">
            <ul className="divide-y divide-border">
              {chainRootIds.map((id) => (
                <ChainTreeRow
                  key={id}
                  id={id}
                  ancestorIds={[]}
                  depth={0}
                  byId={byId}
                  calleesOf={calleesOf}
                  expandedPaths={expandedPaths}
                  onToggle={toggleExpanded}
                  focusId={focusId}
                  onSelect={selectFocus}
                  referencesFor={referencesFor}
                />
              ))}
            </ul>
          </Card>
        )}
      </div>
    </LorePageFrame>
  );
}

interface ChainTreeRowProps {
  id: EntityId;
  ancestorIds: EntityId[];
  depth: number;
  byId: Map<EntityId, CallableSignature>;
  calleesOf: Map<EntityId, EntityId[]>;
  expandedPaths: Set<string>;
  onToggle: (pathKey: string) => void;
  focusId: EntityId | undefined;
  onSelect: (id: EntityId) => void;
  referencesFor: (id: EntityId) => number;
}

/**
 * One row of the Chain tab's tree: a function that can be expanded (if it
 * has callees) to show what it calls, arbitrarily nested. `ancestorIds`
 * tracks the branch's path from the root so a recursive/mutually-recursive
 * callee can be detected and rendered as a non-expandable "already shown
 * above" leaf instead of looping.
 */
function ChainTreeRow({
  id,
  ancestorIds,
  depth,
  byId,
  calleesOf,
  expandedPaths,
  onToggle,
  focusId,
  onSelect,
  referencesFor,
}: ChainTreeRowProps) {
  const signature = byId.get(id);
  if (!signature) return null;

  const pathKey = [...ancestorIds, id].join(">");
  const childIds = calleesOf.get(id) ?? [];
  const hasChildren = childIds.length > 0;
  const expanded = hasChildren && expandedPaths.has(pathKey);
  const active = id === focusId;
  const Icon = KIND_ICON[signature.kind];
  const refs = referencesFor(id);
  const nextAncestorIds = [...ancestorIds, id];

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onSelect(id);
          if (hasChildren) onToggle(pathKey);
        }}
        aria-expanded={hasChildren ? expanded : undefined}
        className={
          "flex w-full items-center gap-3 py-4 pr-6 text-left transition-colors " +
          (active ? "bg-tile-core-bg/40" : "hover:bg-border/10")
        }
        style={{
          paddingLeft: `${1.5 + Math.min(depth, MAX_CHAIN_INDENT_DEPTH) * 1.5}rem`,
        }}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted">
          {hasChildren &&
            (expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            ))}
        </span>
        <IconTile icon={Icon} variant={active ? "core" : "neutral"} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {signature.name}
          </p>
          <p className="truncate text-sm text-muted">
            {formatPath(signature.location.filePath)}
          </p>
        </div>
        <Badge>{KIND_LABEL[signature.kind]}</Badge>
        <span className="shrink-0 text-sm text-muted">
          {refs} reference{refs === 1 ? "" : "s"}
        </span>
      </button>
      {expanded && (
        <ul className="divide-y divide-border">
          {childIds.map((childId) => {
            if (nextAncestorIds.includes(childId)) {
              const childSignature = byId.get(childId);
              if (!childSignature) return null;
              return (
                <li key={childId}>
                  <button
                    type="button"
                    onClick={() => onSelect(childId)}
                    className="flex w-full items-center gap-3 py-3 pr-6 text-left text-sm text-muted italic hover:bg-border/10"
                    style={{
                      paddingLeft: `${1.5 + Math.min(depth + 1, MAX_CHAIN_INDENT_DEPTH) * 1.5}rem`,
                    }}
                  >
                    <span className="h-4 w-4 shrink-0" />
                    {childSignature.name} — already shown above
                  </button>
                </li>
              );
            }
            return (
              <ChainTreeRow
                key={childId}
                id={childId}
                ancestorIds={nextAncestorIds}
                depth={depth + 1}
                byId={byId}
                calleesOf={calleesOf}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
                focusId={focusId}
                onSelect={onSelect}
                referencesFor={referencesFor}
              />
            );
          })}
        </ul>
      )}
    </li>
  );
}

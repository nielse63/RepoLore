# Repo Lore Non-Goals

This document protects focus. A non-goal is not necessarily a bad idea; it is an explicit decision not to spend scarce product and engineering capacity on it now.

`docs/product/mission.md` is the source of truth when another document appears to conflict with this one.

## Not the Product

Repo Lore is not:

- a general-purpose documentation generator;
- an AI chatbot that answers questions without inspectable evidence;
- a replacement for source control, code search, an IDE, or engineering judgment;
- a complete architectural reconstruction of arbitrary software;
- a guarantee that a proposed change is safe;
- a dashboard of activity metrics or arbitrary health scores;
- a platform for manually authored internal wikis.

## Explicit Exclusions

Repo Lore does not require:

- private repository support;
- user accounts, organizations, or team invitations;
- billing or fine-grained plans;
- branch or commit selection;
- headless scheduled refresh, webhooks, or real-time synchronization — anything that runs unattended, on a timer or a push notification, for a repository nobody is currently visiting; a deliberate, narrow exception is a pull-triggered, staleness-gated background re-analysis attempt tied to an actual page view, by a person rather than a crawler (ADR-0017), of a repository whose latest analysis is more than a day old, rate-limited per repository via the existing manual re-analysis claim so it can never run unattended or faster than that limit — see ADR-0013;
- notifications — on hold as of 2026-10-23 (#96). Email is ruled out (stored contact details, deliverability, compliance). Un-hold only with demonstrated demand plus passing the Scope Rule below, and then only for the person who submitted the repository; the stable Lore URL already covers "leave and come back". Public copy must not promise notifications;
- AI-generated explanations or chat;
- commit and pull-request history analysis — a deliberate, narrow exception is the History page's deterministic, non-AI commit-diff classification (no narrative/LLM synthesis, no before/after diagram), see ADR-0010; this does not license pull-request analysis, architectural-diff narrative, or AI-generated history explanations, which remain excluded;
- architectural diffs or pull-request impact analysis;
- complete execution-flow or data-flow tracing — a deliberate, narrow exception is the Data Flow page's static, syntactic call-graph extraction (which function mechanically calls which, not value-level tracing of what flows between them), see ADR-0012. Amended 2026-10-23 (#92): Data Flow request paths may also show, syntactically, which argument expression is passed to which callee parameter at a call site, ordered by call-site source position (labeled "source order", not proven runtime order), plus syntactic guard branches; each mapping states only "this expression is passed here", never a runtime value. This does not license value-level or runtime data-flow tracing (what value actually reaches a call, across assignments, aliasing, or execution), which remains excluded, nor any Python request path until a Python call graph exists;
- indirect change-impact guarantees;
- generalized health findings or numeric health scores — this also binds Systems, which as of 2026-10-23 become responsibility groupings that can span several structural areas, named rules-first from evidence, with every membership Inferred (#90, superseding ADR-0014's one-area-per-System model). Systems describe what a group of code is responsible for, never how important, critical, or healthy it is, and optional AI phrasing of their names is deferred and never required (#97);
- interactive dependency graphs (drag-to-reposition, node/edge connecting, element selection, a minimap, multi-select, click-to-filter, or similar) — at the file level, or otherwise; the area-level relationship diagram is a scoped exception, limited to pan/zoom/`fitView` navigation only (originally fully non-interactive under ADR-0009; amended by ADR-0016 to allow pan/zoom once the product owner found taller diagrams didn't fit the fixed-height viewport — dragging, connecting, and selection remain explicitly disabled), and a second, separately-scoped exception is the Data Flow page's interactive, client-side, search-and-drilldown function-call graph, bounded to one function's local neighborhood at a time, see ADR-0012; neither exception licenses file-level graphs, or interactivity generally beyond what each ADR specifically scopes;
- manual documentation editing;
- arbitrary repository configuration or user-created analysis rules;
- complete framework-specific behavioral interpretation;
- a generalized analyzer plugin framework;
- support for languages beyond TypeScript, JavaScript, and Python.

A plain list or table is acceptable when it communicates the relationship clearly.

## Repository Shapes Not Fully Supported Initially

Initial support may be incomplete for:

- notebook-centric repositories;
- massive monorepositories;
- projects that must execute or build successfully to reveal their structure;
- systems dominated by generated-at-runtime structure;
- complex metaprogramming or custom module loaders;
- native extension internals;
- dynamic imports and reflection that static evidence cannot resolve;
- unsupported languages or frameworks within mixed-language repositories.

Repo Lore should identify these limitations and explain their effect. It should not silently present a partial analysis as complete.

## Deferred Customer Segments

Repo Lore is not optimized for large enterprises or highly regulated procurement environments. Defer:

- SAML and enterprise SSO;
- complex RBAC;
- audit-log products;
- on-premises or customer-managed deployment;
- custom contracts and procurement workflows;
- organization-wide analytics;
- high-touch implementation services;
- Jira, Slack, Notion, and similar integrations;
- arbitrary plugin ecosystems.

These capabilities should be considered only after validated demand from customers who fit the business and maintenance model.

## Technical Complexity to Avoid

Do not introduce these without a current, measured need:

- microservices or distributed worker fleets;
- Kubernetes;
- event sourcing;
- speculative multi-region architecture;
- infrastructure sized for hypothetical scale;
- a custom design system;
- abstractions for hypothetical future analyzers;
- executing code from analyzed repositories;
- long-term retention of repository contents without a product need — a deliberate, narrow exception (decided 2026-10-29, #93) is bounded source-excerpt windows saved at analysis time for a fixed set of key locations (Start Here items, entry points, request-path steps), keyed to the analyzed commit, with a per-window line limit and a per-run size cap and binary/minified files skipped; every other location keeps a commit-pinned GitHub link, and view-time GitHub fetches remain excluded.

Use small extension seams only when they are cheap, visible, and justified by an existing requirement.

## Scope Rule

Before moving a non-goal into the roadmap, require evidence that it:

1. materially improves an unfamiliar engineer’s mental model;
2. cannot be delivered by a smaller capability;
3. has validated customer demand;
4. fits a one-person operating model;
5. is more valuable than deepening the Start Here path, major-area model, evidence, or language support already promised.

If those conditions are not met, keep it deferred.

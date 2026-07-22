# Repo Lore Product Principles

Repo Lore builds a living, evidence-backed mental model of a software repository. These principles govern product, design, and technical decisions.

The MVP specification defines current scope. These principles explain how to make decisions within and beyond that scope.

## 1. Optimize for Time to Confidence

Repo Lore should shorten the time required for an unfamiliar engineer to form a correct orientation and choose a justified next step.

The MVP targets **orientation confidence**: within 15 minutes of opening a Lore, an experienced engineer should be able to identify probable entry points, major structural areas, important direct relationships, and a sensible place to begin investigating a change.

The product should not maximize the amount of extracted data. It should select the information that most improves the user’s mental model.

**Decision test:** What will the user understand or decide faster because this exists?

## 2. Make “Start Here” the Primary Experience

An unfamiliar engineer needs a purposeful reading path, not a ranking of large, central, or frequently imported files.

The Start Here path should use multiple evidence signals and provide useful coverage across:

- probable execution or package entry points;
- composition and configuration;
- major structural areas;
- important public contracts;
- representative tests when useful.

Every recommendation must explain why the user should inspect it. If an item has no evidence-backed reason, it does not belong in the path.

**Decision test:** Does this improve the order, coverage, or explanation of what the user should inspect first?

## 3. Improve the Mental Model, Not the Inventory

Individual files and symbols matter because of how they participate in a larger system.

Prioritize questions such as:

- What are the major areas?
- Where does execution begin?
- Which boundaries are declared or strongly supported?
- How do areas depend on one another?
- What public contracts connect them?
- Where are important behaviors verified?
- Where should investigation continue?

Avoid features that expose data without helping the user decide what matters.

**Decision test:** Does this reveal structure or meaning, or merely add another list?

## 4. Evidence Before AI

Important conclusions must begin with observable evidence from source, imports, exports, configuration, repository structure, tests, framework conventions, metadata, and—later—version-control history.

AI may summarize or explain a verified model when doing so improves comprehension. It must not replace deterministic extraction, invent architectural intent, or present speculation as fact.

The MVP does not require AI-generated prose. Deterministic, template-based explanations are preferable when they are clear and trustworthy.

**Decision test:** Can the conclusion be produced and verified without trusting a model’s unsupported interpretation?

## 5. Make Certainty Explicit

Repo Lore should distinguish:

- **Detected:** directly supported by deterministic evidence;
- **Inferred:** supported by a stated heuristic or combination of signals;
- **Unknown:** not determined confidently;
- **Unsupported:** outside current analysis capability.

Do not use pseudo-precise confidence percentages. A useful certainty label, clear reasoning, and accessible evidence are more honest.

High confidence in a wrong answer is worse than a visible gap.

**Decision test:** Can the user tell why Repo Lore believes this and how the analysis could be wrong or incomplete?

## 6. Explain Relationships Selectively

Understanding comes from relationships, but showing every extracted edge creates noise.

Prioritize relationships that explain:

- direct dependencies between major areas;
- widely depended-upon areas;
- public surfaces;
- implementation-to-test connections;
- dependencies that cross apparent boundaries;
- statically observable cross-language connections.

Plain tables and lists are sufficient until a graph materially improves comprehension.

**Decision test:** Will this relationship help the user understand the system or choose where to investigate?

## 7. Prefer Declared Boundaries and Conservative Inference

Use the strongest available boundary evidence in this order:

1. declared packages, workspaces, source roots, applications, manifests, and public exports;
2. established language and framework conventions;
3. relationship-supported groupings derived from imports and exports;
4. clear structural fallback when semantic meaning cannot be justified.

Do not invent business-domain names or responsibilities. A directory named `billing` supports a billing area; it does not prove a broader revenue-management architecture.

**Decision test:** Is the boundary supported by repository evidence, and is any semantic interpretation appropriately limited?

## 8. One Lore Model, Multiple Languages

TypeScript, JavaScript, and Python should populate a shared language-neutral Lore model. They should not produce unrelated report formats or inconsistent value.

Every advertised language must satisfy the same minimum contract: orientation, a meaningful Start Here path, major areas, probable entry points, direct relationships, and evidence with gaps.

Mixed-language repositories should be presented as one repository-level model, but cross-language runtime relationships must not be invented from coexistence alone.

**Decision test:** Does this strengthen the shared product model while preserving language-specific evidence?

## 9. Keep the Experience Automatic and Calm

For the public MVP, pasting a GitHub repository URL should be enough. Do not require accounts, repository configuration, GitHub Actions, webhooks, scripts, CI integration, or manual documentation.

Use progressive disclosure. Lead with a readable overview and short reading path, then let users inspect relationships and evidence. Avoid dense dashboards, arbitrary metrics, and visual complexity that does not improve comprehension.

**Decision test:** Does this reduce setup or cognitive load without hiding meaningful uncertainty?

## 10. Build for a Sustainable Small Business

Repo Lore must remain operable by one engineer working roughly 5–8 focused hours per week, with no more than 10 hours of ongoing weekly maintenance.

Prefer:

- depth over breadth;
- mature libraries and managed services;
- one clear workflow over many configurable workflows;
- full recomputation before premature incremental complexity;
- boring, observable infrastructure;
- explicit limits on repository size, file count, time, and concurrency;
- reversible decisions until evidence justifies commitment.

Do not build enterprise requirements, speculative scalability, or support-intensive customization before customer evidence demands them.

**Decision test:** Can one person operate, debug, and evolve this capability for years?

## Product Preferences

When several approaches satisfy the principles, prefer:

- trustworthy orientation over exhaustive analysis;
- coverage in the reading path over raw importance ranking;
- deterministic evidence over AI interpretation;
- relationships over inventories;
- honest gaps over forced conclusions;
- shared terminology over audience-specific truth;
- stable concepts over transient metrics;
- progressive disclosure over dense dashboards;
- simple tables over premature visualization;
- sensible defaults over configuration;
- the smallest complete vertical slice over a broad partial platform.

## Feature Decision Checklist

Before adding a feature, dependency, service, abstraction, or integration, answer:

1. Which current user question does it answer?
2. How does it reduce time to confidence?
3. Does it strengthen Start Here, major areas, entry points, relationships, or evidence?
4. What observable evidence supports its conclusions?
5. How will certainty and limitations be communicated?
6. What is the simplest version that delivers the outcome?
7. What customer setup or maintenance does it require?
8. What ongoing operational burden and cost does it create?
9. Can it be deferred until customer demand is demonstrated?
10. Would removing it make the current product promise substantially weaker?

If the answers are not convincing, reduce the idea, classify it as Soon/Later/Maybe Never, or reject it.

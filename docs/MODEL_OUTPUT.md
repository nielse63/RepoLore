# The Repo Lore Model and MVP Output

## Purpose

A Lore is a living, evidence-backed mental model of a software repository.

It is not a generated document, file inventory, dependency dump, or AI summary. Those may be representations of the model. The model itself is the durable product: a structured set of repository facts, relationships, interpretations, evidence, and explicit gaps tied to an exact analysis snapshot.

The MVP output should help an unfamiliar engineer move from “I do not know where anything is” to a correct, justified orientation.

## MVP Value Contract

For a conventionally structured repository in a supported language, a Lore must provide:

1. repository orientation;
2. a meaningful Start Here reading path;
3. a concise major-area model;
4. probable entry points and public surfaces;
5. important direct dependency relationships;
6. traceable evidence and explicit analysis gaps.

If Repo Lore can list files and imports but cannot create a useful reading path, the analysis has not met the MVP promise.

## Analysis Snapshot

The user supplies a public GitHub repository URL. Repo Lore:

1. validates and normalizes the URL;
2. resolves the repository’s default branch;
3. analyzes source at the latest commit on that branch;
4. records the exact commit SHA, analysis timestamp, and analyzer version;
5. publishes the result at a stable repository-specific Lore URL;
6. permits manual reanalysis when the repository changes.

The MVP does not require account creation, branch selection, commit selection, scheduled refresh, GitHub Actions, webhooks, repository configuration, or CI integration.

Every displayed result belongs to a specific snapshot. The interface should make that identity visible so users know exactly which repository state supports the conclusions.

## Intended Audience

### Primary: Experienced Engineers

An unfamiliar engineer should be able to:

- recognize the repository’s project shapes and supported technologies;
- find likely execution and reading entry points;
- understand its major structural areas;
- see important direct dependencies and dependents;
- connect implementation areas to relevant tests when detectable;
- choose where to begin investigating a change;
- verify important conclusions against evidence;
- recognize uncertainty and unsupported areas.

### Secondary: Engineering Managers

Engineering managers should use the same Lore to understand broad system shape, discuss areas with shared terminology, recognize important dependencies and gaps, and participate in planning conversations with better context.

The MVP does not require a separate management dashboard.

## MVP Lore Page

The page should be calm, readable, and progressively disclosed. The initial view should prioritize the reading path and structural model, not a dashboard of metrics.

### 1. What Is This?

Provide concise repository orientation:

- repository name and available description;
- analyzed default branch and commit SHA;
- analysis timestamp and analyzer version;
- detected projects, packages, applications, or libraries;
- recognized supported languages and frameworks;
- relevant build, runtime, package, and test configuration;
- important unsupported technologies or analysis limitations.

Clearly distinguish repository-provided metadata from conclusions produced by Repo Lore.

### 2. Start Here

Start Here is the primary MVP experience.

Present an ordered path of approximately three to seven source locations or structural areas. Adapt the path to available evidence; do not force a fixed template when the repository does not support it.

The path should help the user answer, where possible:

1. What starts the system?
2. Where is the system assembled or configured?
3. What are its primary internal areas?
4. Which contracts connect those areas?
5. Where can representative behavior be observed or verified?

Each recommendation must contain:

- the source location or structural area;
- what it appears to represent;
- why the user should inspect it at this point in the sequence;
- the evidence supporting the recommendation;
- its certainty category.

Example:

> Start with `/src/index.ts`. The package manifest declares it as the public entry point, and it re-exports functionality from four primary internal modules. **Detected** from `package.json` and export statements.

Start Here must not be a list of the largest files or the highest dependency-centrality scores. It should seek useful coverage and avoid recommending several near-duplicate locations from the same area.

### 3. Major Areas

Present a concise set of evidence-backed structural areas.

An area may correspond to:

- a workspace package;
- a Python package;
- an application or library;
- a declared source root;
- a major source directory or module group;
- a confidently recognized framework area.

For each area, show:

- its name and location;
- why it was identified as an area;
- its probable responsibility, only when evidence supports one;
- important files, entry points, or public surface;
- direct dependencies;
- direct dependents;
- associated tests when detectable;
- relevant limitations.

Boundary detection should prefer:

1. declared packages, workspaces, source roots, and public exports;
2. established language or framework conventions;
3. relationship-supported groupings;
4. a conservative structural fallback.

Do not invent business-domain names or expand narrow evidence into broad architectural claims.

### 4. Entry Points and Public Surfaces

Identify probable:

- runtime entry points;
- application bootstrap locations;
- library and package entry points;
- public exports;
- command-line entry points;
- framework entry points;
- test entry points or configuration.

Each candidate should include:

- its kind;
- location;
- supporting source or configuration evidence;
- whether it was detected or inferred;
- meaningful ambiguity or alternatives.

### 5. Important Relationships

Show enough internal dependency information to explain how major areas connect.

Prioritize:

- direct dependencies between major areas;
- direct dependents of important areas;
- widely depended-upon areas;
- public exports that connect areas;
- implementation-to-test relationships;
- dependencies that cross apparent boundaries;
- statically observable cross-language connections.

Do not display every extracted edge by default. Use tables and short lists unless a richer visualization clearly improves the user’s mental model.

The MVP does not promise a complete runtime call graph or indirect change-impact guarantee.

### 6. Things to Investigate

Optionally surface a small number of high-confidence prompts that direct useful follow-up investigation.

Examples:

- an important area with no clear entry point;
- an area on which many others directly depend;
- an apparent boundary crossed by dependencies;
- an isolated structural area;
- a major implementation area with no detectable test relationship;
- an unsupported portion of the repository that materially limits conclusions.

Do not call this section “Health” unless the evidence supports a genuine health claim. Do not assign arbitrary scores, frame ordinary tradeoffs as defects, or manufacture findings to make a report look substantial.

### 7. Evidence and Gaps

Every important conclusion should expose:

- a certainty category;
- the evidence type;
- relevant file, symbol, or configuration location;
- a concise explanation of how the conclusion was produced;
- analysis limitations that could change the interpretation.

Use four certainty categories:

- **Detected:** directly supported by deterministic evidence;
- **Inferred:** supported by an explicit heuristic or combination of signals;
- **Unknown:** not determined confidently;
- **Unsupported:** outside current language, framework, or repository-shape support.

Avoid numeric confidence percentages. Prefer specific evidence and plain-language uncertainty.

## Shared Lore Domain Model

The durable model should use language-neutral concepts:

- **Repository** — the GitHub repository identity and metadata;
- **AnalysisSnapshot** — repository, default branch, commit SHA, timestamp, and analyzer version;
- **Project** — a detected application, package, or library within the repository;
- **SourceLocation** — a file and optional symbol or configuration path;
- **StructuralArea** — an evidence-backed major part of a project or repository;
- **EntryPoint** — a probable start of execution or exposed public surface;
- **Relationship** — a directed, evidence-backed connection between model entities;
- **PublicContract** — an exported or otherwise declared interface to an area;
- **TestRelationship** — a detectable connection between tests and implementation;
- **Recommendation** — an ordered Start Here item with rationale and evidence;
- **Finding** — a high-confidence prompt for further investigation;
- **Evidence** — the observable source supporting a fact or inference;
- **Gap** — an unknown, unsupported construct, or material limitation.

Language extractors produce evidence for these shared concepts. A relationship might be supported by a TypeScript import, a CommonJS `require`, or a Python import; the durable concept remains a dependency relationship.

The MVP needs a small shared analyzer contract, not a generalized plugin system:

- detect projects;
- discover relevant source;
- extract direct relationships;
- identify entry-point candidates;
- identify public surfaces;
- connect tests when possible;
- attach traceable evidence;
- report unknown and unsupported constructs.

## Language Support Contract

The public MVP supports TypeScript, JavaScript, and Python. All advertised languages must meet the same minimum value contract.

### JavaScript and TypeScript

Shared analysis should account for:

- ES module imports and exports;
- CommonJS imports and exports;
- `package.json` and package scripts;
- Node entry points;
- npm, pnpm, and Yarn workspaces;
- application and library layouts;
- source and test conventions.

TypeScript adds evidence from:

- `tsconfig.json`;
- TypeScript source resolution and path aliases;
- type-only imports;
- TypeScript-specific public contracts.

React is framework-aware enrichment within JavaScript and TypeScript analysis, not a separate product or report format.

### Python

Python analysis should account for:

- imports, packages, and modules;
- `pyproject.toml`, `setup.py`, and `setup.cfg`;
- requirements files;
- console-script and conventional application entry points;
- root-package and `src/` layouts;
- public package surfaces;
- pytest and unittest conventions.

Dynamic behavior will create gaps. Those gaps are acceptable when they are explicit and the remaining Lore still satisfies the minimum value contract.

### Mixed-Language Repositories

Detect supported projects independently and present them as parts of one repository-level model.

Do not infer that a JavaScript frontend communicates with a Python API merely because both exist. Cross-language relationships require observable evidence such as API configuration, shared schemas, generated clients, route references, or deployment configuration. Otherwise, present the relationship as unknown.

## Unsupported and Partial Analysis

An analysis may be partial for unsupported languages, complex metaprogramming, runtime-generated structures, custom loaders, notebook-centric projects, native extensions, massive monorepositories, or projects that require execution to reveal structure.

Repo Lore must:

- identify supported and unsupported areas;
- explain how gaps limit the reading path or area model;
- avoid extrapolating from analyzed areas into unsupported ones;
- avoid labeling a report fully supported when it cannot produce a useful Start Here path.

## Output Language

Prefer precise, calm wording:

- “Repo Lore detected…”
- “This appears to be…”
- “Evidence suggests…”
- “Start here because…”
- “This area directly depends on…”
- “Repo Lore could not determine…”
- “This part of the repository is not currently supported…”

Avoid:

- claims that Repo Lore fully understands the repository;
- unexplained static-analysis jargon;
- AI hype;
- unsupported intent or business-domain claims;
- pseudo-precise health or confidence scores;
- language that treats normal engineering tradeoffs as defects.

## Product Evolution

### MVP

- public GitHub repository input;
- latest default-branch commit;
- exact snapshot identity;
- TypeScript, JavaScript, and Python support;
- Start Here, major areas, entry points, direct relationships, evidence, and gaps;
- stable Lore URL;
- manual reanalysis.

### Soon

- scheduled default-branch checks;
- visible freshness and stale-state handling;
- stronger framework-aware enrichment;
- improved reading-path validation on representative repositories;
- one evidence-backed execution-flow capability after orientation is strong.

### Later

- private repositories and accounts;
- snapshot comparisons and architectural change explanations;
- careful commit and pull-request history analysis;
- deeper change-impact investigation;
- additional languages and frameworks;
- branch or commit-specific workflows when demand justifies them;
- AI explanations grounded in the verified Lore model.

### Maybe Never

- AI chat as the principal experience;
- arbitrary analyzer plugins or user-authored rules;
- manual documentation as a core workflow;
- enterprise complexity that does not serve the sustainable business model.

## Success Test

Give an experienced engineer an unfamiliar, reasonably sized repository in a supported language. Within 15 minutes of opening its Lore, the engineer should correctly identify:

- what kind of system it appears to be;
- probable execution or public entry points;
- its major structural areas;
- several important direct relationships;
- a justified place to begin investigating a hypothetical change;
- which conclusions are detected, inferred, unknown, or unsupported.

Measure time, correctness, supporting evidence, self-reported confidence, and whether confidence matches correctness.

The goal is not exhaustive repository knowledge. It is the shortest trustworthy path from unfamiliarity to justified confidence.

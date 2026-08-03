# MVP Specification

## Purpose

The Repo Lore MVP must deliver meaningful **time to confidence**.

Time to confidence is the time required for an unfamiliar engineer to form a correct, evidence-backed orientation to a repository and choose a justified place to begin investigating a change.

The MVP does not need to explain every behavior or reconstruct the repository’s complete architecture. It succeeds when it replaces the initial feeling of “I do not know where anything is” with a useful and justified mental model.

## MVP Thesis

> Repo Lore reduces time to confidence primarily by deciding what an unfamiliar engineer should inspect first and explaining why.

The “Start Here” path and major-area model are where the product’s primary value is created.

Every MVP capability should strengthen that outcome. Repository facts that do not improve the reading path, structural model, or supporting explanation should be treated as secondary or omitted.

## Core Promise

> Give Repo Lore a public GitHub repository. Within a few minutes, it will show you what the repository contains, where execution likely begins, which areas matter, how those areas directly relate, and where to start reading—with evidence for every important conclusion.

The MVP delivers **orientation confidence**, which is the first necessary stage of change confidence.

It does not yet promise that an engineer can safely implement an arbitrary change. That requires deeper execution-flow analysis, indirect impact analysis, runtime evidence, and historical context.

## Primary User

The primary MVP user is:

> An experienced engineer who has been asked to investigate an unfamiliar TypeScript, JavaScript, or Python codebase.

The engineer may be:

- Onboarding to an existing project
- Reassigned to another team’s repository
- Evaluating a dependency or integration
- Preparing to make an unfamiliar change
- Investigating a problem outside their usual area
- Helping another team understand its system
- Evaluating software during a technical review

Engineering managers are an important secondary audience. They should benefit from the same shared mental model, but the MVP does not require a separate management experience.

## Supported Languages

The public MVP supports:

1. TypeScript
2. JavaScript
3. Python

The supported languages should populate a shared, language-neutral Lore model. They should not produce three unrelated report formats.

Every advertised language must satisfy the same minimum value contract. A weak report that resembles a dressed-up file browser does not qualify as meaningful support.

## Language Families

### JavaScript and TypeScript

JavaScript and TypeScript should share most analysis behavior, including:

- ES module imports and exports
- CommonJS imports and exports
- `package.json`
- Package scripts
- Node entry points
- Workspace packages
- Source and test conventions
- Application and library structures

TypeScript analysis additionally includes:

- `tsconfig.json`
- TypeScript source resolution
- Path aliases
- Type-only imports
- TypeScript-specific public-contract evidence

React support should be framework-aware enrichment within the JavaScript and TypeScript analyzer. It should not be treated as a separate product or independent analyzer.

### Python

Python analysis should support evidence derived from:

- Python imports
- Packages and modules
- `pyproject.toml`
- `setup.py`
- `setup.cfg`
- Requirements files
- Console-script entry points
- Conventional application entry points
- Common `src/` layouts
- Package public surfaces
- Test locations and configuration

Python’s dynamic behavior means Repo Lore will sometimes know less than it can determine from a conventional JavaScript or TypeScript project. This is acceptable when uncertainty is explicit and the resulting Lore remains useful.

## Minimum Value Contract

An analysis should not be presented as fully supported unless Repo Lore can produce all of the following.

### 1. Repository Orientation

Repo Lore identifies:

- What kind of project appears to be present
- Its applications, packages, or libraries
- Recognized languages and frameworks
- Relevant build, runtime, package, and test configuration
- The analyzed default branch and commit
- Important limitations of the analysis

### 2. Meaningful Start Here Path

Repo Lore provides approximately three to seven recommended source locations.

Every recommendation explains:

- What the user should inspect
- What the location appears to represent
- Why Repo Lore recommends it
- What evidence supports the recommendation

### 3. Major-Area Model

Repo Lore identifies meaningful structural areas and shows:

- What each area contains
- Its important files or public surface
- Its probable responsibility, when evidence supports one
- Its direct dependencies
- Its direct dependents
- Its relationship to relevant tests, when detectable

### 4. Probable Entry Points

Repo Lore identifies probable:

- Runtime entry points
- Application bootstrap locations
- Library entry points
- Public exports
- Command-line entry points
- Framework entry points
- Test entry points or configuration

Each entry point includes its supporting evidence and meaningful uncertainty.

### 5. Direct Dependency Relationships

Repo Lore extracts enough internal dependency information to explain how the repository’s major areas connect.

The MVP does not require complete runtime call graphs or indirect change-impact guarantees.

### 6. Evidence and Gaps

Repo Lore provides:

- Links to relevant source or configuration
- Detected versus inferred conclusions
- Explicit unknowns
- Unsupported constructs or repository areas
- Explanations of how limitations affect the Lore

If Repo Lore can extract files and imports but cannot create a useful reading path, it has not satisfied the product promise.

## Core User Journey

The smallest complete MVP journey is:

1. The user pastes a public GitHub repository URL.
2. Repo Lore validates the repository.
3. Repo Lore resolves the repository’s default branch.
4. Repo Lore analyzes the latest commit on that branch.
5. Repo Lore records the exact commit SHA and analysis timestamp.
6. The user receives a stable Lore page.
7. The Lore guides the user through:
   - What the repository appears to be
   - Where to start reading
   - Its major structural areas
   - How those areas directly relate
   - Its probable entry points
   - Supporting evidence and analysis gaps
8. The user can manually request a fresh analysis after the repository changes.

The MVP should not require:

- An account for public repositories
- Repository configuration
- GitHub Actions
- Webhooks
- Custom scripts
- Manual documentation
- CI integration

## MVP Lore Contents

### 1. What Is This?

This section provides a concise repository orientation.

It includes:

- Repository name and description
- Detected project or application types
- Recognized languages and frameworks
- Package, workspace, or application structure
- Analyzed default branch
- Analyzed commit
- Analysis timestamp
- Important limitations and unsupported technologies

This section establishes context but is not the product’s primary value.

### 2. Start Here

“Start Here” is the MVP’s primary experience.

It presents a short, ordered reading path that helps the user answer:

1. What starts the system?
2. Where is the system assembled?
3. What are its primary internal areas?
4. What contracts connect those areas?
5. Where can representative behavior be seen or verified?

Not every repository will contain a clear answer to every question. Repo Lore should adapt the path to the available evidence rather than force a fixed template.

Example:

> Start with `app/main.py`. The project configuration identifies the `app` package, and this module creates the application object imported by the production server command.

Another example:

> Read `src/index.js` next. It is the package’s declared public entry point and re-exports functionality from four of the repository’s five primary modules.

The explanations may initially be deterministic and template-based. AI-generated prose is not required for the MVP.

### 3. Major Areas

Repo Lore presents a concise set of evidence-backed structural areas.

An area might correspond to:

- A workspace package
- A Python package
- An application
- A library
- A major source directory
- A module group
- A confidently detected framework area

For each area, Repo Lore shows:

- Why the area was identified
- Its probable responsibility
- Its important files
- Its entry points or public surface
- Its direct dependencies
- Its direct dependents
- Its associated tests, when detectable

The MVP should not invent business-domain names or responsibilities that are not supported by evidence.

### 4. Entry Points and Relationships

This section helps the user answer:

- Where can execution begin?
- Which locations expose public functionality?
- Which areas depend directly on other areas?
- Which areas are widely depended upon?
- Where do tests connect to implementation?
- Which apparent boundaries are crossed by dependencies?

Plain lists and tables are sufficient for describing relationships; interactivity (pan, zoom, drag, click-to-filter) is not required and should not be added without its own scoped decision. As a deliberate, narrow exception, the Major-Area relationship view may additionally be presented as a static, non-interactive diagram of area-to-area edges (ADR-0009) — reusing the same data as the table, not a new analysis capability. This exception does not extend to file-level relationships, which remain list/table only.

The product should prioritize relationships that improve the reader’s mental model rather than displaying every available edge.

### 5. Evidence and Gaps

Every important conclusion should disclose whether it is:

- **Detected:** Directly supported by deterministic evidence
- **Inferred:** Supported by an explicit heuristic or combination of evidence
- **Unknown:** Repo Lore could not determine the answer confidently
- **Unsupported:** The relevant construct or repository area is not currently analyzed

Users should be able to follow important conclusions back to the relevant source files, symbols, or configuration.

This is not merely a transparency feature. It is what makes the resulting confidence justified.

## Start Here Recommendation Model

The Start Here path should not be a list of the largest or most imported files.

Repo Lore should assemble a purposeful reading sequence using multiple evidence signals.

### Candidate Signals

Signals may include:

- Declared runtime or package entry point
- Application bootstrap behavior
- Public export surface
- Package or workspace boundary
- Dependency centrality
- Representative composition root
- Connection to project configuration
- Connection to tests
- Number and importance of direct dependents
- Framework conventions, when confidently recognized

### Coverage Over Raw Ranking

A raw importance score may recommend several files from the same part of the repository. That would be technically defensible but unhelpful.

The reading path should intentionally seek useful coverage, such as:

- One probable entry point
- One composition or configuration location
- Representatives from important structural areas
- One important public contract, when present
- One representative test, when useful

The goal is to build a mental model, not identify the repository’s most central nodes.

### Explanation Requirement

Every recommendation must explain why the user should inspect it.

A recommendation without an evidence-backed reason should not appear in the Start Here path.

## Major-Area Detection Model

Repo Lore should identify major areas using a conservative evidence hierarchy.

### 1. Declared Boundaries

Prefer boundaries explicitly established by the repository:

- Workspace packages
- Python packages
- Package manifests
- Application directories
- Declared source roots
- Public exports

### 2. Conventional Boundaries

When declared boundaries are absent, Repo Lore may use recognizable conventions:

- `src/`
- `tests/`
- `app/`
- `lib/`
- Routes
- Services
- Components
- Models
- Commands
- Adapters
- Other framework-defined locations

Convention-based conclusions should be labeled as inferred.

### 3. Relationship-Supported Boundaries

Imports and exports may refine structural groupings through evidence such as:

- Dense internal relationships
- Limited relationships across a boundary
- Shared public surfaces
- Dependency direction
- Common entry points

### 4. Conservative Fallback

If Repo Lore cannot confidently identify semantic areas, it should present clear structural areas and disclose what it does not know.

A repository-defined `billing` package is evidence for a billing area. It is not automatically evidence for a broader “revenue management domain.”

## Initially Supported Repository Shapes

The MVP supports conventional applications and libraries rather than every possible project written in the supported languages.

### JavaScript and TypeScript

Initial support should include:

- Single-package Node applications
- Node libraries
- Conventional frontend applications
- Common React applications
- ES modules
- CommonJS
- npm workspaces
- pnpm workspaces
- Yarn workspaces
- Conventional monorepositories within reasonable size limits

### Python

Initial support should include:

- Conventional Python applications
- Python libraries and packages
- Command-line applications with declared entry points
- Common root-package layouts
- Common `src/` layouts
- Projects using `pyproject.toml`
- Projects using common older packaging configuration
- Conventional `pytest` layouts
- Conventional `unittest` layouts

### Explicitly Incomplete or Deferred

Initial analysis may be incomplete for:

- Notebook-centric repositories
- Projects whose structure is primarily generated at runtime
- Complex metaprogramming
- Native extension internals
- Highly customized module loaders
- Massive monorepositories
- Projects requiring a successful build to discover their structure
- Framework-specific behavioral reconstruction
- Complete runtime call graphs
- Complete dependency resolution in dynamic code

Repo Lore should identify these limitations honestly rather than silently producing overconfident conclusions.

## Mixed-Language Repositories

Repo Lore should support repositories containing combinations of TypeScript, JavaScript, and Python.

It should:

- Detect supported projects within the repository
- Analyze each project using the appropriate language extractor
- Present the projects as parts of one repository-level mental model
- Show statically observable relationships between them
- Avoid inventing cross-language runtime connections

For example, Repo Lore may detect a JavaScript frontend and Python API in the same repository. Their coexistence alone is not proof that they communicate.

A cross-language relationship requires evidence such as:

- API configuration
- Shared schemas
- Generated clients
- Route references
- Build configuration
- Deployment configuration
- Other observable connections

If sufficient evidence is unavailable, Repo Lore should present the areas separately and identify the relationship as unknown.

## Implementation Approach

The public MVP should support all three languages, but implementation should proceed sequentially.

### Recommended Sequence

1. Define the shared Lore model and minimum value contract.
2. Build JavaScript and TypeScript extraction together.
3. Validate Start Here guidance and major-area detection across representative repositories.
4. Add Python extraction against the same output contract.
5. Validate Python output against the same usefulness threshold.
6. Test representative mixed-language repositories.
7. Launch publicly only when all advertised languages meet the minimum value contract.

The implementation does not require a generalized analyzer plugin system.

A small shared analyzer contract is sufficient:

- Detect projects
- Discover source
- Extract direct relationships
- Find entry-point candidates
- Find public surfaces
- Find test relationships
- Produce traceable evidence
- Report unknown and unsupported constructs

## Explicit MVP Exclusions

The launch MVP does not require:

- Separate management views
- AI-generated explanations
- Chat
- Health scores or generalized health findings
- Full execution-flow tracing
- Indirect change-impact analysis
- Commit or pull-request history analysis
- Scheduled refresh
- Notifications
- User accounts
- Private repository support
- Team features
- Branch selection
- Commit selection
- Interactive graph visualization
- Arbitrary repository configuration
- Billing
- Complete framework-specific interpretation

Some of these capabilities will eventually be necessary for a commercial product. They are not necessary to validate whether Repo Lore meaningfully reduces time to confidence.

## Scope Tradeoff

Supporting Python increases implementation and testing effort because it introduces another:

- Packaging ecosystem
- Module-resolution model
- Set of project conventions
- Collection of dynamic-language edge cases

This broader language scope should be paid for by reducing other launch requirements.

The recommended tradeoff is:

> Add Python, but exclude health findings, AI explanations, scheduled refresh, sophisticated visualization, and deep framework-specific interpretation from the launch MVP.

This preserves the product’s core value while expanding its useful audience.

## Success Test

Repo Lore should be tested against specific orientation tasks.

Give an engineer an unfamiliar repository and ask them:

1. What kind of system is this?
2. Where does execution probably begin?
3. What are its major structural areas?
4. How do two important areas relate?
5. Where would you begin investigating a hypothetical change?
6. Which conclusions are verified, inferred, or uncertain?

Measure:

- Time required to answer
- Correctness of the answers
- Evidence supporting the answers
- Self-reported confidence
- Whether confidence matches correctness

High confidence paired with incorrect answers is a product failure.

## MVP Success Threshold

For a reasonably sized, conventionally structured repository using supported languages:

> Within 15 minutes of opening a Lore, an experienced engineer unfamiliar with the repository can correctly identify its probable entry points, major structural areas, several important direct relationships, and a justified starting point for investigating a proposed change.

The Lore itself should be generated within a few minutes, subject to reasonable repository-size limits.

The broader mission remains helping an engineer speak confidently about an unfamiliar system by the next day. The narrower 15-minute target provides a measurable acceptance criterion for the MVP.

## Product Position

The resulting MVP can be described as:

> Repo Lore accepts a TypeScript, JavaScript, or Python repository and creates an evidence-backed reading path that shows an unfamiliar engineer where to start and why.

The goal is not exhaustive repository knowledge.

The goal is the shortest trustworthy path from unfamiliarity to justified confidence.

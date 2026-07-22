# The MVP Lore Model

## Purpose

A Lore is a living, evidence-backed mental model of a software repository.

It is not merely generated documentation, a file inventory, or a dependency graph. Its purpose is to help someone unfamiliar with a repository understand:

- What the software appears to be
- Where to begin exploring it
- Which parts matter
- How those parts relate
- Where execution likely begins
- What evidence supports each conclusion
- What remains uncertain or unsupported

The model is the durable product. Pages, tables, diagrams, explanations, and future interactive experiences are representations of that model.

## MVP Outcome

The MVP should provide a trustworthy orientation to a repository.

After using Repo Lore, an unfamiliar reader should be able to explain the repository’s broad structure, identify likely starting points, understand important direct relationships, and know where to investigate next.

The MVP does not need to explain every behavior or reconstruct the entire architecture. It succeeds when it replaces the initial feeling of “I do not know where anything is” with a justified starting mental model.

The first “wow” moment is:

> I pasted a GitHub repository URL, waited for analysis, and received a clear map showing me where to start, what mattered, and how the repository fit together.

## Repository Analysis Behavior

A user supplies a public GitHub repository URL.

Repo Lore:

1. Resolves the repository’s default branch.
2. Finds the latest commit on that branch.
3. Analyzes the source at that commit.
4. Records the exact commit SHA and analysis timestamp.
5. Publishes the result at a stable Lore URL.
6. Allows the repository to be reanalyzed when the default branch advances.

The user does not select a branch or commit in the MVP. Branch-specific, historical, and commit-specific reports can be added later.

The product behavior should be described as:

> Repo Lore analyzes the current state of the repository’s default branch and records the exact commit used as evidence.

A manual refresh is sufficient for the first vertical slice. Scheduled refresh can follow without requiring GitHub Actions, webhooks, configuration files, or maintenance from the repository owner.

## Intended Audiences

Repo Lore produces one shared mental model that supports multiple audiences. These audiences may need different levels of detail, but they should not receive contradictory representations of the system.

### Engineers

An engineer should be able to:

- Find likely execution and reading entry points
- Recognize the repository’s major structural areas
- Understand direct dependency relationships
- Identify relevant files, packages, modules, and tests
- Know where to investigate a proposed change
- Verify conclusions against source evidence
- Recognize where the analysis is incomplete or uncertain

### Engineering Managers

An engineering manager should be able to:

- Understand the broad shape of the system
- Discuss important areas using shared terminology
- See how major areas depend on one another
- Recognize concentrated or unclear responsibilities
- Identify areas where additional engineering investigation is needed
- Discuss planned changes with greater confidence
- Present a grounded overview without reading the repository file by file

### Outside Technical Personnel

When appropriate access is available, outside technical personnel should be able to:

- Understand the software’s broad organization
- Recognize its major responsibilities
- See how important areas fit together
- Follow explanations grounded in actual source evidence
- Distinguish verified conclusions from inference and uncertainty

Repo Lore should use progressive disclosure so that the initial overview remains approachable while deeper technical evidence is available when needed.

## Initial Lore Contents

### 1. Orientation

The opening section establishes basic context.

It should include:

- Repository name and available description
- Detected project or application type
- Recognized languages, frameworks, and tools
- Package or application structure
- Latest analyzed default-branch commit
- Analysis timestamp
- Important limitations or unsupported technologies

The orientation should clearly distinguish repository-provided metadata from conclusions derived by Repo Lore.

### 2. Start Here

“Start Here” is the primary MVP outcome.

It provides a short, ordered reading path through approximately three to seven files or structural areas. Each recommendation should explain why it matters.

Recommendations may include:

- Where execution likely begins
- Where the application is assembled
- Where important configuration is defined
- Where primary contracts or public exports live
- Where a major package or subsystem is introduced
- Where representative tests demonstrate expected behavior

A recommendation should never be based only on file size or naming. It should be supported by relationships, configuration, framework conventions, repository structure, or other observable evidence.

Example:

> Start with `src/index.ts` because the package configuration identifies it as the runtime entry point, and it imports the application’s primary initialization module.

### 3. Major Areas

Repo Lore should identify a concise set of meaningful structural areas.

Depending on the repository, an area might correspond to:

- A package
- A module
- A major directory
- An application
- A library
- A confidently detected framework component

For each area, the Lore should explain:

- What the area contains
- Why it appears important
- Its likely responsibility, when evidence supports one
- Its entry files or public surface
- What it directly depends on
- What directly depends on it
- Which tests are associated with it, when detectable

The MVP should identify evidence-backed structural areas. It should not attempt speculative business-domain reconstruction.

### 4. Relationships

Understanding comes from relationships rather than inventories.

The MVP should present a readable set of relationships such as:

- Internal package or module dependencies
- Highly depended-upon areas
- Relationships crossing apparent structural boundaries
- Connections between implementation and tests
- Public exports connecting one area to another

Plain lists and tables are sufficient. A sophisticated graph visualization is not required for the MVP.

The product should prioritize relationships that help a reader decide what matters and where to investigate next. It should not display every possible edge merely because it can.

### 5. Entry Points

Repo Lore should identify probable entry points using deterministic evidence and explicit heuristics.

These may include:

- Package entry points
- Application startup files
- Package scripts
- Exported library surfaces
- Framework bootstrap locations
- React application roots when supported
- Test entry points or test configuration

Each entry point should include:

- The supporting evidence
- Its relevant source or configuration location
- Whether it was directly detected or inferred
- Any meaningful uncertainty

### 6. Things to Investigate

The MVP may surface a small number of high-confidence observations that help the user investigate the repository.

Examples include:

- An area on which many other areas directly depend
- A package or module with unclear entry points
- An isolated structural area
- A significant portion of the repository that could not be analyzed
- Missing or unclear test relationships
- Unsupported technologies that limit the model
- Dependencies that cross an apparent structural boundary

This section should be called “Things to Investigate” rather than “Health” unless Repo Lore has sufficient evidence to make a genuine health-related conclusion.

Repo Lore should not:

- Assign arbitrary health scores
- Treat normal engineering tradeoffs as defects
- Present weak signals as problems
- Use pseudo-precise confidence percentages
- Generate findings simply to make the report appear more substantial

### 7. Evidence and Uncertainty

Every important conclusion should be traceable to observable evidence.

Evidence may include:

- Source files
- Imports and exports
- Package and project configuration
- Repository structure
- Types and public contracts
- Tests
- Framework conventions
- Repository metadata

Each important conclusion should eventually support:

- The evidence source
- A relevant file, symbol, or configuration location
- How the conclusion was produced
- A clear certainty category

Useful certainty categories include:

- **Detected:** Directly supported by deterministic evidence
- **Inferred:** Supported by an explicit heuristic or combination of evidence
- **Unknown:** Repo Lore could not determine the answer confidently
- **Unsupported:** The relevant language, framework, or repository area is not currently analyzed

The interface should prefer language such as:

- “Repo Lore detected…”
- “This appears to be…”
- “Evidence suggests…”
- “Start here because…”
- “This area directly depends on…”
- “Changing this area may affect…”
- “Repo Lore could not determine…”

Repo Lore should avoid claiming that it fully understands the repository.

## The Durable Lore Model

The product vision is language-agnostic even though the first analyzer has a deliberately narrow implementation scope.

The durable Lore should use stable software concepts such as:

- Repository
- Analysis snapshot
- Project or package
- Structural area
- Entry point
- Dependency relationship
- Public contract
- Test relationship
- Finding
- Evidence
- Uncertainty

Language- and framework-specific analyzers provide evidence for these concepts.

For example, a dependency relationship might be supported by:

- A TypeScript import
- A Go package import
- A Python module import
- A Java package dependency
- A framework configuration reference

The durable concept is the dependency relationship. The language-specific construct is its evidence.

This distinction allows Repo Lore to support additional ecosystems later without redefining the product. It does not require building a generalized analyzer framework for the MVP.

## Initial Ecosystem Scope

The first analyzer should provide focused support for:

1. TypeScript applications and libraries
2. React applications written in TypeScript

This is an implementation constraint, not the boundary of the long-term product.

Repo Lore should build deep, trustworthy understanding for the initial ecosystem before adding more languages. It should not claim complete support for a repository simply because it can identify some files within it.

When a repository contains unsupported languages or technologies, the Lore should:

- Analyze supported areas honestly
- Identify unsupported areas
- Explain how those gaps limit its conclusions
- Avoid extrapolating unsupported relationships

Support for additional languages and frameworks belongs after the initial product demonstrates meaningful value.

## Explicit MVP Boundaries

The MVP should answer:

> How do I orient myself in this repository, and where should I investigate next?

It should not yet promise:

> Repo Lore fully explains how this entire system behaves.

The first vertical slice does not require:

- Complete architectural reconstruction
- End-to-end execution or data-flow tracing
- AI-generated explanations
- Semantic business-domain reconstruction
- Historical architectural reasoning
- Commit or pull-request history mining
- Branch-specific reports
- Commit-specific user workflows
- Pull-request impact analysis
- Real-time synchronization
- Private repository support
- Multiple programming languages
- A generalized static-analysis plugin framework
- Sophisticated graph visualization
- Manual documentation editing
- Arbitrary diagram customization
- Chat as the primary product experience

These capabilities may extend the same Lore model later, but they should not block validation of the initial outcome.

## How Lore Evolves

A Lore should become a living model as the repository changes.

### MVP

- Analyze the latest commit on the default branch
- Record the exact analyzed commit
- Publish the analysis at a stable URL
- Clearly show when the analysis was performed
- Allow manual reanalysis
- Replace or update the current Lore when the default branch advances

### Soon

- Check the default branch on a reasonable schedule
- Reanalyze only when its latest commit changes
- Show whether the Lore is current or stale
- Preserve enough internal snapshot identity to compare analyses safely

### Later

- Explain meaningful changes between Lore snapshots
- Show when major areas, entry points, or relationships changed
- Add evidence-backed workflow tracing
- Improve likely change-impact investigation
- Incorporate commit and pull-request history carefully
- Support branch or commit-specific analysis when customer needs justify it
- Add additional language and framework analyzers

The MVP does not require presenting a historical timeline. It only needs to retain an analysis identity based on repository, commit, and analyzer version so that future evolution does not require redesigning the model.

## Recommended Product Priority

The product should prioritize its initial capabilities in this order:

1. Trustworthy repository ingestion
2. Accurate deterministic project model
3. Useful “Start Here” guidance
4. Clear entry points
5. Meaningful structural areas
6. Important dependency relationships
7. Honest evidence and uncertainty
8. A small number of useful investigation prompts
9. Scheduled freshness
10. One evidence-backed execution flow

The first execution-flow feature should follow a strong orientation experience. It should not delay the initial release.

## MVP Success Test

The MVP succeeds when an unfamiliar engineer can use Repo Lore and then:

- Explain what the repository appears to contain
- Identify likely execution and reading entry points
- Describe its major structural areas
- Explain several important relationships between those areas
- Know which source locations support those conclusions
- Identify uncertainty and unsupported areas
- Choose a justified place to begin investigating a change

An engineering manager should be able to use the same Lore to:

- Describe the system’s broad organization
- Discuss important areas using shared terminology
- Recognize important dependencies and knowledge gaps
- Participate in planning and change discussions with greater confidence

The goal is not exhaustive knowledge.

The goal is a useful, shared, and justified mental model.

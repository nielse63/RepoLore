# The Repo Lore Manifesto

## Software Should Be Understandable

Every software system contains accumulated decisions: boundaries, contracts, dependencies, conventions, and tradeoffs.

As the system changes, the code survives more reliably than the shared understanding around it. Architecture becomes something a few people remember. Important context hides in configuration, tests, pull requests, and conversations. Eventually the system still works, but fewer people can explain how it fits together or where a safe change should begin.

We believe software deserves better.

## Information Is Not Understanding

Engineers already have abundant repository information. They can search every file, list every dependency, inspect every commit, and generate summaries in seconds.

More information does not automatically create a useful mental model.

A file tree does not explain what matters. A dependency graph does not identify the best reading path. A fluent summary does not deserve trust merely because it sounds convincing.

Understanding comes from selecting and explaining relationships:

- where execution likely begins;
- which areas form meaningful boundaries;
- how those areas depend on one another;
- which contracts connect them;
- where representative behavior is tested;
- what evidence supports each conclusion;
- what remains unknown.

The goal is not to know everything about a repository. The goal is to know enough of the right things to investigate it with confidence.

## Evidence Before Explanation

Source code is not text waiting to be summarized. It is evidence.

Imports reveal direct dependencies. Exports reveal public surfaces. Configuration reveals declared structure and entry points. Tests reveal expected behavior and important seams. Repository history can reveal evolution and authored context.

Repo Lore begins with deterministic analysis and explicit heuristics. AI may later make verified findings easier to understand, but it does not get to invent the findings.

An important claim should be traceable to something real. A limitation should be visible. An inference should look different from a detection.

Evidence first. Explanation second.

## Confidence Must Be Justified

Confidence is the product, but confidence alone is not success.

High confidence paired with an incorrect mental model is a product failure. Repo Lore must help users understand not only a conclusion, but why they should believe it and where the analysis may be incomplete.

We prefer:

- “detected” to implied certainty;
- “inferred” to disguised speculation;
- “unknown” to a fabricated answer;
- “unsupported” to a misleadingly complete report.

Honesty about gaps is part of the experience, not an error state to hide.

## The Reading Path Matters

An unfamiliar engineer rarely needs every repository fact at once. They need to know where to start, what to read next, and why that sequence will build a useful mental model.

Repo Lore’s first job is editorial: select a small, evidence-backed path through the repository. A good path covers execution, assembly, major areas, contracts, and representative tests without becoming a ranking of large or highly connected files.

Progressive disclosure is how complex systems become approachable. Begin with orientation. Reveal relationships and evidence as the reader needs them.

## The Model Is the Durable Asset

Repo Lore is not a documentation generator.

Documents become stale when their maintenance depends on memory and discipline. Repo Lore instead builds a structured model that can be regenerated from repository evidence as the software changes.

A page is one representation of the model. A table, diagram, reading path, or future answer may be another. The underlying evidence-backed relationships are the durable asset.

## Engineering Knowledge Belongs to the Organization

When only one engineer can explain a critical system, the organization does not possess that knowledge. It is borrowing it.

That dependence creates fragile teams, slow onboarding, difficult handoffs, and fear around change. It also places an unfair burden on the people who become the sole source of context.

Understanding should survive reassignments, reorganizations, departures, and time. Repo Lore exists to make that understanding shared, inspectable, and renewable.

## Automatic by Default

Organizations should not need another documentation chore.

The core experience should require no handwritten configuration, repository scripts, CI integration, webhook setup, or manual prose. For a public repository, pasting its GitHub URL should be enough to produce a stable Lore tied to an exact commit.

Automation does not mean overclaiming. When Repo Lore cannot determine something reliably, it should say so and show the user where further investigation is needed.

## Build the Smallest Trustworthy Product

Repo Lore is designed to become a durable small business, not an infrastructure spectacle.

We favor depth over breadth, useful tables over premature graph interfaces, deterministic templates over unnecessary AI, and operational simplicity over speculative scale.

The MVP succeeds when an unfamiliar engineer can open a Lore and, within 15 minutes, identify probable entry points, major structural areas, important direct relationships, and a justified place to begin investigating a change.

That is not complete understanding. It is the shortest trustworthy path from unfamiliarity to justified confidence.

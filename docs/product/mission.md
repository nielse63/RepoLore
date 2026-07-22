# Repo Lore Mission

Repo Lore builds a living, evidence-backed mental model of a software repository so an unfamiliar engineer can understand it with justified confidence—without depending on tribal knowledge.

## Why Repo Lore Exists

Software should be understandable.

As a system grows, knowledge about its structure and intent becomes scattered across source code, configuration, tests, history, and the memories of the people who built it. The code remains, but the shared mental model fades. Onboarding slows down, handoffs become risky, and engineers hesitate to change unfamiliar areas.

Repo Lore turns observable repository evidence into durable organizational knowledge. It does not replace engineering judgment. It gives engineers a trustworthy place to begin.

## The Outcome

Repo Lore should help an experienced engineer who is new to a repository answer:

- What kind of system is this?
- Where does execution probably begin?
- What are its major structural areas?
- How do those areas directly relate?
- Which files, contracts, and tests matter first?
- Where should I begin investigating a proposed change?
- Which conclusions are detected, inferred, unknown, or unsupported?

The long-term ambition is for an engineer to speak confidently about an unfamiliar system by the next day. The MVP targets the first measurable step: within 15 minutes of opening a Lore, an engineer should be able to form a correct orientation and choose a justified place to start.

## Who It Serves

The primary user is an experienced engineer investigating an unfamiliar TypeScript, JavaScript, or Python repository.

Common situations include:

- onboarding to an existing project;
- moving to another team or codebase;
- investigating a bug or proposed change outside a familiar area;
- evaluating a dependency, integration, or acquisition target;
- helping another team understand its system.

Engineering managers are an important secondary audience. They should benefit from the same shared model and terminology, not from a separate dashboard of weak proxies.

## How Repo Lore Earns Confidence

Confidence must come from evidence, not presentation.

Repo Lore uses this hierarchy:

1. deterministic source and dependency analysis;
2. repository configuration, metadata, and structure;
3. explicit, explainable heuristics;
4. version-control history and authored context when those capabilities are added;
5. AI explanation grounded in the preceding evidence when it materially improves comprehension.

AI is secondary. It may explain verified findings, but it must not invent intent, silently turn inference into fact, or act as the primary repository-analysis engine.

Every important conclusion should identify its evidence, the relevant source or configuration location, how it was produced, and its certainty category.

## What the Product Is

Repo Lore is a living model of a repository. Documentation, tables, diagrams, reading paths, and future interactive explanations are views of that model—not the durable product itself.

For the MVP, the central experience is an evidence-backed **Start Here** path supported by a concise major-area model, probable entry points, direct dependency relationships, and explicit gaps.

The product is successful when it reduces uncertainty without manufacturing certainty.

## Business and Operating Constraints

Repo Lore is a sustainable, revenue-generating side business maintained by one experienced engineer.

- Normal development capacity is approximately 5–8 focused hours per week.
- Ongoing maintenance should never require more than 10 hours per week.
- The initial revenue goal is approximately $2,000 MRR.
- A small, profitable product is preferable to venture-scale growth.
- Boring, understandable, managed technology is preferable to novel infrastructure.
- High-touch onboarding, consulting, manual moderation, and enterprise procurement are poor fits.

Every product and technical decision should be evaluated against whether one person can operate, debug, and evolve it for years.

## Mission Test

Before adding a capability, ask:

> Will this help an unfamiliar engineer build a more accurate mental model or choose a better-supported next step?

If the answer is unclear, the capability should be reduced, postponed, or rejected.

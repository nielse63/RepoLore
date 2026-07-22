# Repo Lore Product Principles

Repo Lore builds a living, evidence-backed mental model of a software system.

These principles govern product decisions. A proposed capability should not enter the roadmap merely because it is useful, technically interesting, or requested by one customer. It must strengthen Repo Lore’s central promise: helping people understand unfamiliar software and make changes with justified confidence.

## 1. Improve the Mental Model

Every core product feature must help the user understand something meaningful about the software system.

A feature should help answer a question such as:

- What are the major parts of this system?
- How do they relate?
- Why does this component matter?
- How did it evolve?
- What depends on it?
- What could be affected if it changes?
- Where should I investigate next?

Displaying more repository data is not sufficient. If a feature increases information without increasing understanding, it does not belong in Repo Lore.

Complexity should be revealed progressively. Begin with the clearest useful explanation, then let users follow relationships and evidence into deeper detail.

**Feature test:** What will the user understand after using this that they did not understand before?

## 2. Support Conclusions With Evidence and Honest Confidence

Important claims must be supported by observable evidence.

Evidence may include:

- source code
- imports and dependencies
- project configuration
- repository structure
- tests
- framework conventions
- commit history
- pull-request history, when available
- other version-control evidence

Repository history is a first-class source of understanding. Code can show what the system does today; history can reveal how it evolved and provide evidence about why decisions were made.

History must still be interpreted carefully. A commit, message, or code change may provide strong evidence without conclusively proving its author’s intent. Repo Lore must distinguish between facts, strong inferences, weak signals, and unknowns.

AI may explain, summarize, and connect evidence. It must not present invented reasoning or unsupported architectural conclusions as fact.

**Feature test:** Can users inspect the supporting evidence and understand how confident they should be in the conclusion?

## 3. Explain Relationships, Not Just Things

Understanding a system comes primarily from understanding relationships.

Repo Lore should prioritize:

- dependency paths
- architectural boundaries
- data flow
- entry points
- ownership relationships
- historical relationships
- connections between implementation and tests

over inventories of files, symbols, metrics, or generated descriptions.

Individual components matter because of how they participate in the larger system.

**Feature test:** Does the feature explain how something fits into the system, or merely describe it in isolation?

## 4. Make Change Impact Understandable

Repo Lore should help users investigate a proposed change before they implement it.

Users should be able to identify:

- direct and indirect dependencies
- likely affected components
- architectural boundaries being crossed
- related tests
- historical changes in the same area
- evidence that supports the predicted impact
- uncertainty or gaps in the analysis

Change-impact analysis must not imply guarantees that the available evidence cannot support. Its purpose is to help users act with justified confidence and recognize where further investigation is required.

A user should be able to consult Repo Lore before changing an unfamiliar system and leave with a clearer understanding of where the risks are.

**Feature test:** Does the feature help users predict the consequences of a change and determine what they should inspect before proceeding?

## 5. Stay Automatic, Current, and Shared

Core understanding should be produced and maintained without requiring users to become documentation stewards.

Avoid features that depend on:

- manual documentation
- handwritten configuration
- custom scripts
- repository-specific maintenance
- developers remembering to keep information current

Repo Lore’s core knowledge model and evidence-backed explanations should persist at the repository level and be shared by default with every authorized user.

Individual users may have personalized searches, navigation, and learning paths, but the underlying understanding should not be trapped in private sessions or disappear when someone leaves the organization.

Repo Lore should automatically maintain this shared model as the repository changes. When information may be incomplete or stale, that condition should be visible.

**Feature test:** Will this capability create durable, current organizational knowledge without requiring ongoing manual maintenance?

## 6. Make Complex Systems Approachable

Repo Lore should reduce cognitive load without hiding meaningful complexity.

The product should:

- begin with the most useful overview
- use clear language
- establish recognizable system boundaries
- guide users toward the next useful question
- allow supporting evidence to be inspected on demand
- avoid dashboards filled with disconnected facts or metrics

The goal is not to make a complex system appear simple. It is to make that complexity navigable.

**Feature test:** Does the feature help users decide what matters and where to investigate next?

## 7. Remain Sustainable and Scalable

Repo Lore must remain maintainable by a very small team while scaling to serve more repositories and customers reliably.

Prefer capabilities that:

- deepen the core product rather than expand its surface area
- avoid support-intensive configuration
- do not require operational effort proportional to customer growth
- use boring, reliable technology
- control compute and AI costs
- can be maintained without specialized teams
- strengthen TypeScript, React, and modern web application support before expanding to additional ecosystems

Scalability does not mean building infrastructure before it is needed. It means avoiding product and technical decisions that make healthy growth unnecessarily expensive or fragile.

**Feature test:** Can this capability grow with customer usage without weakening product quality or creating disproportionate maintenance, support, or operational costs?

## Product Preferences

When multiple solutions satisfy the seven principles, Repo Lore should prefer:

- deterministic analysis before AI interpretation
- depth of understanding over breadth of coverage
- shared organizational knowledge over isolated personal insight
- relationships over inventories
- stable concepts over transient metrics
- progressive disclosure over dense dashboards
- sensible defaults over configuration
- one clear workflow over many flexible workflows
- the simplest version that delivers meaningful understanding

## Feature Decision Checklist

Before committing a feature to the roadmap, answer:

1. What important user question does it answer?
2. How does it improve the user’s mental model?
3. What evidence supports its conclusions?
4. Does it use repository history where history could materially improve understanding?
5. How will uncertainty be communicated?
6. What relationships or context does it reveal?
7. How does it help users understand or safely investigate change impact?
8. How will its output remain current?
9. Will its conclusions become durable organizational knowledge, or disappear with an individual session?
10. What setup or maintenance does it require from the customer?
11. What ongoing maintenance and operational cost does it create for Repo Lore?
12. Does it deepen the initial product focus or dilute it?
13. What is the simplest version that delivers the intended understanding?

If these questions do not have convincing answers, the feature should be postponed, reduced in scope, or rejected.

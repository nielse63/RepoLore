# Mission

Repo Lore builds a living mental model of your software, so every engineer can understand it with confidence — without relying on tribal knowledge.

Core belief: software should be understandable, and engineering knowledge should belong to the organization, not only to the individuals who happened to build the system.

## Primary outcome

An engineer who is unfamiliar with a repository should be able to use Repo Lore to:

- Understand what the system does
- Understand its important concepts and boundaries
- Understand how its major pieces relate
- Identify where execution begins
- Trace important flows
- Understand dependencies and likely change impact
- Find evidence supporting each explanation
- Identify what is known, inferred, or unknown
- Speak confidently and knowledgeably about the system by the next day

This applies to:

1. A newly hired engineer trying to become productive quickly
2. An existing engineer exploring, integrating with, depending on, or being reassigned to an unfamiliar product
3. An engineering manager who needs a readable system overview, knowledge-risk indicators, and onboarding visibility

## Core epistemic principle

Repo Lore must earn confidence through evidence. Evidence hierarchy, in order:

1. Deterministic static analysis
2. Repository configuration and metadata
3. Version-control history and authored context
4. Explicit heuristics, clearly labeled
5. AI-generated explanation grounded in the preceding evidence

AI is secondary. It never replaces deterministic analysis, is never used to invent documentation from a whole repository, and must never silently convert inference into fact.

Each important generated claim should eventually support: an evidence source, a confidence/certainty category, a relevant file/symbol/configuration location, and an explanation of how the conclusion was produced.

## Product language

Use clear language for both engineers and engineering management. Avoid unexplained static-analysis jargon, AI hype, claims that Repo Lore "understands everything," false certainty, health scores with arbitrary precision, and framing normal engineering tradeoffs as defects.

Prefer: "Repo Lore detected…", "This appears to be…", "Evidence suggests…", "We could not determine…", "This module imports…", "Start here because…", "Changing this area may affect…".

## Founder context

Repo Lore is a revenue-generating side project built and maintained by one experienced engineer who also has a full-time job.

- Normal development capacity: ~5–8 focused hours/week; absolute ceiling 10 hours/week.
- Initial revenue target: ~$2,000 MRR. A small profitable product beats venture-scale growth.
- Favor boring, understandable, managed technology over novel infrastructure.
- No speculative features, no high-touch onboarding/consulting/manual moderation, no enterprise procurement requirements.
- Every design or implementation decision should be evaluated against whether one person can operate, debug, and evolve it over several years.

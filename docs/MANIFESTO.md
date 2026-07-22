# The Repo Lore Manifesto

## Software should be understandable

Every software system begins with intent.

Someone made a decision.
Someone chose a boundary.
Someone connected one part of the system to another for a reason.

But as software grows, that understanding fades.

The code remains. The context around it does not.

Architecture becomes something a few people remember. Important relationships hide across files and repositories. Decisions survive only in old pull requests, forgotten conversations, or the minds of engineers who may no longer be there.

Eventually, the system still works—but fewer people understand why.

We believe software deserves better.

## Understanding is more than information

Modern development tools give us extraordinary access to information.

We can search every file, inspect every dependency, trace every commit, and generate explanations in seconds.

Yet access to information is not the same as understanding.

A list of files does not explain a system.
A dependency graph does not automatically reveal architecture.
A generated summary does not create confidence.

Understanding comes from relationships:

- which components matter
- how they depend on one another
- where responsibilities begin and end
- how information moves through the system
- what may be affected when something changes
- what evidence supports each conclusion

The goal is not to know everything about a repository.

The goal is to build the right mental model of it.

## Code is evidence

Source code is not merely text to be summarized. It is evidence.

Imports reveal dependencies.
Types reveal contracts.
Configuration reveals structure.
Tests reveal expected behavior.
Version history reveals how the system evolved.

These signals should form the foundation of understanding.

Artificial intelligence can help explain what the evidence means, but it should not replace the evidence itself. A confident-sounding answer is not trustworthy simply because it is clear.

When Repo Lore makes an important claim about a system, that claim should be traceable to something real.

Evidence first. Explanation second.

## Documentation is a representation, not the destination

Documentation is valuable, but documents alone cannot preserve understanding.

They become incomplete.
They fall out of date.
They describe components without capturing the relationships between them.
They depend on someone remembering to maintain them.

Repo Lore is not trying to produce more pages for engineers to read.

It is building a living model of the software system—one that can be explored, questioned, and represented in different ways.

A document may be one view of that model.
A diagram may be another.
An answer to a specific question may be another.

The model is the durable asset.

## Engineering knowledge belongs to the organization

No company should depend on one person to explain how a critical system works.

When knowledge exists only in an engineer’s memory, the organization does not truly possess it. It is borrowing it.

That creates fragile teams, difficult handoffs, slow onboarding, and fear around change. It also places an unfair burden on the people who become the only reliable source of context.

Understanding should survive reorganizations, departures, and the passage of time.

The knowledge encoded in a software system belongs to the organization that depends on it. Repo Lore exists to help recover, preserve,

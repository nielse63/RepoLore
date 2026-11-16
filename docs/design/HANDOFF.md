# Repo Lore design specification

## Outcome

An engineer should quickly understand what a repository does, identify a useful starting point, and inspect the source behind a relationship. The design preserves the warm editorial identity while giving maps, explanations, and source relationships more room.

This is a visual and interaction reference for the existing product. It is not a proposal to rewrite the analyzers or expand the business into a larger platform. Page families follow the public navigation inspected on October 23, 2026. No application source checkout was available during this design task.

## Page and route mapping

Prototype routes use hashes so the export works directly from a local file. Preserve the real application's existing routes, deep links, and navigation conventions.

| Page type | Prototype hash | Existing public route family | Primary job |
| --- | --- | --- | --- |
| Homepage | `#/home` | `/` | Show the payoff and make starting easy. |
| Explore Lores | `#/explore` | `/explore` | Demonstrate understanding before asking for a repository. |
| Manifesto | `#/manifesto` | `/manifesto` | Explain the principles in a readable editorial layout. |
| Overview | `#/repo/overview` | `/lore/[owner]/[repo]` | Orient the reader with a map and three starting points. |
| Architecture | `#/repo/architecture` | `/lore/[owner]/[repo]/architecture` | Explore areas and imported dependencies. |
| Systems | `#/repo/systems` | `/lore/[owner]/[repo]/systems` | Group related areas around a responsibility. |
| System detail | `#/repo/systems/project-workspace` | `/lore/[owner]/[repo]/systems/[...slug]` | Explain one grouping through members, relationships, and functions. |
| Dependencies | `#/repo/dependencies` | `/lore/[owner]/[repo]/dependencies` | Explain declarations and source usage. |
| Data Flow | `#/repo/data-flow` | `/lore/[owner]/[repo]/data-flow` | Follow a possible source call path from an entry point. |
| History | `#/repo/history` | `/lore/[owner]/[repo]/history` | Understand a change and inspect its affected areas. |

The system slug above is illustrative. Retain the current optional/catch-all route implementation rather than adding a new route convention.

`#/design`, `#/analyze`, and the fixture state query parameters are review tools. The design index and prototype labels are not production pages. Adapt the analysis journey to the existing submission mechanism. The export contains one complete example repository; Explore demonstrates three ways into that example rather than pretending to include additional analyzed repositories.

## Shared shell

- A compact header identifies the repository and provides Analysis and Share.
- A 173px left navigation keeps all six existing repository sections reachable.
- The default view has no open right rail. Metadata lives behind Analysis.
- Selecting a meaningful area, package, function, or change opens a contextual inspector.
- On wide screens the inspector receives its own column. At intermediate widths it follows the main content. On mobile it appears as a focused sheet with a close action.
- Keep the analyzed commit visible in a small status line. Never imply that a snapshot is current without checking it.
- Preserve source context while opening evidence. Close and Escape should restore focus to the originating control when possible.

## Screen requirements

### Homepage and Explore

Put the repository input next to a concrete promise. Show a readable, representative product result immediately below it. Offer an obvious example path. Example cards should explain what a visitor can learn, rather than emphasizing repository size or analysis counts.

Connect Analyze to the real flow and its real validation. The prototype validates the structure of an HTTPS GitHub repository URL, then runs a labeled local simulation. Do not ship that simulation or the fixture repository as a response to arbitrary input.

### Overview

Lead with a short orientation, then a small source dependency map. Limit the recommended first stops to three, with a clear reason for each. File paths support the explanation. Put grouping methodology and limits behind progressive disclosures while keeping inferred status visible.

The two lower text blocks are contextual examples, not mandatory cards. If the real repository lacks a useful finding, omit the block rather than fill it with a generic claim.

### Architecture

Put the map above the inventory. Keep labels readable at the default fit. Select an area to inspect its role, imports, importers, and evidence. Focusing a selected area dims unrelated nodes and connections; it must not change the meaning or direction of an edge.

Arrows in the prototype mean **imports**, pointing from the importer to the imported dependency. They do not mean runtime execution, network traffic, or data movement. In a large real repository, reuse the existing graph library and choose a meaningful initial subset. Do not scale all labels down to fit the entire repository.

Expand should provide additional usable map area. Preserve a clear return control. Adapt zoom/pan/fit to the existing diagram component; the prototype demonstrates selection, focus, and expansion rather than implementing a new general graph engine.

### Systems and system detail

Lead with a responsibility and an explanation. Mark inferred grouping plainly. Members and their source relationships should remain inspectable. Useful functions are suggested starting points, supported by entry-point reachability, callers, and visible responsibilities.

Do not rename a directory grouping as a domain, service, or subsystem without sufficient evidence. If the current analyzer only knows a structural fallback, present that structural limitation. The richer system labels in this fixture demonstrate a presentation pattern, not proof that every real repository supports it.

### Dependencies

Provide search, scope, and a simple useful sort. A row shows the package, declared range, scope, and evidence. Selecting a package shows its manifest declaration and source references. Distinguish direct imports from framework conventions and configuration references.

Keep declared ranges distinct from lockfile-resolved versions. These screens make no vulnerability, license, freshness, or security claims. Fixture versions are examples, not upgrade recommendations.

### Data Flow and functions

Choose an existing entry point, then expose a possible path through source calls. Selecting a step reveals its source location and visible inputs/outputs. GET and POST illustrate both read and create journeys. Previous/Next and direct step selection operate on the same state.

Label static analysis. Preserve branches and stopping conditions. Do not turn imports into calls, calls into proven execution order, or a notification call into proof of delivery. Show payload relationships only where the analysis actually resolves them. If only callers/callees are available, use those relationships without fabricating a sequential narrative.

Function suggestions need a reason. The prototype uses readable facts and relationships rather than opaque importance bars. If retaining a numeric importance score, show its scale and an explanation linked to its actual contributing signals. Do not invent a new score for this redesign.

### History

Each change has one title, a distinct summary, affected areas, and an inspection action. Omit a summary when it merely repeats the title. A selected change shows available source differences and explains what remains unknown. Commit rationale must come from explicit evidence; a diff alone does not prove intent.

The fixture uses changed-line excerpts, not complete patches. Production should show actual diff locations and commit provenance. Accurate summaries depend on the existing history capabilities; preserve plain commit messages when richer supported summaries are unavailable.

### Manifesto

Use a readable single column, editorial headings, and restrained section dividers. End with a clear path into a working example. Keep mission language separate from claims about analysis coverage.

## Interaction and state coverage

| Surface | Working local interaction | Production behavior |
| --- | --- | --- |
| Public and repository navigation | Connected hash routes; browser Back/Forward in the export | Keep existing router and URL semantics. |
| Repository form | GitHub URL validation and a labeled progress demonstration | Real request, progress/status, retry, and repository result. |
| Maps | Node selection, neighbor focus, expansion, source inspection | Existing graph component and real edge provenance. |
| System list | Search and system detail navigation | Real detected or conservatively inferred groupings. |
| Dependencies | Search, scope, name/reference sort, details | Actual declarations, usages, and existing pagination as needed. |
| Data Flow | Entry-point selection, selectable steps, Previous/Next | Only source paths the analyzer can actually support. |
| Functions | Search, callers/callees, source inspection | Actual symbols and evidence ranges. |
| History | Category filtering and change inspector | Actual history categories and diffs; adapt filter to real data. |
| Analysis | Snapshot, provenance types, limitations, re-analysis demonstration | Real snapshot, analyzer version, gaps, status, and action. |
| Share | Example URL and badge text; clipboard with manual-copy fallback | Actual stable URL and existing badge format. |
| Mobile | Menu and selected-evidence sheet | Keyboard, touch, focus restoration, and dismissal. |

| Review state | Prototype location | Required presentation |
| --- | --- | --- |
| Completed | `#/repo/overview` | Normal orientation and evidence access. |
| Loading | `#/repo/overview?state=loading` | Useful progress language; mark busy; avoid fabricated precision. |
| No source | `#/repo/overview?state=empty` | Explain the absence and provide a next action. |
| Error | `#/repo/overview?state=error` | Actionable recovery and optional technical details. |
| Stale | `#/repo/overview?state=stale` | Identify the shown commit and offer a real refresh action. |
| Partial | `#/repo/overview?state=partial` | Keep supported findings usable; make unresolved scope inspectable. |
| Not found | `#/missing-page` | Recover to Home, Explore, or the repository overview. |
| Search empty | Enter a nonmatching query on Explore, Systems, Dependencies, or Data Flow | Keep filters visible and explain the empty result. |

## Evidence contract

Present these as different concepts, not interchangeable confidence percentages:

| Category | Meaning | Example |
| --- | --- | --- |
| Detected | A concrete source/configuration fact | An import, export, declaration, or resolved call. |
| Inferred | An interpretation of detected evidence | A responsibility label, grouping, or starting-point suggestion. |
| Unknown | The evidence does not establish the answer | Actual runtime execution or external delivery. |

Every significant finding needs source references when the underlying model supports them. A useful production reference contains the repository identity, analyzed commit, path, range, relationship kind, and enough context to explain why it is shown. Preserve the real model's identifiers. Link source at an immutable commit; never silently show current HEAD as evidence for an older snapshot.

If the backend cannot supply a source excerpt, link directly to its available evidence rather than inventing one. Keep uncertainty close to the conclusion, with long methodology available on demand.

## Visual tokens

| Token | Light appearance | Dark appearance | Role |
| --- | --- | --- | --- |
| Paper | `#F8F7F3` | `#19211D` | Page background. |
| Panel | `#FFFEFA` | `#232D26` | Maps, inspectors, and dialogs. |
| Navigation | `#F0F2EB` | `#1E2922` | Quiet navigation surface. |
| Ink | `#283E35` | `#E5EEE6` | Primary text. |
| Muted | `#5E6F64` | `#B3C6B9` | Secondary text that still needs contrast. |
| Line | `#D9E1D6` | `#405246` | Structural dividers and quiet boundaries. |
| Teal | `#226B5C` | `#92D2B9` | Important actions and selected relationships. |
| Teal wash | `#E8F0E6` | `#2C4233` | Subtle selected surfaces. |

Use the existing brand font if available. The export uses local Georgia and system sans/monospace fallbacks so it works offline. Page headings are approximately 32–36px, section headings 24–25px, body 14px, supporting copy 12–13px, and evidence metadata 11px. Hero type scales from 39px to 62px. Avoid reducing diagrams to illegible microtext.

Spacing uses a small 4/8px rhythm, with 20–34px page gutters and 24–30px between major sections. Standard controls and cards use approximately 6–9px corner radii. Preserve calm density through spacing and grouping rather than nested boxes, repeated badges, or numerous metrics.

## Responsive and accessibility requirements

- Support at least 320, 390, 768, 1024, and 1440px widths, including open inspectors and source excerpts.
- At compact widths, use a menu for repository navigation and a focused evidence sheet. Do not shrink the desktop shell to fit.
- Keep text and file paths wrapping. Avoid page-level horizontal overflow.
- Preserve native button/link semantics, visible focus, labeled controls, Escape dismissal, focus restoration, and dialog focus containment.
- Keep essential information accessible without hover. Aim for 44px touch targets.
- Announce route/result changes sparingly with live regions. Use `aria-busy` for real loading states and `aria-invalid` for invalid inputs.
- Respect reduced motion. Do not add looping decorative animations.
- Check contrast in both appearances, browser zoom, keyboard use, and screen-reader reading order.
- Retain and adapt existing automated accessibility checks. The prototype is a design reference, not an accessibility certification.

## Scope and implementation order

**MVP:** Homepage, focused Overview, shared shell, contextual evidence, readable Architecture, existing Systems/Dependencies/Data Flow/History sections, Manifesto/Explore consistency, responsive behavior, and necessary loading/error/empty states. These improve existing workflows.

**Soon:** Refine examples and initial graph subsets based on observed onboarding friction. Consider clearer supported ranking explanations if current importance signals already exist.

**Later:** Saved exploration or changes-since-last-visit only after customer demand and real persistence semantics justify them. They are intentionally absent from this prototype.

**Maybe Never:** Unsubstantiated architectural storytelling, generic metric dashboards, and new runtime infrastructure added solely to support the visual redesign.

Implement shell and Overview first, reuse those primitives across sections, then complete public pages and the state pass. Keep analyzer changes separate from presentation changes. If a richer UI requires new evidence, document the gap and render a truthful simpler state.

# ADR-0003: ts-morph, syntactic-only analysis for v1 (no type-checked program)

## Status

Accepted

## Context

**Scope note:** this ADR covers JavaScript/TypeScript analysis only. `docs/MVP.md` also requires Python support in the same language-neutral Lore model; Python analysis needs its own ADR (library and syntactic-vs-typed tradeoff) before that work starts, since ts-morph and the TypeScript Compiler API do not apply to Python.

The first vertical slice needs to extract, per file: imports/exports, internal dependency edges, probable entry points, and confidently-detected React components (JSX-returning functions, class components extending `React.Component`). This is largely syntactic information — it doesn't require resolving types.

Two questions were in play:

1. Which library wraps the TypeScript Compiler API: ts-morph vs. the raw Compiler API vs. a lighter syntactic-only parser (e.g., `es-module-lexer`/`oxc-parser` for imports).
2. Whether analysis constructs a full type-checked `Program` (resolving `tsconfig.json`, path mappings, project references) or stays syntactic (parsing each file's AST without resolving types).

## Decision

Use **ts-morph**, and run it **syntactic-only** for v1 — parsing source files' ASTs without constructing a fully type-checked `Program`.

## Rationale

ts-morph is a mature, well-documented wrapper over the TypeScript Compiler API with good ergonomics for AST traversal, which matters for a solo maintainer's iteration speed; it's a reasonable middle ground between the raw Compiler API (more control, more boilerplate) and a minimal import-only parser (faster, but would need a second tool for JSX/component detection). Staying syntactic-only for v1 avoids the type-checker's edge cases — path-mapped tsconfigs, project references, monorepo workspace configs, `skipLibCheck` interactions — none of which the v1 feature set (import/export graph, entry points, component shape detection) actually requires, and it meaningfully reduces both runtime cost and the long tail of configs that could break analysis.

## Consequences

- JavaScript/TypeScript dependency edges, entry points, and public-surface conclusions in v1 are based on syntactic import/export statements, not resolved types — this is disclosed as the basis for those claims (labeled Detected or Inferred), per the evidence-hierarchy principle in `docs/product/mission.md`.
- This decision does not extend to Python. Python source discovery, import resolution, and entry-point/public-surface detection require a separate ADR and, likely, a separate library (e.g., Python's own `ast` module) before implementation session 12 begins.
- Some path-aliased imports may not resolve to a file without additional (non-type-checker) alias-resolution logic reading `tsconfig.json` `paths` directly; this is scoped into source file discovery/config reading (implementation session 6), not the type checker.
- If a later feature genuinely requires resolved types (e.g., more precise "likely React component" detection, or type-aware impact analysis), that's an additive, isolated change — swapping in a type-checked `Program` for specific queries — not a rewrite of the analysis approach.

## Alternatives considered

A minimal import-only parser (`es-module-lexer`/`oxc-parser`) was considered simpler but would still need a separate JSX/AST-aware pass for React component detection, adding a second tool rather than removing complexity. Full type-checked analysis was rejected for v1 as unnecessary cost/fragility for the feature set in scope; it remains available to add later for specific, justified needs.

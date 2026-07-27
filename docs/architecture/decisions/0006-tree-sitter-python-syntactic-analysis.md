# ADR-0006: tree-sitter-python (via web-tree-sitter), syntactic-only, for Python analysis

## Status

Accepted

## Context

`docs/product/mvp.md` requires Python support in the same language-neutral Lore model as JavaScript/TypeScript: imports/packages, `pyproject.toml`/`setup.py`/`setup.cfg`, requirements files, console-script and conventional entry points, `src/` layouts, package public surfaces, and `pytest`/`unittest` test relationships. ADR-0003 explicitly scoped ts-morph/TypeScript Compiler API to JavaScript/TypeScript only and deferred the Python parsing decision to this ADR, since neither applies to Python.

Three approaches were in play:

1. **tree-sitter-python, run via `web-tree-sitter`** — a WASM-compiled Python grammar plus a WASM parser runtime, both pure JavaScript/WASM with no native compilation step.
2. **Shell out to a system `python3` interpreter**, using its own `ast` module to parse source and emit a JSON tree.
3. **A regex-based lightweight scanner** over source text for import lines and `def`/`class` names, no real parser at all.

The repository already confirmed (checked against the published npm packages) that `tree-sitter-python`'s npm package ships a prebuilt `tree-sitter-python.wasm` file directly in its distributed tarball — no `node-gyp`/native build step is required to use it with `web-tree-sitter`.

## Decision

Use **tree-sitter-python via `web-tree-sitter`**, and run it **syntactic-only** — walking the concrete syntax tree for import statements, function/class definitions, decorators, and string/table literals (for config file parsing), without any semantic name resolution, type inference, or execution.

## Rationale

This is the direct Python-side analogue of ADR-0003's JS/TS decision: a mature, well-documented, syntax-only parser, chosen for iteration speed and to avoid the long tail of semantic edge cases (Python's dynamic import machinery, `sys.path` manipulation, conditional imports, metaclasses, monkeypatching) that the v1 feature set — dependency edges, entry points, public surface, test relationships — does not actually require.

Compared to the alternatives:

- Shelling out to system `python3` + `ast` would be the most semantically faithful option (it uses CPython's own reference grammar), but it adds a hard runtime dependency on a Python 3 interpreter being present in the deployment image. ADR-0001 commits to a single Next.js deployable; adding a second language runtime as an operational dependency (installed, versioned, and kept patched in whatever container hosts the app) is a real, ongoing cost for a solo maintainer, not a one-time setup step. It also means per-file (or per-project) subprocess spawns, adding latency and a process-execution surface for untrusted repository content.
- A regex-based scanner has zero dependencies but is fragile exactly where the product needs confidence: multiline `from x import (a, b, c)` statements, decorated functions, and nested `def`/`class` bodies are all common in real Python code and are the kind of thing a real parser handles correctly by construction. Given `docs/product/mvp.md`'s explicit warning against producing "a weak report that resembles a dressed-up file browser," a text-pattern scanner was judged too weak a foundation for public-surface and test-relationship detection specifically.
- `tree-sitter-python` + `web-tree-sitter` avoids both costs: it's pure JavaScript/WASM (no native addon compilation, no second language runtime), stays inside the single Next.js deployable, and gives a real concrete syntax tree — the same quality of foundation ts-morph gives JS/TS — for exactly the syntactic queries this analyzer needs.

## Consequences

- Python dependency edges, entry points, and public-surface conclusions are based on syntactic import/definition statements, not resolved semantics — disclosed as the basis for those claims (labeled Detected or Inferred), per the evidence-hierarchy principle in `docs/product/mission.md`, exactly as ADR-0003 discloses for JS/TS.
- Dynamic import patterns (`importlib.import_module(...)`, conditional/`try`/`except ImportError` imports, `sys.path` manipulation, `__import__(...)`), metaprogramming, and runtime-generated structures are out of scope for v1 detection; where they materially affect a conclusion, that surfaces as an `unknown` or `unsupported` gap rather than a silent omission.
- `pyproject.toml`/`setup.cfg` are TOML/INI, not Python source — these are parsed with a small TOML/INI reader, not tree-sitter, since they're configuration data rather than code. `setup.py` (executable Python, e.g. a `setuptools.setup(...)` call with arbitrary surrounding code) is parsed with tree-sitter syntactically, looking specifically for a top-level `setup(...)` call's keyword arguments (e.g. `entry_points`) without executing the file — consistent with never executing untrusted repository content.
- `web-tree-sitter`'s WASM initialization (`Parser.init()`, loading the `.wasm` grammar file) is async and has to happen once per process before parsing; this is an implementation detail of the extractor's setup, not a design cost.
- If a later feature genuinely needs semantic resolution (e.g., resolving `importlib`-driven dynamic imports, or precise type-aware public-surface detection), that's an additive, isolated change — e.g., invoking a type checker like `pyright`/`mypy` for specific queries — not a rewrite of the syntactic foundation, mirroring ADR-0003's equivalent consequence for JS/TS.

## Alternatives considered

Shelling out to system `python3` + the `ast` module was rejected for v1: reference-accurate parsing wasn't worth adding a second language runtime as a permanent operational dependency to a single-deployable architecture (ADR-0001), plus per-file subprocess spawn overhead and a larger process-execution attack surface over untrusted repository content. It remains available later for specific, justified needs (e.g., if tree-sitter's syntactic-only view proves insufficient for a feature that genuinely requires semantic resolution).

A regex-based lightweight scanner was rejected as too fragile a foundation for public-surface and test-relationship detection, risking exactly the "dressed-up file browser" outcome `docs/product/mvp.md` warns against.

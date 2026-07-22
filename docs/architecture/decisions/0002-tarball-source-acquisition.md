# ADR-0002: Source acquisition via GitHub tarball API with enforced extraction limits

## Status

Accepted

## Context

Repo Lore needs the source tree of a public repository at a specific commit. It never needs commit history, blame, branches, or submodules for any feature in the first vertical slice. Two acquisition methods were considered:

- **A.** Resolve the default branch and HEAD commit SHA via the GitHub REST API, then fetch `GET /repos/{owner}/{repo}/tarball/{ref}` and extract it into a temp directory.
- **B.** `git clone --depth 1` the repository.

Because repository content is untrusted third-party input, whichever method is chosen must also defend against unsafe archives: tar-bombs (excessive extracted size), path traversal (`../` entries escaping the target directory), and unbounded extraction time.

## Decision

Use **A**: GitHub's tarball API, with extraction enforcing a hard cap on total extracted size, a hard cap on file count, a wall-clock timeout, and path sanitization that rejects any entry resolving outside the target directory.

## Rationale

A tarball fetch plus tar extraction is fewer moving parts than shelling out to `git`: no git binary dependency in the runtime image, and no git-protocol, hook, or submodule/LFS edge cases to reason about. Since only one commit's tree is ever needed, `git clone` would supply capability (history, refs) that nothing in the product uses. The extraction safety limits are treated as part of this decision, not a later hardening pass, because analyzing untrusted repositories is inherent to the product's mission — a repo that is too large, too deeply nested, or crafted to escape the extraction directory must fail safely rather than being a routine operational risk.

## Consequences

- The worker needs a temp-directory lifecycle: create, extract into, analyze, then always clean up (including on failure/timeout).
- Extraction limits mean some very large repositories will be honestly reported as unsupported/too-large rather than analyzed — an explicit, disclosed limitation rather than a silent failure.
- Authenticated GitHub API access (a PAT to start) is required from the first implementation session, not added later — unauthenticated access is capped at 60 requests/hour, which real usage would exceed quickly even in prototype.

## Alternatives considered

`git clone --depth 1` (B) was rejected: it reintroduces a git-binary runtime dependency and git-protocol attack surface for capability (history) the product doesn't use.

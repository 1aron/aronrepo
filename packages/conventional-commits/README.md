![Aronrepo cover](https://raw.githubusercontent.com/1aron/aronrepo/main/docs/assets/aronrepo-cover.png)

# @aronrepo/conventional-commits

Aronrepo conventional commits are PascalCase commit types with explicit release rules, changelog groups, and AI coding agent guidance.

The taxonomy is based on the Techor conventional-commits package, with stricter Aronrepo behavior for ESM-only packages, commitlint, PR titles, semantic-release, and published package README updates.

## Install

```sh
pnpm add -D @aronrepo/conventional-commits
```

This package is ESM-only.

## Header Format

Commit headers use:

```text
Type(Scope): Summary
```

- `Type` is required and must be one of the exported Aronrepo commit types.
- `Scope` is optional, but recommended for monorepo package, workflow, role, or policy changes.
- `Summary` uses sentence case and does not end with a period.
- No-prefix trivial commits are not allowed in Aronrepo because commit messages and PR titles are both validated by commitlint.

Examples:

```text
Feat(Core): Add ESM builder
Fix(Release): Preserve workspace dependency ranges
Docs(README): Clarify package installation
Benchmark(Runtime): Add parser throughput baseline
Chore(Agent): Update repository guidance for coding agents
```

## Release Rules

Use release-impacting types only when the change should affect a published package version.

| Release | Commit rules |
| --- | --- |
| Major | `Bump(Major)` |
| Minor | `Feat`, `New`, `Bump(Minor)` |
| Patch | `Fix`, `Perf`, `Add`, `Update`, `Improve`, `Upgrade`, `Deprecate`, `Drop`, `Revert`, `Bump(Patch)`, `Docs(README)` |
| None | `Docs`, `Example`, `Test`, `Benchmark`, `Refactor`, `Chore`, `Misc` |

`Docs(README)` is a patch release because published package README content can only reach npm consumers through a new package version. Plain `Docs` is not a release.

`Benchmark` is for benchmark harnesses, baseline data, reports, and measurement-only changes. Use `Perf` only when the change improves or changes published runtime performance behavior.

Manual bumps are allowed for release-management cases:

```text
Bump(Major): Aronrepo v2.0
Bump(Minor): Prepare next public capability
Bump(Patch): Refresh published package metadata
```

## AI Agent Policy

AI coding agents should choose the lowest release-impacting type that accurately describes the change.

Before using `Feat`, `New`, `Fix`, or any other release-impacting type, confirm that the change affects at least one of:

- Published package runtime behavior.
- Public API, exports, or generated types.
- Release, changelog, or versioning behavior.
- Published README content that requires a patch release.

Use `Chore(Agent)` by default for internal AI instructions, prompts, repository context, or agent workflow policy.
Use `Benchmark` for benchmark-only work that should not publish a new package version. Do not use `Perf` for measurement-only changes.

Good examples:

```text
Chore(Agent): Update repository guidance for coding agents
Test(Release): Cover scoped README bump rules
Benchmark(Runtime): Add parser throughput baseline
Docs: Add commit type examples
Docs(README): Clarify package installation
Fix(Release): Preserve workspace dependency ranges
```

Avoid:

```text
Feat(Agent): Add agent guide
Fix(Agent): Rewrite coding instructions
Perf(Runtime): Add parser throughput benchmark
```

Those examples create releases for internal policy-only or measurement-only changes. Use `Chore(Agent)` unless published behavior changes. For benchmark-only changes, use `Benchmark` instead of `Perf`.

## Public API

This package exports the source commit rules and agent-readable helpers:

```ts
import {
    agentCommitPolicy,
    commits,
    findCommitRule,
    getReleaseType,
    nonReleaseCommits,
    nonReleaseTypes,
    releaseCommits,
    releaseTypes,
    types
} from '@aronrepo/conventional-commits'
```

`findCommitRule(type, scope)` resolves scoped rules before unscoped fallbacks. For example, `findCommitRule('Docs', 'README')` resolves to a patch release, while `findCommitRule('Docs', 'Agent')` falls back to plain `Docs` with no release.

`agentCommitPolicy` exposes the same AI guidance as structured data, so tools can read the default internal commit type, release-impact rule, release-worthy change list, non-release defaults, and examples.

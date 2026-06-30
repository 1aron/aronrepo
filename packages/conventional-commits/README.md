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

Commit headers use one of:

```text
Type(Scope): Summary
Type: Summary
```

- `Type` is required and must be one of the exported Aronrepo commit types.
- `Scope` is optional. Use it when it clarifies the monorepo package, workflow, role, policy, or benchmark area; leave it out when it would be vague or artificial.
- `Summary` uses sentence case and does not end with a period.
- No-prefix trivial commits are not allowed in Aronrepo because commit messages and PR titles are both validated by commitlint.

Examples:

```text
Feat(Core): Add ESM builder
Fix(Release): Preserve workspace dependency ranges
Docs(README): Clarify package installation
Benchmark(Benchmarks): Refresh benchmark report
Benchmark: Refresh benchmark report
CI(GitHub): Update PR title check permissions
Build(Tooling): Update Vitest config
Style(Lint): Format TypeScript files
Chore(Agent): Update repository guidance for coding agents
```

## Release Rules

Use release-impacting types only when the change should affect a published package version.

| Release | Commit rules |
| --- | --- |
| Major | `Bump(Major)` |
| Minor | `Feat`, `New`, `Bump(Minor)` |
| Patch | `Fix`, `Perf`, `Add`, `Update`, `Improve`, `Upgrade`, `Deprecate`, `Drop`, `Revert`, `Bump(Patch)`, `Docs(README)` |
| None | `Docs`, `Example`, `Test`, `Benchmark`, `Build`, `CI`, `Style`, `Refactor`, `Chore`, `Misc` |

`Docs(README)` is a patch release because published package README content can only reach npm consumers through a new package version. Plain `Docs` is not a release.

`Benchmark` is for benchmark harnesses, baseline data, reports, and measurement-only changes. A scoped form such as `Benchmark(Benchmarks): ...` is useful when the benchmark area is the object of the change; unscoped `Benchmark: ...` is valid when no clear target exists. Use `Perf` only when the change improves or changes published runtime performance behavior.

`CI`, `Build`, and `Style` are non-release maintenance types. Use `CI` for workflow and status-check changes, `Build` for build tooling and dev-only configuration, and `Style` for formatting-only changes. If the change affects published package behavior, public output, runtime dependencies, or release behavior, choose the matching release-impacting type instead.

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
Use `Benchmark` for benchmark-only work that should not publish a new package version. Scope it only when the scope clarifies the benchmark target; use unscoped `Benchmark: ...` when a scope would be artificial. Do not use `Perf` for measurement-only changes.
Use `CI`, `Build`, and `Style` for non-release maintenance work instead of forcing `Fix`, `Update`, `Improve`, or `Upgrade` onto changes that do not affect published consumers.

Good examples:

```text
Chore(Agent): Update repository guidance for coding agents
Test(Release): Cover scoped README bump rules
Benchmark(Benchmarks): Refresh benchmark report
Benchmark: Refresh benchmark report
CI(GitHub): Update PR title check permissions
Build(Tooling): Update Vitest config
Style(Lint): Format TypeScript files
Chore(Deps): Update Vitest dev dependency
Example(Release): Add semantic-release config sample
Docs: Add commit type examples
Docs(README): Clarify package installation
Fix(Release): Preserve workspace dependency ranges
```

Avoid:

```text
Feat(Agent): Add agent guide
Fix(Agent): Rewrite coding instructions
Perf(Runtime): Add parser throughput benchmark
Fix(CI): Update PR title check permissions
Update(Build): Update Vitest config
Improve(Core): Format TypeScript files
Upgrade(Deps): Update Vitest dev dependency
Feat(Example): Add semantic-release config sample
```

Those examples create releases for internal policy-only, measurement-only, or maintenance-only changes. Use `Chore(Agent)` unless published behavior changes. For benchmark-only changes, use `Benchmark` instead of `Perf`. For CI, build tooling, formatting, dev dependency, or example-only work, use the corresponding non-release type.

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

![Aronrepo cover](https://raw.githubusercontent.com/1aron/aronrepo/main/docs/assets/aronrepo-cover.png)

# @aronrepo/conventional-commits

Aronrepo conventional commits are PascalCase commit types with release modes, a deterministic release resolver, release path checks, changelog groups, and AI coding agent guidance.

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
Add(Core): Support ESM config files
Fix(Release): Preserve workspace dependency ranges
Docs(README): Clarify package installation
Chore(Site): Fix the homepage header transition
Benchmark(Benchmarks): Refresh benchmark report
Benchmark: Refresh benchmark report
CI(GitHub): Update PR title check permissions
Build(Tooling): Update Vitest config
Style(Lint): Format TypeScript files
Chore(Agent): Update repository guidance for coding agents
```

## Release Modes

The release level of a commit depends on the release mode. Set it in `aronrepo.config.js`; the default is `explicit`.

| Release | `explicit` (default) | `auto` |
| --- | --- | --- |
| Major | `Bump(Major)` | `Bump(Major)`, `BREAKING CHANGE:` footer |
| Minor | `Bump(Minor)` | `Feat`, `New`, `Bump(Minor)` |
| Patch | `Feat`, `New`, `Fix`, `Perf`, `Add`, `Update`, `Improve`, `Upgrade`, `Deprecate`, `Drop`, `Revert`, `Bump(Patch)`, `Docs(README)` | `Fix`, `Perf`, `Add`, `Update`, `Improve`, `Upgrade`, `Deprecate`, `Drop`, `Revert`, `Bump(Patch)`, `Docs(README)` |
| None | `Docs`, `Example`, `Test`, `Benchmark`, `Build`, `CI`, `Style`, `Refactor`, `Chore`, `Misc` | same |

```js
// aronrepo.config.js
/** @type {import('@aronrepo/conventional-commits').AronrepoConfig} */
export default {
    release: {
        mode: 'explicit',
        // Optional. Defaults to the directories of public workspace packages.
        paths: { include: ['packages/*/**'], exclude: ['**/tests/**'] }
    }
}
```

`resolveCommitRelease()` decides the level of one commit:

- In `explicit` mode every type except `Bump` is capped at `patch`, and `BREAKING CHANGE:` footers or `Type!:` headers never change the level (they are reported as `implicit-breaking` violations). `Bump(Major)` may carry breaking notes.
- In `auto` mode a breaking marker releases `major`.
- Headers that do not parse, such as merge commits or `feat: ...`, release nothing. There is no fallback to Angular or ESLint rules.
- `Revert` takes the level of the reverted header; a revert and its target in the same release cancel out.
- A release type whose changed files are all outside the release paths releases nothing and is reported as a `release-paths` violation with a suggested non-release header. `Bump` commits are exempt so they can be empty commits.

`Docs(README)` releases a patch because package README content reaches npm only through a new version. A commit that changes only the repository root README is outside the release paths and must use plain `Docs`.

`Benchmark` is for benchmark harnesses, baseline data, reports, and measurement-only changes; use `Perf` only for published runtime performance. `CI`, `Build`, and `Style` are non-release maintenance types. Unpublished sites and apps use non-release types such as `Chore(Site)` even for fixes and performance work.

Manual bumps are owner decisions:

```text
Bump(Major): Aronrepo v3
Bump(Minor): Prepare next public capability
Bump(Patch): Refresh published package metadata
```

## AI Agent Policy

`getAgentCommitPolicy(policy)` returns the agent rules as structured data, and `renderAgentsBlock(policy, { releasePaths })` renders them as the `AGENTS.md` block that `aronrepo agents --write` maintains. The rules:

- Never write `Bump(Major)` or `Bump(Minor)` unless the user explicitly asked for that release level in the current conversation.
- In `explicit` mode, never add a breaking marker; if a change breaks published behavior, stop and ask the user.
- Use a release type only for changes to release paths that affect published behavior, public API, release behavior, or published README content.
- Pick the lowest accurate type: `Add` for new capabilities, `Improve` or `Update` for enhancements, `Fix` for bugs.
- Use `Chore(Agent)` for agent instructions, `Benchmark` for measurement-only work, and `CI`, `Build`, `Style`, `Test`, `Example`, `Docs`, `Refactor`, or `Chore` for other non-release work.
- Run `aronrepo check` and `aronrepo explain` before handing off commits.

Avoid:

```text
Feat(Agent): Add agent guide
Fix(Site): Fix the homepage header transition
Perf(Runtime): Add parser throughput benchmark
Fix(CI): Update PR title check permissions
Upgrade(Deps): Update Vitest dev dependency
Update(Core): Rename an option + "BREAKING CHANGE:" footer (explicit mode)
```

## Public API

```ts
import {
    agentCommitPolicy,
    commits,
    createReleasePathMatcher,
    defineConfig,
    findCommitRule,
    getAgentCommitPolicy,
    getReleasePolicy,
    getReleaseTable,
    getReleaseType,
    parseCommit,
    renderAgentsBlock,
    resolveCommitRelease,
    resolveRelease,
    types
} from '@aronrepo/conventional-commits'

import {
    explainRange,
    loadConfig,
    loadProjectPolicy,
    resolveReleasePaths
} from '@aronrepo/conventional-commits/node'
```

`getReleaseType(type, scope, policy?)` resolves scoped rules before unscoped fallbacks and applies the mode cap; it defaults to `explicit`. The `commits` table keeps the `auto` mode levels.

`resolveCommitRelease(message, policy, { files, isReleasePath })` returns `{ release, reasons, violations }`. `resolveRelease(commits, policy, { isReleasePath })` returns the highest level and every commit decision.

The `./node` subpath reads `aronrepo.config.js`, derives release paths from public workspace packages, and reads commit ranges and changed files from git.

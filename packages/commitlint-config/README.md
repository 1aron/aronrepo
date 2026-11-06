![Aronrepo cover](https://raw.githubusercontent.com/1aron/aronrepo/main/docs/assets/aronrepo-cover.png)

# @aronrepo/commitlint-config

Commitlint config for Aronrepo conventional commits.

This package connects commitlint to the Aronrepo commit taxonomy from `@aronrepo/conventional-commits` and the parser options from `@aronrepo/conventional-changelog-config`. It is intended for commit messages and PR titles that should follow Aronrepo release rules.

## Install

```sh
pnpm add -D @aronrepo/commitlint-config @commitlint/cli
```

This package is ESM-only.

## Usage

```js
// commitlint.config.js
export { default } from '@aronrepo/commitlint-config'
```

Use `.mjs` instead when the consuming repository does not declare `"type": "module"`.

commitlint checks the header only. Pair it with `aronrepo check`, which also checks that a release type changes a published file:

```sh
# .husky/commit-msg
pnpm exec commitlint --edit "$1"
pnpm exec aronrepo check --edit "$1"
```

Run commitlint against a commit range:

```sh
pnpm exec commitlint --from=HEAD~1 --verbose
```

Validate a pull request title:

```sh
printf '%s\n' "$PR_TITLE" | pnpm exec commitlint --verbose
```

## Header Format

Aronrepo commit headers use one of:

```text
Type(Scope): Summary
Type: Summary
```

Examples:

```text
Add(Core): Support ESM config files
Fix(Release): Preserve workspace dependency ranges
Docs(README): Clarify package installation
Benchmark(Benchmarks): Refresh benchmark report
Benchmark: Refresh benchmark report
CI(GitHub): Update PR title check permissions
Build(Tooling): Update Vitest config
Style(Lint): Format TypeScript files
Chore(Agent): Update repository guidance for coding agents
```

## Rules

The config:

- Uses Aronrepo parser options for `Type(Scope): Summary` and `Type: Summary` headers.
- Restricts commit types to the exported Aronrepo type list.
- Requires sentence-case type, scope, and subject values, with exact exported uppercase acronyms such as `CI` allowed by the type list.
- Rejects headers without a type or summary, such as `Update the cache` or `feat: add builder`.
- Rejects subject exclamation marks and `Type!:` headers.
- `aronrepo/no-implicit-breaking`: in `explicit` mode (the default, read from `aronrepo.config.js`), rejects `BREAKING CHANGE:` footers outside `Bump(Major)`. Only the owner decides a major release. Pass `[2, 'always', { mode: 'auto' }]` to override the mode.
- Rejects subjects ending in a period.
- Warns when body and footer sections do not start after a blank line.

## AI Coding Agents

AI coding agents should use this config when they need commit and PR title validation that matches Aronrepo release behavior. Agent-only guidance, prompts, and repository context should usually use:

```text
Chore(Agent): Update repository guidance for coding agents
```

Published package README changes should use:

```text
Docs(README): Clarify package installation
```

`Docs(README)` is release-impacting because package README content is published to npm.

Benchmark-only work should use:

```text
Benchmark(Benchmarks): Refresh benchmark report
Benchmark: Refresh benchmark report
```

Use a meaningful scope when it clarifies the benchmark target; leave the scope off when no clear object exists.
Use `Perf` only for changes that affect published runtime performance behavior.

Non-release maintenance work should use:

```text
CI(GitHub): Update PR title check permissions
Build(Tooling): Update Vitest config
Style(Lint): Format TypeScript files
```

Use release-impacting types only when the change affects published package behavior, public API, release behavior, or published README content, and never write `Bump(Major)`, `Bump(Minor)`, or a breaking marker unless the user asked for that release level.

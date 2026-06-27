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

Run commitlint against a commit range:

```sh
pnpm exec commitlint --from=HEAD~1 --verbose
```

Validate a pull request title:

```sh
printf '%s\n' "$PR_TITLE" | pnpm exec commitlint --verbose
```

## Header Format

Aronrepo commit headers use:

```text
Type(Scope): Summary
```

Examples:

```text
Feat(Core): Add ESM builder
Fix(Release): Preserve workspace dependency ranges
Docs(README): Clarify package installation
Benchmark(Runtime): Add parser throughput baseline
Chore(Agent): Update repository guidance for coding agents
```

## Rules

The config:

- Uses Aronrepo parser options for `Type(Scope): Summary` headers.
- Restricts commit types to the exported Aronrepo type list.
- Requires sentence-case type, scope, and subject values.
- Rejects subject exclamation marks.
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
Benchmark(Runtime): Add parser throughput baseline
```

Use `Perf` only for changes that affect published runtime performance behavior.

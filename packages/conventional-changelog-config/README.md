![Aronrepo cover](https://raw.githubusercontent.com/1aron/aronrepo/main/docs/assets/aronrepo-cover.png)

# @aronrepo/conventional-changelog-config

Conventional changelog preset for Aronrepo conventional commits.

This package exports the parser options, writer options, and recommended bump logic that keep changelog generation aligned with Aronrepo commit types and release rules.

## Install

```sh
pnpm add -D @aronrepo/conventional-changelog-config
```

This package is ESM-only.

## Usage

```ts
import createPreset, {
    parserOpts,
    recommendedBumpOpts,
    writerOpts
} from '@aronrepo/conventional-changelog-config'

const preset = await createPreset()
```

`createPreset()` resolves to:

```ts
{
    parserOpts,
    recommendedBumpOpts,
    writerOpts
}
```

## Parser Options

The parser accepts Aronrepo headers:

```text
Type(Scope): Summary
Type: Summary
```

Examples:

```text
Feat(Core): Add parser
Docs(README): Clarify package installation
Benchmark(Benchmarks): Refresh benchmark report
Benchmark: Refresh benchmark report
CI(GitHub): Update PR title check permissions
Chore(Agent): Update repository guidance for coding agents
```

It also recognizes standard revert headers so reverts can be released and grouped consistently.

## Recommended Bumps

`recommendedBumpOpts.whatBump()` resolves release levels from `@aronrepo/conventional-commits`:

- `Bump(Major)` and breaking changes are major release inputs.
- `Feat`, `New`, and `Bump(Minor)` are minor release inputs.
- `Fix`, `Perf`, `Add`, `Update`, `Improve`, `Upgrade`, `Deprecate`, `Drop`, `Revert`, `Bump(Patch)`, and `Docs(README)` are patch release inputs.
- Plain `Docs`, `Example`, `Test`, `Benchmark`, `Build`, `CI`, `Style`, `Refactor`, `Chore`, and `Misc` do not request a release.

Scoped and unscoped `Benchmark` commits are both non-release. Use a scope only when it clarifies the benchmark target.

## Writer Options

`writerOpts` groups release notes by Aronrepo changelog groups such as New Features, Bug Fixes, Additions, Updates, Improvements, Upgrades, Benchmarks, and Deprecations.

Scoped rules can affect release analysis without forcing a changelog entry. For example, `Docs(README)` requests a patch release because npm package README content changed, while ordinary internal documentation can remain non-release.
Scopes remain optional; omit them when they would be vague or artificial.

## With Semantic Release

Most projects should use `@aronrepo/semantic-release-config`, which wires these options into `@semantic-release/commit-analyzer` and `@semantic-release/release-notes-generator`.

Use this package directly only when you need the lower-level conventional changelog preset.

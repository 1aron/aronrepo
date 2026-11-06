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
    createRecommendedBumpOpts,
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

`recommendedBumpOpts.whatBump()` resolves release levels with `resolveRelease()` from `@aronrepo/conventional-commits` in the default `explicit` mode:

- `Bump(Major)` is the only major release input, and `Bump(Minor)` the only minor one. Breaking footers do not change the level.
- `Feat`, `New`, `Fix`, `Perf`, `Add`, `Update`, `Improve`, `Upgrade`, `Deprecate`, `Drop`, `Revert`, `Bump(Patch)`, and `Docs(README)` are patch release inputs.
- Plain `Docs`, `Example`, `Test`, `Benchmark`, `Build`, `CI`, `Style`, `Refactor`, `Chore`, and `Misc` do not request a release.

Use `createRecommendedBumpOpts({ mode: 'auto' })` for Conventional Commits behavior, where `Feat` and `New` are minor inputs and breaking footers are major inputs. Recommended bumps do not see changed files, so they do not apply release paths; use `aronrepo explain` for the full decision.

Scoped and unscoped `Benchmark` commits are both non-release. Use a scope only when it clarifies the benchmark target.

## Writer Options

`writerOpts` groups release notes by Aronrepo changelog groups such as New Features, Bug Fixes, Additions, Updates, Improvements, Upgrades, Benchmarks, and Deprecations.

Scoped rules can affect release analysis without forcing a changelog entry. For example, `Docs(README)` requests a patch release because npm package README content changed, while ordinary internal documentation can remain non-release.
Scopes remain optional; omit them when they would be vague or artificial.

## With Semantic Release

Most projects should use `@aronrepo/semantic-release-config`, which wires these options into `@semantic-release/commit-analyzer` and `@semantic-release/release-notes-generator`.

Use this package directly only when you need the lower-level conventional changelog preset.

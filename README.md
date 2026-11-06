![Aronrepo cover](docs/assets/aronrepo-cover.png)

# Aronrepo

Aronrepo is an ESM-only pnpm monorepo for Aron project toolchain packages. It keeps commit rules, changelog generation, semantic-release configuration, and pnpm workspace publishing aligned through one shared set of packageable conventions.

The project is designed for repositories that want predictable releases without scattering release policy across several unrelated config files. Each package has one focused responsibility, and the default path is strict TypeScript, ESM output, package-local `dist/` files, and npm provenance support.

## Why Aronrepo

- One release policy drives commitlint, changelog grouping, semantic-release, the `aronrepo` CLI, and AI coding agent guidance.
- The owner decides versions by default. In `explicit` mode only `Bump(Minor)` and `Bump(Major)` raise minor and major versions; `Feat`, `New`, and `BREAKING CHANGE:` footers cannot. Repositories that want Conventional Commits behavior opt into `auto` mode.
- Release paths keep internal work out of releases: a `Fix(Site)` or `Perf(Benchmarks)` commit that touches no published package file is rejected before merge and never releases.
- Every decision is explainable: `aronrepo explain` prints the next release level and the reason for each commit, so humans and agents can check a release before pushing.
- pnpm workspace packages are discovered and published through semantic-release without replacing package-level ownership.
- ESM is the only runtime target. Published packages export `dist/**/*.js` and `dist/**/*.d.ts` without CommonJS fallbacks.
- AI coding agents get clear instructions for commit selection, README changes, release behavior, and conservative adoption in external repositories.

## Packages

| Package | Role |
| --- | --- |
| `aronrepo` | Facade package and `aronrepo` CLI: `check`, `explain`, `policy`, `agents`, and `doctor`. |
| `@aronrepo/conventional-commits` | Commit taxonomy, release modes, the release resolver, release paths, and AI agent commit policy. |
| `@aronrepo/commitlint-config` | Commitlint config for Aronrepo commit and PR title validation, including the explicit-mode breaking marker rule. |
| `@aronrepo/conventional-changelog-config` | Conventional changelog preset with parser options, writer options, and policy-aware recommended bumps. |
| `@aronrepo/semantic-release-config` | Semantic-release defaults with the Aronrepo commit analyzer, release notes, GitHub releases, and workspace package discovery. |
| `@aronrepo/semantic-release-pnpm` | Semantic-release plugin that writes package versions and publishes pnpm workspace packages. |

## Install

```sh
pnpm add -D aronrepo @commitlint/cli semantic-release husky
```

`aronrepo` brings the published `@aronrepo/*` packages and the `aronrepo` CLI. `@commitlint/cli` and `semantic-release` stay explicit peer tools. For partial adoption, install only the packages that match the role you need:

```sh
pnpm add -D @aronrepo/conventional-commits @aronrepo/commitlint-config @commitlint/cli
pnpm add -D @aronrepo/conventional-changelog-config
pnpm add -D @aronrepo/semantic-release-config @aronrepo/semantic-release-pnpm semantic-release
```

All packages are ESM-only. In repositories with `"type": "module"`, `.js` config files can import them directly; otherwise use `.mjs`.

## Basic Setup

Release policy, read by every Aronrepo tool:

```js
// aronrepo.config.js
/** @type {import('aronrepo').AronrepoConfig} */
export default {
    release: {
        mode: 'explicit' // or 'auto'
    }
}
```

Commitlint:

```js
// commitlint.config.js
export { default } from '@aronrepo/commitlint-config'
```

Semantic release:

```js
// release.config.js
import { configure } from '@aronrepo/semantic-release-config'

export default configure()
```

Commit hook (`.husky/commit-msg`):

```sh
pnpm exec commitlint --edit "$1"
pnpm exec aronrepo check --edit "$1"
```

Agent guidance, then a setup check:

```sh
pnpm exec aronrepo agents --write
pnpm exec aronrepo doctor
```

The release config analyzes commits with `@aronrepo/semantic-release-config/analyzer` and adds `@aronrepo/semantic-release-pnpm` for every workspace package with `"publishConfig": { "access": "public" }`.

## Release Modes

| Commit | `explicit` (default) | `auto` |
| --- | --- | --- |
| `Bump(Major)` / `Bump(Minor)` / `Bump(Patch)` | major / minor / patch | major / minor / patch |
| `Feat`, `New` | patch | minor |
| `Fix`, `Perf`, `Add`, `Update`, `Improve`, `Upgrade`, `Deprecate`, `Drop`, `Docs(README)` | patch | patch |
| `BREAKING CHANGE:` footer | rejected by commitlint, never changes the level | major |
| `Revert` | the level of the reverted commit; both cancel when unreleased | same |
| Headers that do not parse (merge commits, `feat: ...`) | none | none |
| Any release type that changes no release path | none, rejected by `aronrepo check` | same |

Use `explicit` when the owner decides minor and major versions, for example a framework with public migration guides. Use `auto` when coding agents and contributors should release features and breaking changes on their own. Coding agents must not choose the mode; ask the repository owner.

Release paths default to the directories of public workspace packages (or every path in a published single-package repository), excluding tests, benchmarks, examples, changelogs, `.github`, and `.husky`. Override them with `release.paths.include` and `release.paths.exclude`, or set `release.paths: false` to turn the check off.

## Commit Format

```text
Type(Scope): Summary
```

```text
Add(Core): Support ESM config files
Fix(Release): Preserve workspace dependency ranges
Docs(README): Clarify package installation
Chore(Site): Fix the homepage header transition
Benchmark(Runtime): Add parser throughput baseline
CI(GitHub): Update PR title check permissions
Chore(Agent): Update repository guidance for coding agents
```

`Docs(README)` releases a patch only when it changes a published package README; the repository root README uses plain `Docs`. Unpublished sites and apps use non-release types even for fixes and performance work.

## CLI

| Command | Use |
| --- | --- |
| `aronrepo check --edit <file>` | commit-msg hook: the message and the staged files |
| `aronrepo check --from <ref> --to <ref>` | CI: every commit with its own changed files |
| `aronrepo check --title <title> --base <ref> --head <ref>` | PR title with the PR diff, for squash merges |
| `aronrepo explain [--from <ref>]` | next release level and the reason for each commit, from the latest tag by default |
| `aronrepo policy [--json\|--markdown]` | the effective release policy, machine-readable with `--json` |
| `aronrepo agents [--write]` | check or regenerate the policy block in `AGENTS.md` |
| `aronrepo doctor` | check the setup and print fixes |

Every command accepts `--cwd`, `--mode`, and `--json`.

## AI Coding Integration

Aronrepo is built so coding agents can adopt it and follow it without guessing. The policy is data (`aronrepo policy --json`), the agent instructions are generated (`aronrepo agents --write`), every rule is enforced by a tool, and every release decision is explained (`aronrepo explain`). The durable guide is in [docs/ai-coding.md](docs/ai-coding.md).

Copy and paste this prompt into an AI coding agent to integrate Aronrepo into another repository:

```text
You are working in an existing JavaScript or TypeScript repository. Integrate the Aronrepo toolchain end to end.

First inspect the repo before editing: package manager, Node version, module type, workspace layout, published packages, release setup, commitlint setup, git hooks, CI workflows, README, and agent guidance files.

Before editing, ask me which release mode to use and wait for the answer. Do not choose it yourself:
- explicit: only I raise minor and major versions with Bump(Minor) and Bump(Major) commits.
- auto: Feat and New release minor versions, and BREAKING CHANGE footers release major versions.

Then adopt Aronrepo conservatively:
1. Use ESM-compatible configuration only.
2. Install with `pnpm add -D aronrepo @commitlint/cli semantic-release husky`.
3. Create aronrepo.config.js with the release mode I chose. Add release.paths only if the default paths (public workspace packages) do not match what ships.
4. Configure commitlint to export @aronrepo/commitlint-config and semantic-release to use configure() from @aronrepo/semantic-release-config. Remove @semantic-release/commit-analyzer.
5. Add a commit-msg hook that runs `commitlint --edit "$1"` and `aronrepo check --edit "$1"`.
6. Run `pnpm exec aronrepo agents --write` to add the generated commit policy to AGENTS.md. Do not copy the release table by hand.
7. If CI exists, check pull request commits with `aronrepo check --from <base> --to <head>` and PR titles with `aronrepo check --title`.
8. Preserve the existing architecture and avoid unrelated refactors.
9. Run `pnpm exec aronrepo doctor` until it reports no failures, then run `pnpm exec aronrepo explain` and report the next release level.

When finished, summarize the changed files, the release mode and release paths, behavior intentionally left unchanged, and the validation results. Use non-release commit types for this setup work (for example Build(Release) or Chore(Agent)).
```

## Local Development

Aronrepo itself requires Node.js `^26` and `pnpm@12.18.0`. `.node-version` pins Node 26 for fnm and other version managers, and `pnpm install` sets up the husky commit-msg hook.

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run lint
pnpm run type-check
pnpm run check
```

For focused package work:

```sh
pnpm --filter @aronrepo/semantic-release-config run test
pnpm --filter @aronrepo/semantic-release-pnpm run type-check
pnpm --filter aronrepo run build
```

`pnpm run check` runs `aronrepo check` on the commits since `origin/main`, then Turbo tasks for `test`, `lint`, and `type-check`.

## Release Model

The root `release.config.js` exports `configure()` from `@aronrepo/semantic-release-config`, and `aronrepo.config.js` sets this repository to `explicit` mode. Releases run on `main`, maintenance branches, `next`, `next-major`, and prerelease branches such as `alpha`, `beta`, `rc`, and `canary`. The release job prints `aronrepo explain` before `semantic-release` runs.

Public workspace packages are published by `@aronrepo/semantic-release-pnpm`. The plugin writes the semantic-release version into the target package, maps release channels to npm dist-tags, honors package-level registry settings, supports npm token and OIDC auth, and passes provenance when `publishConfig.provenance` is enabled.

## Repository Context

Use [docs/ai-context/README.md](docs/ai-context/README.md) for deeper architecture, package ownership, validation, CI, and release workflow context.

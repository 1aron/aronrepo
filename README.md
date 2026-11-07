![Aronrepo cover](docs/assets/aronrepo-cover.png)

# Aronrepo

Aronrepo gives a JavaScript repository one commit standard and one release engine, built so the repository owner and coding agents follow the same rules.

- **One fixed commit standard.** Every type has one meaning and a written purpose. Repositories choose a release mode and release paths, not their own types, parsers, or presets.
- **The owner decides versions.** In the default `explicit` mode only `Bump(Minor)` and `Bump(Major)` raise minor and major versions. Repositories that want Conventional Commits behavior opt into `auto`.
- **Internal work does not release.** A `Fix(Site)` or `Perf(Benchmarks)` commit that changes no published file is rejected before merge and never releases.
- **Every decision is explained.** `aronrepo explain` prints the next version and the reason for each commit, and `aronrepo release` logs the same decisions when it publishes.
- **Releases finish.** `aronrepo release` publishes every package on a staging dist-tag, moves the channel's dist-tag only when all of them are on the registry, and resumes an interrupted run instead of skipping it.
- **Agents get the policy as data.** `aronrepo policy --json` and the generated `AGENTS.md` block describe every type, so agents pick types instead of guessing.

There is no semantic-release, commitlint, or changelog preset to configure. `aronrepo` is one ESM-only package with no peer tools.

## Install

```sh
bun add -d aronrepo husky
```

Any package manager works: `pnpm add -D aronrepo husky` or `npm install -D aronrepo husky`. Aronrepo packs packages with the repository's package manager (from `packageManager` or the lockfile) and publishes them with npm.

## Setup

Choose the release mode in `aronrepo.config.js`:

```js
/** @type {import('aronrepo').AronrepoConfig} */
export default {
    release: {
        mode: 'explicit' // or 'auto'
    }
}
```

Check every commit in `.husky/commit-msg`:

```sh
aronrepo check --edit "$1"
```

Generate the agent instructions and check the setup:

```sh
bun x aronrepo agents --write
bun x aronrepo doctor
```

Release from CI on pushes to a release branch. The job needs the full history, `contents: write` to push the tag, and `id-token: write` for npm trusted publishing and provenance:

```yaml
release:
    if: ${{ github.event_name == 'push' && contains(fromJSON('["main","alpha","beta","rc","canary"]'), github.ref_name) }}
    runs-on: ubuntu-latest
    permissions:
        contents: write
        id-token: write
    steps:
        - uses: actions/checkout@v6
          with:
              fetch-depth: 0
        - uses: oven-sh/setup-bun@v2
        - uses: actions/setup-node@v6
          with:
              node-version: 26
        - run: bun install --frozen-lockfile
        - run: bun run build
        - run: bun x aronrepo release
          env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
              NPM_TOKEN: ${{ secrets.NPM_TOKEN }} # optional with npm trusted publishing
```

## Commit Format

```text
Type(Scope): Summary
```

The type is one of the types below, the scope names the package or area, and the summary starts with an uppercase letter or digit and has no trailing period. Leave a blank line before the body and before a `BREAKING CHANGE:` footer.

```text
Add(Core): Support ESM config files
Fix(Release): Preserve workspace dependency ranges
Docs(README): Clarify package installation
Chore(Site): Fix the homepage header transition
Benchmark(Runtime): Add parser throughput baseline
Chore(Agent): Update repository guidance for coding agents
```

## Commit Types

| Type | `explicit` | `auto` | Use for |
| --- | --- | --- | --- |
| `Bump(Major)` | major | major | Release a major version. Only the repository owner decides it. |
| `Bump(Minor)` | minor | minor | Release a minor version. Only the repository owner decides it. |
| `Bump(Patch)` | patch | patch | Release a patch version without another release commit. |
| `Add` | patch | minor | A new capability: a new API, export, option, command, or package. |
| `Improve` | patch | patch | A better existing capability without new API: behavior, output, messages, or defaults. |
| `Perf` | patch | patch | Faster or lighter published code with the same behavior. |
| `Fix` | patch | patch | A bug fix in published behavior. |
| `Deprecate` | patch | patch | Mark a published capability as deprecated while it keeps working. |
| `Drop` | patch | patch | Remove a published capability. |
| `Upgrade` | patch | patch | Change a runtime dependency of a published package. |
| `Revert` | reverted | reverted | Revert a commit. It releases what the reverted commit released; both cancel when neither is released yet. |
| `Docs(README)` | patch | patch | Change a published package README. |
| `Docs` | none | none | Documentation that is not a published package README. |
| `Test` | none | none | Tests that cover existing behavior. |
| `Benchmark` | none | none | Benchmark harnesses, fixtures, and reports. |
| `Example` | none | none | Examples that do not ship in a package. |
| `Build` | none | none | Build tooling and development configuration. |
| `CI` | none | none | CI workflows and automation. |
| `Style` | none | none | Formatting and lint-only changes. |
| `Refactor` | none | none | Code changes that keep published behavior. |
| `Chore` | none | none | Maintenance: development dependencies, lockfiles, metadata, agent guidance, and unpublished workspaces. |
| `BREAKING CHANGE:` footer | rejected | major | |

The legacy types `Feat` and `New` (now `Add`), `Update` (now `Improve`), and `Misc` (now `Chore`) still resolve in history with the level of their replacement, so old tags keep their meaning, but `aronrepo check` rejects them in new commits.

Release notes list the commits that release, grouped as Additions, Improvements, Performance, Bug Fixes, Deprecations, Removals, Dependencies, Reverts, and Documentation, with the `BREAKING CHANGE:` footers of a major release first.

## Release Modes

Use `explicit` when the owner decides minor and major versions, for example a framework with public migration guides. Use `auto` when contributors and coding agents should release features and breaking changes on their own. Coding agents must not choose the mode; ask the repository owner.

## Release Paths

Release paths default to the directories of public workspace packages (`"publishConfig": { "access": "public" }`), or every path in a published single-package repository, excluding tests, benchmarks, examples, changelogs, `.github`, and `.husky`. A release type on a commit that changes no release path is rejected by `aronrepo check` and releases nothing. Override the paths with `release.paths.include` and `release.paths.exclude`, or set `release.paths: false` to turn the check off.

## Releasing

| Branch | Version | npm dist-tag |
| --- | --- | --- |
| `main` | `X.Y.Z` from the latest stable tag | `latest` |
| `alpha`, `beta`, `rc`, `canary` | `X.Y.Z-<branch>.N` | the branch name |

`aronrepo release` reads versions from `vX.Y.Z` tags; the `version` in each `package.json` is not used or committed. A repository without tags starts at `1.0.0`. All published packages share one version.

1. Plan the version from the commits since the channel's last tag. Other branches do not release.
2. Write the version and git head into every published package and pack it with the repository's package manager, which turns `workspace:` ranges into the release version.
3. Publish the packages in dependency order on the `aronrepo-staging` dist-tag with npm, with `--provenance` when `publishConfig.provenance` is set.
4. Wait until the registry serves every package, then move the channel's dist-tag to the new version.
5. Push the version tag and create the GitHub release with the release notes.

Rerunning the job finishes an interrupted release: a version already published from the same commit is skipped, a version published from another commit stops the release, and a tagged commit without a GitHub release gets one. npm auth comes from `.npmrc`, then npm trusted publishing through GitHub Actions OIDC, then `NPM_TOKEN`. Run `aronrepo release --dry-run` to print the plan and the notes without changing anything.

## CLI

| Command | Use |
| --- | --- |
| `aronrepo check --edit <file>` | commit-msg hook: the message and the staged files |
| `aronrepo check --from <ref> --to <ref>` | CI: every commit with its own changed files |
| `aronrepo check --title <title> --base <ref> --head <ref>` | a PR title with the PR diff, for squash merges |
| `aronrepo explain` | the next version and the reason for each commit |
| `aronrepo release [--dry-run]` | publish the next release |
| `aronrepo policy [--json\|--markdown]` | the effective policy: mode, release paths, and every type |
| `aronrepo agents [--write]` | check or regenerate the policy block in `AGENTS.md` |
| `aronrepo doctor` | check the setup and print fixes |

Every command accepts `--cwd`, `--mode`, and `--json`. The same functions are available from `aronrepo/node`, and the commit standard itself (types, parser, release resolver, version and notes helpers) from `aronrepo`, which has no Node dependencies.

## AI Coding Integration

Aronrepo is built so coding agents can adopt it and follow it without guessing. The policy is data (`aronrepo policy --json`), the agent instructions are generated (`aronrepo agents --write`), every rule is enforced by `aronrepo check`, and every release decision is explained by `aronrepo explain`. The durable guide is in [docs/ai-coding.md](docs/ai-coding.md).

Copy and paste this prompt into an AI coding agent to integrate Aronrepo into another repository:

```text
You are working in an existing JavaScript or TypeScript repository. Integrate Aronrepo end to end.

First inspect the repo before editing: package manager, Node version, module type, workspace layout, published packages, release setup, commit linting, git hooks, CI workflows, README, and agent guidance files.

Before editing, ask me which release mode to use and wait for the answer. Do not choose it yourself:
- explicit: only I raise minor and major versions with Bump(Minor) and Bump(Major) commits.
- auto: Add releases minor versions, and BREAKING CHANGE footers release major versions.

Then adopt Aronrepo conservatively:
1. Use ESM-compatible configuration only.
2. Install aronrepo and husky as development dependencies with the repository's package manager.
3. Create aronrepo.config.js with the release mode I chose. Add release.paths only if the default paths (public workspace packages) do not match what ships.
4. Remove semantic-release, commitlint, and their configs and plugins; Aronrepo replaces them.
5. Add a commit-msg hook that runs `aronrepo check --edit "$1"`.
6. Run `aronrepo agents --write` to add the generated commit policy to AGENTS.md. Do not copy the type table by hand.
7. If CI exists, check pull request commits with `aronrepo check --from <base> --to <head>` and PR titles with `aronrepo check --title`, and release with `aronrepo release` on pushes to main and prerelease branches.
8. Preserve the existing architecture and avoid unrelated refactors.
9. Run `aronrepo doctor` until it reports no failures, then run `aronrepo explain` and `aronrepo release --dry-run`, and report the next version.

When finished, summarize the changed files, the release mode and release paths, behavior intentionally left unchanged, and the validation results. Use non-release commit types for this setup work (for example Build(Release), CI(GitHub), or Chore(Agent)).
```

## Migrating from Aronrepo 2

- Remove `semantic-release`, `@semantic-release/*`, `@commitlint/cli`, every `@aronrepo/*` package, `release.config.js`, and `commitlint.config.js`. Install `aronrepo` only.
- Replace `commitlint --edit "$1"` in the commit-msg hook with `aronrepo check --edit "$1"`, and `semantic-release` in CI with `aronrepo release`.
- Import the commit standard from `aronrepo` instead of `@aronrepo/conventional-commits`, and the Node helpers and commands from `aronrepo/node`.
- Write `Add` instead of `Feat` or `New`, `Improve` instead of `Update`, and `Chore` instead of `Misc`.
- Run `aronrepo agents --write`, `aronrepo doctor`, and `aronrepo release --dry-run`.

## Local Development

Aronrepo itself uses Bun 1.4.4 workspaces and Node.js `^26`. `.node-version` pins Node 26 for fnm and other version managers, and `bun install` sets up the husky commit-msg hook.

```sh
bun install
bun run build
bun run test
bun run lint
bun run type-check
bun run check
```

`bun run check` runs `aronrepo check` on the commits since `origin/main`, then the Turbo `test`, `lint`, and `type-check` tasks.

## Repository Context

Use [docs/ai-context/README.md](docs/ai-context/README.md) for deeper architecture, package ownership, validation, CI, and release workflow context.

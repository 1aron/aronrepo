# Project Map

Aronrepo is a Bun workspace with one published TypeScript package, `aronrepo`, in `packages/aronrepo`. It is ESM-only and built with `tsdown` into `dist/`.

## Root Layout

- `package.json`: root scripts, the Bun package manager and workspace pattern, Node requirement, and development dependencies (all tools are `devDependencies`).
- `bun.lock`: the Bun lockfile.
- `.node-version`: Node major version for fnm and other version managers.
- `turbo.json`: task graph for build, test, lint, and type-check.
- `tsconfig.json`: shared strict TypeScript defaults.
- `aronrepo.config.js`: this repository's release policy (`explicit` mode).
- `eslint.config.js`: root ESLint config for repository linting.
- `.husky/commit-msg`: runs `aronrepo check --edit` on every commit.
- `shared/`: shared Vitest config and CI timeout helpers.
- `.github/workflows/`: CI, release, and PR title validation workflows.
- `packages/aronrepo/`: the published package.

## Package Layout

`packages/aronrepo/src`:

- `commits.ts`: the fixed commit type table with release levels, descriptions, and release notes groups, plus the legacy types and their replacements.
- `policy.ts`: release modes, release path matching, the commit parser, and the release resolver (`resolveCommitRelease`, `resolveRelease`) with every violation rule.
- `agent.ts`: the agent policy and the generated AGENTS.md block.
- `version.ts`: release branches and channels, version tags, release ranges, and next versions.
- `notes.ts`: release notes rendering: a GitHub release body by default, or a changelog entry with `heading: true`.
- `project.ts`: `aronrepo.config.js` loading, package manager detection, workspace discovery, release paths, and git range helpers.
- `release.ts`: the release engine (`planRelease`, `runRelease`): packing, npm publishing, auth, dist-tags, version tags, and GitHub releases.
- `commands.ts` and `cli.ts`: the `check`, `explain`, `release`, `policy`, `agents`, and `doctor` commands.
- `index.ts`: the `aronrepo` entry, which re-exports the modules without Node dependencies.
- `node.ts`: the `aronrepo/node` entry, which re-exports `project.ts`, `commands.ts`, and `release.ts`.

Tests live in `packages/aronrepo/tests`, one file per module. Release tests run the engine against temporary git repositories with a fake npm registry and GitHub API.

## Common Ownership Pointers

- Change commit types in `commits.ts`, and release behavior in `policy.ts`: every consumer (the commit hook, CI checks, `explain`, `release`) calls `resolveCommitRelease`. Run `bun run aronrepo agents --write` afterwards.
- Change version numbering or branches in `version.ts`, and publishing in `release.ts`.
- Shared test defaults are owned by `shared/vitest.config.ts` and `shared/vitest-ci-config.ts`.

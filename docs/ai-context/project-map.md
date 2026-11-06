# Project Map

Aronrepo is a pnpm workspace with published TypeScript packages in `packages/*`. Packages are ESM-only and are built with `tsdown` into package-local `dist/` directories.

## Root Layout

- `package.json`: root scripts, Node/pnpm requirements, workspace dev dependencies, and release entrypoints.
- `.node-version`: Node major version for fnm and other version managers.
- `pnpm-workspace.yaml`: workspace package patterns and pnpm build allowances.
- `turbo.json`: task graph for build, test, lint, and type-check.
- `tsconfig.json`: shared strict TypeScript defaults.
- `aronrepo.config.js`: this repository's release policy (`explicit` mode).
- `commitlint.config.js`: root commitlint config for commit and PR title validation.
- `eslint.config.js`: root ESLint config for repository linting.
- `release.config.js`: semantic-release entrypoint using `@aronrepo/semantic-release-config`.
- `.husky/commit-msg`: runs commitlint and `aronrepo check` on every commit.
- `shared/`: shared Vitest config and CI timeout helpers.
- `.github/workflows/`: CI, release, and PR title validation workflows.
- `packages/`: publishable workspace packages.

## Package Responsibilities

- `aronrepo`: facade package and the `aronrepo` CLI (`check`, `explain`, `policy`, `agents`, `doctor`).
- `@aronrepo/conventional-commits`: commit types, release levels, release modes, the release resolver (`resolveCommitRelease`, `resolveRelease`), release path matching, agent policy, and the generated AGENTS block. The `./node` subpath loads `aronrepo.config.js`, discovers workspaces, resolves release paths, and reads git history.
- `@aronrepo/commitlint-config`: commitlint config built on Aronrepo conventional commits, including the `aronrepo/no-implicit-breaking` rule.
- `@aronrepo/conventional-changelog-config`: conventional changelog preset, parser options, writer options, and policy-aware recommended bumps.
- `@aronrepo/semantic-release-config`: semantic-release configuration, the Aronrepo commit analyzer (`./analyzer`), and public workspace package discovery.
- `@aronrepo/semantic-release-pnpm`: semantic-release plugin that prepares and publishes pnpm workspace packages.

## Source and Test Locations

Each package follows the same basic shape:

- Source: `packages/<name>/src/**/*.ts`
- Tests: `packages/<name>/tests/**/*.ts`
- Build config: `packages/<name>/tsdown.config.ts`
- TypeScript config: `packages/<name>/tsconfig.json`
- Vitest config: `packages/<name>/vitest.config.ts`
- Package metadata and exports: `packages/<name>/package.json`

Most package `vitest.config.ts` files import `../../shared/vitest.config`. Prefer changing the shared config when test behavior should apply across packages.

## Common Ownership Pointers

- Commit types and auto-mode levels live in `packages/conventional-commits/src/commits.ts`. Mode capping, breaking markers, reverts, and release paths live in `packages/conventional-commits/src/policy.ts`. Every consumer (commitlint rule, analyzer, recommended bump, CLI) calls `resolveCommitRelease`, so change release behavior there.
- Agent rules and the AGENTS block live in `packages/conventional-commits/src/agent.ts`. After changing them, run `pnpm exec aronrepo agents --write`.
- Commitlint behavior is owned by `packages/commitlint-config`.
- Changelog parsing, grouping, and recommended bumps are owned by `packages/conventional-changelog-config`.
- semantic-release defaults, the analyzer, and workspace package discovery are owned by `packages/semantic-release-config`.
- pnpm package version writing, auth handling, dist-tag mapping, packing, and publishing behavior are owned by `packages/semantic-release-pnpm`.
- Shared test defaults are owned by `shared/vitest.config.ts` and `shared/vitest-ci-config.ts`.

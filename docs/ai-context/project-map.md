# Project Map

Aronrepo is a pnpm workspace with published TypeScript packages in `packages/*`. Packages are ESM-only and are built with `tsdown` into package-local `dist/` directories.

## Root Layout

- `package.json`: root scripts, Node/pnpm requirements, workspace dev dependencies, and release entrypoints.
- `pnpm-workspace.yaml`: workspace package patterns and pnpm build allowances.
- `turbo.json`: task graph for build, test, lint, and type-check.
- `tsconfig.json`: shared strict TypeScript defaults.
- `commitlint.config.js`: root commitlint config for commit and PR title validation.
- `eslint.config.js`: root ESLint config for repository linting.
- `release.config.js`: semantic-release entrypoint using `@aronrepo/semantic-release-config`.
- `shared/`: shared Vitest config and CI timeout helpers.
- `scripts/`: repository helper scripts, including commit range checking.
- `.github/workflows/`: CI, release, and PR title validation workflows.
- `packages/`: publishable workspace packages.

## Package Responsibilities

- `aronrepo`: facade package for the Aronrepo monorepo toolchain.
- `@aronrepo/commitlint-config`: commitlint config built on Aronrepo conventional commits.
- `@aronrepo/conventional-commits`: source of commit types, release levels, changelog groups, and hidden commit behavior.
- `@aronrepo/conventional-changelog-config`: conventional changelog preset, parser options, writer options, and recommended bump logic.
- `@aronrepo/semantic-release-config`: semantic-release configuration and workspace discovery for public packages.
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

- Commit type or release rule changes start in `packages/conventional-commits/src/index.ts`, then flow into commitlint, changelog, and semantic-release config behavior.
- Commitlint behavior is owned by `packages/commitlint-config`.
- Changelog parsing, grouping, and recommended bumps are owned by `packages/conventional-changelog-config`.
- semantic-release defaults and workspace package discovery are owned by `packages/semantic-release-config`.
- pnpm package version writing, auth handling, dist-tag mapping, packing, and publishing behavior are owned by `packages/semantic-release-pnpm`.
- Shared test defaults are owned by `shared/vitest.config.ts` and `shared/vitest-ci-config.ts`.

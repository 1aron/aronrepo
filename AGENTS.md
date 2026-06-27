# Agent Guide

This is the operating guide for AI agents working in this repository. Keep it current when repository structure, commands, release behavior, or agent expectations change.

## Repository Identity

Aronrepo is an ESM-only pnpm monorepo for Aron project toolchain packages. Published packages are under `packages/*`; JavaScript output is `dist/**/*.js`, type output is `dist/**/*.d.ts`, and package exports do not include CommonJS fallbacks.

Use `docs/ai-context/README.md` for deeper project context when the task needs architecture, workflow, or package ownership details.

## Environment

- Node.js: `^26`
- Package manager: `pnpm@11.9.0`
- Module system: ESM only (`"type": "module"`)
- TypeScript: strict mode, `moduleResolution: "Bundler"`
- Workspace layout: `packages/*`

Run installs from the repository root:

```sh
pnpm install
```

## Common Commands

Run root commands unless a narrower package command is enough.

```sh
pnpm run build
pnpm run test
pnpm run lint
pnpm run type-check
pnpm run check
```

For targeted package work, prefer:

```sh
pnpm --filter <package> run <script>
```

Examples:

```sh
pnpm --filter @aronrepo/semantic-release-config run test
pnpm --filter @aronrepo/semantic-release-pnpm run type-check
pnpm --filter aronrepo run build
```

`pnpm run check` runs the commit range check and then Turbo tasks for `test`, `lint`, and `type-check`.

## Coding Rules

- Preserve ESM-only package behavior. Do not add CommonJS exports or fallbacks.
- Keep package exports aligned with built `dist` files and generated declarations.
- Use workspace dependencies with `workspace:^` for internal package relationships.
- Keep build customization package-local in `tsdown.config.ts` or an explicitly added local build config.
- Use shared Vitest defaults from `shared/vitest.config.ts`; only add package-specific overrides when behavior differs.
- Do not commit generated `dist/`, Turbo cache output, `node_modules`, logs, or other ignored build artifacts.
- Keep changes scoped to the package or shared config implied by the task. Avoid broad refactors when a focused edit is enough.
- Update or add tests with behavior changes, especially for release rules, commit parsing, config generation, and publish behavior.

## Commit and PR Titles

Commit messages and PR titles should follow Aronrepo conventional commit types, which are defined in `packages/conventional-commits/src/index.ts`, documented in `packages/conventional-commits/README.md`, and enforced through `@aronrepo/commitlint-config`.

Examples:

```text
Feat(Core): Add ESM builder
Fix(Release): Preserve workspace dependency ranges
Docs(README): Clarify build output
Benchmark(Runtime): Add parser throughput baseline
CI(GitHub): Update PR title check permissions
Build(Tooling): Update Vitest config
Style(Lint): Format TypeScript files
Chore(Agent): Update repository guidance for coding agents
Chore: Update package metadata
```

Types are PascalCase, and scopes are optional. Before using `Feat`, `Fix`, or any other release-impacting type, confirm the change affects published package behavior, public API, release behavior, or published README content. Use `Chore(Agent)` for internal AI instructions, prompts, repository context, and agent workflow policy.
Use `Benchmark` for benchmark harnesses, reports, fixtures, and baseline data that do not change published runtime behavior. Reserve `Perf` for changes that affect published runtime performance.
Use `CI` for CI workflows, `Build` for build tooling or dev-only configuration, and `Style` for formatting-only changes. Runtime dependency or published behavior changes should still use release-impacting types such as `Upgrade`, `Fix`, or `Update`.

## Agent Workflow

Before editing, inspect the relevant package `package.json`, `src`, `tests`, and local config files. For shared behavior, inspect the shared config or package that owns it instead of copying patterns by memory.

After editing:

- For docs-only changes, manually verify paths, package names, commands, and workflow descriptions.
- For package code changes, run the narrowest meaningful package test/type-check/build commands first, then broaden if shared behavior changed.
- For config or release workflow changes, run the affected package tests and consider `pnpm run check`.
- Update `docs/ai-context/` when repo architecture, command behavior, package responsibility, release behavior, or validation expectations change.

When local facts conflict with these instructions, trust the repository files and update this guide as part of the change.

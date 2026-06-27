# Workflows

## Local Development

Install from the repository root:

```sh
pnpm install
```

Use root scripts for full-repo validation:

```sh
pnpm run build
pnpm run test
pnpm run lint
pnpm run type-check
pnpm run check
```

Use package filters for focused work:

```sh
pnpm --filter <package> run <script>
```

All published packages use the same default package scripts: `build`, `dev`, `test`, `type-check`, and `lint`.

## CI

The main CI workflow runs on pushes and pull requests. It installs with `pnpm install --frozen-lockfile` using Node 26 and pnpm 11.9.0.

CI jobs are intentionally separate:

- `lint`: runs `pnpm run lint`.
- `type-check`: runs `pnpm run type-check`.
- `test`: runs `pnpm run test` on Ubuntu, Windows, and macOS.
- `build`: runs `pnpm run build`.

The PR title workflow checks pull request titles with `commitlint` after building `@aronrepo/commitlint-config` and its dependencies. PR titles use the same release-impact policy as commit messages: release-impacting types should describe published behavior, public API, release behavior, or published README changes. Benchmark-only work should use `Benchmark`; CI workflow changes use `CI`; build tooling and dev-only config use `Build`; formatting-only changes use `Style`; agent-only guidance and repository context should use `Chore(Agent)`.

## Release

Release runs through semantic-release only for pushes to:

- `main`
- `alpha`
- `beta`
- `rc`
- `canary`

The root `release.config.js` calls `configure()` from `@aronrepo/semantic-release-config`. That config discovers workspace packages from the workspace patterns and adds `@aronrepo/semantic-release-pnpm` for packages with `publishConfig.access` set to `public`.

The pnpm release plugin writes the semantic-release version into the target package before publishing, maps prerelease channels to npm dist-tags, and uses package-level `publishConfig.provenance` when present.

## Validation Guidance

- Docs-only changes: manually verify paths, package names, commands, branch names, and workflow descriptions. No automated test is required unless docs mention changed behavior.
- Package code changes: run the affected package test and type-check commands first. Add build when exports or compiled output assumptions change.
- Shared config changes: run at least one affected package command, then broaden to the corresponding root script.
- Commit rule, changelog, or release config changes: run the owning package tests and consider `pnpm run check`.
- CI or release workflow changes: verify the workflow YAML against the package scripts and release config it invokes.

Use `pnpm run check` before handing off changes that affect shared behavior across multiple packages.

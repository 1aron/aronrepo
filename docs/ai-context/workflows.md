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

`pnpm run check` runs `aronrepo check --from origin/main --to HEAD` and then the Turbo `test`, `lint`, and `type-check` tasks.

Use package filters for focused work:

```sh
pnpm --filter <package> run <script>
```

All published packages use the same default package scripts: `build`, `dev`, `test`, `type-check`, and `lint`.

## CI

The main CI workflow runs on pushes and pull requests. It installs with `pnpm install --frozen-lockfile` using Node 26 and pnpm 12.18.0.

CI jobs are intentionally separate:

- `commits` (pull requests only): runs commitlint and `aronrepo check` on every commit between the PR base and head.
- `lint`: runs `pnpm run lint`.
- `type-check`: runs `pnpm run type-check`.
- `test`: runs `pnpm run test` on Ubuntu, Windows, and macOS.
- `build`: runs `pnpm run build`.

The PR title workflow runs on `pull_request_target` from the base commit. It fetches the PR head as data only, then checks the title with commitlint and with `aronrepo check --title`, which compares the title's release level with the PR diff. A squash merge turns the title into the commit header, so the title must pass the same release path rule as a commit.

## Commit Hook

`pnpm install` runs `husky`, which installs `.husky/commit-msg`. The hook runs `commitlint --edit` and `aronrepo check --edit`, so a release type on a commit that touches no release path, or a breaking marker outside `Bump(Major)`, is rejected locally with a suggested header.

## Release

Release runs through semantic-release only for pushes to:

- `main`
- `alpha`
- `beta`
- `rc`
- `canary`

The root `release.config.js` calls `configure()` from `@aronrepo/semantic-release-config`. That config analyzes commits with `@aronrepo/semantic-release-config/analyzer`, which reads `aronrepo.config.js` (explicit mode here), resolves every commit with its changed files, logs the reason for each level, and never falls back to commit-analyzer's default rules. It also adds `@aronrepo/semantic-release-pnpm` for packages with `publishConfig.access` set to `public`. The release job prints `aronrepo explain` first.

In explicit mode a minor or major release needs a `Bump(Minor)` or `Bump(Major)` commit from the owner. Agents never write those commits on their own.

The pnpm release plugin writes the semantic-release version into the target package before publishing, maps prerelease channels to npm dist-tags, and uses package-level `publishConfig.provenance` when present. For npm Trusted Publishing on the official registry, it exchanges the GitHub OIDC identity token for a package-scoped publish token and skips `pnpm whoami` during verification because that token is meant for publish operations rather than account introspection.

## Validation Guidance

- Docs-only changes: manually verify paths, package names, commands, branch names, and workflow descriptions. No automated test is required unless docs mention changed behavior.
- Package code changes: run the affected package test and type-check commands first. Add build when exports or compiled output assumptions change.
- Shared config changes: run at least one affected package command, then broaden to the corresponding root script.
- Commit rule, changelog, or release config changes: run the owning package tests, `pnpm exec aronrepo agents` to confirm the AGENTS block is current, and `pnpm run check`.
- CI or release workflow changes: verify the workflow YAML against the package scripts and release config it invokes.

Use `pnpm run check` before handing off changes that affect shared behavior across multiple packages.

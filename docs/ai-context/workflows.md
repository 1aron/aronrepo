# Workflows

## Local Development

Install from the repository root:

```sh
bun install
```

Use root scripts for full-repo validation:

```sh
bun run build
bun run test
bun run lint
bun run type-check
bun run check
```

`bun run check` runs `aronrepo check --from origin/main --to HEAD` and then the Turbo `test`, `lint`, and `type-check` tasks. For package-level work, run scripts inside `packages/aronrepo` or with `bun run --filter aronrepo <script>`.

## CI

The main CI workflow runs on pushes and pull requests. It installs with `bun install --frozen-lockfile` using Bun 1.4.4 and Node 26.

CI jobs are intentionally separate:

- `commits` (pull requests only): runs `aronrepo check` on every commit between the PR base and head.
- `lint`, `type-check`, and `build`: run the root scripts.
- `test`: runs `bun run test` on Ubuntu, Windows, and macOS.

The PR title workflow runs on `pull_request_target` from the base commit. It fetches the PR head as data only, then checks the title with `aronrepo check --title`, which compares the title's release level with the PR diff. A squash merge turns the title into the commit header, so the title must pass the same rules as a commit.

## Commit Hook

`bun install` runs `husky`, which installs `.husky/commit-msg`. The hook runs `bun run aronrepo check --edit`, where the root `aronrepo` script runs the local build (`packages/aronrepo/dist/cli.js`), so run `bun run build` after cloning and after changing the resolver. CI uses the same script: Bun does not link a workspace binary whose file is missing at install time, and `bun x aronrepo` would then run the published version instead. A release type on a commit that touches no release path, a legacy type, or a breaking marker outside `Bump(Major)` is rejected locally with a suggested header.

## Release

The release job runs `aronrepo explain` and then `aronrepo release` for pushes to `main`, `alpha`, `beta`, `rc`, and `canary`, with `contents: write` and `id-token: write`. `aronrepo release`:

1. Plans the version from the commits since the channel's last `v*` tag with this repository's `explicit` policy and release paths.
2. Writes the version and git head into the published packages and packs them with Bun.
3. Publishes them with npm on the `aronrepo-staging` dist-tag, with provenance, in dependency order. npm auth comes from `.npmrc`, npm trusted publishing (GitHub OIDC), then `NPM_TOKEN`.
4. Waits for the registry, moves the channel's dist-tag, pushes the tag, and creates the GitHub release.

Package versions are never committed; the manifests are restored after the release. Rerunning a failed job resumes the release.

In explicit mode a minor or major release needs a `Bump(Minor)` or `Bump(Major)` commit from the owner. Agents never write those commits on their own.

## Validation Guidance

- Docs-only changes: manually verify paths, package names, commands, branch names, and workflow descriptions.
- Package code changes: run `bun run test` and `bun run type-check` in `packages/aronrepo`, then the root scripts.
- Commit type or release rule changes: run the tests, `bun run aronrepo agents` to confirm the AGENTS block is current, and `bun run check`.
- Release engine changes: run the tests and `bun run aronrepo release --dry-run`.
- CI or release workflow changes: verify the workflow YAML against the scripts and commands it invokes.

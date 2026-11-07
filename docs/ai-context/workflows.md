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

`.github/workflows/release.yml` runs CI on pull requests (opened, reopened, synchronize) and runs CI plus the release on pushes to the release branches (`main`, `alpha`, `beta`, `rc`, `canary`). Pull request runs cancel older runs of the same PR. A release branch run is never cancelled halfway through publishing; GitHub keeps at most one run waiting behind it, so a third push replaces the waiting run, whose commits the newer run releases too. It installs with `bun install --frozen-lockfile` using Bun 1.4.4 and Node 26. Every action is pinned to a commit SHA with its version tag in a comment.

CI jobs are intentionally separate:

- `commits`: runs `aronrepo check` on every commit between the PR base and head, or on the commits a push adds. It does not block the release: a pushed commit cannot be rewritten, and a commit with an invalid header releases nothing.
- `release`: builds without the turbo cache and installs with `--ignore-scripts`, so the job that holds the npm and GitHub credentials builds from source and runs no dependency scripts.
- `lint`, `type-check`, and `build`: run the root scripts.
- `test`: runs `bun run test` on Ubuntu, Windows, and macOS with Node 26, and on Ubuntu with Node 22 and 24, the other versions that the published package supports (`engines.node: >=22.18`). Each Node version keeps its own turbo cache.

The PR title workflow runs on `pull_request_target` from the base commit. It fetches the PR head as data only, then checks the title with `aronrepo check --title` against the diff up to the event's head commit. A newer edit or push cancels an older check, and a failed install or build reports an `error` status instead of a title violation. A squash merge turns the title into the commit header, so the title must pass the same rules as a commit.

## Commit Hook

`bun install` runs `husky`, which installs `.husky/commit-msg`. The hook runs `bun run aronrepo check --edit`, where the root `aronrepo` script runs the local build (`packages/aronrepo/dist/cli.js`), so run `bun run build` after cloning and after changing the resolver. CI uses the same script: Bun does not link a workspace binary whose file is missing at install time, and `bun x aronrepo` would then run the published version instead. A release type on a commit that touches no release path, a legacy type, or a breaking marker outside `Bump(Major)` is rejected locally with a suggested header.

## Release

The release job runs `aronrepo explain` and then `aronrepo release` for pushes to `main`, `alpha`, `beta`, `rc`, and `canary`, with `contents: write` and `id-token: write`. `aronrepo release`:

1. Plans the version from the commits since the channel's last `v*` tag with this repository's `explicit` policy and release paths.
2. Writes the version and git head into the published packages and packs them with Bun.
3. Publishes them with npm on the `aronrepo-staging` dist-tag, with provenance, in dependency order. npm auth comes from `.npmrc`, npm trusted publishing (GitHub OIDC), then `NPM_TOKEN`.
4. Waits for the registry, moves the channel's dist-tag, pushes the tag, and creates the GitHub release. The release body has no version heading (GitHub shows the tag and date) and ends with a **Full Changelog** compare link.

npm trusted publishing for `aronrepo` is bound to the `release.yml` file name, so renaming the workflow also needs the trusted publisher on npmjs.com updated.

Package versions are never committed; the manifests are restored after the release. Rerunning a failed job resumes the release.

In explicit mode a minor or major release needs a `Bump(Minor)` or `Bump(Major)` commit from the owner. Agents never write those commits on their own.

## Validation Guidance

- Docs-only changes: manually verify paths, package names, commands, branch names, and workflow descriptions.
- Package code changes: run `bun run test` and `bun run type-check` in `packages/aronrepo`, then the root scripts.
- Commit type or release rule changes: run the tests, `bun run aronrepo agents` to confirm the AGENTS block is current, and `bun run check`.
- Release engine changes: run the tests and `bun run aronrepo release --dry-run`.
- CI or release workflow changes: verify the workflow YAML against the scripts and commands it invokes.

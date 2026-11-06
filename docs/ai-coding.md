# AI Coding Integration

Aronrepo is designed so coding agents can adopt it and then follow it without judgment calls about versions. Three properties make that reliable:

- **The policy is data.** `aronrepo policy --json` prints the release mode, the release table, the release paths, and the agent rules for the current repository.
- **The instructions are generated.** `aronrepo agents --write` writes the policy block into `AGENTS.md`, and `aronrepo agents` (or `aronrepo doctor`) fails when the block is stale. Nobody copies release tables by hand.
- **Every rule is enforced and explained.** commitlint and `aronrepo check` reject commits that would release by mistake and print a suggested header; the semantic-release analyzer applies the same resolver and logs the reason for every commit; `aronrepo explain` previews the next release.

## Release Modes Are an Owner Decision

| Mode | Who raises minor and major versions |
| --- | --- |
| `explicit` (default) | Only the owner, with `Bump(Minor)` and `Bump(Major)` commits. `Feat` and `New` release a patch; `BREAKING CHANGE:` footers are rejected. |
| `auto` | Commit types: `Feat`/`New` release minor, `BREAKING CHANGE:` footers release major. |

An agent adopting Aronrepo must ask the repository owner which mode to use. An agent working in a repository that already uses Aronrepo must never write `Bump(Major)`, `Bump(Minor)`, or a breaking marker unless the user asked for that release level in the current conversation.

## Expected Result

A complete adoption leaves the target repository with:

- `aronrepo`, `@commitlint/cli`, `semantic-release`, and `husky` as development dependencies.
- `aronrepo.config.js` with the release mode the owner chose, plus `release.paths` only when the defaults do not match what ships.
- `commitlint.config.js` exporting `@aronrepo/commitlint-config`.
- `release.config.js` using `configure()` from `@aronrepo/semantic-release-config`, without `@semantic-release/commit-analyzer`.
- A commit-msg hook that runs `commitlint --edit "$1"` and `aronrepo check --edit "$1"`.
- The generated policy block in `AGENTS.md`.
- CI checks for pull request commits and titles when the repository has CI.
- `aronrepo doctor` passing.

## Copy-Paste Prompt

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

## Agent Rules

- Inspect before editing. The package manager, Node engine, workspace layout, CI workflows, and release setup decide the exact integration shape.
- Ask the owner for the release mode. Do not default to `auto` to make releases happen.
- Prefer the `aronrepo` facade. Install individual `@aronrepo/*` packages only for intentional partial adoption.
- Keep ESM compatibility. Aronrepo packages do not provide CommonJS fallbacks.
- Configure release behavior through `aronrepo.config.js` and the shared packages instead of copying release rules or tables.
- Before committing, run `aronrepo check --message "<header>"` when unsure; it prints the release level and a suggested header. Before pushing to a release branch, run `aronrepo explain`.
- Validate narrowly first, then run `aronrepo doctor`.

# AI Coding Integration

Aronrepo is designed so coding agents can adopt it and then follow it without judgment calls about versions. Three properties make that reliable:

- **The policy is data.** `aronrepo policy --json` prints the release mode, the release paths, every commit type with its release level and description, the legacy types, and the agent rules for the current repository.
- **The instructions are generated.** `aronrepo agents --write` writes the policy block into `AGENTS.md`, with commands for the repository's package manager, and `aronrepo agents` (or `aronrepo doctor`) fails when the block is stale. Nobody copies type tables by hand.
- **Every rule is enforced and explained.** `aronrepo check` rejects commits that would release by mistake and prints a suggested header; `aronrepo release` applies the same resolver and logs the reason for every commit; `aronrepo explain` previews the next version.

## One Fixed Commit Standard

Repositories cannot add or rename commit types. Each type has one meaning, so an agent picks the type that describes the change and the policy decides the release level. `Add` is a new capability, `Improve` a better existing capability, `Fix` a bug fix, `Upgrade` a runtime dependency change, and `Chore` maintenance; `aronrepo policy --json` has the full list with descriptions.

## Release Modes Are an Owner Decision

| Mode | Who raises minor and major versions |
| --- | --- |
| `explicit` (default) | Only the owner, with `Bump(Minor)` and `Bump(Major)` commits. Every other type releases at most a patch; `BREAKING CHANGE:` footers are rejected. |
| `auto` | Commit types: `Add` releases minor, `BREAKING CHANGE:` footers release major. |

An agent adopting Aronrepo must ask the repository owner which mode to use. An agent working in a repository that already uses Aronrepo must never write `Bump(Major)`, `Bump(Minor)`, or a breaking marker unless the user asked for that release level in the current conversation.

## Expected Result

A complete adoption leaves the target repository with:

- `aronrepo` and `husky` as development dependencies, and no semantic-release, commitlint, or `@aronrepo/*` packages or configs.
- `aronrepo.config.js` with the release mode the owner chose, plus `release.paths` only when the defaults do not match what ships.
- A commit-msg hook that runs `aronrepo check --edit "$1"`.
- The generated policy block in `AGENTS.md`.
- CI checks for pull request commits and titles, and a release job that runs `aronrepo release`, when the repository has CI.
- `aronrepo doctor` passing and `aronrepo release --dry-run` printing the expected next version.

The copy-paste prompt for this is in the root [README](../README.md#ai-coding-integration).

## Agent Rules

- Inspect before editing. The package manager, Node engine, workspace layout, CI workflows, and release setup decide the exact integration shape.
- Ask the owner for the release mode. Do not default to `auto` to make releases happen.
- Keep ESM compatibility. `aronrepo` does not provide CommonJS fallbacks.
- Configure release behavior through `aronrepo.config.js` (or `.mjs`, `.cjs`, `.ts`); there is nothing else to configure.
- Before committing, stage the change and run `aronrepo check --message "<header>"` when unsure (or pass `--files` instead of staging); a release type needs a staged file on a release path. It prints the release level, and a suggested header when the header fails. Before pushing to a release branch, run `aronrepo explain`.
- Validate narrowly first, then run `aronrepo doctor`.

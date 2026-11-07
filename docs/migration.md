# Migrating to Aronrepo 4

Upgrade one major version at a time; each section lists what changes in the repository.

## From Aronrepo 3

- Write `Feat` instead of `Add`. `Add` is now a legacy type: old `Add` commits still release as before, but `aronrepo check` rejects new ones and suggests `Feat`.
- Release notes call that section Features instead of Additions.
- Lowercase types, scopes, and summaries now pass `aronrepo check`; nothing else changes.
- Run `aronrepo agents --write` to regenerate the `AGENTS.md` block.

## From Aronrepo 2

- Remove `semantic-release`, `@semantic-release/*`, `@commitlint/cli`, every `@aronrepo/*` package, `release.config.js`, and `commitlint.config.js`. Install `aronrepo` only.
- Replace `commitlint --edit "$1"` in the commit-msg hook with `aronrepo check --edit "$1"`, and `semantic-release` in CI with `aronrepo release`.
- Import the commit standard from `aronrepo` instead of `@aronrepo/conventional-commits`, and the Node helpers and commands from `aronrepo/node`.
- Write `Feat` instead of `New`, `Improve` instead of `Update`, and `Chore` instead of `Misc`.
- Run `aronrepo agents --write`, `aronrepo doctor`, and `aronrepo release --dry-run`.

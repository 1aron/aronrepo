![Aronrepo cover](https://raw.githubusercontent.com/1aron/aronrepo/main/docs/assets/aronrepo-cover.png)

# aronrepo

Facade package and CLI for the Aronrepo toolchain: release policies that owners control and coding agents can follow.

Installing `aronrepo` brings the published Aronrepo packages for conventional commits, commitlint configuration, changelog generation, semantic-release configuration, and pnpm workspace publishing, plus the `aronrepo` command.

## Install

```sh
pnpm add -D aronrepo @commitlint/cli semantic-release husky
```

This package is ESM-only.

## Configure

```js
// aronrepo.config.js
/** @type {import('aronrepo').AronrepoConfig} */
export default {
    release: {
        mode: 'explicit' // or 'auto'
    }
}
```

- `explicit` (default): only `Bump(Minor)` and `Bump(Major)` commits raise minor and major versions. `Feat` and `New` release a patch, and `BREAKING CHANGE:` footers are rejected.
- `auto`: `Feat` and `New` release minor versions and `BREAKING CHANGE:` footers release major versions.

Release paths default to the directories of public workspace packages. A release type on a commit that changes no release path is rejected by `aronrepo check` and releases nothing.

## CLI

```sh
aronrepo check --edit .git/COMMIT_EDITMSG     # commit-msg hook: message + staged files
aronrepo check --from origin/main --to HEAD    # every commit in a range
aronrepo check --title "Fix(Core): Repair cache" --base main --head HEAD   # PR title + PR diff
aronrepo check --message "Fix(Site): Repair the header"                    # a header + staged files
aronrepo explain                               # next release and the reason for each commit
aronrepo policy --json                         # the effective policy as data
aronrepo agents --write                        # write the policy block into AGENTS.md
aronrepo doctor                                # check the setup and print fixes
```

Every command accepts `--cwd <dir>`, `--mode <explicit|auto>`, and `--json`. `check`, `agents`, and `doctor` exit with code 1 when something needs fixing.

Example:

```text
$ aronrepo check --message "Perf(Site): Speed up the homepage"
Commit message: Perf(Site): Speed up the homepage
  ✗ `Perf(Site)` releases patch, but the commit changes no release paths. Use a non-release type: Chore, Refactor, Style, Test, Docs, Build, CI, Benchmark, Example.
    Suggested header: Chore(Site): Speed up the homepage
```

## Programmatic Usage

```ts
import { check, defineConfig, explain, packages } from 'aronrepo'
```

`packages` lists the toolchain package names. `check`, `explain`, `policy`, `agents`, and `doctor` return `{ code, output }`.

## Toolchain Packages

- `@aronrepo/conventional-commits`: commit types, release modes, the release resolver, release paths, and AI agent policy.
- `@aronrepo/commitlint-config`: commitlint rules for Aronrepo commit and PR title validation.
- `@aronrepo/conventional-changelog-config`: parser, writer, and recommended bump options for conventional changelog tooling.
- `@aronrepo/semantic-release-config`: semantic-release defaults, the Aronrepo commit analyzer, and workspace package discovery.
- `@aronrepo/semantic-release-pnpm`: semantic-release plugin for publishing pnpm workspace packages.

## AI Coding Adoption

See [AI Coding Integration](https://github.com/1aron/aronrepo/blob/main/docs/ai-coding.md) for the adoption prompt. It tells the agent to ask the owner for the release mode, configure every tool from `aronrepo.config.js`, generate the AGENTS block, and run `aronrepo doctor` until it passes.

![Aronrepo cover](https://raw.githubusercontent.com/1aron/aronrepo/main/docs/assets/aronrepo-cover.png)

# aronrepo

One commit standard and one release engine for JavaScript repositories, built so the repository owner and coding agents follow the same rules. It replaces semantic-release, commitlint, and changelog presets.

## Install

```sh
bun add -d aronrepo husky
```

`pnpm add -D aronrepo husky` and `npm install -D aronrepo husky` work too. This package is ESM-only, needs Node.js 22.18 or later, and has no peer tools.

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

A CommonJS package uses `aronrepo.config.mjs`; `aronrepo.config.cjs` and `aronrepo.config.ts` (Node 22.18+) work too.

```sh
# .husky/commit-msg
aronrepo check --edit "$1"
```

```sh
bun x aronrepo agents --write
bun x aronrepo doctor
```

In `explicit` mode (the default) only `Bump(Minor)` and `Bump(Major)` raise minor and major versions. In `auto` mode `Feat` releases a minor version and a `BREAKING CHANGE:` footer releases a major version. A release type that changes no published file releases nothing.

## Commit Types

`Type(Scope): Summary`, with a summary that has no trailing period. Types and scopes match without case (`fix(core)` is `Fix(Core)`), and release notes capitalize each summary.

| Release | Types |
| --- | --- |
| Owner decides | `Bump(Major)`, `Bump(Minor)`, `Bump(Patch)` |
| Patch (`Feat`: minor in `auto`) | `Feat`, `Improve`, `Perf`, `Fix`, `Deprecate`, `Drop`, `Upgrade`, `Revert`, `Docs(README)` |
| None | `Docs`, `Test`, `Benchmark`, `Example`, `Build`, `CI`, `Style`, `Refactor`, `Chore` |

`aronrepo policy --json` describes when to use each type. `Add`, `New`, `Update`, and `Misc` are legacy types that `aronrepo check` rejects.

## Commands

| Command | Use |
| --- | --- |
| `aronrepo check` | check a commit message, a commit range, or a PR title |
| `aronrepo explain [--json]` | print the next version and the reason for each commit; `--json` adds the commit and the release notes |
| `aronrepo release [--dry-run] [--expect <version>]` | publish the packages, push the version tag, and create the GitHub release; `--expect` stops unless it is the approved version |
| `aronrepo policy [--json]` | print the policy |
| `aronrepo agents [--write]` | check or regenerate the policy block in `AGENTS.md` |
| `aronrepo doctor` | check the setup |

`aronrepo release` publishes `main` on `latest` and `alpha`, `beta`, `rc`, and `canary` as prereleases on their own dist-tags. It publishes every package on a staging dist-tag first, moves the channel's dist-tag once all of them are on the registry, and resumes an interrupted run. It releases only a commit that is on the release branch, so CI can release on every push or release an approved commit when a maintainer decides.

## API

```js
import { parseCommit, resolveRelease, renderReleaseNotes } from 'aronrepo'
import { planRelease, explainRange } from 'aronrepo/node'
```

`aronrepo` exports the commit standard without Node dependencies; `aronrepo/node` exports the config loader, git and workspace helpers, the release engine, and the CLI commands.

See the [Aronrepo repository](https://github.com/1aron/aronrepo#readme) for release branches, CI setup, approved releases, AI coding integration, and migrating from Aronrepo 2.

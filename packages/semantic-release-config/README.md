![Aronrepo cover](https://raw.githubusercontent.com/1aron/aronrepo/main/docs/assets/aronrepo-cover.png)

# @aronrepo/semantic-release-config

Semantic-release configuration for Aronrepo conventional commits and pnpm workspace packages.

This package wires the Aronrepo release policy, release notes, GitHub releases, and public workspace package publishing into one ESM-compatible config entrypoint.

## Install

```sh
pnpm add -D @aronrepo/semantic-release-config @aronrepo/semantic-release-pnpm semantic-release
```

This package is ESM-only.

## Usage

```js
// release.config.js
import { configure } from '@aronrepo/semantic-release-config'

export default configure()
```

Use `.mjs` instead when the consuming repository does not declare `"type": "module"`.

Subpath exports are available for direct imports:

```ts
import configure from '@aronrepo/semantic-release-config/configure'
import { analyzeCommits } from '@aronrepo/semantic-release-config/analyzer'
```

## Commit Analysis

`@aronrepo/semantic-release-config/analyzer` replaces `@semantic-release/commit-analyzer`. It reads `release.mode` and `release.paths` from `aronrepo.config.js`, resolves each commit with `resolveCommitRelease()` from `@aronrepo/conventional-commits` using the files that commit changed, logs the level and reason for every commit, and returns the highest level.

Unlike commit-analyzer with custom rules, it never falls back to default Angular, ESLint, or `breaking → major` rules. In `explicit` mode (the default) only `Bump(Minor)` and `Bump(Major)` commits raise minor and major versions, even when a commit body carries a `BREAKING CHANGE:` footer.

Override the mode for one release config with plugin options:

```js
import { configure } from '@aronrepo/semantic-release-config'

export default configure({
    plugins: {
        '@aronrepo/semantic-release-config/analyzer': { mode: 'auto' }
    }
})
```

`configure()` throws when the config adds `@semantic-release/commit-analyzer`, because semantic-release would release the higher level of both analyzers and bypass the policy.

`rules` and `createReleaseRules(policy)` still export commit-analyzer release rules, but they are deprecated: commit-analyzer applies its default rules to commits these rules do not match.

## Defaults

The default config includes:

- `@aronrepo/semantic-release-config/analyzer` for commit analysis.
- `@semantic-release/release-notes-generator` with Aronrepo parser and writer options.
- `@semantic-release/github` for GitHub release publishing.
- Branches for maintenance releases, `main`, `next`, `next-major`, `alpha`, `beta`, `rc`, and `canary`.

## Workspace Publishing

`configure()` reads workspace patterns from `pnpm-workspace.yaml` first, then npm `workspaces` if no pnpm workspace file exists.

For each workspace package with public npm access, it adds `@aronrepo/semantic-release-pnpm`:

```json
{
    "publishConfig": {
        "access": "public"
    }
}
```

The generated plugin entry uses the workspace path as `pkgRoot`, so each public package is versioned and published independently by the pnpm release plugin.

## Custom Config

Pass semantic-release options to `configure()` when a repository needs local overrides:

```js
import { configure } from '@aronrepo/semantic-release-config'

export default configure({
    branches: [
        'main',
        { name: 'beta', prerelease: true }
    ]
})
```

Local config is merged with Aronrepo defaults. Configure release levels in `aronrepo.config.js` instead of release rules so commitlint, `aronrepo check`, changelog, and release behavior stay aligned.

## AI Coding Agents

When adopting Aronrepo in another repository, an AI coding agent should prefer this package over hand-copying semantic-release rules. The agent should inspect the target workspace layout, add `publishConfig.access: public` only for packages that should publish, and keep private packages out of npm publishing.

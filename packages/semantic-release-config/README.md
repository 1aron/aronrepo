![Aronrepo cover](https://raw.githubusercontent.com/1aron/aronrepo/main/docs/assets/aronrepo-cover.png)

# @aronrepo/semantic-release-config

Semantic-release configuration for Aronrepo conventional commits and pnpm workspace packages.

This package wires Aronrepo commit analysis, release notes, GitHub releases, and public workspace package publishing into one ESM-compatible config entrypoint.

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

The package also exports the configured release rules:

```ts
import { rules } from '@aronrepo/semantic-release-config'
```

Subpath exports are available for direct imports:

```ts
import configure from '@aronrepo/semantic-release-config/configure'
import rules from '@aronrepo/semantic-release-config/rules'
```

## Defaults

The default config includes:

- `@semantic-release/commit-analyzer` with Aronrepo parser options and release rules.
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

Local config is merged with Aronrepo defaults. Keep custom release rules limited to repository-specific needs so commitlint, changelog, and release behavior stay aligned.

## AI Coding Agents

When adopting Aronrepo in another repository, an AI coding agent should prefer this package over hand-copying semantic-release rules. The agent should inspect the target workspace layout, add `publishConfig.access: public` only for packages that should publish, and keep private packages out of npm publishing.

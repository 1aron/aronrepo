![Aronrepo cover](https://raw.githubusercontent.com/1aron/aronrepo/main/docs/assets/aronrepo-cover.png)

# @aronrepo/semantic-release-pnpm

Semantic-release plugin for publishing pnpm workspace packages.

This package prepares package versions, validates npm authentication, publishes packages with pnpm, and manages npm dist-tags for semantic-release channels.

## Install

```sh
pnpm add -D @aronrepo/semantic-release-pnpm semantic-release
```

This package is ESM-only.

Most projects should consume it through `@aronrepo/semantic-release-config`, which auto-adds this plugin for public workspace packages.

## Usage

Manual semantic-release plugin configuration:

```js
export default {
    plugins: [
        ['@aronrepo/semantic-release-pnpm', {
            pkgRoot: 'packages/my-package'
        }]
    ]
}
```

With Aronrepo defaults:

```js
import { configure } from '@aronrepo/semantic-release-config'

export default configure()
```

## Options

| Option | Type | Purpose |
| --- | --- | --- |
| `pkgRoot` | `string` | Package directory to read, version, pack, and publish. Defaults to the release cwd. |
| `npmPublish` | `boolean` | Set to `false` to skip npm publishing while still allowing prepare behavior. |
| `tarballDir` | `string` or `false` | When set, creates a `pnpm pack` tarball in the target directory during prepare. |
| `publishBranch` | `string` | Passed to `pnpm publish --publish-branch`. |
| `disableScripts` | `boolean` | Publishes with `--ignore-scripts`. |

## Lifecycle Behavior

- `verifyConditions` reads the target package and validates npm auth when the package will publish. For npm Trusted Publishing, it verifies the OIDC exchange and skips `pnpm whoami` because the exchanged publish token is package-scoped.
- `prepare` writes `nextRelease.version` to the target `package.json`, updates `npm-shrinkwrap.json` when present, and optionally creates a tarball.
- `publish` ensures prepare ran, skips private packages and `npmPublish: false`, then runs `pnpm publish` with the resolved registry and dist-tag.
- `addChannel` adds the released version to the npm dist-tag for the semantic-release channel.

The plugin keeps package version writes scoped to the configured package root. pnpm handles `workspace:` dependency rewrites when packing and publishing.

## Registry And Auth

Registry resolution order:

1. Scoped `publishConfig` registry, such as `@scope:registry`.
2. `publishConfig.registry`.
3. `NPM_CONFIG_REGISTRY`.
4. Scoped or default registry from `.npmrc`.
5. `https://registry.npmjs.org/`.

Authentication can come from:

- Existing auth in `.npmrc` or `NPM_CONFIG_USERCONFIG`.
- OIDC token exchange for the official npm registry through `NPM_ID_TOKEN` or GitHub Actions identity tokens. When this succeeds, the plugin uses the exchanged publish token directly instead of validating it with `pnpm whoami`.
- `NPM_TOKEN`, written into a temporary npmrc as `${NPM_TOKEN}` so the token value is not copied into the file.

## Dist-Tags And Provenance

Semantic-release channels map to npm dist-tags:

- No channel: `latest`.
- Prerelease channel such as `beta`: `beta`.
- Maintenance range such as `1.x`: `release-1.x`.

When the package has `publishConfig.provenance: true`, the plugin passes `--provenance` to `pnpm publish`.

## Public API

The package exports semantic-release lifecycle hooks and utility helpers used by tests and advanced integrations:

```ts
import {
    addChannel,
    buildPublishArgs,
    getChannel,
    prepare,
    publish,
    readPackage,
    resolveRegistry,
    verifyConditions,
    writeReleaseVersion
} from '@aronrepo/semantic-release-pnpm'
```

![Aronrepo cover](docs/assets/aronrepo-cover.png)

# Aronrepo

Aronrepo is an ESM-only pnpm monorepo for Aron project toolchain packages. It keeps commit rules, changelog generation, semantic-release configuration, and pnpm workspace publishing aligned through one shared set of packageable conventions.

The project is designed for repositories that want predictable releases without scattering release policy across several unrelated config files. Each package has one focused responsibility, and the default path is strict TypeScript, ESM output, package-local `dist/` files, and npm provenance support.

## Why Aronrepo

- One commit taxonomy drives commitlint, changelog grouping, semantic-release rules, and AI coding agent guidance.
- Release impact is explicit: `Feat` and `New` are minor releases, fixes and published README updates are patch releases, and internal agent guidance stays non-release with `Chore(Agent)`.
- pnpm workspace packages are discovered and published through semantic-release without replacing package-level ownership.
- ESM is the only runtime target. Published packages export `dist/**/*.js` and `dist/**/*.d.ts` without CommonJS fallbacks.
- AI coding agents get clear instructions for commit selection, README changes, release behavior, and conservative adoption in external repositories.

## Packages

| Package | Role |
| --- | --- |
| `aronrepo` | Facade package that lists the Aronrepo toolchain packages. |
| `@aronrepo/conventional-commits` | Source commit taxonomy, release levels, changelog groups, hidden commit behavior, and AI agent commit policy. |
| `@aronrepo/commitlint-config` | Commitlint config for Aronrepo commit and PR title validation. |
| `@aronrepo/conventional-changelog-config` | Conventional changelog preset with parser options, writer options, and recommended bump logic. |
| `@aronrepo/semantic-release-config` | Semantic-release defaults for Aronrepo branches, release rules, notes, GitHub releases, and workspace package discovery. |
| `@aronrepo/semantic-release-pnpm` | Semantic-release plugin that writes package versions and publishes pnpm workspace packages. |

## Install

For a repository that wants the whole Aronrepo toolchain, install the facade package plus the external peer tools:

```sh
pnpm add -D aronrepo @commitlint/cli semantic-release
```

`aronrepo` brings the published `@aronrepo/*` toolchain packages. `@commitlint/cli` and `semantic-release` stay explicit because they are peer tools used by the target repository's commitlint and release commands.

For partial adoption, install only the packages that match the role you need:

```sh
pnpm add -D @aronrepo/conventional-commits @aronrepo/commitlint-config @commitlint/cli
pnpm add -D @aronrepo/conventional-changelog-config
pnpm add -D @aronrepo/semantic-release-config @aronrepo/semantic-release-pnpm semantic-release
```

All packages are ESM-only. In repositories with `"type": "module"`, `.js` config files can import them directly; otherwise use `.mjs` or another ESM-compatible config format.

## Basic Setup

Commitlint:

```js
// commitlint.config.js
export { default } from '@aronrepo/commitlint-config'
```

Semantic release:

```js
// release.config.js
import { configure } from '@aronrepo/semantic-release-config'

export default configure()
```

The release config uses Aronrepo conventional commits for analysis and release notes. It also scans workspace packages and adds `@aronrepo/semantic-release-pnpm` for packages with:

```json
{
    "publishConfig": {
        "access": "public"
    }
}
```

## Commit Format

Commit headers use PascalCase types and sentence-case summaries:

```text
Type(Scope): Summary
```

Examples:

```text
Feat(Core): Add ESM builder
Fix(Release): Preserve workspace dependency ranges
Docs(README): Clarify package installation
Chore(Agent): Update repository guidance for coding agents
```

`Docs(README)` is a patch release because package README content is published to npm. Plain `Docs` is not a release. Agent-only instructions, prompts, and repository context should usually use `Chore(Agent)`.

## AI Coding Integration

Aronrepo is built to be easy for AI coding agents to adopt in existing JavaScript and TypeScript repositories. The durable guide is in [docs/ai-coding.md](docs/ai-coding.md), including the expected deliverables and validation workflow.

Copy and paste this prompt into an AI coding agent when you want it to integrate the Aronrepo toolchain into another repository:

```text
You are working in an existing JavaScript or TypeScript repository. Integrate the Aronrepo toolchain end to end.

First inspect the repo before editing: package manager, Node version, module type, workspace layout, release setup, commitlint setup, CI workflows, README, and any agent guidance files.

Then adopt Aronrepo conservatively:
1. Use ESM-compatible configuration only.
2. Install the Aronrepo facade and peer tools with `pnpm add -D aronrepo @commitlint/cli semantic-release`.
3. Configure commitlint to extend or export @aronrepo/commitlint-config.
4. Configure semantic-release to use @aronrepo/semantic-release-config and @aronrepo/semantic-release-pnpm for public pnpm workspace packages.
5. Add or update README guidance that explains the commit format, release-impacting types, validation commands, and publishing behavior.
6. Add or update AI agent guidance so coding agents use Aronrepo commit types, choose the lowest accurate release impact, and use Chore(Agent) for internal agent instructions.
7. Preserve the target repo’s existing architecture and avoid unrelated refactors.
8. Run the narrowest meaningful validation commands, then broaden only if shared release or workspace behavior changed.

When finished, summarize the changed files, confirm that `aronrepo` and the required peer tools were introduced, note any behavior intentionally left unchanged, and report the validation results.
```

## Local Development

Aronrepo itself requires Node.js `^26` and `pnpm@11.9.0`.

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run lint
pnpm run type-check
pnpm run check
```

For focused package work:

```sh
pnpm --filter @aronrepo/semantic-release-config run test
pnpm --filter @aronrepo/semantic-release-pnpm run type-check
pnpm --filter aronrepo run build
```

`pnpm run check` runs the commit range check and then Turbo tasks for `test`, `lint`, and `type-check`.

## Release Model

The root `release.config.js` exports `configure()` from `@aronrepo/semantic-release-config`. Releases run on `main`, maintenance branches, `next`, `next-major`, and prerelease branches such as `alpha`, `beta`, `rc`, and `canary`.

Public workspace packages are published by `@aronrepo/semantic-release-pnpm`. The plugin writes the semantic-release version into the target package, maps release channels to npm dist-tags, honors package-level registry settings, supports npm token and OIDC auth, and passes provenance when `publishConfig.provenance` is enabled.

## Repository Context

Use [docs/ai-context/README.md](docs/ai-context/README.md) for deeper architecture, package ownership, validation, CI, and release workflow context.

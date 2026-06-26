![Aronrepo cover](https://raw.githubusercontent.com/1aron/aronrepo/main/docs/assets/aronrepo-cover.png)

# aronrepo

Facade install target for the Aronrepo monorepo toolchain.

Use this package when you want one dependency that brings the published Aronrepo toolchain packages for conventional commits, commitlint configuration, changelog generation, semantic-release configuration, and pnpm workspace publishing. The package also provides a small programmatic entrypoint that names those packages.

The package has no runtime side effects and does not configure commitlint, changelog generation, or semantic-release by itself.

## Install

For complete adoption, install the facade package plus the external peer tools used by your repository commands:

```sh
pnpm add -D aronrepo @commitlint/cli semantic-release
```

For programmatic package-list usage only:

```sh
pnpm add -D aronrepo
```

This package is ESM-only.

## Usage

```ts
import { packages } from 'aronrepo'

console.log(packages)
```

`packages` is a readonly list of the Aronrepo toolchain package names:

```ts
[
    '@aronrepo/commitlint-config',
    '@aronrepo/conventional-commits',
    '@aronrepo/conventional-changelog-config',
    '@aronrepo/semantic-release-config',
    '@aronrepo/semantic-release-pnpm'
]
```

## Toolchain Packages

- `@aronrepo/conventional-commits`: commit types, release impact rules, changelog groups, and AI agent policy.
- `@aronrepo/commitlint-config`: commitlint rules for Aronrepo commit and PR title validation.
- `@aronrepo/conventional-changelog-config`: parser, writer, and recommended bump options for conventional changelog tooling.
- `@aronrepo/semantic-release-config`: semantic-release defaults and workspace package discovery.
- `@aronrepo/semantic-release-pnpm`: semantic-release plugin for publishing pnpm workspace packages.

## AI Coding Adoption

For a complete adoption prompt that an AI coding agent can use in another repository, see the root guide:

- [AI Coding Integration](https://github.com/1aron/aronrepo/blob/main/docs/ai-coding.md)

The prompt tells the agent to inspect the target repository first, install the `aronrepo` facade and required peer tools, configure commitlint and semantic-release, document release behavior, and add agent guidance without unrelated refactors.

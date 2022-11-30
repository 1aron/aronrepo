<br>
<div align="center">

<p align="center">
    <a href="https://repo.master.co">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/33840671/204220749-4536401e-20c4-49b7-bf37-b07fce15f1c2.svg">
            <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/33840671/204220755-744f6b4f-a90e-442f-bd30-53ce7995a8f8.svg">
            <img alt="aronrepo" src="https://user-images.githubusercontent.com/33840671/204220755-744f6b4f-a90e-442f-bd30-53ce7995a8f8.svg" width="100%">
        </picture>
    </a>
</p>
<p align="center">A monorepo ecosystem integrating first-class packages and conventional workflows</p>

<p align="center">
    <a aria-label="overview" href="https://github.com/1aron/aronrepo">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/%E2%AC%85%20back-%20?color=212022&style=for-the-badge">
            <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/badge/%E2%AC%85%20back-%20?color=f6f7f8&style=for-the-badge">
            <img alt="NPM Version" src="https://img.shields.io/badge/%E2%AC%85%20back-%20?color=f6f7f8&style=for-the-badge">
        </picture>
    </a>
    <a aria-label="GitHub release (latest by date including pre-releases)" href="https://github.com/1aron/aronrepo/releases">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/v/release/1aron/aronrepo?include_prereleases&color=212022&label=&style=for-the-badge&logo=github&logoColor=fff">
            <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/github/v/release/1aron/aronrepo?include_prereleases&color=f6f7f8&label=&style=for-the-badge&logo=github&logoColor=%23000">
            <img alt="NPM Version" src="https://img.shields.io/github/v/release/1aron/aronrepo?include_prereleases&color=f6f7f8&label=&style=for-the-badge&logo=github">
        </picture>
    </a>
    <a aria-label="NPM Package" href="https://www.npmjs.com/package/aronrepo">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/npm/dm/aronrepo?color=212022&label=%20&logo=npm&style=for-the-badge">
            <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/npm/dm/aronrepo?color=f6f7f8&label=%20&logo=npm&style=for-the-badge">
            <img alt="NPM package ( download / month )" src="https://img.shields.io/npm/dm/aronrepo?color=f6f7f8&label=%20&logo=npm&style=for-the-badge">
        </picture>
    </a>
    <a aria-label="Follow @aron1tw" href="https://twitter.com/aron1tw">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/static/v1?label=%20&message=twitter&color=212022&logo=twitter&style=for-the-badge">
            <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/static/v1?label=%20&message=twitter&color=f6f7f8&logo=twitter&style=for-the-badge">
            <img alt="Follow @mastercorg" src="https://img.shields.io/static/v1?label=%20&message=twitter&color=f6f7f8&logo=twitter&style=for-the-badge">
        </picture>
    </a>
    <a aria-label="Github Actions" href="https://github.com/1aron/aronrepo/actions/workflows/release.yml">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/workflow/status/1aron/aronrepo/Release?label=%20&message=twitter&color=212022&logo=githubactions&style=for-the-badge">
            <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/github/workflow/status/1aron/aronrepo/Release?label=%20&message=twitter&color=f6f7f8&logo=githubactions&style=for-the-badge&logoColor=%23000">
            <img alt="Github release actions" src="https://img.shields.io/github/workflow/status/1aron/aronrepo/Release?label=%20&message=twitter&color=f6f7f8&logo=githubactions&style=for-the-badge&logoColor=%23000">
        </picture>
    </a>
</p>

</div>

## Features

**Monorepo**
- Using a high-performance build system —— [Turborepo](https://turbo.build/repo)
- Run the `build`, `dev`, `test`, `lint` commands across all workspaces
- Remember what you've built and skip the stuff that's already been computed
- Multiple workspaces work simultaneously, just like one workspace used to.

![turbo-your-monorepo-excalidraw](https://user-images.githubusercontent.com/33840671/204612389-1dc6ac11-ee16-46a4-9d24-fcfa7aa1085c.jpeg)

**Packing**
- An extremely fast bundler built on top of [esbuild](https://esbuild.github.io/)
- Output or watch multiple formats in one-linear command
- Support **ESM**, **CJS**, and **IIFE** JavaScript modules
- Support **CSS** bundle
- Generate `.d.ts` type declarations
- Extract options from `package.json`
- Prevent bundling `dependencies` and `peerDependencies` by `package.json`

**Versing**
- Synchronize versions of packages in all workspaces
- Bump packages to a specific version by the `.workspaces` of `package.json`
- Bump versions by analyzing `dependencies` and `peerDependencies` of the workspace
- Prevent bumping versions for `private: true` packages

## Getting Started

Add `packages/*` to `.workspaces` of the root `./package.json`
```json
{
    "workspaces": [
        "packages/*"
    ]
}
```
Install CLI and core packages by `aronrepo`:
```bash
npm i aronrepo -D
```
- Requires `npm@>=7` when using `npm`
- Set [`auto-install-peers`](https://pnpm.io/next/npmrc#auto-install-peers) when using `pnpm`
- You can also manually install [`peerDependencies`](https://github.com/1aron/aronrepo/blob/beta/packages/aronrepo/package.json#L32-L41) for fixed versions

To create your first package, you may automate the required steps to define a new workspace using `npm init`.

```bash
npm init -w ./packages/a
```

When the package is ready, including the dependencies setup, run `npm i` in the project root directory to install all dependencies, including the workspaces.

## Pack

Bundling your TypeScript and CSS packages with zero configuration.

```bash
aron pack [entryPaths...]
```

[Check out the available options here for now](https://github.com/1aron/aronrepo/blob/beta/packages/aronrepo/src/commands/pack.ts#L17-L25)

`aron pack` analyzes the `package.json` entry point relative to input sources in the `src` directory for builds.

### Javascript packages

```diff
.
├── package.json
└── packages
    └─── a
         ├─── src
         │    ├─── index.ts
         │    └─── index.browser.ts
+        ├─── dist
+        │    ├─── index.cjs
+        │    ├─── index.mjs
+        │    ├─── index.d.ts
+        │    └─── index.browser.ts
         └─── package.json
```

Simultaneously output `cjs`, `esm`, `iife`, `type declarations` respectively according to `main`, `module`, `browser`, `types` of `package.json`

```json
{
    "name": "a",
    "scripts": {
        "build": "aron pack",
        "dev": "npm run build -- --watch"
    },
    "main": "dist/index.cjs",
    "browser": "dist/index.browser.js",
    "module": "dist/index.mjs",
    "types": "dist/index.d.ts",
    "jsnext:main": "dist/index.mjs",
    "esnext": "dist/index.mjs",
    "exports": {
        ".": {
            "require": "./dist/index.cjs",
            "import": "./dist/index.mjs",
            "types": "./dist/index.d.ts"
        }
    },
    "files": [
        "dist"
    ]
}
```
If you only want to pack specific javascript modules, remove the corresponding entry point from `package.json`.

Run with the above configuration:

```bash
npm run build
```

<img width="628" alt="cjs-esm-iife-type-pack" src="https://user-images.githubusercontent.com/33840671/204300928-23e2d2f9-b0ed-4feb-b7cf-1b9ba6cf8127.png">

Now import the above package `a` in your project or publish it.

```ts
import 'a'
```

### CSS packages

```diff
.
├── package.json
└── packages
    └─── b
         ├─── src
         │    └─── index.css
+        ├─── dist
+        │    └─── index.css
         └─── package.json
```

Packaging CSS is more straightforward, configuring `style` and `main` entry points in `package.json`.

```json
{
    "name": "b",
    "scripts": {
        "build": "aron pack",
        "dev": "npm run build -- --watch"
    },
    "main": "./dist/index.css",
    "style": "./dist/index.css",
    "files": [
        "dist"
    ]
}
```

Run with the above configuration:

```bash
npm run build
```

<img width="523" alt="css-pack" src="https://user-images.githubusercontent.com/33840671/204450194-7831c448-2e21-4ce8-8c45-5139febc10e6.png">

Now import the above package `b` in your project or publish it.

```css
@import 'b'
```

### Multiple entry points

`aron pack <entryPaths...>` supports glob patterns that let you specify multiple entry points at once, including the output of nested directories.

Specifying an entry point will cause the Javascript output `format` to be preset to `cjs,esm`.

```
aron src/**/*.ts
```
```diff
.
├── package.json
└── packages
    └─── a
         ├─── src
         │    ├─── index.ts
         │    └─── utils
         │         └─── exec.ts
+        ├─── dist
+        │    ├─── index.cjs
+        │    ├─── index.mjs
+        │    ├─── index.d.ts
+        │    └─── utils
+        │         ├─── exec.cjs
+        │         ├─── exec.mjs
+        │         └─── exec.d.ts
         └─── package.json
```
The same goes for multiple CSS entries:
```
aron src/**/*.css
```
```diff
.
├── package.json
└── packages
    └─── a
         ├─── src
         │    ├─── index.css
         │    └─── components
         │         ├─── card.css
         │         └─── button.css
+        ├─── dist
+        │    ├─── index.css
+        │    └─── components
+        │         ├─── card.css
+        │         └─── button.css
         └─── package.json
```
Usually, it would be best to bundle CSS packages through a main `index.css` and output other CSS files so developers can import on demand instead of the whole package. For example [@master/keyframes.css](https://www.npmjs.com/package/@master/keyframes.css)

### Exclude external dependencies
`aron pack` automatically excludes external dependencies to be bundled by the `.dependencies` and `peerDependencies` of `package.json`

`src/index.ts`
```ts
import '@master/css'
import '@master/css.webpack'
import '@master/style-element.react'
```

`package.json`
```json
{
    "name": "externals",
    "main": "dist/index.cjs",
    "exports": {
        ".": {
            "require": "./dist/index.cjs"
        }
    },
    "files": [
        "dist"
    ],
    "dependencies": {
        "@master/css": "^2.0.0-beta.55"
    },
    "peerDependencies": {
        "@master/style-element.react": "^1.1.6"
    },
    "devDependencies": {
        "@master/css.webpack": "^2.0.0-beta.55"
    }
}

```

Run with the above setup:

```bash
aron pack --platform node
```

<img width="568" alt="exclude-externals-pack" src="https://user-images.githubusercontent.com/33840671/204489494-10854837-be15-49fd-a1c8-0e02fb3e174a.png">

`@master/css.webpack` is bundled into `dist/index.cjs`, except for `@master/css` and `@master/style-element.react`.

So if there is an external package that needs to be bundled, you just install it to `devDependencies` via `npm i <some-package> --save-dev`, then `aron pack` will not exclude it.

## Version
Smartly bump packages to specific versions by the `.workspaces` of the root `package.json`.

```bash
aron version <version>
```

[Check out the available options here for now](https://github.com/1aron/aronrepo/blob/beta/packages/aronrepo/src/commands/version.ts#L16-L18)

The command automatically bumps the version of all packages by scanning all workspaces and analyzing `dependencies` and `peerDependencies` of `package.json`

```diff
.
├── package.json
└── packages
    ├─── a
    |    └─── package.json
    ├─── b
    |    └─── package.json
    └─── c
         └─── package.json
```

This command scans all workspaces for dependencies with unspecified versions `""` considered a project package, then replaces them with the next version.

Now bump all dependent and workspace packages to a specified version:

```
aron version 1.2.0
```

<img width="628" alt="version" src="https://user-images.githubusercontent.com/33840671/204528593-a7a982f1-2e62-4a8e-95c3-122963f2254c.png">

`packages/a/package.json`

```diff
{
    "name": "a",
+   "version": "^1.2.0",
    "dependencies": {
-       "b": "",
+       "b": "^1.2.0"
    }
}
```

`packages/b/package.json`

```diff
{
    "name": "b",
+   "version": "^1.2.0"
}
```

`packages/c/package.json`

```diff
{
    "name": "c",
+   "version": "^1.2.0",
    "peerDependencies": {
-       "a": "",
+       "b": "^1.2.0"
    }
}
```

For version range, check out the [semver](https://github.com/npm/node-semver#versions)

Typically, you would use [Aron's semantic release](https://github.com/1aron/aronrepo/tree/beta/packages/semantic-release-config) with CI to automate the version and release commands.

## Build system for monorepo

Most workspace packages will pre-set script commands, such as `build`, `test`, and `lint`. Since features depend on each other, builds will be executed sequentially.

You can now use [Turborepo](https://turbo.build/repo) to easily build complex systems and run commands in one-linear.

![turborepo-excalidraw](https://user-images.githubusercontent.com/33840671/204613029-cc4eaef9-ed82-400f-aa65-a1f1ec5864c7.jpeg)

Set up the `/turbo.json`:

```json
{
    "$schema": "https://turbo.build/schema.json",
    "pipeline": {
        "dev": {
            "cache": false,
            "dependsOn": ["^build"]
        },
        "build": {
            "dependsOn": ["^build"],
            "outputs": ["dist/**"]
        },
        "test": {
            "outputs": [],
            "inputs": [
                "src/**/*.tsx",
                "src/**/*.ts",
                "tests/**/*.ts"
            ]
        },
        "lint": {
            "outputs": []
        },
        "type-check": {
            "outputs": ["dist/**"]
        }
    }
}
```

Set up the scripts of `/package.json`:
```json
{
    "scripts": {
        "dev": "turbo run dev",
        "build": "turbo run build",
        "test": "turbo run test --parallel",
        "lint": "turbo run lint --parallel",
        "type-check": "turbo run type-check --parallel"
    }
}
```
In most cases, `dev` and `build` cannot add the `--parallel` flag, which breaks their dependencies.

Typical workspace scripts for authoring a package:

```json
{
    "scripts": {
        "build": "aron pack",
        "dev": "npm run build -- --watch",
        "test": "jest",
        "type-check": "tsc --noEmit",
        "lint": "eslint src"
    }
}
```

From now on, you only need to **run the command in the project root** after opening the project.

```bash
npm run dev
```
Build your application or package:
```bash
npm run build
```
Test your business logic or UI by running scripts:
```bash
npm run test
```
Find and fix problems in JavaScript code before building:
```bash
npm run lint
```
Improve reliability with TypeScript's type checking:
```bash
npm run type-check
```

### Automation

With the well-configured build system, almost all commands can be automated through CI, taking GitHub Actions as an example:

Build an automated test on `beta` and `main` branches:
```yml
name: Test
on:
    push:
        branches:
            - main
            - beta

jobs:
    version:
        timeout-minutes: 15
        runs-on: ubuntu-20.04
        strategy:
            matrix:
                node-version: [18.12.1]
        steps:
            - uses: actions/checkout@v3
            - uses: actions/setup-node@v3
              with:
                  node-version: ${{ matrix.node-version }}
                  cache: 'npm'
            - run: npm ci
            - run: npm run build
            - run: npm run test
```
The same goes for `lint` and `type-check`.

While the `build` command will work with `deploy` and `release`, aronrepo builds a complete package release workflow and the tools needed during it.

Next, check out the [Aron's semantic release](https://github.com/1aron/aronrepo/tree/beta/packages/semantic-release-config)

<a aria-label="overview" href="https://github.com/1aron/aronrepo#ecosystem">
<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/%E2%AC%85%20back%20to%20contents-%20?color=212022&style=for-the-badge">
    <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/badge/%E2%AC%85%20back%20to%20contents-%20?color=f6f7f8&style=for-the-badge">
    <img alt="NPM Version" src="https://img.shields.io/badge/%E2%AC%85%20back%20to%20contents-%20?color=f6f7f8&style=for-the-badge">
</picture>
</a>
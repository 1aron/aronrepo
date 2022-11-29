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
            <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/v/release/1aron/aronrepo?include_prereleases&color=212022&label=&style=for-the-badge&logo=github&logoColor=%23000">
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

## Getting Started

Add workspaces `packages/*` to `./package.json` in project root
```
{
    "workspaces": [
        "packages/*"
    ]
}
```
Quickly install core packages by `aronrepo`:
```bash
npm i aronrepo -D
```
- Requires `npm@>=7` when using `npm`
- Set [`auto-install-peers`](https://pnpm.io/next/npmrc#auto-install-peers) when using `pnpm`
- You can also manually install [`peerDependencies`](https://github.com/1aron/aronrepo/blob/beta/packages/aronrepo/package.json#L32-L41) for fixed versions.

To create your first package, you may automate the required steps to define a new workspace using `npm init`.

```bash
npm init -w ./packages/a
```

After all, packages are configured including dependencies, run `npm i` in the root directory to install dependencies in all workspaces and root.

## `aron pack`

Packing your TypeScript and CSS packages with zero configuration. Built on top of [esbuild](https://esbuild.github.io/) so it's fast.

The command analyzes your `package.json` entry point and relative to input sources in the `src` directory for builds.

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
        "build": "aron pack"
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

Now run with the above configuration:

```bash
npm run build
```

<img width="628" alt="cjs-esm-iife-type-pack" src="https://user-images.githubusercontent.com/33840671/204300928-23e2d2f9-b0ed-4feb-b7cf-1b9ba6cf8127.png">

### CSS packages

```diff
.
├── package.json
└── packages
    └─── a
         ├─── src
         │    └─── index.css
+        ├─── dist
+        │    └─── index.css
         └─── package.json
```

Packaging CSS is simpler, configure `style` and `main` entry points in `package.json`.

```json
{
    "name": "b",
    "scripts": {
        "build": "aron pack"
    },
    "main": "./dist/index.css",
    "style": "./dist/index.css",
    "files": [
        "dist"
    ]
}
```

Now run with the above configuration:

```bash
npm run build
```

<img width="628" alt="cjs-esm-iife-type-pack-w" src="https://user-images.githubusercontent.com/33840671/204301220-9f35d7cf-9f53-497d-8e7d-92bd46de93b4.png">

### Multiple entry points

The command supports glob patterns that let you specify multiple entry points at once, including the output of nested directories.

```
aron src/**/*.ts --format cjs,esm,iife
```

```
aron src/**/*.css
```
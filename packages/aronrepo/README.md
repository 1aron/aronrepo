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
Automatically install core packages by installing `aronrepo`:
```bash
npm i aronrepo -D
```
- Requires `npm@>=7` when using `npm`
- Set [`auto-install-peers`](https://pnpm.io/next/npmrc#auto-install-peers) when using `pnpm`
- You can also manually install [`peerDependencies`](https://github.com/1aron/aronrepo/blob/beta/packages/aronrepo/package.json#L32-L41) for fixed versions.

Add `packages/*` workspace to project root `./package.json`
```
{
    "workspaces": [
        "packages/*"
    ]
}
```

To create your first package, you may automate the required steps to define a new workspace using `npm init`.

```
npm init -w ./packages/a
```

## `aron pack`

Packing your typescript and css packages with zero configuration. Built on top of [esbuild](https://esbuild.github.io/) so it's fast.

`aron pack` analyzes your `package.json` entry point and uses the default `src` directory as relative input sources for builds.

### Javascript packages
Simultaneously output `cjs`, `esm`, `iife`, `type declarations` respectively according to the configuration of `main`, `module`, `browser`, `types` in `package.json`

If you only want to package javascript modules in a specific format, remove the corresponding entry point from `package.json`.

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
Now with the configuration above you just need to run:

```bash
npm run build
```

Everything happens as you would expect.

<img width="628" alt="cjs-esm-iife-type-pack" src="https://user-images.githubusercontent.com/33840671/204300928-23e2d2f9-b0ed-4feb-b7cf-1b9ba6cf8127.png">

### CSS packages

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

Now with the configuration above you just need to run:

```bash
npm run build
```

<img width="628" alt="cjs-esm-iife-type-pack-w" src="https://user-images.githubusercontent.com/33840671/204301220-9f35d7cf-9f53-497d-8e7d-92bd46de93b4.png">




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
<p align="center">A monorepo ecosystem integrating first-class packages and build systems</p>

<p align="center">
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
            <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/actions/workflow/status/1aron/aronrepo/release.yml?branch=beta&label=%20&message=twitter&color=212022&logo=githubactions&style=for-the-badge">
            <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/github/actions/workflow/status/1aron/aronrepo/release.yml?branch=beta&label=%20&message=twitter&color=f6f7f8&logo=githubactions&style=for-the-badge&logoColor=%23000">
            <img alt="Github release actions" src="https://img.shields.io/github/actions/workflow/status/1aron/aronrepo/release.yml?branch=beta&label=%20&message=twitter&color=f6f7f8&logo=githubactions&style=for-the-badge&logoColor=%23000">
        </picture>
    </a>
</p>

</div>

## Ecosystem

##### Build System
- [aronrepo](https://github.com/1aron/aronrepo/tree/main/packages/aronrepo) - A monorepo build system and workflow

##### Convention

- [aron-conventional-commits](https://github.com/1aron/aronrepo/tree/main/packages/conventional-commits) - A human-readable set of conventional commits, with version rules and changelog groupings
- [conventional-changelog-aron](https://github.com/1aron/aronrepo/tree/main/packages/conventional-changelog-config) - Beautiful changelog based on Aron's conventional commits

##### Release
- [semantic-release-config-aron](https://github.com/1aron/aronrepo/tree/main/packages/semantic-release-config) - Aron's semantic release config for publishing workspace packages

##### Packing
- [aron pack](https://github.com/1aron/aronrepo/tree/main/packages/aronrepo#pack) - Bundling your TypeScript and CSS packages with zero configuration

##### Versioning
- [aron version](https://github.com/1aron/aronrepo/tree/main/packages/aronrepo#version) - Smartly bump all workspace-dependent packages to specific versions

##### Linting
- [eslint-config-aron](https://github.com/1aron/aronrepo/tree/main/packages/eslint-config) - Aron's eslint config
- [commitlint-config-aron](https://github.com/1aron/aronrepo/tree/main/packages/commitlint-config) - Check your commits with Aron's commitlint config

##### Testing
- [aron-jest](https://github.com/1aron/aronrepo/tree/main/packages/jest) - Aron's jest preset to improve performance
- [aron-web-jest](https://github.com/1aron/aronrepo/tree/main/packages/web-jest) - Aron's jest preset for web

##### Continuous Integration
- [aron-github-actions](https://github.com/1aron/aronrepo/tree/main/packages/github-actions) - A set of GitHub Actions for aronrepo ecosystem includes PR title checks

## Built on the top
- [turborepo](https://turbo.build/repo) - A high-performance build system for monorepo
- [esbuild](https://esbuild.github.io/) - An extremely fast JavaScript and CSS bundler and minifier
- [semantic-release](https://www.typescriptlang.org/) - Fully automated version management and package publishing
- [typescript](https://www.typescriptlang.org/) - A strongly typed programming language that builds on JavaScript
- [commitlint](https://github.com/conventional-changelog/commitlint) - Lint commit messages
- [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog) - Generate changelogs and release notes from a project's commit messages and metadata
- [eslint](https://eslint.org/) - Find and fix problems in your JavaScript code
- [husky](https://typicode.github.io/husky) - Modern native Git hooks made easy
- [jest](https://jestjs.io/) - Delightful JavaScript Testing.

## Who's using aronrepo?

- [Master CSS](https://css.master.co/) - A Virtual CSS language with enhanced syntax
- [Master Style Element](https://github.com/master-co/style-element) - Create reusable style elements using class names in one-linear

## Contributing
Please see the documentation [CONTRIBUTING](https://github.com/1aron/aronrepo/blob/beta/.github/CONTRIBUTING.md) for workflow.

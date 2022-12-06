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
<p align="center">A human-readable set of conventional commits, with version rules and changelog groupings</p>

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

<br>

- Human-readable sentence case commits format
- Sometimes strict and sometimes loose commit formats
- Not only Monorepo but also single-package repositories
- Release rules are used for semantic analysis of semantic releases to bump versions automatically
- Groups are used to group changelogs
- This also applies to the [conventional-changelog](https://github.com/conventional-changelog) ecosystem

## Commit Message Header
The header has a particular format that includes a `Type`, a `Target`, and a `Summary`:

```
Type(Target): Summary
  ┊     ┊
  ┊     └─⫸ Target: Workspace, Package or Role
  ┊
  └─⫸ Type: Bump, Feat, New, Perf, Add, Update, Improve, Fix, Depreciate, Drop, Docs, Upgrade, Deps, Revert, Example, Test, Refactor, Chore, Misc
```

- `Type`
  - Sentense case only
- `Target`
  - Sentense case only
  - Accept starting with Markdown characters \` \* \_ # ~
  - Can be omitted in one workspace
- `Summary`
  - Sentense case only
  - Accept starting with Markdown characters \` \* \_ # ~
  - No period at the end

## Semver Commits
Such commits result in version bumps.

## Patch
`Perf` `Add` `Update` `Improve` `Fix` `Depreciate` `Drop` `Upgrade` `Revert` `Bump(Patch)` `Docs(README)`

### Bug Fixes
A change to a system or product designed to handle a programming bug/glitch.

```
Fix: <Summary>
Fix(Target): <Summary>
```
<sub>🟢 Good for a monorepo</sub>
```
Fix(CSS): HEX codes were incorrectly parsed as selectors
     ┊    ┊
     ┊    └─⫸ A brief description of the specific error
     ┊
     └─⫸ CSS is a workspace package
```
<sub>🔴 Bad for a monorepo</sub>
```
Fix: Fix issues by extracting hex codes with strict rules
   ┊  ┊                 ┊
   ┊  ┊                 └─⫸ Describe the problem rather than the solution
   ┊  ┊
   ┊  └─⫸ Don't repeat the word `Fix` in Summary
   ┊
   └─⫸ Without a `(Target)`, the viewer cannot identify the participating workspace
```

### Performance Upgrades
```
Perf: <Summary>
Perf(Target): <Summary>
```
Example
```
Perf: Refresh cache when configuration changes
```

### Additions
```
Add: <Summary>
Add(Target): <Summary>
```
Example
```
Add(CSS): Option `.preference` for default theme
```

### Improvements
```
Improve: <Summary>
Improve(Target): <Summary>
```
Example
```
Improve(Home): Swap the order of **Feature** and **Pricing**
```

### Updates
Static content updates such as articles, news, about, profile, etc.
```
Update: <Summary>
Update(Target): <Summary>
```
Example
```
Update(Team): The member's job title changed
```

### Upgrades
Upgrade environment, system, dependencies, etc.
```
Upgrade: <Summary>
Upgrade(Target): <Summary>
```
Example
```
Upgrade(Compiler): Dependency `@master/css@^2.0.0`
```

### Deprecations
Deprecate features, options, parameters, units, pages, etc.

- Alias: `Drop`
```
Depreciate: <Summary>
Depreciate(Target): <Summary>
```

Example
```
Drop(Normal CSS): `--font-mono` `--font-sans` `--font-serif` CSS variables
```

### Reversions
```
Revert: "<Reverted Commit Header>"


This reverts commit <Reverted Commit Hash>.
```
If you are using [Git Graph extension for VSCode](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph), Clicking `Revert` will automatically generate the following format:
```
Revert "<Reverted Commit Header>"


This reverts commit <Reverted Commit Hash>.
```
Example
```
Revert "Fix(Repo): PeerDependencies -> Dependencies"


This reverts commit 779347237eef77e9137f88095e1fb813e5101c2b.
```

### Update README <sub><sup>Ungrouped<sup><sub>
The `README.md` of the NPM package can only be updated by releasing a new version. At this time, it's very convenient to trigger the patch through:
```
Docs(README): <Summary>
```
```
Docs(README): Features section
```
It's reasonable to update `README.md` by bumping to the patch version because the documentation is part of this version.

### Manual
Manually bump a patch version due to special reasons.
```
Bump(Patch): <Summary>
```
Example
```
git commit --allow-empty -m 'Bump(Patch): `+0.0.1`'
```

## Minor
`Feat` `New` `Bump(Minor)`

### New Features
- Alias: `New`
```
Feat: <Summary>
Feat(Target): <Summary>
```
Example
```
New(Syntax): A new shorthand `WxH` for `width:` and `height:`
```

### Manual
Manually bump a minor version due to special reasons.
```
Bump(Minor): <Summary>
```
Example
```
git commit --allow-empty -m 'Bump(Minor): `+0.1.0`'
```

## Major
Bumping to the next major version should be triggered manually by the manager rather than relying on a flag in a given commit.

<sub>Format</sub>
```
Bump(Major): <Summary>
```
No clear motivation for `<Summary>` yet? Hit `Version` or the next version, like `v2.0.0`.

<sub>🟢 Good for a monorepo</sub>
```
git commit --allow-empty -m 'Bump(Major): Master CSS v2.0'
```
This is just a commit used to trigger version analysis, don't be obsessed with changes in files, so add `--allow-empty`

## Other Commits
Trivial routine commits include test cases, examples, and environment configurations.

`Docs` `Tests` `Example` `Chore` `Misc`

### Documentation
```
Docs: <Summary>
Docs(Target): <Summary>
```
Example
```
Docs(CSS): Initialize Master CSS with custom configuration
```

### Tests
```
Test: <Summary>
Test(Target): <Summary>
```
Example
```
Test(Syntax): Check CSS rules for `WxH` output
```

### Examples
```
Example: <Summary>
Example(Target): <Summary>
```
Example
```
Example(Next.js 13): Update to layouts RFC
```

### Miscellaneous
- Alias: `Chore` or no prefix
```
Misc: <Summary>
Misc(Target): <Summary>
<Summary>
```

Example
```
Chore: Update README.md
```
I actually prefer no prefix, having to keep prefixing every frequent trivial item is very annoying, and marking trivial items doesn't make much sense.

<sub>🟢 Better day-to-day development experience</sub>
```
Update README.md
```

<br>

<a aria-label="overview" href="https://github.com/1aron/aronrepo#ecosystem">
<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/%E2%AC%85%20back%20to%20contents-%20?color=212022&style=for-the-badge">
    <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/badge/%E2%AC%85%20back%20to%20contents-%20?color=f6f7f8&style=for-the-badge">
    <img alt="NPM Version" src="https://img.shields.io/badge/%E2%AC%85%20back%20to%20contents-%20?color=f6f7f8&style=for-the-badge">
</picture>
</a>
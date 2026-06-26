# Aronrepo

ESM-only monorepo utilities for Aron projects.

## Packages

- `@aronrepo/repo`
- `@aronrepo/eslint-config`
- `@aronrepo/commitlint-config`
- `@aronrepo/conventional-commits`
- `@aronrepo/conventional-changelog-config`
- `@aronrepo/semantic-release-config`
- `@aronrepo/semantic-release-pnpm`

All published packages are ESM-only. JavaScript output is `dist/**/*.js`, types are `dist/**/*.d.ts`, and package exports do not include CommonJS fallbacks.

## Commands

```sh
pnpm install
pnpm run build
pnpm run test
pnpm run lint
pnpm run type-check
pnpm run check
```

Package builds use `tsdown` directly through each package script. Advanced build customization should use package-local `tsdown.config.ts` or `rolldown.config.ts`.

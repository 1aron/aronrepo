# AI Context Index

This directory gives agents deeper context for Aronrepo without making the root `AGENTS.md` too long.

## Reading Order

1. Start with `AGENTS.md` at the repository root for required operating rules.
2. Read `project-map.md` when you need ownership, package responsibility, or source/test locations.
3. Read `workflows.md` when you need local validation, CI, release, or PR title behavior.
4. Inspect the actual repo files named in these docs before changing code.

## Source of Truth

Repository files are the source of truth. These context files are a map, not a replacement for current code and config.

When docs disagree with files such as `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.github/workflows/*`, `tsconfig.json`, or package-local configs, follow the repo files and update the docs in the same change.

## When to Update This Context

Update this directory when a change affects:

- Workspace layout or package ownership.
- Root scripts, package scripts, or validation commands.
- Build, test, lint, type-check, or release behavior.
- Commit or PR title rules.
- Public package exports or publishing assumptions.

Keep additions compact. Prefer documenting durable project facts and decision points over copying full config files.

## Context Files

- `project-map.md`: repository layout, key config files, and package responsibilities.
- `workflows.md`: local development, CI, release, and validation guidance.

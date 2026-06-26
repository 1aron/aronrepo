# AI Coding Integration

Aronrepo packages are designed to be adopted by AI coding agents without guessing how commit rules, changelog generation, release analysis, and pnpm publishing should fit together. The agent should inspect the target repository first, preserve the existing architecture, and add only the Aronrepo pieces that match the repository's package manager, module system, workspace layout, and release workflow.

Use this guide when integrating Aronrepo into another JavaScript or TypeScript repository.

## Expected Result

A complete Aronrepo adoption should leave the target repository with:

- The `aronrepo` facade package and required peer tools installed as development dependencies.
- ESM-compatible commitlint configuration using `@aronrepo/commitlint-config`.
- Semantic-release configuration using `@aronrepo/semantic-release-config`.
- pnpm workspace publishing through `@aronrepo/semantic-release-pnpm` for public packages.
- README guidance for commit format, release-impacting types, validation commands, and publishing behavior.
- AI agent guidance that tells coding agents to use Aronrepo commit types and `Chore(Agent)` for internal agent instructions.
- CI or PR title checks updated only when the target repository already has the relevant workflow surface or clearly needs one.

## Copy-Paste Prompt

Copy and paste this prompt into an AI coding agent to adopt Aronrepo in an existing repository:

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

## Agent Rules

- Inspect before editing. The target repository's package manager, Node engine, workspace layout, CI workflows, and release setup decide the exact integration shape.
- Prefer facade installation with `aronrepo`. Install individual `@aronrepo/*` packages only when intentionally doing partial adoption.
- Keep ESM compatibility. Aronrepo packages do not provide CommonJS fallbacks.
- Configure release behavior from the shared Aronrepo source of truth instead of copying release rules by hand.
- Choose the lowest accurate release-impacting commit type. Published README changes use `Docs(README)`, while internal AI instructions use `Chore(Agent)`.
- Validate narrowly first. For docs and config work, check the exact files and commands affected before broadening to full repository validation.

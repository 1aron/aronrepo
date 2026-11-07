import { commits, legacyCommits, type ReleaseType } from './commits'
import {
    defaultReleasePathExcludes,
    defaultReleasePolicy,
    getReleaseType,
    nonReleaseAlternatives,
    type ReleasePathsConfig,
    type ReleasePolicy
} from './policy'

export interface AgentCommitPolicyExample {
    commit: string
    use: string
    release: ReleaseType
    avoid?: string
}

export interface AgentCommitPolicy {
    mode: ReleasePolicy['mode']
    defaultInternalCommit: string
    defaultInternalType: string
    defaultInternalScope: string
    releaseImpactRule: string
    /** Release decisions that belong to the repository owner, not to a coding agent. */
    ownerDecisions: string[]
    releaseWorthyChanges: string[]
    nonReleaseDefaults: string[]
    /** Commands an agent runs to check its commits before handing them off. */
    verification: string[]
    examples: AgentCommitPolicyExample[]
}

export interface AgentCommitPolicyOptions {
    /** How to run the CLI in this repository, such as `bun x aronrepo` or `pnpm exec aronrepo`. */
    cli?: string
}

export function getAgentCommitPolicy(policy: ReleasePolicy = defaultReleasePolicy, options: AgentCommitPolicyOptions = {}): AgentCommitPolicy {
    const explicit = policy.mode === 'explicit'
    const cli = options.cli ?? 'npx aronrepo'
    return {
        mode: policy.mode,
        defaultInternalCommit: 'Chore(Agent): Clarify commit selection policy',
        defaultInternalType: 'Chore',
        defaultInternalScope: 'Agent',
        releaseImpactRule: 'Use a release type only when the commit changes files that ship in a published package (release paths) and affects published behavior, public API, release behavior, or published README content. Otherwise use a non-release type.',
        ownerDecisions: explicit
            ? [
                'Never write `Bump(Major)` or `Bump(Minor)` unless the user explicitly asked for that release level in the current conversation.',
                'Never add a `BREAKING CHANGE:` footer or a `Type!:` header. If a change breaks published behavior, stop and ask the user how to release it.',
                'Every type except `Bump(Minor)` and `Bump(Major)` releases at most a patch. Pick the type that describes the change, not the release level you want.'
            ]
            : [
                'Never write `Bump(Major)` or `Bump(Minor)` unless the user explicitly asked for that release level in the current conversation.',
                'A `BREAKING CHANGE:` footer releases a major version. Add one only for a real break in published behavior or public API, and tell the user.',
                '`Add` releases a minor version. Use it only for new capabilities of published packages.'
            ],
        releaseWorthyChanges: [
            'Published package runtime behavior',
            'Public API, exports, or types',
            'Release, changelog, or versioning behavior',
            'Published README content that requires a package patch release'
        ],
        nonReleaseDefaults: [
            'Agent instructions, prompts, and repository context: `Chore(Agent)`',
            'Sites, apps, and other unpublished workspaces: `Chore(<Scope>)`, `Refactor`, `Style`, or `Test`, even for fixes and performance work',
            'Tests that only cover existing behavior: `Test`',
            'Benchmark harnesses, fixtures, reports, and measurement-only changes: `Benchmark` (never `Perf`)',
            'Build tooling and dev-only configuration: `Build`; CI workflows: `CI`; formatting: `Style`',
            'Development dependencies, lockfiles, and routine metadata: `Chore(Deps)` or `Chore`',
            'Examples: `Example`; internal or site documentation: `Docs`',
            'Refactors that do not change published behavior: `Refactor`'
        ],
        verification: [
            `${cli} check --from origin/main --to HEAD`,
            `${cli} explain`
        ],
        examples: [
            {
                commit: 'Add(Core): Support ESM config files',
                use: 'A new capability in a published package',
                release: getReleaseType('Add', 'Core', policy) ?? false,
                ...(explicit ? { avoid: 'Feat(Core): Support ESM config files' } : {})
            },
            {
                commit: 'Chore(Site): Fix the homepage header transition',
                use: 'A fix in an unpublished site or app workspace',
                release: false,
                avoid: 'Fix(Site): Fix the homepage header transition'
            },
            {
                commit: 'Chore(Agent): Update repository guidance for coding agents',
                use: 'Agent instructions, prompts, or repo context',
                release: false,
                avoid: 'Feat(Agent): Add agent guide'
            },
            {
                commit: 'Test(Release): Cover scoped README bump rules',
                use: 'Tests that validate existing release behavior',
                release: false
            },
            {
                commit: 'Benchmark(Benchmarks): Refresh benchmark report',
                use: 'Benchmark-only changes when the benchmark area is the useful scope',
                release: false,
                avoid: 'Perf(Benchmarks): Refresh benchmark report'
            },
            {
                commit: 'Benchmark: Refresh benchmark report',
                use: 'Benchmark-only changes when no clear scope exists',
                release: false
            },
            {
                commit: 'CI(GitHub): Update PR title check permissions',
                use: 'CI workflow, status check, and automation changes that do not change release behavior',
                release: false,
                avoid: 'Fix(CI): Update PR title check permissions'
            },
            {
                commit: 'Build(Tooling): Update Vitest config',
                use: 'Build system, bundler, local tooling, and dev-only configuration changes',
                release: false,
                avoid: 'Update(Build): Update Vitest config'
            },
            {
                commit: 'Style(Lint): Format TypeScript files',
                use: 'Formatting, lint-only, whitespace, or readability changes with no behavior change',
                release: false,
                avoid: 'Improve(Core): Format TypeScript files'
            },
            {
                commit: 'Chore(Deps): Update Vitest dev dependency',
                use: 'Development dependency, lockfile, audit report, and routine metadata changes',
                release: false,
                avoid: 'Upgrade(Deps): Update Vitest dev dependency'
            },
            {
                commit: 'Example(Release): Add a release workflow sample',
                use: 'Example-only additions or updates that do not change published package behavior',
                release: false,
                avoid: 'Add(Example): Add a release workflow sample'
            },
            {
                commit: 'Docs: Add commit type examples',
                use: 'Documentation that is not published as package README content',
                release: false
            },
            {
                commit: 'Docs(README): Clarify package installation',
                use: 'A published package README (not the repository root README)',
                release: 'patch'
            },
            {
                commit: 'Fix(Release): Preserve workspace dependency ranges',
                use: 'A release behavior bug that affects published package behavior',
                release: 'patch'
            }
        ]
    }
}

/** Agent policy for the default `explicit` mode. */
export const agentCommitPolicy = getAgentCommitPolicy()

function formatRule(type: string, scope?: string) {
    return `\`${type}${scope ? `(${scope})` : ''}\``
}

export function getReleaseTable(policy: ReleasePolicy = defaultReleasePolicy) {
    const rows: Record<'major' | 'minor' | 'patch' | 'none', string[]> = { major: [], minor: [], patch: [], none: [] }
    for (const { type, scope } of commits) {
        const release = getReleaseType(type, scope, policy)
        rows[release || 'none'].push(formatRule(type, scope))
    }
    if (policy.mode === 'auto') rows.major.push('`BREAKING CHANGE:` footer')
    return rows
}

export const agentsBlockStart = '<!-- aronrepo:commit-policy:start -->'
export const agentsBlockEnd = '<!-- aronrepo:commit-policy:end -->'

export interface RenderAgentsBlockOptions extends AgentCommitPolicyOptions {
    /** Resolved release paths; `undefined` means every path may release. */
    releasePaths?: ReleasePathsConfig
}

/** Renders the generated commit policy block for AGENTS.md, including its markers. */
export function renderAgentsBlock(policy: ReleasePolicy = defaultReleasePolicy, options: RenderAgentsBlockOptions = {}) {
    const agent = getAgentCommitPolicy(policy, options)
    const paths = options.releasePaths
    const typeRows = commits.map(({ type, scope, description }) =>
        `| ${formatRule(type, scope)} | ${getReleaseType(type, scope, policy) || 'none'} | ${description} |`)
    const lines = [
        agentsBlockStart,
        '<!-- Generated by `aronrepo agents --write`. Edit aronrepo.config.js and regenerate instead of editing this block. -->',
        '',
        '## Commit and Release Policy',
        '',
        `Release mode: **${policy.mode}**. ${policy.mode === 'explicit'
            ? 'Only the repository owner decides minor and major versions, with `Bump(Minor)` and `Bump(Major)` commits.'
            : '`Add` releases minor versions, and `BREAKING CHANGE:` footers release major versions.'}`,
        '',
        'Commit headers and PR titles use `Type(Scope): Summary` or `Type: Summary`: a PascalCase type, an optional scope for the package or area, and a sentence-case summary without a trailing period.',
        '',
        '| Type | Release | Use for |',
        '| --- | --- | --- |',
        ...typeRows,
        '',
        `Legacy types are rejected: ${legacyCommits.map(({ type, replacement }) => `\`${type}\` (use \`${replacement}\`)`).join(', ')}.`,
        '',
        '### Release decisions belong to the owner',
        '',
        ...agent.ownerDecisions.map((rule) => `- ${rule}`),
        '',
        '### Choosing a type',
        '',
        `- ${agent.releaseImpactRule}`,
        '- Pick the type that describes the change: a new capability is `Add`, a better existing capability is `Improve`, a bug fix is `Fix`, and a runtime dependency change is `Upgrade`.',
        `- A commit that changes no release path must use a non-release type (${nonReleaseAlternatives.map((type) => `\`${type}\``).join(', ')}), even when it fixes or speeds up something.`,
        '- Split unrelated changes so each commit carries its own release level.',
        '',
        'Non-release defaults:',
        '',
        ...agent.nonReleaseDefaults.map((rule) => `- ${rule}`),
        '',
        '### Release paths',
        '',
        ...(paths?.include
            ? [
                'Only changes to these files can release a version:',
                '',
                ...paths.include.map((glob) => `- \`${glob}\``),
                '',
                `Excluding: ${(paths.exclude ?? defaultReleasePathExcludes).map((glob) => `\`${glob}\``).join(', ')}.`
            ]
            : ['Every path can release a version in this repository.']),
        '',
        '### Before handing off commits',
        '',
        ...agent.verification.map((command) => `- \`${command}\``),
        '',
        '`aronrepo explain` prints the next release level and the reason for each commit. Tell the user when it is not what they expect.',
        agentsBlockEnd
    ]
    return lines.join('\n')
}

export type ReleaseType = 'major' | 'minor' | 'patch' | false

export interface ConventionalCommitType {
    type: string
    scope?: string
    release: ReleaseType
    group?: string
    hidden?: boolean
}

export interface AgentCommitPolicyExample {
    commit: string
    use: string
    release: ReleaseType
    avoid?: string
}

export interface AgentCommitPolicy {
    defaultInternalCommit: string
    defaultInternalType: string
    defaultInternalScope: string
    releaseImpactRule: string
    releaseWorthyChanges: string[]
    nonReleaseDefaults: string[]
    examples: AgentCommitPolicyExample[]
}

export const commits = [
    { type: 'Bump', scope: 'Major', release: 'major' },
    { type: 'Bump', scope: 'Minor', release: 'minor' },
    { type: 'Bump', scope: 'Patch', release: 'patch' },
    { type: 'Feat', release: 'minor', group: 'New Features' },
    { type: 'New', release: 'minor', group: 'New Features' },
    { type: 'Perf', release: 'patch', group: 'Performance Upgrades' },
    { type: 'Add', release: 'patch', group: 'Additions' },
    { type: 'Update', release: 'patch', group: 'Updates' },
    { type: 'Improve', release: 'patch', group: 'Improvements' },
    { type: 'Fix', release: 'patch', group: 'Bug Fixes' },
    { type: 'Deprecate', release: 'patch', group: 'Deprecations' },
    { type: 'Drop', release: 'patch', group: 'Deprecations' },
    { type: 'Docs', release: false, group: 'Documentation' },
    { type: 'Docs', scope: 'README', release: 'patch' },
    { type: 'Upgrade', release: 'patch', group: 'Upgrades' },
    { type: 'Revert', release: 'patch', group: 'Reversions' },
    { type: 'Example', release: false, group: 'Examples' },
    { type: 'Test', release: false, group: 'Tests' },
    { type: 'Benchmark', release: false, group: 'Benchmarks' },
    { type: 'Build', release: false, hidden: false },
    { type: 'CI', release: false, hidden: false },
    { type: 'Style', release: false, hidden: false },
    { type: 'Refactor', release: false, hidden: false },
    { type: 'Chore', release: false, hidden: false },
    { type: 'Misc', release: false, hidden: false }
] satisfies ConventionalCommitType[]

export const types = [...new Set(commits.map(({ type }) => type))]

export const releaseCommits = commits.filter(({ release }) => release !== false)

export const nonReleaseCommits = commits.filter(({ release }) => release === false)

export const releaseTypes = [...new Set(releaseCommits.map(({ type }) => type))]

export const nonReleaseTypes = [...new Set(nonReleaseCommits.map(({ type }) => type))]

export function findCommitRule(type: string | undefined, scope?: string) {
    if (!type) return undefined

    return commits.find((commit) => commit.type === type && commit.scope === scope)
        ?? commits.find((commit) => commit.type === type && commit.scope === undefined)
}

export function getReleaseType(type: string | undefined, scope?: string) {
    return findCommitRule(type, scope)?.release
}

export const agentCommitPolicy = {
    defaultInternalCommit: 'Chore(Agent): Clarify commit selection policy',
    defaultInternalType: 'Chore',
    defaultInternalScope: 'Agent',
    releaseImpactRule: 'Use release-impacting types only when the change affects published package behavior, public API, release behavior, or published README content.',
    releaseWorthyChanges: [
        'Published package runtime behavior',
        'Public API, exports, or types',
        'Release, changelog, or versioning behavior',
        'Published README content that requires a package patch release'
    ],
    nonReleaseDefaults: [
        'Agent instructions, prompts, and repository context',
        'Tests that only cover existing behavior',
        'Benchmark harnesses, fixtures, reports, and measurement-only changes',
        'Build tooling, CI workflows, formatting, and lint-only style changes',
        'Development dependency, lockfile, audit report, and policy-only changes',
        'Examples, internal documentation, and routine metadata',
        'Refactors that do not change published behavior'
    ],
    examples: [
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
            commit: 'Benchmark(Runtime): Add parser throughput baseline',
            use: 'Benchmark harnesses, baseline data, or measurement-only changes that do not change published runtime behavior',
            release: false,
            avoid: 'Perf(Runtime): Add parser throughput benchmark'
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
            commit: 'Example(Release): Add semantic-release config sample',
            use: 'Example-only additions or updates that do not change published package behavior',
            release: false,
            avoid: 'Feat(Example): Add semantic-release config sample'
        },
        {
            commit: 'Docs: Add commit type examples',
            use: 'Documentation that is not published as package README content',
            release: false
        },
        {
            commit: 'Docs(README): Clarify package installation',
            use: 'Published README content that should trigger a patch release',
            release: 'patch'
        },
        {
            commit: 'Fix(Release): Preserve workspace dependency ranges',
            use: 'A release behavior bug that affects published package behavior',
            release: 'patch'
        }
    ]
} satisfies AgentCommitPolicy

export default commits

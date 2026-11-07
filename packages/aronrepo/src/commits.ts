export type ReleaseType = 'major' | 'minor' | 'patch' | false

export interface ConventionalCommitType {
    type: string
    scope?: string
    /**
     * Release level in `auto` mode. The `explicit` mode caps every type except
     * `Bump` at `patch`; see `getReleaseType()` and `resolveCommitRelease()`.
     */
    release: ReleaseType
    /** When to use the type, written for people and coding agents. */
    description: string
    /** Release notes section. Types without a group never appear in release notes. */
    group?: string
}

export interface LegacyCommitType {
    type: string
    /** The type that replaces it. Legacy commits release and group like their replacement. */
    replacement: string
}

/** Release levels in descending order. */
export const releaseLevels = ['major', 'minor', 'patch'] as const

export function compareRelease(a: ReleaseType | undefined, b: ReleaseType | undefined) {
    const rank = (release: ReleaseType | undefined) => release ? 3 - releaseLevels.indexOf(release) : 0
    return rank(a) - rank(b)
}

export function maxRelease(...releases: Array<ReleaseType | undefined>): ReleaseType {
    return releases.reduce<ReleaseType>((highest, release) =>
        compareRelease(release, highest) > 0 ? release as ReleaseType : highest, false)
}

/**
 * The Aronrepo commit types. The table is fixed: repositories choose a release
 * mode and release paths, not their own types.
 *
 * Release notes list the groups in this order.
 */
export const commits: readonly Readonly<ConventionalCommitType>[] = Object.freeze(([
    { type: 'Bump', scope: 'Major', release: 'major', description: 'Release a major version. Only the repository owner decides it.' },
    { type: 'Bump', scope: 'Minor', release: 'minor', description: 'Release a minor version. Only the repository owner decides it.' },
    { type: 'Bump', scope: 'Patch', release: 'patch', description: 'Release a patch version without another release commit.' },
    { type: 'Add', release: 'minor', group: 'Additions', description: 'A new capability: a new API, export, option, command, or package.' },
    { type: 'Improve', release: 'patch', group: 'Improvements', description: 'A better existing capability without new API: behavior, output, messages, or defaults.' },
    { type: 'Perf', release: 'patch', group: 'Performance', description: 'Faster or lighter published code with the same behavior.' },
    { type: 'Fix', release: 'patch', group: 'Bug Fixes', description: 'A bug fix in published behavior.' },
    { type: 'Deprecate', release: 'patch', group: 'Deprecations', description: 'Mark a published capability as deprecated while it keeps working.' },
    { type: 'Drop', release: 'patch', group: 'Removals', description: 'Remove a published capability.' },
    { type: 'Upgrade', release: 'patch', group: 'Dependencies', description: 'Change a runtime dependency of a published package.' },
    { type: 'Revert', release: 'patch', group: 'Reverts', description: 'Revert a commit. It releases what the reverted commit released.' },
    { type: 'Docs', scope: 'README', release: 'patch', group: 'Documentation', description: 'Change a published package README.' },
    { type: 'Docs', release: false, description: 'Documentation that is not a published package README.' },
    { type: 'Test', release: false, description: 'Tests that cover existing behavior.' },
    { type: 'Benchmark', release: false, description: 'Benchmark harnesses, fixtures, and reports.' },
    { type: 'Example', release: false, description: 'Examples that do not ship in a package.' },
    { type: 'Build', release: false, description: 'Build tooling and development configuration.' },
    { type: 'CI', release: false, description: 'CI workflows and automation.' },
    { type: 'Style', release: false, description: 'Formatting and lint-only changes.' },
    { type: 'Refactor', release: false, description: 'Code changes that keep published behavior.' },
    { type: 'Chore', release: false, description: 'Maintenance: development dependencies, lockfiles, metadata, agent guidance, and unpublished workspaces.' }
] satisfies ConventionalCommitType[]).map((commit) => Object.freeze(commit)))

/**
 * Types from earlier Aronrepo versions. They still resolve in history so old
 * commits release as before, but `aronrepo check` rejects them in new commits.
 */
export const legacyCommits: readonly Readonly<LegacyCommitType>[] = Object.freeze(([
    { type: 'Feat', replacement: 'Add' },
    { type: 'New', replacement: 'Add' },
    { type: 'Update', replacement: 'Improve' },
    { type: 'Misc', replacement: 'Chore' }
] satisfies LegacyCommitType[]).map((commit) => Object.freeze(commit)))

export const types: string[] = [...new Set(commits.map(({ type }) => type))]

export const legacyTypes: string[] = legacyCommits.map(({ type }) => type)

export const releaseCommits: ConventionalCommitType[] = commits.filter(({ release }) => release !== false)

export const nonReleaseCommits: ConventionalCommitType[] = commits.filter(({ release }) => release === false)

export const releaseTypes: string[] = [...new Set(releaseCommits.map(({ type }) => type))]

export const nonReleaseTypes: string[] = [...new Set(nonReleaseCommits.map(({ type }) => type))]

/** Release notes groups in display order. */
export const releaseGroups: string[] = [...new Set(commits.flatMap(({ group }) => group ? [group] : []))]

/** The current type for a legacy type, or the type itself. */
export function normalizeType(type: string): string
export function normalizeType(type: string | undefined): string | undefined
export function normalizeType(type: string | undefined) {
    return legacyCommits.find((legacy) => legacy.type === type)?.replacement ?? type
}

export function findCommitRule(type: string | undefined, scope?: string): ConventionalCommitType | undefined {
    const current = normalizeType(type)
    if (!current) return undefined

    return commits.find((commit) => commit.type === current && commit.scope === scope)
        ?? commits.find((commit) => commit.type === current && commit.scope === undefined)
}

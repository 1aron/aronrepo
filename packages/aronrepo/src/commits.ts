export type ReleaseType = 'major' | 'minor' | 'patch' | false

export interface ConventionalCommitType {
    type: string
    scope?: string
    /**
     * Release level in `auto` mode. The `explicit` mode caps every type except
     * `Bump` at `patch`; see `getReleaseType()` and `resolveCommitRelease()`.
     */
    release: ReleaseType
    group?: string
    hidden?: boolean
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

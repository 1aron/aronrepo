import semver from 'semver'
import type { ReleaseType } from './commits'

/** Prerelease branches. Each publishes `X.Y.Z-<branch>.N` on the npm dist-tag of the same name. */
export const prereleaseChannels = ['alpha', 'beta', 'rc', 'canary'] as const

/** Branches that release: `main` publishes on `latest`, and each prerelease branch on its own dist-tag. */
export const releaseBranches = ['main', ...prereleaseChannels] as const

export interface ReleaseChannel {
    branch: string
    /** npm dist-tag that the release moves to. */
    distTag: string
    /** Prerelease identifier, for prerelease branches only. */
    prerelease?: string
}

/** The release channel of a branch, or `undefined` when the branch does not release. */
export function getReleaseChannel(branch: string | undefined): ReleaseChannel | undefined {
    if (branch === 'main') return { branch, distTag: 'latest' }
    if (branch && (prereleaseChannels as readonly string[]).includes(branch)) return { branch, distTag: branch, prerelease: branch }
    return undefined
}

/** The first version of a repository without version tags. */
export const initialVersion = '1.0.0'

export function toVersionTag(version: string) {
    return `v${version}`
}

/** The version of a `vX.Y.Z` or `vX.Y.Z-pre.N` tag, or `undefined` for other tags. */
export function parseVersionTag(tag: string) {
    if (!tag.startsWith('v')) return undefined
    const version = tag.slice(1)
    return semver.valid(version) === version ? version : undefined
}

function versionsOf(tags: string[]) {
    return tags.flatMap((tag) => {
        const version = parseVersionTag(tag)
        return version ? [version] : []
    })
}

function highest(versions: string[]) {
    return versions.length ? semver.rsort([...versions])[0] : undefined
}

function stableVersions(versions: string[]) {
    return versions.filter((version) => !semver.prerelease(version))
}

function channelVersions(versions: string[], prerelease: string) {
    return versions.filter((version) => semver.prerelease(version)?.[0] === prerelease)
}

function coreVersion(version: string) {
    return `${semver.major(version)}.${semver.minor(version)}.${semver.patch(version)}`
}

/** The latest stable version among tags, if any. */
export function getLatestStableVersion(tags: string[]) {
    return highest(stableVersions(versionsOf(tags)))
}

/**
 * The tag a channel's release range starts from: the latest stable tag, or on a
 * prerelease branch the latest tag of that channel when it is newer.
 */
export function getBaseTag(channel: ReleaseChannel, reachableTags: string[]) {
    const versions = versionsOf(reachableTags)
    const stable = highest(stableVersions(versions))
    if (channel.prerelease) {
        const prerelease = highest(channelVersions(versions, channel.prerelease)
            .filter((version) => !stable || semver.gt(version, stable)))
        if (prerelease) return toVersionTag(prerelease)
    }
    return stable ? toVersionTag(stable) : undefined
}

export interface VersionTags {
    /** Version tags reachable from the release commit. */
    reachable: string[]
    /** Every version tag in the repository, to number prereleases. */
    all: string[]
}

/**
 * The next version of a channel.
 *
 * `main` raises the latest stable version by `release`. A prerelease branch
 * targets the same version, or the version its earlier prereleases already
 * target when that is higher, and numbers the prerelease after every existing
 * tag of that version and channel.
 */
export function getNextVersion(channel: ReleaseChannel, release: Exclude<ReleaseType, false>, tags: VersionTags) {
    const reachable = versionsOf(tags.reachable)
    const stable = highest(stableVersions(reachable))
    const target = stable ? semver.inc(stable, release)! : initialVersion
    if (!channel.prerelease) return target

    const previous = highest(channelVersions(reachable, channel.prerelease)
        .filter((version) => !stable || semver.gt(version, stable)))
    const core = previous && semver.gte(coreVersion(previous), target) ? coreVersion(previous) : target
    const numbers = channelVersions(versionsOf(tags.all), channel.prerelease)
        .filter((version) => coreVersion(version) === core)
        .map((version) => Number(semver.prerelease(version)?.[1] ?? 0))
    return `${core}-${channel.prerelease}.${Math.max(0, ...numbers) + 1}`
}

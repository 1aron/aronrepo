import { commits, defaultReleasePolicy, getReleaseType, type ReleasePolicy } from '@aronrepo/conventional-commits'

/**
 * `@semantic-release/commit-analyzer` release rules for an Aronrepo release policy.
 *
 * @deprecated The default config uses `@aronrepo/semantic-release-config/analyzer`.
 * commit-analyzer falls back to its default Angular rules, including
 * `breaking → major`, for commits these rules do not match, so these rules
 * cannot guarantee an explicit-mode release.
 */
export function createReleaseRules(policy: ReleasePolicy = defaultReleasePolicy) {
    return [
        ...(policy.mode === 'auto' ? [{ breaking: true, release: 'major' as const }] : []),
        { revert: true, release: 'patch' as const },
        ...commits.map(({ type, scope }) => ({
            type,
            ...(scope ? { scope } : {}),
            release: getReleaseType(type, scope, policy) ?? false
        }))
    ]
}

/** @deprecated See `createReleaseRules()`. */
const releaseRules = createReleaseRules()

export default releaseRules

import { defaultReleasePolicy, resolveRelease, type ReleasePolicy } from '@aronrepo/conventional-commits'
import parserOpts from './parser-opts'

export interface BumpCommit {
    type?: string | null
    scope?: string | null
    subject?: string | null
    header?: string | null
    body?: string | null
    footer?: string | null
    hash?: string | null
}

function toMessage(commit: BumpCommit) {
    const header = commit.header
        ?? (commit.type ? `${commit.type}${commit.scope ? `(${commit.scope})` : ''}: ${commit.subject ?? 'Change'}` : '')
    return [header, commit.body, commit.footer].filter(Boolean).join('\n\n')
}

const levels = { major: 0, minor: 1, patch: 2 } as const

/** Recommended bump options that follow an Aronrepo release policy. */
export function createRecommendedBumpOpts(policy: ReleasePolicy = defaultReleasePolicy) {
    return {
        parserOpts,
        whatBump(parsedCommits: BumpCommit[]) {
            const decision = resolveRelease(parsedCommits.map((commit) => ({
                message: toMessage(commit),
                ...(commit.hash ? { hash: commit.hash } : {})
            })), policy)
            const count = (release: 'major' | 'minor' | 'patch') =>
                decision.commits.filter((commit) => commit.release === release).length

            return {
                level: decision.release ? levels[decision.release] : null,
                reason: `Major: ${count('major')}, Minor: ${count('minor')}, Patch: ${count('patch')}`
            }
        }
    }
}

const recommendedBumpOpts = createRecommendedBumpOpts()

export default recommendedBumpOpts

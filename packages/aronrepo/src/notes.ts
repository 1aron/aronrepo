import { findCommitRule, releaseGroups } from './commits'
import type { CommitDecision } from './policy'

export interface ReleaseNotesOptions {
    version: string
    /** Tag of the previous release, for the compare link. */
    previousTag?: string
    /** Release date as `YYYY-MM-DD`. */
    date?: string
    /** Repository URL, such as `https://github.com/owner/repo`, for links. */
    repositoryUrl?: string
    commits: CommitDecision[]
}

const breakingTitle = '⚠ Breaking Changes'

function groupOf(decision: CommitDecision) {
    if (decision.type === 'Revert') return 'Reverts'
    return findCommitRule(decision.type, decision.scope)?.group
}

function formatEntry(decision: CommitDecision, repositoryUrl?: string) {
    const summary = decision.subject ?? decision.header
    const scope = decision.scope ? `**${decision.scope}:** ` : ''
    const hash = decision.hash ? decision.hash.slice(0, 7) : undefined
    const link = hash
        ? repositoryUrl ? ` ([${hash}](${repositoryUrl}/commit/${decision.hash}))` : ` (${hash})`
        : ''
    return `- ${scope}${summary}${link}`
}

/**
 * Markdown release notes. Only commits that release appear, grouped by type in
 * the order of the commit table; `BREAKING CHANGE:` footers of major releases
 * come first.
 */
export function renderReleaseNotes(options: ReleaseNotesOptions) {
    const { version, previousTag, repositoryUrl } = options
    const tag = `v${version}`
    const title = repositoryUrl && previousTag
        ? `[${version}](${repositoryUrl}/compare/${previousTag}...${tag})`
        : version
    const lines = [`## ${title}${options.date ? ` (${options.date})` : ''}`]

    const released = options.commits.filter(({ release }) => release)
    const breaking = released
        .filter(({ release }) => release === 'major')
        .flatMap(({ breakingNotes }) => breakingNotes ?? [])
    if (breaking.length) {
        lines.push('', `### ${breakingTitle}`, '', ...breaking.map((note) => `- ${note}`))
    }

    const groups = new Map<string, CommitDecision[]>()
    for (const decision of released) {
        const group = groupOf(decision)
        if (!group) continue
        groups.set(group, [...groups.get(group) ?? [], decision])
    }
    for (const group of releaseGroups) {
        const entries = groups.get(group)
        if (!entries) continue
        const sorted = [...entries].sort((a, b) =>
            (a.scope ?? '').localeCompare(b.scope ?? '', 'en') || (a.subject ?? a.header).localeCompare(b.subject ?? b.header, 'en'))
        lines.push('', `### ${group}`, '', ...sorted.map((decision) => formatEntry(decision, repositoryUrl)))
    }

    if (!breaking.length && !groups.size) lines.push('', 'No changes to published packages.')
    return `${lines.join('\n')}\n`
}

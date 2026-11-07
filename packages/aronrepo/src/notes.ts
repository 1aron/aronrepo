import { findCommitRule, releaseGroups } from './commits'
import type { CommitDecision } from './policy'

export interface ReleaseNotesOptions {
    version: string
    /** Tag of the previous release, for the compare link. */
    previousTag?: string
    /** Release date as `YYYY-MM-DD`, shown in the heading. */
    date?: string
    /** Repository URL, such as `https://github.com/owner/repo`, for links. */
    repositoryUrl?: string
    /**
     * Starts the notes with a `## <version> (<date>)` heading, for a changelog
     * file. A GitHub release shows its tag and date itself, so its body leaves
     * the heading out and ends with a full changelog link instead.
     */
    heading?: boolean
    commits: CommitDecision[]
}

const breakingTitle = '⚠ Breaking Changes'

function groupOf(decision: CommitDecision) {
    return findCommitRule(decision.type, decision.scope)?.group
}

/** Keeps `<` outside code spans from turning into HTML, such as `Array<string>` on GitHub. */
function escapeMarkdown(text: string) {
    return text.split(/(`[^`]*`)/).map((part, index) => index % 2 ? part : part.replace(/</g, '&lt;')).join('')
}

function formatEntry(decision: CommitDecision, repositoryUrl?: string) {
    const summary = escapeMarkdown(decision.subject ?? decision.header)
    const scope = decision.scope ? `**${escapeMarkdown(decision.scope)}:** ` : ''
    const hash = decision.hash ? decision.hash.slice(0, 7) : undefined
    const link = hash
        ? repositoryUrl ? ` ([${hash}](${repositoryUrl}/commit/${decision.hash}))` : ` (${hash})`
        : ''
    return `- ${scope}${summary}${link}`
}

/** The page that lists every change of a release: the compare view, or the commits of a first release. */
export function getChangelogUrl(repositoryUrl: string, version: string, previousTag?: string) {
    const tag = `v${version}`
    return previousTag ? `${repositoryUrl}/compare/${previousTag}...${tag}` : `${repositoryUrl}/commits/${tag}`
}

/**
 * Markdown release notes. Only commits that release appear, grouped by type in
 * the order of the commit table; `BREAKING CHANGE:` footers of major releases
 * come first.
 */
export function renderReleaseNotes(options: ReleaseNotesOptions) {
    const { version, previousTag, repositoryUrl } = options
    const changelogUrl = repositoryUrl ? getChangelogUrl(repositoryUrl, version, previousTag) : undefined
    const sections: string[][] = []

    const released = options.commits.filter(({ release }) => release)
    const breaking = released
        .filter(({ release }) => release === 'major')
        .flatMap(({ breakingNotes }) => breakingNotes ?? [])
    if (breaking.length) {
        sections.push([`### ${breakingTitle}`, '', ...breaking.map((note) => `- ${escapeMarkdown(note)}`)])
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
        sections.push([`### ${group}`, '', ...sorted.map((decision) => formatEntry(decision, repositoryUrl))])
    }

    if (!sections.length) {
        sections.push([released.length ? 'Version bump only; no other changes to published packages.' : 'No changes to published packages.'])
    }

    if (options.heading) {
        const title = previousTag && changelogUrl ? `[${version}](${changelogUrl})` : version
        sections.unshift([`## ${title}${options.date ? ` (${options.date})` : ''}`])
    } else if (changelogUrl) {
        sections.push([`**Full Changelog**: ${changelogUrl}`])
    }
    return `${sections.map((section) => section.join('\n')).join('\n\n')}\n`
}

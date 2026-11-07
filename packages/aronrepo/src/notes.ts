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

/** Splits text into plain parts and CommonMark code spans: a backtick run closed by a run of the same length. */
function splitCodeSpans(text: string) {
    const parts: Array<{ code: boolean, text: string }> = []
    let plain = ''
    let index = 0
    while (index < text.length) {
        if (text[index] === '\\' && text[index + 1] === '`') {
            plain += text.slice(index, index + 2)
            index += 2
            continue
        }
        if (text[index] !== '`') {
            plain += text[index++]
            continue
        }
        const run = /^`+/.exec(text.slice(index))![0]
        const close = new RegExp(`(?<!\`)${run}(?!\`)`).exec(text.slice(index + run.length))
        if (!close) {
            plain += run
            index += run.length
            continue
        }
        if (plain) parts.push({ code: false, text: plain })
        plain = ''
        const end = index + run.length + close.index + run.length
        parts.push({ code: true, text: text.slice(index, end) })
        index = end
    }
    if (plain) parts.push({ code: false, text: plain })
    return parts
}

/**
 * Keeps commit text from acting on GitHub outside code spans: `<` would start
 * HTML, as in `Array<string>`, and `@name` or `@scope/pkg` would notify a user
 * or team on every release.
 */
function escapeMarkdown(text: string) {
    return splitCodeSpans(text).map(({ code, text: part }) => code
        ? part
        : part
            .replace(/</g, '&lt;')
            .replace(/(^|[^\w`])(@[A-Za-z0-9][\w-]*(?:\/[\w.-]+)?)/g, '$1`$2`')).join('')
}

/** A list item; continuation lines are indented so they stay in the item. */
function listItem(text: string) {
    return `- ${text.split('\n').map((line, index) => index && line ? `  ${line}` : line).join('\n')}`
}

function formatEntry(decision: CommitDecision, repositoryUrl?: string) {
    // Lowercase summaries are valid; the notes start every entry with a capital.
    const subject = decision.subject ?? decision.header
    const summary = escapeMarkdown(subject.replace(/^\p{Ll}/u, (letter) => letter.toUpperCase()))
    const scope = decision.scope ? `**${escapeMarkdown(decision.scope)}:** ` : ''
    const hash = decision.hash ? decision.hash.slice(0, 7) : undefined
    const link = hash
        ? repositoryUrl ? ` ([${hash}](${repositoryUrl}/commit/${decision.hash}))` : ` (${hash})`
        : ''
    return `- ${scope}${summary}${link}`
}

/** The page that lists every change of a release: the compare view, or the commits of a first release. */
export function getChangelogUrl(repositoryUrl: string, version: string, previousTag?: string) {
    const base = repositoryUrl.replace(/\/+$/, '')
    const tag = `v${version.replace(/^v/, '')}`
    return previousTag ? `${base}/compare/${previousTag}...${tag}` : `${base}/commits/${tag}`
}

/**
 * Markdown release notes. Only commits that release appear, grouped by type in
 * the order of the commit table; `BREAKING CHANGE:` footers of major releases
 * come first.
 */
export function renderReleaseNotes(options: ReleaseNotesOptions) {
    const { previousTag } = options
    const version = options.version.replace(/^v/, '')
    const repositoryUrl = options.repositoryUrl?.replace(/\/+$/, '')
    const changelogUrl = repositoryUrl ? getChangelogUrl(repositoryUrl, version, previousTag) : undefined
    const sections: string[][] = []

    const released = options.commits.filter(({ release }) => release)
    // A `Type!:` header without a footer describes the break with its summary.
    const breaking = released
        .filter(({ release }) => release === 'major')
        .flatMap(({ breakingNotes, breaking: marker, subject }) =>
            breakingNotes?.length ? breakingNotes : marker === 'header' && subject ? [subject] : [])
    if (breaking.length) {
        sections.push([`### ${breakingTitle}`, '', ...breaking.map((note) => listItem(escapeMarkdown(note)))])
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
        const title = changelogUrl ? `[${version}](${changelogUrl})` : version
        sections.unshift([`## ${title}${options.date ? ` (${options.date})` : ''}`])
    } else if (changelogUrl) {
        sections.push([`**Full Changelog**: ${changelogUrl}`])
    }
    return `${sections.map((section) => section.join('\n')).join('\n\n')}\n`
}

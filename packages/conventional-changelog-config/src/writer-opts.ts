import { commits, findCommitRule } from '@aronrepo/conventional-commits'

interface ChangelogCommit {
    type?: string
    scope?: string
    header?: string
    hash?: string
    shortHash?: string
    subject?: string
    revert?: unknown
    references?: unknown[]
}

const groupOrder = commits
    .map(({ group }) => group)
    .filter(Boolean)
    .reverse()

const writerOpts = {
    transform(commit: ChangelogCommit) {
        const rule = findCommitRule(commit.type, commit.scope)
        let type: string | undefined

        if (commit.type === 'Revert' || commit.revert) {
            type = commits.find(({ type }) => type === 'Revert')?.group
        } else if (rule?.group && !rule.hidden) {
            type = rule.group
        } else {
            return undefined
        }

        return {
            type,
            ...(commit.header
                ? {
                    header: commit.header
                        .replace(/->/g, '→')
                        .replace(/<-/g, '←')
                }
                : {}),
            ...(commit.scope === '*' ? { scope: '' } : {}),
            ...(typeof commit.hash === 'string' ? { shortHash: commit.hash.substring(0, 7) } : {}),
            references: commit.references ?? []
        }
    },
    groupBy: 'type',
    commitGroupsSort(a: { title: string }, b: { title: string }) {
        return groupOrder.indexOf(b.title) - groupOrder.indexOf(a.title)
    },
    commitsSort: ['scope', 'subject'],
    noteGroupsSort: 'title',
    notesSort: 'text'
}

export default writerOpts

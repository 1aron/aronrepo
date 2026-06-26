import { commits } from '@aronrepo/conventional-commits'

const groupOrder = commits
    .map(({ group }) => group)
    .filter(Boolean)
    .reverse()

const writerOpts = {
    transform(commit: { type?: string, scope?: string, header?: string, hash?: string, shortHash?: string, subject?: string, revert?: unknown, references?: unknown[] }) {
        if (commit.header) {
            commit.header = commit.header
                .replace(/->/g, '→')
                .replace(/<-/g, '←')
        }

        const rule = commits.find(({ type }) => type === commit.type)
        if (commit.type === 'Revert' || commit.revert) {
            commit.type = commits.find(({ type }) => type === 'Revert')?.group
        } else if (rule?.group && !rule.hidden) {
            commit.type = rule.group
        } else {
            return undefined
        }

        if (commit.scope === '*') commit.scope = ''
        if (typeof commit.hash === 'string') commit.shortHash = commit.hash.substring(0, 7)
        commit.references = commit.references ?? []
        return commit
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

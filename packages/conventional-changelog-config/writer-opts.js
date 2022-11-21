const compareFunc = require('compare-func')
const mainTemplate = require('./templates/template')
const footerPartial = require('./templates/footer')
const commitPartial = require('./templates/commit')
const conventionalCommits = require('aron-conventional-commits')

module.exports = {
    transform: (commit, context) => {
        console.log(commit)
        const issues = []
        const conventionalCommit = conventionalCommits.find(({ type }) => commit.type === type)
        if (commit.type === 'Revert' || commit.revert) {
            commit.type = conventionalCommits.find(({ type }) => type === 'Revert').group
            /**
             * From    Revert: "Feat(Scope): First feature"
             * To      Revert: `Feat(Scope): First feature`
             */
            commit.header = commit.header.replace(/(Revert|Revert:)\s"([\s\S]+?)"(.*)/, '$1 `$2`$3')
        } else if (conventionalCommit && !conventionalCommit.hidden && conventionalCommit.group) {
            commit.type = conventionalCommit.group
        } else {
            return
        }

        if (commit.scope === '*') {
            commit.scope = ''
        }

        if (typeof commit.hash === 'string') {
            commit.shortHash = commit.hash.substring(0, 7)
        }

        if (typeof commit.subject === 'string') {
            let url = context.repository
                ? `${context.host}/${context.owner}/${context.repository}`
                : context.repoUrl
            if (url) {
                url = `${url}/issues/`
                // Issue URLs.
                commit.subject = commit.subject.replace(/#([0-9]+)/g, (_, issue) => {
                    issues.push(issue)
                    return `[#${issue}](${url}${issue})`
                })
            }
            if (context.host) {
                // User URLs.
                commit.subject = commit.subject.replace(/\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g, (_, username) => {
                    if (username.includes('/')) {
                        return `@${username}`
                    }

                    return `[@${username}](${context.host}/${username})`
                })
            }
        }

        // remove references that already appear in the subject
        commit.references = commit.references.filter(reference => {
            if (issues.indexOf(reference.issue) === -1) {
                return true
            }

            return false
        })

        return commit
    },
    groupBy: 'type',
    commitGroupsSort: (a, b) => {
        const commitGroupOrder = conventionalCommits
            .map(({ group }) => group)
            .reverse()
        const gRankA = commitGroupOrder.indexOf(a.title)
        const gRankB = commitGroupOrder.indexOf(b.title)
        if (gRankA >= gRankB) {
            return -1
        } else {
            return 1
        }
    },
    commitsSort: ['scope', 'subject'],
    noteGroupsSort: 'title',
    notesSort: compareFunc,
    mainTemplate,
    commitPartial,
    headerPartial: '',
    footerPartial
}

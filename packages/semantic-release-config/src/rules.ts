import { commits } from '@aronrepo/conventional-commits'

const releaseRules = [
    { breaking: true, release: 'major' },
    { revert: true, release: 'patch' },
    ...commits.map(({ group: _group, hidden: _hidden, ...rule }) => rule)
]

export default releaseRules

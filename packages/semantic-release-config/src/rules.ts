import { commits } from '@aronrepo/conventional-commits'

const releaseRules = [
    { breaking: true, release: 'major' },
    { revert: true, release: 'patch' },
    ...commits.map(({ type, scope, release }) => ({
        type,
        ...(scope ? { scope } : {}),
        release
    }))
]

export default releaseRules

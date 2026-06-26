import { parserOpts, writerOpts } from '@aronrepo/conventional-changelog-config'
import releaseRules from './rules'

const config = {
    branches: [
        '+([0-9])?(.{+([0-9]),x}).x',
        'main',
        'next',
        'next-major',
        { name: 'alpha', prerelease: true },
        { name: 'beta', prerelease: true },
        { name: 'rc', prerelease: true },
        { name: 'canary', prerelease: true }
    ],
    plugins: {
        '@semantic-release/commit-analyzer': { parserOpts, releaseRules },
        '@semantic-release/release-notes-generator': { parserOpts, writerOpts },
        '@semantic-release/github': true
    }
}

export default config

import { parserOpts, writerOpts } from '@aronrepo/conventional-changelog-config'

type SemanticReleasePluginMap = Record<string, boolean | Record<string, unknown>>

export const analyzerPlugin = '@aronrepo/semantic-release-config/analyzer'

const plugins: SemanticReleasePluginMap = {
    [analyzerPlugin]: true,
    '@semantic-release/release-notes-generator': { parserOpts, writerOpts },
    '@semantic-release/github': true
}

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
    plugins
}

export default config

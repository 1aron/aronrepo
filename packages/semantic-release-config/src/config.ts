import { releaseRules } from './rules'

const plugins = [
    ['@semantic-release/commit-analyzer', { preset: 'aron', releaseRules }],
    ['@semantic-release/release-notes-generator', { preset: 'aron' }],
    ['@semantic-release/exec', {
        prepareCmd: 'npm run check && npm run build',
        publishCmd: 'npm version ${nextRelease.version} --workspaces && npm publish --workspaces --access public'
    }],
    '@semantic-release/github'
]

const branches = [
    '+([0-9])?(.{+([0-9]),x}).x',
    'main',
    'next',
    'next-major',
    {
        name: 'beta',
        prerelease: true
    },
    {
        name: 'alpha',
        prerelease: true
    }
]

export {
    plugins,
    branches
}
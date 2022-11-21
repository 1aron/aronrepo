const releaseRules = require('./rules')

module.exports = ({
    preset = 'aron',
    assets = [],
    scripts = {
        prepare: 'npm run check && npm run build',
        publish: 'aron version ${nextRelease.version} && npm publish --workspaces --access public'
    },
    branches = [
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
} = {}) => {
    return {
        plugins: [
            ['@semantic-release/commit-analyzer', { preset, releaseRules }],
            ['@semantic-release/release-notes-generator', { preset }],
            ['@semantic-release/exec', {
                prepareCmd: scripts.prepare,
                publishCmd: scripts.publish
            }],
            ['@semantic-release/github', { assets }]
        ],
        branches
    }
}
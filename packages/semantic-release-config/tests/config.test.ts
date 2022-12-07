import configure from '../configure'
import releaseRules from '../rules'

test('Customize config and extend default', () => {
    expect(configure()).toEqual({
        branches: [
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
        ],
        plugins: [
            ['@semantic-release/commit-analyzer', { preset: 'aron', releaseRules }],
            ['@semantic-release/release-notes-generator', { preset: 'aron' }],
            ['@semantic-release/exec', {
                prepareCmd: 'npm run check && npm run build',
                publishCmd: 'aron version ${nextRelease.version} && npm publish --workspaces --access public'
            }],
            '@semantic-release/github'
        ]
    })
})

test('Disable the @semantic-release/github plugin', () => {
    expect(configure({
        plugins: {
            '@semantic-release/github': false
        }
    })).toEqual({
        branches: [
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
        ],
        plugins: [
            ['@semantic-release/commit-analyzer', { preset: 'aron', releaseRules }],
            ['@semantic-release/release-notes-generator', { preset: 'aron' }],
            ['@semantic-release/exec', {
                prepareCmd: 'npm run check && npm run build',
                publishCmd: 'aron version ${nextRelease.version} && npm publish --workspaces --access public'
            }]
        ]
    })
})
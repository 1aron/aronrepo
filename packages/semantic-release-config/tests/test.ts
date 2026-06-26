import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import configure from '../src/configure'
import releaseRules from '../src/rules'

test('exports commit analyzer release rules without conventional commit metadata', () => {
    const docsReadmeRule = releaseRules.find((rule) =>
        'type' in rule
        && rule.type === 'Docs'
        && 'scope' in rule
        && rule.scope === 'README'
    )

    expect(docsReadmeRule).toEqual({
        type: 'Docs',
        scope: 'README',
        release: 'patch'
    })

    for (const rule of releaseRules) {
        expect(rule).not.toHaveProperty('group')
        expect(rule).not.toHaveProperty('hidden')
        expect(rule).not.toHaveProperty('defaultInternalCommit')
        expect(rule).not.toHaveProperty('examples')
    }
})

test('creates default semantic-release config', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-release-'))
    const previous = process.cwd()
    fs.outputJsonSync(path.join(cwd, 'package.json'), { private: true, workspaces: ['packages/*'] })
    fs.outputJsonSync(path.join(cwd, 'packages/public/package.json'), {
        name: '@fixture/public',
        version: '0.0.0',
        publishConfig: { access: 'public' }
    })
    process.chdir(cwd)
    try {
        const releaseConfig = configure()
        const pluginNames = releaseConfig.plugins.map((plugin) => Array.isArray(plugin) ? plugin[0] : plugin)

        expect(releaseConfig).toMatchObject({
            plugins: expect.arrayContaining([
                ['@semantic-release/commit-analyzer', expect.objectContaining({ releaseRules })],
                ['@aronrepo/semantic-release-pnpm', { pkgRoot: 'packages/public' }]
            ])
        })
        expect(pluginNames).not.toContain('@semantic-release/npm')
        expect(pluginNames).not.toContain('@semantic-release/exec')
    } finally {
        process.chdir(previous)
    }
})

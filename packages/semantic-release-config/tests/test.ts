import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import configure from '../src/configure'
import releaseRules from '../src/rules'

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
        expect(configure()).toMatchObject({
            plugins: expect.arrayContaining([
                ['@semantic-release/commit-analyzer', expect.objectContaining({ releaseRules })],
                ['@semantic-release/npm', { pkgRoot: 'packages/public' }]
            ])
        })
    } finally {
        process.chdir(previous)
    }
})

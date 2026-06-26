import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import { resolveWorkspaceVersion, versionWorkspace } from '../src'

function createFixture() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-version-'))
    fs.outputJsonSync(path.join(cwd, 'package.json'), { private: true, workspaces: ['packages/*'] })
    fs.outputJsonSync(path.join(cwd, 'packages/a/package.json'), {
        name: '@fixture/a',
        version: '0.0.0',
        dependencies: {
            '@fixture/b': 'workspace:^'
        }
    })
    fs.outputJsonSync(path.join(cwd, 'packages/b/package.json'), {
        name: '@fixture/b',
        version: '0.0.0'
    })
    return cwd
}

test('resolves workspace ranges', () => {
    expect(resolveWorkspaceVersion('workspace:^', '1.2.3')).toBe('workspace:^1.2.3')
    expect(resolveWorkspaceVersion('', '1.2.3')).toBe('^1.2.3')
})

test('updates workspace package versions and internal dependency ranges', async () => {
    const cwd = createFixture()
    await versionWorkspace('1.2.3', { cwd })
    expect(fs.readJsonSync(path.join(cwd, 'packages/a/package.json'))).toMatchObject({
        version: '1.2.3',
        dependencies: {
            '@fixture/b': 'workspace:^1.2.3'
        }
    })
    expect(fs.readJsonSync(path.join(cwd, 'packages/b/package.json')).version).toBe('1.2.3')
})

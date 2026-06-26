import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import { explorePackageManager, queryWorkspaces, readPNPMWorkspaces, readWorkspacePackages, readWorkspaces } from '../src'

function createFixture() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-npm-'))
    fs.outputJsonSync(path.join(cwd, 'package.json'), {
        private: true,
        workspaces: ['packages/*']
    })
    fs.outputFileSync(path.join(cwd, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
    fs.outputJsonSync(path.join(cwd, 'packages/a/package.json'), { name: '@fixture/a', private: true })
    fs.outputJsonSync(path.join(cwd, 'packages/b/package.json'), { name: '@fixture/b', private: true })
    fs.outputJsonSync(path.join(cwd, 'packages/b/node_modules/ignored/package.json'), { name: 'ignored' })
    return cwd
}

test('reads npm and pnpm workspaces', () => {
    const cwd = createFixture()
    expect(readWorkspaces({ cwd })).toEqual(['packages/*'])
    expect(readPNPMWorkspaces({ cwd })).toEqual(['packages/*'])
    expect(explorePackageManager({ cwd })).toBe('pnpm')
})

test('queries workspace package directories', () => {
    const cwd = createFixture()
    expect(queryWorkspaces(undefined, { cwd })).toEqual(['packages/a', 'packages/b'])
})

test('reads workspace packages', () => {
    const cwd = createFixture()
    expect(readWorkspacePackages(undefined, { cwd }).map(({ name }) => name)).toEqual(['@fixture/a', '@fixture/b'])
})

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    detectPackageManager,
    explainRange,
    getProjectCliCommand,
    getRangeCommits,
    loadProjectPolicy,
    resolveReleasePaths
} from '../src/node'

function write(cwd: string, file: string, content: string) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true })
    fs.writeFileSync(path.join(cwd, file), content)
}

function git(cwd: string, ...args: string[]) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

function commit(cwd: string, message: string, files: Record<string, string>) {
    for (const [file, content] of Object.entries(files)) write(cwd, file, content)
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '--allow-empty', '-q', '-m', message)
}

function createRepo(config?: string) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-policy-'))
    git(cwd, 'init', '-q', '-b', 'main')
    git(cwd, 'config', 'user.email', 'fixture@example.com')
    git(cwd, 'config', 'user.name', 'Fixture')
    git(cwd, 'config', 'commit.gpgsign', 'false')
    write(cwd, 'package.json', JSON.stringify({ private: true, type: 'module' }))
    write(cwd, 'pnpm-workspace.yaml', 'packages:\n  - packages/*\n  - site\n')
    write(cwd, 'packages/core/package.json', JSON.stringify({ name: '@fixture/core', publishConfig: { access: 'public' } }))
    write(cwd, 'site/package.json', JSON.stringify({ name: 'site', private: true }))
    if (config) write(cwd, 'aronrepo.config.js', config)
    commit(cwd, 'Chore: Initialize fixture', {})
    git(cwd, 'tag', 'v1.0.0')
    return cwd
}

test('derives release paths from public workspace packages', () => {
    const cwd = createRepo()
    expect(resolveReleasePaths(cwd)).toMatchObject({ include: ['packages/core/**'] })
    expect(resolveReleasePaths(cwd, { paths: false })).toBeUndefined()
    expect(resolveReleasePaths(cwd, { paths: { include: ['lib/**'] } })).toMatchObject({ include: ['lib/**'] })
})

test('uses every path for a published single-package repository', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-single-'))
    write(cwd, 'package.json', JSON.stringify({ name: 'single' }))
    expect(resolveReleasePaths(cwd)).toMatchObject({ include: ['**'] })
})

test('loads the release mode from aronrepo.config.js', async () => {
    const cwd = createRepo("export default { release: { mode: 'auto' } }\n")
    const project = await loadProjectPolicy(cwd)
    expect(project.policy.mode).toBe('auto')
    expect(project.configFile).toMatch(/aronrepo\.config\.js$/)
    expect(project.isReleasePath?.('packages/core/src/index.ts')).toBe(true)
    expect(project.isReleasePath?.('site/index.ts')).toBe(false)
})

test('explains a commit range with changed files', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Site): Repair the header', { 'site/index.ts': 'export {}' })
    commit(cwd, 'Improve(Core): Rename the mode\n\nBREAKING CHANGE: Rename the mode option.', { 'packages/core/index.js': 'export {}' })
    commit(cwd, 'Feat(Core): Add a builder', { 'packages/core/builder.js': 'export {}' })

    expect(getRangeCommits(cwd, 'v1.0.0').map(({ files }) => files)).toEqual([
        ['site/index.ts'],
        ['packages/core/index.js'],
        ['packages/core/builder.js']
    ])

    const explicit = await explainRange(cwd, 'v1.0.0')
    expect(explicit.release).toBe('patch')
    expect(explicit.commits.map(({ release }) => release)).toEqual([false, 'patch', 'patch'])

    const auto = await explainRange(cwd, 'v1.0.0', 'HEAD', { mode: 'auto' })
    expect(auto.release).toBe('major')
})

test('detects the package manager and how to run the CLI', () => {
    const cwd = createRepo()
    expect(detectPackageManager(cwd)).toBe('pnpm')
    expect(getProjectCliCommand(cwd)).toBe('pnpm exec aronrepo')

    write(cwd, 'package.json', JSON.stringify({ private: true, packageManager: 'bun@1.4.4', scripts: { aronrepo: 'node cli.js' } }))
    expect(detectPackageManager(cwd)).toBe('bun')
    expect(getProjectCliCommand(cwd)).toBe('bun run aronrepo')

    fs.rmSync(path.join(cwd, 'pnpm-workspace.yaml'))
    write(cwd, 'package.json', JSON.stringify({ private: true }))
    expect(getProjectCliCommand(cwd)).toBe('npx aronrepo')
})

test('lists non-ASCII paths unquoted and both sides of a rename', () => {
    const cwd = createRepo()
    git(cwd, 'config', 'core.quotePath', 'true')
    commit(cwd, 'Docs: Add a note', { 'packages/core/文件.md': '# 文件\n' })
    git(cwd, 'mv', 'packages/core/文件.md', 'site/文件.md')
    git(cwd, 'commit', '-q', '-m', 'Chore: Move the note')

    expect(getRangeCommits(cwd, 'v1.0.0').map(({ files }) => files.sort())).toEqual([
        ['packages/core/文件.md'],
        ['packages/core/文件.md', 'site/文件.md']
    ])
})

test('does not treat private packages as published', () => {
    const cwd = createRepo()
    write(cwd, 'packages/internal/package.json', JSON.stringify({ name: '@fixture/internal', private: true, publishConfig: { access: 'public' } }))
    expect(resolveReleasePaths(cwd)).toMatchObject({ include: ['packages/core/**'] })
})

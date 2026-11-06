import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import { execFileSync } from 'node:child_process'
import { analyzeCommits } from '../src/analyzer'
import configure from '../src/configure'
import releaseRules, { createReleaseRules } from '../src/rules'

test('exports commit analyzer release rules without conventional commit metadata', () => {
    const docsReadmeRule = releaseRules.find((rule) =>
        'type' in rule
        && rule.type === 'Docs'
        && 'scope' in rule
        && rule.scope === 'README'
    )
    const benchmarkRule = releaseRules.find((rule) =>
        'type' in rule
        && rule.type === 'Benchmark'
    )
    const nonReleaseMaintenanceRules = ['Benchmark', 'Build', 'CI', 'Style'].map((type) =>
        releaseRules.find((rule) => 'type' in rule && rule.type === type)
    )

    expect(docsReadmeRule).toEqual({
        type: 'Docs',
        scope: 'README',
        release: 'patch'
    })
    expect(benchmarkRule).toEqual({ type: 'Benchmark', release: false })
    expect(nonReleaseMaintenanceRules).toEqual([
        { type: 'Benchmark', release: false },
        { type: 'Build', release: false },
        { type: 'CI', release: false },
        { type: 'Style', release: false }
    ])

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
                '@aronrepo/semantic-release-config/analyzer',
                ['@aronrepo/semantic-release-pnpm', { pkgRoot: 'packages/public' }]
            ])
        })
        expect(pluginNames[0]).toBe('@aronrepo/semantic-release-config/analyzer')
        expect(pluginNames).not.toContain('@semantic-release/commit-analyzer')
        expect(pluginNames).not.toContain('@semantic-release/npm')
        expect(pluginNames).not.toContain('@semantic-release/exec')
    } finally {
        process.chdir(previous)
    }
})

test('refuses a second commit analyzer that would bypass the release policy', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-release-'))
    const previous = process.cwd()
    fs.outputJsonSync(path.join(cwd, 'package.json'), { private: true })
    process.chdir(cwd)
    try {
        expect(() => configure({ plugins: { '@semantic-release/commit-analyzer': true } }))
            .toThrow(/Remove @semantic-release\/commit-analyzer/)
        expect(() => configure({ plugins: ['@semantic-release/commit-analyzer'] }))
            .toThrow(/bypass the release policy/)
    } finally {
        process.chdir(previous)
    }
})

test('deprecated release rules follow the policy mode', () => {
    expect(releaseRules).not.toContainEqual({ breaking: true, release: 'major' })
    expect(releaseRules).toContainEqual({ type: 'Feat', release: 'patch' })
    expect(createReleaseRules({ mode: 'auto' })).toContainEqual({ breaking: true, release: 'major' })
    expect(createReleaseRules({ mode: 'auto' })).toContainEqual({ type: 'Feat', release: 'minor' })
})

function git(cwd: string, ...args: string[]) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function createReleaseRepo(config?: string) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-analyzer-'))
    git(cwd, 'init', '-q', '-b', 'main')
    git(cwd, 'config', 'user.email', 'fixture@example.com')
    git(cwd, 'config', 'user.name', 'Fixture')
    git(cwd, 'config', 'commit.gpgsign', 'false')
    fs.outputJsonSync(path.join(cwd, 'package.json'), { private: true, type: 'module', workspaces: ['packages/*', 'site'] })
    fs.outputJsonSync(path.join(cwd, 'packages/core/package.json'), { name: '@fixture/core', publishConfig: { access: 'public' } })
    fs.outputJsonSync(path.join(cwd, 'site/package.json'), { name: 'site', private: true })
    if (config) fs.outputFileSync(path.join(cwd, 'aronrepo.config.js'), config)
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '-q', '-m', 'Chore: Initialize fixture')
    return cwd
}

function commitFile(cwd: string, file: string, message: string) {
    fs.outputFileSync(path.join(cwd, file), `export const value = ${JSON.stringify(message)}\n`)
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '-q', '-m', message)
    return { hash: git(cwd, 'rev-parse', 'HEAD'), message }
}

function createLogger() {
    const lines: string[] = []
    return { lines, logger: { log: (...args: unknown[]) => lines.push(args.join(' ')) } }
}

test('analyzer replays the 2.0.1 incident as a patch release in explicit mode', async () => {
    const cwd = createReleaseRepo()
    const commits = [
        commitFile(cwd, 'packages/core/index.js', 'Update(Integrations): Rename pre-render mode to prerender\n\nBREAKING CHANGE: Use prerender instead of pre-render.'),
        commitFile(cwd, 'packages/core/feature.js', 'Feat(Core): Add a builder'),
        commitFile(cwd, 'site/index.js', 'Fix(Site): Repair the header')
    ]
    const { lines, logger } = createLogger()

    await expect(analyzeCommits({}, { cwd, commits, logger })).resolves.toBe('patch')
    expect(lines.join('\n')).toMatch(/explicit mode/)
    expect(lines.join('\n')).toMatch(/BREAKING CHANGE:` footer is ignored/)
    expect(lines.join('\n')).toMatch(/none ← Fix\(Site\): Repair the header/)
})

test('analyzer reads auto mode from aronrepo.config.js', async () => {
    const cwd = createReleaseRepo("export default { release: { mode: 'auto' } }\n")
    const commits = [commitFile(cwd, 'packages/core/feature.js', 'Feat(Core): Add a builder')]
    const { logger } = createLogger()

    await expect(analyzeCommits({}, { cwd, commits, logger })).resolves.toBe('minor')
    await expect(analyzeCommits({ mode: 'explicit' }, { cwd, commits, logger })).resolves.toBe('patch')
})

test('analyzer returns null when only unpublished paths changed', async () => {
    const cwd = createReleaseRepo()
    const commits = [
        commitFile(cwd, 'site/index.js', 'Perf(Site): Speed up the homepage'),
        { hash: undefined, message: 'Merge branch next\n\nBREAKING CHANGE: anything' }
    ]
    const { logger } = createLogger()

    await expect(analyzeCommits({}, { cwd, commits, logger })).resolves.toBeNull()
})

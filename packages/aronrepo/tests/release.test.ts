import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    getReleasePackages,
    officialRegistry,
    planRelease,
    readPackedManifest,
    runCommand,
    runRelease,
    stagingDistTag,
    type Fetch,
    type Runner
} from '../src/node'

function write(cwd: string, file: string, content: string) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true })
    fs.writeFileSync(path.join(cwd, file), content)
}

function git(cwd: string, ...args: string[]) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function commit(cwd: string, message: string, files: Record<string, string> = {}) {
    for (const [file, content] of Object.entries(files)) write(cwd, file, content)
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '--allow-empty', '-q', '-m', message)
    return git(cwd, 'rev-parse', 'HEAD')
}

function createRepo() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-release-'))
    git(cwd, 'init', '-q', '-b', 'main')
    git(cwd, 'config', 'user.email', 'fixture@example.com')
    git(cwd, 'config', 'user.name', 'Fixture')
    git(cwd, 'config', 'commit.gpgsign', 'false')
    git(cwd, 'config', 'tag.gpgsign', 'false')
    write(cwd, 'package.json', JSON.stringify({
        private: true,
        type: 'module',
        workspaces: ['packages/*'],
        repository: { type: 'git', url: 'https://github.com/fixture/repo.git' }
    }, null, 4))
    write(cwd, '.gitignore', 'node_modules\n')
    write(cwd, 'aronrepo.config.js', "export default { release: { mode: 'explicit' } }\n")
    write(cwd, 'packages/core/package.json', JSON.stringify({
        name: '@fixture/core',
        version: '0.0.0',
        files: ['index.js'],
        publishConfig: { access: 'public', provenance: true }
    }, null, 4))
    write(cwd, 'packages/core/index.js', 'export const core = 1\n')
    write(cwd, 'packages/cli/package.json', JSON.stringify({
        name: '@fixture/cli',
        version: '0.0.0',
        files: ['index.js'],
        dependencies: { '@fixture/core': '^0.0.0' },
        publishConfig: { access: 'public' }
    }, null, 4))
    write(cwd, 'packages/cli/index.js', 'export const cli = 1\n')
    write(cwd, 'site/package.json', JSON.stringify({ name: 'site', private: true }))
    commit(cwd, 'Chore: Initialize fixture')
    git(cwd, 'tag', 'v1.0.0')
    return cwd
}

interface FakeRegistry {
    packuments: Map<string, { 'dist-tags': Record<string, string>, versions: Record<string, { gitHead?: string, dist?: { attestations?: unknown } }> }>
    commands: string[][]
    /** Manifests of published tarballs, which the release deletes afterwards. */
    published: Array<{ args: string[], manifest: ReturnType<typeof readPackedManifest> }>
    releases: Array<Record<string, unknown>>
    run: Runner
    fetch: Fetch
}

function createRegistry(): FakeRegistry {
    const packuments: FakeRegistry['packuments'] = new Map()
    const commands: string[][] = []
    const published: FakeRegistry['published'] = []
    const releases: Array<Record<string, unknown>> = []
    const run: Runner = async (command, args, options) => {
        commands.push([command, ...args])
        if (command === 'npm' && args[0] === 'publish') {
            const manifest = readPackedManifest(args[1])
            published.push({ args, manifest })
            const name = manifest.name!
            const packument = packuments.get(name) ?? { 'dist-tags': {}, versions: {} }
            packument.versions[manifest.version!] = {
                gitHead: manifest.gitHead as string,
                ...(args.includes('--provenance') ? { dist: { attestations: {} } } : {})
            }
            packument['dist-tags'][args[args.indexOf('--tag') + 1]] = manifest.version!
            packuments.set(name, packument)
            return { stdout: '', stderr: '' }
        }
        if (command === 'npm' && args[0] === 'dist-tag') {
            if (args[1] === 'add') {
                const [name, version] = [args[2].slice(0, args[2].lastIndexOf('@')), args[2].slice(args[2].lastIndexOf('@') + 1)]
                packuments.get(name)!['dist-tags'][args[3]] = version
            } else {
                delete packuments.get(args[2])!['dist-tags'][args[3]]
            }
            return { stdout: '', stderr: '' }
        }
        if (command === 'git' && args[0] === 'push') return { stdout: '', stderr: '' }
        return runCommand(command, args, options)
    }
    const fetch: Fetch = async (input, init) => {
        if (input.startsWith(officialRegistry)) {
            const name = decodeURIComponent(input.slice(officialRegistry.length)).replace('%2f', '/')
            const packument = packuments.get(name)
            return packument ? Response.json(structuredClone(packument)) : new Response('', { status: 404 })
        }
        if (input.startsWith('https://api.github.com/repos/fixture/repo/releases')) {
            if (init?.method === 'POST') {
                const body = JSON.parse(String(init.body)) as Record<string, unknown>
                releases.push(body)
                return Response.json({ html_url: `https://github.com/fixture/repo/releases/tag/${String(body.tag_name)}` }, { status: 201 })
            }
            const tag = decodeURIComponent(input.split('/tags/')[1] ?? '')
            const found = releases.find((release) => release.tag_name === tag)
            return found ? Response.json({ html_url: 'existing' }) : new Response('', { status: 404 })
        }
        throw new Error(`Unexpected fetch ${input}`)
    }
    return { packuments, commands, published, releases, run, fetch }
}

function environment(cwd: string, registry: FakeRegistry, logs: string[] = []) {
    const env: NodeJS.ProcessEnv = { ...process.env, NPM_TOKEN: 'npm-token', GITHUB_TOKEN: 'github-token', GITHUB_REPOSITORY: 'fixture/repo', NPM_CONFIG_USERCONFIG: path.join(cwd, '.missing-npmrc') }
    for (const key of ['GITHUB_REF_NAME', 'ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'NPM_ID_TOKEN', 'GITHUB_SERVER_URL', 'GITHUB_API_URL', 'NPM_CONFIG_REGISTRY']) {
        delete env[key]
    }
    return { cwd, env, run: registry.run, fetch: registry.fetch, log: (message: string) => logs.push(message), wait: async () => {} }
}

test('orders published packages by their dependencies', () => {
    const cwd = createRepo()
    expect(getReleasePackages(cwd).map(({ name }) => name)).toEqual(['@fixture/core', '@fixture/cli'])
})

test('plans the next version, the range, and the notes', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    commit(cwd, 'Chore(Site): Tidy up', { 'site/index.js': 'export {}\n' })

    const plan = await planRelease({ branch: 'main', date: '2026-11-07' }, environment(cwd, createRegistry()))
    expect(plan).toMatchObject({ from: 'v1.0.0', release: 'patch', version: '1.0.1', tag: 'v1.0.1', channel: { distTag: 'latest' } })
    expect(plan.notes).toContain('## [1.0.1](https://github.com/fixture/repo/compare/v1.0.0...v1.0.1) (2026-11-07)')
    expect(plan.notes).toContain('- **Core:** Repair the cache')
    expect(plan.notes).not.toContain('Tidy up')

    expect(await planRelease({ branch: 'feature/x' }, environment(cwd, createRegistry()))).toMatchObject({ release: false })
    expect(await planRelease({ branch: 'feature/x', fallbackToMain: true }, environment(cwd, createRegistry()))).toMatchObject({ version: '1.0.1' })
})

test('dry run changes nothing', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    const logs: string[] = []

    const result = await runRelease({ branch: 'main', dryRun: true }, environment(cwd, registry, logs))
    expect(result.status).toBe('dry-run')
    expect(logs.join('\n')).toContain('Dry run: would publish v1.0.1 on latest.')
    expect(registry.commands.filter(([command]) => command !== 'git')).toEqual([])
    expect(git(cwd, 'tag', '--list', 'v1.0.1')).toBe('')
})

test('publishes on staging, promotes, tags, and creates the GitHub release', async () => {
    const cwd = createRepo()
    const head = commit(cwd, 'Bump(Major): Fixture v2\n\nBREAKING CHANGE: Rename the core export.', {})
    const registry = createRegistry()

    const result = await runRelease({ branch: 'main' }, environment(cwd, registry))
    expect(result.status).toBe('released')

    expect(registry.published.map(({ manifest }) => manifest.name)).toEqual(['@fixture/core', '@fixture/cli'])
    expect(registry.published[0].args).toEqual(expect.arrayContaining(['--tag', stagingDistTag, '--access', 'public', '--provenance']))
    expect(registry.published[1].args).not.toContain('--provenance')

    for (const name of ['@fixture/core', '@fixture/cli']) {
        const packument = registry.packuments.get(name)!
        expect(packument['dist-tags']).toEqual({ latest: '2.0.0' })
        expect(packument.versions['2.0.0'].gitHead).toBe(head)
    }
    expect(git(cwd, 'rev-parse', 'v2.0.0^{commit}')).toBe(head)
    expect(registry.releases).toEqual([expect.objectContaining({ tag_name: 'v2.0.0', prerelease: false, make_latest: 'true' })])
    expect(String(registry.releases[0].body)).toContain('- Rename the core export.')

    // Versions are not committed: the manifests are restored and the tree stays clean.
    expect(JSON.parse(fs.readFileSync(path.join(cwd, 'packages/core/package.json'), 'utf8')).version).toBe('0.0.0')
    expect(git(cwd, 'status', '--porcelain')).toBe('')
})

test('resolves workspace ranges in packed manifests', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    await runRelease({ branch: 'main' }, environment(cwd, registry))

    const cli = registry.published.find(({ manifest }) => manifest.name === '@fixture/cli')!
    expect(cli.manifest).toMatchObject({ version: '1.0.1', dependencies: { '@fixture/core': '^0.0.0' } })
})

test('resumes an interrupted release without publishing twice', async () => {
    const cwd = createRepo()
    const head = commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    registry.packuments.set('@fixture/core', { 'dist-tags': { latest: '1.0.0', [stagingDistTag]: '1.0.1' }, versions: { '1.0.1': { gitHead: head } } })

    await runRelease({ branch: 'main' }, environment(cwd, registry))
    expect(registry.published.map(({ manifest }) => manifest.name)).toEqual(['@fixture/cli'])
    expect(registry.packuments.get('@fixture/core')!['dist-tags']).toEqual({ latest: '1.0.1' })

    // A rerun after the tag was pushed only makes sure the GitHub release exists.
    registry.releases.length = 0
    const rerun = await runRelease({ branch: 'main' }, environment(cwd, registry))
    expect(rerun.status).toBe('resumed')
    expect(registry.releases).toEqual([expect.objectContaining({ tag_name: 'v1.0.1' })])
})

test('refuses a version published from another commit', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    registry.packuments.set('@fixture/core', { 'dist-tags': {}, versions: { '1.0.1': { gitHead: 'f'.repeat(40) } } })

    await expect(runRelease({ branch: 'main' }, environment(cwd, registry))).rejects.toThrow(/already published from f{40}/)
    expect(git(cwd, 'tag', '--list', 'v1.0.1')).toBe('')
})

test('publishes prereleases on their channel', async () => {
    const cwd = createRepo()
    git(cwd, 'checkout', '-q', '-b', 'beta')
    commit(cwd, 'Bump(Major): Fixture v2', {})
    const registry = createRegistry()

    const result = await runRelease({ branch: 'beta' }, environment(cwd, registry))
    expect(result.plan.version).toBe('2.0.0-beta.1')
    expect(registry.packuments.get('@fixture/core')!['dist-tags']).toEqual({ beta: '2.0.0-beta.1' })
    expect(registry.releases).toEqual([expect.objectContaining({ tag_name: 'v2.0.0-beta.1', prerelease: true, make_latest: 'false' })])
})

test('skips branches that do not release', async () => {
    const cwd = createRepo()
    const result = await runRelease({ branch: 'feature/x' }, environment(cwd, createRegistry()))
    expect(result.status).toBe('skipped')
})

const hasBun = (() => {
    try {
        execFileSync('bun', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' })
        return true
    } catch {
        return false
    }
})()

test.skipIf(!hasBun)('packs Bun workspaces with workspace ranges resolved to the release version', async () => {
    const cwd = createRepo()
    const root = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'))
    write(cwd, 'package.json', JSON.stringify({ ...root, packageManager: 'bun@1.4.4' }, null, 4))
    const cli = JSON.parse(fs.readFileSync(path.join(cwd, 'packages/cli/package.json'), 'utf8'))
    write(cwd, 'packages/cli/package.json', JSON.stringify({ ...cli, dependencies: { '@fixture/core': 'workspace:^' } }, null, 4))
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()

    await runRelease({ branch: 'main' }, environment(cwd, registry))
    const packed = registry.published.find(({ manifest }) => manifest.name === '@fixture/cli')!
    expect(packed.manifest.dependencies).toEqual({ '@fixture/core': '^1.0.1' })
})

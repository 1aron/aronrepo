import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    getRegistry,
    getReleasePackages,
    getRepositoryUrl,
    hasRegistryAuth,
    officialRegistry,
    publishGitHubRelease,
    quoteWindowsArg,
    truncateNotes,
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
    expect(plan.notes).not.toMatch(/^## /m)
    expect(plan.notes).toContain('**Full Changelog**: https://github.com/fixture/repo/compare/v1.0.0...v1.0.1')
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

    // Versions are never committed, so `^0.0.0` would never accept the release; it moves to the release version.
    const cli = registry.published.find(({ manifest }) => manifest.name === '@fixture/cli')!
    expect(cli.manifest).toMatchObject({
        version: '1.0.1',
        dependencies: { '@fixture/core': '^1.0.1' },
        repository: { type: 'git', url: 'https://github.com/fixture/repo.git', directory: 'packages/cli' }
    })
    expect(JSON.parse(fs.readFileSync(path.join(cwd, 'packages/cli/package.json'), 'utf8')).dependencies['@fixture/core']).toBe('^0.0.0')
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

test('skips a version an interrupted release published from another commit', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    registry.packuments.set('@fixture/core', { 'dist-tags': { [stagingDistTag]: '1.0.1' }, versions: { '1.0.1': { gitHead: 'f'.repeat(40) } } })
    const logs: string[] = []

    const result = await runRelease({ branch: 'main' }, environment(cwd, registry, logs))
    expect(result.plan).toMatchObject({ version: '1.0.2', tag: 'v1.0.2' })
    expect(result.plan.notes).toContain('compare/v1.0.0...v1.0.2')
    expect(logs).toContainEqual(expect.stringMatching(/@fixture\/core@1\.0\.1 \(fffffffff\) is already published from another commit without a v1\.0\.1 tag; releasing 1\.0\.2 instead/))
    expect(git(cwd, 'tag', '--list', 'v1.0.[12]')).toBe('v1.0.2')
})

test('refuses a version published without a gitHead', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    registry.packuments.set('@fixture/core', { 'dist-tags': {}, versions: { '1.0.1': {} } })

    await expect(runRelease({ branch: 'main' }, environment(cwd, registry))).rejects.toThrow(/published without a gitHead/)
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

test('releases a detached commit only when it is on the release branch', async () => {
    const cwd = createRepo()
    git(cwd, 'checkout', '-q', '-b', 'feature/x')
    const feature = commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    git(cwd, 'checkout', '-q', '--detach', feature)
    const registry = createRegistry()
    const logs: string[] = []

    await expect(runRelease({ branch: 'main' }, environment(cwd, registry))).rejects.toThrow(`${feature.slice(0, 9)} is not on main. Release a commit of main.`)
    expect((await runRelease({ branch: 'main', dryRun: true }, environment(cwd, registry, logs))).status).toBe('dry-run')
    expect(logs).toContain(`! ${feature.slice(0, 9)} is not on main. Release a commit of main. A release would stop here.`)
    expect(registry.published).toEqual([])

    git(cwd, 'checkout', '-q', 'main')
    git(cwd, 'merge', '-q', '--ff-only', 'feature/x')
    git(cwd, 'checkout', '-q', '--detach', feature)
    expect((await runRelease({ branch: 'main' }, environment(cwd, registry))).status).toBe('released')
})

test('releases only commits that are on the remote release branch', async () => {
    const cwd = createRepo()
    git(cwd, 'update-ref', 'refs/remotes/origin/main', 'v1.0.0')
    const head = commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()

    await expect(runRelease({ branch: 'main' }, environment(cwd, registry))).rejects.toThrow(`${head.slice(0, 9)} is not on origin/main. Push it to main first, or release a commit of main.`)
    expect(registry.published).toEqual([])

    git(cwd, 'update-ref', 'refs/remotes/origin/main', head)
    expect((await runRelease({ branch: 'main' }, environment(cwd, registry))).status).toBe('released')
})

test('stops a release that is not the expected version', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    const logs: string[] = []

    await expect(runRelease({ branch: 'main', expectVersion: 'next' }, environment(cwd, registry))).rejects.toThrow('The expected version next is not a version, such as 1.2.4.')
    await expect(runRelease({ branch: 'main', expectVersion: '1.1.0' }, environment(cwd, registry))).rejects.toThrow('This release is 1.0.1, not the expected 1.1.0. Review the plan again.')
    await runRelease({ branch: 'main', expectVersion: '1.1.0', dryRun: true }, environment(cwd, registry, logs))
    expect(logs).toContain('! This release is 1.0.1, not the expected 1.1.0. Review the plan again. A release would stop here.')
    // The version check accepts spaces and a `v`, and so does the comparison.
    logs.length = 0
    await runRelease({ branch: 'main', expectVersion: ' v1.0.1 ', dryRun: true }, environment(cwd, registry, logs))
    expect(logs.filter((line) => line.startsWith('!'))).toEqual([])
    expect(registry.published).toEqual([])

    // A version taken by an interrupted release from another commit is not the approved one either.
    registry.packuments.set('@fixture/core', { 'dist-tags': {}, versions: { '1.0.1': { gitHead: 'f'.repeat(40) } } })
    await expect(runRelease({ branch: 'main', expectVersion: '1.0.1' }, environment(cwd, registry))).rejects.toThrow('This release is 1.0.2, not the expected 1.0.1.')
    registry.packuments.clear()

    expect((await runRelease({ branch: 'main', expectVersion: 'v1.0.1' }, environment(cwd, registry))).status).toBe('released')
    // Resuming the tagged release checks its version too.
    await expect(runRelease({ branch: 'main', expectVersion: '1.0.2' }, environment(cwd, registry))).rejects.toThrow('This release is 1.0.1, not the expected 1.0.2.')
    commit(cwd, 'Chore: Tidy up', { 'site/index.js': 'export {}\n' })
    await expect(runRelease({ branch: 'main', expectVersion: '1.0.2' }, environment(cwd, registry))).rejects.toThrow('Nothing releases, but 1.0.2 was expected.')
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

test('exchanges a new npm trusted publishing token for every npm command', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    const base = environment(cwd, registry)
    delete base.env.NPM_TOKEN
    base.env.ACTIONS_ID_TOKEN_REQUEST_URL = 'https://oidc.test/token?api-version=2.0'
    base.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'request-token'
    let exchanged = 0
    const used: string[] = []
    const routes = new Set<string>()

    await runRelease({ branch: 'main' }, {
        ...base,
        fetch: async (input, init) => {
            if (input.startsWith('https://oidc.test/')) return Response.json({ value: 'identity' })
            if (input.includes('/oidc/token/exchange/package/')) {
                routes.add(input.slice(input.lastIndexOf('/') + 1))
                return Response.json({ token: `oidc-${++exchanged}` })
            }
            return registry.fetch(input, init)
        },
        run: async (command, args, options) => {
            if (command === 'npm' && args[0] !== 'pack') used.push(/_authToken=(\S+)/.exec(fs.readFileSync(options.env.NPM_CONFIG_USERCONFIG!, 'utf8'))![1])
            return registry.run(command, args, options)
        }
    })
    // publish, dist-tag add, and dist-tag rm for each of the two packages
    expect(used).toHaveLength(6)
    expect(new Set(used).size).toBe(6)
    // The npm CLI escapes scoped names as `@scope%2fname`.
    expect([...routes].sort()).toEqual(['@fixture%2fcli', '@fixture%2fcore'])
})

test('reads GitHub repository URLs with dots and npm shorthands', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-url-'))
    const urlOf = (repository: unknown) => {
        write(cwd, 'package.json', JSON.stringify({ repository }))
        return getRepositoryUrl(cwd, {})
    }
    expect(urlOf({ url: 'git+https://github.com/owner/my.repo.git' })).toBe('https://github.com/owner/my.repo')
    expect(urlOf('git@github.com:owner/repo.git')).toBe('https://github.com/owner/repo')
    expect(urlOf('github:owner/repo')).toBe('https://github.com/owner/repo')
    expect(urlOf('owner/repo')).toBe('https://github.com/owner/repo')
    expect(urlOf('gitlab:owner/repo')).toBeUndefined()
    expect(urlOf('https://notgithub.com/owner/repo')).toBeUndefined()
    expect(urlOf('https://github.com/owner/repo#readme')).toBe('https://github.com/owner/repo')
})

test('does not count unset or placeholder npmrc tokens as auth', () => {
    const npmrc = '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}'
    expect(hasRegistryAuth(npmrc, officialRegistry, {})).toBe(false)
    expect(hasRegistryAuth(npmrc, officialRegistry, { NODE_AUTH_TOKEN: 'XXXXX-XXXXX-XXXXX-XXXXX' })).toBe(false)
    expect(hasRegistryAuth(npmrc, officialRegistry, { NODE_AUTH_TOKEN: 'npm_real' })).toBe(true)
    expect(hasRegistryAuth('//registry.npmjs.org/:_authToken=npm_real', officialRegistry, {})).toBe(true)
    expect(hasRegistryAuth('//npm.pkg.github.com/:_authToken=npm_real', officialRegistry, {})).toBe(false)
})

test('truncates long notes at a line and keeps the full changelog link', () => {
    const footer = '**Full Changelog**: https://github.com/o/r/compare/v1.0.0...v1.0.1'
    const notes = `${Array.from({ length: 50 }, (_, index) => `- Entry ${index}`).join('\n')}\n\n${footer}\n`
    const truncated = truncateNotes(notes, 200)
    expect(truncated.length).toBeLessThanOrEqual(200)
    expect(truncated).toMatch(/^- Entry 0\n/)
    expect(truncated).toMatch(/- Entry \d+\n\n…the notes are too long for a GitHub release; see the full changelog\.\n\n/)
    expect(truncated.endsWith(`${footer}\n`)).toBe(true)
    expect(truncateNotes(notes)).toBe(notes)
})

test('quotes Windows shell arguments', () => {
    expect(quoteWindowsArg('--registry')).toBe('--registry')
    expect(quoteWindowsArg('C:\\Users\\John Doe\\pkg.tgz')).toBe('"C:\\Users\\John Doe\\pkg.tgz"')
    expect(quoteWindowsArg('a"b')).toBe('"a\\"b"')
    expect(quoteWindowsArg('a&b')).toBe('"a&b"')
})

test('never moves a dist-tag backwards', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    registry.packuments.set('@fixture/core', { 'dist-tags': { latest: '3.2.0' }, versions: { '3.2.0': { gitHead: 'f'.repeat(40) } } })

    await expect(runRelease({ branch: 'main' }, environment(cwd, registry))).rejects.toThrow(/has 3\.2\.0 on latest, newer than 1\.0\.1/)
    expect(registry.published).toEqual([])
})

test('retries a failed trusted publishing dist-tag with NPM_TOKEN', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    const base = environment(cwd, registry)
    base.env.NPM_ID_TOKEN = 'identity'
    const logs: string[] = []

    const result = await runRelease({ branch: 'main' }, {
        ...base,
        log: (message) => logs.push(message),
        fetch: async (input, init) => input.includes('/oidc/token/exchange/package/')
            ? Response.json({ token: 'oidc' })
            : registry.fetch(input, init),
        run: async (command, args, options) => {
            const token = command === 'npm' && args[0] === 'dist-tag'
                ? /_authToken=(\S+)/.exec(fs.readFileSync(options.env.NPM_CONFIG_USERCONFIG!, 'utf8'))![1]
                : undefined
            if (token === 'oidc') throw new Error('403 Forbidden')
            return registry.run(command, args, options)
        }
    })
    expect(result.status).toBe('released')
    expect(registry.packuments.get('@fixture/core')!['dist-tags']).toEqual({ latest: '1.0.1' })
    expect(logs).toContainEqual(expect.stringContaining('retrying with NPM_TOKEN'))
})

test('runs npm outside the repository with project npmrc settings and the token last', async () => {
    const cwd = createRepo()
    write(cwd, '.npmrc', '//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}\nfund=false\n')
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    const base = environment(cwd, registry)
    base.env.NODE_AUTH_TOKEN = 'XXXXX-XXXXX-XXXXX-XXXXX'
    const npm: Array<{ cwd: string, config: string }> = []

    await runRelease({ branch: 'main' }, {
        ...base,
        run: async (command, args, options) => {
            if (command === 'npm' && args[0] === 'publish') npm.push({ cwd: options.cwd, config: fs.readFileSync(options.env.NPM_CONFIG_USERCONFIG!, 'utf8') })
            return registry.run(command, args, options)
        }
    })
    expect(npm).toHaveLength(2)
    expect(path.relative(cwd, npm[0].cwd).startsWith('..')).toBe(true)
    expect(npm[0].config).toContain('fund=false')
    expect(npm[0].config.trim().endsWith('//registry.npmjs.org/:_authToken=npm-token')).toBe(true)
})

test('reads registries and auth like npm', () => {
    const scoped = { name: '@fixture/core' }
    expect(getRegistry(scoped, {}, '@fixture:registry=https://npm.pkg.github.com\n')).toBe('https://npm.pkg.github.com/')
    expect(getRegistry(scoped, { npm_config_registry: 'https://registry.example.com' })).toBe('https://registry.example.com/')
    expect(getRegistry({ name: 'x', publishConfig: { registry: 'https://a.example.com' } }, {}, 'registry=https://b.example.com')).toBe('https://a.example.com/')
    expect(hasRegistryAuth('_authToken=npm_real', officialRegistry, {})).toBe(false)
    expect(hasRegistryAuth('//registry.npmjs.org/:_authToken=${TOKEN?}', officialRegistry, { TOKEN: 'npm_real' })).toBe(true)
    expect(hasRegistryAuth('//registry.npmjs.org/:username=me\n//registry.npmjs.org/:_password=c2VjcmV0', officialRegistry, {})).toBe(true)
    expect(hasRegistryAuth('# //registry.npmjs.org/:_authToken=npm_real', officialRegistry, {})).toBe(false)
})

test('refuses shallow clones and a branch that is not checked out', async () => {
    const source = createRepo()
    commit(source, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const shallow = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-shallow-'))
    git(shallow, 'clone', '-q', '--depth', '1', `file://${source}`, '.')
    await expect(planRelease({ branch: 'main' }, { cwd: shallow, env: {} })).rejects.toThrow(/shallow clone/)

    await expect(planRelease({}, { cwd: source, env: { GITHUB_REF_NAME: 'beta' } })).rejects.toThrow(/GITHUB_REF_NAME is beta, but main is checked out/)
})

test('resumes by pushing the tag and targeting the commit, ignoring floating tags', async () => {
    const cwd = createRepo()
    const head = commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    git(cwd, 'tag', 'v1')
    git(cwd, 'tag', 'v1.0.1')
    const registry = createRegistry()

    const result = await runRelease({ branch: 'main' }, environment(cwd, registry))
    expect(result.status).toBe('resumed')
    expect(registry.commands).toContainEqual(['git', 'push', '--no-verify', 'origin', 'refs/tags/v1.0.1'])
    expect(registry.releases).toEqual([expect.objectContaining({ tag_name: 'v1.0.1', target_commitish: head, make_latest: 'true' })])
})

test('resumes a prerelease with its own number and an older stable release without making it latest', async () => {
    // A rerun of an older job after a newer release of the same channel.
    const beta = createRepo()
    git(beta, 'checkout', '-q', '-b', 'beta')
    commit(beta, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    git(beta, 'tag', 'v1.0.1-beta.1')
    commit(beta, 'Fix(Core): Repair it again', { 'packages/core/index.js': 'export const core = 3\n' })
    git(beta, 'tag', 'v1.0.1-beta.2')
    git(beta, 'checkout', '-q', 'HEAD~1')
    const betaRegistry = createRegistry()
    expect((await runRelease({ branch: 'beta' }, environment(beta, betaRegistry))).status).toBe('resumed')
    expect(betaRegistry.releases).toEqual([expect.objectContaining({ tag_name: 'v1.0.1-beta.1', make_latest: 'false' })])

    const main = createRepo()
    commit(main, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    git(main, 'tag', 'v1.0.1')
    commit(main, 'Fix(Core): Repair it again', { 'packages/core/index.js': 'export const core = 3\n' })
    git(main, 'tag', 'v1.0.2')
    git(main, 'checkout', '-q', 'HEAD~1')
    const mainRegistry = createRegistry()
    expect((await runRelease({ branch: 'main' }, environment(main, mainRegistry))).status).toBe('resumed')
    expect(mainRegistry.releases).toEqual([expect.objectContaining({ tag_name: 'v1.0.1', make_latest: 'false' })])
})

test('skips a commit that a newer release already covers', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    commit(cwd, 'Fix(Core): Repair it again', { 'packages/core/index.js': 'export const core = 3\n' })
    git(cwd, 'tag', 'v1.0.1')
    git(cwd, 'checkout', '-q', 'HEAD~1')
    const registry = createRegistry()

    const result = await runRelease({ branch: 'main' }, environment(cwd, registry))
    expect(result.status).toBe('none')
    expect(registry.published).toEqual([])
})

test('reports GitHub API errors other than a missing release', async () => {
    const cwd = createRepo()
    const logs: string[] = []
    const env = environment(cwd, createRegistry(), logs)
    await expect(publishGitHubRelease({
        ...env,
        fetch: async () => new Response('Bad credentials', { status: 401 })
    }, { tag: 'v1.0.1', notes: '', prerelease: false })).rejects.toThrow(/Could not check the GitHub release v1\.0\.1: 401 Bad credentials/)
})

test('orders packages without peers, rejects duplicate names, and ships a published root with workspaces', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-packages-'))
    write(cwd, 'package.json', JSON.stringify({ name: 'root', publishConfig: { access: 'public' }, workspaces: ['packages/*'] }))
    write(cwd, 'packages/a/package.json', JSON.stringify({ name: 'a', dependencies: { b: '*' }, publishConfig: { access: 'public' } }))
    write(cwd, 'packages/b/package.json', `\uFEFF${JSON.stringify({ name: 'b', peerDependencies: { a: '*' }, publishConfig: { access: 'public' } })}`)
    expect(getReleasePackages(cwd).map(({ dir }) => dir)).toEqual(['.', 'packages/b', 'packages/a'])

    write(cwd, 'packages/c/package.json', JSON.stringify({ name: 'a', publishConfig: { access: 'public' } }))
    expect(() => getReleasePackages(cwd)).toThrow(/packages\/a\/package\.json and packages\/c\/package\.json are both named a/)
})

test('refuses scoped packages without access and tarballs with local protocols', async () => {
    const scoped = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-scoped-'))
    git(scoped, 'init', '-q', '-b', 'main')
    git(scoped, 'config', 'user.email', 'fixture@example.com')
    git(scoped, 'config', 'user.name', 'Fixture')
    commit(scoped, 'Fix: Initial release', { 'package.json': JSON.stringify({ name: '@fixture/single' }) })
    await expect(runRelease({ branch: 'main' }, environment(scoped, createRegistry()))).rejects.toThrow(/@fixture\/single is scoped/)

    const cwd = createRepo()
    const cli = JSON.parse(fs.readFileSync(path.join(cwd, 'packages/cli/package.json'), 'utf8'))
    cli.dependencies['@fixture/core'] = 'file:../core'
    commit(cwd, 'Fix(CLI): Link the core', { 'packages/cli/package.json': JSON.stringify(cli, null, 4) })
    await expect(runRelease({ branch: 'main' }, environment(cwd, createRegistry()))).rejects.toThrow(/keeps `@fixture\/core: file:\.\.\/core`/)
})

test('packs without credentials in the environment', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    const base = environment(cwd, registry)
    const packEnvs: NodeJS.ProcessEnv[] = []
    await runRelease({ branch: 'main' }, {
        ...base,
        run: async (command, args, options) => {
    Object.assign(base.env, {
        'npm_config_//registry.npmjs.org/:_authToken': 'npm-env-token',
        NPM_CONFIG__AUTH: 'dXNlcjpwYXNz',
        'npm_config_//npm.pkg.github.com/:_password': 'secret',
        npm_config_fund: 'false'
    })
            if (args[0] === 'pack') packEnvs.push(options.env)
            return registry.run(command, args, options)
        }
    })
    expect(packEnvs).toHaveLength(2)
    for (const env of packEnvs) {
        expect([env.NPM_TOKEN, env.GITHUB_TOKEN]).toEqual([undefined, undefined])
        // npm reads registry auth from these too.
        expect(Object.keys(env).filter((key) => /^npm_config_.*(auth|password)/i.test(key))).toEqual([])
        expect(env.npm_config_fund).toBe('false')
    }
})

test('retries transient registry errors and accepts a version a stale cache hid', async () => {
    const cwd = createRepo()
    const head = commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    let failures = 2
    let hidden = true
    const result = await runRelease({ branch: 'main' }, {
        ...environment(cwd, registry),
        fetch: async (input, init) => {
            if (input.startsWith(officialRegistry) && failures > 0) {
                failures--
                return new Response('', { status: 503 })
            }
            if (input.endsWith('@fixture%2fcore') && hidden) return new Response('', { status: 404 })
            return registry.fetch(input, init)
        },
        run: async (command, args, options) => {
            if (args[0] === 'publish' && args[1].includes(`${path.sep}0${path.sep}`)) {
                // An earlier run published core; npm refuses to publish over it.
                registry.packuments.set('@fixture/core', { 'dist-tags': { [stagingDistTag]: '1.0.1' }, versions: { '1.0.1': { gitHead: head } } })
                hidden = false
                throw new Error('npm error 403 You cannot publish over the previously published versions: 1.0.1.')
            }
            return registry.run(command, args, options)
        }
    })
    expect(result.status).toBe('released')
    expect(registry.published.map(({ manifest }) => manifest.name)).toEqual(['@fixture/cli'])
})

test('dry run reports what a release would stop at', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    write(cwd, 'packages/core/index.js', 'export const core = 3\n')
    const logs: string[] = []
    const result = await runRelease({ branch: 'main', dryRun: true }, environment(cwd, createRegistry(), logs))
    expect(result.status).toBe('dry-run')
    expect(logs).toContainEqual('! The working tree has changes; a release would stop here.')
})

test('attaches release assets and uploads only the missing ones on a rerun', async () => {
    const cwd = createRepo()
    write(cwd, 'aronrepo.config.js', "export default { release: { mode: 'explicit', assets: [{ path: 'dist/global.min.js', name: 'global-{tag}.min.js', label: 'Browser bundle {version}' }, { path: 'checksums.json' }] } }\n")
    write(cwd, '.gitignore', 'node_modules\ndist\nchecksums.json\n')
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    write(cwd, 'dist/global.min.js', 'console.log(1)\n')
    write(cwd, 'checksums.json', '{}\n')
    const registry = createRegistry()
    const uploads: Array<{ url: string, body: string }> = []
    const uploaded = new Set<string>()
    const fetch: Fetch = async (input, init) => {
        if (input.startsWith('https://uploads.github.com/')) {
            const name = new URL(input).searchParams.get('name')!
            uploads.push({ url: input, body: Buffer.from(init!.body as Uint8Array).toString() })
            uploaded.add(name)
            return Response.json({ name }, { status: 201 })
        }
        const response = await registry.fetch(input, init)
        if (!input.startsWith('https://api.github.com/') || !response.ok) return response
        const body = await response.json() as Record<string, unknown>
        return Response.json({
            ...body,
            upload_url: 'https://uploads.github.com/repos/fixture/repo/releases/1/assets{?name,label}',
            assets: [...uploaded].map((name) => ({ name }))
        }, { status: response.status })
    }

    await runRelease({ branch: 'main' }, { ...environment(cwd, registry), fetch })
    expect(uploads.map(({ url }) => decodeURIComponent(url))).toEqual([
        'https://uploads.github.com/repos/fixture/repo/releases/1/assets?name=global-v1.0.1.min.js&label=Browser bundle 1.0.1',
        'https://uploads.github.com/repos/fixture/repo/releases/1/assets?name=checksums.json'
    ])
    expect(uploads[0].body).toBe('console.log(1)\n')

    // The release exists with one asset missing; a rerun uploads only that one.
    uploaded.delete('checksums.json')
    uploads.length = 0
    await runRelease({ branch: 'main' }, { ...environment(cwd, registry), fetch })
    expect(uploads.map(({ url }) => new URL(url).searchParams.get('name'))).toEqual(['checksums.json'])
})

test('refuses a missing release asset before publishing anything', async () => {
    const cwd = createRepo()
    write(cwd, 'aronrepo.config.js', "export default { release: { mode: 'explicit', assets: [{ path: 'dist/missing.js' }] } }\n")
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    await expect(runRelease({ branch: 'main' }, environment(cwd, registry))).rejects.toThrow(/The GitHub release asset dist\/missing\.js does not exist/)
    expect(registry.published).toEqual([])

    const logs: string[] = []
    await runRelease({ branch: 'main', dryRun: true }, environment(cwd, registry, logs))
    expect(logs).toContainEqual(expect.stringContaining('dist/missing.js does not exist. A release would stop here.'))
})

test('reads a private registry with the auth of its npmrc', async () => {
    const cwd = createRepo()
    write(cwd, '.npmrc', '@fixture:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n')
    commit(cwd, 'Fix(Core): Repair the cache', { 'packages/core/index.js': 'export const core = 2\n' })
    const registry = createRegistry()
    const base = environment(cwd, registry)
    delete base.env.NPM_TOKEN
    base.env.NODE_AUTH_TOKEN = 'github-packages-token'
    const reads = new Set<string | undefined>()
    const result = await runRelease({ branch: 'main' }, {
        ...base,
        fetch: async (input, init) => {
            if (!input.startsWith('https://npm.pkg.github.com/')) return registry.fetch(input, init)
            reads.add(new Headers(init?.headers).get('authorization') ?? undefined)
            return registry.fetch(input.replace('https://npm.pkg.github.com/', officialRegistry), init)
        }
    })
    expect(result.status).toBe('released')
    expect([...reads]).toEqual(['Bearer github-packages-token'])
})


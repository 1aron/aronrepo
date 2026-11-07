import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { agents, check, doctor, explain, policy, release } from '../src/commands'

function write(cwd: string, file: string, content: string) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true })
    fs.writeFileSync(path.join(cwd, file), content)
}

function git(cwd: string, ...args: string[]) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function commit(cwd: string, message: string, files: Record<string, string>) {
    for (const [file, content] of Object.entries(files)) write(cwd, file, content)
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '--allow-empty', '-q', '-m', message)
    return git(cwd, 'rev-parse', 'HEAD')
}

function createRepo(config = "export default { release: { mode: 'explicit' } }\n") {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aronrepo-cli-'))
    git(cwd, 'init', '-q', '-b', 'main')
    git(cwd, 'config', 'user.email', 'fixture@example.com')
    git(cwd, 'config', 'user.name', 'Fixture')
    git(cwd, 'config', 'commit.gpgsign', 'false')
    write(cwd, 'package.json', JSON.stringify({ private: true, type: 'module', devDependencies: { aronrepo: '^3.0.0' } }))
    write(cwd, 'pnpm-workspace.yaml', 'packages:\n  - packages/*\n  - site\n')
    write(cwd, 'packages/core/package.json', JSON.stringify({ name: '@fixture/core', publishConfig: { access: 'public' } }))
    write(cwd, 'site/package.json', JSON.stringify({ name: 'site', private: true }))
    write(cwd, 'aronrepo.config.js', config)
    commit(cwd, 'Chore: Initialize fixture', {})
    git(cwd, 'tag', 'v1.0.0')
    return cwd
}

test('check rejects release types on unpublished paths with a suggested header', async () => {
    const cwd = createRepo()
    write(cwd, 'site/index.js', 'export {}')
    git(cwd, 'add', '-A')

    const result = await check({ cwd, message: 'Perf(Site): Speed up the homepage' })
    expect(result.code).toBe(1)
    expect(result.output).toContain('Suggested header: Chore(Site): Speed up the homepage')

    await expect(check({ cwd, message: 'Chore(Site): Speed up the homepage' })).resolves.toMatchObject({ code: 0 })
})

test('check prints warnings without failing', async () => {
    const cwd = createRepo()
    write(cwd, 'packages/core/index.js', 'export {}')
    git(cwd, 'add', '-A')

    const result = await check({ cwd, message: 'Fix(Core): Repair the cache\nIt was stale.' })
    expect(result.code).toBe(0)
    expect(result.output).toContain('! Leave a blank line between the header and the body.')
    await expect(check({ cwd, message: 'Fix(Core): Repair the cache.' })).resolves.toMatchObject({ code: 1 })
})

test('check reads a commit-msg hook file and ignores comments', async () => {
    const cwd = createRepo()
    write(cwd, 'packages/core/index.js', 'export {}')
    git(cwd, 'add', '-A')
    write(cwd, '.git/COMMIT_EDITMSG', 'Improve(Core): Rename the mode\n\nBREAKING CHANGE: Rename it.\n# Please enter the commit message\n')

    const result = await check({ cwd, edit: '.git/COMMIT_EDITMSG' })
    expect(result.code).toBe(1)
    expect(result.output).toMatch(/does not release a major version in explicit mode/)
})

test('check validates a PR title against the PR diff', async () => {
    const cwd = createRepo()
    git(cwd, 'checkout', '-q', '-b', 'feature')
    commit(cwd, 'Chore(Site): Fix the header', { 'site/header.js': 'export {}' })

    const result = await check({ cwd, title: 'Fix(Site): Fix the header', base: 'main', head: 'feature' })
    expect(result.code).toBe(1)
    await expect(check({ cwd, title: 'Chore(Site): Fix the header', base: 'main', head: 'feature' })).resolves.toMatchObject({ code: 0 })
})

test('check validates every commit in a range and skips merge commits', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair cache', { 'packages/core/cache.js': 'export {}' })
    commit(cwd, 'Merge branch next', {})
    await expect(check({ cwd, from: 'v1.0.0' })).resolves.toMatchObject({ code: 0 })

    commit(cwd, 'Improve(Site): Resize the photo', { 'site/photo.js': 'export {}' })
    const result = await check({ cwd, from: 'v1.0.0', json: true })
    expect(result.code).toBe(1)
    expect(JSON.parse(result.output).results).toHaveLength(2)
})

test('explain reports the next release from the latest tag', async () => {
    const cwd = createRepo()
    commit(cwd, 'Add(Core): Add a builder', { 'packages/core/builder.js': 'export {}' })
    commit(cwd, 'Fix(Site): Repair the header', { 'site/header.js': 'export {}' })

    const result = await explain({ cwd })
    expect(result.output).toContain('Range: v1.0.0..HEAD')
    expect(result.output).toContain('Next release: patch')

    const auto = JSON.parse((await explain({ cwd, mode: 'auto', json: true })).output)
    expect(auto.release).toBe('minor')
    expect(auto.commits.map((decision: { release: string | false }) => decision.release)).toEqual(['minor', false])
})

test('policy prints machine-readable release rules', async () => {
    const cwd = createRepo("export default { release: { mode: 'auto' } }\n")
    const data = JSON.parse((await policy({ cwd, json: true })).output)
    expect(data).toMatchObject({
        mode: 'auto',
        configFile: 'aronrepo.config.js',
        releasePaths: { include: ['packages/core/**'] },
        releaseTable: { minor: expect.arrayContaining(['`Add`']) },
        types: expect.arrayContaining([expect.objectContaining({ type: 'Add', release: 'minor', group: 'Additions' })]),
        legacyTypes: expect.arrayContaining([{ type: 'Feat', replacement: 'Add' }])
    })
})

test('agents writes, checks, and refreshes the AGENTS.md block', async () => {
    const cwd = createRepo()
    write(cwd, 'AGENTS.md', '# Guide\n\nKeep this.\n')

    expect((await agents({ cwd })).code).toBe(1)
    await agents({ cwd, write: true })
    expect((await agents({ cwd })).code).toBe(0)
    expect(fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8')).toMatch(/^# Guide\n\nKeep this\.\n\n<!-- aronrepo:commit-policy:start -->/)

    write(cwd, 'aronrepo.config.js', "export default { release: { mode: 'auto' } }\n")
    expect((await agents({ cwd })).output).toMatch(/outdated/)
    await agents({ cwd, write: true })
    const content = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8')
    expect(content.match(/aronrepo:commit-policy:start/g)).toHaveLength(1)
    expect(content).toContain('Release mode: **auto**')
})

test('doctor lists missing setup with fixes', async () => {
    const cwd = createRepo()
    const missing = await doctor({ cwd })
    expect(missing.code).toBe(1)
    expect(missing.output).toContain('AGENTS.md is missing the Aronrepo commit policy block')

    write(cwd, '.husky/commit-msg', 'aronrepo check --edit "$1"\n')
    await agents({ cwd, write: true })

    const complete = await doctor({ cwd })
    expect(complete.output).toContain('Aronrepo setup is complete.')
    expect(complete.code).toBe(0)

    write(cwd, 'release.config.js', 'export default {}\n')
    expect((await doctor({ cwd })).output).toMatch(/Leftovers from semantic-release or commitlint: release\.config\.js/)
})

test('release --dry-run --json prints the plan', async () => {
    const cwd = createRepo()
    commit(cwd, 'Add(Core): Add a builder', { 'packages/core/builder.js': 'export {}' })

    const result = await release({ cwd, branch: 'main', dryRun: true, json: true })
    expect(JSON.parse(result.output)).toMatchObject({
        status: 'dry-run',
        version: '1.0.1',
        tag: 'v1.0.1',
        packages: [{ dir: 'packages/core', name: '@fixture/core' }]
    })
    expect(git(cwd, 'status', '--porcelain')).toBe('')
})

test('check stops at the scissors line of git commit -v', async () => {
    const cwd = createRepo()
    write(cwd, 'packages/core/index.js', 'export {}')
    git(cwd, 'add', '-A')
    write(cwd, '.git/COMMIT_EDITMSG', [
        'Fix(Core): Repair the cache',
        '',
        '# ------------------------ >8 ------------------------',
        '# Do not modify or remove the line above.',
        'diff --git a/packages/core/index.js b/packages/core/index.js',
        '+BREAKING CHANGE: not part of the message',
        ''
    ].join('\n'))

    const result = await check({ cwd, edit: '.git/COMMIT_EDITMSG', json: true })
    expect(result.code).toBe(0)
    expect(JSON.parse(result.output).results[0].breakingNotes).toBeUndefined()
})

test('explain --to starts from the latest version tag, not any tag', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair cache', { 'packages/core/cache.js': 'export {}' })
    git(cwd, 'tag', 'deploy-1')

    const result = await explain({ cwd, to: 'HEAD' })
    expect(result.output).toContain('Range: v1.0.0..HEAD')
    expect(result.output).toContain('Next release: patch')
})

test('the CLI rejects unknown options and extra arguments with usage', () => {
    const cli = path.join(import.meta.dirname, '../dist/cli.js')
    const run = (...args: string[]) => {
        try {
            execFileSync('node', [cli, ...args], { encoding: 'utf8', stdio: 'pipe' })
            return 0
        } catch (error) {
            return (error as { status: number }).status
        }
    }
    expect(run('policy', '--nope')).toBe(2)
    expect(run('policy', 'extra')).toBe(2)
})

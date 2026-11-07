import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { agents, check, doctor, explain, policy, release } from '../src/commands'

const cliPath = path.join(import.meta.dirname, '../dist/cli.js')

function runCli(args: string[], cwd?: string) {
    try {
        const stdout = execFileSync('node', [cliPath, ...args], { encoding: 'utf8', stdio: 'pipe', ...(cwd ? { cwd } : {}) })
        return { code: 0, stdout, stderr: '' }
    } catch (error) {
        const { status, stdout, stderr } = error as { status: number, stdout: string, stderr: string }
        return { code: status, stdout, stderr }
    }
}

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
    commit(cwd, "Merge branch 'next'", {})
    await expect(check({ cwd, from: 'v1.0.0' })).resolves.toMatchObject({ code: 0 })

    commit(cwd, 'Improve(Site): Resize the photo', { 'site/photo.js': 'export {}' })
    const result = await check({ cwd, from: 'v1.0.0', json: true })
    expect(result.code).toBe(1)
    expect(JSON.parse(result.output).results).toHaveLength(2)
})

test('explain reports the next release from the latest tag', async () => {
    const cwd = createRepo()
    commit(cwd, 'Feat(Core): Add a builder', { 'packages/core/builder.js': 'export {}' })
    commit(cwd, 'Fix(Site): Repair the header', { 'site/header.js': 'export {}' })

    const result = await explain({ cwd })
    expect(result.output).toContain('Range: v1.0.0..HEAD')
    expect(result.output).toContain('Next release: patch')

    const auto = JSON.parse((await explain({ cwd, mode: 'auto', json: true })).output)
    expect(auto.release).toBe('minor')
    expect(auto.commits.map((decision: { release: string | false }) => decision.release)).toEqual(['minor', false])
    // The reviewed preview carries the commit and the notes that `aronrepo release` would publish.
    expect(auto).toMatchObject({ head: git(cwd, 'rev-parse', 'HEAD'), version: '1.1.0', tag: 'v1.1.0' })
    expect(auto.notes).toContain('Add a builder')
    expect(auto.notes).not.toContain('Repair the header')
})

test('policy prints machine-readable release rules', async () => {
    const cwd = createRepo("export default { release: { mode: 'auto' } }\n")
    const data = JSON.parse((await policy({ cwd, json: true })).output)
    expect(data).toMatchObject({
        mode: 'auto',
        configFile: 'aronrepo.config.js',
        releasePaths: { include: ['packages/core/**'] },
        releaseTable: { minor: expect.arrayContaining(['Feat']), major: expect.arrayContaining(['BREAKING CHANGE: footer']) },
        types: expect.arrayContaining([expect.objectContaining({ type: 'Feat', release: 'minor', group: 'Features' })]),
        legacyTypes: expect.arrayContaining([{ type: 'Add', replacement: 'Feat' }])
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
    expect(runCli(['policy', '--nope']).code).toBe(2)
    expect(runCli(['policy', 'extra']).code).toBe(2)
})

test('check --edit keeps the files of HEAD for an amend or reword with nothing staged', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair cache', { 'packages/core/cache.js': 'export {}' })
    write(cwd, '.git/COMMIT_EDITMSG', 'Fix(Core): Repair the cache\n')
    await expect(check({ cwd, edit: '.git/COMMIT_EDITMSG' })).resolves.toMatchObject({ code: 0 })
})

test('check --edit reads core.commentChar and lets git abort an empty message', async () => {
    const cwd = createRepo()
    git(cwd, 'config', 'core.commentChar', ';')
    write(cwd, 'packages/core/index.js', 'export {}')
    git(cwd, 'add', '-A')
    write(cwd, '.git/COMMIT_EDITMSG', 'Fix(Core): Repair the cache\n; Please enter the commit message\n; ------------------------ >8 ------------------------\n+BREAKING CHANGE: no\n')
    const result = JSON.parse((await check({ cwd, edit: '.git/COMMIT_EDITMSG', json: true })).output)
    expect(result.results[0]).toMatchObject({ header: 'Fix(Core): Repair the cache', violations: [] })

    write(cwd, '.git/COMMIT_EDITMSG', '; only comments\n')
    await expect(check({ cwd, edit: '.git/COMMIT_EDITMSG' })).resolves.toMatchObject({ code: 0, output: expect.stringContaining('git aborts the commit') })
})

test('check ignores only the exact merge messages git writes, never in PR titles', async () => {
    const cwd = createRepo()
    commit(cwd, 'Merge sort into utils', { 'packages/core/sort.js': 'export {}' })
    const range = JSON.parse((await check({ cwd, from: 'v1.0.0', json: true })).output)
    expect(range.results).toHaveLength(1)

    await expect(check({ cwd, title: "Merge branch 'develop' into main", files: ['packages/core/a.js'] })).resolves.toMatchObject({ code: 1 })
})

test('check rejects conflicting modes and half a diff', async () => {
    const cwd = createRepo()
    await expect(check({ cwd, message: 'Chore: X', from: 'v1.0.0' })).resolves.toMatchObject({ code: 2, output: 'Pass only one of --message, --from.' })
    await expect(check({ cwd, title: 'Chore: X', base: 'main' })).resolves.toMatchObject({ code: 2 })
    await expect(check({ cwd, message: 'Chore: X', base: 'main', head: 'HEAD' })).resolves.toMatchObject({ code: 2 })
    const unchecked = await check({ cwd, title: 'Fix(Site): Repair header' })
    expect(unchecked).toMatchObject({ code: 0, output: expect.stringContaining('Release paths are not checked') })
})

test('check normalizes --files paths', async () => {
    const cwd = createRepo()
    const files = ['./packages/core/a.js', path.join(cwd, 'packages/core/b.js'), 'packages\\core\\c.js']
    for (const file of files) await expect(check({ cwd, message: 'Fix(Core): Repair', files: [file] })).resolves.toMatchObject({ code: 0 })
})

test('agents keeps CRLF, refuses broken markers, creates folders, and prints JSON', async () => {
    const cwd = createRepo()
    await agents({ cwd, write: true })
    const crlf = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8').replace(/\n/g, '\r\n')
    write(cwd, 'AGENTS.md', crlf)
    await expect(agents({ cwd })).resolves.toMatchObject({ code: 0 })
    await agents({ cwd, write: true, mode: 'auto' })
    expect(fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8').replace(/\r\n/g, '')).not.toContain('\n')

    write(cwd, 'AGENTS.md', '<!-- aronrepo:commit-policy:end -->\n<!-- aronrepo:commit-policy:start -->\n')
    await expect(agents({ cwd, write: true })).rejects.toThrow(/out of order/)

    await expect(agents({ cwd, file: 'docs/new/AGENTS.md', write: true })).resolves.toMatchObject({ code: 0 })
    expect(JSON.parse((await agents({ cwd, file: 'docs/new/AGENTS.md', json: true })).output)).toEqual({ file: path.join('docs', 'new', 'AGENTS.md'), status: 'current' })
})

test('doctor reports a broken config, invalid package.json, and an uninstalled hook', async () => {
    const cwd = createRepo('export default {')
    write(cwd, '.husky/commit-msg', '# aronrepo check --edit "$1"\n')
    const broken = JSON.parse((await doctor({ cwd, json: true })).output)
    expect(broken.ok).toBe(false)
    expect(broken.checks).toContainEqual(expect.objectContaining({ status: 'fail', message: expect.stringMatching(/config failed to load/) }))
    expect(broken.checks).toContainEqual(expect.objectContaining({ status: 'warn', message: 'No commit-msg hook runs `aronrepo check`.' }))

    write(cwd, 'aronrepo.config.js', 'export default {}\n')
    write(cwd, '.husky/commit-msg', 'bun x aronrepo check --edit "$1"\n')
    write(cwd, 'package.json', '{')
    const checks = JSON.parse((await doctor({ cwd, json: true })).output).checks
    expect(checks).toContainEqual(expect.objectContaining({ status: 'fail', message: expect.stringMatching(/package\.json is not valid JSON/) }))
    expect(checks).toContainEqual(expect.objectContaining({ message: '.husky/commit-msg is not installed; git does not run it.' }))
})

test('explain --to a tag explains that release', async () => {
    const cwd = createRepo()
    commit(cwd, 'Fix(Core): Repair cache', { 'packages/core/cache.js': 'export {}' })
    git(cwd, 'tag', 'v1.0.1')
    const result = JSON.parse((await explain({ cwd, to: 'v1.0.1', json: true })).output)
    expect(result).toMatchObject({ from: 'v1.0.0', to: 'v1.0.1', head: git(cwd, 'rev-parse', 'v1.0.1^{commit}'), release: 'patch', version: '1.0.1' })
    expect(result.notes).toContain('Repair cache')
})

test('the CLI finds the repository root, prints reports to stdout, and validates flags per command', () => {
    const cwd = createRepo("export default { release: { mode: 'auto' } }\n")
    write(cwd, 'site/index.js', 'export {}')
    git(cwd, 'add', '-A')
    const fromSubfolder = runCli(['check', '--message', 'Fix(Site): Repair', '--json'], path.join(cwd, 'packages/core'))
    expect(fromSubfolder.code).toBe(1)
    expect(JSON.parse(fromSubfolder.stdout).mode).toBe('auto')

    expect(runCli(['release', '--from', 'v1.0.0'], cwd)).toMatchObject({ code: 2, stderr: expect.stringContaining('`aronrepo release` does not take --from.') })
    expect(runCli(['explain', '--expect', '1.0.1'], cwd)).toMatchObject({ code: 2, stderr: expect.stringContaining('`aronrepo explain` does not take --expect.') })
    expect(runCli(['--version'])).toMatchObject({ code: 0, stdout: `${JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../package.json'), 'utf8')).version}\n` })
    expect(runCli(['help'])).toMatchObject({ code: 0, stdout: expect.stringContaining('Usage: aronrepo') })
    expect(JSON.parse(runCli(['check', '--json'], cwd).stderr)).toEqual({ error: 'Pass --edit <file>, --message <text>, --title <text>, or --from <ref>.', code: 2 })
    expect(runCli(['policy', '--cwd', path.join(cwd, 'missing')])).toMatchObject({ code: 2 })
})

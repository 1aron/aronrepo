import { getChangelogUrl, renderReleaseNotes, resolveRelease } from '../src'

const decisions = resolveRelease([
    { hash: 'a'.repeat(40), message: 'Bump(Major): Aronrepo v3\n\nBREAKING CHANGE: Releases default to explicit mode.\n\nBREAKING CHANGE: Remove the adapters.' },
    { hash: 'b'.repeat(40), message: 'Fix(Release): Keep workspace ranges' },
    { hash: 'c'.repeat(40), message: 'Feat(CLI): Add the release command' },
    { hash: 'd'.repeat(40), message: 'feat: export the release planner' },
    { hash: 'e'.repeat(40), message: 'Add(Check): Lint PR titles' },
    { hash: 'f'.repeat(40), message: 'Chore(Agent): Refresh guidance' },
    { hash: '1'.repeat(40), message: 'Improve(Release): Explain skipped commits\n\nBREAKING CHANGE: Ignored in explicit mode.' }
], { mode: 'explicit' }).commits

test('renders a GitHub release body without a heading and with a full changelog link', () => {
    expect(renderReleaseNotes({
        version: '3.0.0',
        previousTag: 'v2.2.1',
        date: '2026-11-07',
        repositoryUrl: 'https://github.com/1aron/aronrepo',
        commits: decisions
    })).toBe([
        '### ⚠ Breaking Changes',
        '',
        '- Releases default to explicit mode.',
        '- Remove the adapters.',
        '',
        '### Features',
        '',
        '- Export the release planner ([ddddddd](https://github.com/1aron/aronrepo/commit/' + 'd'.repeat(40) + '))',
        '- **Check:** Lint PR titles ([eeeeeee](https://github.com/1aron/aronrepo/commit/' + 'e'.repeat(40) + '))',
        '- **CLI:** Add the release command ([ccccccc](https://github.com/1aron/aronrepo/commit/' + 'c'.repeat(40) + '))',
        '',
        '### Improvements',
        '',
        '- **Release:** Explain skipped commits ([1111111](https://github.com/1aron/aronrepo/commit/' + '1'.repeat(40) + '))',
        '',
        '### Bug Fixes',
        '',
        '- **Release:** Keep workspace ranges ([bbbbbbb](https://github.com/1aron/aronrepo/commit/' + 'b'.repeat(40) + '))',
        '',
        '**Full Changelog**: https://github.com/1aron/aronrepo/compare/v2.2.1...v3.0.0',
        ''
    ].join('\n'))
})

test('starts changelog file notes with a linked version heading', () => {
    const notes = renderReleaseNotes({
        version: '3.0.0',
        previousTag: 'v2.2.1',
        date: '2026-11-07',
        repositoryUrl: 'https://github.com/1aron/aronrepo',
        heading: true,
        commits: decisions
    })
    expect(notes.startsWith('## [3.0.0](https://github.com/1aron/aronrepo/compare/v2.2.1...v3.0.0) (2026-11-07)\n\n### ⚠ Breaking Changes\n')).toBe(true)
    expect(notes).not.toContain('Full Changelog')
})

test('links the commits of a first release', () => {
    expect(getChangelogUrl('https://github.com/o/r', '1.0.0')).toBe('https://github.com/o/r/commits/v1.0.0')
    const notes = renderReleaseNotes({ version: '1.0.0', repositoryUrl: 'https://github.com/o/r', commits: resolveRelease([{ message: 'Fix: Repair' }]).commits })
    expect(notes).toBe('### Bug Fixes\n\n- Repair\n\n**Full Changelog**: https://github.com/o/r/commits/v1.0.0\n')
})

test('escapes HTML outside code spans', () => {
    const notes = renderReleaseNotes({ version: '1.0.1', commits: resolveRelease([{ message: 'Fix: Accept Array<string> and `Map<K, V>`' }]).commits })
    expect(notes).toContain('- Accept Array&lt;string> and `Map<K, V>`')
})

test('says when a release only bumps the version', () => {
    const notes = renderReleaseNotes({ version: '1.1.0', commits: resolveRelease([{ message: 'Bump(Minor): Release 1.1' }]).commits })
    expect(notes).toBe('Version bump only; no other changes to published packages.\n')
})

test('leaves out commits that do not release', () => {
    const notes = renderReleaseNotes({ version: '1.0.1', commits: resolveRelease([{ message: 'Docs: Add notes' }]).commits })
    expect(notes).toBe('No changes to published packages.\n')
})

test('matches code spans like CommonMark and keeps mentions from notifying', () => {
    const notes = renderReleaseNotes({ version: '1.0.1', commits: resolveRelease([{ message: 'Fix: Use ``Array<`T`>`` and \\`Array<T>\\` for @octocat and @types/node, mail a@b.com' }]).commits })
    expect(notes).toContain('- Use ``Array<`T`>`` and \\`Array&lt;T>\\` for `@octocat` and `@types/node`, mail a@b.com')
})

test('normalizes the version and repository URL', () => {
    const notes = renderReleaseNotes({ version: 'v1.0.0', repositoryUrl: 'https://github.com/o/r/', heading: true, commits: resolveRelease([{ message: 'Fix: A', hash: 'a'.repeat(40) }]).commits })
    expect(notes).toContain('## [1.0.0](https://github.com/o/r/commits/v1.0.0)')
    expect(notes).toContain('(https://github.com/o/r/commit/' + 'a'.repeat(40) + ')')
})

test('lists breaking `!` headers and multi-line breaking notes', () => {
    const header = renderReleaseNotes({ version: '2.0.0', commits: resolveRelease([{ message: 'Fix!: Remove the old API' }], { mode: 'auto' }).commits })
    expect(header).toContain('### ⚠ Breaking Changes\n\n- Remove the old API\n')
    const footer = renderReleaseNotes({ version: '2.0.0', commits: resolveRelease([{ message: 'Bump(Major): V2\n\nBREAKING CHANGE: first\n- item\n\nsecond paragraph' }]).commits })
    expect(footer).toContain('- first\n  - item\n\n  second paragraph\n')
})

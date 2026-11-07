import { renderReleaseNotes, resolveRelease } from '../src'

const decisions = resolveRelease([
    { hash: 'a'.repeat(40), message: 'Bump(Major): Aronrepo v3\n\nBREAKING CHANGE: Releases default to explicit mode.\n\nBREAKING CHANGE: Remove the adapters.' },
    { hash: 'b'.repeat(40), message: 'Fix(Release): Keep workspace ranges' },
    { hash: 'c'.repeat(40), message: 'Add(CLI): Add the release command' },
    { hash: 'd'.repeat(40), message: 'Add: Export the release planner' },
    { hash: 'e'.repeat(40), message: 'Feat(Check): Lint PR titles' },
    { hash: 'f'.repeat(40), message: 'Chore(Agent): Refresh guidance' },
    { hash: '1'.repeat(40), message: 'Improve(Release): Explain skipped commits\n\nBREAKING CHANGE: Ignored in explicit mode.' }
], { mode: 'explicit' }).commits

test('renders grouped release notes with breaking changes first', () => {
    expect(renderReleaseNotes({
        version: '3.0.0',
        previousTag: 'v2.2.1',
        date: '2026-11-07',
        repositoryUrl: 'https://github.com/1aron/aronrepo',
        commits: decisions
    })).toBe([
        '## [3.0.0](https://github.com/1aron/aronrepo/compare/v2.2.1...v3.0.0) (2026-11-07)',
        '',
        '### ⚠ Breaking Changes',
        '',
        '- Releases default to explicit mode.',
        '- Remove the adapters.',
        '',
        '### Additions',
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
        ''
    ].join('\n'))
})

test('leaves out commits that do not release', () => {
    const notes = renderReleaseNotes({ version: '1.0.1', commits: resolveRelease([{ message: 'Docs: Add notes' }]).commits })
    expect(notes).toBe('## 1.0.1\n\nNo changes to published packages.\n')
})

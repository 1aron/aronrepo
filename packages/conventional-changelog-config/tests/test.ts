import { CommitParser } from 'conventional-commits-parser'
import type { Context, Options } from 'conventional-changelog-writer'
import { transformCommit, writeChangelogString } from 'conventional-changelog-writer'
import createPreset, { parserOpts, recommendedBumpOpts, writerOpts } from '../src'

type ParsedCommit = ReturnType<CommitParser['parse']> & {
    hash: string
}

const context = {
    version: '1.2.3',
    date: '2026-06-26',
    linkReferences: false
} satisfies Context<ParsedCommit>

const groupedWriterOpts = {
    ...(writerOpts as Options<ParsedCommit>),
    mainTemplate: [
        '{{#each commitGroups}}',
        '### {{title}}',
        '{{#each commits}}',
        '{{> commit root=@root}}',
        '{{/each}}',
        '{{/each}}',
        '{{> footer}}'
    ].join('\n')
} satisfies Options<ParsedCommit>

function parseCommit(message: string, hash = '0000000000000000000000000000000000000000') {
    return {
        ...new CommitParser(parserOpts).parse(message),
        hash
    }
}

function parseBumpCommits(messages: string[]) {
    return messages.map((message) => {
        const { scope, type } = new CommitParser(parserOpts).parse(message)

        return {
            scope: scope ?? undefined,
            type: type ?? undefined
        }
    })
}

test.each([
    ['Feat(Core): Add parser', { type: 'Feat', scope: 'Core', subject: 'Add parser' }],
    ['Docs(README): Clarify package installation', { type: 'Docs', scope: 'README', subject: 'Clarify package installation' }],
    ['Bump(Major): Drop deprecated runtime', { type: 'Bump', scope: 'Major', subject: 'Drop deprecated runtime' }]
])('parses Aronrepo commit header %s', (message, expected) => {
    expect(new CommitParser(parserOpts).parse(message)).toMatchObject({
        header: message,
        ...expected
    })
})

test.each([
    {
        messages: ['Bump(Major): Drop deprecated runtime'],
        level: 0,
        reason: 'Major: 1, Minor: 0, Patch: 0'
    },
    {
        messages: ['Feat(Core): Add parser', 'Fix(API): Preserve token'],
        level: 1,
        reason: 'Major: 0, Minor: 1, Patch: 1'
    },
    {
        messages: ['Fix(API): Preserve token'],
        level: 2,
        reason: 'Major: 0, Minor: 0, Patch: 1'
    },
    {
        messages: ['Docs(README): Clarify package installation'],
        level: 2,
        reason: 'Major: 0, Minor: 0, Patch: 1'
    },
    {
        messages: ['Docs: Update internal guide', 'Chore(Agent): Update repository guidance'],
        level: null,
        reason: 'Major: 0, Minor: 0, Patch: 0'
    },
    {
        messages: ['Fix(API): Preserve token', 'Bump(Major): Drop deprecated runtime', 'Feat(Core): Add parser'],
        level: 0,
        reason: 'Major: 1, Minor: 1, Patch: 1'
    }
])('recommends release bump for $messages', ({ messages, level, reason }) => {
    expect(recommendedBumpOpts.whatBump(parseBumpCommits(messages))).toEqual({
        level,
        reason
    })
})

test('returns writer transform patches without mutating immutable commits', async () => {
    const commit = parseCommit('Update(Core): Move old -> new <- legacy', 'abcdef1234567890abcdef1234567890abcdef12')
    const transform = (writerOpts as Options<ParsedCommit>).transform

    if (!transform) throw new Error('Expected writer transform to be configured.')

    await expect(transformCommit(commit, transform)).resolves.toMatchObject({
        header: 'Update(Core): Move old → new ← legacy',
        raw: {
            header: 'Update(Core): Move old -> new <- legacy',
            type: 'Update'
        },
        references: [],
        shortHash: 'abcdef1',
        type: 'Updates'
    })
    expect(commit).toMatchObject({
        header: 'Update(Core): Move old -> new <- legacy',
        type: 'Update'
    })
    expect(commit).not.toHaveProperty('shortHash')
})

test('writes changelog markdown through conventional-changelog-writer', async () => {
    const changelog = await writeChangelogString([
        parseCommit('Fix(Core): Repair cache', 'ccccccc0000000000000000000000000000000000'),
        parseCommit('Fix(API): Preserve token', 'bbbbbbb0000000000000000000000000000000000'),
        parseCommit('Update(Core): Move old -> new <- legacy', 'aaaaaaa0000000000000000000000000000000000'),
        parseCommit('Feat(Core): Add parser', '11111110000000000000000000000000000000000'),
        parseCommit('Docs: Update internal guide', '33333330000000000000000000000000000000000'),
        parseCommit('Docs(README): Clarify package installation', '44444440000000000000000000000000000000000'),
        parseCommit('Chore(Agent): Update repository guidance', '55555550000000000000000000000000000000000')
    ], context, groupedWriterOpts)

    expect(changelog).toContain('### New Features')
    expect(changelog).toContain('### Updates')
    expect(changelog).toContain('### Bug Fixes')
    expect(changelog).toContain('### Documentation')
    expect(changelog.indexOf('### New Features')).toBeLessThan(changelog.indexOf('### Updates'))
    expect(changelog.indexOf('### Updates')).toBeLessThan(changelog.indexOf('### Bug Fixes'))
    expect(changelog.indexOf('### Bug Fixes')).toBeLessThan(changelog.indexOf('### Documentation'))
    expect(changelog.indexOf('Fix(API): Preserve token')).toBeLessThan(changelog.indexOf('Fix(Core): Repair cache'))
    expect(changelog).toContain('Update(Core): Move old → new ← legacy aaaaaaa')
    expect(changelog).toContain('Feat(Core): Add parser 1111111')
    expect(changelog).toContain('Docs: Update internal guide 3333333')
    expect(changelog).not.toContain('Clarify package installation')
    expect(changelog).not.toContain('Update repository guidance')
})

test('creates conventional changelog preset', async () => {
    await expect(createPreset()).resolves.toMatchObject({
        parserOpts,
        recommendedBumpOpts,
        writerOpts
    })
})

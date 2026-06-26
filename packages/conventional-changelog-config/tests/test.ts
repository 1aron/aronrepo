import createPreset, { parserOpts, recommendedBumpOpts, writerOpts } from '../src'

test('parses Aronrepo commit headers', () => {
    const match = 'Feat(Core): Add parser'.match(parserOpts.headerPattern)
    expect(match?.slice(1)).toEqual(['Feat', 'Core', 'Add parser'])
})

test('recommends release bumps', () => {
    expect(recommendedBumpOpts.whatBump([{ type: 'Feat' }]).level).toBe(1)
    expect(recommendedBumpOpts.whatBump([{ type: 'Fix' }]).level).toBe(2)
})

test('recommends release bumps with scoped rules', () => {
    expect(recommendedBumpOpts.whatBump([{ type: 'Docs', scope: 'README' }]).level).toBe(2)
    expect(recommendedBumpOpts.whatBump([{ type: 'Docs' }]).level).toBe(null)
})

test('uses scoped rules when transforming changelog commits', () => {
    expect(writerOpts.transform({
        type: 'Docs',
        scope: 'README',
        subject: 'Clarify package installation'
    })).toBeUndefined()
})

test('creates conventional changelog preset', async () => {
    await expect(createPreset()).resolves.toMatchObject({
        parserOpts,
        recommendedBumpOpts,
        writerOpts
    })
})

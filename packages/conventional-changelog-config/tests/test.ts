import createPreset, { parserOpts, recommendedBumpOpts, writerOpts } from '../src'

test('parses Aronrepo commit headers', () => {
    const match = 'Feat(Core): Add parser'.match(parserOpts.headerPattern)
    expect(match?.slice(1)).toEqual(['Feat', 'Core', 'Add parser'])
})

test('recommends release bumps', () => {
    expect(recommendedBumpOpts.whatBump([{ type: 'Feat' }]).level).toBe(1)
    expect(recommendedBumpOpts.whatBump([{ type: 'Fix' }]).level).toBe(2)
})

test('creates conventional changelog preset', async () => {
    await expect(createPreset()).resolves.toMatchObject({
        parserOpts,
        recommendedBumpOpts,
        writerOpts
    })
})

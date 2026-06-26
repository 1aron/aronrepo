import lint from '@commitlint/lint'
import config from '../src'

const rules = config.rules as unknown as Parameters<typeof lint>[1]
const parserOpts = { parserOpts: config.parserPreset.parserOpts }

test('accepts Aronrepo commit title', async () => {
    const result = await lint(
        'Feat(Core): Add ESM builder',
        rules,
        parserOpts
    )
    expect(result.valid).toBe(true)
})

test('accepts agent chore commit title', async () => {
    const result = await lint(
        'Chore(Agent): Update repository guidance for coding agents',
        rules,
        parserOpts
    )
    expect(result.valid).toBe(true)
})

test('accepts scoped README docs commit title', async () => {
    const result = await lint(
        'Docs(README): Clarify package installation',
        rules,
        parserOpts
    )
    expect(result.valid).toBe(true)
})

test('rejects lowercase commit type', async () => {
    const result = await lint(
        'feat(core): add esm builder',
        rules,
        parserOpts
    )
    expect(result.valid).toBe(false)
})

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

test.each([
    'Benchmark(Benchmarks): Refresh benchmark report',
    'Benchmark: Refresh benchmark report'
])('accepts benchmark-only commit title as non-release work %s', async (message) => {
    const result = await lint(message, rules, parserOpts)
    expect(result.valid).toBe(true)
})

test.each([
    'Build(Tooling): Update Vitest config',
    'CI(GitHub): Update PR title check permissions',
    'Style(Lint): Format TypeScript files',
    'Chore(Deps): Update Vitest dev dependency',
    'Example(Release): Add semantic-release config sample'
])('accepts non-release maintenance commit title %s', async (message) => {
    const result = await lint(message, rules, parserOpts)
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

test('rejects arbitrary uppercase commit type', async () => {
    const result = await lint(
        'FIX(Core): Repair cache',
        rules,
        parserOpts
    )
    expect(result.valid).toBe(false)
})

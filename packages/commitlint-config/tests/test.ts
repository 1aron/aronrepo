import lint from '@commitlint/lint'
import config, { plugin } from '../src'

const rules = config.rules as unknown as Parameters<typeof lint>[1]
const parserOpts = {
    parserOpts: config.parserPreset.parserOpts,
    plugins: { aronrepo: plugin }
} as unknown as Parameters<typeof lint>[2]

function withMode(mode: 'explicit' | 'auto') {
    return {
        ...rules,
        'aronrepo/no-implicit-breaking': [2, 'always', { mode }]
    } as unknown as Parameters<typeof lint>[1]
}

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

test.each([
    'Random message',
    'Update the cache',
    'feat: add builder',
    'Fix(Core):',
    'Feat(Core)!: Drop Node 24'
])('rejects headers without an Aronrepo type and subject %s', async (message) => {
    const result = await lint(message, rules, parserOpts)
    expect(result.valid).toBe(false)
})

const breakingFooter = 'Update(Integrations): Rename pre-render mode to prerender\n\nBREAKING CHANGE: Use prerender instead of pre-render.'

test('rejects breaking footers outside Bump(Major) in explicit mode', async () => {
    const result = await lint(breakingFooter, withMode('explicit'), parserOpts)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([expect.objectContaining({
        name: 'aronrepo/no-implicit-breaking',
        message: expect.stringMatching(/Bump\(Major\)/)
    })])
})

test('accepts breaking notes on Bump(Major) in explicit mode', async () => {
    const result = await lint('Bump(Major): Aronrepo v3\n\nBREAKING CHANGE: Explicit mode is the default.', withMode('explicit'), parserOpts)
    expect(result.valid).toBe(true)
})

test('accepts breaking footers in auto mode', async () => {
    const result = await lint(breakingFooter, withMode('auto'), parserOpts)
    expect(result.valid).toBe(true)
})

test('defaults the breaking rule to explicit mode without aronrepo.config.js', async () => {
    const result = await lint(breakingFooter, rules, parserOpts)
    expect(result.valid).toBe(false)
})

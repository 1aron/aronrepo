import {
    agentCommitPolicy,
    commits,
    findCommitRule,
    getReleaseType,
    nonReleaseTypes,
    releaseTypes,
    types
} from '../src'

test('exports commit types', () => {
    expect(types).toContain('Feat')
    expect(types).toContain('Fix')
    expect(types).toContain('Benchmark')
    expect(types).toEqual(expect.arrayContaining(['Build', 'CI', 'Style']))
    expect(commits.find(({ type }) => type === 'Feat')?.release).toBe('minor')
})

test('exports release and non-release type groups', () => {
    expect(releaseTypes).toEqual(expect.arrayContaining(['Bump', 'Feat', 'Fix']))
    expect(nonReleaseTypes).toEqual(expect.arrayContaining(['Benchmark', 'Build', 'Chore', 'CI', 'Docs', 'Style', 'Test']))
})

test('finds scoped commit rules before unscoped rules', () => {
    expect(findCommitRule('Docs', 'README')?.release).toBe('patch')
    expect(getReleaseType('Docs')).toBe(false)
    expect(getReleaseType('Docs', 'Agent')).toBe(false)
    expect(getReleaseType('Benchmark')).toBe(false)
    expect(getReleaseType('Benchmark', 'Benchmarks')).toBe(false)
    expect(getReleaseType('Benchmark', 'Runtime')).toBe(false)
    expect(getReleaseType('Build', 'Tooling')).toBe(false)
    expect(getReleaseType('CI', 'GitHub')).toBe(false)
    expect(getReleaseType('Style', 'Lint')).toBe(false)
})

test('exports agent commit policy', () => {
    expect(agentCommitPolicy.defaultInternalCommit).toBe('Chore(Agent): Clarify commit selection policy')
    expect(agentCommitPolicy.examples).toEqual(expect.arrayContaining([
        expect.objectContaining({
            commit: 'Chore(Agent): Update repository guidance for coding agents',
            release: false
        }),
        expect.objectContaining({
            commit: 'Benchmark(Benchmarks): Refresh benchmark report',
            avoid: 'Perf(Benchmarks): Refresh benchmark report',
            release: false
        }),
        expect.objectContaining({
            commit: 'Benchmark: Refresh benchmark report',
            release: false
        }),
        expect.objectContaining({
            commit: 'CI(GitHub): Update PR title check permissions',
            avoid: 'Fix(CI): Update PR title check permissions',
            release: false
        }),
        expect.objectContaining({
            commit: 'Build(Tooling): Update Vitest config',
            avoid: 'Update(Build): Update Vitest config',
            release: false
        }),
        expect.objectContaining({
            commit: 'Style(Lint): Format TypeScript files',
            avoid: 'Improve(Core): Format TypeScript files',
            release: false
        })
    ]))
})

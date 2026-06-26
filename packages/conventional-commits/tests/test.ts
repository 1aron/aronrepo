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
    expect(commits.find(({ type }) => type === 'Feat')?.release).toBe('minor')
})

test('exports release and non-release type groups', () => {
    expect(releaseTypes).toEqual(expect.arrayContaining(['Bump', 'Feat', 'Fix']))
    expect(nonReleaseTypes).toEqual(expect.arrayContaining(['Chore', 'Docs', 'Test']))
})

test('finds scoped commit rules before unscoped rules', () => {
    expect(findCommitRule('Docs', 'README')?.release).toBe('patch')
    expect(getReleaseType('Docs')).toBe(false)
    expect(getReleaseType('Docs', 'Agent')).toBe(false)
})

test('exports agent commit policy', () => {
    expect(agentCommitPolicy.defaultInternalCommit).toBe('Chore(Agent): Clarify commit selection policy')
    expect(agentCommitPolicy.examples).toEqual(expect.arrayContaining([
        expect.objectContaining({
            commit: 'Chore(Agent): Update repository guidance for coding agents',
            release: false
        })
    ]))
})

import { commits, types } from '../src'

test('exports commit types', () => {
    expect(types).toContain('Feat')
    expect(types).toContain('Fix')
    expect(commits.find(({ type }) => type === 'Feat')?.release).toBe('minor')
})

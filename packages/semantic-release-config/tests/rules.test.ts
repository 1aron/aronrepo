import { analyzeCommits } from '@semantic-release/commit-analyzer'
import commitFalsely from '../../../utils/commit-falsely'
import releaseRules from '../rules'
console.log(releaseRules)

const createLogSpy = () => jest.spyOn(console, 'log').mockImplementation(() => null)

test('Parse with "conventional-changelog-aron" by default', async () => {
    const logSpy = createLogSpy()
    const commits = commitFalsely(
        'Fix(Scope1): First fix',
        'Feat(Scope2): Second feature'
    )
    const releaseType = await analyzeCommits(
        { preset: 'aron', releaseRules },
        { cwd: process.cwd(), commits, logger: console }
    )
    expect(releaseType).toBe('minor')
    expect(logSpy).toHaveBeenCalledWith('Analyzing commit: %s', commits[0].message)
    expect(logSpy).toHaveBeenCalledWith('The release type for the commit is %s', 'patch')
    expect(logSpy).toHaveBeenCalledWith('Analyzing commit: %s', commits[1].message)
    expect(logSpy).toHaveBeenCalledWith('The release type for the commit is %s', 'minor')
    expect(logSpy).toHaveBeenCalledWith('Analysis of %s commits complete: %s release', 2, 'minor')
    logSpy.mockRestore()
})

test('Docs(README) -> +0.0.1 Patch', async () => {
    const logSpy = createLogSpy()
    const commits = commitFalsely('Docs(README): Something')
    const releaseType = await analyzeCommits(
        { preset: 'aron', releaseRules },
        { cwd: process.cwd(), commits, logger: console }
    )
    expect(releaseType).toBe('patch')
    logSpy.mockRestore()
})

test('Bump(Major) -> +1.0.0 Major', async () => {
    const commits = commitFalsely('Bump(Major): Master CSS `v2.0.0`')
    const releaseType = await analyzeCommits(
        { preset: 'aron', releaseRules },
        { cwd: process.cwd(), commits, logger: console }
    )
    expect(releaseType).toBe('major')
})

test('Exclude commits if they have a matching revert commits', async () => {
    const logSpy = createLogSpy()
    const commits = commitFalsely(
        { message: 'Feat(Scope): First feature', hash: '123', },
        { message: 'Revert: Feat(Scope): First feature\n\nThis reverts commit 123.\n', hash: '456', },
        'Fix(Scope): First fix'
    )
    const releaseType = await analyzeCommits(
        { preset: 'aron', releaseRules },
        { cwd: process.cwd(), commits, logger: console }
    )
    expect(releaseType).toBe('patch')
    expect(logSpy).toHaveBeenCalledWith('Analyzing commit: %s', commits[2].message)
    expect(logSpy).toHaveBeenCalledWith('The release type for the commit is %s', 'patch')
    expect(logSpy).toHaveBeenCalledWith('Analysis of %s commits complete: %s release', 3, 'patch')
    logSpy.mockRestore()
})

test('Return "patch" if there is only types set to "patch"', async () => {
    const logSpy = createLogSpy()
    const commits = commitFalsely(
        'Fix: Something #123',
        'Perf: Improvement'
    )
    const releaseType = await analyzeCommits(
        { preset: 'aron', releaseRules },
        { cwd: process.cwd(), commits, logger: console }
    )
    expect(releaseType).toBe('patch')
    expect(logSpy).toHaveBeenCalledWith('Analyzing commit: %s', commits[0].message)
    expect(logSpy).toHaveBeenCalledWith('The release type for the commit is %s', 'patch')
    expect(logSpy).toHaveBeenCalledWith('Analyzing commit: %s', commits[1].message)
    expect(logSpy).toHaveBeenCalledWith('The release type for the commit is %s', 'patch')
    expect(logSpy).toHaveBeenCalledWith('Analysis of %s commits complete: %s release', 2, 'patch')
    logSpy.mockRestore()
})

test('Return "null" if no rule match', async () => {
    const commits = commitFalsely(
        'Docs: Change',
        'Chore: Misc',
        'Any'
    )
    const releaseType = await analyzeCommits(
        { preset: 'aron', releaseRules },
        { cwd: process.cwd(), commits, logger: console }
    )
    expect(releaseType).toBe(null)
})
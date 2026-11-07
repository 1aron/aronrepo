import {
    agentsBlockEnd,
    agentsBlockStart,
    createReleasePathMatcher,
    defineConfig,
    getAgentCommitPolicy,
    getReleasePolicy,
    getReleaseTable,
    getReleaseType,
    parseCommit,
    renderAgentsBlock,
    resolveCommitRelease,
    resolveRelease,
    type ReleasePolicy
} from '../src'

const explicit: ReleasePolicy = { mode: 'explicit' }
const auto: ReleasePolicy = { mode: 'auto' }

// The Master CSS 2.0.1 incident: a patch type with a breaking footer released 3.0.0.
const incident = [
    'Improve(Integrations): Rename pre-render mode to prerender',
    '',
    'Use prerender across integrations.',
    '',
    'BREAKING CHANGE: Use prerender instead of pre-render in mode settings.'
].join('\n')

test('defaults to explicit mode', () => {
    expect(getReleasePolicy()).toEqual({ mode: 'explicit' })
    expect(getReleasePolicy(defineConfig({ release: { mode: 'auto' } }))).toEqual({ mode: 'auto' })
    expect(() => getReleasePolicy({ release: { mode: 'yolo' as never } })).toThrow(/Unknown Aronrepo release mode/)
})

test('caps non-Bump types at patch in explicit mode', () => {
    expect(getReleaseType('Feat')).toBe('patch')
    expect(getReleaseType('New', undefined, explicit)).toBe('patch')
    expect(getReleaseType('Feat', undefined, auto)).toBe('minor')
    expect(getReleaseType('Bump', 'Minor')).toBe('minor')
    expect(getReleaseType('Bump', 'Major')).toBe('major')
    expect(getReleaseType('Chore')).toBe(false)
    expect(getReleaseType('Unknown')).toBeUndefined()
})

test('parses headers, breaking markers, and reverts', () => {
    expect(parseCommit(incident)).toMatchObject({
        type: 'Improve',
        scope: 'Integrations',
        subject: 'Rename pre-render mode to prerender',
        breaking: 'footer'
    })
    expect(parseCommit('Feat(Core)!: Drop Node 24')).toMatchObject({ type: 'Feat', scope: 'Core', breaking: 'header' })
    expect(parseCommit('Revert "Fix(Core): Repair cache"\n\nThis reverts commit abc1234def.')).toMatchObject({
        revert: { header: 'Fix(Core): Repair cache', hash: 'abc1234def' }
    })
    expect(parseCommit('Merge pull request #1 from a/b').type).toBeUndefined()
})

test('ignores breaking footers in explicit mode', () => {
    const decision = resolveCommitRelease(incident, explicit)
    expect(decision.release).toBe('patch')
    expect(decision.violations).toEqual([expect.objectContaining({ rule: 'implicit-breaking' })])
})

test('releases major for breaking footers in auto mode', () => {
    const decision = resolveCommitRelease(incident, auto)
    expect(decision.release).toBe('major')
    expect(decision.violations).toEqual([])
})

test('allows breaking notes on Bump(Major)', () => {
    const decision = resolveCommitRelease('Bump(Major): Aronrepo v3\n\nBREAKING CHANGE: Explicit mode is the default.', explicit)
    expect(decision.release).toBe('major')
    expect(decision.violations).toEqual([])
})

test('caps Feat at patch in explicit mode and keeps minor in auto mode', () => {
    expect(resolveCommitRelease('Feat(Commit): Add non-release Benchmark type', explicit).release).toBe('patch')
    expect(resolveCommitRelease('Feat(Commit): Add non-release Benchmark type', auto).release).toBe('minor')
    expect(resolveCommitRelease('Bump(Minor): Prepare the plugin API', explicit).release).toBe('minor')
})

test('never falls back to default rules for unparsed headers', () => {
    const merge = resolveCommitRelease('Merge branch next\n\nBREAKING CHANGE: something', auto)
    expect(merge.release).toBe(false)
    expect(merge.violations).toEqual([expect.objectContaining({ rule: 'header-format' })])

    const lowercase = resolveCommitRelease('feat: add builder', auto)
    expect(lowercase.release).toBe(false)

    const unknown = resolveCommitRelease('Feature(Core): Add builder', auto)
    expect(unknown.release).toBe(false)
    expect(unknown.violations).toEqual([expect.objectContaining({ rule: 'unknown-type' })])
})

test('explains why a header does not parse', () => {
    const message = (header: string) => resolveCommitRelease(header).violations[0]?.message
    expect(message('Fix(semantic-release-pnpm): Skip whoami')).toMatch(/scope `semantic-release-pnpm` must start with an uppercase letter/)
    expect(message('fix(Core): Repair cache')).toMatch(/type `fix` must be PascalCase, such as `Fix`/)
    expect(message('Fix(Core): repair cache')).toMatch(/summary must start with an uppercase letter/)
    expect(message('Update the cache')).toMatch(/^Use `Type\(Scope\): Summary`/)
})

test('reverts inherit the release of the reverted header', () => {
    expect(resolveCommitRelease('Revert "Chore(Agent): Update guide"\n\nThis reverts commit abc1234.').release).toBe(false)
    expect(resolveCommitRelease('Revert "Fix(Core): Repair cache"\n\nThis reverts commit abc1234.').release).toBe('patch')
    expect(resolveCommitRelease('Revert: Fix(Core): Repair cache').release).toBe('patch')
    expect(resolveCommitRelease('Revert(Core): Restore the cache layer').release).toBe('patch')
})

test('a revert and its target cancel out in the same release', () => {
    const decision = resolveRelease([
        { hash: 'aaaaaaa111', message: 'Fix(Core): Repair cache' },
        { hash: 'bbbbbbb222', message: 'Revert "Fix(Core): Repair cache"\n\nThis reverts commit aaaaaaa111.' }
    ])
    expect(decision.release).toBe(false)
    expect(decision.commits.map(({ release }) => release)).toEqual([false, false])
})

test('clamps release types that touch no release paths', () => {
    const isReleasePath = createReleasePathMatcher({ include: ['packages/core/**'] })!
    const site = resolveCommitRelease('Fix(Site): Repair the header', explicit, { files: ['site/app.ts'], isReleasePath })
    expect(site.release).toBe(false)
    expect(site.violations).toEqual([expect.objectContaining({
        rule: 'release-paths',
        suggestion: 'Chore(Site): Repair the header'
    })])

    const rootReadme = resolveCommitRelease('Docs(README): Clarify setup', explicit, { files: ['README.md'], isReleasePath })
    expect(rootReadme.release).toBe(false)
    expect(rootReadme.violations[0].suggestion).toBe('Docs: Clarify setup')

    const deps = resolveCommitRelease('Upgrade(Deps): Update Vitest', explicit, { files: ['package.json', 'pnpm-lock.yaml'], isReleasePath })
    expect(deps.violations[0].suggestion).toBe('Chore(Deps): Update Vitest')

    const tests = resolveCommitRelease('Fix(Core): Repair cache', explicit, { files: ['packages/core/tests/cache.test.ts'], isReleasePath })
    expect(tests.release).toBe(false)

    const core = resolveCommitRelease('Fix(Core): Repair cache', explicit, { files: ['packages/core/src/cache.ts', 'site/app.ts'], isReleasePath })
    expect(core.release).toBe('patch')
    expect(core.violations).toEqual([])

    const bump = resolveCommitRelease('Bump(Major): Aronrepo v3', explicit, { files: [], isReleasePath })
    expect(bump.release).toBe('major')
})

test('resolves legacy types like their replacements and rejects them in new commits', () => {
    const feat = resolveCommitRelease('Feat(Core): Add a builder', auto)
    expect(feat.release).toBe('minor')
    expect(feat.violations).toEqual([expect.objectContaining({
        rule: 'legacy-type',
        suggestion: 'Add(Core): Add a builder'
    })])
    expect(resolveCommitRelease('Update: Rename the option', explicit)).toMatchObject({
        release: 'patch',
        violations: [expect.objectContaining({ rule: 'legacy-type', suggestion: 'Improve: Rename the option' })]
    })
    expect(resolveCommitRelease('Misc: Tidy up', explicit).release).toBe(false)
})

test('rejects a summary that ends with a period', () => {
    expect(resolveCommitRelease('Fix(Core): Repair the cache.', explicit).violations).toEqual([
        expect.objectContaining({ rule: 'subject-full-stop', suggestion: 'Fix(Core): Repair the cache' })
    ])
    expect(resolveCommitRelease('Fix(Core): Support v1.2', explicit).violations).toEqual([])
})

test('warns about missing blank lines without failing', () => {
    const decision = resolveCommitRelease('Fix(Core): Repair the cache\nIt was stale.\nBREAKING CHANGE: Clear it.', auto)
    expect(decision.release).toBe('major')
    expect(decision.violations).toEqual([
        expect.objectContaining({ rule: 'body-leading-blank', severity: 'warning' }),
        expect.objectContaining({ rule: 'footer-leading-blank', severity: 'warning' })
    ])
})

test('reads breaking notes from footers', () => {
    expect(parseCommit([
        'Bump(Major): Aronrepo v3',
        '',
        'BREAKING CHANGE: Releases default to explicit mode.',
        'Set `release.mode` to keep the old behavior.',
        '',
        'BREAKING CHANGE: Remove the adapters.',
        'Co-Authored-By: Someone <a@b.c>'
    ].join('\n')).breakingNotes).toEqual([
        'Releases default to explicit mode. Set `release.mode` to keep the old behavior.',
        'Remove the adapters.'
    ])
})

test('rejects Bump without a release scope', () => {
    expect(resolveCommitRelease('Bump: Aronrepo v3', explicit)).toMatchObject({
        release: false,
        violations: [expect.objectContaining({ rule: 'unknown-type', message: expect.stringContaining('`Bump(Major)`') })]
    })
    expect(resolveCommitRelease('Bump(Huge): Aronrepo v3', explicit).release).toBe(false)
})

test('takes the highest release of a range', () => {
    expect(resolveRelease([
        { message: 'Chore(Agent): Update guide' },
        { message: 'Fix(Core): Repair cache' },
        { message: 'Feat(Core): Add builder' }
    ], explicit).release).toBe('patch')
    expect(resolveRelease([
        { message: 'Fix(Core): Repair cache' },
        { message: 'Feat(Core): Add builder' }
    ], auto).release).toBe('minor')
    expect(resolveRelease([{ message: 'Docs: Add notes' }]).release).toBe(false)
})

test('describes the release table for each mode', () => {
    expect(getReleaseTable(explicit)).toMatchObject({
        major: ['`Bump(Major)`'],
        minor: ['`Bump(Minor)`'],
        patch: expect.arrayContaining(['`Add`', '`Fix`', '`Docs(README)`'])
    })
    expect(getReleaseTable(auto)).toMatchObject({
        major: ['`Bump(Major)`', '`BREAKING CHANGE:` footer'],
        minor: expect.arrayContaining(['`Add`', '`Bump(Minor)`'])
    })
})

test('agent policy reserves release decisions for the owner', () => {
    const policy = getAgentCommitPolicy(explicit)
    expect(policy.mode).toBe('explicit')
    expect(policy.ownerDecisions.join('\n')).toMatch(/Never write `Bump\(Major\)`/)
    expect(policy.ownerDecisions.join('\n')).toMatch(/Never add a `BREAKING CHANGE:` footer/)
    expect(policy.examples).toEqual(expect.arrayContaining([
        expect.objectContaining({ commit: 'Chore(Site): Fix the homepage header transition', release: false })
    ]))
    expect(getAgentCommitPolicy(auto).ownerDecisions.join('\n')).toMatch(/releases a major version/)
})

test('renders a stable AGENTS.md block', () => {
    const block = renderAgentsBlock(explicit, { releasePaths: { include: ['packages/core/**'] } })
    expect(block.startsWith(agentsBlockStart)).toBe(true)
    expect(block.endsWith(agentsBlockEnd)).toBe(true)
    expect(block).toContain('Release mode: **explicit**')
    expect(block).toContain('- `packages/core/**`')
    expect(renderAgentsBlock(explicit)).toContain('Every path can release a version')
    expect(renderAgentsBlock(explicit)).toBe(renderAgentsBlock(explicit))
})

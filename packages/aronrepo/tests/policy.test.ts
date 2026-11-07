import {
    agentsBlockEnd,
    agentsBlockStart,
    commits,
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

    // Types, scopes, and summaries match without case.
    expect(resolveCommitRelease('feat(core): add builder', auto)).toMatchObject({ type: 'Feat', scope: 'core', subject: 'add builder', release: 'minor', violations: [] })
    expect(resolveCommitRelease('bump(minor): release the theme API')).toMatchObject({ type: 'Bump', scope: 'Minor', release: 'minor' })
    expect(resolveCommitRelease('docs(readme): clarify setup')).toMatchObject({ type: 'Docs', scope: 'README', release: 'patch' })

    const unknown = resolveCommitRelease('Feature(Core): Add builder', auto)
    expect(unknown.release).toBe(false)
    expect(unknown.violations).toEqual([expect.objectContaining({ rule: 'unknown-type' })])
})

test('explains why a header does not parse', () => {
    const message = (header: string) => resolveCommitRelease(header).violations[0]?.message
    expect(resolveCommitRelease('Fix(semantic-release-pnpm): skip whoami').violations).toEqual([])
    expect(message('Fix(-core): Repair cache')).toMatch(/scope `-core` must start with a letter or digit/)
    expect(message('Fix(Core): -repair cache')).toMatch(/summary must start with a letter or digit/)
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
    const add = resolveCommitRelease('Add(Core): Add a builder', auto)
    expect(add.release).toBe('minor')
    expect(add.violations).toEqual([expect.objectContaining({
        rule: 'legacy-type',
        suggestion: 'Feat(Core): Add a builder'
    })])
    expect(resolveCommitRelease('add: a builder', auto)).toMatchObject({ release: 'minor', violations: [expect.objectContaining({ rule: 'legacy-type' })] })
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
        'Releases default to explicit mode.\nSet `release.mode` to keep the old behavior.',
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
        patch: expect.arrayContaining(['`Feat`', '`Fix`', '`Docs(README)`'])
    })
    expect(getReleaseTable(auto)).toMatchObject({
        major: ['`Bump(Major)`', '`BREAKING CHANGE:` footer', '`Type!:` header'],
        minor: expect.arrayContaining(['`Feat`', '`Bump(Minor)`'])
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

test('a scope ends at the first closing parenthesis', () => {
    expect(parseCommit('Fix(Core): Handle Foo(Bar): Baz')).toMatchObject({ type: 'Fix', scope: 'Core', subject: 'Handle Foo(Bar): Baz' })
})

test('reverting a revert keeps the original commit', () => {
    const decision = resolveRelease([
        { hash: 'aaaaaaa111', message: 'Fix(Core): Repair cache' },
        { hash: 'bbbbbbb222', message: 'Revert "Fix(Core): Repair cache"\n\nThis reverts commit aaaaaaa111.' },
        { hash: 'ccccccc333', message: 'Revert "Revert "Fix(Core): Repair cache""\n\nThis reverts commit bbbbbbb222.' }
    ])
    expect(decision.commits.map(({ release }) => release)).toEqual(['patch', false, false])
    expect(decision.release).toBe('patch')
})

test('recognizes squash-merged reverts, reapplies, and every reverted hash', () => {
    const fix = 'a'.repeat(40)
    const revert = 'b'.repeat(40)
    expect(parseCommit(`Revert "Fix: A (#12)" (#13)\n\nThis reverts commit ${fix}.`).revert).toEqual({ header: 'Fix: A (#12)', hash: fix, hashes: [fix] })
    const decision = resolveRelease([
        { hash: fix, message: 'Fix: A' },
        { hash: revert, message: `Revert "Fix: A"\n\nThis reverts commit ${fix}.` },
        { hash: 'c'.repeat(40), message: `Reapply "Fix: A"\n\nThis reverts commit ${revert}.` }
    ])
    expect(decision.commits.map(({ release, violations }) => [release, violations.length])).toEqual([['patch', 0], [false, 0], [false, 0]])

    const squashed = resolveRelease([
        { hash: 'd'.repeat(40), message: 'Fix: D' },
        { hash: 'e'.repeat(40), message: 'Fix: E' },
        { hash: 'f'.repeat(40), message: `Revert: Fix: D and E\n\nThis reverts commit ${'D'.repeat(40)}.\nThis reverts commit ${'e'.repeat(40)}.` }
    ])
    expect(squashed.release).toBe(false)
})

test('cancels nothing when a short reverted hash is ambiguous', () => {
    const decision = resolveRelease([
        { hash: 'abcdef1' + '1'.repeat(33), message: 'Add: Other' },
        { hash: 'abcdef1' + '2'.repeat(33), message: 'Fix: A' },
        { hash: 'c'.repeat(40), message: 'Revert "Fix: A"\n\nThis reverts commit abcdef1.' }
    ])
    expect(decision.commits.map(({ release }) => release)).toEqual(['patch', 'patch', 'patch'])
})

test('reverting a Bump releases a patch and reads breaking reverted headers', () => {
    expect(resolveCommitRelease('Revert "Bump(Major): Release 2.0"').release).toBe('patch')
    expect(resolveCommitRelease('Revert: Add!: A', auto).release).toBe('major')
})

test('accepts summaries in scripts without case and trims the header', () => {
    expect(resolveCommitRelease('Fix(Core): 修正快取').violations).toEqual([])
    expect(resolveCommitRelease('Fix: Ärger').violations).toEqual([])
    const decision = resolveCommitRelease('Fix: Thing.  \n\nBody')
    expect(decision.violations.map(({ rule, suggestion }) => [rule, suggestion])).toEqual([['subject-full-stop', 'Fix: Thing']])
    expect(resolveCommitRelease('fix(core)!: thing', auto)).toMatchObject({ release: 'major', violations: [] })
})

test('diagnoses spacing, legacy casing, and unknown scopes precisely', () => {
    const message = (header: string, policy = explicit) => resolveCommitRelease(header, policy).violations[0]?.message
    expect(message('Fix:  Thing')).toMatch(/^Put exactly one space after the colon/)
    expect(message('Fix:Thing')).toMatch(/^Put exactly one space after the colon/)
    expect(message('Fix!:Thing', auto)).toMatch(/^Put exactly one space after the colon/)
    expect(message('feature: X')).toMatch(/`feature` is not an Aronrepo commit type/)
    expect(message('Bump(Huge): X')).toBe('`Bump(Huge)` has an unknown scope. Use one of: `Bump(Major)`, `Bump(Minor)`, `Bump(Patch)`.')
    expect(resolveCommitRelease('Docs(Readme): Update')).toMatchObject({ scope: 'README', release: 'patch', violations: [] })
})

test('ignores breaking footers in code fences and keeps notes until the next token', () => {
    const fenced = parseCommit('Fix: A\n\n```\nBREAKING CHANGE: example\n```')
    expect(fenced.breaking).toBeUndefined()
    expect(fenced.layout).toBeUndefined()
    expect(parseCommit('Fix: A\n\n  BREAKING CHANGE: indented').breaking).toBeUndefined()
    expect(parseCommit('Bump(Major): A\n\nBREAKING CHANGE: first\n\nsecond paragraph\nSigned-off-by: X <x@y>').breakingNotes).toEqual(['first\n\nsecond paragraph'])
})

test('suggests valid non-release headers', () => {
    const files = { files: ['site/a.js'], isReleasePath: (file: string) => file.startsWith('packages/') }
    expect(resolveCommitRelease('Fix(Site): Tweak.', explicit, files).violations.find(({ rule }) => rule === 'release-paths')?.suggestion).toBe('Chore(Site): Tweak')
    const breakingChore = resolveCommitRelease('Chore!: X', auto, files).violations[0]
    expect(breakingChore.message).toMatch(/only because of its breaking marker/)
    expect(breakingChore.suggestion).toBe('Chore: X')
})

test('release path matchers read negated includes, missing includes, and test artifacts', () => {
    const negated = createReleasePathMatcher({ include: ['packages/**', '!packages/site/**'] })!
    expect(negated('packages/core/a.ts')).toBe(true)
    expect(negated('packages/site/a.ts')).toBe(false)
    expect(negated('README.md')).toBe(false)
    const excludeOnly = createReleasePathMatcher({ exclude: ['docs/**'] })!
    expect(excludeOnly('src/a.ts')).toBe(true)
    expect(excludeOnly('docs/a.md')).toBe(false)
    const defaults = createReleasePathMatcher({ include: ['src/**'] })!
    for (const file of ['src/a.test-d.ts', 'src/__snapshots__/a.snap', 'src/fixtures/a.json']) expect(defaults(file)).toBe(false)
})

test('rejects malformed release paths in the config', () => {
    expect(() => getReleasePolicy({ release: { paths: true as never } })).toThrow(/`release.paths` must be/)
    expect(() => getReleasePolicy({ release: { paths: { include: 'packages/**' as never } } })).toThrow(/include` must be an array/)
})

test('renders release paths from the policy and auto mode `!` headers', () => {
    expect(renderAgentsBlock({ mode: 'explicit', paths: { include: ['src/**'] } })).toContain('- `src/**`')
    expect(renderAgentsBlock({ mode: 'explicit', paths: { include: [] } })).toContain('No path can release a version in this repository.')
    expect(renderAgentsBlock({ mode: 'explicit', paths: { include: ['src/**'], exclude: [] } })).not.toContain('Excluding')
    expect(renderAgentsBlock(auto)).toContain('`Type!:` headers release major versions')
})

test('freezes the commit type table', () => {
    expect(Object.isFrozen(commits)).toBe(true)
    expect(Object.isFrozen(commits[0])).toBe(true)
})

test('validates release assets in the config', () => {
    expect(getReleasePolicy({ release: { assets: [{ path: 'dist/a.js', name: 'a-{tag}.js' }] } }).assets).toEqual([{ path: 'dist/a.js', name: 'a-{tag}.js' }])
    expect(() => getReleasePolicy({ release: { assets: [{ name: 'a.js' }] as never } })).toThrow(/`release.assets` must be an array/)
})

test('a revert with the reverted header ships only when its own files ship, without a violation', () => {
    const paths = { isReleasePath: (file: string) => file.startsWith('packages/') }
    const empty = { ...paths, files: [] }
    const site = { ...paths, files: ['site/a.js'] }
    const pkg = { ...paths, files: ['packages/core/a.js'] }
    // An empty revert of a `Bump`, as `git revert` writes it for a release that should not happen.
    expect(resolveCommitRelease('Revert "Bump(Patch): Release 2.0.4"\n\nThis reverts commit abcdef1.', explicit, empty)).toMatchObject({ release: false, violations: [] })
    expect(resolveCommitRelease('Revert: Bump(Major): Release 2.0', explicit, site)).toMatchObject({ release: false, violations: [] })
    expect(resolveCommitRelease('Revert "Bump(Major): Release 2.0"', explicit, pkg)).toMatchObject({ release: 'patch', violations: [] })
    // The reason names what the reverted commit releases, then why the revert does not.
    expect(resolveCommitRelease('Revert "Fix: A"', explicit, empty).reasons).toEqual([
        'Reverts `Fix: A`, which releases patch.',
        'The revert changes no release paths; no release.'
    ])
    // A revert written by hand still picks its type, so it still gets the suggestion.
    expect(resolveCommitRelease('Revert(Core): Undo the cache', explicit, site).violations[0].suggestion).toBe('Chore(Core): Undo the cache')
})

test('a revert of a header outside the policy releases like Revert', () => {
    const paths = { isReleasePath: (file: string) => file.startsWith('packages/') }
    const decision = resolveCommitRelease('Revert "Update the parser"\n\nThis reverts commit abcdef1.', explicit, { ...paths, files: ['packages/core/parser.js'] })
    expect(decision).toMatchObject({ release: 'patch', violations: [] })
    expect(decision.reasons[0]).toBe('Reverts `Update the parser`, which is not an Aronrepo header; it releases patch like `Revert`.')
    expect(resolveCommitRelease('Revert "feature: X"', explicit, { ...paths, files: ['site/a.js'] })).toMatchObject({ release: false, violations: [] })
})

test('a revert and an unreleased Bump cancel without release path violations', () => {
    const isReleasePath = (file: string) => file.startsWith('packages/')
    const bump = 'a'.repeat(40)
    const byHeader = resolveRelease([
        { hash: bump, message: 'Bump(Patch): Release 2.0.4', files: [] },
        { hash: 'b'.repeat(40), message: `Revert "Bump(Patch): Release 2.0.4"\n\nThis reverts commit ${bump}.`, files: [] }
    ], explicit, { isReleasePath })
    expect(byHeader.release).toBe(false)
    expect(byHeader.commits.map(({ violations }) => violations)).toEqual([[], []])
    // A revert written by hand names only the hash; the cancelled pair no longer asks for another type.
    const byHash = resolveRelease([
        { hash: bump, message: 'Bump(Minor): Release 2.1', files: [] },
        { hash: 'b'.repeat(40), message: `Revert(Release): Hold the minor release\n\nThis reverts commit ${bump}.`, files: [] }
    ], explicit, { isReleasePath })
    expect(byHash.release).toBe(false)
    expect(byHash.commits.map(({ violations }) => violations)).toEqual([[], []])
})

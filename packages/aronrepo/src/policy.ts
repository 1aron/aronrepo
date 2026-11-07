import picomatch from 'picomatch'
import { canonicalScope, canonicalType, commits, findCommitRule, legacyTypes, maxRelease, normalizeType, types, type ReleaseType } from './commits'

/**
 * - `explicit`: only `Bump(Major)` and `Bump(Minor)` raise major and minor versions.
 *   `Feat` releases a patch, and breaking markers never change the level.
 * - `auto`: `Feat` releases a minor version and a `BREAKING CHANGE:` footer or `!`
 *   header releases a major version, following Conventional Commits.
 */
export type ReleaseMode = 'explicit' | 'auto'

export const releaseModes = ['explicit', 'auto'] as const satisfies readonly ReleaseMode[]

export const defaultReleaseMode: ReleaseMode = 'explicit'

export interface ReleasePathsConfig {
    /** Globs, relative to the repository root, of files that ship in published packages. */
    include?: string[]
    /** Globs removed from `include`. Defaults to `defaultReleasePathExcludes`. */
    exclude?: string[]
}

/** A file attached to every GitHub release. */
export interface ReleaseAsset {
    /** File to upload, relative to the repository root. */
    path: string
    /** Asset name on the release; defaults to the file name. `{tag}` and `{version}` are replaced. */
    name?: string
    /** Text shown for the asset instead of its name. `{tag}` and `{version}` are replaced. */
    label?: string
}

export interface AronrepoConfig {
    release?: {
        mode?: ReleaseMode
        /** Files `aronrepo release` attaches to the GitHub release, such as browser bundles or checksums. */
        assets?: ReleaseAsset[]
        /**
         * Files whose changes can release a version. Omit it to derive the paths from
         * public workspace packages, or set `false` to turn the path check off.
         */
        paths?: ReleasePathsConfig | false
    }
}

export interface ReleasePolicy {
    mode: ReleaseMode
    paths?: ReleasePathsConfig | false
    assets?: ReleaseAsset[]
}

export const defaultReleasePathExcludes = [
    '**/tests/**',
    '**/test/**',
    '**/__tests__/**',
    '**/*.{test,spec}.*',
    '**/*.test-d.*',
    '**/__snapshots__/**',
    '**/__fixtures__/**',
    '**/__mocks__/**',
    '**/fixtures/**',
    '**/benchmarks/**',
    '**/examples/**',
    '**/CHANGELOG.md',
    '.github/**',
    '.husky/**'
]

export function defineConfig(config: AronrepoConfig) {
    return config
}

export function getReleasePolicy(config: AronrepoConfig = {}): ReleasePolicy {
    const mode = config.release?.mode ?? defaultReleaseMode
    if (!releaseModes.includes(mode)) {
        throw new Error(`Unknown Aronrepo release mode "${String(mode)}". Use one of: ${releaseModes.join(', ')}.`)
    }
    const paths = config.release?.paths
    if (paths !== undefined && paths !== false) validateReleasePaths(paths)
    const assets = config.release?.assets
    if (assets !== undefined) validateReleaseAssets(assets)
    return {
        mode,
        ...(paths !== undefined ? { paths } : {}),
        ...(assets !== undefined ? { assets } : {})
    }
}

function validateReleaseAssets(assets: unknown): asserts assets is ReleaseAsset[] {
    const valid = Array.isArray(assets) && assets.every((asset) => typeof asset === 'object' && asset !== null
        && typeof (asset as ReleaseAsset).path === 'string'
        && ['name', 'label'].every((key) => (asset as Record<string, unknown>)[key] === undefined || typeof (asset as Record<string, unknown>)[key] === 'string'))
    if (!valid) throw new Error('`release.assets` must be an array of `{ path, name?, label? }` objects.')
}

function validateReleasePaths(paths: unknown): asserts paths is ReleasePathsConfig {
    const isGlobs = (value: unknown) => value === undefined || (Array.isArray(value) && value.every((glob) => typeof glob === 'string'))
    if (typeof paths !== 'object' || paths === null || Array.isArray(paths)) {
        throw new Error('`release.paths` must be `false` or an object with `include` and `exclude` glob arrays.')
    }
    const { include, exclude } = paths as Record<string, unknown>
    if (!isGlobs(include)) throw new Error('`release.paths.include` must be an array of globs.')
    if (!isGlobs(exclude)) throw new Error('`release.paths.exclude` must be an array of globs.')
}

export const defaultReleasePolicy: ReleasePolicy = { mode: defaultReleaseMode }

/**
 * Returns a matcher for release paths, or `undefined` when every path may release.
 * `include` defaults to every path; `!glob` entries in `include` exclude, as in
 * `package.json` `files`, instead of matching everything else.
 */
export function createReleasePathMatcher(paths: ReleasePathsConfig | false | undefined) {
    if (!paths) return undefined
    const globs = paths.include ?? ['**']
    const positive = globs.filter((glob) => !glob.startsWith('!'))
    const negated = globs.filter((glob) => glob.startsWith('!')).map((glob) => glob.slice(1))
    if (!positive.length) return () => false
    const include = picomatch(positive, { dot: true })
    const exclude = picomatch([...paths.exclude ?? defaultReleasePathExcludes, ...negated], { dot: true })
    return (file: string) => include(file) && !exclude(file)
}

/**
 * Release level of a commit type in the given mode, ignoring breaking markers and paths.
 * Use `resolveCommitRelease()` for the full decision.
 */
export function getReleaseType(type: string | undefined, scope?: string, policy: ReleasePolicy = defaultReleasePolicy): ReleaseType | undefined {
    const release = findCommitRule(type, scope)?.release
    if (release === undefined) return undefined
    return capRelease(release, type, policy)
}

function capRelease(release: ReleaseType, type: string | undefined, policy: ReleasePolicy): ReleaseType {
    if (policy.mode === 'explicit' && normalizeType(type) !== 'Bump' && (release === 'major' || release === 'minor')) return 'patch'
    return release
}

/**
 * The first character of a scope or summary: a letter in either case, a digit,
 * or a code, issue, or emphasis marker. Release notes capitalize the summary.
 */
const startCharacter = String.raw`[\p{L}\p{N}\x60_#~]`
const startPattern = new RegExp(`^${startCharacter}`, 'u')

// The scope stops at the first `)`, so a summary such as `Handle Foo(Bar): Baz` stays whole.
// Types match without case: `fix`, `Fix`, and `FIX` are the same type.
export const headerPattern = new RegExp(String.raw`^([A-Za-z]\w*)(?:\((${startCharacter}[^)]*)\))?: (${startCharacter}.*)$`, 'u')
const breakingHeaderPattern = new RegExp(String.raw`^([A-Za-z]\w*)(?:\((${startCharacter}[^)]*)\))?!: (${startCharacter}.*)$`, 'u')
const footerStartPattern = /^BREAKING[ -]CHANGE:[ \t]*(.*)$/
// GitHub's revert button writes `Revert "<header>"`, a squash merge appends ` (#123)`,
// and git 2.43+ writes `Reapply "<header>"` when a revert is reverted.
const githubRevertPattern = /^(Revert|Reapply) "([\s\S]+)"(?: \(#\d+\))?$/
const revertHashPattern = /This reverts commit ([0-9a-f]{7,40})/gi
const fencePattern = /^\s*(```|~~~)/

export interface ParsedCommit {
    hash?: string
    header: string
    body: string
    type?: string
    scope?: string
    subject?: string
    /** Where a breaking marker was found, if any. */
    breaking?: 'header' | 'footer'
    /** Texts of `BREAKING CHANGE:` footers; continuation lines keep their line breaks. */
    breakingNotes?: string[]
    /** Message layout problems that do not change the release. */
    layout?: Array<'body-leading-blank' | 'footer-leading-blank'>
    revert?: {
        header?: string
        /** The first reverted hash, lowercase. */
        hash?: string
        /** Every reverted hash, lowercase; a squashed commit can revert several. */
        hashes?: string[]
        /** `Reapply "<header>"`: a revert of the revert of `header`. */
        reapply?: boolean
    }
}

const trailerPattern = /^[\w-]+: /

/**
 * `BREAKING CHANGE:` footers outside code fences. Each runs, line breaks kept,
 * until another footer or a git trailer, as Conventional Commits footers do.
 */
function readBreakingFooters(lines: string[]) {
    const notes: string[] = []
    const starts: number[] = []
    let current: string[] | undefined
    let fenced = false
    const finish = () => {
        if (current) notes.push(current.join('\n').trim())
        current = undefined
    }
    lines.forEach((line, index) => {
        if (fencePattern.test(line)) fenced = !fenced
        const start = fenced ? null : footerStartPattern.exec(line)
        if (start) {
            finish()
            starts.push(index)
            current = [start[1]]
        } else if (current && !fenced && trailerPattern.test(line)) {
            finish()
        } else if (current) {
            current.push(line.trimEnd())
        }
    })
    finish()
    return { starts, notes: notes.filter(Boolean) }
}

function parseHeader(header: string) {
    const regular = headerPattern.exec(header)
    const match = regular ?? breakingHeaderPattern.exec(header)
    if (!match) return undefined
    // The table's spelling, so `bump(minor): …` and `Bump(Minor): …` resolve alike.
    const type = canonicalType(match[1])
    return { type, scope: canonicalScope(type, match[2]), subject: match[3], breaking: !regular }
}

export function parseCommit(message: string, hash?: string): ParsedCommit {
    const normalized = message.replace(/\r\n?/g, '\n').trim()
    const [rawHeader = '', ...rest] = normalized.split('\n')
    const header = rawHeader.trimEnd()
    const body = rest.join('\n').trim()
    const parsed: ParsedCommit = { header, body, ...(hash ? { hash } : {}) }

    const footers = readBreakingFooters(rest)
    const layout: NonNullable<ParsedCommit['layout']> = []
    if (rest.length && rest[0].trim()) layout.push('body-leading-blank')
    if (footers.starts.some((index) => index > 0 && rest[index - 1].trim())) layout.push('footer-leading-blank')
    if (layout.length) parsed.layout = layout
    if (footers.notes.length) parsed.breakingNotes = footers.notes

    const match = parseHeader(header)
    if (match) {
        parsed.type = match.type
        if (match.scope) parsed.scope = match.scope
        parsed.subject = match.subject
        if (match.breaking) parsed.breaking = 'header'
    }
    if (!parsed.breaking && footers.starts.length) parsed.breaking = 'footer'

    const githubRevert = githubRevertPattern.exec(header)
    if (githubRevert || parsed.type === 'Revert') {
        const revertedHeader = githubRevert?.[2] ?? (parsed.subject && parseHeader(parsed.subject) ? parsed.subject : undefined)
        const hashes = [...new Set([...body.matchAll(revertHashPattern)].map((found) => found[1].toLowerCase()))]
        parsed.revert = {
            ...(revertedHeader ? { header: revertedHeader } : {}),
            ...(hashes.length ? { hash: hashes[0], hashes } : {}),
            ...(githubRevert?.[1] === 'Reapply' ? { reapply: true } : {})
        }
    }
    return parsed
}

export type CommitViolationRule =
    | 'header-format'
    | 'subject-full-stop'
    | 'unknown-type'
    | 'legacy-type'
    | 'implicit-breaking'
    | 'release-paths'
    | 'scope-case'
    | 'body-leading-blank'
    | 'footer-leading-blank'

export interface CommitViolation {
    rule: CommitViolationRule
    /** Errors fail `aronrepo check`; warnings are printed only. Defaults to `error`. */
    severity?: 'error' | 'warning'
    message: string
    /** A header that satisfies the policy, when one can be derived. */
    suggestion?: string
}

export interface CommitDecision {
    hash?: string
    header: string
    type?: string
    scope?: string
    subject?: string
    /** Texts of `BREAKING CHANGE:` footers, kept for `Bump(Major)` release notes. */
    breakingNotes?: string[]
    /** Where a breaking marker was found, if any. */
    breaking?: 'header' | 'footer'
    /** Effective release level after mode, breaking markers, reverts, and paths. */
    release: ReleaseType
    reasons: string[]
    violations: CommitViolation[]
}

export interface ResolveCommitOptions {
    /** Files the commit changes. Omit it to skip the release path check. */
    files?: string[]
    /** Decides whether a changed file ships in a published package. */
    isReleasePath?: (file: string) => boolean
}

export const nonReleaseAlternatives = ['Chore', 'Refactor', 'Style', 'Test', 'Docs', 'Build', 'CI', 'Benchmark', 'Example']

function suggestNonReleaseHeader(commit: ParsedCommit) {
    // A GitHub revert has no subject; its whole header becomes the summary.
    const subject = (commit.subject ?? commit.header).replace(/\.+$/, '')
    const scope = commit.scope ? `(${commit.scope})` : ''
    switch (commit.type) {
        case 'Docs':
            return `Docs: ${subject}`
        case 'Upgrade':
            return `Chore(Deps): ${subject}`
        default:
            return `Chore${scope}: ${subject}`
    }
}

const looseHeaderPattern = /^(\w+)(?:\(([^)]*)\))?(!)?:(\s*)(.*)$/

function diagnoseHeader(header: string, mode: ReleaseMode) {
    const format = 'Use `Type(Scope): Summary` or `Type: Summary` with an Aronrepo commit type.'
    const match = looseHeaderPattern.exec(header)
    if (!match) return format
    const [, , scope, bang, space, subject] = match
    if (bang && mode === 'explicit') return `Aronrepo headers do not use \`!\` in explicit mode. ${format}`
    if (scope !== undefined && !startPattern.test(scope)) return `The scope \`${scope}\` must start with a letter or digit. ${format}`
    if (space !== ' ') return `Put exactly one space after the colon. ${format}`
    if (!subject) return `The summary is empty. ${format}`
    if (!startPattern.test(subject)) return `The summary must start with a letter or digit. ${format}`
    return format
}

function formatRelease(release: ReleaseType | undefined) {
    return release ? release : 'none'
}

export function resolveCommitRelease(
    input: string | ParsedCommit,
    policy: ReleasePolicy = defaultReleasePolicy,
    options: ResolveCommitOptions = {}
): CommitDecision {
    const commit = typeof input === 'string' ? parseCommit(input) : input
    const decision: CommitDecision = {
        ...(commit.hash ? { hash: commit.hash } : {}),
        header: commit.header,
        ...(commit.type ? { type: commit.type } : {}),
        ...(commit.scope ? { scope: commit.scope } : {}),
        ...(commit.subject ? { subject: commit.subject } : {}),
        ...(commit.breakingNotes ? { breakingNotes: commit.breakingNotes } : {}),
        ...(commit.breaking ? { breaking: commit.breaking } : {}),
        release: false,
        reasons: [],
        violations: []
    }

    if (commit.revert?.header && !commit.type) {
        // GitHub's default `Revert "Type(Scope): Summary"` header.
        decision.type = 'Revert'
    } else if (!commit.type) {
        decision.reasons.push('Header does not follow `Type(Scope): Summary`; no release.')
        decision.violations.push({
            rule: 'header-format',
            message: diagnoseHeader(commit.header, policy.mode)
        })
        return decision
    } else if (!types.includes(commit.type) && !legacyTypes.includes(commit.type)) {
        decision.reasons.push(`Unknown type \`${commit.type}\`; no release.`)
        decision.violations.push({
            rule: 'unknown-type',
            message: `\`${commit.type}\` is not an Aronrepo commit type. Use one of: ${types.join(', ')}.`
        })
        return decision
    } else if (!findCommitRule(commit.type, commit.scope)) {
        const scoped = commits.filter(({ type }) => type === commit.type).map(({ type, scope }) => `\`${type}(${scope})\``).join(', ')
        decision.reasons.push(`\`${commit.type}${commit.scope ? `(${commit.scope})` : ''}\` is not an Aronrepo commit type; no release.`)
        decision.violations.push({
            rule: 'unknown-type',
            message: commit.scope
                ? `\`${commit.type}(${commit.scope})\` has an unknown scope. Use one of: ${scoped}.`
                : `\`${commit.type}\` needs a scope: ${scoped}.`
        })
        return decision
    }

    if (commit.subject?.endsWith('.')) {
        decision.violations.push({
            rule: 'subject-full-stop',
            message: 'The summary must not end with a period.',
            suggestion: commit.header.replace(/\.+$/, '')
        })
    }
    for (const rule of commit.layout ?? []) {
        decision.violations.push({
            rule,
            severity: 'warning',
            message: rule === 'body-leading-blank'
                ? 'Leave a blank line between the header and the body.'
                : 'Leave a blank line before a `BREAKING CHANGE:` footer.'
        })
    }

    if (commit.type && legacyTypes.includes(commit.type)) {
        const replacement = normalizeType(commit.type)
        const scope = commit.scope ? `(${commit.scope})` : ''
        decision.reasons.push(`\`${commit.type}\` is a legacy type; it releases like \`${replacement}\`.`)
        decision.violations.push({
            rule: 'legacy-type',
            message: `\`${commit.type}\` is a legacy Aronrepo type. Use \`${replacement}\`.`,
            suggestion: `${replacement}${scope}: ${commit.subject ?? ''}`
        })
    }

    let release: ReleaseType
    // git writes the header of a revert, so its own files, not a type, decide whether it ships.
    const revertsHeader = decision.type === 'Revert' && Boolean(commit.revert?.header)
    if (decision.type === 'Revert' && commit.revert?.header) {
        // The reverted header on its own; the files of the revert are checked below.
        const reverted = resolveCommitRelease(commit.revert.header, policy)
        const verb = commit.revert.reapply ? 'Reapplies' : 'Reverts'
        if (!reverted.type || reverted.violations.some(({ rule }) => rule === 'header-format' || rule === 'unknown-type')) {
            // A commit from before the policy, or with an unknown type, may still have changed published code.
            release = capRelease(findCommitRule('Revert')!.release, 'Revert', policy)
            decision.reasons.push(`${verb} \`${commit.revert.header}\`, which is not an Aronrepo header; it releases ${formatRelease(release)} like \`Revert\`.`)
        } else if (reverted.type === 'Bump' && reverted.release) {
            // Undoing a version bump does not raise the version again, and a reapplied bump may
            // have shipped already: only the owner knows, and says so with a new `Bump` commit.
            release = 'patch'
            decision.reasons.push(commit.revert.reapply
                ? `${verb} \`${commit.revert.header}\`; reapplying a \`Bump\` releases patch. To release ${reverted.release} again, the owner adds a new \`Bump(${reverted.scope})\` commit.`
                : `${verb} \`${commit.revert.header}\`; reverting a \`Bump\` releases patch.`)
        } else {
            release = reverted.release
            decision.reasons.push(`${verb} \`${commit.revert.header}\`, which releases ${formatRelease(release)}.`)
        }
    } else {
        const rule = findCommitRule(decision.type, decision.scope)!
        release = capRelease(rule.release, decision.type, policy)
        decision.reasons.push(`\`${decision.type}${decision.scope ? `(${decision.scope})` : ''}\` releases ${formatRelease(release)} in ${policy.mode} mode.`)
        if (release !== rule.release) {
            decision.reasons.push(`Explicit mode caps \`${decision.type}\` at patch; only \`Bump(Minor)\` or \`Bump(Major)\` raise the version further.`)
        }
    }

    const isBumpMajor = decision.type === 'Bump' && decision.scope === 'Major'
    if (commit.breaking && !isBumpMajor) {
        const marker = commit.breaking === 'header' ? '`!` header' : '`BREAKING CHANGE:` footer'
        if (policy.mode === 'auto') {
            release = 'major'
            decision.reasons.push(`The ${marker} releases major in auto mode.`)
        } else {
            decision.reasons.push(`The ${marker} is ignored in explicit mode; only \`Bump(Major)\` releases major.`)
            decision.violations.push({
                rule: 'implicit-breaking',
                message: `A ${marker} does not release a major version in explicit mode. Describe the change without the breaking marker, or ask the repository owner whether to add a \`Bump(Major)\` commit.`
            })
        }
    }

    const isBump = decision.type === 'Bump'
    if (release && !isBump && options.files && options.isReleasePath) {
        const releaseFiles = options.files.filter(options.isReleasePath)
        if (!releaseFiles.length && revertsHeader) {
            // Such as an empty revert of a `Bump`: it undoes a release decision and changes no published file.
            decision.reasons.push('The revert changes no release paths; no release.')
            release = false
        } else if (!releaseFiles.length) {
            const label = `\`${decision.type}${decision.scope ? `(${decision.scope})` : ''}\``
            const onlyBreaking = commit.type !== undefined && findCommitRule(commit.type, commit.scope)?.release === false
            decision.reasons.push('No changed file ships in a published package; no release.')
            decision.violations.push(onlyBreaking
                ? {
                    rule: 'release-paths',
                    message: `${label} releases ${formatRelease(release)} only because of its breaking marker, but the commit changes no release paths. Remove the breaking marker.`,
                    ...(commit.breaking === 'header' ? { suggestion: commit.header.replace('!:', ':') } : {})
                }
                : {
                    rule: 'release-paths',
                    message: `${label} releases ${formatRelease(release)}, but the commit changes no release paths. Use a non-release type: ${nonReleaseAlternatives.join(', ')}.`,
                    suggestion: suggestNonReleaseHeader({ ...commit, type: decision.type })
                })
            release = false
        }
    }

    decision.release = release
    return decision
}

export interface CommitInput {
    message: string
    hash?: string
    files?: string[]
}

export interface ReleaseDecision {
    release: ReleaseType
    commits: CommitDecision[]
}

export function resolveRelease(
    inputs: CommitInput[],
    policy: ReleasePolicy = defaultReleasePolicy,
    options: Omit<ResolveCommitOptions, 'files'> = {}
): ReleaseDecision {
    const parsed = inputs.map((input) => parseCommit(input.message, input.hash))
    const decisions = parsed.map((commit, index) =>
        resolveCommitRelease(commit, policy, { ...options, ...(inputs[index].files ? { files: inputs[index].files } : {}) }))

    // A revert and the commits it reverts cancel each other when both are unreleased.
    // Newest first, so reverting a revert cancels that pair and keeps the original commit.
    // A short hash that matches several commits cancels nothing.
    // A cancelled commit releases nothing, so whether its type should release no longer matters.
    const cancelled = new Set<number>()
    const settle = (index: number, reason: string) => {
        cancelled.add(index)
        decisions[index].release = false
        decisions[index].reasons.push(reason)
        decisions[index].violations = decisions[index].violations.filter(({ rule }) => rule !== 'release-paths')
    }
    const cancel = (target: number, other: number) => settle(target, `Cancelled by \`${parsed[other].header}\` in the same release.`)
    for (let index = parsed.length - 1; index >= 0; index--) {
        const hashes = parsed[index].revert?.hashes ?? []
        if (!hashes.length || cancelled.has(index)) continue
        const targets = hashes.map((revertedHash) => {
            const matches = parsed.flatMap((candidate, candidateIndex) =>
                candidateIndex < index && candidate.hash?.toLowerCase().startsWith(revertedHash) ? [candidateIndex] : [])
            return matches.length === 1 && !cancelled.has(matches[0]) ? matches[0] : undefined
        })
        for (const target of targets) if (target !== undefined) cancel(target, index)
        // A revert that also reverts commits outside the range still releases for them.
        if (targets.every((target) => target !== undefined)) {
            const reverted = targets.map((target) => parsed[target!].header).join('`, `')
            settle(index, `Cancelled by \`${reverted}\` in the same release.`)
        }
    }

    return {
        release: maxRelease(...decisions.map(({ release }) => release)),
        commits: decisions
    }
}

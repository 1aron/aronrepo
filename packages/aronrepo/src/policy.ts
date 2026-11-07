import picomatch from 'picomatch'
import { commits, findCommitRule, legacyTypes, maxRelease, normalizeType, types, type ReleaseType } from './commits'

/**
 * - `explicit`: only `Bump(Major)` and `Bump(Minor)` raise major and minor versions.
 *   `Add` releases a patch, and breaking markers never change the level.
 * - `auto`: `Add` releases a minor version and a `BREAKING CHANGE:` footer or `!`
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

export interface AronrepoConfig {
    release?: {
        mode?: ReleaseMode
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
}

export const defaultReleasePathExcludes = [
    '**/tests/**',
    '**/test/**',
    '**/__tests__/**',
    '**/*.{test,spec}.*',
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
    return {
        mode,
        ...(config.release?.paths !== undefined ? { paths: config.release.paths } : {})
    }
}

export const defaultReleasePolicy: ReleasePolicy = { mode: defaultReleaseMode }

/** Returns a matcher for release paths, or `undefined` when every path may release. */
export function createReleasePathMatcher(paths: ReleasePathsConfig | false | undefined) {
    if (!paths || !paths.include) return undefined
    const include = picomatch(paths.include.length ? paths.include : ['!**'], { dot: true })
    const exclude = picomatch(paths.exclude ?? defaultReleasePathExcludes, { dot: true })
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
    if (policy.mode === 'explicit' && type !== 'Bump' && (release === 'major' || release === 'minor')) return 'patch'
    return release
}

// The scope stops at the first `)`, so a summary such as `Handle Foo(Bar): Baz` stays whole.
export const headerPattern = /^([A-Z]\w*)(?:\(([0-9A-Z`_#~][^)]*)\))?: ([0-9A-Z`_#~].*)$/
const breakingHeaderPattern = /^([A-Z]\w*)(?:\(([^)]*)\))?!: (.+)$/
const breakingNotePattern = /^BREAKING[ -]CHANGE:/m
const footerLinePattern = /^BREAKING[ -]CHANGE:/
const githubRevertPattern = /^Revert "([\s\S]+)"$/
const revertHashPattern = /This reverts commit ([0-9a-f]{7,40})/i

export interface ParsedCommit {
    hash?: string
    header: string
    body: string
    type?: string
    scope?: string
    subject?: string
    /** Where a breaking marker was found, if any. */
    breaking?: 'header' | 'footer'
    /** Texts of `BREAKING CHANGE:` footers. */
    breakingNotes?: string[]
    /** Message layout problems that do not change the release. */
    layout?: Array<'body-leading-blank' | 'footer-leading-blank'>
    revert?: {
        header?: string
        hash?: string
    }
}

const trailerPattern = /^[\w-]+: /

/** `BREAKING CHANGE:` footer texts; each runs until a blank line, another footer, or a git trailer. */
function readBreakingNotes(lines: string[]) {
    const notes: string[] = []
    let current: string[] | undefined
    for (const line of lines) {
        const start = /^BREAKING[ -]CHANGE:\s*(.*)$/.exec(line)
        if (start) {
            if (current) notes.push(current.join(' ').trim())
            current = [start[1]]
        } else if (current && line.trim() && !trailerPattern.test(line)) {
            current.push(line.trim())
        } else if (current) {
            notes.push(current.join(' ').trim())
            current = undefined
        }
    }
    if (current) notes.push(current.join(' ').trim())
    return notes.filter(Boolean)
}

export function parseCommit(message: string, hash?: string): ParsedCommit {
    const normalized = message.replace(/\r\n/g, '\n').trim()
    const [header = '', ...rest] = normalized.split('\n')
    const body = rest.join('\n').trim()
    const parsed: ParsedCommit = { header, body, ...(hash ? { hash } : {}) }

    const layout: NonNullable<ParsedCommit['layout']> = []
    if (rest.length && rest[0].trim()) layout.push('body-leading-blank')
    if (rest.some((line, index) => index > 0 && footerLinePattern.test(line) && rest[index - 1].trim())) layout.push('footer-leading-blank')
    if (layout.length) parsed.layout = layout
    const breakingNotes = readBreakingNotes(rest)
    if (breakingNotes.length) parsed.breakingNotes = breakingNotes

    const regular = headerPattern.exec(header)
    const match = regular ?? breakingHeaderPattern.exec(header)
    if (match) {
        parsed.type = match[1]
        if (match[2]) parsed.scope = match[2]
        parsed.subject = match[3]
        if (!regular) parsed.breaking = 'header'
    }
    if (!parsed.breaking && breakingNotePattern.test(body)) parsed.breaking = 'footer'

    const githubRevert = githubRevertPattern.exec(header)
    if (githubRevert || parsed.type === 'Revert') {
        const revertedHeader = githubRevert?.[1] ?? (parsed.subject && headerPattern.test(parsed.subject) ? parsed.subject : undefined)
        const revertedHash = revertHashPattern.exec(body)?.[1]
        parsed.revert = {
            ...(revertedHeader ? { header: revertedHeader } : {}),
            ...(revertedHash ? { hash: revertedHash } : {})
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
    const subject = commit.subject ?? ''
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

const looseHeaderPattern = /^(\w+)(?:\(([^)]*)\))?(!)?: ?(.*)$/

function diagnoseHeader(header: string) {
    const format = 'Use `Type(Scope): Summary` or `Type: Summary` with an Aronrepo commit type.'
    const match = looseHeaderPattern.exec(header)
    if (!match) return format
    const [, type, scope, bang, subject] = match
    if (!/^[A-Z]/.test(type)) return `The type \`${type}\` must be PascalCase, such as \`${type[0].toUpperCase()}${type.slice(1)}\`. ${format}`
    if (bang) return `Aronrepo headers do not use \`!\`. ${format}`
    if (scope !== undefined && !/^[0-9A-Z`_#~]/.test(scope)) return `The scope \`${scope}\` must start with an uppercase letter or digit. ${format}`
    if (!subject) return `The summary is empty. ${format}`
    if (!/^[0-9A-Z`_#~]/.test(subject)) return `The summary must start with an uppercase letter or digit. ${format}`
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
            message: diagnoseHeader(commit.header)
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
        decision.reasons.push(`\`${commit.type}${commit.scope ? `(${commit.scope})` : ''}\` is not an Aronrepo commit type; no release.`)
        decision.violations.push({
            rule: 'unknown-type',
            message: `\`${commit.type}\` needs a scope: ${commits.filter(({ type }) => type === commit.type).map(({ type, scope }) => `\`${type}(${scope})\``).join(', ')}.`
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
    if (decision.type === 'Revert' && commit.revert?.header) {
        const reverted = resolveCommitRelease(commit.revert.header, policy, options)
        release = reverted.release
        decision.reasons.push(`Reverts \`${commit.revert.header}\`, which releases ${formatRelease(release)}.`)
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
        if (!releaseFiles.length) {
            decision.reasons.push('No changed file ships in a published package; no release.')
            decision.violations.push({
                rule: 'release-paths',
                message: `\`${decision.type}${decision.scope ? `(${decision.scope})` : ''}\` releases ${formatRelease(release)}, but the commit changes no release paths. Use a non-release type: ${nonReleaseAlternatives.join(', ')}.`,
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

    // A revert and the commit it reverts cancel each other when both are unreleased.
    // Newest first, so reverting a revert cancels that pair and keeps the original commit.
    const cancelled = new Set<number>()
    for (let index = parsed.length - 1; index >= 0; index--) {
        const revertedHash = parsed[index].revert?.hash
        if (!revertedHash || cancelled.has(index)) continue
        const revertedIndex = parsed.findIndex((candidate, candidateIndex) =>
            candidateIndex < index && candidate.hash?.startsWith(revertedHash))
        if (revertedIndex === -1 || cancelled.has(revertedIndex)) continue
        for (const [target, other] of [[index, revertedIndex], [revertedIndex, index]]) {
            cancelled.add(target)
            decisions[target].release = false
            decisions[target].reasons.push(`Cancelled by \`${parsed[other].header}\` in the same release.`)
        }
    }

    return {
        release: maxRelease(...decisions.map(({ release }) => release)),
        commits: decisions
    }
}
